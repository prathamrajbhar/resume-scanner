from __future__ import annotations

from collections import Counter
from datetime import datetime
import re
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from app.api.dependencies import get_current_user
from app.db.prisma_client import Prisma
from app.db.session import get_db
from app.schemas.api import (
    CandidateEnrichmentRequest,
    CandidateEnrichmentResponse,
    CandidatePreviewExtractRequest,
    CandidatePreviewExtractResponse,
    CandidateSkillSuggestionRequest,
    CandidateSkillSuggestionResponse,
    ProfessionalInsight,
    SkillSuggestion,
)
from app.services.nlp_service import NLPService

router = APIRouter()
public_router = APIRouter()
nlp_service = NLPService()

DOMAIN_KEYWORDS = {
    "software": ["software", "backend", "frontend", "api", "microservice", "full stack", "devops"],
    "data": ["data", "analytics", "analysis", "machine learning", "ml", "nlp", "sql", "statistics"],
    "security": ["security", "cyber", "vulnerability", "soc", "compliance", "iam"],
    "product": ["product", "roadmap", "stakeholder", "discovery", "go to market"],
    "hr": ["recruitment", "talent", "hiring", "candidate", "screening", "people ops"],
}

GROWTH_KEYWORDS = {
    "learning",
    "upskilling",
    "course",
    "courses",
    "certification",
    "certified",
    "workshop",
    "bootcamp",
    "self-taught",
    "continuous improvement",
}

ROLE_KEYWORDS = {
    "engineer",
    "developer",
    "analyst",
    "manager",
    "consultant",
    "lead",
    "architect",
    "intern",
    "specialist",
}

EDUCATION_KEYWORDS = {
    "bachelor",
    "master",
    "mba",
    "phd",
    "university",
    "college",
    "degree",
}

CERTIFICATION_PATTERNS = [
    re.compile(r"\baws certified\b", re.IGNORECASE),
    re.compile(r"\bazure certified\b", re.IGNORECASE),
    re.compile(r"\bgcp certified\b", re.IGNORECASE),
    re.compile(r"\bcertified [a-z0-9\- ]+\b", re.IGNORECASE),
    re.compile(r"\b[a-z0-9\- ]+ certification\b", re.IGNORECASE),
]

KEYWORD_STOP_WORDS = {
    "the",
    "and",
    "for",
    "with",
    "that",
    "this",
    "from",
    "have",
    "has",
    "had",
    "your",
    "you",
    "about",
    "into",
    "over",
    "their",
    "there",
    "would",
    "could",
    "should",
    "were",
    "been",
    "being",
    "are",
    "was",
    "will",
    "our",
    "out",
    "not",
    "but",
    "using",
    "used",
    "work",
    "worked",
    "role",
    "roles",
    "team",
    "years",
}

UPPER_SKILL_TOKENS = {"ai", "ml", "nlp", "sql", "aws", "gcp", "api", "ui", "ux"}

LEARNING_KEYWORDS = {
    "learning",
    "upskilling",
    "self-taught",
    "continuous improvement",
    "research",
    "study",
    "studied",
}

AI_LEARNING_KEYWORDS = {
    "ai",
    "artificial intelligence",
    "machine learning",
    "ml",
    "deep learning",
    "nlp",
    "llm",
    "neural",
}

COURSE_TERMS = {
    "course",
    "courses",
    "training",
    "bootcamp",
    "workshop",
    "nanodegree",
    "specialization",
}


def _clamp_score(value: float) -> float:
    return max(0.0, min(100.0, value))


def _normalize_whitespace(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip())


def _tokenize(text: str) -> list[str]:
    return [token for token in re.findall(r"[a-zA-Z][a-zA-Z0-9+.#-]*", (text or "").lower()) if len(token) > 1]


def _format_skill_name(name: str) -> str:
    tokens = [token for token in re.split(r"\s+", (name or "").strip()) if token]
    if not tokens:
        return ""

    parts: list[str] = []
    for token in tokens:
        lowered = token.lower()
        if lowered in UPPER_SKILL_TOKENS:
            parts.append(lowered.upper())
        else:
            parts.append(lowered.capitalize())
    return " ".join(parts)


