from fastapi import APIRouter, Depends, HTTPException
from app.db.prisma_client import Prisma
from app.db.session import get_db
from app.api.dependencies import get_current_user
from app.schemas.api import ChatSimple, ChatHistoryResponse, ChatMessageBase
from typing import List

router = APIRouter()

@router.post("/new", response_model=ChatSimple)
async def create_chat(
    title: str,
    current_user = Depends(get_current_user),
    db: Prisma = Depends(get_db)
):
    chat = await db.chat.create(
        data={
            "user_id": current_user.id,
            "title": title
        }
    )
    return chat

@router.get("/history", response_model=ChatHistoryResponse)
async def get_history(
    current_user = Depends(get_current_user),
    db: Prisma = Depends(get_db)
):
    chats = await db.chat.find_many(
        where={"user_id": current_user.id},
        order={"created_at": "desc"}
    )
    return ChatHistoryResponse(chats=[ChatSimple.from_orm(c) for c in chats])

@router.delete("/{chat_id}")
async def delete_chat(
    chat_id: str,
    current_user = Depends(get_current_user),
    db: Prisma = Depends(get_db)
):
    # Verify ownership
    chat = await db.chat.find_unique(where={"id": chat_id})
    if not chat or chat.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Chat not found")
        
    # Delete messages first
    await db.chatmessage.delete_many(where={"chat_id": chat_id})
    await db.chat.delete(where={"id": chat_id})
    return {"message": "Chat deleted"}

@router.get("/{chat_id}/messages", response_model=List[ChatMessageBase])
async def get_messages(
    chat_id: str,
    current_user = Depends(get_current_user),
    db: Prisma = Depends(get_db)
):
    # Verify ownership
    chat = await db.chat.find_unique(where={"id": chat_id})
    if not chat or chat.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Chat not found")
        
    return await db.chatmessage.find_many(
        where={"chat_id": chat_id},
        order={"created_at": "asc"}
    )
