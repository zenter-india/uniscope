import { StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function PlaceholderScreen({ title }: { title: string }) {
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
