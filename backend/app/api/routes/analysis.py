from fastapi import APIRouter, Body, Depends, HTTPException, Query
import logging
from app.db.prisma_client import Prisma
from app.db.session import get_db
from app.api.dependencies import get_current_user
from app.schemas.api import AnalysisRequest, AnalysisResult, AnalysisResultCard
from typing import List, Optional
import re
import string
from difflib import SequenceMatcher
from prisma import Json
from prisma.errors import MissingRequiredValueError
from datetime import datetime
from app.services.auth_mailer import send_candidate_selection_email
from app.services.nlp_service import NLPService

router = APIRouter()
nlp_service = NLPService()
logger = logging.getLogger(__name__)




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
    matched_skills = getattr(analysis, "matched_skills", []) or []
    missing_skills = getattr(analysis, "missing_skills", []) or []
    if not isinstance(matched_skills, list):
        matched_skills = []
    if not isinstance(missing_skills, list):
        missing_skills = []
    return matched_skills, missing_skills


def _normalize_skill_name(value: str) -> str:
    return (value or "").strip().lower()


def _to_float(value):
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


def _safe_str(value):
    if isinstance(value, str) and value.strip():
        return value.strip()
    return None


def _normalize_string_list(value):
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if isinstance(item, str) and str(item).strip()]


def _normalize_degrees(value):
    if not isinstance(value, list):
        return []
    normalized: list[dict] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        degree = _safe_str(item.get("degree"))
        field = _safe_str(item.get("field"))
        cgpa = _to_float(item.get("cgpa"))
        normalized.append({"degree": degree, "field": field, "cgpa": cgpa})
    return normalized


def _normalize_experience_list(value):
    if not isinstance(value, list):
        return []
    normalized: list[dict] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        role = _safe_str(item.get("role"))
        duration = _safe_str(item.get("duration"))
        if role or duration:
            normalized.append({"role": role, "duration": duration})
    return normalized


def _extract_cgpa(parsed: dict, text: str):
    return _to_float(parsed.get("cgpa"))


def _extract_sgpa(parsed: dict, text: str):
    return _to_float(parsed.get("sgpa"))


def _extract_degree(parsed: dict, text: str):
    return _safe_str(parsed.get("degree"))


def _extract_university(parsed: dict, text: str):
    return _safe_str(parsed.get("university"))


def _extract_projects_count(parsed: dict, text: str):
    return int(_to_float(parsed.get("projects_count")) or 0)


def _extract_soft_skills_list(parsed: dict, text: str):
    return _normalize_string_list(parsed.get("soft_skills"))


def _extract_normalized_skills(parsed: dict, text: str):
    return _normalize_string_list(parsed.get("normalized_skills"))


