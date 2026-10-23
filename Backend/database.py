from __future__ import annotations

import os
import sys
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text, create_engine, text
from sqlalchemy.orm import Session, declarative_base, relationship, sessionmaker

# Ensure clean UTF-8 terminal logging on Windows
if sys.platform == "win32":
    try:
        if sys.stdout and hasattr(sys.stdout, "reconfigure"):
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        if sys.stderr and hasattr(sys.stderr, "reconfigure"):
            sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent
SQLITE_URL = f"sqlite:///{(BASE_DIR / 'skin_diagnosis.db').as_posix()}"

raw_db_url = os.getenv("DATABASE_URL", "").strip()
if raw_db_url.startswith("postgres://"):
    raw_db_url = raw_db_url.replace("postgres://", "postgresql://", 1)

# Check if the URL is a placeholder or empty
is_placeholder = (
    not raw_db_url
    or "user:pass@db.supabase.co" in raw_db_url
    or "your_password" in raw_db_url
)

target_url = SQLITE_URL if is_placeholder else raw_db_url
engine_kwargs = {}

if target_url.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    # Set a connection timeout for PostgreSQL so startup doesn't hang if Supabase is offline
    engine_kwargs["connect_args"] = {"connect_timeout": 5}

try:
    engine = create_engine(target_url, **engine_kwargs)
    # Quick probe to test connection validity
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    ACTIVE_DATABASE_URL = target_url
except Exception as conn_err:
    print(f"⚠️ Remote PostgreSQL unavailable ({conn_err}). Falling back to local SQLite database.")
    ACTIVE_DATABASE_URL = SQLITE_URL
    engine = create_engine(ACTIVE_DATABASE_URL, connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    google_id = Column(String(255), unique=True, index=True, nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(50), unique=True, index=True, nullable=True)
    display_name = Column(String(255), nullable=True)
    phone_number = Column(String(20), nullable=True)
    bio = Column(Text, nullable=True)
    photo_url = Column(Text, nullable=True)
    first_login = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    scans = relationship("ScanHistory", back_populates="user", cascade="all, delete-orphan")


class ScanHistory(Base):
    __tablename__ = "scan_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    original_url = Column(String(255), nullable=False)
    heatmap_url = Column(String(255), nullable=False)
    saliency_url = Column(String(255), nullable=True)
    prediction = Column(String(32), nullable=False)
    prediction_name = Column(String(128), nullable=False)
    confidence = Column(Float, nullable=False)
    risk = Column(String(32), nullable=False)
    risk_level = Column(String(32), nullable=False)
    top3 = Column(Text, nullable=False)
    explanation = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    user = relationship("User", back_populates="scans")


def get_db():
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables() -> None:
    try:
        Base.metadata.create_all(bind=engine)
        db_type = "SQLite" if ACTIVE_DATABASE_URL.startswith("sqlite") else "PostgreSQL (Supabase)"
        print(f"✅ Database tables verified/created successfully on {db_type}.")
    except Exception as e:
        print(f"⚠️ DATABASE ERROR ON STARTUP: {e}")