def _extract_preview_keywords(text: str, limit: int = 12) -> list[str]:
    words = [
        token
        for token in re.findall(r"\b[a-zA-Z][a-zA-Z0-9+.#-]{2,}\b", (text or "").lower())
        if token not in KEYWORD_STOP_WORDS
    ]
    if not words:
        return []

    counts = Counter(words)
    ranked = sorted(counts.items(), key=lambda item: (-item[1], item[0]))
    return [item[0] for item in ranked[:limit]]


def _readability_label(text: str) -> str:
    cleaned = _normalize_whitespace(text)
    if not cleaned:
        return "poor"

    sentences = [segment.strip() for segment in re.split(r"[.!?]+", cleaned) if segment.strip()]
    words = re.findall(r"\b[a-zA-Z][a-zA-Z0-9+.#-]*\b", cleaned)
    if len(words) < 20:
        return "average"

    avg_sentence_words = len(words) / max(1, len(sentences))
    long_word_ratio = sum(1 for token in words if len(token) >= 10) / max(1, len(words))

    if 8 <= avg_sentence_words <= 22 and long_word_ratio <= 0.22:
        return "good"
    if avg_sentence_words <= 30:
        return "average"
    return "poor"


def _confidence_from_count(count: int) -> str:
    if count >= 3:
        return "high"
    if count == 2:
        return "medium"
    return "low"


def _suggest_skills_from_text(text: str, limit: int = 10) -> list[SkillSuggestion]:
    cleaned = _normalize_whitespace(text)
    if not cleaned:
        return []

    detected = sorted(nlp_service.extract_skills(cleaned))
    lowered = cleaned.lower()
    scored: list[tuple[int, str]] = []
    for skill in detected:
        occurrences = len(re.findall(rf"\b{re.escape(skill.lower())}\b", lowered))
        scored.append((max(1, occurrences), skill))

    scored.sort(key=lambda item: (-item[0], item[1]))
    top_skills = scored[:limit]

    return [
        SkillSuggestion(
            name=_format_skill_name(skill),
            confidence=_confidence_from_count(count),
        )
        for count, skill in top_skills
        if skill
    ]


def _extract_certifications(text: str) -> list[str]:
    found: list[str] = []
    for pattern in CERTIFICATION_PATTERNS:
        for match in pattern.findall(text or ""):
            item = _normalize_whitespace(match)
            if item and item.lower() not in {entry.lower() for entry in found}:
                found.append(item)
    return found


def _extract_experience_signals(text: str) -> list[str]:
    signals: list[str] = []

    for match in re.findall(r"\b\d{1,2}\+?\s*(?:years?|yrs?)\b", text or "", flags=re.IGNORECASE):
        cleaned = _normalize_whitespace(match)
        if cleaned and cleaned not in signals:
            signals.append(cleaned)

    lowered = (text or "").lower()
    for role in ROLE_KEYWORDS:
        if re.search(rf"\b{re.escape(role)}\b", lowered):
            role_label = role.title()
            if role_label not in signals:
                signals.append(role_label)

    return signals[:12]


def _extract_education_signals(text: str) -> list[str]:
    lowered = (text or "").lower()
    results: list[str] = []
    for token in EDUCATION_KEYWORDS:
        if re.search(rf"\b{re.escape(token)}\b", lowered):
            results.append(token.title())
    return results


def _extract_domain_keywords(text: str) -> list[str]:
    lowered = (text or "").lower()
    keywords = set(nlp_service.extract_skills(text or ""))

    for _, values in DOMAIN_KEYWORDS.items():
        for term in values:
            if term in lowered:
                keywords.add(term)

    return sorted([entry for entry in keywords if entry])[:40]


def _extract_evidence_snippets(text: str, tokens: list[str], limit: int = 2) -> list[str]:
    if not text or not tokens:
        return []

    snippets: list[str] = []
    sentences = [segment.strip() for segment in re.split(r"[.!?]+", text) if segment.strip()]
    lowered_tokens = [token.lower() for token in tokens if token]

    for sentence in sentences:
        sentence_lower = sentence.lower()
        if any(token in sentence_lower for token in lowered_tokens):
            cleaned = _normalize_whitespace(sentence)
            if cleaned and cleaned not in snippets:
                snippets.append(cleaned)
        if len(snippets) >= limit:
            break

    return snippets


