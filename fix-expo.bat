@echo off
echo 🔧 Hbridge Development Server Fix Script
echo ========================================

echo 1. Stopping any running Expo processes...
taskkill /f /im node.exe 2>nul
timeout /t 2 >nul

echo 2. Clearing Metro cache...
call npx expo start --clear --reset-cache
timeout /t 3 >nul
taskkill /f /im node.exe 2>nul

echo 3. Clearing npm cache...
call npm cache clean --force

echo 4. Checking network connectivity...
ping -n 1 8.8.8.8 >nul 2>&1
if %errorlevel% == 0 (
    echo ✅ Internet connection: OK
) else (
    echo ❌ Internet connection: FAILED
    echo Please check your internet connection
)

echo 5. Checking Expo CLI version...
call npx expo --version

echo 6. Starting development server with tunnel mode...
echo This should work even with network restrictions
call npx expo start --tunnel --clear

echo.
echo 🎯 If issues persist:
echo - Try using mobile hotspot
echo - Check Windows Firewall settings  
echo - Restart your router/modem
echo - Use 'npx expo start --localhost' for local-only development
pause