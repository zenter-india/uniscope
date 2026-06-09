import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fontSize, fontWeight, radius, spacing } from '../../constants/theme';
import type { UniversityStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<UniversityStackParamList, 'UniversityDetail'>;

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'reviews', label: 'Reviews' },
  { id: 'questions', label: 'Q&A' },
  { id: 'students', label: 'Students' },
  { id: 'alumni', label: 'Alumni' },
] as const;

type TabId = typeof TABS[number]['id'];

export function UniversityDetailScreen({ route, navigation }: Props) {
  const { universityId, universityName } = route.params;
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Hero */}
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Text style={styles.heroIconText}>🏥</Text>
        </View>
        <Text style={styles.heroName}>{universityName}</Text>
        <Text style={styles.heroMeta}>Government · New Delhi · Rank #1</Text>
        <View style={styles.heroStats}>
          {[
            { label: 'Seats', value: '107' },
            { label: 'Est.', value: '1956' },
            { label: 'Rating', value: '4.8 ⭐' },
          ].map(({ label, value }) => (
            <View key={label} style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{value}</Text>
              <Text style={styles.heroStatLabel}>{label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Tab bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabBar}
        contentContainerStyle={styles.tabBarContent}
      >
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.tabActive]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Tab content */}
      <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'reviews' && (
          <PlaceholderTabContent
            icon="⭐"
            title="Reviews"
            description="Verified student and alumni reviews will appear here."
            actionLabel="Write a Review"
            onAction={() => navigation.navigate('UniversityReviews', { universityId })}
          />
        )}
        {activeTab === 'questions' && (
          <PlaceholderTabContent
            icon="❓"
            title="Questions & Answers"
            description="Questions about this university from prospective students."
            actionLabel="Ask a Question"
            onAction={() => navigation.navigate('UniversityQuestions', { universityId })}
          />
        )}
        {activeTab === 'students' && (
          <PlaceholderTabContent
            icon="🩺"
            title="Verified Students"
            description="Current students available for questions and chat."
            onAction={() => navigation.navigate('UniversityStudents', { universityId })}
          />
        )}
        {activeTab === 'alumni' && (
          <PlaceholderTabContent
            icon="🎓"
            title="Alumni"
            description="Graduates and doctors from this institution."
            onAction={() => navigation.navigate('UniversityAlumni', { universityId })}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function OverviewTab() {
  return (
    <View style={styles.overviewContent}>
      {[
        { label: 'Type', value: 'Government (Central)' },
        { label: 'Location', value: 'Ansari Nagar, New Delhi' },
        { label: 'NIRF Rank', value: '#1 (Medical)' },
        { label: 'MBBS Seats', value: '107' },
        { label: 'Established', value: '1956' },
        { label: 'Affiliation', value: 'AIIMS Act, MCI recognised' },
      ].map(({ label, value }) => (
        <View key={label} style={styles.overviewRow}>
          <Text style={styles.overviewLabel}>{label}</Text>
          <Text style={styles.overviewValue}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

function PlaceholderTabContent({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: string;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.placeholderTab}>
      <Text style={styles.placeholderIcon}>{icon}</Text>
      <Text style={styles.placeholderTitle}>{title}</Text>
      <Text style={styles.placeholderDesc}>{description}</Text>
      {actionLabel && onAction && (
        <TouchableOpacity style={styles.placeholderAction} onPress={onAction}>
          <Text style={styles.placeholderActionText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  hero: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroIconText: { fontSize: 28 },
  heroName: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    textAlign: 'center',
  },
  heroMeta: { fontSize: fontSize.sm, color: colors.text.secondary },
  heroStats: {
    flexDirection: 'row',
    gap: spacing.xl,
    marginTop: spacing.sm,
  },
  heroStat: { alignItems: 'center', gap: spacing.xs },
  heroStatValue: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
  },
  heroStatLabel: { fontSize: fontSize.xs, color: colors.text.secondary },
  tabBar: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    maxHeight: 48,
  },
  tabBarContent: {
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
    alignItems: 'center',
  },
  tab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: colors.primary },
  tabText: { fontSize: fontSize.sm, color: colors.text.secondary, fontWeight: fontWeight.medium },
  tabTextActive: { color: colors.primary, fontWeight: fontWeight.semibold },
  tabContent: { flex: 1 },
  overviewContent: {
    padding: spacing.md,
    backgroundColor: colors.surface,
    margin: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  overviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  overviewLabel: { fontSize: fontSize.sm, color: colors.text.secondary },
  overviewValue: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: colors.text.primary },
  placeholderTab: {
    flex: 1,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  placeholderIcon: { fontSize: 40 },
  placeholderTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text.primary },
  placeholderDesc: { fontSize: fontSize.md, color: colors.text.secondary, textAlign: 'center', lineHeight: 24 },
  placeholderAction: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    marginTop: spacing.md,
  },
  placeholderActionText: { color: colors.text.inverse, fontWeight: fontWeight.semibold },
});
