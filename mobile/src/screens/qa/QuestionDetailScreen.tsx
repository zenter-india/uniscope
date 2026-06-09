import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fontSize, fontWeight, radius, spacing } from '../../constants/theme';

export function QuestionDetailScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.question}>
          <Text style={styles.questionTitle}>
            How is the clinical exposure at AIIMS Delhi in 3rd year?
          </Text>
          <Text style={styles.questionMeta}>AIIMS New Delhi · 2h ago</Text>
          <View style={styles.tags}>
            {['clinical', 'aiims', '3rd-year'].map((tag) => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={styles.answersHeader}>5 Answers</Text>

        {[
          {
            id: '1',
            role: 'Verified 3rd Year Student',
            university: 'AIIMS New Delhi',
            body: 'Clinical exposure at AIIMS Delhi is exceptional from 3rd year onwards. You rotate through all major departments...',
            upvotes: 12,
          },
          {
            id: '2',
            role: 'Verified Alumni',
            university: 'AIIMS New Delhi',
            batch: 'Batch 2021',
            body: 'From my experience, the OPD load is very high which actually gives you great hands-on practice...',
            upvotes: 8,
          },
        ].map((answer) => (
          <View key={answer.id} style={styles.answerCard}>
            <View style={styles.answerHeader}>
              <View style={styles.verifiedBadge}>
                <Text style={styles.verifiedIcon}>✓</Text>
              </View>
              <View>
                <Text style={styles.answerRole}>{answer.role}</Text>
                <Text style={styles.answerUniversity}>
                  {answer.university}
                  {answer.batch ? ` · ${answer.batch}` : ''}
                </Text>
              </View>
            </View>
            <Text style={styles.answerBody}>{answer.body}</Text>
            <TouchableOpacity style={styles.upvoteRow}>
              <Text style={styles.upvoteIcon}>👍</Text>
              <Text style={styles.upvoteCount}>{answer.upvotes}</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      <View style={styles.replyBar}>
        <TouchableOpacity style={styles.replyButton}>
          <Text style={styles.replyButtonText}>Write an Answer</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
  question: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  questionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    lineHeight: 26,
  },
  questionMeta: { fontSize: fontSize.sm, color: colors.text.secondary },
  tags: { flexDirection: 'row', gap: spacing.xs },
  tag: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  tagText: { fontSize: fontSize.xs, color: colors.primary },
  answersHeader: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    marginTop: spacing.sm,
  },
  answerCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  answerHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  verifiedBadge: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedIcon: { color: colors.text.inverse, fontWeight: fontWeight.bold },
  answerRole: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
  answerUniversity: { fontSize: fontSize.xs, color: colors.text.secondary },
  answerBody: {
    fontSize: fontSize.md,
    color: colors.text.primary,
    lineHeight: 24,
  },
  upvoteRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  upvoteIcon: { fontSize: 16 },
  upvoteCount: { fontSize: fontSize.sm, color: colors.text.secondary },
  replyBar: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  replyButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  replyButtonText: {
    color: colors.text.inverse,
    fontWeight: fontWeight.semibold,
    fontSize: fontSize.md,
  },
});
