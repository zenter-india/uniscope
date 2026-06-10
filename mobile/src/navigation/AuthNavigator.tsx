import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { OTPScreen } from '../screens/auth/OTPScreen';
import { ProfileSetupScreen } from '../screens/auth/ProfileSetupScreen';
import { RoleSelectionScreen } from '../screens/auth/RoleSelectionScreen';
import { WelcomeScreen } from '../screens/auth/WelcomeScreen';
import { colors } from '../constants/theme';
import type { AuthStackParamList } from '../types/navigation';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.primary,
        headerShadowVisible: false,
        
      }}
    >
      <Stack.Screen name="Welcome" component={WelcomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Sign In' }} />
      <Stack.Screen name="OTP" component={OTPScreen} options={{ title: 'Verify Number' }} />
      <Stack.Screen name="RoleSelection" component={RoleSelectionScreen} options={{ title: 'Your Role' }} />
      <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} options={{ title: 'Profile' }} />
    </Stack.Navigator>
  );
}
