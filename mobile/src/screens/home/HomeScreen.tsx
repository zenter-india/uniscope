import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import {
  Image,
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

const ICONS = {
  Colleges: require('../../assets/icons/hospital-alt.png'),
  Mentors: require('../../assets/icons/man.png'),
  Chats: require('../../assets/icons/chat.png'),
};

type QuickAction = {
  icon: keyof typeof ICONS;
  label: string;
  name: 'Colleges' | 'Mentors' | 'Chats';
};

const QUICK_ACTIONS: QuickAction[] = [
  { icon: 'Colleges', label: 'Colleges', name: 'Colleges' },
  { icon: 'Mentors', label: 'Mentors', name: 'Mentors' },
  { icon: 'Chats', label: 'Chats', name: 'Chats' },
];

export function HomeScreen() {
  const navigation = useNavigation<Nav>();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Good evening</Text>
            <Text style={styles.subGreeting}>What are you looking for today?</Text>
          </View>
        </View>

        {/* Quick actions */}
        <View style={styles.quickActions}>
          {QUICK_ACTIONS.map((action) => (
            <TouchableOpacity
              key={action.name}
              style={styles.quickCard}
              onPress={() => navigation.navigate(action.name as any)}
              activeOpacity={0.8}
            >
              <Image source={ICONS[action.icon]} style={styles.quickIcon} />
              <Text style={styles.quickLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Top Colleges */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Top Colleges</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Colleges' as any)}>
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>
          <PlaceholderCard label="AIIMS New Delhi" sub="Government · Rank #1 · 107 seats" />
          <PlaceholderCard label="CMC Vellore" sub="Private · Rank #2 · 100 seats" />
          <PlaceholderCard label="JIPMER Puducherry" sub="Government · Rank #3 · 150 seats" />
        </View>

        {/* Top Mentors */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Top Mentors</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Mentors' as any)}>
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>
          <PlaceholderCard label="MBBS Final Year · AIIMS Delhi" sub="₹8/min · 4.8 ★ · 512 sessions" />
          <PlaceholderCard label="MD Radiology · CMC Vellore" sub="₹12/min · 4.7 ★ · 203 sessions" />
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
  quickIcon: {
    width: 24,
    height: 24,
    tintColor: colors.primary,
  },
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
