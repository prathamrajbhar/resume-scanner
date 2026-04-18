from fastapi import APIRouter, Body, Depends, HTTPException, Query
from app.api.dependencies import get_current_user
from app.db.session import get_db
from app.db.prisma_client import Prisma
from typing import Any, Dict, List
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


def _safe_list_of_strings(value: Any) -> List[str]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, str)]


def _safe_list_of_dicts(value: Any) -> List[Dict[str, Any]]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, dict)]


def _merge_wrapped_list_items(items: List[str], max_len: int = 260) -> List[str]:
    merged: List[str] = []
    for raw in items:
        line = re.sub(r'\s+', ' ', str(raw or '').strip())
        line = re.sub(r'^\s*(?:[-*\u2022]|\d+[\.)]|[A-Za-z][\.)])\s*', '', line).strip()
        if not line:
            continue

        if not merged:
            merged.append(line)
            continue

        previous = merged[-1]
        previous_has_open_paren = previous.count('(') > previous.count(')')
        previous_ends_sentence = bool(re.search(r'[.!?;:]\s*$', previous))
        looks_like_continuation = previous_has_open_paren or not previous_ends_sentence

        if looks_like_continuation and len(previous) + len(line) + 1 <= max_len:
            merged[-1] = f"{previous} {line}".strip()
        else:
            merged.append(line)

    deduped: List[str] = []
    seen: set[str] = set()
    for item in merged:
        key = item.lower()
        if key in seen:
            continue
        seen.add(key)
        deduped.append(item)

    return deduped


def _looks_like_education_entry(value: str) -> bool:
    lowered = (value or '').lower()
    return bool(
        re.search(r'\b(mba|master|bachelor|m\.?\s*sc|b\.?\s*sc|m\.?\s*tech|b\.?\s*tech|phd|doctorate|cgpa|sgpa)\b', lowered)
        or re.search(r'\b(university|college|institute)\b', lowered)
    )


def _looks_like_award_entry(value: str) -> bool:
    lowered = (value or '').lower()
    return bool(re.search(r'\b(award|awarded|winner|won|recognition|honou?r|achievement|accomplishment|medal|rank)\b', lowered))


def _needs_degree_enrichment(degrees: List[Dict[str, Any]]) -> bool:
    if not degrees:
        return True

    return any(
        not isinstance(item.get('college'), str) or not item.get('college', '').strip()
        for item in degrees
    )


