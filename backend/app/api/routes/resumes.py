from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from app.api.dependencies import get_current_user
from app.db.session import get_db
from app.db.prisma_client import Prisma
from app.schemas.api import ResumeSimple
from app.services.nlp_service import NLPService
from typing import List
from prisma import Json

router = APIRouter()
nlp_service = NLPService()

@router.post("/upload", response_model=ResumeSimple)
async def upload_resume(
    file: UploadFile = File(...),
    current_user = Depends(get_current_user),
    db: Prisma = Depends(get_db)
):
    """
    Handles resume upload, extraction, and storage in DB.
    """
    try:
        content = await file.read()

        extracted = nlp_service.extract_text_from_bytes(content, file.filename or "uploaded_resume")
        content_text = extracted or f"Extracted text from {file.filename}"
        parsed_profile = nlp_service.extract_candidate_profile(content_text, file.filename or "uploaded_resume")
        
        resume = await db.resume.create(
            data={
                "file_name": file.filename or "uploaded_resume",
                "content_text": content_text,
                "parsed_data": Json(parsed_profile),
                "uploaded_by": current_user.id,
            }
        )
        return resume
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error uploading resume: {str(e)}")

@router.get("/", response_model=List[ResumeSimple])
async def get_resumes(
    current_user = Depends(get_current_user),
    db: Prisma = Depends(get_db)
):
    return await db.resume.find_many(
        where={"uploaded_by": current_user.id}, 
        order={"created_at": "desc"}
    )
