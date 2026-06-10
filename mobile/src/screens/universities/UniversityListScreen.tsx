import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fontSize, fontWeight, radius, spacing } from '../../constants/theme';
import type { UniversityStackParamList } from '../../types/navigation';

type Nav = NativeStackNavigationProp<UniversityStackParamList, 'UniversityList'>;

const PLACEHOLDER_DATA = [
  { id: '1', name: 'AIIMS New Delhi', state: 'Delhi', type: 'Government', rank: 1, seats: 107 },
  { id: '2', name: 'CMC Vellore', state: 'Tamil Nadu', type: 'Private', rank: 2, seats: 100 },
  { id: '3', name: 'JIPMER Puducherry', state: 'Puducherry', type: 'Government', rank: 3, seats: 150 },
  { id: '4', name: 'AIIMS Jodhpur', state: 'Rajasthan', type: 'Government', rank: 8, seats: 125 },
  { id: '5', name: 'Kasturba Medical College', state: 'Karnataka', type: 'Deemed', rank: 5, seats: 250 },
];

export function UniversityListScreen() {
  const navigation = useNavigation<Nav>();
  const [query, setQuery] = useState('');

  const filtered = PLACEHOLDER_DATA.filter((u) =>
    u.name.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Search */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search universities..."
            placeholderTextColor={colors.text.muted}
            value={query}
            onChangeText={setQuery}
          />
        </View>
        <TouchableOpacity style={styles.filterButton}>
          <Text style={styles.filterIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {/* Filter chips */}
      <View style={styles.chips}>
        {['All', 'Government', 'Private', 'Deemed'].map((f) => (
          <TouchableOpacity key={f} style={[styles.chip, f === 'All' && styles.chipActive]}>
            <Text style={[styles.chipText, f === 'All' && styles.chipTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() =>
              navigation.navigate('UniversityDetail', {
                universityId: item.id,
                universityName: item.name,
              })
            }
            activeOpacity={0.8}
          >
            <View style={styles.cardTop}>
              <View style={styles.rankBadge}>
                <Text style={styles.rankText}>#{item.rank}</Text>
              </View>
              <View style={styles.cardInfo}>
                <Text style={styles.cardName}>{item.name}</Text>
                <Text style={styles.cardMeta}>
                  {item.state} · {item.seats} seats
                </Text>
              </View>
              <View style={[styles.typeBadge, item.type === 'Government' && styles.typeBadgeGov]}>
                <Text style={styles.typeText}>{item.type}</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  searchRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  searchIcon: { fontSize: 16 },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.md,
    fontSize: fontSize.md,
    color: colors.text.primary,
  },
  filterButton: {
    width: 44,
    height: 44,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterIcon: { fontSize: 18 },
  chips: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: fontSize.sm, color: colors.text.secondary },
  chipTextActive: { color: colors.text.inverse, fontWeight: fontWeight.medium },
  list: { paddingHorizontal: spacing.md, gap: spacing.sm, paddingBottom: spacing.xl },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rankBadge: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.primary },
  cardInfo: { flex: 1, gap: spacing.xs },
  cardName: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text.primary },
  cardMeta: { fontSize: fontSize.sm, color: colors.text.secondary },
  typeBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeBadgeGov: { backgroundColor: '#E8F5EE', borderColor: colors.primary },
  typeText: { fontSize: fontSize.xs, color: colors.text.secondary },
});