def _merge_degree_details(
    base_degrees: List[Dict[str, Any]],
    fallback_degrees: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    if not base_degrees:
        return fallback_degrees

    if not fallback_degrees:
        return base_degrees

    fallback_by_name: Dict[str, Dict[str, Any]] = {}
    for item in fallback_degrees:
        name_key = _normalize_for_match(str(item.get('degree') or ''))
        if name_key and name_key not in fallback_by_name:
            fallback_by_name[name_key] = item

    merged: List[Dict[str, Any]] = []
    for degree in base_degrees:
        name_key = _normalize_for_match(str(degree.get('degree') or ''))
        fallback = fallback_by_name.get(name_key, {})
        merged.append(
            {
                **degree,
                'college': degree.get('college') or fallback.get('college'),
                'location': degree.get('location') or fallback.get('location'),
            }
        )

    return merged


def _normalize_for_match(value: str) -> str:
    return re.sub(r'\s+', ' ', re.sub(r'[^a-z0-9\s]', ' ', (value or '').lower())).strip()


def _extract_degree_college_location_from_text(resume_text: str, degree_name: str) -> tuple[str | None, str | None]:
    lines = [line.strip() for line in (resume_text or '').splitlines() if line and line.strip()]
    if not lines or not degree_name:
        return None, None

    degree_key = _normalize_for_match(degree_name)
    if not degree_key:
        return None, None

    target_idx = -1
    for idx, line in enumerate(lines):
        if degree_key in _normalize_for_match(line):
            target_idx = idx
            break

    if target_idx == -1:
        return None, None

    college: str | None = None
    location: str | None = None
    college_pattern = re.compile(r'([A-Z][A-Za-z\s&\-.]{3,}(?:University|Institute|College)(?:,\s*University\s+of\s+[A-Za-z\s]+)?)')
    location_pattern = re.compile(r'([A-Z][A-Za-z\s]+,\s*[A-Z][A-Za-z\s]+)')

    window = lines[target_idx: target_idx + 7]
    for line in window:
        normalized_line = _normalize_for_match(line)
        if normalized_line and (degree_key not in normalized_line) and re.search(r'\b(master|bachelor|mba|m sc|b sc|m tech|b tech|phd|doctorate)\b', normalized_line):
            # Stop when next education entry starts.
            break

        if not college:
            college_match = college_pattern.search(line)
            if college_match:
                college = college_match.group(1).strip()

        if '|' in line:
            parts = [part.strip() for part in line.split('|') if part.strip()]
            for part in parts:
                part_lower = part.lower()
                looks_like_college = bool(re.search(r'\b(university|college|institute)\b', part_lower))
                if not college:
                    college_match = college_pattern.search(part)
                    if college_match:
                        college = college_match.group(1).strip()
                        continue

                if not location and not looks_like_college and re.search(r',', part) and len(part.split()) <= 12:
                    location = part

        if not location:
            location_match = location_pattern.search(line)
            if location_match:
                candidate_location = location_match.group(1).strip()
                if not re.search(r'\b(university|college|institute)\b', candidate_location.lower()):
                    location = candidate_location

    return college, location


def _enrich_degrees_from_text(base_degrees: List[Dict[str, Any]], resume_text: str) -> List[Dict[str, Any]]:
    if not base_degrees or not resume_text:
        return base_degrees

    enriched: List[Dict[str, Any]] = []
    for degree in base_degrees:
        degree_name = str(degree.get('degree') or '').strip()
        inferred_college, inferred_location = _extract_degree_college_location_from_text(resume_text, degree_name)

        enriched.append(
            {
                **degree,
                # Prefer degree-specific inference from resume text when available.
                'college': inferred_college or degree.get('college'),
                'location': inferred_location or degree.get('location'),
            }
        )

    return enriched


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
    location = parsed.get('location') if isinstance(parsed.get('location'), str) else None
    content_text = getattr(resume, 'content_text', None)
    fallback_parsed: Dict[str, Any] = {}

    parsed_degrees = _safe_list_of_dicts(parsed.get('degrees'))
    parsed_certifications = _safe_list_of_strings(parsed.get('certifications'))
    parsed_awards = _safe_list_of_strings(parsed.get('awards'))
    parsed_achievements = _safe_list_of_strings(parsed.get('achievements'))

    if isinstance(content_text, str) and content_text.strip():
        certifications_missing = len(parsed_certifications) == 0
        awards_missing = len(parsed_awards) == 0 and len(parsed_achievements) == 0
        needs_structured_fallback = not any(
            [
                len(parsed_degrees) > 0,
                isinstance(parsed.get('experience_list'), list) and len(parsed.get('experience_list')) > 0,
                isinstance(parsed.get('projects'), list) and len(parsed.get('projects')) > 0,
                len(parsed_certifications) > 0,
                len(parsed_awards) > 0,
                len(parsed_achievements) > 0,
            ]
        ) or _needs_degree_enrichment(parsed_degrees) or certifications_missing or awards_missing
        if needs_structured_fallback:
            fallback_parsed = nlp_service.extract_candidate_profile(
                content_text,
                getattr(resume, 'file_name', '') or 'resume',
            )

        if not location or not location.strip():
            location = nlp_service.extract_location(content_text)
        if not skills:
            skills = sorted(list(nlp_service.extract_skills(content_text)))
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

    fallback_degrees = _safe_list_of_dicts(fallback_parsed.get('degrees'))
    merged_degrees = _merge_degree_details(parsed_degrees, fallback_degrees)
    if isinstance(content_text, str) and content_text.strip() and merged_degrees:
        merged_degrees = _enrich_degrees_from_text(merged_degrees, content_text)

    parsed_certifications = _merge_wrapped_list_items(parsed_certifications, max_len=220)
    fallback_certifications = _merge_wrapped_list_items(_safe_list_of_strings(fallback_parsed.get('certifications')), max_len=220)
    combined_certifications: List[str] = []
    certification_seen: set[str] = set()
    awards_from_certifications: List[str] = []
    for item in [*parsed_certifications, *fallback_certifications]:
        lowered = item.lower()
        if _looks_like_award_entry(item):
            if item not in awards_from_certifications:
                awards_from_certifications.append(item)
            continue
        if _looks_like_education_entry(item):
            continue
        if lowered in certification_seen:
            continue
        certification_seen.add(lowered)
        combined_certifications.append(item)

    fallback_awards = _safe_list_of_strings(fallback_parsed.get('awards'))
    combined_awards: List[str] = []
    for item in _merge_wrapped_list_items([*parsed_awards, *parsed_achievements, *fallback_awards, *awards_from_certifications], max_len=260):
        if item not in combined_awards:
            combined_awards.append(item)

    auto_selected = bool(getattr(resume, 'auto_selected', False))
    selected = bool(getattr(resume, 'selected', False))
    selection_status = str(getattr(resume, 'selection_status', 'rejected') or 'rejected')

    return {
        'id': resume.id,
        'full_name': parsed.get('full_name') or _format_name_from_filename(resume.file_name),
        'email': parsed.get('email'),
        'phone': parsed.get('phone'),
        'location': location,
        'skills': skills,
        'total_experience': parsed.get('total_experience'),
        'total_experience_years': parsed.get('total_experience_years') or parsed.get('total_experience') or fallback_parsed.get('total_experience_years'),
        'education': parsed.get('education'),
        'degrees': merged_degrees,
        'experience_list': _safe_list_of_dicts(parsed.get('experience_list')) or _safe_list_of_dicts(fallback_parsed.get('experience_list')),
        'projects': _safe_list_of_strings(parsed.get('projects')) or _safe_list_of_strings(fallback_parsed.get('projects')),
        'certifications': combined_certifications,
        'awards': combined_awards,
        'soft_skills': _safe_list_of_strings(parsed.get('soft_skills')) or _safe_list_of_strings(fallback_parsed.get('soft_skills')),
        'matched_roles': role_titles,
        'is_shortlisted': len(shortlist_entries) > 0,
        'selected_type': selected_type,
        'auto_selected': auto_selected,
        'selected': selected,
        'selection_status': selection_status,
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
    resumes = [resume for resume in resumes if not bool(getattr(resume, 'is_deleted', False))]

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
    if bool(getattr(resume, 'is_deleted', False)):
        raise HTTPException(status_code=404, detail="Candidate not found")
    return _resume_to_candidate_payload(resume)


@router.delete("/{candidate_id}")
async def delete_candidate(
    candidate_id: str,
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

    # Soft delete by default.
    try:
        await db.resume.update(
            where={'id': candidate_id},
            data={'is_deleted': True},
        )
    except Exception:
        # Fallback for environments where schema is not migrated yet.
        await db.analysis.delete_many(where={'resume_id': candidate_id})
        await db.resume.delete(where={'id': candidate_id})

    return {'message': 'Candidate deleted successfully'}


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
    send_selection_email = bool(payload.get('send_selection_email'))

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

    try:
        await db.resume.update(
            where={'id': candidate_id},
            data={
                'parsed_data': Json(parsed),
                'selected': True,
                'selection_status': 'confirmed' if selection_type == 'final_select' else 'pending',
            },
        )
    except Exception as exc:
        message = str(exc).lower()
        if any(token in message for token in ['unknown argument', 'field does not exist', 'could not find field']):
            await db.resume.update(
                where={'id': candidate_id},
                data={'parsed_data': Json(parsed)},
            )
        else:
            raise

    email_sent = False
    email_status = 'not_requested'
    if send_selection_email:
        email_status = 'missing_email'
        candidate_email = parsed.get('email') if isinstance(parsed.get('email'), str) else None
        candidate_name = parsed.get('full_name') if isinstance(parsed.get('full_name'), str) else None
        if candidate_email and candidate_email.strip():
            normalized_email = candidate_email.strip()
            is_valid_email = bool(re.match(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$", normalized_email))
            if is_valid_email:
                email_sent = await send_candidate_selection_email(
                    to_email=normalized_email,
                    full_name=candidate_name,
                    role_title=role.title,
                    selection_type=selection_type,
                )
                email_status = 'sent' if email_sent else 'skipped'
            else:
                email_status = 'invalid_email'

    return {
        'status': 'ok',
        'candidate_id': candidate_id,
        'is_shortlisted': True,
        'selection_type': selection_type,
        'email_sent': email_sent,
        'email_status': email_status,
    }


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

    try:
        await db.resume.update(
            where={'id': candidate_id},
            data={
                'parsed_data': Json(parsed),
                'selected': False,
                'selection_status': 'rejected',
            },
        )
    except Exception as exc:
        message = str(exc).lower()
        if any(token in message for token in ['unknown argument', 'field does not exist', 'could not find field']):
            await db.resume.update(
                where={'id': candidate_id},
                data={'parsed_data': Json(parsed)},
            )
        else:
            raise

    return {'status': 'ok', 'candidate_id': candidate_id, 'is_shortlisted': len(shortlist_entries) > 0}
