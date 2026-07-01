import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/auth_api.dart';
import '../../core/theme/app_theme.dart';
import '../../state/auth_controller.dart';

const _otpLength = 6;
const _resendCooldown = 60;

/// Port of RN `auth/OTPScreen.tsx`.
class OtpScreen extends ConsumerStatefulWidget {
  const OtpScreen({super.key, required this.phone, required this.requestId});

  final String phone;
  final String requestId;

  @override
  ConsumerState<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends ConsumerState<OtpScreen> {
  final _controller = TextEditingController();
  final _focus = FocusNode();
  late String _requestId = widget.requestId;
  String _otp = '';
  int _countdown = _resendCooldown;
  String _error = '';
  bool _loading = false;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _startTimer();
  }

  void _startTimer() {
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (_countdown == 0) {
        t.cancel();
      } else {
        setState(() => _countdown--);
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _controller.dispose();
    _focus.dispose();
    super.dispose();
  }

  void _onChanged(String value) {
    final digits = value.replaceAll(RegExp(r'\D'), '');
    final capped = digits.length > _otpLength
        ? digits.substring(0, _otpLength)
        : digits;
    setState(() {
      _error = '';
      _otp = capped;
    });
    if (capped.length == _otpLength) _verify(capped);
  }

  Future<void> _verify(String code) async {
    if (_loading) return;
    setState(() {
      _loading = true;
      _error = '';
    });

    try {
      final result = await ref.read(authApiProvider).verifyOtp(_requestId, code);
      ref.read(authControllerProvider.notifier).setAuth(
            result.accessToken,
            result.refreshToken,
            result.user,
          );
      if (!mounted) return;
      if (result.isNewUser) {
        context.go('/role-selection');
      } else {
        context.go('/profile-setup');
      }
    } catch (_) {
      setState(() {
        _error = 'Incorrect or expired code. Please try again.';
        _otp = '';
        _controller.clear();
      });
      _focus.requestFocus();
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _resend() async {
    setState(() {
      _otp = '';
      _controller.clear();
      _error = '';
      _loading = true;
    });
    try {
      final id = await ref.read(authApiProvider).requestOtp(widget.phone);
      setState(() {
        _requestId = id;
        _countdown = _resendCooldown;
      });
      _startTimer();
      _focus.requestFocus();
    } catch (_) {
      setState(() => _error = 'Failed to resend OTP. Please try again.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String get _maskedPhone => widget.phone.replaceAllMapped(
        RegExp(r'(\+91)(\d{3})(\d{3})(\d{4})'),
        (m) => '${m[1]} ${m[2]} *** ${m[4]}',
      );

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: AppBar(title: const Text('Verify Number')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(
              AppSpacing.xl, AppSpacing.xxl, AppSpacing.xl, AppSpacing.xl),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              const Text(
                'Enter the code',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: AppFont.xxl,
                  fontWeight: AppFont.bold,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              Text.rich(
                TextSpan(
                  text: 'We sent a 6-digit code to\n',
                  style: const TextStyle(
                    fontSize: AppFont.md,
                    color: AppColors.textSecondary,
                    height: 1.5,
                  ),
                  children: [
                    TextSpan(
                      text: _maskedPhone,
                      style: const TextStyle(
                        fontWeight: AppFont.semibold,
                        color: AppColors.textPrimary,
                      ),
                    ),
                  ],
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: AppSpacing.lg),
              Stack(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      for (var i = 0; i < _otpLength; i++)
                        Padding(
                          padding: EdgeInsets.only(
                              right: i == _otpLength - 1 ? 0 : AppSpacing.sm),
                          child: _OtpCell(
                            digit: i < _otp.length ? _otp[i] : '',
                            active: _otp.length == i && !_loading,
                            error: _error.isNotEmpty,
                          ),
                        ),
                    ],
                  ),
                  Positioned.fill(
                    child: TextField(
                      controller: _controller,
                      focusNode: _focus,
                      autofocus: true,
                      enabled: !_loading,
                      keyboardType: TextInputType.number,
                      maxLength: _otpLength,
                      showCursor: false,
                      enableInteractiveSelection: false,
                      inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                      onChanged: _onChanged,
                      style: const TextStyle(color: Colors.transparent),
                      decoration: const InputDecoration(
                        counterText: '',
                        border: InputBorder.none,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.lg),
              if (_loading)
                const CircularProgressIndicator(
                    color: AppColors.primary, strokeWidth: 2),
              if (_error.isNotEmpty)
                Text(_error,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                        fontSize: AppFont.sm, color: AppColors.error)),
              const SizedBox(height: AppSpacing.sm),
              TextButton(
                onPressed:
                    (_countdown > 0 || _loading) ? null : _resend,
                child: Text(
                  _countdown > 0 ? 'Resend code in ${_countdown}s' : 'Resend code',
                  style: TextStyle(
                    fontSize: AppFont.md,
                    fontWeight: AppFont.medium,
                    color: (_countdown > 0 || _loading)
                        ? AppColors.textMuted
                        : AppColors.primary,
                  ),
                ),
              ),
              TextButton(
                onPressed: _loading ? null : () => context.pop(),
                child: const Text(
                  'Change number',
                  style: TextStyle(
                      fontSize: AppFont.sm, color: AppColors.textSecondary),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _OtpCell extends StatelessWidget {
  const _OtpCell({
    required this.digit,
    required this.active,
    required this.error,
  });

  final String digit;
  final bool active;
  final bool error;

  @override
  Widget build(BuildContext context) {
    Color borderColor = AppColors.border;
    Color bg = AppColors.background;
    if (active) {
      borderColor = AppColors.primary;
      bg = AppColors.primaryLight;
    }
    if (error) borderColor = AppColors.error;

    return Container(
      width: 46,
      height: 56,
      decoration: BoxDecoration(
        color: bg,
        border: Border.all(color: borderColor, width: 1.5),
        borderRadius: BorderRadius.circular(AppRadius.md),
      ),
      alignment: Alignment.center,
      child: Text(
        digit,
        style: const TextStyle(
          fontSize: AppFont.xl,
          fontWeight: AppFont.bold,
          color: AppColors.textPrimary,
        ),
      ),
    );
  }
}
