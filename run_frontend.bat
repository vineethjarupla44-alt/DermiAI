@echo off
title DermiAI Frontend Client (Vite)
cd /d "%~dp0Frontend"
echo ========================================================
echo   Starting DermiAI Frontend on http://localhost:5173 ...
echo ========================================================
call npm run dev
pause
