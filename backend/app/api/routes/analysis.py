from fastapi import APIRouter, Body, Depends, HTTPException, Query
from app.db.prisma_client import Prisma
from app.db.session import get_db
from app.api.dependencies import get_current_user
from app.schemas.api import AnalysisResult, AnalysisResultCard
from typing import List, Optional
import re
import string
from difflib import SequenceMatcher
from prisma import Json
from prisma.errors import MissingRequiredValueError
from datetime import datetime
from app.services.auth_mailer import send_candidate_selection_email

router = APIRouter()

SKILL_ALIASES = {
    "ms excel": "microsoft excel",
    "excel": "microsoft excel",
    "microsoft excel": "microsoft excel",
    "ms word": "microsoft word",
    "word": "microsoft word",
    "microsoft word": "microsoft word",
    "ms office": "microsoft office",
    "microsoft office": "microsoft office",
    "powerpoint": "microsoft powerpoint",
    "ms powerpoint": "microsoft powerpoint",
    "microsoft powerpoint": "microsoft powerpoint",
}

SKILL_SYNONYMS = {
    "cybersecurity protocols": "cybersecurity",
    "problem-solving": "problem solving",
    "problem solving": "problem solving",
    "communication skills": "communication",
}

GROUPED_SKILL_PREFIXES = {
    "microsoft office": "microsoft",
    "ms office": "microsoft",
    "office": "microsoft",
}

GROUPED_SKILL_QUALIFIERS = {
    "advanced", "beginner", "basic", "intermediate", "expert", "proficient",
    "strong", "good", "excellent", "hands on",
}

NOISE_TERMS = {
    "personal information", "date of birth", "dob", "nationality", "marital status", "gender",
    "contact", "email", "phone", "address", "linkedin", "declaration", "references",
    "education", "experience", "projects", "certifications", "awards", "summary", "objective",
    "name", "candidate", "profile", "india", "west bengal", "kolkata", "meerut",
}

SKILL_HINT_TOKENS = {
    "python", "java", "javascript", "react", "next", "node", "sql", "postgres", "mysql", "mongodb",
    "excel", "word", "powerpoint", "office", "sharepoint", "ai", "ml", "nlp", "gcp", "aws", "azure",
    "cyber", "cybersecurity", "data", "analysis", "analytics", "audit", "compliance", "recruitment", "hr",
    "payroll", "communication", "leadership", "teamwork", "problem", "solving", "adaptability",
}


def format_candidate_name(file_name: str) -> str:
    stem = file_name.rsplit('.', 1)[0]
    cleaned = re.sub(r'[_\-]+', ' ', stem).strip()
    return cleaned or stem


def resolve_candidate_name(resume) -> str:
    parsed = resume.parsed_data if isinstance(resume.parsed_data, dict) else {}
    full_name = parsed.get("full_name") if parsed else None
    if isinstance(full_name, str) and full_name.strip():
        return full_name.strip()
    return format_candidate_name(resume.file_name)


def _normalize_person_identifier(value: str) -> str:
    normalized = (value or "").strip().lower()
    normalized = re.sub(rf"[{re.escape(string.punctuation)}]", " ", normalized)
    return re.sub(r"\s+", " ", normalized).strip()


def resolve_person_key(resume) -> str:
    parsed = resume.parsed_data if isinstance(getattr(resume, "parsed_data", None), dict) else {}
    email = parsed.get("email") if isinstance(parsed, dict) else None
    if isinstance(email, str) and email.strip():
        return f"email:{email.strip().lower()}"

    full_name = parsed.get("full_name") if isinstance(parsed, dict) else None
    if isinstance(full_name, str) and full_name.strip():
        return f"name:{_normalize_person_identifier(full_name)}"

    return f"file:{_normalize_person_identifier(getattr(resume, 'file_name', 'unknown'))}"


def _is_analysis_better(candidate, incumbent) -> bool:
    candidate_score = float(getattr(candidate, "score", 0) or 0)
    incumbent_score = float(getattr(incumbent, "score", 0) or 0)
    if candidate_score != incumbent_score:
        return candidate_score > incumbent_score

    candidate_created = getattr(candidate, "created_at", None) or datetime.min
    incumbent_created = getattr(incumbent, "created_at", None) or datetime.min
    return candidate_created > incumbent_created


def _dedupe_analyses_by_person(analyses: list) -> list:
    best_by_person: dict[str, object] = {}
    for analysis in analyses:
        resume = getattr(analysis, "resume", None)
        if not resume:
            continue

        person_key = resolve_person_key(resume)
        existing = best_by_person.get(person_key)
        if not existing or _is_analysis_better(analysis, existing):
            best_by_person[person_key] = analysis

    deduped = list(best_by_person.values())
    deduped.sort(key=lambda item: float(getattr(item, "score", 0) or 0), reverse=True)
    return deduped


def resolve_skill_arrays(analysis) -> tuple[list[str], list[str]]:
    matched_skills = analysis.matched_skills or []
    missing_skills = analysis.missing_skills or []

    if not isinstance(matched_skills, list):
        matched_skills = []
    if not isinstance(missing_skills, list):
        missing_skills = []

    if matched_skills or missing_skills:
        return matched_skills, missing_skills

    job = getattr(analysis, 'job', None)
    resume = getattr(analysis, 'resume', None)
    job_skills = []

    if job and getattr(job, 'skills', None):
        job_skills = [
            _normalize_skill_name(js.skill.name)
            for js in job.skills
            if getattr(js, 'skill', None) and getattr(js.skill, 'name', None)
        ]

    parsed = resume.parsed_data if resume and isinstance(resume.parsed_data, dict) else {}
    resume_text = getattr(resume, 'content_text', None) or ""
    normalized_resume_skills = _extract_normalized_skills(parsed, resume_text)
    if job_skills:
        matched_set = {
            s
            for s in job_skills
            if s and _is_skill_present(s, normalized_resume_skills, resume_text)
        }
        matched_skills = [s for s in job_skills if s in matched_set]
        missing_skills = [s for s in job_skills if s and s not in matched_set]

    return matched_skills, missing_skills


