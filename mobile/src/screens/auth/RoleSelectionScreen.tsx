import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { updateRole } from '../../api/users';
import { colors, fontSize, fontWeight, radius, spacing } from '../../constants/theme';
import { useAuthStore } from '../../store/useAuthStore';
import type { AuthStackParamList, } from '../../types/navigation';
import type { UserRole } from '../../store/useAuthStore';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'RoleSelection'>;

type RoleOption = 'PROSPECTIVE_STUDENT' | 'CURRENT_STUDENT' | 'ALUMNI';

const ROLES: { id: RoleOption; icon: string; title: string; description: string }[] = [
  {
    id: 'PROSPECTIVE_STUDENT',
    icon: '📚',
    title: 'Prospective Student',
    description: "I'm researching medical colleges and want to connect with students and alumni.",
  },
  {
    id: 'CURRENT_STUDENT',
    icon: '🩺',
    title: 'Current Student',
    description: "I'm enrolled in an MBBS or MD program and want to help others.",
  },
  {
    id: 'ALUMNI',
    icon: '🎓',
    title: 'Alumni / Doctor',
    description: "I've completed my degree and want to share my experience.",
  },
];

export function RoleSelectionScreen() {
  const navigation = useNavigation<Nav>();
  const setUser = useAuthStore((s) => s.setUser);
  const currentUser = useAuthStore((s) => s.user);

  const [selected, setSelected] = useState<RoleOption | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleContinue = async () => {
    if (!selected || loading) return;
    setLoading(true);
    setError('');

    try {
      const updated = await updateRole(selected as UserRole);
      if (currentUser) {
        setUser({ ...currentUser, role: updated.role });
      }
      navigation.navigate('ProfileSetup');
    } catch {
      setError('Failed to save your role. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        <View style={styles.header}>
          <Text style={styles.title}>Who are you?</Text>
          <Text style={styles.subtitle}>
            This helps us show you the right content. You can update this later.
          </Text>
        </View>

        <View style={styles.cards}>
          {ROLES.map((role) => (
            <TouchableOpacity
              key={role.id}
              style={[styles.card, selected === role.id && styles.cardSelected]}
              onPress={() => {
                setSelected(role.id);
                if (error) setError('');
              }}
              activeOpacity={0.8}
              disabled={loading}
            >
              <View style={styles.cardLeft}>
                <Text style={styles.cardIcon}>{role.icon}</Text>
              </View>
              <View style={styles.cardContent}>
                <Text
                  style={[
                    styles.cardTitle,
                    selected === role.id && styles.cardTitleSelected,
                  ]}
                >
                  {role.title}
                </Text>
                <Text style={styles.cardDescription}>{role.description}</Text>
              </View>
              <View
                style={[styles.radio, selected === role.id && styles.radioSelected]}
              >
                {selected === role.id && <View style={styles.radioDot} />}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.button, (!selected || loading) && styles.buttonDisabled]}
          disabled={!selected || loading}
          onPress={handleContinue}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color={colors.text.inverse} size="small" />
          ) : (
            <Text style={styles.buttonText}>Continue</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  inner: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
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
  cards: {
    gap: spacing.md,
    flex: 1,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    gap: spacing.md,
  },
  cardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  cardLeft: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIcon: { fontSize: 22 },
  cardContent: {
    flex: 1,
    gap: spacing.xs,
  },
  cardTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
  cardTitleSelected: {
    color: colors.primaryDark,
  },
  cardDescription: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: colors.primary,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  errorText: {
    fontSize: fontSize.sm,
    color: colors.status.error,
    textAlign: 'center',
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
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
});
