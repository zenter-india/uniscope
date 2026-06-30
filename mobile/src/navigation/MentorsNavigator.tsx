import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PlaceholderScreen } from '../screens/common/PlaceholderScreen';
import type { MentorsStackParamList } from '../types/navigation';

const Stack = createNativeStackNavigator<MentorsStackParamList>();

export function MentorsNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: true,
        headerTitle: 'Find Mentors',
      }}
    >
      <Stack.Screen name="MentorList" options={{ title: 'Mentors' }}>
        {() => <PlaceholderScreen title="Mentor List" />}
      </Stack.Screen>
      <Stack.Screen name="MentorProfile" options={{ title: 'Mentor Profile' }}>
        {() => <PlaceholderScreen title="Mentor Profile" />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
