import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fontSize, fontWeight, radius, spacing } from '../../constants/theme';

const PLACEHOLDER_REVIEWS = [
  { id: '1', university: 'AIIMS New Delhi', rating: 5, role: 'Verified Alumni · Batch 2022', summary: 'Exceptional clinical training and faculty. The OPD exposure is unmatched anywhere in India.', ago: '1d ago' },
  { id: '2', university: 'CMC Vellore', rating: 4, role: 'Verified 4th Year Student', summary: 'Great college overall. Hostel could be improved but academics and clinical are top-notch.', ago: '3d ago' },
];

function Stars({ rating }: { rating: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Text key={i} style={{ fontSize: 14, color: i < rating ? '#F59E0B' : colors.border }}>★</Text>
      ))}
    </View>
  );
}

export function ReviewFeedScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        data={PLACEHOLDER_REVIEWS}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.university}>{item.university}</Text>
              <Stars rating={item.rating} />
            </View>
            <Text style={styles.role}>{item.role}</Text>
            <Text style={styles.summary}>{item.summary}</Text>
            <Text style={styles.ago}>{item.ago}</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.md, gap: spacing.sm },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  university: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text.primary },
  role: { fontSize: fontSize.sm, color: colors.primary },
  summary: { fontSize: fontSize.md, color: colors.text.primary, lineHeight: 22 },
  ago: { fontSize: fontSize.xs, color: colors.text.muted },
});
