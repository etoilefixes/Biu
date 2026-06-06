@echo off
title Biu Launcher

set "ROOT=%~dp0"
set "ROOT=%ROOT:~0,-1%"

echo.
echo  ============================================
echo   Biu - One Click Start
echo  ============================================
echo.

if not exist "%ROOT%\server" (
    echo  [ERROR] server directory not found
    pause & exit /b 1
)
if not exist "%ROOT%\client" (
    echo  [ERROR] client directory not found
    pause & exit /b 1
)

echo  [1/2] Starting backend (port 3001)...
start "Biu-Backend" cmd /k "cd /d "%ROOT%\server" && npm run dev"

echo  Waiting 3s for backend...
timeout /t 3 /nobreak >nul

echo  [2/2] Starting frontend (port 5173)...
start "Biu-Frontend" cmd /k "cd /d "%ROOT%\client" && npm run dev"

echo.
echo  Backend : http://localhost:3001
echo  Frontend: http://localhost:5173
echo.

timeout /t 2 /nobreak >nul
start "" "http://localhost:5173"

echo  Press any key to close launcher...
pause >nul