def _normalize_skill_name(value: str) -> str:
    normalized = (value or "").strip().lower()
    normalized = re.sub(rf"[{re.escape(string.punctuation)}]", " ", normalized)
    normalized = re.sub(r"\s+", " ", normalized)
    if not normalized:
        return ""
    normalized = SKILL_ALIASES.get(normalized, normalized)
    return SKILL_SYNONYMS.get(normalized, normalized)


def _normalize_text(value: str) -> str:
    normalized = (value or "").lower()
    normalized = re.sub(rf"[{re.escape(string.punctuation)}]", " ", normalized)
    return re.sub(r"\s+", " ", normalized).strip()


def _expand_grouped_skills(resume_text: str) -> set[str]:
    expanded: set[str] = set()
    if not resume_text:
        return expanded

    for match in re.finditer(r"([A-Za-z][A-Za-z\s&./+-]{1,40})\(([^\)]+)\)", resume_text):
        prefix = _normalize_skill_name(match.group(1))
        grouped_raw = match.group(2)
        if not prefix or not grouped_raw:
            continue

        parts = [part.strip() for part in re.split(r"[,;/|]", grouped_raw) if part.strip()]
        if not parts:
            continue

        prefix_replacement = GROUPED_SKILL_PREFIXES.get(prefix)
        for part in parts:
            normalized_part = _normalize_skill_name(part)
            if not normalized_part:
                continue

            part_tokens = [token for token in normalized_part.split(" ") if token]
            if part_tokens and part_tokens[0] in GROUPED_SKILL_QUALIFIERS and len(part_tokens) > 1:
                normalized_part = _normalize_skill_name(" ".join(part_tokens[1:]))
                if not normalized_part:
                    continue

            if prefix_replacement and not normalized_part.startswith(prefix_replacement):
                expanded.add(_normalize_skill_name(f"{prefix_replacement} {normalized_part}"))
            else:
                expanded.add(normalized_part)

    return expanded


def _extract_skills_from_full_resume(resume_text: str) -> set[str]:
    normalized_text = _normalize_text(resume_text)
    if not normalized_text:
        return set()

    detected: set[str] = set()
    detected.update(_expand_grouped_skills(resume_text))

    for raw_term, canonical in SKILL_SYNONYMS.items():
        normalized_term = _normalize_text(raw_term)
        if normalized_term and normalized_term in normalized_text:
            detected.add(_normalize_skill_name(canonical))

    for token in list(SKILL_ALIASES.keys()) + list(SKILL_ALIASES.values()):
        normalized_token = _normalize_skill_name(token)
        if normalized_token and normalized_token in normalized_text:
            detected.add(normalized_token)

    # Parse comma-separated and bullet-like tokens from all sections.
    for line in resume_text.splitlines():
        cleaned_line = _normalize_text(line)
        if not cleaned_line:
            continue

        stripped_line = re.sub(r"^\s*(?:[-*]|\d+[\.)])\s*", "", cleaned_line)
        for fragment in re.split(r"[,;|]", stripped_line):
            normalized_fragment = _normalize_skill_name(fragment)
            if _is_probable_skill_token(normalized_fragment):
                detected.add(normalized_fragment)

    return detected


def _is_probable_skill_token(token: str) -> bool:
    if not token:
        return False

    value = _normalize_skill_name(token)
    if not value:
        return False

    if value in NOISE_TERMS:
        return False

    if len(value) < 2 or len(value) > 40:
        return False

    words = value.split()
    if len(words) > 5:
        return False

    if re.search(r"\b\d{4,}\b", value):
        return False

    if any(char.isdigit() for char in value) and len(words) <= 2:
        return False

    if "@" in value or "http" in value:
        return False

    alias_or_synonym_terms = {
        *[_normalize_skill_name(item) for item in SKILL_ALIASES.keys()],
        *[_normalize_skill_name(item) for item in SKILL_ALIASES.values()],
        *[_normalize_skill_name(item) for item in SKILL_SYNONYMS.keys()],
        *[_normalize_skill_name(item) for item in SKILL_SYNONYMS.values()],
    }

    if value in alias_or_synonym_terms:
        return True

    return any(token_part in SKILL_HINT_TOKENS for token_part in words)


def _fuzzy_ratio(left: str, right: str) -> float:
    if not left or not right:
        return 0.0
    return SequenceMatcher(None, left, right).ratio()


def _is_skill_present(required_skill: str, resume_skills: set[str], resume_text: str) -> bool:
    required = _normalize_skill_name(required_skill)
    if not required:
        return False

    required_terms = {required}
    required_terms.update({k for k, v in SKILL_SYNONYMS.items() if _normalize_skill_name(v) == required})

    normalized_resume_text = _normalize_text(resume_text)

    for term in required_terms:
        normalized_term = _normalize_skill_name(term)
        if not normalized_term:
            continue

        if normalized_term in resume_skills:
            return True

        if normalized_term in normalized_resume_text:
            return True

        for resume_skill in resume_skills:
            if normalized_term in resume_skill or resume_skill in normalized_term:
                return True

            if _fuzzy_ratio(normalized_term, resume_skill) >= 0.8:
                return True

    return False


def _extract_normalized_skills(parsed: dict, resume_text: str) -> set[str]:
    values = parsed.get("normalized_skills") if isinstance(parsed, dict) else None
    if not isinstance(values, list):
        values = parsed.get("skills") if isinstance(parsed, dict) else []

    normalized = {
        _normalize_skill_name(str(item))
        for item in (values or [])
        if isinstance(item, str) and _is_probable_skill_token(_normalize_skill_name(str(item)))
    }

    normalized.update(_extract_skills_from_full_resume(resume_text))

    return normalized


