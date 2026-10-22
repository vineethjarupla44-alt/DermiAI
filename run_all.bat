@echo off
title DermiAI Launcher
echo ========================================================
echo   Launching DermiAI Full Stack Application ...
echo ========================================================
start "DermiAI Backend (:8000)" cmd /k call "%~dp0run_backend.bat"
timeout /t 3 /nobreak >nul
start "DermiAI Frontend (:5173)" cmd /k call "%~dp0run_frontend.bat"
echo.
echo Both servers have been launched in separate windows!
echo - Backend:  http://localhost:8000
echo - Frontend: http://localhost:5173
echo.
pause
