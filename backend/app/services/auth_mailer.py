import asyncio
import logging
import os
import re
import smtplib
from datetime import datetime, timezone
from email.message import EmailMessage

logger = logging.getLogger(__name__)


def _env_flag(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _send_auth_activity_email_sync(*, to_email: str, full_name: str | None, event_type: str) -> None:
    enabled = _env_flag("AUTH_EMAIL_NOTIFICATIONS_ENABLED", default=False)
    logger.info(f"[Email] AUTH_EMAIL_NOTIFICATIONS_ENABLED = {enabled}")
    
    if not enabled:
        logger.info("[Email] Email notifications disabled, skipping send.")
        return

    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com").strip()
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_username = os.getenv("SMTP_USERNAME", "").strip()
    smtp_password = os.getenv("SMTP_PASSWORD", "").strip()
    from_email = os.getenv("SMTP_FROM_EMAIL", smtp_username).strip()
    from_name = os.getenv("SMTP_FROM_NAME", "AI HR Copilot").strip()

    logger.info(f"[Email] SMTP config: host={smtp_host}, port={smtp_port}, username={smtp_username if smtp_username else 'EMPTY'}")

    if not smtp_username or not smtp_password or not from_email:
        logger.error("[Email] SMTP credentials missing: username, password, or from_email is empty")
        return

    event_label = "Registration" if event_type == "register" else "Login"
    display_name = (full_name or "there").strip() or "there"
    current_time = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

    logger.info(f"[Email] Preparing {event_label.lower()} email for {to_email}")

    message = EmailMessage()
    message["Subject"] = f"{event_label} alert - AI HR Copilot"
    message["From"] = f"{from_name} <{from_email}>"
    message["To"] = to_email
    message.set_content(
        f"Hello {display_name},\n\n"
        f"This is a confirmation of a recent {event_label.lower()} on AI HR Copilot.\n"
        f"Time: {current_time}\n"
        f"Account: {to_email}\n\n"
        "If this was not you, please secure your Google account immediately.\n\n"
        "- AI HR Copilot"
    )

    logger.info(f"[Email] Attempting SMTP connection to {smtp_host}:{smtp_port}")
    with smtplib.SMTP(smtp_host, smtp_port, timeout=20) as server:
        logger.info("[Email] SMTP connection established, starting TLS")
        server.starttls()
        logger.info("[Email] TLS started, logging in")
        server.login(smtp_username, smtp_password)
        logger.info("[Email] Login successful, sending message")
        server.send_message(message)
    
    logger.info(f"[Email] Successfully sent {event_label.lower()} email to {to_email}")


async def send_auth_activity_email(*, to_email: str, full_name: str | None, event_type: str) -> None:
    try:
        logger.info(f"[Email] Starting async email send for {event_type} event")
        await asyncio.to_thread(
            _send_auth_activity_email_sync,
            to_email=to_email,
            full_name=full_name,
            event_type=event_type,
        )
        logger.info("[Email] Async email send completed successfully")
    except Exception as exc:
        logger.error(f"[Email] Failed to send auth activity email: {exc}", exc_info=True)


def _looks_like_email(value: str) -> bool:
    return bool(re.match(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$", (value or "").strip()))


def _send_candidate_selection_email_sync(*, to_email: str, full_name: str | None, role_title: str, selection_type: str) -> bool:
    enabled = _env_flag("CANDIDATE_SELECTION_EMAIL_ENABLED", default=False)
    logger.info(f"[Email] CANDIDATE_SELECTION_EMAIL_ENABLED = {enabled}")
    if not enabled:
        logger.info("[Email] Candidate selection email disabled, skipping send.")
        return False

    if not _looks_like_email(to_email):
        logger.warning("[Email] Candidate selection email skipped due to invalid recipient email format")
        return False

    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com").strip()
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_username = os.getenv("SMTP_USERNAME", "").strip()
    smtp_password = os.getenv("SMTP_PASSWORD", "").strip()
    from_email = os.getenv("SMTP_FROM_EMAIL", smtp_username).strip()
    from_name = os.getenv("SMTP_FROM_NAME", "AI HR Copilot").strip()

    if not smtp_username or not smtp_password or not from_email:
        logger.error("[Email] SMTP credentials missing: username, password, or from_email is empty")
        return False

    selection_label = "Final Select" if selection_type == "final_select" else "Selected"
    display_name = (full_name or "Candidate").strip() or "Candidate"

    message = EmailMessage()
    message["Subject"] = f"Update on your application for {role_title}"
    message["From"] = f"{from_name} <{from_email}>"
    message["To"] = to_email
    message.set_content(
        f"Hello {display_name},\n\n"
        f"Your profile has been marked as '{selection_label}' for the role '{role_title}'.\n"
        "Our hiring team may contact you with next steps.\n\n"
        "Thank you for your interest.\n\n"
        "- AI HR Copilot"
    )

    with smtplib.SMTP(smtp_host, smtp_port, timeout=20) as server:
        server.starttls()
        server.login(smtp_username, smtp_password)
        server.send_message(message)

    logger.info(f"[Email] Candidate selection email sent to {to_email}")
    return True


async def send_candidate_selection_email(*, to_email: str, full_name: str | None, role_title: str, selection_type: str) -> bool:
    try:
        sent = await asyncio.to_thread(
            _send_candidate_selection_email_sync,
            to_email=to_email,
            full_name=full_name,
            role_title=role_title,
            selection_type=selection_type,
        )
        return bool(sent)
    except Exception as exc:
        logger.error(f"[Email] Failed to send candidate selection email: {exc}", exc_info=True)
        return False
