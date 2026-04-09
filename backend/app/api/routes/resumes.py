from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from app.api.dependencies import get_current_user
from app.db.session import get_db
from app.services.google_drive import GoogleDriveService
from app.services.nlp_service import NLPService
from app.db.prisma_client import Prisma

router = APIRouter()
drive_service = GoogleDriveService()
nlp_service = NLPService()

@router.post("/upload")
async def upload_resume(
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
    db: Prisma = Depends(get_db)
):
    """
    Handles PDF/DOC resume upload, extraction, and storage in GDrive & DB.
    """
    try:
        content = await file.read()
        filename = file.filename
        
        # 1. Extract Text
        extracted_text = nlp_service.extract_text_from_bytes(content, filename)
        if not extracted_text:
            raise HTTPException(status_code=400, detail="Failed to extract text from resume")
            
        # 2. Upload to GDrive
        drive_id = drive_service.upload_file(content, filename, file.content_type)
        if not drive_id:
            drive_id = "placeholder_id"  # For local dev if no creds
            
        # 3. Create Candidate & Resume Record
        candidate_name = filename.replace('.pdf', '').replace('_', ' ').title()
        
        candidate = await db.candidate.create(
            data={
                "full_name": candidate_name,
                "skills": list(nlp_service.extract_skills(extracted_text))
            }
        )
        
        # We don't need to return the resume record, just create it
        await db.resume.create(
            data={
                "candidate_id": candidate.id,
                "drive_file_id": drive_id,
                "original_filename": filename,
                "content_text": extracted_text
            }
        )
        
        return {
            "id": candidate.id,
            "name": candidate.full_name,
            "filename": filename,
            "drive_id": drive_id
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error uploading resume: {str(e)}")