def _extract_internships(parsed: dict, text: str):
    return _normalize_string_list(parsed.get("internships"))
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
    request: AnalysisRequest,
    current_user = Depends(get_current_user),
    db: Prisma = Depends(get_db)
):
    job_id = request.job_id
    resume_ids = request.resume_ids
    # Fetch job role and its skills
    job = await db.jobrole.find_unique(where={"id": job_id}, include={"skills": {"include": {"skill": True}}})
    if not job:
        raise HTTPException(status_code=404, detail="Job role not found")

    auto_select_enabled = bool(getattr(job, "auto_select_enabled", False))
    auto_select_threshold = max(0, min(100, int(getattr(job, "auto_select_threshold", 70) or 70)))
    require_hr_confirmation = bool(getattr(job, "require_hr_confirmation", True))
        
    job_skill_names = [_normalize_skill_name(js.skill.name) for js in job.skills if js.skill and js.skill.name]
    
    if resume_ids:
        where_clause = {
            "id": {"in": resume_ids},
            "uploaded_by": current_user.id,
        }
    else:
        where_clause = {
            "uploaded_by": current_user.id,
        }
    
    resumes = await db.resume.find_many(where=where_clause)
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
    job_context = f"Role: {job.title}\nDescription: {job.description or ''}\nRequired Skills: {', '.join(job_skill_names)}"

    import asyncio
    
    async def process_one_resume(resume):
        r_id = resume.id
        resume_text = (resume.content_text or "")
        
        # Use LLM for comprehensive analysis
        analysis = await nlp_service.analyze_candidate(resume_text, job_context)
        
        academic = analysis.get("academic_data", {})
        exp = analysis.get("experience_data", {})
        soft = analysis.get("soft_skills_data", {})
        add = analysis.get("additional_data", {})
        
        matched = analysis.get("matching_skills", [])
        missing = analysis.get("missing_skills", [])

        person_key = resolve_person_key(resume)
        existing_analysis = existing_analysis_by_person.get(person_key)

        try:
            payload = {
                "job_id": job_id,
                "resume_id": r_id,
                "score": float(analysis.get("score", 0)),
                "cgpa": academic.get("cgpa"),
                "percentage": academic.get("percentage"),
                "cgpa_or_percentage": academic.get("cgpa") or (academic.get("percentage", 0) / 10 if academic.get("percentage") else None),
                "education_degree": academic.get("degree"),
                "academic_score": float(academic.get("academic_score", 0)),
                "total_experience_years": float(exp.get("total_years") or 0),
                "relevant_experience_years": float(exp.get("relevant_years") or 0),
                "projects_count": int(exp.get("projects_count") or 0),
                "experience_score": float(exp.get("experience_score", 0)),
                "communication_score": float(soft.get("communication", 0)),
                "leadership_score": float(soft.get("leadership", 0)),
                "teamwork_score": float(soft.get("teamwork", 0)),
                "problem_solving_score": float(soft.get("problem_solving", 0)),
                "soft_skill_score": float(soft.get("soft_skill_score", 0)),
                "skill_match_score": float(add.get("skill_match_score", 0)),
                "project_score": float(add.get("project_score", 0)),
                "final_score": float(analysis.get("score", 0)),
                "matched_skills": Json(matched),
                "missing_skills": Json(missing),
                "soft_skills": Json(soft),
                "normalized_skills": Json(analysis.get("skills", [])),
            }

            if existing_analysis:
                update_payload = {k: v for k, v in payload.items() if k not in {"job_id", "resume_id"}}
                saved_analysis = await db.analysis.update(
                    where={"id": existing_analysis.id},
                    data=update_payload,
                )
            else:
                saved_analysis = await db.analysis.create(data=payload)
        except Exception as exc:
            logger.error(f"Error saving analysis for {r_id}: {exc}")
            # Fallback for schema mismatches or other DB errors
            fallback_payload = {
                "job_id": job_id,
                "resume_id": r_id,
                "score": float(analysis.get("score", 0)),
                "matched_skills": Json(matched),
                "missing_skills": Json(missing),
            }
            if existing_analysis:
                saved_analysis = await db.analysis.update(
                    where={"id": existing_analysis.id},
                    data={k: v for k, v in fallback_payload.items() if k not in {"job_id", "resume_id"}},
                )
            else:
                saved_analysis = await db.analysis.create(data=fallback_payload)

        existing_analysis_by_person[person_key] = saved_analysis

        effective_score = float(getattr(saved_analysis, "score", 0) or 0)
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
        
        return AnalysisResult(
            candidate_name=resolve_candidate_name(resume),
            score=effective_score,
            education_score=float(getattr(saved_analysis, "academic_score", 0) or 0),
            academic_score=float(getattr(saved_analysis, "academic_score", 0) or 0),
            experience_score=float(getattr(saved_analysis, "experience_score", 0) or 0),
            skill_match_score=float(getattr(saved_analysis, "skill_match_score", 0) or 0),
            project_score=float(getattr(saved_analysis, "project_score", 0) or 0),
            soft_skill_score=float(getattr(saved_analysis, "soft_skill_score", 0) or 0),
            final_score=float(getattr(saved_analysis, "final_score", 0) or 0),
            matched_skills=matched,
            missing_skills=missing
        )

    # Parallelize analysis for all resumes
    tasks = [process_one_resume(r) for r in unique_resume_by_person.values()]
    if tasks:
        results = await asyncio.gather(*tasks)
    else:
        results = []
        
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
