import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/users_api.dart';
import '../../core/theme/app_theme.dart';
import '../../state/auth_controller.dart';
import '../../widgets/app_widgets.dart';
import 'profile_options.dart';

class EditProfileScreen extends ConsumerStatefulWidget {
  const EditProfileScreen({super.key});

  @override
  ConsumerState<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends ConsumerState<EditProfileScreen> {
  final _displayNameController = TextEditingController();
  final _cityController = TextEditingController();
  final _bioController = TextEditingController();
  String? _qualification;
  String? _stream;
  String? _state;
  final Set<String> _languages = {};
  // A saved language that isn't one of kLanguageOptions' fixed values is a
  // previously-typed "Others" answer (see _save's mapping below — the
  // literal "Others" is never itself stored, it's replaced by what was
  // typed). Pre-filling this lets an existing custom language actually show
  // up as editable instead of silently vanishing from the chip group.
  final _languagesOtherController = TextEditingController();
  bool _loaded = false;
  bool _saving = false;

  void _hydrate(UserProfile profile) {
    if (_loaded) return;
    _loaded = true;
    _displayNameController.text = profile.displayName;
    _cityController.text = profile.city ?? '';
    _bioController.text = profile.bio ?? '';
    _qualification = profile.qualification;
    _stream = profile.stream;
    _state = profile.state;
    final customLanguages = profile.languages
        .where((l) => !kLanguageOptions.contains(l))
        .toList();
    _languages.addAll(profile.languages.where(kLanguageOptions.contains));
    if (customLanguages.isNotEmpty) {
      _languages.add('Others');
      _languagesOtherController.text = customLanguages.join(', ');
    }
  }

  @override
  void dispose() {
    _displayNameController.dispose();
    _cityController.dispose();
    _bioController.dispose();
    _languagesOtherController.dispose();
    super.dispose();
  }

  Future<void> _save(UserRole role) async {
    setState(() => _saving = true);
    try {
      final displayName = _displayNameController.text.trim().isEmpty
          ? null
          : _displayNameController.text.trim();
      if (role == UserRole.mentor) {
        final resolvedLanguages = _languages
            .map(
              (l) => l == 'Others' ? _languagesOtherController.text.trim() : l,
            )
            .where((l) => l.isNotEmpty)
            .toList();
        await ref
            .read(usersApiProvider)
            .updateProfile(
              displayName: displayName,
              bio: _bioController.text.trim(),
              stream: _stream,
              languages: resolvedLanguages,
            );
      } else {
        await ref
            .read(usersApiProvider)
            .updateProfile(
              displayName: displayName,
              state: _state,
              city: _cityController.text.trim(),
              qualification: _qualification,
              stream: _stream,
            );
      }
      ref.invalidate(myProfileProvider);
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Profile updated')));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Could not save: $e')));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final profileAsync = ref.watch(myProfileProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Edit Profile')),
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
          // Avatar sits outside the scroll view — always visible while
          // editing the fields below, never scrolls away. `Expanded` +
          // `SingleChildScrollView` share the remaining height, so an
          // on-screen keyboard resizes only the scrollable half instead of
          // pushing the avatar off-screen or breaking the layout.
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
                        ),
                      ),
                      const SizedBox(height: AppSpacing.xs),
                      TextField(controller: _displayNameController),
                      const SizedBox(height: AppSpacing.md),
                      if (isMentor) ...[
                        const Text(
                          'Stream / Field',
                          style: TextStyle(
                            fontSize: AppFont.sm,
                            fontWeight: AppFont.semibold,
                          ),
                        ),
                        const SizedBox(height: AppSpacing.xs),
                        DropdownButtonFormField<String>(
                          // A value predating this fix (e.g. an old kGuidanceAreas
                          // entry stuck in `specialty`, or nothing at all) won't
                          // match kStreamOptions' exact strings — fall back to
                          // null rather than assert-crash on an unknown value.
                          initialValue: kStreamOptions.contains(_stream)
                              ? _stream
                              : null,
                          isExpanded: true,
                          hint: const Text('What can you help aspirants with?'),
                          items: kStreamOptions
                              .map(
                                (s) =>
                                    DropdownMenuItem(value: s, child: Text(s)),
                              )
                              .toList(),
                          onChanged: (v) => setState(() => _stream = v),
                        ),
                        const SizedBox(height: AppSpacing.md),
                        const Text(
                          'Bio',
                          style: TextStyle(
                            fontSize: AppFont.sm,
                            fontWeight: AppFont.semibold,
                          ),
                        ),
                        const SizedBox(height: AppSpacing.xs),
                        TextField(
                          controller: _bioController,
                          maxLines: 3,
                          decoration: const InputDecoration(
                            hintText:
                                'A short introduction for aspirants browsing mentors',
                          ),
                        ),
                        const SizedBox(height: AppSpacing.md),
                        const Text(
                          'Languages',
                          style: TextStyle(
                            fontSize: AppFont.sm,
                            fontWeight: AppFont.semibold,
                          ),
                        ),
                        const SizedBox(height: AppSpacing.xs),
                        Wrap(
                          spacing: AppSpacing.sm,
                          runSpacing: AppSpacing.sm,
                          children: kLanguageOptions.map((language) {
                            final selected = _languages.contains(language);
                            return FilterChip(
                              label: Text(language),
                              selected: selected,
                              onSelected: (v) => setState(
                                () => v
                                    ? _languages.add(language)
                                    : _languages.remove(language),
                              ),
                              selectedColor: AppColors.primaryLight,
                              checkmarkColor: AppColors.primary,
                              labelStyle: TextStyle(
                                fontSize: AppFont.sm,
                                color: selected
                                    ? AppColors.primaryDark
                                    : AppColors.textSecondary,
                                fontWeight: selected
                                    ? AppFont.semibold
                                    : AppFont.medium,
                              ),
                              side: BorderSide(
                                color: selected
                                    ? AppColors.primary
                                    : AppColors.border,
                              ),
                            );
                          }).toList(),
                        ),
                        if (_languages.contains('Others')) ...[
                          const SizedBox(height: AppSpacing.sm),
                          TextField(
                            controller: _languagesOtherController,
                            onChanged: (_) => setState(() {}),
                            decoration: const InputDecoration(
                              hintText: 'Enter language',
                            ),
                          ),
                        ],
                      ] else ...[
                        const Text(
                          'Qualification',
                          style: TextStyle(
                            fontSize: AppFont.sm,
                            fontWeight: AppFont.semibold,
                          ),
                        ),
                        const SizedBox(height: AppSpacing.xs),
                        DropdownButtonFormField<String>(
                          initialValue: _qualification,
                          isExpanded: true,
                          hint: const Text('Select qualification'),
                          items: kQualifications
                              .map(
                                (q) =>
                                    DropdownMenuItem(value: q, child: Text(q)),
                              )
                              .toList(),
                          onChanged: (v) => setState(() => _qualification = v),
                        ),
                        const SizedBox(height: AppSpacing.md),
                        const Text(
                          'Stream / Field of Interest',
                          style: TextStyle(
                            fontSize: AppFont.sm,
                            fontWeight: AppFont.semibold,
                          ),
                        ),
                        const SizedBox(height: AppSpacing.xs),
                        DropdownButtonFormField<String>(
                          // A value saved via the onboarding wizard (e.g. "Engineering")
                          // won't match if it's not one of kStreamOptions' exact
                          // strings — fall back to null rather than let
                          // DropdownButtonFormField assert-crash on an unknown value.
                          initialValue: kStreamOptions.contains(_stream)
                              ? _stream
                              : null,
                          isExpanded: true,
                          hint: const Text('Select stream / field'),
                          items: kStreamOptions
                              .map(
                                (s) =>
                                    DropdownMenuItem(value: s, child: Text(s)),
                              )
                              .toList(),
                          onChanged: (v) => setState(() => _stream = v),
                        ),
                        const SizedBox(height: AppSpacing.md),
                        const Text(
                          'State',
                          style: TextStyle(
                            fontSize: AppFont.sm,
                            fontWeight: AppFont.semibold,
                          ),
                        ),
                        const SizedBox(height: AppSpacing.xs),
                        DropdownButtonFormField<String>(
                          initialValue: _state,
                          isExpanded: true,
                          hint: const Text('Select state'),
                          items: kIndianStates
                              .map(
                                (s) =>
                                    DropdownMenuItem(value: s, child: Text(s)),
                              )
                              .toList(),
                          onChanged: (v) => setState(() => _state = v),
                        ),
                        const SizedBox(height: AppSpacing.md),
                        const Text(
                          'City',
                          style: TextStyle(
                            fontSize: AppFont.sm,
                            fontWeight: AppFont.semibold,
                          ),
                        ),
                        const SizedBox(height: AppSpacing.xs),
                        TextField(
                          controller: _cityController,
                          decoration: const InputDecoration(
                            hintText: 'Enter your city',
                          ),
                        ),
                      ],
                      const SizedBox(height: AppSpacing.xl),
                      SizedBox(
                        width: double.infinity,
                        child: FilledButton(
                          onPressed: _saving ? null : () => _save(profile.role),
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
