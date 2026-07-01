// Add these screens to your navigation stack
// In your main navigator file (usually App.tsx or navigation/index.tsx)

// Import the new screens
import MedicalSettingsScreen from '../screens/MedicalSettingsScreen';
import ShareRecordsScreen from '../screens/ShareRecordsScreen';

// Add to your Stack.Navigator
<Stack.Screen 
  name="MedicalSettings" 
  component={MedicalSettingsScreen}
  options={{ headerShown: false }}
/>
<Stack.Screen 
  name="ShareRecords" 
  component={ShareRecordsScreen}
  options={{ headerShown: false }}
/>

// If you need a ChangePIN screen, create it or use existing PIN functionality