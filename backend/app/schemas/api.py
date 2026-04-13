from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Any, Dict
from datetime import datetime

# Auth & User
class GoogleLoginRequest(BaseModel):
    id_token: str

class UserBase(BaseModel):
    id: str
    email: EmailStr
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None

class UserSimple(BaseModel):
    id: str
    email: EmailStr
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None

# Skills
class SkillBase(BaseModel):
    name: str
    category: Optional[str] = None
    is_global: bool = True

class SkillCreate(SkillBase):
    pass

class SkillSimple(BaseModel):
    id: str
    name: str
    category: Optional[str] = None
    is_global: bool = True
    created_at: datetime
    class Config:
        from_attributes = True

# Job Roles
class JobSkillBase(BaseModel):
    skill_id: Optional[str] = None
    skill_name: Optional[str] = None
    level: Optional[str] = None
    required_level: Optional[int] = None

    class Config:
        from_attributes = True

class JobRoleCreate(BaseModel):
    title: str
    description: Optional[str] = None
    skills: List[JobSkillBase]


class JobRoleUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    skills: List[JobSkillBase]

class JobRoleSimple(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    created_by: Optional[str] = None
    created_at: datetime
    class Config:
        from_attributes = True


class JobSkillSimple(BaseModel):
    id: str
    job_id: str
    skill_id: str
    skill_name: Optional[str] = None
    level: str
    class Config:
        from_attributes = True


class JobRoleDetail(JobRoleSimple):
    skills: List[JobSkillSimple] = []

# Resume & Analysis
class ResumeSimple(BaseModel):
    id: str
    file_name: str
    uploaded_by: str
    created_at: datetime
    class Config:
        from_attributes = True

class AnalysisResult(BaseModel):
    candidate_name: str
    score: float
    matched_skills: List[str]
    missing_skills: List[str]


class AnalysisResultCard(BaseModel):
    id: str
    name: str
    score: float
    top_skills: List[str]
    matched_skills: List[str]
    missing_skills: List[str]

# Chat
class ChatMessageBase(BaseModel):
    role: str
    content: str
    created_at: datetime

class ChatSimple(BaseModel):
    id: str
    title: str
    created_at: datetime
    class Config:
        from_attributes = True

class ChatHistoryResponse(BaseModel):
    chats: List[ChatSimple]

# Original/Support Classes
class ChatRequest(BaseModel):
    message: str
    chat_id: Optional[str] = None
    model_type: Optional[str] = "ensemble"

class AnalyzeResponse(BaseModel):
    chat_id: str
    message: str
    candidates: List[Dict]

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