def _to_float(value) -> Optional[float]:
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        match = re.search(r"-?\d+(?:\.\d+)?", value)
        if match:
            try:
                return float(match.group(0))
            except ValueError:
                return None
    return None


def _clamp_01(value: float) -> float:
    return max(0.0, min(value, 1.0))


def _safe_str(value) -> Optional[str]:
    if isinstance(value, str) and value.strip():
        return value.strip()
    return None


def _safe_list(value) -> list:
    if isinstance(value, list):
        return value
    return []


def _normalize_string_list(value) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if isinstance(item, str) and str(item).strip()]


def _normalize_degrees(value) -> list[dict]:
    if not isinstance(value, list):
        return []

    normalized: list[dict] = []
    for item in value:
        if not isinstance(item, dict):
            continue

        degree = _safe_str(item.get("degree"))
        field = _safe_str(item.get("field"))
        cgpa = _to_float(item.get("cgpa"))
        normalized.append(
            {
                "degree": degree,
                "field": field,
                "cgpa": cgpa,
            }
        )

    return normalized


def _normalize_experience_list(value) -> list[dict]:
    if not isinstance(value, list):
        return []

    normalized: list[dict] = []
    for item in value:
        if not isinstance(item, dict):
            continue

        role = _safe_str(item.get("role"))
        duration = _safe_str(item.get("duration"))
        if role or duration:
            normalized.append(
                {
                    "role": role,
                    "duration": duration,
                }
            )

    return normalized


def _extract_cgpa(parsed: dict, resume_text: str) -> Optional[float]:
    for key in ("cgpa", "gpa", "cgpa_score"):
        raw = _to_float(parsed.get(key))
        if raw is not None:
            return raw if raw <= 10 else (raw / 10.0 if raw <= 100 else 10.0)

    match = re.search(r"(?:cgpa|gpa)\s*[:\-]?\s*([0-9](?:\.[0-9]+)?)", resume_text, re.IGNORECASE)
    if match:
        value = _to_float(match.group(1))
        if value is not None:
            return value

    return None


def _extract_percentage(parsed: dict, resume_text: str) -> Optional[float]:
    for key in ("percentage", "marks_percentage", "academic_percentage"):
        raw = _to_float(parsed.get(key))
        if raw is not None:
            return _clamp_01(raw / 100.0) * 100.0 if raw > 1 else raw * 100.0

    match = re.search(r"([0-9]{2}(?:\.[0-9]+)?)\s*%", resume_text)
    if match:
        value = _to_float(match.group(1))
        if value is not None:
            return _clamp_01(value / 100.0) * 100.0

    return None


def _extract_sgpa(parsed: dict, resume_text: str) -> Optional[float]:
    raw = _to_float(parsed.get("sgpa"))
    if raw is not None:
        return raw if raw <= 10 else (raw / 10.0 if raw <= 100 else 10.0)

    match = re.search(r"(?:sgpa)\s*[:\-]?\s*([0-9](?:\.[0-9]+)?)", resume_text, re.IGNORECASE)
    if match:
        value = _to_float(match.group(1))
        if value is not None:
            return value

    return None


def _extract_internships(parsed: dict, resume_text: str) -> list[str]:
    internships = parsed.get("internships")
    if isinstance(internships, list):
        return [str(item).strip() for item in internships if str(item).strip()]

    lines = [line.strip() for line in resume_text.splitlines() if line.strip()]
    detected: list[str] = []
    for line in lines:
        lowered = line.lower()
        if "intern" in lowered and len(line) <= 120:
            detected.append(line)
        if len(detected) >= 5:
            break

    return detected


def _extract_degree(parsed: dict, resume_text: str) -> Optional[str]:
    degree = _safe_str(parsed.get("degree"))
    if degree:
        return degree

    education = _safe_str(parsed.get("education"))
    if education:
        return education

    match = re.search(r"(b\.?(tech|e|sc)|m\.?(tech|e|sc)|bachelor|master|phd|doctorate|diploma)", resume_text, re.IGNORECASE)
    if match:
        return match.group(0)

    return None


def _extract_university(parsed: dict, resume_text: str) -> Optional[str]:
    university = _safe_str(parsed.get("university"))
    if university:
        return university

    match = re.search(r"([A-Z][A-Za-z\s&\-.]{3,}(?:University|Institute|College))", resume_text)
    if match:
        return match.group(1).strip()

    return None


def _extract_experience(parsed: dict, resume_text: str, key: str) -> Optional[float]:
    raw = _to_float(parsed.get(key))
    if raw is not None:
        return max(raw, 0.0)

    if key == "total_experience" and _to_float(parsed.get("total_experience_years")) is not None:
        return max(_to_float(parsed.get("total_experience_years")) or 0.0, 0.0)

    if key == "total_experience":
        match = re.search(r"(\d+(?:\.\d+)?)\+?\s*(?:years?|yrs?)", resume_text, re.IGNORECASE)
        if match:
            value = _to_float(match.group(1))
            return max(value or 0.0, 0.0)

    return None


def _extract_required_experience(job_description: str) -> float:
    match = re.search(r"(\d+(?:\.\d+)?)\+?\s*(?:years?|yrs?)", job_description, re.IGNORECASE)
    if not match:
        return 1.0
    value = _to_float(match.group(1))
    return max(value or 1.0, 1.0)


def _derive_degree_relevance(parsed: dict, resume_text: str, job_text: str) -> float:
    direct_value = _to_float(parsed.get("degree_relevance"))
    if direct_value is not None:
        if direct_value > 1:
            return _clamp_01(direct_value / 100.0)
        return _clamp_01(direct_value)

    education_text = str(parsed.get("education") or "").lower()
    if not education_text:
        snippet = " ".join(resume_text.splitlines()[:30]).lower()
        education_text = snippet

    if not education_text:
        return 0.0

    level_keywords = {
        "phd": ["phd", "doctorate"],
        "master": ["master", "m.tech", "m.e", "msc", "ms"],
        "bachelor": ["bachelor", "b.tech", "b.e", "bsc", "bs", "undergraduate"],
        "diploma": ["diploma", "associate"],
    }

    candidate_levels = {
        level for level, variants in level_keywords.items()
        if any(token in education_text for token in variants)
    }
    required_levels = {
        level for level, variants in level_keywords.items()
        if any(token in job_text for token in variants)
    }

    if required_levels:
        if candidate_levels & required_levels:
            return 1.0
        if candidate_levels:
            return 0.6
        return 0.2

    return 0.7 if candidate_levels else 0.3


