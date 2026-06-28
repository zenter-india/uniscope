import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fontSize, fontWeight, radius, spacing } from '../../constants/theme';
import type { AdminStackParamList } from '../../types/navigation';

type Nav = NativeStackNavigationProp<AdminStackParamList, 'AdminDashboard'>;

export function AdminDashboardScreen() {
  const navigation = useNavigation<Nav>();

  const STATS = [
    { label: 'Pending Verifications', value: '24', urgent: true },
    { label: 'Open Reports', value: '7', urgent: true },
    { label: 'Total Users', value: '1,240', urgent: false },
    { label: 'Universities', value: '312', urgent: false },
  ];

  const ACTIONS = [
    { icon: '🛡️', label: 'Verification Queue', screen: 'AdminVerificationQueue' as const, badge: 24 },
    { icon: '⚠️', label: 'Moderation Queue', screen: 'AdminModerationQueue' as const, badge: 7 },
    { icon: '👥', label: 'User Management', screen: 'AdminUserList' as const },
    { icon: '🏥', label: 'Universities', screen: 'AdminUniversities' as const },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Admin Dashboard</Text>
          <Text style={styles.subtitle}>Uniscope Operations</Text>
        </View>

        <View style={styles.statsGrid}>
          {STATS.map(({ label, value, urgent }) => (
            <View key={label} style={[styles.statCard, urgent && styles.statCardUrgent]}>
              <Text style={[styles.statValue, urgent && styles.statValueUrgent]}>{value}</Text>
              <Text style={styles.statLabel}>{label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.actions}>
          {ACTIONS.map(({ icon, label, screen, badge }) => (
            <TouchableOpacity
              key={screen}
              style={styles.actionRow}
              onPress={() => navigation.navigate(screen)}
            >
              <Text style={styles.actionIcon}>{icon}</Text>
              <Text style={styles.actionLabel}>{label}</Text>
              {badge != null && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{badge}</Text>
                </View>
              )}
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing.lg, gap: spacing.xs },
  title: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.text.primary },
  subtitle: { fontSize: fontSize.md, color: colors.text.secondary },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  statCard: {
    width: '47%',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  statCardUrgent: { borderColor: colors.status.warning, backgroundColor: '#FFFBEB' },
  statValue: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.text.primary },
  statValueUrgent: { color: colors.status.warning },
  statLabel: { fontSize: fontSize.sm, color: colors.text.secondary },
  actions: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  actionIcon: { fontSize: 20, width: 28, textAlign: 'center' },
  actionLabel: { flex: 1, fontSize: fontSize.md, color: colors.text.primary, fontWeight: fontWeight.medium },
  badge: {
    backgroundColor: colors.status.error,
    minWidth: 22,
    height: 22,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: colors.text.inverse, fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  chevron: { fontSize: 20, color: colors.text.muted },
});
