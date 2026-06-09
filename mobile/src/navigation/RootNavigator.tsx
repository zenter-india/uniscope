import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AdminNavigator } from './AdminNavigator';
import { AuthNavigator } from './AuthNavigator';
import { MainTabNavigator } from './MainTabNavigator';
import type { RootStackParamList } from '../types/navigation';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * RootNavigator switches between Auth, Main app, and Admin portal.
 * In Sprint 1, replace the initial route with an auth-gate that checks
 * the stored JWT and routes accordingly.
 */
export function RootNavigator() {
  // TODO Sprint 1: replace 'Auth' with dynamic initial route based on auth state
  const isAuthenticated = false;
  const isAdmin = false;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isAdmin ? (
        <Stack.Screen name="Admin" component={AdminNavigator} />
      ) : isAuthenticated ? (
        <Stack.Screen name="Main" component={MainTabNavigator} />
      ) : (
        <>
          <Stack.Screen name="Auth" component={AuthNavigator} />
          <Stack.Screen name="Main" component={MainTabNavigator} />
          <Stack.Screen name="Admin" component={AdminNavigator} />
        </>
      )}
    </Stack.Navigator>
  );
}