def _scale_soft_skill_value(value) -> Optional[float]:
    raw = _to_float(value)
    if raw is None:
        return None
    if raw <= 1:
        return _clamp_01(raw)
    if raw <= 10:
        return _clamp_01(raw / 10.0)
    return _clamp_01(raw / 100.0)


def _extract_soft_skill_scores(parsed: dict, resume_text: str) -> dict:
    soft_payload = parsed.get("soft_skills") if isinstance(parsed, dict) else None
    lowered_text = (resume_text or "").lower()

    keyword_map = {
        "communication": ["communication", "presentation", "verbal", "written"],
        "leadership": ["leadership", "led", "managed", "mentor"],
        "teamwork": ["teamwork", "collaboration", "cross-functional", "collaborated"],
        "problem_solving": ["problem solving", "troubleshooting", "resolved", "analytical"],
    }

    scores = {
        "communication": 0.0,
        "leadership": 0.0,
        "teamwork": 0.0,
        "problem_solving": 0.0,
    }

    if isinstance(soft_payload, dict):
        alias_keys = {
            "problem_solving": ["problem_solving", "problem-solving", "problemSolving"],
            "communication": ["communication"],
            "leadership": ["leadership"],
            "teamwork": ["teamwork"],
        }
        for skill, aliases in alias_keys.items():
            for alias in aliases:
                value = _scale_soft_skill_value(soft_payload.get(alias))
                if value is not None:
                    scores[skill] = value
                    break

    elif isinstance(soft_payload, list):
        text_blob = " ".join([str(item).lower() for item in soft_payload])
        for skill, tokens in keyword_map.items():
            if any(token in text_blob for token in tokens):
                scores[skill] = 1.0

    for skill, tokens in keyword_map.items():
        if scores[skill] == 0.0 and any(token in lowered_text for token in tokens):
            scores[skill] = 1.0

    return scores


def _extract_soft_skills_list(parsed: dict, resume_text: str) -> list[str]:
    soft_payload = parsed.get("soft_skills") if isinstance(parsed, dict) else None
    collected: list[str] = []

    if isinstance(soft_payload, list):
        collected.extend([str(item).strip().lower() for item in soft_payload if str(item).strip()])
    elif isinstance(soft_payload, dict):
        for key, value in soft_payload.items():
            if _scale_soft_skill_value(value) and _scale_soft_skill_value(value) > 0:
                collected.append(str(key).strip().lower())

    keyword_candidates = {
        "communication": ["communication", "presentation", "verbal", "written"],
        "leadership": ["leadership", "led", "managed", "mentor"],
        "teamwork": ["teamwork", "collaboration", "cross-functional", "collaborated"],
        "problem solving": ["problem solving", "troubleshooting", "resolved", "analytical"],
    }
    lowered_text = (resume_text or "").lower()
    for label, tokens in keyword_candidates.items():
        if any(token in lowered_text for token in tokens):
            collected.append(label)

    return sorted(list({item for item in collected if item}))


def _extract_projects_count(parsed: dict, resume_text: str) -> int:
    parsed_value = parsed.get("projects_count") if isinstance(parsed, dict) else None
    projects_count = int(_to_float(parsed_value) or 0)
    if projects_count > 0:
        return projects_count

    lines = [line.strip() for line in (resume_text or "").splitlines() if line and line.strip()]
    counter = 0
    for line in lines:
        if re.search(r"\b(project|developed|built|implemented)\b", line.lower()):
            counter += 1
    return min(counter, 12)


def _extract_candidate_factors(resume, job, matched_count: int, required_count: int) -> dict:
    parsed = resume.parsed_data if isinstance(resume.parsed_data, dict) else {}
    resume_text = (resume.content_text or "")
    job_text = f"{getattr(job, 'title', '')} {getattr(job, 'description', '')}".lower()

    total_experience = _extract_experience(parsed, resume_text, "total_experience")
    relevant_experience = _extract_experience(parsed, resume_text, "relevant_experience")
    if relevant_experience is None:
        relevant_experience = total_experience

    soft_scores = _extract_soft_skill_scores(parsed, resume_text)
    cgpa = _extract_cgpa(parsed, resume_text)
    percentage = _extract_percentage(parsed, resume_text)
    degree_relevance = _derive_degree_relevance(parsed, resume_text, job_text)
    projects_count = _extract_projects_count(parsed, resume_text)
    normalized_skills = sorted(list(_extract_normalized_skills(parsed, resume_text)))
    soft_skills = _extract_soft_skills_list(parsed, resume_text)
    education_degree = _extract_degree(parsed, resume_text)
    cgpa_or_percentage = cgpa if cgpa is not None else percentage

    return {
        "cgpa": cgpa,
        "percentage": percentage,
        "degree_relevance": degree_relevance,
        "total_experience_years": total_experience,
        "relevant_experience_years": relevant_experience,
        "required_experience_years": _extract_required_experience(getattr(job, "description", "") or ""),
        "matched_skill_count": matched_count,
        "required_skill_count": required_count,
        "projects_count": projects_count,
        "education_degree": education_degree,
        "cgpa_or_percentage": cgpa_or_percentage,
        "normalized_skills": normalized_skills,
        "soft_skills": soft_skills,
        "communication_score": soft_scores["communication"],
        "leadership_score": soft_scores["leadership"],
        "teamwork_score": soft_scores["teamwork"],
        "problem_solving_score": soft_scores["problem_solving"],
    }


