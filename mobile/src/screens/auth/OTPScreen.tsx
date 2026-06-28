import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { requestOtp, verifyOtp } from '../../api/auth';
import { colors, fontSize, fontWeight, radius, spacing } from '../../constants/theme';
import { useAuthStore } from '../../store/useAuthStore';
import type { AuthStackParamList } from '../../types/navigation';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'OTP'>;
type Route = RouteProp<AuthStackParamList, 'OTP'>;

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 60;

export function OTPScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { phone, serviceId: initialServiceId } = route.params;

  const setAuth = useAuthStore((s) => s.setAuth);

  const [otp, setOtp] = useState('');
  const [countdown, setCountdown] = useState(RESEND_COOLDOWN);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentServiceId, setCurrentServiceId] = useState(initialServiceId);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (countdown === 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleChange = (value: string) => {
    setError('');
    const digits = value.replace(/\D/g, '').slice(0, OTP_LENGTH);
    setOtp(digits);
    if (digits.length === OTP_LENGTH) {
      handleVerify(digits);
    }
  };

  const handleVerify = async (code: string) => {
    if (loading) return;
    setLoading(true);
    setError('');

    try {
      const result = await verifyOtp(currentServiceId, phone, code);
      setAuth(result.accessToken, result.refreshToken, {
        id: result.user.id,
        role: result.user.role,
        displayName: result.user.displayName,
      });

      if (result.user.isNewUser) {
        navigation.navigate('RoleSelection');
      } else {
        // Navigate to main app — handled by RootNavigator reacting to isAuthenticated
        navigation.navigate('ProfileSetup');
      }
    } catch {
      setError('Incorrect or expired code. Please try again.');
      setOtp('');
      inputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setOtp('');
    setError('');
    setLoading(true);

    try {
      const { serviceId } = await requestOtp(phone);
      setCurrentServiceId(serviceId);
      setCountdown(RESEND_COOLDOWN);
      inputRef.current?.focus();
    } catch {
      setError('Failed to resend OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const maskedPhone = phone.replace(/(\+91)(\d{3})(\d{3})(\d{4})/, '$1 $2 *** $4');

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.inner}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Enter the code</Text>
          <Text style={styles.subtitle}>
            We sent a 6-digit code to{'\n'}
            <Text style={styles.phone}>{maskedPhone}</Text>
          </Text>
        </View>

        <TouchableOpacity
          style={styles.otpContainer}
          onPress={() => inputRef.current?.focus()}
          activeOpacity={1}
        >
          {Array.from({ length: OTP_LENGTH }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.otpCell,
                otp.length === i && !loading && styles.otpCellActive,
                !!error && styles.otpCellError,
              ]}
            >
              <Text style={styles.otpDigit}>{otp[i] ?? ''}</Text>
            </View>
          ))}
        </TouchableOpacity>

        <TextInput
          ref={inputRef}
          style={styles.hiddenInput}
          value={otp}
          onChangeText={handleChange}
          keyboardType="number-pad"
          maxLength={OTP_LENGTH}
          autoFocus
          editable={!loading}
        />

        {loading && (
          <ActivityIndicator color={colors.primary} size="small" style={styles.loader} />
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          onPress={handleResend}
          disabled={countdown > 0 || loading}
          style={styles.resendRow}
        >
          <Text
            style={[
              styles.resendText,
              (countdown > 0 || loading) && styles.resendDisabled,
            ]}
          >
            {countdown > 0 ? `Resend code in ${countdown}s` : 'Resend code'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.changeNumber}
          onPress={() => navigation.goBack()}
          disabled={loading}
        >
          <Text style={styles.changeNumberText}>Change number</Text>
        </TouchableOpacity>
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
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    gap: spacing.lg,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    gap: spacing.sm,
    width: '100%',
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  phone: {
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
  otpContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  otpCell: {
    width: 46,
    height: 56,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  otpCellActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  otpCellError: {
    borderColor: colors.status.error,
  },
  otpDigit: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
  },
  loader: {
    marginTop: -spacing.sm,
  },
  error: {
    fontSize: fontSize.sm,
    color: colors.status.error,
    textAlign: 'center',
  },
  resendRow: {
    paddingVertical: spacing.sm,
  },
  resendText: {
    fontSize: fontSize.md,
    color: colors.primary,
    fontWeight: fontWeight.medium,
  },
  resendDisabled: {
    color: colors.text.muted,
  },
  changeNumber: {
    paddingVertical: spacing.sm,
  },
  changeNumberText: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
  },
});
