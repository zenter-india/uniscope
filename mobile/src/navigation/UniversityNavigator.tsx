import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { UniversityListScreen } from '../screens/universities/UniversityListScreen';
import { UniversityDetailScreen } from '../screens/universities/UniversityDetailScreen';
import { colors } from '../constants/theme';
import type { UniversityStackParamList } from '../types/navigation';

// Sub-screens (placeholders for sections within University Detail)
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

const Stack = createNativeStackNavigator<UniversityStackParamList>();

export function UniversityNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.primary,
        headerShadowVisible: false,
        
      }}
    >
      <Stack.Screen name="UniversityList" component={UniversityListScreen} options={{ title: 'Universities' }} />
      <Stack.Screen
        name="UniversityDetail"
        component={UniversityDetailScreen}
        options={({ route }) => ({ title: route.params.universityName })}
      />
      <Stack.Screen name="UniversityReviews" options={{ title: 'Reviews' }}>
        {() => <PlaceholderScreen title="University Reviews" />}
      </Stack.Screen>
      <Stack.Screen name="UniversityQuestions" options={{ title: 'Q&A' }}>
        {() => <PlaceholderScreen title="University Q&A" />}
      </Stack.Screen>
      <Stack.Screen name="UniversityStudents" options={{ title: 'Verified Students' }}>
        {() => <PlaceholderScreen title="Verified Students" />}
      </Stack.Screen>
      <Stack.Screen name="UniversityAlumni" options={{ title: 'Alumni' }}>
        {() => <PlaceholderScreen title="Alumni" />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