def _compute_component_scores(factors: dict) -> dict:
    cgpa = factors.get("cgpa")
    percentage = factors.get("percentage")

    cgpa_norm = _clamp_01((cgpa or 0) / 10.0) if cgpa is not None else None
    percentage_norm = _clamp_01((percentage or 0) / 100.0) if percentage is not None else None

    degree_relevance = _clamp_01(float(factors.get("degree_relevance") or 0))
    total_experience = float(factors.get("total_experience_years") or 0.0)

    # Required bucket scoring: 0-1 years -> 20%, 1-3 years -> 60%, 3+ years -> 100%.
    if total_experience <= 1.0:
        experience_score = 0.2
    elif total_experience <= 3.0:
        experience_score = 0.6
    else:
        experience_score = 1.0

    # Relevant degree => 100, non-relevant => 50, then blend CGPA/percentage if present.
    base_education = 1.0 if degree_relevance >= 0.75 else 0.5
    if cgpa_norm is not None and percentage_norm is not None:
        academic_input = (cgpa_norm + percentage_norm) / 2.0
        education_score = _clamp_01((0.7 * base_education) + (0.3 * academic_input))
    elif cgpa_norm is not None:
        education_score = _clamp_01((0.7 * base_education) + (0.3 * cgpa_norm))
    elif percentage_norm is not None:
        education_score = _clamp_01((0.7 * base_education) + (0.3 * percentage_norm))
    else:
        education_score = _clamp_01(base_education)

    required_skill_count = int(factors.get("required_skill_count") or 0)
    matched_skill_count = int(factors.get("matched_skill_count") or 0)
    skill_match_score = (
        _clamp_01(matched_skill_count / required_skill_count)
        if required_skill_count > 0
        else 0.0
    )

    projects_count = int(factors.get("projects_count") or 0)
    if projects_count >= 4:
        project_score = 1.0
    elif projects_count >= 2:
        project_score = 0.75
    elif projects_count == 1:
        project_score = 0.5
    else:
        project_score = 0.2

    communication = _clamp_01(float(factors.get("communication_score") or 0.0))
    leadership = _clamp_01(float(factors.get("leadership_score") or 0.0))
    teamwork = _clamp_01(float(factors.get("teamwork_score") or 0.0))
    problem_solving = _clamp_01(float(factors.get("problem_solving_score") or 0.0))
    soft_skill_score = _clamp_01((communication + leadership + teamwork + problem_solving) / 4.0)

    final_score = _clamp_01(
        (0.40 * skill_match_score) +
        (0.20 * experience_score) +
        (0.15 * education_score) +
        (0.15 * project_score) +
        (0.10 * soft_skill_score)
    )

    return {
        "academic_score": education_score,
        "education_score": education_score,
        "experience_score": experience_score,
        "skill_match_score": skill_match_score,
        "project_score": project_score,
        "soft_skill_score": soft_skill_score,
        "final_score": final_score,
        "score": round(final_score * 100.0, 2),
    }


def _extract_candidate_details(analysis) -> dict:
    resume = getattr(analysis, "resume", None)
    parsed = resume.parsed_data if resume and isinstance(resume.parsed_data, dict) else {}
    resume_text = (getattr(resume, "content_text", None) or "")

    total_experience = _to_float(parsed.get("total_experience"))
    if total_experience is None:
        total_experience = getattr(analysis, "total_experience_years", None)

    relevant_experience = _to_float(parsed.get("relevant_experience"))
    if relevant_experience is None:
        relevant_experience = getattr(analysis, "relevant_experience_years", None)

    return {
        "cgpa": getattr(analysis, "cgpa", None) if getattr(analysis, "cgpa", None) is not None else _extract_cgpa(parsed, resume_text),
        "cgpa_or_percentage": getattr(analysis, "cgpa_or_percentage", None) if getattr(analysis, "cgpa_or_percentage", None) is not None else (parsed.get("cgpa_or_percentage") if isinstance(parsed.get("cgpa_or_percentage"), (int, float)) else None),
        "sgpa": _extract_sgpa(parsed, resume_text),
        "degree": getattr(analysis, "education_degree", None) or _extract_degree(parsed, resume_text),
        "university": _extract_university(parsed, resume_text),
        "total_experience_years": total_experience,
        "relevant_experience_years": relevant_experience,
        "projects_count": getattr(analysis, "projects_count", None) if getattr(analysis, "projects_count", None) is not None else _extract_projects_count(parsed, resume_text),
        "soft_skills": getattr(analysis, "soft_skills", None) if isinstance(getattr(analysis, "soft_skills", None), list) else _extract_soft_skills_list(parsed, resume_text),
        "normalized_skills": getattr(analysis, "normalized_skills", None) if isinstance(getattr(analysis, "normalized_skills", None), list) else sorted(list(_extract_normalized_skills(parsed, resume_text))),
        "internships": _extract_internships(parsed, resume_text),
        "communication_score": getattr(analysis, "communication_score", 0) or 0,
        "leadership_score": getattr(analysis, "leadership_score", 0) or 0,
        "teamwork_score": getattr(analysis, "teamwork_score", 0) or 0,
        "problem_solving_score": getattr(analysis, "problem_solving_score", 0) or 0,
        "degrees": _normalize_degrees(parsed.get("degrees")),
        "experience_list": _normalize_experience_list(parsed.get("experience_list")),
        "projects": _normalize_string_list(parsed.get("projects")),
        "certifications": _normalize_string_list(parsed.get("certifications")),
    }


