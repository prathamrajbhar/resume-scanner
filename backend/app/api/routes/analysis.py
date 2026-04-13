from fastapi import APIRouter, Depends, HTTPException, Query
from app.db.prisma_client import Prisma
from app.db.session import get_db
from app.api.dependencies import get_current_user
from app.schemas.api import AnalysisResult, AnalysisResultCard
from typing import List, Optional
import re
from prisma import Json

router = APIRouter()


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
            js.skill.name.lower().strip()
            for js in job.skills
            if getattr(js, 'skill', None) and getattr(js.skill, 'name', None)
        ]

    resume_text = ((getattr(resume, 'content_text', None) or '')).lower()
    if job_skills:
        matched_skills = [s for s in job_skills if s and s in resume_text]
        missing_skills = [s for s in job_skills if s and s not in resume_text]

    return matched_skills, missing_skills


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

    return [
        AnalysisResult(
            candidate_name=resolve_candidate_name(a.resume),
            score=a.score,
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

    results: List[AnalysisResultCard] = []
    for analysis in analyses:
        matched_skills, missing_skills = resolve_skill_arrays(analysis)

        results.append(
            AnalysisResultCard(
                id=analysis.id,
                name=resolve_candidate_name(analysis.resume),
                score=analysis.score,
                top_skills=matched_skills[:3],
                matched_skills=matched_skills,
                missing_skills=missing_skills,
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
        
    job_skill_names = [js.skill.name.lower().strip() for js in job.skills if js.skill and js.skill.name]
    
    results = []
    for r_id in resume_ids:
        resume = await db.resume.find_unique(where={"id": r_id})
        if not resume:
            continue
            
        resume_text = (resume.content_text or "").lower()
        matched = [s for s in job_skill_names if s and s in resume_text]
        missing = [s for s in job_skill_names if s and s not in resume_text]
        
        score = (len(matched) / len(job_skill_names)) * 100 if job_skill_names else 0
        
        # Save analysis
        await db.analysis.create(
            data={
                "score": score,
                "matched_skills": Json(matched),
                "missing_skills": Json(missing),
                "job": {
                    "connect": {
                        "id": job_id,
                    }
                },
                "resume": {
                    "connect": {
                        "id": r_id,
                    }
                },
            }
        )
        
        results.append(AnalysisResult(
            candidate_name=resolve_candidate_name(resume),
            score=score,
            matched_skills=matched,
            missing_skills=missing
        ))
        
    return results

@router.get("/{job_id}", response_model=List[AnalysisResult])
async def get_job_analysis(job_id: str, db: Prisma = Depends(get_db)):
    analyses = await db.analysis.find_many(
        where={"job_id": job_id},
        include={"resume": True, "job": {"include": {"skills": {"include": {"skill": True}}}}},
        order={"score": "desc"}
    )
    
    return [
        AnalysisResult(
            candidate_name=resolve_candidate_name(a.resume),
            score=a.score,
            matched_skills=resolve_skill_arrays(a)[0],
            missing_skills=resolve_skill_arrays(a)[1]
        ) for a in analyses
    ]
