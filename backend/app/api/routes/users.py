from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from app.db.prisma_client import Prisma
from app.db.session import get_db
from app.api.dependencies import get_current_user
from app.schemas.api import UserSimple

router = APIRouter()

class UpdateProfileRequest(BaseModel):
    full_name: str

@router.get("/me", response_model=UserSimple)
async def get_me(current_user = Depends(get_current_user)):
    return current_user

@router.patch("/profile", response_model=UserSimple)
async def update_profile(
    request: UpdateProfileRequest,
    current_user = Depends(get_current_user),
    db: Prisma = Depends(get_db)
):
    """Update user profile information."""
    if not request.full_name or not request.full_name.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Name is required"
        )
    
    updated_user = await db.user.update(
        where={"id": current_user.id},
        data={"full_name": request.full_name.strip()}
    )
    
    return updated_user

@router.delete("/account")
async def delete_account(
    current_user = Depends(get_current_user),
    db: Prisma = Depends(get_db)
):
    user_id = current_user.id

    # 1) Delete chat history
    await db.chatmessage.delete_many(where={"chat": {"user_id": user_id}})
    await db.chat.delete_many(where={"user_id": user_id})

    # 2) Delete analysis rows linked to either user's jobs or user's resumes
    await db.analysis.delete_many(where={"job": {"created_by": user_id}})
    await db.analysis.delete_many(where={"resume": {"uploaded_by": user_id}})

    # 3) Delete user's job role dependencies and job roles
    await db.jobskill.delete_many(where={"job": {"created_by": user_id}})
    await db.jobrole.delete_many(where={"created_by": user_id})

    # 4) Delete user's resumes
    await db.resume.delete_many(where={"uploaded_by": user_id})

    # 5) Detach custom skill ownership so shared skills are preserved
    await db.skill.update_many(where={"created_by": user_id}, data={"created_by": None})

    # 6) Delete the user itself
    await db.user.delete(where={"id": user_id})

    return {"message": "Account and associated data deleted"}