def _extract_role_tenure_years(text: str) -> tuple[list[float], list[tuple[int, int]]]:
    lowered = (text or "").lower()
    explicit_years = [
        float(match)
        for match in re.findall(r"\b(\d{1,2})(?:\+)?\s*(?:years?|yrs?)\b", lowered)
        if match.isdigit()
    ]

    current_year = datetime.utcnow().year
    ranges: list[tuple[int, int]] = []
    range_matches = re.findall(r"\b((?:19|20)\d{2})\s*(?:-|to|–)\s*(present|current|((?:19|20)\d{2}))\b", lowered)
    for start_raw, _, end_raw in range_matches:
        try:
            start_year = int(start_raw)
            end_year = int(end_raw) if end_raw else current_year
            if end_year >= start_year:
                ranges.append((start_year, end_year))
        except ValueError:
            continue

    return explicit_years, ranges


def _compute_confidence_score(
    text: str,
    experience_signals: list[str],
    education_signals: list[str],
    keywords: list[str],
) -> float:
    lowered = (text or "").lower()
    words = re.findall(r"\b[a-zA-Z][a-zA-Z0-9+.#-]*\b", lowered)
    word_count = len(words)

    has_education = bool(education_signals) or any(term in lowered for term in ("education", "bachelor", "master", "phd", "degree"))
    has_experience = bool(experience_signals) or any(term in lowered for term in ("experience", "years", "worked", "employment"))
    has_skills = bool(keywords) or bool(nlp_service.extract_skills(text or ""))

    section_hits = sum([has_education, has_experience, has_skills])
    section_score = (section_hits / 3.0) * 70.0
    completeness_score = min(30.0, (word_count / 220.0) * 30.0)

    return round(_clamp_score(section_score + completeness_score), 1)


def _learning_score(combined_text: str, certifications: list[str]) -> float:
    lowered = (combined_text or "").lower()

    growth_hits = sum(1 for keyword in LEARNING_KEYWORDS if keyword in lowered)
    ai_hits = sum(1 for keyword in AI_LEARNING_KEYWORDS if keyword in lowered)
    course_hits = sum(1 for term in COURSE_TERMS if re.search(rf"\b{re.escape(term)}\b", lowered))

    cert_points = min(42.0, len(certifications) * 14.0)
    course_points = min(24.0, course_hits * 8.0)
    ai_points = min(21.0, ai_hits * 7.0)
    growth_points = min(13.0, growth_hits * 4.5)
    education_bonus = 8.0 if any(token in lowered for token in ("bachelor", "master", "phd", "diploma")) else 0.0

    return round(_clamp_score(cert_points + course_points + ai_points + growth_points + education_bonus), 1)


def _stability_score(combined_text: str, experience_signals: list[str]) -> float:
    lowered = (combined_text or "").lower()
    explicit_years, ranges = _extract_role_tenure_years(lowered)

    range_durations = [max(0, end - start) for start, end in ranges]
    inferred_total_years = max(explicit_years) if explicit_years else 0.0
    if range_durations:
        inferred_total_years = max(inferred_total_years, float(sum(range_durations)))

    if inferred_total_years >= 10:
        base = 82.0
    elif inferred_total_years >= 7:
        base = 75.0
    elif inferred_total_years >= 4:
        base = 66.0
    elif inferred_total_years >= 2:
        base = 56.0
    else:
        base = 45.0

    continuity_bonus = 0.0
    continuity_penalty = 0.0
    if len(ranges) > 1:
        sorted_ranges = sorted(ranges, key=lambda item: item[0])
        gaps: list[int] = []
        for index in range(1, len(sorted_ranges)):
            previous_end = sorted_ranges[index - 1][1]
            current_start = sorted_ranges[index][0]
            gap = max(0, current_start - previous_end)
            gaps.append(gap)
        continuous_moves = sum(1 for gap in gaps if gap <= 1)
        continuity_bonus = min(12.0, continuous_moves * 4.0)
        continuity_penalty = min(20.0, sum(1 for gap in gaps if gap > 1) * 5.0)

    short_tenure_hits = len(re.findall(r"\b(internship|intern|contract|freelance|temporary)\b", lowered))
    short_tenure_penalty = min(10.0, short_tenure_hits * 2.0)

    progression_bonus = 0.0
    for token in ("promoted", "lead", "senior", "manager", "mentored"):
        if token in lowered:
            progression_bonus += 3.0
    progression_bonus = min(12.0, progression_bonus)

    role_variety_bonus = min(6.0, max(0, len(experience_signals) - 2) * 1.0)

    return round(_clamp_score(base + continuity_bonus + progression_bonus + role_variety_bonus - continuity_penalty - short_tenure_penalty), 1)


