from fastapi import APIRouter, Body, Depends, HTTPException, Query
from app.api.dependencies import get_current_user
from app.db.session import get_db
from app.db.prisma_client import Prisma
from typing import Any, Dict, List, Optional
import re
from datetime import datetime
from prisma import Json
from app.services.nlp_service import NLPService
from app.services.auth_mailer import send_candidate_selection_email

router = APIRouter()
nlp_service = NLPService()

def _format_name_from_filename(file_name: str) -> str:
    stem = file_name.rsplit('.', 1)[0]
    cleaned = re.sub(r'[_\-]+', ' ', stem).strip()
    return cleaned.title() if cleaned else 'Unknown Candidate'

def _safe_dict(value: Any) -> Dict[str, Any]:
    return value if isinstance(value, dict) else {}

def _safe_list(value: Any) -> List[Any]:
    return value if isinstance(value, list) else []

def _extract_shortlist_entries(parsed: Dict[str, Any]) -> List[Dict[str, Any]]:
    shortlist = parsed.get('shortlist') if isinstance(parsed, dict) else None
    if not isinstance(shortlist, dict):
        return []
    entries = shortlist.get('entries')
    if not isinstance(entries, list):
        return []
    return [item for item in entries if isinstance(item, dict)]

def _resume_to_candidate_payload(resume: Any) -> Dict[str, Any]:
    """
    Transforms a Resume DB object into a Candidate profile payload.
    Relies on the high-quality Gemini-parsed data in 'parsed_data'.
    """
    parsed = _safe_dict(getattr(resume, 'parsed_data', {}))
    content_text = getattr(resume, 'content_text', '')
    
    # If parsed_data is empty (legacy or failed initial parse), try one-time enrichment
    if not parsed and content_text:
        parsed = nlp_service.extract_candidate_profile(content_text, resume.file_name)
        # Note: We don't save back to DB here to keep GET requests idempotent, 
        # but in a real app, you might want to update the record.

    analyses = getattr(resume, 'analyses', None) or []
    shortlist_entries = _extract_shortlist_entries(parsed)

    role_titles: List[str] = []
    for analysis in analyses:
        job = getattr(analysis, 'job', None)
        title = getattr(job, 'title', None)
        if isinstance(title, str) and title.strip() and title not in role_titles:
            role_titles.append(title)

    shortlist_roles = [
        entry.get('role_title') for entry in shortlist_entries if entry.get('role_title')
    ]

    return {
        'id': resume.id,
        'full_name': parsed.get('full_name') or _format_name_from_filename(resume.file_name),
        'email': parsed.get('email'),
        'phone': parsed.get('phone'),
        'location': parsed.get('location'),
        'skills': _safe_list(parsed.get('skills')),
        'normalized_skills': _safe_list(parsed.get('normalized_skills') or parsed.get('skills')),
        'total_experience': parsed.get('total_experience_years'),
        'total_experience_years': parsed.get('total_experience_years'),
        'education': parsed.get('education'),
        'degrees': _safe_list(parsed.get('degrees')),
        'experience_list': _safe_list(parsed.get('experience_list')),
        'projects': _safe_list(parsed.get('projects')),
        'certifications': _safe_list(parsed.get('certifications')),
        'awards': _safe_list(parsed.get('awards')),
        'soft_skills': _safe_list(parsed.get('soft_skills')),
        'matched_roles': role_titles,
        'is_shortlisted': len(shortlist_entries) > 0,
        'selected_type': shortlist_entries[-1].get('selection_type') if shortlist_entries else None,
        'auto_selected': bool(getattr(resume, 'auto_selected', False)),
        'selected': bool(getattr(resume, 'selected', False)),
        'selection_status': str(getattr(resume, 'selection_status', 'rejected') or 'rejected'),
        'shortlisted_roles': shortlist_roles,
        'shortlist_entries': shortlist_entries,
    }

