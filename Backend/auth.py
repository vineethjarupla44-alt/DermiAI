from __future__ import annotations

import json
import os
import re
import random
import string
from pathlib import Path
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
import firebase_admin
from firebase_admin import auth as firebase_auth
from firebase_admin import credentials

from database import User, get_db
from email_service import send_welcome_email

# Initialize Firebase Admin SDK
BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

cred_path_or_json = os.getenv("FIREBASE_CREDENTIALS")
if not cred_path_or_json and (BASE_DIR / "firebase-service-account.json").exists():
    cred_path_or_json = str(BASE_DIR / "firebase-service-account.json")

if not firebase_admin._apps:
    if cred_path_or_json:
        try:
            # If FIREBASE_CREDENTIALS contains JSON directly
            cred_dict = json.loads(cred_path_or_json)
            cred = credentials.Certificate(cred_dict)
        except json.JSONDecodeError:
            # If FIREBASE_CREDENTIALS contains a file path
            cred_path = Path(cred_path_or_json)

            if not cred_path.is_absolute():
                cred_path = BASE_DIR / cred_path

            if cred_path.exists():
                cred = credentials.Certificate(str(cred_path))
                firebase_admin.initialize_app(cred)
                print("🔐 Firebase Admin SDK initialized successfully.")
            else:
                print(f"⚠️ Firebase credentials file not found at {cred_path}")
        else:
            firebase_admin.initialize_app(cred)
            print("🔐 Firebase Admin SDK initialized successfully from JSON.")
    else:
        print("WARNING: FIREBASE_CREDENTIALS not set. Auth will fail.")

bearer_scheme = HTTPBearer(auto_error=False)


def _generate_unique_username(base_name: str, db: Session) -> str:
    """Slugify a display name and ensure it is unique in the DB."""
    # Lowercase, keep letters/numbers, replace spaces/special chars with underscores
    slug = re.sub(r'[^a-z0-9]', '_', base_name.lower().strip())
    slug = re.sub(r'_+', '_', slug).strip('_')[:30] or 'user'
    candidate = slug
    while db.query(User).filter(User.username == candidate).first():
        suffix = ''.join(random.choices(string.digits, k=4))
        candidate = f"{slug}_{suffix}"
    return candidate


def _resolve_user(token: str, db: Session) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token.",
    )
    
    if not firebase_admin._apps:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Firebase Admin SDK not initialized."
        )

    try:
        decoded_token = firebase_auth.verify_id_token(token, clock_skew_seconds=60)
        google_id = decoded_token.get("uid")
        email = decoded_token.get("email")
        display_name = decoded_token.get("name", "User")
        photo_url = decoded_token.get("picture", "")

        if not google_id or not email:
            raise credentials_exception
            
    except Exception as exc:
        print(f"Token verification failed: {exc}")
        raise credentials_exception

    # Find or Create User by google_id or email
    user = db.query(User).filter(
        (User.google_id == google_id) | (User.email == email)
    ).first()
    
    if not user:
        try:
            # Create user
            user = User(
                google_id=google_id,
                email=email,
                display_name=display_name,
                username=_generate_unique_username(display_name, db),
                photo_url=photo_url,
                first_login=True
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            
            # Send welcome email asynchronously or synchronously
            send_welcome_email(user.email, user.display_name.split()[0] if user.display_name else "User")
            
            # Update first_login so we don't send it again
            user.first_login = False
            db.commit()
            db.refresh(user)
        except Exception as e:
            db.rollback()
            # If a collision or race condition occurred, look up the existing record
            user = db.query(User).filter(
                (User.google_id == google_id) | (User.email == email)
            ).first()
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Failed to create user record: {e}"
                )
    else:
        # User already exists - sync changes from Google to DB
        needs_update = False
        if user.google_id != google_id:
            user.google_id = google_id
            needs_update = True
        if not user.display_name and display_name:
            user.display_name = display_name
            needs_update = True
        if photo_url and user.photo_url != photo_url:
            user.photo_url = photo_url
            needs_update = True
        if needs_update:
            try:
                db.commit()
                db.refresh(user)
            except Exception:
                db.rollback()

    return user


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if creds is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")
    return _resolve_user(creds.credentials, db)


def get_optional_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User | None:
    if creds is None:
        return None
    try:
        return _resolve_user(creds.credentials, db)
    except Exception as e:
        print(f"⚠️ Optional user auth skipped: {e}")
        return None
