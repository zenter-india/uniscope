import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fontSize, fontWeight, radius, spacing } from '../../constants/theme';

const STEPS = [
  { step: 1, title: 'Select document type', done: false },
  { step: 2, title: 'Upload your document', done: false },
  { step: 3, title: 'Admin review (up to 48h)', done: false },
  { step: 4, title: 'Get your verified badge', done: false },
];

export function VerificationScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.heroIcon}>🛡️</Text>
          <Text style={styles.heroTitle}>Verify your identity</Text>
          <Text style={styles.heroSubtitle}>
            Verification is confidential. Your real identity is never shown publicly — only your role and university.
          </Text>
        </View>

        {/* What you unlock */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>What you unlock after verification</Text>
          {[
            '✅ Answer questions from prospective students',
            '✅ Write university reviews',
            '✅ Accept chat requests from students',
            '✅ Verified badge on your profile',
          ].map((item) => (
            <Text key={item} style={styles.unlockItem}>{item}</Text>
          ))}
        </View>

        {/* Steps */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>How it works</Text>
          {STEPS.map(({ step, title, done }) => (
            <View key={step} style={styles.stepRow}>
              <View style={[styles.stepCircle, done && styles.stepCircleDone]}>
                <Text style={styles.stepNumber}>{done ? '✓' : step}</Text>
              </View>
              <Text style={styles.stepTitle}>{title}</Text>
            </View>
          ))}
        </View>

        {/* Document types */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Accepted documents</Text>
          <Text style={styles.docItem}>🪪 College ID card (current students)</Text>
          <Text style={styles.docItem}>🖥️ Student portal screenshot</Text>
          <Text style={styles.docItem}>🎓 Degree certificate (alumni)</Text>
          <Text style={styles.docItem}>📋 NMC / MCI registration</Text>
        </View>

        <View style={styles.privacyNote}>
          <Text style={styles.privacyIcon}>🔒</Text>
          <Text style={styles.privacyText}>
            Documents are stored securely and reviewed only by verified Uniscope admins.
            They are never shared publicly or with third parties.
          </Text>
        </View>

        <TouchableOpacity style={styles.startButton}>
          <Text style={styles.startButtonText}>Start Verification</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
  hero: {
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  heroIcon: { fontSize: 48 },
  heroTitle: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.text.primary, textAlign: 'center' },
  heroSubtitle: { fontSize: fontSize.md, color: colors.text.secondary, textAlign: 'center', lineHeight: 24 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  cardTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text.primary },
  unlockItem: { fontSize: fontSize.md, color: colors.text.primary, lineHeight: 24 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleDone: { backgroundColor: colors.primary },
  stepNumber: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.primary },
  stepTitle: { fontSize: fontSize.md, color: colors.text.primary },
  docItem: { fontSize: fontSize.md, color: colors.text.primary, lineHeight: 28 },
  privacyNote: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.primaryLight,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  privacyIcon: { fontSize: 16 },
  privacyText: { flex: 1, fontSize: fontSize.sm, color: colors.primaryDark, lineHeight: 20 },
  startButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  startButtonText: { color: colors.text.inverse, fontWeight: fontWeight.semibold, fontSize: fontSize.md },
});
