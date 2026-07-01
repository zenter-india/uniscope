import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/auth_api.dart';
import '../../core/theme/app_theme.dart';

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
      final requestId = await ref.read(authApiProvider).requestOtp(fullPhone);
      if (!mounted) return;
      context.push('/otp', extra: {'phone': fullPhone, 'requestId': requestId});
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
      backgroundColor: AppColors.surface,
      appBar: AppBar(title: const Text('Sign In')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(
              AppSpacing.xl, AppSpacing.xxl, AppSpacing.xl, AppSpacing.xl),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Enter your mobile number',
                style: TextStyle(
                  fontSize: AppFont.xxl,
                  fontWeight: AppFont.bold,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              const Text(
                "We'll send a one-time code to verify your number.",
                style: TextStyle(
                  fontSize: AppFont.md,
                  color: AppColors.textSecondary,
                  height: 1.5,
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              Container(
                decoration: BoxDecoration(
                  border: Border.all(
                    color: _error.isNotEmpty
                        ? AppColors.error
                        : AppColors.border,
                    width: 1.5,
                  ),
                  borderRadius: BorderRadius.circular(AppRadius.md),
                ),
                clipBehavior: Clip.antiAlias,
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(AppSpacing.md),
                      decoration: const BoxDecoration(
                        color: AppColors.background,
                        border: Border(
                          right: BorderSide(color: AppColors.border, width: 1.5),
                        ),
                      ),
                      child: const Text(
                        '🇮🇳 +91',
                        style: TextStyle(
                          fontSize: AppFont.md,
                          color: AppColors.textPrimary,
                          fontWeight: AppFont.medium,
                        ),
                      ),
                    ),
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
                          color: AppColors.textPrimary,
                          letterSpacing: 1,
                        ),
                        decoration: const InputDecoration(
                          counterText: '',
                          border: InputBorder.none,
                          contentPadding: EdgeInsets.symmetric(
                              horizontal: AppSpacing.md, vertical: AppSpacing.md),
                          hintText: '10-digit mobile number',
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
              const SizedBox(height: AppSpacing.md),
              const Text(
                'Standard SMS rates may apply. OTP expires in 10 minutes.',
                style: TextStyle(
                  fontSize: AppFont.sm,
                  color: AppColors.textMuted,
                  height: 1.4,
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              _SendButton(
                enabled: _isValid,
                loading: _loading,
                onPressed: _sendOtp,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SendButton extends StatelessWidget {
  const _SendButton({
    required this.enabled,
    required this.loading,
    required this.onPressed,
  });

  final bool enabled;
  final bool loading;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final disabled = !enabled || loading;
    return SizedBox(
      width: double.infinity,
      child: Material(
        color: disabled ? AppColors.border : AppColors.primary,
        borderRadius: BorderRadius.circular(AppRadius.md),
        child: InkWell(
          onTap: disabled ? null : onPressed,
          borderRadius: BorderRadius.circular(AppRadius.md),
          child: Container(
            height: 50,
            alignment: Alignment.center,
            child: loading
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      valueColor: AlwaysStoppedAnimation(AppColors.textInverse),
                    ),
                  )
                : const Text(
                    'Send OTP',
                    style: TextStyle(
                      color: AppColors.textInverse,
                      fontSize: AppFont.md,
                      fontWeight: AppFont.semibold,
                    ),
                  ),
          ),
        ),
      ),
    );
  }
}
