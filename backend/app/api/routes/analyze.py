from fastapi import APIRouter, Depends, HTTPException
from app.api.dependencies import get_current_user
from app.db.session import get_db
from app.schemas.api import ChatRequest
from app.services.nlp_service import NLPService
from app.db.prisma_client import Prisma

router = APIRouter()
nlp_service = NLPService()

@router.post("/")
async def analyze_jd(
    request: ChatRequest,
    db: Prisma = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Ranks candidates against a job description provided in the chat.
    """
    user_id = current_user.id

    # 2. Get or Create Chat Session
    if request.chat_id:
        chat = await db.chat.find_unique(where={'id': request.chat_id})
        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found")
    else:
        chat = await db.chat.create(
            data={
                "user_id": user_id,
                "title": request.message[:30] + "...",
                "job_description": request.message
            }
        )

    # 3. Store User Message
    await db.chatmessage.create(
        data={
            "chat_id": chat.id,
            "role": "user",
            "content": request.message
        }
    )

    # 4. Get All Candidates
    candidates = await db.candidate.find_many()
    if not candidates:
        return {
            "chat_id": chat.id,
            "message": "I haven't found any candidates in your database. Please upload some resumes first!",
            "candidates": []
        }

    # 5. Rank Candidates
    job_description = request.message
    results = []
    
    for candidate in candidates:
        # Get latest resume for candidate
        resume = await db.resume.find_first(
            where={'candidate_id': candidate.id},
            order={'created_at': 'desc'}
        )
        if not resume: continue
        
        analysis = nlp_service.analyze_candidate(
            resume.content_text, 
            job_description,
            model_type=request.model_type
        )
        
        # Save score to DB
        await db.candidatescore.create(
            data={
                "chat_id": chat.id,
                "candidate_id": candidate.id,
                "model_type": request.model_type,
                "score": analysis["score"],
                "breakdown": analysis["breakdown"]
            }
        )
        
        results.append({
            "id": candidate.id,
            "full_name": candidate.full_name,
            "score": analysis["score"],
            "breakdown": analysis["breakdown"],
            "skills": analysis["skills"],
            "matching_skills": analysis["matching_skills"],
            "missing_skills": analysis["missing_skills"]
        })

    # Sort results
    results = sorted(results, key=lambda x: x["score"], reverse=True)[:5]
    
    # Store Assistant Response
    top_names = [r["full_name"] for r in results]
    assistant_content = f"I've analyzed {len(candidates)} candidates. Here are the top matches: {', '.join(top_names)}."
    
    await db.chatmessage.create(
        data={
            "chat_id": chat.id,
            "role": "assistant",
            "content": assistant_content
        }
    )

    return {
        "chat_id": chat.id,
        "message": assistant_content,
        "candidates": results
    }
