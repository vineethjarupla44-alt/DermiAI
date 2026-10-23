@echo off
title DermiAI Backend Server (FastAPI)
cd /d "%~dp0Backend"
set PYTHONUTF8=1
echo ========================================================
echo   Starting DermiAI Backend on http://localhost:8000 ...
echo ========================================================
if exist ".\venv\Scripts\python.exe" (
    .\venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000
) else (
    python -m uvicorn main:app --host 0.0.0.0 --port 8000
)
pause
