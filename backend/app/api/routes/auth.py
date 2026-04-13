from fastapi import APIRouter, Depends, HTTPException, status
from app.api.dependencies import get_current_user
from app.db.session import get_db
from app.schemas.api import GoogleLoginRequest
from app.core.security import create_access_token
from app.services.auth_mailer import send_auth_activity_email
from google.oauth2 import id_token
from google.auth.transport import requests
from app.db.prisma_client import Prisma
import os

router = APIRouter()
GOOGLE_TOKEN_CLOCK_SKEW_SECONDS = int(os.getenv("GOOGLE_TOKEN_CLOCK_SKEW_SECONDS", "30"))


def _split_client_ids(raw_value: str) -> list[str]:
    ids = []
    for value in raw_value.split(","):
        cleaned = value.strip().strip('"').strip("'")
        if cleaned:
            ids.append(cleaned)
    return ids


def _get_google_client_ids() -> list[str]:
    configured_ids: list[str] = []

    configured_ids.extend(_split_client_ids(os.getenv("GOOGLE_CLIENT_IDS", "")))
    configured_ids.extend(_split_client_ids(os.getenv("GOOGLE_CLIENT_ID", "")))
    configured_ids.extend(_split_client_ids(os.getenv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "")))

    # Preserve order and remove duplicates.
    return list(dict.fromkeys(configured_ids))


def _token_target_matches(idinfo: dict, google_client_ids: list[str]) -> bool:
    aud = idinfo.get("aud")
    azp = idinfo.get("azp")

    aud_values: list[str] = []
    if isinstance(aud, str):
        aud_values = [aud]
    elif isinstance(aud, list):
        aud_values = [value for value in aud if isinstance(value, str)]

    token_targets = set(aud_values)
    if isinstance(azp, str):
        token_targets.add(azp)

    return bool(token_targets.intersection(set(google_client_ids)))


def _verify_google_id_token(token: str, google_client_ids: list[str]) -> dict:
    req = requests.Request()
    last_error: ValueError | None = None

    # Preferred path: verify against each configured audience directly.
    for client_id in google_client_ids:
        try:
            return id_token.verify_oauth2_token(
                token,
                req,
                client_id,
                clock_skew_in_seconds=GOOGLE_TOKEN_CLOCK_SKEW_SECONDS,
            )
        except ValueError as exc:
            last_error = exc

    # Fallback path for tokens where aud/azp combinations differ by OAuth flow.
    try:
        idinfo = id_token.verify_oauth2_token(
            token,
            req,
            None,
            clock_skew_in_seconds=GOOGLE_TOKEN_CLOCK_SKEW_SECONDS,
        )
    except ValueError:
        if last_error:
            raise last_error
        raise

    if not _token_target_matches(idinfo, google_client_ids):
        raise ValueError("google_client_id_mismatch")

    return idinfo


@router.get("/me")
async def me(current_user=Depends(get_current_user)):
    return current_user

@router.post("/google/login")
async def google_login(
    request: GoogleLoginRequest,
    db: Prisma = Depends(get_db)
):
    """
    Verifies Google ID Token and returns an access token plus user profile.
    """
    google_client_ids = _get_google_client_ids()
    if not google_client_ids:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Google OAuth is not configured on the backend (missing GOOGLE_CLIENT_ID).",
        )

    try:
        # 1. Verify ID Token against configured Google OAuth client IDs.
        idinfo = _verify_google_id_token(request.id_token, google_client_ids)

        # ID token is valid. Get the user's Google Account ID from the decoded token.
        email = idinfo['email']
        full_name = idinfo.get('name')
        avatar_url = idinfo.get('picture')
        google_id = idinfo.get('sub')

        # 2. Upsert User in Database
        user = await db.user.find_unique(where={'email': email})
        is_new_user = False
        if not user:
            is_new_user = True
            user = await db.user.create(
                data={
                    "email": email,
                    # Keep profile name empty for first-time onboarding flow.
                    "full_name": None,
                    "avatar_url": avatar_url,
                    "google_id": google_id
                }
            )
        else:
            # Refresh Google identity metadata, but keep HR-managed profile name.
            user = await db.user.update(
                where={'email': email},
                data={
                    "avatar_url": avatar_url,
                    "google_id": google_id
                }
            )

        # 3. Create real JWT Access Token
        access_token = create_access_token(subject=user.id)

        # Send registration confirmation email only for new users
        if is_new_user:
            await send_auth_activity_email(
                to_email=email,
                full_name=user.full_name,
                event_type="register",
            )

        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": user,
            "is_new_user": is_new_user,
        }
    except ValueError as exc:
        # Invalid token
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid Google token or client ID mismatch: {str(exc)}",
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Authentication error: {str(e)}")
