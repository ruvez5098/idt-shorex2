@echo off
REM Quick start script for SHOREX Plastic Detection (Windows)

echo.
echo 🚀 SHOREX - Plastic Detection Setup
echo ==========================================
echo.

REM Check Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Node.js not found. Please install from https://nodejs.org
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo ✅ Node.js found: %NODE_VERSION%

REM Check npm
where npm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ npm not found. Please install Node.js
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i
echo ✅ npm found: v%NPM_VERSION%

REM Install Node dependencies
echo.
echo 📦 Installing Node dependencies...
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Failed to install Node dependencies
    pause
    exit /b 1
)

REM Check Python
where python >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ⚠️  Python not found. ML model training will not work.
    echo    Install from https://python.org to train custom models
    echo.
    echo Skipping Python setup...
) else (
    for /f "tokens=*" %%i in ('python --version') do set PYTHON_VERSION=%%i
    echo ✅ Python found: %PYTHON_VERSION%
    
    REM Install Python dependencies
    echo.
    echo 📦 Installing Python dependencies...
    call pip install -r requirements.txt
    
    REM Create models directory
    if not exist "public\models" mkdir public\models
    
    REM Ask about training
    echo.
    echo Would you like to train the AI model now? (y/n)
    set /p TRAIN_CHOICE=
    if /i "%TRAIN_CHOICE%"=="y" (
        echo 🤖 Training plastic detection model...
        call python train_plastic_model.py --epochs 10
    ) else (
        echo ⏭️  Skipping model training. You can train later with:
        echo    python train_plastic_model.py --epochs 50
    )
)

REM Create public/models directory
if not exist "public\models" mkdir public\models

echo.
echo ✅ Setup complete!
echo.
echo 📚 Next steps:
echo 1. Start frontend:  npm run dev
echo 2. Start backend:   npm run server
echo 3. Or both:         npm run dev:all
echo.
echo 🌐 Access the app at: http://localhost:3000
echo.
echo 📖 For more info, see: PLASTIC_DETECTION_SETUP.md
echo.
pause