def _communication_score(text: str) -> float:
    cleaned = _normalize_whitespace(text)
    if not cleaned:
        return 0.0

    sentences = [segment.strip() for segment in re.split(r"[.!?]+", cleaned) if segment.strip()]
    sentence_count = len(sentences) or 1
    word_count = len(cleaned.split())
    avg_sentence_words = word_count / sentence_count

    ideal_sentence_band = 16.0
    sentence_score = max(0.0, 1.0 - (abs(avg_sentence_words - ideal_sentence_band) / 18.0))

    punctuation_marks = len(re.findall(r"[.!?]", cleaned))
    punctuation_score = min(1.0, punctuation_marks / max(1, sentence_count))

    all_caps_words = re.findall(r"\b[A-Z]{3,}\b", text or "")
    caps_penalty = min(0.35, len(all_caps_words) / max(1.0, word_count / 10.0))

    score = (0.55 * sentence_score) + (0.30 * punctuation_score) + (0.15 * (1.0 - caps_penalty))
    return round(_clamp_score(score * 100), 1)


def _domain_alignment_score(combined_text: str, role_title: str | None) -> float:
    lowered = (combined_text or "").lower()

    role_terms = []
    if role_title:
        role_terms = [token for token in _tokenize(role_title) if token not in {"and", "the", "with", "for"}]

    if role_terms:
        matches = sum(1 for term in set(role_terms) if term in lowered)
        ratio = matches / max(1, len(set(role_terms)))
        return round(_clamp_score((ratio * 80.0) + 20.0), 1)

    domain_hits = 0
    for _, terms in DOMAIN_KEYWORDS.items():
        if any(term in lowered for term in terms):
            domain_hits += 1

    return round(_clamp_score(35.0 + (domain_hits * 13.0)), 1)


def _build_communication_explainability(text: str) -> tuple[list[str], list[str]]:
    cleaned = _normalize_whitespace(text)
    words = cleaned.split()
    sentences = [segment.strip() for segment in re.split(r"[.!?]+", cleaned) if segment.strip()]

    reasons: list[str] = []
    if len(sentences) >= 3:
        reasons.append("Found structured writing across multiple sentences")
    if any(token in cleaned.lower() for token in ("documentation", "manual", "training", "presentation")):
        reasons.append("Detected training and documentation keywords")
    if len(words) >= 80:
        reasons.append("Text provides enough communication context for evaluation")
    if not reasons:
        reasons.append("Limited communication signals were available in the provided text")

    evidence = _extract_evidence_snippets(text, ["documentation", "manual", "training", "presentation", "communicat"], limit=2)
    return reasons[:3], evidence


def _build_domain_explainability(text: str, role_title: str | None) -> tuple[list[str], list[str]]:
    lowered = (text or "").lower()
    reasons: list[str] = []

    if role_title:
        role_tokens = [token for token in _tokenize(role_title) if token not in {"and", "the", "with", "for"}]
        matched = [token for token in set(role_tokens) if token in lowered]
        if matched:
            reasons.append(f"Matched role-specific terms: {', '.join(matched[:4])}")

    domain_hits = [group for group, terms in DOMAIN_KEYWORDS.items() if any(term in lowered for term in terms)]
    if domain_hits:
        reasons.append(f"Detected domain signals in {', '.join(domain_hits[:3])}")
    if not reasons:
        reasons.append("Role-to-profile keyword alignment appears limited")

    evidence = _extract_evidence_snippets(text, ["backend", "frontend", "data", "machine learning", "security", "product", "hr"], limit=2)
    return reasons[:3], evidence


