@echo off
title Recaller - Active Recall Self-Testing

echo ==================================================
echo  Recaller - Active Recall Self-Testing
echo ==================================================
echo.

cd /d "%~dp0"

where python >nul 2>nul
if %ERRORLEVEL% equ 0 (
    set "PYTHON_CMD=python"
) else (
    where py >nul 2>nul
    if %ERRORLEVEL% equ 0 (
        set "PYTHON_CMD=py"
    ) else (
        echo [ERROR] Python 3 not found in PATH. Please install Python 3.
        pause
        exit /b 1
    )
)

%PYTHON_CMD% --version

if not exist ".venv" (
    echo [INFO] Creating virtual environment .venv...
    %PYTHON_CMD% -m venv .venv
)

if exist ".venv\Scripts\activate.bat" (
    call .venv\Scripts\activate.bat
)

python -c "import fastapi, uvicorn" 2>nul
if %ERRORLEVEL% neq 0 (
    echo [INFO] Installing dependencies from requirements.txt...
    python -m pip install --upgrade pip --quiet 2>nul
    python -m pip install -r requirements.txt
)

echo.
echo ==================================================
echo [SUCCESS] Starting Recaller server...
echo [INFO] Open in browser: http://localhost:8000
echo ==================================================
echo.

python server.py
pause
