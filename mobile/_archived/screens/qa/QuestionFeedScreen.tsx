import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fontSize, fontWeight, radius, spacing } from '../../constants/theme';
import type { QAStackParamList } from '../../types/navigation';

type Nav = NativeStackNavigationProp<QAStackParamList, 'QuestionFeed'>;

const PLACEHOLDER_QUESTIONS = [
  {
    id: '1',
    title: 'How is the clinical exposure at AIIMS Delhi in 3rd year?',
    university: 'AIIMS New Delhi',
    answers: 5,
    tags: ['clinical', 'aiims'],
    ago: '2h ago',
  },
  {
    id: '2',
    title: 'Is the hostel condition at CMC Vellore really that good?',
    university: 'CMC Vellore',
    answers: 8,
    tags: ['hostel', 'campus'],
    ago: '4h ago',
  },
  {
    id: '3',
    title: 'What are the PG prospects from JIPMER Puducherry?',
    university: 'JIPMER Puducherry',
    answers: 3,
    tags: ['pg', 'career'],
    ago: '1d ago',
  },
];

export function QuestionFeedScreen() {
  const navigation = useNavigation<Nav>();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        data={PLACEHOLDER_QUESTIONS}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <TouchableOpacity
            style={styles.askButton}
            onPress={() => navigation.navigate('AskQuestion', {})}
            activeOpacity={0.85}
          >
            <Text style={styles.askIcon}>✏️</Text>
            <Text style={styles.askText}>Ask a question...</Text>
          </TouchableOpacity>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('QuestionDetail', { questionId: item.id })}
            activeOpacity={0.8}
          >
            <Text style={styles.questionTitle}>{item.title}</Text>
            <Text style={styles.questionUniversity}>{item.university}</Text>
            <View style={styles.cardFooter}>
              <View style={styles.tags}>
                {item.tags.map((tag) => (
                  <View key={tag} style={styles.tag}>
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.meta}>
                <Text style={styles.answers}>💬 {item.answers}</Text>
                <Text style={styles.ago}>{item.ago}</Text>
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
  list: { padding: spacing.md, gap: spacing.sm },
  askButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  askIcon: { fontSize: 18 },
  askText: { fontSize: fontSize.md, color: colors.text.muted },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  questionTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    lineHeight: 22,
  },
  questionUniversity: { fontSize: fontSize.sm, color: colors.primary },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tags: { flexDirection: 'row', gap: spacing.xs },
  tag: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  tagText: { fontSize: fontSize.xs, color: colors.primary },
  meta: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  answers: { fontSize: fontSize.sm, color: colors.text.secondary },
  ago: { fontSize: fontSize.xs, color: colors.text.muted },
});
