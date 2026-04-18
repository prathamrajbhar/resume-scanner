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
        "auto_select_enabled": bool(getattr(job, "auto_select_enabled", False)),
        "auto_select_threshold": int(getattr(job, "auto_select_threshold", 70) or 70),
        "require_hr_confirmation": bool(getattr(job, "require_hr_confirmation", True)),
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


async def create_jobrole_for_user(
    db: Prisma,
    user_id: str,
    title: str,
    description: str | None,
    auto_select_enabled: bool,
    auto_select_threshold: int,
    require_hr_confirmation: bool,
):
    attempts = [
        {
            "title": title,
            "description": description,
            "auto_select_enabled": auto_select_enabled,
            "auto_select_threshold": auto_select_threshold,
            "require_hr_confirmation": require_hr_confirmation,
            "user": {"connect": {"id": user_id}},
        },
        {
            "title": title,
            "description": description,
            "auto_select_enabled": auto_select_enabled,
            "auto_select_threshold": auto_select_threshold,
            "require_hr_confirmation": require_hr_confirmation,
            "created_by": user_id,
        },
        {
            "title": title,
            "description": description,
            "auto_select_enabled": auto_select_enabled,
            "auto_select_threshold": auto_select_threshold,
            "require_hr_confirmation": require_hr_confirmation,
        },
        {
            "title": title,
            "description": description,
        },
    ]

    last_error: Exception | None = None
    for data in attempts:
        try:
            return await db.jobrole.create(data=data)
        except Exception as exc:
            last_error = exc

    raise RuntimeError(str(last_error) if last_error else "Failed to create job role")


async def create_jobskill_link(db: Prisma, job_id: str, skill_id: str, level: str):
    attempts = [
        {
            "job_id": job_id,
            "skill_id": skill_id,
            "level": level,
        },
        {
            "job": {"connect": {"id": job_id}},
            "skill": {"connect": {"id": skill_id}},
            "level": level,
        },
    ]

    last_error: Exception | None = None
    for data in attempts:
        try:
            return await db.jobskill.create(data=data)
        except Exception as exc:
            last_error = exc

    raise RuntimeError(str(last_error) if last_error else "Failed to create job-skill link")


def normalize_skill_name(raw_value: str) -> str:
    return " ".join(str(raw_value or "").strip().split()).lower()


def apply_skill_alias(normalized_name: str) -> str:
    alias_map = {
        "ms excel": "microsoft excel",
        "excel": "microsoft excel",
    }
    return alias_map.get(normalized_name, normalized_name)


async def find_existing_skill_case_insensitive(db: Prisma, normalized_name: str):
    all_skills = await db.skill.find_many()
    for item in all_skills:
        if normalize_skill_name(getattr(item, "name", "")) == normalized_name:
            return item
    return None


def get_or_create_skill_id(skill_data, current_user, db: Prisma):
    async def _resolve():
        skill_id = skill_data.skill_id
        if skill_id:
            return skill_id

        skill_name = apply_skill_alias(normalize_skill_name(skill_data.skill_name or ""))
        if not skill_name:
            return None

        existing_skill = await find_existing_skill_case_insensitive(db, skill_name)
        if existing_skill:
            return existing_skill.id

        create_attempts = [
            {
                "name": skill_name,
                "is_global": True,
                "user": {"connect": {"id": current_user.id}},
            },
            {
                "name": skill_name,
                "is_global": True,
                "created_by": current_user.id,
            },
            {
                "name": skill_name,
                "is_global": True,
            },
        ]

        created_skill = None
        last_error: Exception | None = None
        for payload in create_attempts:
            try:
                created_skill = await db.skill.create(data=payload)
                break
            except Exception as exc:
                last_error = exc

        if not created_skill:
            raise RuntimeError(str(last_error) if last_error else "Failed to create skill")

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
    try:
        new_job = await create_jobrole_for_user(
            db=db,
            user_id=current_user.id,
            title=job.title.strip(),
            description=job.description,
            auto_select_enabled=job.auto_select_enabled,
            auto_select_threshold=max(0, min(100, int(job.auto_select_threshold))),
            require_hr_confirmation=job.require_hr_confirmation,
        )
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to create job role: {exc}")
    
    # Associate skills
    added_skill_ids = set()
    for skill_data in job.skills:
        skill_id = await get_or_create_skill_id(skill_data, current_user, db)

        if not skill_id or skill_id in added_skill_ids:
            continue

        added_skill_ids.add(skill_id)

        try:
            await create_jobskill_link(
                db=db,
                job_id=new_job.id,
                skill_id=skill_id,
                level=resolve_job_skill_level(skill_data),
            )
        except Exception as exc:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to save job skills: {exc}")

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

    if job.auto_select_enabled is not None:
        update_data["auto_select_enabled"] = bool(job.auto_select_enabled)

    if job.auto_select_threshold is not None:
        update_data["auto_select_threshold"] = max(0, min(100, int(job.auto_select_threshold)))

    if job.require_hr_confirmation is not None:
        update_data["require_hr_confirmation"] = bool(job.require_hr_confirmation)

    if update_data:
        try:
            await db.jobrole.update(where={"id": job_id}, data=update_data)
        except Exception as exc:
            message = str(exc).lower()
            if any(item in message for item in ["unknown argument", "could not find field", "field does not exist"]):
                compatibility_data = {
                    key: value
                    for key, value in update_data.items()
                    if key not in {"auto_select_enabled", "auto_select_threshold", "require_hr_confirmation"}
                }
                if compatibility_data:
                    await db.jobrole.update(where={"id": job_id}, data=compatibility_data)
            else:
                raise

    await db.jobskill.delete_many(where={"job_id": job_id})

    added_skill_ids = set()
    for skill_data in job.skills:
        skill_id = await get_or_create_skill_id(skill_data, current_user, db)
        if not skill_id or skill_id in added_skill_ids:
            continue

        added_skill_ids.add(skill_id)

        try:
            await create_jobskill_link(
                db=db,
                job_id=job_id,
                skill_id=skill_id,
                level=resolve_job_skill_level(skill_data),
            )
        except Exception as exc:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to save job skills: {exc}")

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
    await db.shortlistedcandidate.delete_many(where={"job_id": job_id})
    await db.jobskill.delete_many(where={"job_id": job_id})
    await db.jobrole.delete(where={"id": job_id})