def _resolve_selection_state_for_job(resume, job_id: str) -> tuple[bool, bool, str]:
    auto_selected = bool(getattr(resume, "auto_selected", False))
    selected = bool(getattr(resume, "selected", False))
    selection_status = str(getattr(resume, "selection_status", "rejected") or "rejected")

    parsed = getattr(resume, "parsed_data", None)
    parsed = parsed if isinstance(parsed, dict) else {}
    auto_selection = parsed.get("auto_selection") if isinstance(parsed.get("auto_selection"), dict) else {}
    per_job = auto_selection.get(job_id) if isinstance(auto_selection.get(job_id), dict) else {}

    auto_selected = bool(per_job.get("auto_selected", auto_selected))
    selected = bool(per_job.get("selected", selected))
    selection_status = str(per_job.get("selection_status", selection_status) or "rejected")

    return auto_selected, selected, selection_status


async def _persist_selection_state(
    db: Prisma,
    resume,
    *,
    job_id: str,
    auto_selected: bool,
    selected: bool,
    selection_status: str,
):
    try:
        await db.resume.update(
            where={"id": resume.id},
            data={
                "auto_selected": bool(auto_selected),
                "selected": bool(selected),
                "selection_status": selection_status,
            },
        )
        return
    except Exception as exc:
        message = str(exc).lower()
        if not any(token in message for token in ["unknown argument", "field does not exist", "could not find field"]):
            raise

    parsed = getattr(resume, "parsed_data", None)
    parsed = parsed if isinstance(parsed, dict) else {}
    auto_selection = parsed.get("auto_selection") if isinstance(parsed.get("auto_selection"), dict) else {}
    auto_selection[job_id] = {
        "auto_selected": bool(auto_selected),
        "selected": bool(selected),
        "selection_status": selection_status,
        "updated_at": datetime.utcnow().isoformat(),
    }
    parsed["auto_selection"] = auto_selection

    await db.resume.update(
        where={"id": resume.id},
        data={"parsed_data": Json(parsed)},
    )


@router.get("/", response_model=List[AnalysisResult])
async def list_analysis(
    job_id: Optional[str] = Query(default=None),
    current_user = Depends(get_current_user),
    db: Prisma = Depends(get_db)
):
    where = {"job_id": job_id} if job_id else {}
    analyses = await db.analysis.find_many(
        where=where,
        include={"resume": True, "job": {"include": {"skills": {"include": {"skill": True}}}}},
        order={"score": "desc"}
    )
    analyses = [a for a in analyses if getattr(getattr(a, "resume", None), "uploaded_by", None) == current_user.id and not bool(getattr(getattr(a, "resume", None), "is_deleted", False))]
    analyses = _dedupe_analyses_by_person(analyses)

    return [
        AnalysisResult(
            candidate_name=resolve_candidate_name(a.resume),
            score=a.score,
            education_score=getattr(a, "academic_score", 0) or 0,
            academic_score=getattr(a, "academic_score", 0) or 0,
            experience_score=getattr(a, "experience_score", 0) or 0,
            skill_match_score=getattr(a, "skill_match_score", 0) or 0,
            project_score=getattr(a, "project_score", 0) or 0,
            soft_skill_score=getattr(a, "soft_skill_score", 0) or 0,
            final_score=getattr(a, "final_score", 0) or 0,
            matched_skills=resolve_skill_arrays(a)[0],
            missing_skills=resolve_skill_arrays(a)[1]
        ) for a in analyses
    ]


@router.get("/results", response_model=List[AnalysisResultCard])
async def list_analysis_results(
    job_id: Optional[str] = Query(default=None),
    current_user=Depends(get_current_user),
    db: Prisma = Depends(get_db),
):
    where = {"job_id": job_id} if job_id else {}
    analyses = await db.analysis.find_many(
        where=where,
        include={"resume": True, "job": {"include": {"skills": {"include": {"skill": True}}}}},
        order={"score": "desc"},
    )
    analyses = [a for a in analyses if getattr(getattr(a, "resume", None), "uploaded_by", None) == current_user.id and not bool(getattr(getattr(a, "resume", None), "is_deleted", False))]
    analyses = _dedupe_analyses_by_person(analyses)

    results: List[AnalysisResultCard] = []
    for analysis in analyses:
        matched_skills, missing_skills = resolve_skill_arrays(analysis)
        details = _extract_candidate_details(analysis)
        auto_selected, selected, selection_status = _resolve_selection_state_for_job(analysis.resume, analysis.job_id)

        results.append(
            AnalysisResultCard(
                id=analysis.id,
                resume_id=analysis.resume.id,
                name=resolve_candidate_name(analysis.resume),
                email=(analysis.resume.parsed_data.get("email") if isinstance(analysis.resume.parsed_data, dict) else None),
                score=analysis.score,
                education_score=getattr(analysis, "academic_score", 0) or 0,
                academic_score=getattr(analysis, "academic_score", 0) or 0,
                experience_score=getattr(analysis, "experience_score", 0) or 0,
                skill_match_score=getattr(analysis, "skill_match_score", 0) or 0,
                project_score=getattr(analysis, "project_score", 0) or 0,
                soft_skill_score=getattr(analysis, "soft_skill_score", 0) or 0,
                final_score=getattr(analysis, "final_score", 0) or 0,
                top_skills=matched_skills[:3],
                matched_skills=matched_skills,
                missing_skills=missing_skills,
                cgpa=details["cgpa"],
                cgpa_or_percentage=details["cgpa_or_percentage"],
                sgpa=details["sgpa"],
                degree=details["degree"],
                university=details["university"],
                total_experience_years=details["total_experience_years"],
                relevant_experience_years=details["relevant_experience_years"],
                projects_count=details["projects_count"],
                soft_skills=details["soft_skills"],
                normalized_skills=details["normalized_skills"],
                internships=details["internships"],
                communication_score=details["communication_score"],
                leadership_score=details["leadership_score"],
                teamwork_score=details["teamwork_score"],
                problem_solving_score=details["problem_solving_score"],
                auto_selected=auto_selected,
                selected=selected,
                selection_status=selection_status,
                degrees=details["degrees"],
                experience_list=details["experience_list"],
                projects=details["projects"],
                certifications=details["certifications"],
            )
        )

    return results

