from fastapi import APIRouter, Depends, HTTPException, status
from app.api.dependencies import get_current_user
from app.db.session import get_db
from app.schemas.api import GoogleLoginRequest
from app.core.security import create_access_token
from google.oauth2 import id_token
from google.auth.transport import requests
from app.db.prisma_client import Prisma
import os

router = APIRouter()


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
        # 1. Verify ID Token
        # Using Google's library to verify the integrity and clock skew
        idinfo = id_token.verify_oauth2_token(
            request.id_token,
            requests.Request(),
            None,
        )

        token_aud = idinfo.get("aud")
        token_azp = idinfo.get("azp")
        if token_aud not in google_client_ids and token_azp not in google_client_ids:
            raise ValueError("google_client_id_mismatch")

        # ID token is valid. Get the user's Google Account ID from the decoded token.
        email = idinfo['email']
        full_name = idinfo.get('name')
        avatar_url = idinfo.get('picture')
        google_id = idinfo.get('sub')

        # 2. Upsert User in Database
        user = await db.user.find_unique(where={'email': email})
        if not user:
            user = await db.user.create(
                data={
                    "email": email,
                    "full_name": full_name,
                    "avatar_url": avatar_url,
                    "google_id": google_id
                }
            )
        else:
            # Update user information from the latest Google profile
            user = await db.user.update(
                where={'email': email},
                data={
                    "full_name": full_name,
                    "avatar_url": avatar_url,
                    "google_id": google_id
                }
            )

        # 3. Create real JWT Access Token
        access_token = create_access_token(subject=user.id)

        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": user
        }
    except ValueError:
        # Invalid token
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google token or client ID mismatch",
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Authentication error: {str(e)}")
