from fastapi import APIRouter, Body, Depends, HTTPException
from app.api.dependencies import get_current_user
from app.services.auth_mailer import send_candidate_selection_email

router = APIRouter()


@router.post("/send-email")
async def send_email(
    payload: dict = Body(default={}),
    current_user=Depends(get_current_user),
):
    candidate_emails = payload.get("candidate_emails") if isinstance(payload.get("candidate_emails"), list) else []
    candidate_emails = [str(item).strip() for item in candidate_emails if isinstance(item, str) and item.strip()]
    if not candidate_emails:
        raise HTTPException(status_code=400, detail="candidate_emails is required")

    job_role = str(payload.get("job_role") or "Interview Process").strip() or "Interview Process"
    template = str(payload.get("template") or "Interview Invitation").strip() or "Interview Invitation"

    unique_emails = list(dict.fromkeys(candidate_emails))

    sent_count = 0
    failed_emails: list[str] = []
    for email in unique_emails:
        ok = await send_candidate_selection_email(
            to_email=email,
            full_name=None,
            role_title=job_role,
            selection_type="final_select",
        )
        if ok:
            sent_count += 1
        else:
            failed_emails.append(email)

    return {
        "status": "ok",
        "requested_by": current_user.id,
        "template": template,
        "sent_count": sent_count,
        "failed_count": len(failed_emails),
        "failed_emails": failed_emails,
    }
