import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fontSize, fontWeight, radius, spacing } from '../../constants/theme';
import type { MainTabParamList } from '../../types/navigation';

type Nav = BottomTabNavigationProp<MainTabParamList, 'Home'>;

// Tabs that have nested navigators require params; simple tabs do not.
type QuickAction =
  | { icon: string; label: string; name: 'Home' | 'Reviews' | 'Notifications' }
  | { icon: string; label: string; name: 'Universities'; params: object }
  | { icon: string; label: string; name: 'QA'; params: object }
  | { icon: string; label: string; name: 'Messages'; params: object };

const QUICK_ACTIONS: QuickAction[] = [
  { icon: '🏥', label: 'Universities', name: 'Universities', params: {} },
  { icon: '❓', label: 'Q&A', name: 'QA', params: {} },
  { icon: '⭐', label: 'Reviews', name: 'Reviews' },
  { icon: '💬', label: 'Messages', name: 'Messages', params: {} },
];

export function HomeScreen() {
  const navigation = useNavigation<Nav>();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Good evening 👋</Text>
            <Text style={styles.subGreeting}>What are you looking for today?</Text>
          </View>
          <TouchableOpacity
            style={styles.notifButton}
            onPress={() => navigation.navigate('Notifications')}
          >
            <Text style={styles.notifIcon}>🔔</Text>
          </TouchableOpacity>
        </View>

        {/* Quick actions */}
        <View style={styles.quickActions}>
          {QUICK_ACTIONS.map((action) => (
            <TouchableOpacity
              key={action.name}
              style={styles.quickCard}
              onPress={() => navigation.navigate(action as any)}
              activeOpacity={0.8}
            >
              <Text style={styles.quickIcon}>{action.icon}</Text>
              <Text style={styles.quickLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Featured Universities placeholder */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Top Universities</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Universities' as any)}>
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>
          <PlaceholderCard label="AIIMS New Delhi" sub="Government · Rank #1 · 107 seats" />
          <PlaceholderCard label="CMC Vellore" sub="Private · Rank #2 · 100 seats" />
          <PlaceholderCard label="JIPMER Puducherry" sub="Government · Rank #3 · 150 seats" />
        </View>

        {/* Recent Q&A placeholder */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Questions</Text>
            <TouchableOpacity onPress={() => navigation.navigate('QA' as any)}>
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>
          <PlaceholderCard
            label="How is the clinical exposure at AIIMS Delhi?"
            sub="3 answers · AIIMS New Delhi"
          />
          <PlaceholderCard
            label="Is the hostel situation better at CMC now?"
            sub="7 answers · CMC Vellore"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function PlaceholderCard({ label, sub }: { label: string; sub: string }) {
  return (
    <View style={placeholderStyles.card}>
      <Text style={placeholderStyles.label}>{label}</Text>
      <Text style={placeholderStyles.sub}>{sub}</Text>
    </View>
  );
}

const placeholderStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  label: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.text.primary,
  },
  sub: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  greeting: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
  },
  subGreeting: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  notifButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifIcon: { fontSize: 18 },
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  quickCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  quickIcon: { fontSize: 22 },
  quickLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.text.primary,
  },
  section: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
  },
  seeAll: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: fontWeight.medium,
  },
});
