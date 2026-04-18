from fastapi import APIRouter, Depends, HTTPException, status
from app.db.prisma_client import Prisma
from app.db.session import get_db
from app.api.dependencies import get_current_user
from app.schemas.api import SkillBulkCreate, SkillCreate, SkillSimple
from typing import List, Optional

router = APIRouter()


def _normalize_skill_name(raw_value: str) -> str:
    return " ".join(str(raw_value or "").strip().split()).lower()


def _apply_skill_alias(normalized_name: str) -> str:
    alias_map = {
        "ms excel": "microsoft excel",
        "excel": "microsoft excel",
    }
    return alias_map.get(normalized_name, normalized_name)


async def _find_existing_skill_case_insensitive(db: Prisma, normalized_name: str) -> Optional[SkillSimple]:
    # Prisma Python client does not consistently expose case-insensitive string filters
    # across all environments, so we normalize and compare in-process.
    skills = await db.skill.find_many()
    for item in skills:
        if _normalize_skill_name(getattr(item, "name", "")) == normalized_name:
            return item
    return None


async def _get_or_create_skill(
    *,
    db: Prisma,
    normalized_name: str,
    category: Optional[str],
    is_global: bool,
    user_id: str,
):
    existing = await _find_existing_skill_case_insensitive(db, normalized_name)
    if existing:
        if is_global and not existing.is_global:
            return await db.skill.update(
                where={"id": existing.id},
                data={"is_global": True}
            )
        return existing

    return await db.skill.create(
        data={
            "name": normalized_name,
            "category": category,
            "is_global": is_global,
            "user": {
                "connect": {
                    "id": user_id,
                }
            },
        }
    )

@router.get("/", response_model=List[SkillSimple])
async def get_skills(
    current_user = Depends(get_current_user),
    db: Prisma = Depends(get_db)
):
    return await db.skill.find_many(
        where={
            "OR": [
                {"is_global": True},
                {"created_by": current_user.id},
            ]
        },
        order={"name": "asc"}
    )


@router.get("/suggest", response_model=List[SkillSimple])
async def suggest_skills(
    q: str,
    limit: int = 8,
    current_user=Depends(get_current_user),
    db: Prisma = Depends(get_db),
):
    query = _normalize_skill_name(q)
    if not query:
        return []

    scoped_skills = await db.skill.find_many(
        where={
            "OR": [
                {"is_global": True},
                {"created_by": current_user.id},
            ]
        }
    )
    matches = [
        item
        for item in scoped_skills
        if query in _normalize_skill_name(getattr(item, "name", ""))
    ]
    matches.sort(key=lambda item: _normalize_skill_name(getattr(item, "name", "")))
    safe_limit = max(1, min(limit, 20))
    return matches[:safe_limit]

@router.post("/", response_model=SkillSimple)
async def create_skill(
    skill: SkillCreate,
    current_user = Depends(get_current_user),
    db: Prisma = Depends(get_db)
):
    normalized_name = _apply_skill_alias(_normalize_skill_name(skill.name))
    if not normalized_name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Skill name is required")

    return await _get_or_create_skill(
        db=db,
        normalized_name=normalized_name,
        category=skill.category,
        is_global=skill.is_global,
        user_id=current_user.id,
    )


@router.post("/bulk", response_model=List[SkillSimple])
async def create_skills_bulk(
    payload: SkillBulkCreate,
    current_user = Depends(get_current_user),
    db: Prisma = Depends(get_db)
):
    normalized_names: List[str] = []
    seen = set()
    for skill_name in payload.skills:
        normalized = _apply_skill_alias(_normalize_skill_name(skill_name))
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        normalized_names.append(normalized)

    if not normalized_names:
        return []

    upserted: List[SkillSimple] = []
    for name in normalized_names:
        created = await _get_or_create_skill(
            db=db,
            normalized_name=name,
            category=None,
            is_global=payload.global_flag,
            user_id=current_user.id,
        )
        upserted.append(created)

    return upserted


@router.delete("/{skill_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_skill(
    skill_id: str,
    current_user=Depends(get_current_user),
    db: Prisma = Depends(get_db),
):
    skill = await db.skill.find_unique(where={"id": skill_id})
    if not skill:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Skill not found")

    owner_id = getattr(skill, "created_by", None) or getattr(skill, "createdBy", None)
    if owner_id and owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete skills created by you",
        )

    in_use = await db.jobskill.find_first(where={"skill_id": skill_id})
    if in_use:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Skill is already used in one or more job roles",
        )

    # Remove aliases if they exist in database schema.
    try:
        await db.skillalias.delete_many(where={"skill_id": skill_id})
    except Exception:
        pass

    await db.skill.delete(where={"id": skill_id})
