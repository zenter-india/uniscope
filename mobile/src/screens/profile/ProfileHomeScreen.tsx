import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fontSize, fontWeight, radius, spacing } from '../../constants/theme';
import type { ProfileStackParamList } from '../../types/navigation';

type Nav = NativeStackNavigationProp<ProfileStackParamList, 'ProfileHome'>;

export function ProfileHomeScreen() {
  const navigation = useNavigation<Nav>();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile header */}
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>👤</Text>
          </View>
          <Text style={styles.displayName}>MedStudent_Chennai</Text>
          <View style={styles.verifiedRow}>
            <View style={styles.unverifiedBadge}>
              <Text style={styles.unverifiedText}>Unverified</Text>
            </View>
            <Text style={styles.role}>Prospective Student</Text>
          </View>
          <TouchableOpacity
            style={styles.verifyButton}
            onPress={() => navigation.navigate('Verification')}
          >
            <Text style={styles.verifyButtonText}>Get Verified →</Text>
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={styles.stats}>
          {[
            { label: 'Questions', value: '3' },
            { label: 'Answers', value: '0' },
            { label: 'Reviews', value: '0' },
          ].map(({ label, value }) => (
            <View key={label} style={styles.stat}>
              <Text style={styles.statValue}>{value}</Text>
              <Text style={styles.statLabel}>{label}</Text>
            </View>
          ))}
        </View>

        {/* Menu */}
        <View style={styles.menu}>
          {[
            { icon: '✏️', label: 'Edit Profile', screen: 'EditProfile' as const },
            { icon: '🛡️', label: 'Verification', screen: 'Verification' as const },
            { icon: '⚙️', label: 'Settings', screen: 'Settings' as const },
          ].map(({ icon, label, screen }) => (
            <TouchableOpacity
              key={screen}
              style={styles.menuRow}
              onPress={() => navigation.navigate(screen)}
            >
              <Text style={styles.menuIcon}>{icon}</Text>
              <Text style={styles.menuLabel}>{label}</Text>
              <Text style={styles.menuChevron}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.logoutRow}>
          <Text style={styles.logoutIcon}>↩</Text>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    backgroundColor: colors.surface,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.border,
  },
  avatarText: { fontSize: 32 },
  displayName: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.text.primary },
  verifiedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  unverifiedBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  unverifiedText: { fontSize: fontSize.xs, color: '#92400E', fontWeight: fontWeight.medium },
  role: { fontSize: fontSize.sm, color: colors.text.secondary },
  verifyButton: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  verifyButtonText: { color: colors.text.inverse, fontWeight: fontWeight.semibold, fontSize: fontSize.sm },
  stats: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  stat: { flex: 1, alignItems: 'center', padding: spacing.md, gap: spacing.xs },
  statValue: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.text.primary },
  statLabel: { fontSize: fontSize.xs, color: colors.text.secondary },
  menu: {
    marginTop: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  menuIcon: { fontSize: 18, width: 24, textAlign: 'center' },
  menuLabel: { flex: 1, fontSize: fontSize.md, color: colors.text.primary },
  menuChevron: { fontSize: 20, color: colors.text.muted },
  logoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    margin: spacing.md,
  },
  logoutIcon: { fontSize: 18 },
  logoutText: { fontSize: fontSize.md, color: colors.status.error, fontWeight: fontWeight.medium },
});
