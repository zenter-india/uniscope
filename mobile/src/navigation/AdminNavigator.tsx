import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AdminDashboardScreen } from '../screens/admin/AdminDashboardScreen';
import { colors } from '../constants/theme';
import type { AdminStackParamList } from '../types/navigation';
import { StyleSheet, Text } from 'react-native';
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

const Stack = createNativeStackNavigator<AdminStackParamList>();

export function AdminNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.primary,
        headerShadowVisible: false,
        
      }}
    >
      <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} options={{ title: 'Admin' }} />
      <Stack.Screen name="AdminVerificationQueue" options={{ title: 'Verification Queue' }}>
        {() => <PlaceholderScreen title="Verification Queue" />}
      </Stack.Screen>
      <Stack.Screen name="AdminVerificationDetail" options={{ title: 'Review Request' }}>
        {() => <PlaceholderScreen title="Verification Detail" />}
      </Stack.Screen>
      <Stack.Screen name="AdminModerationQueue" options={{ title: 'Moderation Queue' }}>
        {() => <PlaceholderScreen title="Moderation Queue" />}
      </Stack.Screen>
      <Stack.Screen name="AdminUserList" options={{ title: 'Users' }}>
        {() => <PlaceholderScreen title="User Management" />}
      </Stack.Screen>
      <Stack.Screen name="AdminUserDetail" options={{ title: 'User Detail' }}>
        {() => <PlaceholderScreen title="User Detail" />}
      </Stack.Screen>
      <Stack.Screen name="AdminUniversities" options={{ title: 'Universities' }}>
        {() => <PlaceholderScreen title="University Management" />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
