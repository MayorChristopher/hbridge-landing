# Network Troubleshooting Guide

## Common Solutions for "Network request failed" Error

### 1. **Check Internet Connection**
- Ensure you have a stable internet connection
- Try opening a web browser and visiting a website
- Switch between WiFi and mobile data to test

### 2. **Restart the Development Server**
```bash
# Stop the current server (Ctrl+C)
# Then restart
npm start
# or
npx expo start
```

### 3. **Clear Metro Cache**
```bash
npx expo start --clear
```

### 4. **Check Environment Variables**
Ensure your `.env.local` file has the correct Supabase credentials:
```
EXPO_PUBLIC_SUPABASE_URL=https://vapoyosssxnprxznnfgb.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

### 5. **Verify Supabase Project Status**
- Go to https://supabase.com/dashboard
- Check if your project is active and running
- Verify the URL and API keys are correct

### 6. **Network Configuration Issues**

#### For Development:
- If using an emulator, ensure it has internet access
- If using a physical device, ensure it's on the same network as your development machine
- Check if your firewall or antivirus is blocking the connection

#### For Corporate/School Networks:
- Some networks block external API calls
- Try using a mobile hotspot or different network
- Contact your network administrator about Supabase domains

### 7. **Platform-Specific Issues**

#### iOS Simulator:
```bash
# Reset iOS Simulator
xcrun simctl erase all
```

#### Android Emulator:
- Ensure the emulator has internet access
- Try wiping data and restarting the emulator

### 8. **Code-Level Solutions**

The app now includes enhanced error handling and retry logic:
- Automatic retry on network failures (up to 3 attempts)
- Better error messages for different failure types
- Network diagnostic tools built into the app

### 9. **Test Connection**
Use the built-in Network Test screen:
1. Go to Sign In screen
2. Tap "Test Connection" button
3. Review the diagnostic results

### 10. **Alternative Solutions**

If issues persist:
1. Try creating a new Supabase project
2. Use the NetworkTestScreen to diagnose specific issues
3. Check Supabase status page: https://status.supabase.com/

## Quick Commands to Try

```bash
# Clear all caches and restart
npm start -- --reset-cache

# Or with Expo
npx expo start --clear --reset-cache

# Check if Supabase is reachable
curl -I https://vapoyosssxnprxznnfgb.supabase.co
```

## When to Contact Support

Contact support if:
- Network test shows Supabase is unreachable
- Error persists across different networks
- Supabase dashboard shows project issues
- All troubleshooting steps have been tried