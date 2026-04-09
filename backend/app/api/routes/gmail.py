from fastapi import APIRouter, Depends, HTTPException
from app.api.dependencies import get_current_user
from app.db.session import get_db
from app.services.gmail_service import GmailService
from app.services.nlp_service import NLPService
from app.services.google_drive import GoogleDriveService
from prisma import Prisma
import uuid

router = APIRouter()
nlp_service = NLPService()
drive_service = GoogleDriveService()

@router.post("/fetch")
async def fetch_gmail_resumes(
    current_user=Depends(get_current_user),
    db: Prisma = Depends(get_db)
):
    """
    Scans Inbox for resume attachments and processes them automatically.
    """
    # In production: pass user token here
    gmail_service = GmailService(token="your-token-here")
    attachments = gmail_service.fetch_resumes()
    
    processed = 0
    new_candidates = 0
    
    for att in attachments:
        filename = att['filename']
        content = att['data']
        mimetype = att['mimetype']
        
        # 1. Extract Text
        extracted_text = nlp_service.extract_text_from_bytes(content, filename)
        if not extracted_text: continue
        
        # 2. Upload to GDrive
        drive_id = drive_service.upload_file(content, filename, mimetype) or "placeholder"
        
        # 3. DB Records
        candidate_name = filename.replace('.pdf', '').replace('_', ' ').title()
        
        # Check if candidate exists
        candidate = await db.candidate.find_first(where={'full_name': candidate_name})
        if not candidate:
            candidate = await db.candidate.create(
                data={
                    "full_name": candidate_name,
                    "skills": list(nlp_service.extract_skills(extracted_text))
                }
            )
            new_candidates += 1
            
        await db.resume.create(
            data={
                "candidate_id": candidate.id,
                "drive_file_id": drive_id,
                "original_filename": filename,
                "content_text": extracted_text
            }
        )
        processed += 1
        
    return {
        "status": "success",
        "processed_count": processed,
        "new_candidates_count": new_candidates
    }
