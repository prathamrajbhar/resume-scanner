from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from app.api.dependencies import get_current_user
from app.db.session import get_db
from app.db.prisma_client import Prisma
from app.schemas.api import ResumeSimple, ResumeUploadResponse
from app.services.nlp_service import NLPService
from typing import List
from prisma import Json
import logging

logger = logging.getLogger(__name__)

router = APIRouter()
nlp_service = NLPService()

@router.post("/upload", response_model=ResumeUploadResponse)
async def upload_resume(
    file: UploadFile = File(...),
    current_user = Depends(get_current_user),
    db: Prisma = Depends(get_db)
):
    """
    Handles resume upload, extraction, and storage in DB.
    """
    logger.info(f"Uploading resume: {file.filename}")
    try:
        content = await file.read()

        extracted = nlp_service.extract_text_from_bytes(content, file.filename or "uploaded_resume")
        content_text = extracted or f"Extracted text from {file.filename}"
        
        logger.info(f"Extracted {len(content_text)} characters. Starting profile extraction...")
        
        parsed_profile = await nlp_service.extract_candidate_profile(content_text, file.filename or "uploaded_resume")
        
        logger.info(f"Profile extracted for: {parsed_profile.get('full_name')}")

        resume = await db.resume.create(
            data={
                "file_name": file.filename or "uploaded_resume",
                "content_text": content_text,
                "parsed_data": Json(parsed_profile),
                "uploaded_by": current_user.id,
            }
        )
        
        return ResumeUploadResponse(
            filename=resume.file_name,
            drive_id="", # Not used
            candidate_id=resume.id,
            extracted_text=content_text[:500] + "..." # Just for confirmation
        )
        
    except Exception as e:
        logger.error(f"Error in upload_resume: {str(e)}", exc_info=True)
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