def _build_learning_explainability(text: str, certifications: list[str]) -> tuple[list[str], list[str]]:
    lowered = (text or "").lower()
    reasons: list[str] = []

    if certifications:
        reasons.append(f"Certification evidence found ({min(3, len(certifications))} highlighted)")
    if any(term in lowered for term in COURSE_TERMS):
        reasons.append("Course or training indicators detected")
    if any(term in lowered for term in AI_LEARNING_KEYWORDS):
        reasons.append("AI and continuous learning keywords detected")
    if not reasons:
        reasons.append("Learning score is conservative due to sparse upskilling indicators")

    evidence = _extract_evidence_snippets(text, ["certified", "certification", "course", "training", "machine learning", "ai"], limit=2)
    return reasons[:3], evidence


def _build_stability_explainability(text: str) -> tuple[list[str], list[str]]:
    explicit_years, ranges = _extract_role_tenure_years(text)
    reasons: list[str] = []

    if explicit_years:
        reasons.append(f"Detected role duration signals up to {int(max(explicit_years))}+ years")
    if len(ranges) >= 2:
        reasons.append("Multiple role timelines found to estimate continuity")
    elif len(ranges) == 1:
        reasons.append("Single clear timeline found; continuity estimated conservatively")

    if re.search(r"\b(promoted|senior|lead|manager)\b", (text or "").lower()):
        reasons.append("Progression keywords indicate role growth")
    if not reasons:
        reasons.append("Limited timeline markers reduced certainty in stability analysis")

    evidence = _extract_evidence_snippets(text, ["years", "present", "promoted", "senior", "manager", "lead"], limit=2)
    return reasons[:3], evidence


def _score_explanation(metric: str, score: float, role_title: str | None = None) -> str:
    if metric == "communication":
        if score >= 75:
            return "Strong communication based on structured wording and readable sentence flow."
        if score >= 55:
            return "Communication is adequate with room for sharper and more concise wording."
        return "Communication needs improvement due to limited clarity or weak narrative structure."

    if metric == "domain":
        if role_title and score >= 75:
            return f"Good domain fit for {role_title} based on aligned keywords from resume and profile input."
        if score >= 55:
            return "Domain fit is moderate with partial alignment to role-relevant topics."
        return "Limited domain alignment detected from the currently available profile signals."

    if metric == "learning":
        if score >= 75:
            return "Strong learning ability signaled by certifications and growth-oriented language."
        if score >= 55:
            return "Learning intent is visible, though additional upskilling proof would strengthen confidence."
        return "Limited learning evidence detected; certifications or growth indicators are sparse."

    if score >= 75:
        return "Career progression appears stable with consistent experience patterns."
    if score >= 55:
        return "Career path is moderately stable with some consistency in roles and tenure."
    return "Career stability is uncertain due to limited tenure or fragmented role signals."


@router.post("/preview/extract", response_model=CandidatePreviewExtractResponse)
@public_router.post("/preview/extract", response_model=CandidatePreviewExtractResponse)
async def preview_extract(
    payload: CandidatePreviewExtractRequest,
    current_user: Any = Depends(get_current_user),
):
    _ = current_user
    text = _normalize_whitespace(payload.text)
    skills = [_format_skill_name(skill) for skill in sorted(nlp_service.extract_skills(text))[:10]]
    keywords = _extract_preview_keywords(text, limit=12)
    readability = _readability_label(text)

    return CandidatePreviewExtractResponse(
        skills=skills,
        keywords=keywords,
        readability=readability,
    )


@router.post("/suggest/skills", response_model=CandidateSkillSuggestionResponse)
@public_router.post("/suggest/skills", response_model=CandidateSkillSuggestionResponse)
async def suggest_skills(
    payload: CandidateSkillSuggestionRequest,
    current_user: Any = Depends(get_current_user),
):
    _ = current_user
    suggestions = _suggest_skills_from_text(payload.text or "", limit=10)
    return CandidateSkillSuggestionResponse(suggestions=suggestions)


