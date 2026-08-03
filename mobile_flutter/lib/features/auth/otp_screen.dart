import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/auth_api.dart';
import '../../core/theme/app_theme.dart';
import '../../state/auth_controller.dart';
import 'auth_background.dart';

const _otpLength = 6;
const _resendCooldown = 60;

/// Port of RN `auth/OTPScreen.tsx`.
class OtpScreen extends ConsumerStatefulWidget {
  const OtpScreen({super.key, required this.phone, required this.serviceId});

  final String phone;
  final String serviceId;

  @override
  ConsumerState<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends ConsumerState<OtpScreen> {
  final _controller = TextEditingController();
  final _focus = FocusNode();
  late String _serviceId = widget.serviceId;
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
      final result = await ref
          .read(authApiProvider)
          .verifyOtp(_serviceId, widget.phone, code);
      // Deliberately no context.go here — setting isAuthenticated (and
      // needsOnboarding for new users) triggers the router's redirect via
      // refreshListenable, which is the single source of truth for where
      // this goes next (see app_router.dart). A screen-level context.go
      // racing that redirect is what previously let new users fall through
      // to Home before ever reaching role-selection.
      ref.read(authControllerProvider.notifier).setAuth(
            result.accessToken,
            result.refreshToken,
            result.user,
            needsOnboarding: result.isNewUser,
          );
    } on DioException catch (err) {
      // A deleted-account-past-reactivation-window rejection (see
      // UsersService.findOrCreateByPhoneHash) comes through here with a
      // specific message — surface it instead of the generic wrong-code
      // copy, since "incorrect code" would be misleading in that case.
      final msg = (err.response?.data is Map)
          ? (err.response?.data as Map)['message']
          : null;
      setState(() {
        _error = msg is String ? msg : 'Incorrect or expired code. Please try again.';
        _otp = '';
        _controller.clear();
      });
      _focus.requestFocus();
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
        _serviceId = id;
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
      body: AuthBackground(
        child: SafeArea(
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(
                    AppSpacing.md, AppSpacing.sm, AppSpacing.md, 0),
                child: Row(
                  children: [
                    IconButton(
                      onPressed: _loading ? null : () => context.pop(),
                      icon: const Icon(Icons.arrow_back_rounded,
                          color: authBrandNavy),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const AuthLogoMark(size: 32, outlined: true),
                          const SizedBox(width: AppSpacing.sm),
                          const Text(
                            'Uniscope',
                            style: TextStyle(
                              fontSize: AppFont.lg,
                              fontWeight: AppFont.extraBold,
                              color: authBrandNavy,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: AppSpacing.xl),
                      _OtpIllustration(masked: _otp.padRight(_otpLength).substring(0, 6)),
                      const SizedBox(height: AppSpacing.lg),
                      const Text(
                        'Verify your number',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: AppFont.xxl,
                          fontWeight: AppFont.extraBold,
                          color: authBrandNavy,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      Text.rich(
                        TextSpan(
                          text: 'Enter the 6-digit code sent to\n',
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
                                color: authBrandTeal,
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
                              inputFormatters: [
                                FilteringTextInputFormatter.digitsOnly
                              ],
                              onChanged: _onChanged,
                              style: const TextStyle(color: Colors.transparent),
                              decoration: const InputDecoration(
                                counterText: '',
                                filled: false,
                                border: InputBorder.none,
                                enabledBorder: InputBorder.none,
                                focusedBorder: InputBorder.none,
                                disabledBorder: InputBorder.none,
                                errorBorder: InputBorder.none,
                                focusedErrorBorder: InputBorder.none,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      if (_error.isNotEmpty) ...[
                        Text(_error,
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                                fontSize: AppFont.sm, color: AppColors.error)),
                        const SizedBox(height: AppSpacing.sm),
                      ],
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.access_time_rounded,
                              size: 16,
                              color: (_countdown > 0 || _loading)
                                  ? AppColors.textMuted
                                  : authBrandTeal),
                          const SizedBox(width: 4),
                          TextButton(
                            onPressed: (_countdown > 0 || _loading) ? null : _resend,
                            child: Text(
                              _countdown > 0
                                  ? 'Resend code in ${_countdown}s'
                                  : 'Resend code',
                              style: TextStyle(
                                fontSize: AppFont.md,
                                fontWeight: AppFont.medium,
                                color: (_countdown > 0 || _loading)
                                    ? AppColors.textMuted
                                    : authBrandTeal,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      SizedBox(
                        width: double.infinity,
                        child: FilledButton(
                          style: FilledButton.styleFrom(
                            backgroundColor: authBrandTeal,
                            disabledBackgroundColor: AppColors.border,
                            padding: const EdgeInsets.symmetric(vertical: 16),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(AppRadius.md),
                            ),
                          ),
                          onPressed: (_otp.length == _otpLength && !_loading)
                              ? () => _verify(_otp)
                              : null,
                          child: _loading
                              ? const SizedBox(
                                  width: 20,
                                  height: 20,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    valueColor:
                                        AlwaysStoppedAnimation(Colors.white),
                                  ),
                                )
                              : const Text(
                                  'Verify',
                                  style: TextStyle(
                                    fontSize: AppFont.md,
                                    fontWeight: AppFont.bold,
                                  ),
                                ),
                        ),
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      TextButton(
                        onPressed: _loading ? null : () => context.pop(),
                        child: const Text(
                          'Change number',
                          style: TextStyle(
                              fontSize: AppFont.sm, color: AppColors.textSecondary),
                        ),
                      ),
                      const SizedBox(height: AppSpacing.lg),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _OtpIllustration extends StatelessWidget {
  const _OtpIllustration({required this.masked});
  final String masked;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 120,
      width: 160,
      child: Stack(
        alignment: Alignment.center,
        children: [
          Container(
            width: 90,
            height: 110,
            decoration: BoxDecoration(
              border: Border.all(color: authBrandTeal.withValues(alpha: 0.35), width: 2),
              borderRadius: BorderRadius.circular(AppRadius.lg),
            ),
          ),
          Positioned(
            top: 24,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: AppColors.background,
                borderRadius: BorderRadius.circular(AppRadius.sm),
              ),
              child: const Text('* * * * * *',
                  style: TextStyle(letterSpacing: 2, color: AppColors.textMuted)),
            ),
          ),
          Positioned(
            bottom: 16,
            right: 24,
            child: Container(
              width: 32,
              height: 32,
              decoration: const BoxDecoration(
                color: authBrandTeal,
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.lock_rounded, size: 16, color: Colors.white),
            ),
          ),
        ],
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
      borderColor = authBrandTeal;
      bg = Colors.white;
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
          color: authBrandNavy,
        ),
      ),
    );
  }
}
