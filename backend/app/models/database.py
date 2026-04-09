from typing import Optional, List, Dict
from datetime import datetime
from sqlmodel import SQLModel, Field, Relationship, Column, JSON
import uuid

# Global UUID Generator
def get_uuid():
    return str(uuid.uuid4())

class User(SQLModel, table=True):
    id: Optional[str] = Field(default_factory=get_uuid, primary_key=True)
    email: str = Field(index=True, unique=True)
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    google_id: Optional[str] = Field(index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    chats: List["Chat"] = Relationship(back_populates="user")

class Chat(SQLModel, table=True):
    id: Optional[str] = Field(default_factory=get_uuid, primary_key=True)
    user_id: str = Field(foreign_key="user.id", index=True)
    title: str
    job_description: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    user: User = Relationship(back_populates="chats")
    messages: List["ChatMessage"] = Relationship(back_populates="chat")
    scores: List["CandidateScore"] = Relationship(back_populates="chat")

class ChatMessage(SQLModel, table=True):
    id: Optional[str] = Field(default_factory=get_uuid, primary_key=True)
    chat_id: str = Field(foreign_key="chat.id", index=True)
    role: str  # user or assistant
    content: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    message_metadata: Optional[Dict] = Field(default_factory=dict, sa_column=Column(JSON))
    
    chat: Chat = Relationship(back_populates="messages")

class Resume(SQLModel, table=True):
    id: Optional[str] = Field(default_factory=get_uuid, primary_key=True)
    candidate_id: str = Field(foreign_key="candidate.id", index=True)
    drive_file_id: str
    original_filename: str
    content_text: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    candidate: "Candidate" = Relationship(back_populates="resumes")

class Candidate(SQLModel, table=True):
    id: Optional[str] = Field(default_factory=get_uuid, primary_key=True)
    full_name: str = Field(index=True)
    email: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    skills: List[str] = Field(default_factory=list, sa_column=Column(JSON))
    total_experience: Optional[float] = None
    education: Optional[str] = None
    
    resumes: List[Resume] = Relationship(back_populates="candidate")
    scores: List["CandidateScore"] = Relationship(back_populates="candidate")

class CandidateScore(SQLModel, table=True):
    id: Optional[str] = Field(default_factory=get_uuid, primary_key=True)
    chat_id: str = Field(foreign_key="chat.id", index=True)
    candidate_id: str = Field(foreign_key="candidate.id", index=True)
    model_type: str  # bert, tf-idf, hybrid, ensemble
    score: float
    breakdown: Dict = Field(default_factory=dict, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    chat: Chat = Relationship(back_populates="scores")
    candidate: Candidate = Relationship(back_populates="scores")
