import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ProfileHomeScreen } from '../screens/profile/ProfileHomeScreen';
import { VerificationScreen } from '../screens/verification/VerificationScreen';
import { colors } from '../constants/theme';
import type { ProfileStackParamList } from '../types/navigation';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

function PlaceholderScreen({ title }: { title: string }) {
  return (
    <SafeAreaView style={styles.center} edges={['bottom']}>
      <Text style={styles.text}>{title} — coming in future sprints</Text>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  text: { fontSize: 16, textAlign: 'center', color: '#6B7280' },
});

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export function ProfileNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.primary,
        headerShadowVisible: false,
        
      }}
    >
      <Stack.Screen name="ProfileHome" component={ProfileHomeScreen} options={{ title: 'Profile' }} />
      <Stack.Screen name="Verification" component={VerificationScreen} options={{ title: 'Get Verified' }} />
      <Stack.Screen name="EditProfile" options={{ title: 'Edit Profile' }}>
        {() => <PlaceholderScreen title="Edit Profile" />}
      </Stack.Screen>
      <Stack.Screen name="Settings" options={{ title: 'Settings' }}>
        {() => <PlaceholderScreen title="Settings" />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
