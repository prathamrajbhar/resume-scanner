from fastapi import APIRouter, Depends, HTTPException, status
from app.db.prisma_client import Prisma
from app.db.session import get_db
from app.api.dependencies import get_current_user
from app.schemas.api import SkillCreate, SkillSimple
from typing import List

router = APIRouter()

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
        order={"created_at": "desc"}
    )

@router.post("/", response_model=SkillSimple)
async def create_skill(
    skill: SkillCreate,
    current_user = Depends(get_current_user),
    db: Prisma = Depends(get_db)
):
    # Check if exists
    existing = await db.skill.find_unique(where={"name": skill.name})
    if existing:
        if skill.is_global and not existing.is_global:
            return await db.skill.update(
                where={"id": existing.id},
                data={"is_global": True}
            )
        return existing
        
    return await db.skill.create(
        data={
            "name": skill.name,
            "category": skill.category,
            "is_global": skill.is_global,
            "created_by": current_user.id
        }
    )
