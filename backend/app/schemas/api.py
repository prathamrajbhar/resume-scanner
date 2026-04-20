from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Any, Dict, Literal
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


class SkillBulkCreate(BaseModel):
    skills: List[str]
    level: Optional[str] = "intermediate"
    global_flag: bool = Field(default=True, alias="global")

    class Config:
        populate_by_name = True

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
    auto_select_enabled: bool = False
    auto_select_threshold: int = 70
    require_hr_confirmation: bool = True
    skills: List[JobSkillBase]


class JobRoleUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    auto_select_enabled: Optional[bool] = None
    auto_select_threshold: Optional[int] = None
    require_hr_confirmation: Optional[bool] = None
    skills: List[JobSkillBase]

class JobRoleSimple(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    auto_select_enabled: bool = False
    auto_select_threshold: int = 70
    require_hr_confirmation: bool = True
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
    education_score: float = 0
    academic_score: float = 0
    experience_score: float = 0
    skill_match_score: float = 0
    project_score: float = 0
    soft_skill_score: float = 0
    final_score: float = 0
    matched_skills: List[str]
    missing_skills: List[str]


class AnalysisResultCard(BaseModel):
    class DegreeEntry(BaseModel):
        degree: Optional[str] = None
        field: Optional[str] = None
        cgpa: Optional[float] = None

    class ExperienceEntry(BaseModel):
        role: Optional[str] = None
        duration: Optional[str] = None

    id: str
    resume_id: str
    name: str
    email: Optional[str] = None
    score: float
    education_score: float = 0
    academic_score: float = 0
    experience_score: float = 0
    skill_match_score: float = 0
    project_score: float = 0
    soft_skill_score: float = 0
    final_score: float = 0
    top_skills: List[str]
    matched_skills: List[str]
    missing_skills: List[str]
    cgpa: Optional[float] = None
    cgpa_or_percentage: Optional[float] = None
    sgpa: Optional[float] = None
    degree: Optional[str] = None
    university: Optional[str] = None
    total_experience_years: Optional[float] = None
    relevant_experience_years: Optional[float] = None
    projects_count: Optional[int] = None
    soft_skills: List[str] = []
    normalized_skills: List[str] = []
    internships: List[str] = []
    communication_score: float = 0
    leadership_score: float = 0
    teamwork_score: float = 0
    problem_solving_score: float = 0
    auto_selected: bool = False
    selected: bool = False
    selection_status: str = "rejected"
    degrees: List[DegreeEntry] = []
    experience_list: List[ExperienceEntry] = []
    projects: List[str] = []
    certifications: List[str] = []

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


class CandidateEnrichmentRequest(BaseModel):
    candidate_id: str
    linkedin_url: Optional[str] = None
    profile_text: Optional[str] = None


class CandidatePreviewExtractRequest(BaseModel):
    text: str


class CandidatePreviewExtractResponse(BaseModel):
    skills: List[str] = []
    keywords: List[str] = []
    readability: Literal["good", "average", "poor"]


class CandidateSkillSuggestionRequest(BaseModel):
    text: Optional[str] = None


class SkillSuggestion(BaseModel):
    name: str
    confidence: Literal["high", "medium", "low"]


class CandidateSkillSuggestionResponse(BaseModel):
    suggestions: List[SkillSuggestion] = []


class ProfessionalInsight(BaseModel):
    key: str
    title: str
    score: float
    explanation: str
    reasons: List[str] = []
    evidence: List[str] = []


class CandidateEnrichmentResponse(BaseModel):
    id: str
    candidate_id: str
    linkedin_url: Optional[str] = None
    profile_text: Optional[str] = None
    communication_score: float
    domain_score: float
    learning_score: float
    stability_score: float
    keywords: List[str] = []
    experience_signals: List[str] = []
    education_signals: List[str] = []
    certifications: List[str] = []
    confidence_score: float = 0
    guidance_message: Optional[str] = None
    insights: List[ProfessionalInsight] = []