@router.post("/", response_model=List[AnalysisResult])
async def run_analysis(
    job_id: str,
    resume_ids: List[str],
    current_user = Depends(get_current_user),
    db: Prisma = Depends(get_db)
):
    # Fetch job role and its skills
    job = await db.jobrole.find_unique(where={"id": job_id}, include={"skills": {"include": {"skill": True}}})
    if not job:
        raise HTTPException(status_code=404, detail="Job role not found")

    auto_select_enabled = bool(getattr(job, "auto_select_enabled", False))
    auto_select_threshold = max(0, min(100, int(getattr(job, "auto_select_threshold", 70) or 70)))
    require_hr_confirmation = bool(getattr(job, "require_hr_confirmation", True))
        
    job_skill_names = [_normalize_skill_name(js.skill.name) for js in job.skills if js.skill and js.skill.name]
    
    resumes = await db.resume.find_many(
        where={
            "id": {"in": resume_ids},
            "uploaded_by": current_user.id,
        }
    )
    resumes = [resume for resume in resumes if not bool(getattr(resume, "is_deleted", False))]

    # Keep one resume per person in the current run (latest upload wins).
    unique_resume_by_person: dict[str, object] = {}
    for resume in resumes:
        person_key = resolve_person_key(resume)
        existing_resume = unique_resume_by_person.get(person_key)
        if not existing_resume:
            unique_resume_by_person[person_key] = resume
            continue

        existing_created = getattr(existing_resume, "created_at", None) or datetime.min
        current_created = getattr(resume, "created_at", None) or datetime.min
        if current_created >= existing_created:
            unique_resume_by_person[person_key] = resume

    existing_job_analyses = await db.analysis.find_many(
        where={"job_id": job_id},
        include={"resume": True},
        order={"created_at": "desc"},
    )

    existing_analysis_by_person: dict[str, object] = {}
    duplicate_existing_ids: list[str] = []
    for analysis in existing_job_analyses:
        resume = getattr(analysis, "resume", None)
        if not resume:
            continue
        if getattr(resume, "uploaded_by", None) != current_user.id or bool(getattr(resume, "is_deleted", False)):
            continue

        person_key = resolve_person_key(resume)
        existing = existing_analysis_by_person.get(person_key)
        if not existing:
            existing_analysis_by_person[person_key] = analysis
        else:
            duplicate_existing_ids.append(getattr(analysis, "id", ""))

    duplicate_existing_ids = [item for item in duplicate_existing_ids if item]
    if duplicate_existing_ids:
        await db.analysis.delete_many(where={"id": {"in": duplicate_existing_ids}})

    results = []
    for resume in unique_resume_by_person.values():
        r_id = resume.id
            
        resume_text = (resume.content_text or "")
        parsed = resume.parsed_data if isinstance(resume.parsed_data, dict) else {}
        normalized_resume_skills = _extract_normalized_skills(parsed, resume_text)
        matched_set = {
            s
            for s in job_skill_names
            if s and _is_skill_present(s, normalized_resume_skills, resume_text)
        }
        matched = [s for s in job_skill_names if s in matched_set]
        missing = [s for s in job_skill_names if s and s not in matched_set]
        factors = _extract_candidate_factors(
            resume=resume,
            job=job,
            matched_count=len(matched),
            required_count=len(job_skill_names),
        )
        
        computed_scores = _compute_component_scores(factors)

        person_key = resolve_person_key(resume)
        existing_analysis = existing_analysis_by_person.get(person_key)

        # Save/update analysis. New-schema path first; fallback keeps endpoint working if Prisma client/schema is not yet regenerated.
        try:
            payload = {
                "job_id": job_id,
                "resume_id": r_id,
                "cgpa": factors["cgpa"],
                "percentage": factors["percentage"],
                "cgpa_or_percentage": factors["cgpa_or_percentage"],
                "degree_relevance": factors["degree_relevance"],
                "education_degree": factors["education_degree"],
                "total_experience_years": factors["total_experience_years"],
                "relevant_experience_years": factors["relevant_experience_years"],
                "required_experience_years": factors["required_experience_years"],
                "matched_skill_count": factors["matched_skill_count"],
                "required_skill_count": factors["required_skill_count"],
                "projects_count": factors["projects_count"],
                "communication_score": factors["communication_score"],
                "leadership_score": factors["leadership_score"],
                "teamwork_score": factors["teamwork_score"],
                "problem_solving_score": factors["problem_solving_score"],
                "academic_score": computed_scores["academic_score"],
                "experience_score": computed_scores["experience_score"],
                "skill_match_score": computed_scores["skill_match_score"],
                "soft_skill_score": computed_scores["soft_skill_score"],
                "project_score": computed_scores["project_score"],
                "final_score": computed_scores["final_score"],
                "score": computed_scores["score"],
                "soft_skills": Json(factors["soft_skills"]),
                "normalized_skills": Json(factors["normalized_skills"]),
                "matched_skills": Json(matched),
                "missing_skills": Json(missing),
            }

            if existing_analysis:
                update_payload = {k: v for k, v in payload.items() if k not in {"job_id", "resume_id"}}
                saved_analysis = await db.analysis.update(
                    where={"id": existing_analysis.id},
                    data=update_payload,
                )
            else:
                saved_analysis = await db.analysis.create(data=payload)
        except (MissingRequiredValueError, Exception) as exc:
            message = str(exc).lower()
            is_schema_mismatch = (
                isinstance(exc, MissingRequiredValueError)
                or "field does not exist" in message
                or "could not find field" in message
                or "column" in message
                or "unknown argument" in message
            )
            if not is_schema_mismatch:
                raise

            fallback_payload = {
                "job_id": job_id,
                "resume_id": r_id,
                "score": computed_scores["score"],
                "matched_skills": Json(matched),
                "missing_skills": Json(missing),
            }
            if existing_analysis:
                fallback_update_payload = {
                    k: v for k, v in fallback_payload.items() if k not in {"job_id", "resume_id"}
                }
                saved_analysis = await db.analysis.update(
                    where={"id": existing_analysis.id},
                    data=fallback_update_payload,
                )
            else:
                saved_analysis = await db.analysis.create(data=fallback_payload)

        existing_analysis_by_person[person_key] = saved_analysis

        effective_score = float(getattr(saved_analysis, "score", computed_scores["score"]) or computed_scores["score"])
        is_auto_selected = auto_select_enabled and effective_score >= auto_select_threshold
        is_selected = is_auto_selected and not require_hr_confirmation
        selection_status = "pending" if (is_auto_selected and require_hr_confirmation) else ("confirmed" if is_auto_selected else "rejected")

        await _persist_selection_state(
            db=db,
            resume=resume,
            job_id=job_id,
            auto_selected=is_auto_selected,
            selected=is_selected,
            selection_status=selection_status,
        )
        
        results.append(AnalysisResult(
            candidate_name=resolve_candidate_name(resume),
            score=getattr(saved_analysis, "score", computed_scores["score"]) or computed_scores["score"],
            education_score=getattr(saved_analysis, "academic_score", computed_scores["education_score"]) or computed_scores["education_score"],
            academic_score=getattr(saved_analysis, "academic_score", computed_scores["academic_score"]) or computed_scores["academic_score"],
            experience_score=getattr(saved_analysis, "experience_score", computed_scores["experience_score"]) or computed_scores["experience_score"],
            skill_match_score=getattr(saved_analysis, "skill_match_score", computed_scores["skill_match_score"]) or computed_scores["skill_match_score"],
            project_score=getattr(saved_analysis, "project_score", computed_scores["project_score"]) or computed_scores["project_score"],
            soft_skill_score=getattr(saved_analysis, "soft_skill_score", computed_scores["soft_skill_score"]) or computed_scores["soft_skill_score"],
            final_score=getattr(saved_analysis, "final_score", computed_scores["final_score"]) or computed_scores["final_score"],
            matched_skills=matched,
            missing_skills=missing
        ))
        
    return results


