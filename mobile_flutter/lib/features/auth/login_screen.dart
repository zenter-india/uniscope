import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/auth_api.dart';
import '../../core/theme/app_theme.dart';
import 'auth_background.dart';

/// Port of RN `auth/LoginScreen.tsx`.
class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _controller = TextEditingController();
  String _phone = '';
  bool _loading = false;
  String _error = '';

  bool get _isValid => _phone.replaceAll(RegExp(r'\D'), '').length == 10;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _sendOtp() async {
    if (!_isValid || _loading) return;
    setState(() {
      _error = '';
      _loading = true;
    });

    try {
      final fullPhone = '+91${_phone.replaceAll(RegExp(r'\D'), '')}';
      final serviceId = await ref.read(authApiProvider).requestOtp(fullPhone);
      if (!mounted) return;
      context.push('/otp', extra: {'phone': fullPhone, 'serviceId': serviceId});
    } on DioException catch (err) {
      final msg = (err.response?.data is Map)
          ? (err.response?.data as Map)['message']
          : null;
      setState(() => _error =
          msg is String ? msg : 'Failed to send OTP. Please try again.');
    } catch (_) {
      setState(() => _error = 'Failed to send OTP. Please try again.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

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
                      onPressed: () => context.pop(),
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
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const SizedBox(height: AppSpacing.lg),
                      Row(
                        children: [
                          const AuthLogoMark(size: 44),
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
                      const Text(
                        'Welcome',
                        style: TextStyle(
                          fontSize: 32,
                          fontWeight: AppFont.extraBold,
                          color: authBrandNavy,
                        ),
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'Login or create your account',
                        style: TextStyle(
                          fontSize: AppFont.md,
                          color: AppColors.textSecondary,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.xl),
                      Container(
                        decoration: BoxDecoration(
                          color: Colors.white,
                          border: Border.all(
                            color: _error.isNotEmpty
                                ? AppColors.error
                                : AppColors.border,
                            width: 1.5,
                          ),
                          borderRadius: BorderRadius.circular(AppRadius.full),
                        ),
                        clipBehavior: Clip.antiAlias,
                        child: Row(
                          children: [
                            const Padding(
                              padding: EdgeInsets.symmetric(
                                  horizontal: AppSpacing.md, vertical: AppSpacing.md),
                              child: Text(
                                '🇮🇳 +91',
                                style: TextStyle(
                                  fontSize: AppFont.md,
                                  color: authBrandNavy,
                                  fontWeight: AppFont.medium,
                                ),
                              ),
                            ),
                            Container(width: 1, height: 24, color: AppColors.border),
                            Expanded(
                              child: TextField(
                                controller: _controller,
                                autofocus: true,
                                enabled: !_loading,
                                keyboardType: TextInputType.phone,
                                maxLength: 10,
                                inputFormatters: [
                                  FilteringTextInputFormatter.digitsOnly,
                                ],
                                onChanged: (t) => setState(() {
                                  _phone = t;
                                  if (_error.isNotEmpty) _error = '';
                                }),
                                style: const TextStyle(
                                  fontSize: AppFont.md,
                                  color: authBrandNavy,
                                  letterSpacing: 1,
                                ),
                                decoration: const InputDecoration(
                                  counterText: '',
                                  border: InputBorder.none,
                                  contentPadding: EdgeInsets.symmetric(
                                      horizontal: AppSpacing.md,
                                      vertical: AppSpacing.md),
                                  hintText: 'Enter your phone number',
                                  hintStyle: TextStyle(color: AppColors.textMuted),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      if (_error.isNotEmpty) ...[
                        const SizedBox(height: AppSpacing.sm),
                        Text(_error,
                            style: const TextStyle(
                                fontSize: AppFont.sm, color: AppColors.error)),
                      ],
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
                          onPressed: (!_isValid || _loading) ? null : _sendOtp,
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
                                  'Continue',
                                  style: TextStyle(
                                    fontSize: AppFont.md,
                                    fontWeight: AppFont.bold,
                                  ),
                                ),
                        ),
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      const Padding(
                        padding: EdgeInsets.only(bottom: AppSpacing.lg),
                        child: Text.rich(
                          TextSpan(
                            text: 'By continuing you agree to ',
                            style: TextStyle(
                              fontSize: AppFont.xs,
                              color: AppColors.textMuted,
                            ),
                            children: [
                              TextSpan(
                                text: 'Terms & Privacy',
                                style: TextStyle(
                                  color: authBrandTeal,
                                  fontWeight: AppFont.semibold,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
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
