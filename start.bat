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

echo  [0/2] Releasing ports 3001 and 5173...

:: 释放端口 3001
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3001 " ^| findstr "LISTENING"') do (
    echo  Killing PID %%a on port 3001...
    taskkill /F /PID %%a >nul 2>&1
)

:: 释放端口 5173
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173 " ^| findstr "LISTENING"') do (
    echo  Killing PID %%a on port 5173...
    taskkill /F /PID %%a >nul 2>&1
)

echo  Ports released.
echo.

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