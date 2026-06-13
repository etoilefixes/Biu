@echo off
setlocal enabledelayedexpansion
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

:: 检查端口 3000
set "PORT3000_PID="
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000 " ^| findstr "LISTENING"') do (
    set "PORT3000_PID=%%a"
)

if defined PORT3000_PID (
    echo  [!] Port 3000 is occupied by PID %PORT3000_PID%
    set /p "RELEASE3000=  Release port 3000? (Y/N): "
    if /i "!RELEASE3000!"=="Y" (
        taskkill /F /PID %PORT3000_PID% >nul 2>&1
        echo  Port 3000 released.
    ) else (
        echo  Skipped releasing port 3000.
    )
    echo.
)

:: 检查端口 5173
set "PORT5173_PID="
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173 " ^| findstr "LISTENING"') do (
    set "PORT5173_PID=%%a"
)

if defined PORT5173_PID (
    echo  [!] Port 5173 is occupied by PID %PORT5173_PID%
    set /p "RELEASE5173=  Release port 5173? (Y/N): "
    if /i "!RELEASE5173!"=="Y" (
        taskkill /F /PID %PORT5173_PID% >nul 2>&1
        echo  Port 5173 released.
    ) else (
        echo  Skipped releasing port 5173.
    )
    echo.
)

echo  [1/2] Starting backend (port 3000)...
start "Biu-Backend" cmd /k "cd /d "%ROOT%\server" && npm run dev"

echo  Waiting 3s for backend...
timeout /t 3 /nobreak >nul

echo  [2/2] Starting frontend (port 5173)...
start "Biu-Frontend" cmd /k "cd /d "%ROOT%\client" && npm run dev"

echo.
echo  Backend : http://localhost:3000
echo  Frontend: http://localhost:5173
echo.

timeout /t 2 /nobreak >nul
start "" "http://localhost:5173"

echo  Press any key to close launcher...
pause >nul
