from fastapi import APIRouter, Body, Depends, HTTPException, Query
from app.api.dependencies import get_current_user
from app.db.session import get_db
from app.db.prisma_client import Prisma
from typing import Any, Dict, List
import re
from datetime import datetime
from prisma import Json

router = APIRouter()


def _format_name_from_filename(file_name: str) -> str:
    stem = file_name.rsplit('.', 1)[0]
    cleaned = re.sub(r'[_\-]+', ' ', stem).strip()
    return cleaned.title() if cleaned else 'Unknown Candidate'


def _safe_dict(value: Any) -> Dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _safe_list_of_strings(value: Any) -> List[str]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, str)]


def _extract_shortlist_entries(parsed: Dict[str, Any]) -> List[Dict[str, Any]]:
    shortlist = parsed.get('shortlist') if isinstance(parsed, dict) else None
    if not isinstance(shortlist, dict):
        return []

    entries = shortlist.get('entries')
    if not isinstance(entries, list):
        return []

    cleaned: List[Dict[str, Any]] = []
    for item in entries:
        if not isinstance(item, dict):
            continue

        role_id = item.get('role_id')
        role_title = item.get('role_title')
        selected_by = item.get('selected_by')
        selection_type = item.get('selection_type')
        created_at = item.get('created_at')

        if not isinstance(role_id, str) or not role_id.strip():
            continue

        cleaned.append(
            {
                'role_id': role_id,
                'role_title': role_title if isinstance(role_title, str) else None,
                'selected_by': selected_by if isinstance(selected_by, str) else None,
                'selection_type': selection_type if isinstance(selection_type, str) else 'select',
                'created_at': created_at if isinstance(created_at, str) else None,
            }
        )

    return cleaned


def _resume_to_candidate_payload(resume: Any) -> Dict[str, Any]:
    parsed = _safe_dict(getattr(resume, 'parsed_data', None))
    skills = _safe_list_of_strings(parsed.get('skills'))
    analyses = getattr(resume, 'analyses', None) or []
    shortlist_entries = _extract_shortlist_entries(parsed)

    role_titles: List[str] = []
    for analysis in analyses:
        job = getattr(analysis, 'job', None)
        title = getattr(job, 'title', None)
        if isinstance(title, str) and title.strip() and title not in role_titles:
            role_titles.append(title)

    shortlist_roles = [
        entry['role_title'] for entry in shortlist_entries if isinstance(entry.get('role_title'), str)
    ]

    selected_type = None
    if shortlist_entries:
        selected_type = shortlist_entries[-1].get('selection_type')

    return {
        'id': resume.id,
        'full_name': parsed.get('full_name') or _format_name_from_filename(resume.file_name),
        'email': parsed.get('email'),
        'phone': parsed.get('phone'),
        'location': parsed.get('location'),
        'skills': skills,
        'total_experience': parsed.get('total_experience'),
        'education': parsed.get('education'),
        'matched_roles': role_titles,
        'is_shortlisted': len(shortlist_entries) > 0,
        'selected_type': selected_type,
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
    """
    Returns candidate-like records backed by uploaded resumes.
    """
    resumes = await db.resume.find_many(
        where={'uploaded_by': current_user.id},
        include={'analyses': {'include': {'job': True}}},
        order={'created_at': 'desc'}
    )

    if role_id:
        filtered = []
        for resume in resumes:
            analyses = getattr(resume, 'analyses', None) or []
            parsed = _safe_dict(getattr(resume, 'parsed_data', None))
            shortlist_entries = _extract_shortlist_entries(parsed)
            has_role_match = any(
                getattr(analysis, 'job_id', None) == role_id or
                (getattr(getattr(analysis, 'job', None), 'id', None) == role_id)
                for analysis in analyses
            )
            has_shortlist_role_match = any(entry.get('role_id') == role_id for entry in shortlist_entries)
            if has_role_match or has_shortlist_role_match:
                filtered.append(resume)
        resumes = filtered

    if shortlisted is True:
        resumes = [
            resume
            for resume in resumes
            if len(_extract_shortlist_entries(_safe_dict(getattr(resume, 'parsed_data', None)))) > 0
        ]

    return [_resume_to_candidate_payload(resume) for resume in resumes]

@router.get("/{candidate_id}")
async def get_candidate(
    candidate_id: str,
    current_user=Depends(get_current_user),
    db: Prisma = Depends(get_db)
):
    """
    Returns specific candidate details.
    """
    resume = await db.resume.find_first(
        where={
            'id': candidate_id,
            'uploaded_by': current_user.id,
        },
        include={'analyses': {'include': {'job': True}}},
    )
    if not resume:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return _resume_to_candidate_payload(resume)


@router.post("/{candidate_id}/shortlist")
async def shortlist_candidate(
    candidate_id: str,
    payload: Dict[str, Any] = Body(default={}),
    current_user=Depends(get_current_user),
    db: Prisma = Depends(get_db),
):
    resume = await db.resume.find_first(
        where={
            'id': candidate_id,
            'uploaded_by': current_user.id,
        }
    )
    if not resume:
        raise HTTPException(status_code=404, detail="Candidate not found")

    role_id = str(payload.get('role_id') or '').strip()
    if not role_id:
        raise HTTPException(status_code=400, detail='role_id is required')

    role = await db.jobrole.find_unique(where={'id': role_id})
    if not role:
        raise HTTPException(status_code=404, detail='Role not found')

    parsed = _safe_dict(getattr(resume, 'parsed_data', None))
    shortlist_entries = _extract_shortlist_entries(parsed)
    shortlist_entries = [entry for entry in shortlist_entries if entry.get('role_id') != role_id]

    selection_type = str(payload.get('selection_type') or 'select').strip().lower()
    if selection_type not in {'select', 'final_select'}:
        selection_type = 'select'

    shortlist_entries.append(
        {
            'role_id': role_id,
            'role_title': role.title,
            'selected_by': current_user.id,
            'selection_type': selection_type,
            'created_at': datetime.utcnow().isoformat(),
        }
    )

    parsed['shortlist'] = {'entries': shortlist_entries}

    await db.resume.update(
        where={'id': candidate_id},
        data={'parsed_data': Json(parsed)},
    )

    return {'status': 'ok', 'candidate_id': candidate_id, 'is_shortlisted': True, 'selection_type': selection_type}


@router.delete("/{candidate_id}/shortlist")
async def unshortlist_candidate(
    candidate_id: str,
    role_id: str | None = Query(default=None),
    current_user=Depends(get_current_user),
    db: Prisma = Depends(get_db),
):
    resume = await db.resume.find_first(
        where={
            'id': candidate_id,
            'uploaded_by': current_user.id,
        }
    )
    if not resume:
        raise HTTPException(status_code=404, detail='Candidate not found')

    parsed = _safe_dict(getattr(resume, 'parsed_data', None))
    shortlist_entries = _extract_shortlist_entries(parsed)

    if role_id:
        shortlist_entries = [entry for entry in shortlist_entries if entry.get('role_id') != role_id]
    else:
        shortlist_entries = []

    parsed['shortlist'] = {'entries': shortlist_entries}

    await db.resume.update(
        where={'id': candidate_id},
        data={'parsed_data': Json(parsed)},
    )

    return {'status': 'ok', 'candidate_id': candidate_id, 'is_shortlisted': len(shortlist_entries) > 0}
