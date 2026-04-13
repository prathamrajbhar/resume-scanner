from fastapi import APIRouter, Depends, HTTPException, status
from app.db.prisma_client import Prisma
from app.db.session import get_db
from app.api.dependencies import get_current_user
from app.schemas.api import JobRoleCreate, JobRoleDetail, JobRoleUpdate
from typing import List

router = APIRouter()


def serialize_job_role(job):
    created_by = getattr(job, "created_by", None) or getattr(job, "createdBy", None)
    return {
        "id": job.id,
        "title": job.title,
        "description": job.description,
        "created_by": created_by,
        "created_at": job.created_at,
        "skills": [
            {
                "id": skill.id,
                "job_id": skill.job_id,
                "skill_id": skill.skill_id,
                "skill_name": skill.skill.name if getattr(skill, "skill", None) else None,
                "level": skill.level,
            }
            for skill in (job.skills or [])
        ],
    }


def is_job_owned_by_user(job, user_id: str) -> bool:
    direct_owner = (
        getattr(job, "created_by", None)
        or getattr(job, "createdBy", None)
        or getattr(job, "user_id", None)
        or getattr(job, "userId", None)
    )

    if isinstance(direct_owner, str):
        return direct_owner == user_id

    relation_owner = getattr(getattr(job, "user", None), "id", None)
    if isinstance(relation_owner, str):
        return relation_owner == user_id

    # If owner fields are unavailable in runtime client shape, avoid false negatives.
    return True


def resolve_job_skill_level(skill_data) -> str:
    level_value = skill_data.level
    if level_value:
        normalized = str(level_value).strip().lower()
        if normalized in {"beginner", "intermediate", "advanced", "expert"}:
          return "expert" if normalized == "advanced" else normalized

    required_level = skill_data.required_level
    if required_level is None:
        return "intermediate"

    if required_level <= 1:
        return "beginner"
    if required_level == 2:
        return "intermediate"
    return "expert"


def get_or_create_skill_id(skill_data, current_user, db: Prisma):
    async def _resolve():
        skill_id = skill_data.skill_id
        if skill_id:
            return skill_id

        skill_name = (skill_data.skill_name or "").strip()
        if not skill_name:
            return None

        existing_skill = await db.skill.find_unique(where={"name": skill_name})
        if existing_skill:
            return existing_skill.id

        created_skill = await db.skill.create(
            data={
                "name": skill_name,
                "created_by": current_user.id,
                "is_global": True,
            }
        )
        return created_skill.id

    return _resolve()

@router.get("/", response_model=List[JobRoleDetail])
async def get_jobs(current_user = Depends(get_current_user), db: Prisma = Depends(get_db)):
    jobs = await db.jobrole.find_many(
        include={"skills": {"include": {"skill": True}}},
        order={"created_at": "desc"}
    )
    jobs = [job for job in jobs if is_job_owned_by_user(job, current_user.id)]
    return [serialize_job_role(job) for job in jobs]

@router.get("/{job_id}", response_model=JobRoleDetail)
async def get_job(job_id: str, current_user = Depends(get_current_user), db: Prisma = Depends(get_db)):
    job = await db.jobrole.find_unique(
        where={"id": job_id},
        include={"skills": {"include": {"skill": True}}}
    )
    if job and not is_job_owned_by_user(job, current_user.id):
        job = None
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return serialize_job_role(job)

@router.post("/", response_model=JobRoleDetail)
async def create_job(
    job: JobRoleCreate,
    current_user = Depends(get_current_user),
    db: Prisma = Depends(get_db)
):
    if not job.title.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Job title is required")

    if not job.skills:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="At least one skill is required")

    # Create the job role
    new_job = await db.jobrole.create(
        data={
            "title": job.title.strip(),
            "description": job.description,
            "created_by": current_user.id,
        }
    )
    
    # Associate skills
    for skill_data in job.skills:
        skill_id = await get_or_create_skill_id(skill_data, current_user, db)

        if not skill_id:
            continue

        await db.jobskill.create(
            data={
                "job_id": new_job.id,
                "skill_id": skill_id,
                "level": resolve_job_skill_level(skill_data),
            }
        )

    created_job = await db.jobrole.find_unique(
        where={"id": new_job.id},
        include={"skills": {"include": {"skill": True}}}
    )
    if not created_job:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to load created job")

    return serialize_job_role(created_job)


@router.api_route("/{job_id}", methods=["PUT", "PATCH", "POST"], response_model=JobRoleDetail)
async def update_job(
    job_id: str,
    job: JobRoleUpdate,
    current_user=Depends(get_current_user),
    db: Prisma = Depends(get_db),
):
    existing_job = await db.jobrole.find_unique(where={"id": job_id})
    if existing_job and not is_job_owned_by_user(existing_job, current_user.id):
        existing_job = None
    if not existing_job:
        raise HTTPException(status_code=404, detail="Job not found")

    if not job.skills:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="At least one skill is required")

    update_data = {}
    if job.title is not None:
        normalized_title = job.title.strip()
        if not normalized_title:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Job title cannot be empty")
        update_data["title"] = normalized_title

    if job.description is not None:
        update_data["description"] = job.description

    if update_data:
        await db.jobrole.update(where={"id": job_id}, data=update_data)

    await db.jobskill.delete_many(where={"job_id": job_id})

    for skill_data in job.skills:
        skill_id = await get_or_create_skill_id(skill_data, current_user, db)
        if not skill_id:
            continue

        await db.jobskill.create(
            data={
                "job_id": job_id,
                "skill_id": skill_id,
                "level": resolve_job_skill_level(skill_data),
            }
        )

    updated_job = await db.jobrole.find_unique(
        where={"id": job_id},
        include={"skills": {"include": {"skill": True}}},
    )

    if not updated_job:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to load updated job")

    return serialize_job_role(updated_job)


@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_job(job_id: str, current_user = Depends(get_current_user), db: Prisma = Depends(get_db)):
    job = await db.jobrole.find_unique(where={"id": job_id})
    if job and not is_job_owned_by_user(job, current_user.id):
        job = None
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    await db.analysis.delete_many(where={"job_id": job_id})
    await db.jobskill.delete_many(where={"job_id": job_id})
    await db.jobrole.delete(where={"id": job_id})
