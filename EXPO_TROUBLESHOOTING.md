# Expo Development Server Troubleshooting

## 🚨 **Current Error: "TypeError: terminated"**

This error typically occurs due to network connectivity issues during the Expo development process.

## 🔧 **Quick Fixes (Try in Order)**

### **Solution 1: Use Tunnel Mode**
```bash
npx expo start --tunnel --clear
```
This bypasses local network issues by using Expo's tunneling service.

### **Solution 2: Clear All Caches**
```bash
# Stop current process (Ctrl+C), then:
npx expo start --clear --reset-cache
npm cache clean --force
```

### **Solution 3: Use Localhost Mode**
```bash
npx expo start --localhost
```
This restricts to local network only, avoiding external connectivity issues.

### **Solution 4: Offline Mode**
```bash
npx expo start --offline
```
Runs without checking for updates or external dependencies.

## 🎯 **Windows-Specific Solutions**

### **Run the Fix Script**
Double-click `fix-expo.bat` in your project folder, or run:
```cmd
cd "C:\Users\Bobby PC\Desktop\hbridge-app"
fix-expo.bat
```

### **Check Windows Firewall**
1. Open Windows Defender Firewall
2. Click "Allow an app or feature through Windows Defender Firewall"
3. Find "Node.js" and ensure both Private and Public are checked
4. If not listed, click "Allow another app..." and add Node.js

### **Network Adapter Reset**
```cmd
# Run as Administrator
ipconfig /flushdns
netsh winsock reset
netsh int ip reset
# Restart computer
```

## 📱 **Device Connection Issues**

### **For Physical Android Device:**
1. Enable Developer Options
2. Enable USB Debugging
3. Connect via USB
4. Run: `npx expo start --localhost`
5. Scan QR code with Expo Go app

### **For Android Emulator:**
1. Start emulator first
2. Run: `npx expo start --android`
3. Should automatically open in emulator

### **For iOS Simulator (Mac only):**
```bash
npx expo start --ios
```

## 🌐 **Network-Related Solutions**

### **Corporate/School Networks:**
- Use mobile hotspot instead
- Try tunnel mode: `npx expo start --tunnel`
- Contact IT about allowing Expo domains

### **Router/ISP Issues:**
1. Restart router/modem
2. Try different DNS servers (8.8.8.8, 1.1.1.1)
3. Use mobile hotspot to test

### **VPN Issues:**
- Disconnect VPN and try again
- Or use tunnel mode with VPN active

## 🔄 **Complete Reset Process**

If all else fails, complete reset:

```bash
# 1. Stop all Node processes
taskkill /f /im node.exe

# 2. Clear all caches
npm cache clean --force
npx expo install --fix

# 3. Reinstall dependencies (if needed)
rm -rf node_modules
npm install

# 4. Start fresh
npx expo start --tunnel --clear
```

## 📋 **Alternative Development Methods**

### **Web Development:**
```bash
npx expo start --web
```
Develop in browser instead of mobile device.

### **EAS Build (Production Testing):**
```bash
npx eas build --platform android --profile preview
```
Build APK for testing without development server.

## 🆘 **Emergency Workaround**

If you need to continue development immediately:

1. **Use Web Mode:**
   ```bash
   npx expo start --web
   ```

2. **Use Expo Snack (Online):**
   - Go to https://snack.expo.dev
   - Copy your code to test features online

3. **Use Different Network:**
   - Mobile hotspot
   - Different WiFi network
   - Ethernet connection

## 📞 **When to Seek Help**

Contact support if:
- All solutions above fail
- Error persists across different networks
- Issue occurs on multiple devices
- Expo CLI version is outdated

## 🎯 **Prevention Tips**

- Keep Expo CLI updated: `npm install -g @expo/cli@latest`
- Use stable internet connection
- Avoid VPNs during development
- Keep Windows Firewall configured for Node.js