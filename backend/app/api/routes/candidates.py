from fastapi import APIRouter, Depends, HTTPException
from app.api.dependencies import get_current_user
from app.db.session import get_db
from prisma import Prisma

router = APIRouter()

@router.get("/")
async def list_candidates(
    current_user=Depends(get_current_user),
    db: Prisma = Depends(get_db)
):
    """
    Returns list of all candidates.
    """
    return await db.candidate.find_many()

@router.get("/{candidate_id}")
async def get_candidate(
    candidate_id: str,
    current_user=Depends(get_current_user),
    db: Prisma = Depends(get_db)
):
    """
    Returns specific candidate details.
    """
    candidate = await db.candidate.find_unique(where={'id': candidate_id})
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return candidate