@router.post("/enrich", response_model=CandidateEnrichmentResponse)
async def enrich_candidate_profile(
    payload: CandidateEnrichmentRequest,
    current_user: Any = Depends(get_current_user),
    db: Prisma = Depends(get_db),
):
    await db.execute_raw(
        """
        CREATE TABLE IF NOT EXISTS candidate_enrichment (
            id UUID PRIMARY KEY,
            candidate_id UUID NOT NULL,
            linkedin_url TEXT,
            profile_text TEXT,
            communication_score DOUBLE PRECISION NOT NULL DEFAULT 0,
            domain_score DOUBLE PRECISION NOT NULL DEFAULT 0,
            learning_score DOUBLE PRECISION NOT NULL DEFAULT 0,
            stability_score DOUBLE PRECISION NOT NULL DEFAULT 0,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    await db.execute_raw(
        "CREATE INDEX IF NOT EXISTS idx_candidate_enrichment_candidate_id ON candidate_enrichment(candidate_id)"
    )

    resume = await db.resume.find_first(
        where={
            "id": payload.candidate_id,
            "uploaded_by": current_user.id,
        },
        include={"analyses": {"include": {"job": True}}},
    )

    if not resume or bool(getattr(resume, "is_deleted", False)):
        raise HTTPException(status_code=404, detail="Candidate not found")

    resume_text = _normalize_whitespace(getattr(resume, "content_text", "") or "")
    profile_text = _normalize_whitespace(payload.profile_text or "")
    combined_text = _normalize_whitespace(f"{resume_text} {profile_text}")

    role_title: str | None = None
    analyses = getattr(resume, "analyses", []) or []
    if analyses:
        role_title = getattr(getattr(analyses[0], "job", None), "title", None)

    keywords = _extract_domain_keywords(combined_text)
    experience_signals = _extract_experience_signals(combined_text)
    education_signals = _extract_education_signals(combined_text)
    certifications = _extract_certifications(combined_text)

    communication_score = _communication_score(combined_text)
    domain_score = _domain_alignment_score(combined_text, role_title)
    learning_score = _learning_score(combined_text, certifications)
    stability_score = _stability_score(combined_text, experience_signals)

    enrichment_id = str(uuid.uuid4())
    await db.execute_raw(
        """
        INSERT INTO candidate_enrichment (
            id,
            candidate_id,
            linkedin_url,
            profile_text,
            communication_score,
            domain_score,
            learning_score,
            stability_score,
            created_at,
            updated_at
        )
        VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        """,
        enrichment_id,
        payload.candidate_id,
        payload.linkedin_url,
        payload.profile_text,
        communication_score,
        domain_score,
        learning_score,
        stability_score,
    )

    guidance_message = None
    if not profile_text:
        guidance_message = "Add LinkedIn summary for better insights"

    return CandidateEnrichmentResponse(
        id=enrichment_id,
        candidate_id=payload.candidate_id,
        linkedin_url=payload.linkedin_url,
        profile_text=payload.profile_text,
        communication_score=communication_score,
        domain_score=domain_score,
        learning_score=learning_score,
        stability_score=stability_score,
        keywords=keywords,
        experience_signals=experience_signals,
        education_signals=education_signals,
        certifications=certifications,
        guidance_message=guidance_message,
        insights=[
            ProfessionalInsight(
                key="communication",
                title="Communication Score",
                score=communication_score,
                explanation=_score_explanation("communication", communication_score),
            ),
            ProfessionalInsight(
                key="domain",
                title="Domain Fit",
                score=domain_score,
                explanation=_score_explanation("domain", domain_score, role_title),
            ),
            ProfessionalInsight(
                key="learning",
                title="Learning Ability",
                score=learning_score,
                explanation=_score_explanation("learning", learning_score),
            ),
            ProfessionalInsight(
                key="stability",
                title="Career Stability",
                score=stability_score,
                explanation=_score_explanation("stability", stability_score),
            ),
        ],
    )
