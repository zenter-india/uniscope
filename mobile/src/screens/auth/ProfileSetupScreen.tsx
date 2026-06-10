import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { updateProfile } from '../../api/users';
import { colors, fontSize, fontWeight, radius, spacing } from '../../constants/theme';
import { useAuthStore } from '../../store/useAuthStore';
import type { AuthStackParamList } from '../../types/navigation';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'ProfileSetup'>;

export function ProfileSetupScreen() {
  const navigation = useNavigation<Nav>();
  const currentUser = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const setAuth = useAuthStore((s) => s.setAuth);
  const accessToken = useAuthStore((s) => s.accessToken);
  const refreshToken = useAuthStore((s) => s.refreshToken);

  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (currentUser?.displayName) {
      setDisplayName(currentUser.displayName);
    }
  }, [currentUser?.displayName]);

  const isValid = displayName.trim().length >= 2;

  const handleFinish = async () => {
    if (!isValid || loading) return;
    setLoading(true);
    setError('');

    try {
      const updated = await updateProfile({ displayName: displayName.trim() });
      if (currentUser && accessToken && refreshToken) {
        setAuth(accessToken, refreshToken, {
          id: updated.id,
          role: updated.role,
          displayName: updated.displayName,
        });
      }
      // RootNavigator will switch to Main tab once isAuthenticated is true
    } catch {
      setError('Failed to save profile. Please try again.');
      setLoading(false);
    }
  };

  const handleSkip = () => {
    // Already authenticated — RootNavigator will navigate to Main
    if (currentUser && accessToken && refreshToken) {
      setAuth(accessToken, refreshToken, currentUser);
    }
  };

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

          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>📷</Text>
              <Text style={styles.avatarLabel}>Add photo</Text>
            </View>
          </View>

          <View style={styles.fields}>
            <View style={styles.field}>
              <Text style={styles.label}>Display name *</Text>
              <TextInput
                style={[styles.input, error ? styles.inputError : null]}
                placeholder="e.g. MedStudent_Chennai"
                placeholderTextColor={colors.text.muted}
                value={displayName}
                onChangeText={(t) => {
                  setDisplayName(t);
                  if (error) setError('');
                }}
                maxLength={60}
                autoFocus
                editable={!loading}
              />
              <Text style={styles.hint}>
                This is your public pseudonym — not your real name.
              </Text>
            </View>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.privacyNote}>
            <Text style={styles.privacyIcon}>🔒</Text>
            <Text style={styles.privacyText}>
              Your real identity is never shared publicly. Verify your student
              status to unlock all features.
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.button, (!isValid || loading) && styles.buttonDisabled]}
            disabled={!isValid || loading}
            onPress={handleFinish}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={colors.text.inverse} size="small" />
            ) : (
              <Text style={styles.buttonText}>Finish Setup</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.skip} onPress={handleSkip} disabled={loading}>
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
  avatarContainer: {
    alignItems: 'center',
  },
  avatar: {
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
  inputError: {
    borderColor: colors.status.error,
  },
  hint: {
    fontSize: fontSize.xs,
    color: colors.text.muted,
  },
  errorText: {
    fontSize: fontSize.sm,
    color: colors.status.error,
    textAlign: 'center',
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
    justifyContent: 'center',
    minHeight: 50,
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
