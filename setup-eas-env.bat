@echo off
echo Adding environment variables to EAS...

eas env:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "https://vapoyosssxnprxznnfgb.supabase.co" --environment preview --visibility plaintext --non-interactive

eas env:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhcG95b3Nzc3hucHJ4em5uZmdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYzNTM3MDgsImV4cCI6MjA4MTkyOTcwOH0.kM-qHB-K4xU0pFsh2_Eb2MlZf9gG9diD-0TGNxIaceM" --environment preview --visibility sensitive --non-interactive

eas env:create --scope project --name EXPO_PUBLIC_GEMINI_API_KEY --value "AIzaSyD-BfOeRfFOUJvq55HDpZj1kpzxtbmbeIQ" --environment preview --visibility sensitive --non-interactive

eas env:create --scope project --name EXPO_PUBLIC_APP_NAME --value "Hbridge" --environment preview --visibility plaintext --non-interactive

eas env:create --scope project --name EXPO_PUBLIC_APP_VERSION --value "1.0.0" --environment preview --visibility plaintext --non-interactive

eas env:create --scope project --name EXPO_PUBLIC_EMERGENCY_NUMBER --value "112" --environment preview --visibility plaintext --non-interactive

echo.
echo Environment variables added successfully!
echo Now run: eas build --platform android --profile preview
pause
