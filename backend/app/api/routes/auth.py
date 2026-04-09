from fastapi import APIRouter, Depends, HTTPException, status
from app.api.dependencies import get_current_user
from app.db.session import get_db
from app.schemas.api import GoogleLoginRequest
from app.core.security import create_access_token
from google.oauth2 import id_token
from google.auth.transport import requests
from prisma import Prisma
import os

router = APIRouter()
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")


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
    try:
        # 1. Verify ID Token
        # Using Google's library to verify the integrity and clock skew
        idinfo = id_token.verify_oauth2_token(
            request.id_token, 
            requests.Request(), 
            GOOGLE_CLIENT_ID
        )

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
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Google token")
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Authentication error: {str(e)}")
