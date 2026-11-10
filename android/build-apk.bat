@echo off
setlocal
echo ==========================================
echo    EngVocab APK Builder for Windows
echo ==========================================

java -version >nul 2>&1
if %errorlevel% neq 0 (
    echo [LOI] Khong tim thay Java!
    echo Vui long cai dat OpenJDK 17 bang cach mo PowerShell va chay:
    echo    winget install Microsoft.OpenJDK.17
    echo Sau do khoi dong lai VS Code va thu lai.
    pause
    exit /b 1
)

if "%ANDROID_HOME%"=="" (
    if exist "%LOCALAPPDATA%\Android\Sdk" (
        set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
    )
)

echo Dang dong bo assets web vao Android...
cd /d "%~dp0"
if not exist "app\src\main\assets" mkdir "app\src\main\assets"
xcopy /E /I /Y "..\index.html" "app\src\main\assets\" >nul
xcopy /E /I /Y "..\detail.html" "app\src\main\assets\" >nul
xcopy /E /I /Y "..\style.css" "app\src\main\assets\" >nul
xcopy /E /I /Y "..\fonts.css" "app\src\main\assets\" >nul
xcopy /E /I /Y "..\manifest.json" "app\src\main\assets\" >nul
xcopy /E /I /Y "..\sw.js" "app\src\main\assets\" >nul
xcopy /E /I /Y "..\js" "app\src\main\assets\js\" >nul
xcopy /E /I /Y "..\img" "app\src\main\assets\img\" >nul
xcopy /E /I /Y "..\fonts" "app\src\main\assets\fonts\" >nul

echo Dang build APK bang Gradle...
gradle assembleDebug
if %errorlevel% neq 0 (
    echo [LOI] Build that bai. Kiem tra log o tren.
    pause
    exit /b 1
)

echo.
echo ==========================================
echo    BUILD THANH CONG!
echo ==========================================
echo File APK nam tai:
echo    %~dp0app\build\outputs\apk\debug\app-debug.apk
echo.
explorer "%~dp0app\build\outputs\apk\debug"