@router.get("/")
async def list_candidates(
    role_id: str | None = Query(default=None),
    shortlisted: bool | None = Query(default=None),
    current_user=Depends(get_current_user),
    db: Prisma = Depends(get_db)
):
    resumes = await db.resume.find_many(
        where={'uploaded_by': current_user.id},
        include={'analyses': {'include': {'job': True}}},
        order={'created_at': 'desc'}
    )
    resumes = [r for r in resumes if not getattr(r, 'is_deleted', False)]

    if role_id:
        resumes = [r for r in resumes if any(getattr(a, 'job_id', None) == role_id for a in (getattr(r, 'analyses', []) or []))]

    if shortlisted is True:
        resumes = [r for r in resumes if len(_extract_shortlist_entries(_safe_dict(getattr(r, 'parsed_data', {})))) > 0]

    return [_resume_to_candidate_payload(r) for r in resumes]

@router.get("/{candidate_id}")
async def get_candidate(
    candidate_id: str,
    current_user=Depends(get_current_user),
    db: Prisma = Depends(get_db)
):
    resume = await db.resume.find_first(
        where={'id': candidate_id, 'uploaded_by': current_user.id},
        include={'analyses': {'include': {'job': True}}},
    )
    if not resume or getattr(resume, 'is_deleted', False):
        raise HTTPException(status_code=404, detail="Candidate not found")
    return _resume_to_candidate_payload(resume)

@router.delete("/{candidate_id}")
async def delete_candidate(
    candidate_id: str,
    current_user=Depends(get_current_user),
    db: Prisma = Depends(get_db),
):
    resume = await db.resume.find_first(where={'id': candidate_id, 'uploaded_by': current_user.id})
    if not resume:
        raise HTTPException(status_code=404, detail='Candidate not found')

    await db.resume.update(where={'id': candidate_id}, data={'is_deleted': True})
    return {'message': 'Candidate deleted successfully'}

@router.post("/{candidate_id}/shortlist")
async def shortlist_candidate(
    candidate_id: str,
    payload: Dict[str, Any] = Body(default={}),
    current_user=Depends(get_current_user),
    db: Prisma = Depends(get_db),
):
    resume = await db.resume.find_first(where={'id': candidate_id, 'uploaded_by': current_user.id})
    if not resume:
        raise HTTPException(status_code=404, detail="Candidate not found")

    role_id = payload.get('role_id')
    if not role_id:
        raise HTTPException(status_code=400, detail='role_id is required')

    role = await db.jobrole.find_unique(where={'id': role_id})
    if not role:
        raise HTTPException(status_code=404, detail='Role not found')

    parsed = _safe_dict(getattr(resume, 'parsed_data', {}))
    entries = [e for e in _extract_shortlist_entries(parsed) if e.get('role_id') != role_id]

    selection_type = str(payload.get('selection_type') or 'select').lower()
    entries.append({
        'role_id': role_id,
        'role_title': role.title,
        'selected_by': current_user.id,
        'selection_type': selection_type,
        'created_at': datetime.utcnow().isoformat(),
    })

    parsed['shortlist'] = {'entries': entries}
    await db.resume.update(
        where={'id': candidate_id},
        data={
            'parsed_data': Json(parsed),
            'selected': True,
            'selection_status': 'confirmed' if selection_type == 'final_select' else 'pending',
        },
    )

    if payload.get('send_selection_email'):
        email = parsed.get('email')
        if email:
            await send_candidate_selection_email(
                to_email=email,
                full_name=parsed.get('full_name'),
                role_title=role.title,
                selection_type=selection_type,
            )

    return {'status': 'ok', 'is_shortlisted': True}

@router.delete("/{candidate_id}/shortlist")
async def unshortlist_candidate(
    candidate_id: str,
    role_id: str | None = Query(default=None),
    current_user=Depends(get_current_user),
    db: Prisma = Depends(get_db),
):
    resume = await db.resume.find_first(where={'id': candidate_id, 'uploaded_by': current_user.id})
    if not resume:
        raise HTTPException(status_code=404, detail='Candidate not found')

    parsed = _safe_dict(getattr(resume, 'parsed_data', {}))
    entries = _extract_shortlist_entries(parsed)

    if role_id:
        entries = [e for e in entries if e.get('role_id') != role_id]
    else:
        entries = []

    parsed['shortlist'] = {'entries': entries}
    await db.resume.update(
        where={'id': candidate_id},
        data={
            'parsed_data': Json(parsed),
            'selected': len(entries) > 0,
            'selection_status': 'rejected' if not entries else 'pending',
        },
    )

    return {'status': 'ok', 'is_shortlisted': len(entries) > 0}
