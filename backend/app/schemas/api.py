from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict
from datetime import datetime

class ChatRequest(BaseModel):
    message: str
    chat_id: Optional[str] = None
    model_type: Optional[str] = "ensemble"

class AnalyzeResponse(BaseModel):
    chat_id: str
    message: str
    candidates: List[Dict]

class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None

class ResumeUploadResponse(BaseModel):
    filename: str
    drive_id: str
    candidate_id: str
    extracted_text: str

class CandidateDetail(BaseModel):
    id: str
    full_name: str
    skills: List[str]
    score: float
    breakdown: Dict
    matching_skills: List[str]
    missing_skills: List[str]

class GmailFetchResponse(BaseModel):
    total_processed: int
    new_candidates_count: int

class GoogleLoginRequest(BaseModel):
    id_token: str
