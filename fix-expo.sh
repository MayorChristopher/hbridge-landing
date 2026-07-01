#!/bin/bash

echo "🔧 Hbridge Development Server Fix Script"
echo "========================================"

echo "1. Clearing Metro cache..."
npx expo start --clear &
sleep 2
pkill -f "expo start" 2>/dev/null

echo "2. Clearing npm cache..."
npm cache clean --force

echo "3. Clearing Expo cache..."
npx expo install --fix

echo "4. Checking network connectivity..."
ping -c 1 8.8.8.8 > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Internet connection: OK"
else
    echo "❌ Internet connection: FAILED"
    echo "Please check your internet connection"
fi

echo "5. Checking Expo CLI version..."
npx expo --version

echo "6. Starting development server with tunnel mode..."
echo "This should work even with network restrictions"
npx expo start --tunnel --clear

echo ""
echo "🎯 If issues persist:"
echo "- Try using mobile hotspot"
echo "- Check Windows Firewall settings"
echo "- Restart your router/modem"
echo "- Use 'npx expo start --localhost' for local-only development"