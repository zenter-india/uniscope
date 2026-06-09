import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
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
import type { AuthStackParamList } from '../../types/navigation';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'ProfileSetup'>;

export function ProfileSetupScreen() {
  const navigation = useNavigation<Nav>();
  const [displayName, setDisplayName] = useState('');
  const [university, setUniversity] = useState('');

  const isValid = displayName.trim().length >= 2;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.inner}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.title}>Set up your profile</Text>
            <Text style={styles.subtitle}>
              Your display name is shown publicly instead of your real name.
            </Text>
          </View>

          {/* Avatar placeholder */}
          <TouchableOpacity style={styles.avatar}>
            <Text style={styles.avatarText}>📷</Text>
            <Text style={styles.avatarLabel}>Add photo</Text>
          </TouchableOpacity>

          <View style={styles.fields}>
            <View style={styles.field}>
              <Text style={styles.label}>Display name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. MedStudent_Chennai"
                placeholderTextColor={colors.text.muted}
                value={displayName}
                onChangeText={setDisplayName}
                maxLength={60}
                autoFocus
              />
              <Text style={styles.hint}>
                This is your public pseudonym — not your real name.
              </Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>University (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="Search your college..."
                placeholderTextColor={colors.text.muted}
                value={university}
                onChangeText={setUniversity}
              />
            </View>
          </View>

          <View style={styles.privacyNote}>
            <Text style={styles.privacyIcon}>🔒</Text>
            <Text style={styles.privacyText}>
              Your real identity is never shared publicly. Verify your student status to unlock all features.
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.button, !isValid && styles.buttonDisabled]}
            disabled={!isValid}
            onPress={() => {
              // Sprint 1: dispatch to auth store, navigate to Main
            }}
            activeOpacity={0.85}
          >
            <Text style={styles.buttonText}>Finish Setup</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.skip}>
            <Text style={styles.skipText}>Skip for now</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  inner: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.xl,
  },
  header: {
    gap: spacing.sm,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.text.secondary,
    lineHeight: 24,
  },
  avatar: {
    alignSelf: 'center',
    width: 88,
    height: 88,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  avatarText: { fontSize: 24 },
  avatarLabel: {
    fontSize: fontSize.xs,
    color: colors.primary,
    fontWeight: fontWeight.medium,
  },
  fields: {
    gap: spacing.lg,
  },
  field: {
    gap: spacing.xs,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: fontSize.md,
    color: colors.text.primary,
    backgroundColor: colors.background,
  },
  hint: {
    fontSize: fontSize.xs,
    color: colors.text.muted,
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.primaryLight,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  privacyIcon: { fontSize: 16, marginTop: 2 },
  privacyText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.primaryDark,
    lineHeight: 20,
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: colors.border,
  },
  buttonText: {
    color: colors.text.inverse,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  skip: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  skipText: {
    fontSize: fontSize.sm,
    color: colors.text.muted,
  },
});
