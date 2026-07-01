# Profile Screen Setup Guide

## 🚀 Quick Setup (5 minutes)

### Step 1: Database Setup
1. Open Supabase Dashboard → SQL Editor
2. Run the SQL script: `database/profile-updates.sql`
3. This will add:
   - `is_premium` column to profiles
   - `medical_pin` column to profiles
   - `medical_records` table with RLS policies

### Step 2: Storage Buckets
1. Go to Supabase Dashboard → Storage
2. Create two buckets:

**Bucket 1: profile-images**
- Name: `profile-images`
- Public: ✅ Yes
- File size limit: 5MB
- Allowed types: image/jpeg, image/png, image/jpg

**Bucket 2: medical-records**
- Name: `medical-records`
- Public: ❌ No (Private)
- File size limit: 10MB
- Allowed types: image/jpeg, image/png, application/pdf

### Step 3: Test the App
```bash
npm start
```

## 📋 Features to Test

### Profile Screen
- [ ] View profile with role badge
- [ ] Upload profile picture
- [ ] Edit profile information
- [ ] See premium badge (if is_premium = true)
- [ ] Click upgrade button (if not premium)
- [ ] Navigate to medical records
- [ ] See notification badge with count
- [ ] Access all menu items

### Medical Records
- [ ] Enter PIN (default: 1234)
- [ ] View locked screen
- [ ] Unlock with correct PIN
- [ ] See categories
- [ ] Lock again from header

### Notification Settings
- [ ] Toggle notification preferences
- [ ] Navigate to notifications list
- [ ] All switches work

### Privacy & Security
- [ ] Toggle privacy settings
- [ ] Request password reset
- [ ] View delete account confirmation

## 🔧 Configuration

### Default Medical PIN
The default PIN is `1234`. To customize:

1. **For testing:** Update in MedicalRecordsScreen.tsx:
```typescript
const MEDICAL_PIN = '1234'; // Change this
```

2. **For production:** Store in user profile:
```sql
UPDATE profiles SET medical_pin = 'your_pin' WHERE id = 'user_id';
```

### Premium Status
To make a user premium:
```sql
UPDATE profiles SET is_premium = true WHERE id = 'user_id';
```

## 🎨 Customization

### Colors
All colors are in `src/utils/design.ts`:
- Primary: `#21A34C` (Medical Green)
- Error: `#FF3B30` (Red)
- Background: `#FFFFFF` (White)

### Spacing
Consistent spacing system:
- xs: 4px
- sm: 8px
- md: 12px
- lg: 16px
- xl: 20px

### Border Radius
- sm: 6px
- md: 8px
- lg: 12px
- full: 9999px

## 🐛 Troubleshooting

### Image Upload Not Working
1. Check bucket name is `profile-images`
2. Verify bucket is public
3. Check RLS policies on storage.objects
4. Ensure user is authenticated

### Medical Records PIN Not Working
1. Default PIN is `1234`
2. Check MedicalRecordsScreen.tsx line with `MEDICAL_PIN`
3. For production, store in database

### Notification Badge Not Showing
1. Check NotificationBadgeContext is in App.tsx
2. Verify notifications table has data
3. Check RLS policies allow reading

### Support Tickets Error
1. Verify support_tickets table exists
2. Check RLS policies
3. Ensure user_id matches auth.uid()

## 📱 Navigation Flow

```
Profile Screen
├── Edit Profile (tap edit icon)
├── Medical Records (tap card)
│   └── PIN Entry → Records List
├── Appointments (tap menu item)
├── Notifications Settings (tap menu item)
│   └── Notifications List (tap bell icon)
├── Profile Settings (tap menu item) → Edit Profile
├── Privacy & Security (tap menu item)
│   ├── Change Password
│   ├── Privacy Policy
│   ├── Terms of Service
│   └── Delete Account
├── Help & Support (tap menu item)
│   ├── Help Topics
│   ├── Contact Methods
│   └── Support Tickets
└── Sign Out (tap button)
```

## ✅ Checklist

Before deploying:
- [ ] Run database migrations
- [ ] Create storage buckets
- [ ] Test image upload
- [ ] Test medical records PIN
- [ ] Test all navigation flows
- [ ] Verify notification badges
- [ ] Test privacy actions
- [ ] Check support tickets
- [ ] Test on iOS
- [ ] Test on Android

## 🔐 Security Notes

1. **Medical PIN:** In production, hash the PIN before storing
2. **Profile Images:** Validate file types and sizes
3. **Medical Records:** Always require authentication
4. **Password Reset:** Uses Supabase secure email flow
5. **Account Deletion:** Requires confirmation dialog

## 📞 Support

If you encounter issues:
1. Check console logs for errors
2. Verify database schema matches
3. Check Supabase dashboard for RLS policy errors
4. Review PROFILE_RESTRUCTURE_SUMMARY.md for details
