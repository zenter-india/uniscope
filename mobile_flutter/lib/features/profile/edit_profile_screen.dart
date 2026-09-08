import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/users_api.dart';
import '../../core/theme/app_theme.dart';
import '../../state/auth_controller.dart' show UserRole, authControllerProvider;
import '../../widgets/app_widgets.dart';

/// Profile Details (route `/profile/edit`). Per explicit client decision
/// (2026-09-08) the **display name is the only editable field** here, for
/// both roles — everything else (ID, gender, field of study, college,
/// qualification, bio, languages, state, city, …) is a read-only
/// `_DetailRow`; those changes go through support. The avatar is the other
/// exception, edited via the pencil badge → `/profile/avatar`. This
/// supersedes the 2026-09-07 partial-revert that had let a MENTOR also edit
/// year-of-study / bio / languages / time-slots from this screen.
class EditProfileScreen extends ConsumerStatefulWidget {
  const EditProfileScreen({super.key});

  @override
  ConsumerState<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends ConsumerState<EditProfileScreen> {
  final _nameController = TextEditingController();
  String _initialName = '';
  bool _loaded = false;
  bool _saving = false;
  String _error = '';

  void _hydrate(UserProfile profile) {
    if (_loaded) return;
    _loaded = true;
    _initialName = profile.displayName;
    _nameController.text = profile.displayName;
  }

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  bool get _canSave {
    final name = _nameController.text.trim();
    return !_saving && name.length >= 2 && name != _initialName.trim();
  }

  Future<void> _save() async {
    final name = _nameController.text.trim();
    setState(() {
      _saving = true;
      _error = '';
    });
    try {
      final updated = await ref
          .read(usersApiProvider)
          .updateProfile(displayName: name);
      ref.invalidate(myProfileProvider);
      // Keep the cached auth user (used for greetings / avatars app-wide) in
      // step so the new name shows immediately elsewhere.
      ref.read(authControllerProvider.notifier).setUser(updated.toAuthUser());
      if (!mounted) return;
      setState(() => _initialName = name);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Display name updated')));
    } on DioException catch (e) {
      final msg = e.response?.data is Map
          ? (e.response!.data['message']?.toString() ??
                'Could not save. Try again.')
          : 'Could not save. Check your connection and try again.';
      if (!mounted) return;
      setState(() => _error = msg);
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = 'Could not save. Try again.');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final profileAsync = ref.watch(myProfileProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Profile Details')),
      body: profileAsync.when(
        loading: () => const Center(
          child: CircularProgressIndicator(color: AppColors.primary),
        ),
        error: (err, _) => EmptyState(
          icon: Icons.wifi_off_rounded,
          title: 'Could not load your profile',
          message: 'Check your connection and try again.',
          actionLabel: 'Retry',
          onAction: () => ref.invalidate(myProfileProvider),
        ),
        data: (profile) {
          _hydrate(profile);
          final isMentor = profile.role == UserRole.mentor;

          final rows = <(String, String)>[
            if (profile.uniqueId != null) ('ID', profile.uniqueId!),
            if ((profile.gender ?? '').isNotEmpty) ('Gender', profile.gender!),
            if (isMentor) ...[
              ('Field of study', _orDash(profile.stream)),
              ('Bio', _orDash(profile.bio)),
              (
                'Languages',
                profile.languages.isEmpty ? '—' : profile.languages.join(', '),
              ),
            ] else ...[
              ('Qualification', _orDash(profile.qualification)),
              ('Field of interest', _orDash(profile.stream)),
              // Only set once a qualification beyond "Higher Secondary
              // (12th)" is picked in onboarding (see AspirantOnboarding
              // Screen's Academics step) — a 12th-grader has no college yet,
              // so this row just doesn't appear for them rather than
              // showing a dash.
              if (profile.universityName != null)
                ('College', profile.universityName!),
              ('State', _orDash(profile.state)),
              ('City', _orDash(profile.city)),
            ],
          ];

          return Column(
            children: [
              Padding(
                padding: const EdgeInsets.only(
                  top: AppSpacing.md,
                  bottom: AppSpacing.sm,
                ),
                child: Center(
                  child: Stack(
                    clipBehavior: Clip.none,
                    children: [
                      AppAvatar(
                        name: profile.displayName,
                        size: 72,
                        avatarUrl: profile.avatarUrl,
                      ),
                      // Avatar stays editable even though most fields don't.
                      Positioned(
                        bottom: -2,
                        right: -2,
                        child: Material(
                          color: AppColors.primary,
                          shape: const CircleBorder(),
                          child: InkWell(
                            customBorder: const CircleBorder(),
                            onTap: () => context.push('/profile/avatar'),
                            child: const Padding(
                              padding: EdgeInsets.all(6),
                              child: Icon(
                                Icons.edit_rounded,
                                size: 14,
                                color: Colors.white,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Display name',
                        style: TextStyle(
                          fontSize: AppFont.sm,
                          fontWeight: AppFont.semibold,
                          color: AppColors.textSecondary,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.xs),
                      TextField(
                        controller: _nameController,
                        enabled: !_saving,
                        maxLength: 60,
                        onChanged: (_) => setState(() {
                          if (_error.isNotEmpty) _error = '';
                        }),
                        style: const TextStyle(
                          fontSize: AppFont.md,
                          color: AppColors.textPrimary,
                        ),
                        decoration: InputDecoration(
                          counterText: '',
                          filled: true,
                          fillColor: AppColors.surface,
                          hintText: 'e.g. MedStudent_Chennai',
                          hintStyle: const TextStyle(
                            color: AppColors.textMuted,
                          ),
                          contentPadding: const EdgeInsets.all(AppSpacing.md),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(AppRadius.md),
                            borderSide: BorderSide(
                              color: _error.isNotEmpty
                                  ? AppColors.error
                                  : AppColors.border,
                              width: 1.5,
                            ),
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(AppRadius.md),
                            borderSide: const BorderSide(
                              color: AppColors.primary,
                              width: 1.5,
                            ),
                          ),
                          disabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(AppRadius.md),
                            borderSide: const BorderSide(
                              color: AppColors.border,
                              width: 1.5,
                            ),
                          ),
                        ),
                      ),
                      if (_error.isNotEmpty) ...[
                        const SizedBox(height: AppSpacing.xs),
                        Text(
                          _error,
                          style: const TextStyle(
                            fontSize: AppFont.xs,
                            color: AppColors.error,
                          ),
                        ),
                      ],
                      const SizedBox(height: AppSpacing.xs),
                      const Text(
                        'This is the anonymous name shown to mentors and '
                        'aspirants. Your real name is never shown.',
                        style: TextStyle(
                          fontSize: AppFont.xs,
                          color: AppColors.textMuted,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      SizedBox(
                        width: double.infinity,
                        child: FilledButton(
                          onPressed: _canSave ? _save : null,
                          child: _saving
                              ? const SizedBox(
                                  width: 18,
                                  height: 18,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: Colors.white,
                                  ),
                                )
                              : const Text('Save'),
                        ),
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      AppCard(
                        padding: EdgeInsets.zero,
                        child: Column(
                          children: [
                            for (var i = 0; i < rows.length; i++)
                              _DetailRow(
                                label: rows[i].$1,
                                value: rows[i].$2,
                                isLast: i == rows.length - 1,
                              ),
                          ],
                        ),
                      ),
                      const SizedBox(height: AppSpacing.md),
                      const Text(
                        'These details were set during sign-up and can\'t be '
                        'changed here — contact support if something needs '
                        'updating.',
                        style: TextStyle(
                          fontSize: AppFont.xs,
                          color: AppColors.textMuted,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.xl),
                    ],
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

String _orDash(String? v) => (v ?? '').trim().isEmpty ? '—' : v!.trim();

class _DetailRow extends StatelessWidget {
  const _DetailRow({
    required this.label,
    required this.value,
    this.isLast = false,
  });

  final String label;
  final String value;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.md,
      ),
      decoration: BoxDecoration(
        border: isLast
            ? null
            : const Border(bottom: BorderSide(color: AppColors.border)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 120,
            child: Text(
              label,
              style: const TextStyle(
                fontSize: AppFont.sm,
                fontWeight: AppFont.semibold,
                color: AppColors.textSecondary,
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(
                fontSize: AppFont.sm,
                color: AppColors.textPrimary,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
