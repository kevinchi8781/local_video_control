@echo off
chcp 65001 >nul
title YNXX - Starting...

echo ========================================
echo          YNXX - Starting
echo ========================================
echo.

cd /d "%~dp0"

REM Check backend dependencies
if not exist "server\node_modules" (
    echo [1/4] Installing backend dependencies...
    cd server
    call npm install
    cd ..
) else (
    echo [1/4] Backend dependencies already installed
)

REM Check frontend dependencies
if not exist "client\node_modules" (
    echo [2/4] Installing frontend dependencies...
    cd client
    call npm install
    cd ..
) else (
    echo [2/4] Frontend dependencies already installed
)

REM Initialize database if needed
if not exist "server\data\videos.db" (
    echo [3/4] Initializing database...
    cd server
    call npm run init-db
    cd ..
) else (
    echo [3/4] Database already exists
)

echo [4/4] Starting services...
echo.
echo ========================================
echo  Backend: http://localhost:3001
echo  Frontend: http://localhost:5173
echo ========================================
echo.
echo Press Ctrl+C to stop services
echo.

REM Start backend in new window
start "YNXX - Backend" cmd /k "cd /d "%~dp0server" && npm run dev"

REM Wait for backend to start
timeout /t 5 /nobreak >nul

REM Start frontend in new window
start "YNXX - Frontend" cmd /k "cd /d "%~dp0client" && npm run dev"

REM Wait for frontend to start then open browser
timeout /t 8 /nobreak >nul
start http://localhost:5173

echo Browser opened. Enjoy!
echo.