@router.post("/confirm-selection")
async def confirm_auto_selection(
    payload: dict = Body(default={}),
    current_user=Depends(get_current_user),
    db: Prisma = Depends(get_db),
):
    job_id = str(payload.get("job_id") or "").strip()
    if not job_id:
        raise HTTPException(status_code=400, detail="job_id is required")

    job = await db.jobrole.find_unique(where={"id": job_id})
    if not job:
        raise HTTPException(status_code=404, detail="Job role not found")

    requested_resume_ids = payload.get("resume_ids") if isinstance(payload.get("resume_ids"), list) else []
    requested_resume_ids = [str(item).strip() for item in requested_resume_ids if str(item).strip()]
    requested_filter = set(requested_resume_ids)

    threshold = max(0, min(100, int(getattr(job, "auto_select_threshold", 70) or 70)))

    analyses = await db.analysis.find_many(
        where={"job_id": job_id},
        include={"resume": True},
        order={"score": "desc"},
    )

    confirmed = 0
    for analysis in analyses:
        resume = getattr(analysis, "resume", None)
        if not resume:
            continue
        if getattr(resume, "uploaded_by", None) != current_user.id:
            continue
        if requested_filter and resume.id not in requested_filter:
            continue

        score = float(getattr(analysis, "score", 0) or 0)
        if score < threshold:
            continue

        await _persist_selection_state(
            db=db,
            resume=resume,
            job_id=job_id,
            auto_selected=True,
            selected=True,
            selection_status="confirmed",
        )
        confirmed += 1

    return {
        "status": "ok",
        "job_id": job_id,
        "confirmed_count": confirmed,
    }


@router.post("/send-email")
async def send_interview_email(
    payload: dict = Body(default={}),
    current_user=Depends(get_current_user),
    db: Prisma = Depends(get_db),
):
    job_role = str(payload.get("job_role") or "").strip()
    template = str(payload.get("template") or "Interview Invitation").strip() or "Interview Invitation"
    candidate_emails = payload.get("candidate_emails") if isinstance(payload.get("candidate_emails"), list) else []
    candidate_emails = [str(item).strip() for item in candidate_emails if isinstance(item, str) and item.strip()]

    if not candidate_emails:
        raise HTTPException(status_code=400, detail="candidate_emails is required")

    unique_emails = list(dict.fromkeys(candidate_emails))
    sent_count = 0
    failed_emails: list[str] = []
    for email in unique_emails:
        ok = await send_candidate_selection_email(
            to_email=email,
            full_name=None,
            role_title=job_role or template,
            selection_type="final_select",
        )
        if ok:
            sent_count += 1
        else:
            failed_emails.append(email)

    return {
        "status": "ok",
        "sent_count": sent_count,
        "failed_count": len(failed_emails),
        "failed_emails": failed_emails,
    }

@router.get("/{job_id}", response_model=List[AnalysisResult])
async def get_job_analysis(job_id: str, db: Prisma = Depends(get_db)):
    analyses = await db.analysis.find_many(
        where={"job_id": job_id},
        include={"resume": True, "job": {"include": {"skills": {"include": {"skill": True}}}}},
        order={"score": "desc"}
    )
    
    analyses = _dedupe_analyses_by_person(analyses)

    return [
        AnalysisResult(
            candidate_name=resolve_candidate_name(a.resume),
            score=a.score,
            education_score=getattr(a, "academic_score", 0) or 0,
            academic_score=getattr(a, "academic_score", 0) or 0,
            experience_score=getattr(a, "experience_score", 0) or 0,
            skill_match_score=getattr(a, "skill_match_score", 0) or 0,
            project_score=getattr(a, "project_score", 0) or 0,
            soft_skill_score=getattr(a, "soft_skill_score", 0) or 0,
            final_score=getattr(a, "final_score", 0) or 0,
            matched_skills=resolve_skill_arrays(a)[0],
            missing_skills=resolve_skill_arrays(a)[1]
        ) for a in analyses
    ]
