import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fontSize, fontWeight, radius, spacing } from '../../constants/theme';
import type { AuthStackParamList } from '../../types/navigation';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'RoleSelection'>;

type Role = 'PROSPECTIVE' | 'STUDENT' | 'ALUMNI';

const ROLES: { id: Role; icon: string; title: string; description: string }[] = [
  {
    id: 'PROSPECTIVE',
    icon: '📚',
    title: 'Prospective Student',
    description: 'I\'m researching medical colleges and want to connect with students and alumni.',
  },
  {
    id: 'STUDENT',
    icon: '🩺',
    title: 'Current Student',
    description: 'I\'m enrolled in an MBBS or MD program and want to help others.',
  },
  {
    id: 'ALUMNI',
    icon: '🎓',
    title: 'Alumni / Doctor',
    description: 'I\'ve completed my degree and want to share my experience.',
  },
];

export function RoleSelectionScreen() {
  const navigation = useNavigation<Nav>();
  const [selected, setSelected] = useState<Role | null>(null);

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
              style={[
                styles.card,
                selected === role.id && styles.cardSelected,
              ]}
              onPress={() => setSelected(role.id)}
              activeOpacity={0.8}
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
                style={[
                  styles.radio,
                  selected === role.id && styles.radioSelected,
                ]}
              >
                {selected === role.id && <View style={styles.radioDot} />}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.button, !selected && styles.buttonDisabled]}
          disabled={!selected}
          onPress={() => navigation.navigate('ProfileSetup')}
          activeOpacity={0.85}
        >
          <Text style={styles.buttonText}>Continue</Text>
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
  cardIcon: {
    fontSize: 22,
  },
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
  button: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    marginBottom: spacing.lg,
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
