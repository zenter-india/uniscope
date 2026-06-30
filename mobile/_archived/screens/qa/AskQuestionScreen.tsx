import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fontSize, fontWeight, radius, spacing } from '../../constants/theme';

const TAGS = ['hostel', 'fees', 'clinical', 'faculty', 'campus', 'pg', 'placements', 'infra'];

export function AskQuestionScreen() {
  const navigation = useNavigation();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const toggleTag = (tag: string) =>
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag].slice(0, 3),
    );

  const isValid = title.trim().length >= 10;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.field}>
            <Text style={styles.label}>Your question *</Text>
            <TextInput
              style={styles.titleInput}
              placeholder="e.g. How is the hostel situation at CMC Vellore?"
              placeholderTextColor={colors.text.muted}
              value={title}
              onChangeText={setTitle}
              maxLength={300}
              multiline
              autoFocus
            />
            <Text style={styles.charCount}>{title.length}/300</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>More details (optional)</Text>
            <TextInput
              style={styles.bodyInput}
              placeholder="Add any context that helps mentors answer better..."
              placeholderTextColor={colors.text.muted}
              value={body}
              onChangeText={setBody}
              maxLength={1000}
              multiline
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Tags (up to 3)</Text>
            <View style={styles.tagGrid}>
              {TAGS.map((tag) => (
                <TouchableOpacity
                  key={tag}
                  style={[styles.tagChip, selectedTags.includes(tag) && styles.tagChipSelected]}
                  onPress={() => toggleTag(tag)}
                >
                  <Text style={[styles.tagChipText, selectedTags.includes(tag) && styles.tagChipTextSelected]}>
                    {tag}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.anonNote}>
            <Text style={styles.anonIcon}>🔒</Text>
            <Text style={styles.anonText}>
              Your question is posted anonymously. Mentors will not know who asked.
            </Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.submitButton, !isValid && styles.submitDisabled]}
            disabled={!isValid}
          >
            <Text style={styles.submitText}>Post Question</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  content: { padding: spacing.md, gap: spacing.lg, paddingBottom: spacing.xxl },
  field: { gap: spacing.sm },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text.primary },
  titleInput: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: fontSize.md,
    color: colors.text.primary,
    minHeight: 80,
    textAlignVertical: 'top',
    backgroundColor: colors.background,
  },
  bodyInput: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: fontSize.md,
    color: colors.text.primary,
    minHeight: 100,
    textAlignVertical: 'top',
    backgroundColor: colors.background,
  },
  charCount: { fontSize: fontSize.xs, color: colors.text.muted, alignSelf: 'flex-end' },
  tagGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tagChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  tagChipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  tagChipText: { fontSize: fontSize.sm, color: colors.text.secondary },
  tagChipTextSelected: { color: colors.text.inverse, fontWeight: fontWeight.medium },
  anonNote: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.primaryLight,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  anonIcon: { fontSize: 16 },
  anonText: { flex: 1, fontSize: fontSize.sm, color: colors.primaryDark, lineHeight: 20 },
  footer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  submitButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  submitDisabled: { backgroundColor: colors.border },
  submitText: { color: colors.text.inverse, fontWeight: fontWeight.semibold, fontSize: fontSize.md },
});
