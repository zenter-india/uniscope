import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

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
  String? _gender;
  String? _qualification;
  String? _stream;
  String? _state;
  String? _specialty;
  final Set<String> _goals = {};
  final Set<String> _languages = {};
  bool _loaded = false;
  bool _saving = false;

  void _hydrate(UserProfile profile) {
    if (_loaded) return;
    _loaded = true;
    _displayNameController.text = profile.displayName;
    _cityController.text = profile.city ?? '';
    _bioController.text = profile.bio ?? '';
    _gender = profile.gender;
    _qualification = profile.qualification;
    _stream = profile.stream;
    _state = profile.state;
    _specialty = profile.specialty;
    _goals.addAll(profile.goals);
    _languages.addAll(profile.languages);
  }

  @override
  void dispose() {
    _displayNameController.dispose();
    _cityController.dispose();
    _bioController.dispose();
    super.dispose();
  }

  Future<void> _save(UserRole role) async {
    setState(() => _saving = true);
    try {
      final displayName = _displayNameController.text.trim().isEmpty
          ? null
          : _displayNameController.text.trim();
      if (role == UserRole.mentor) {
        await ref.read(usersApiProvider).updateProfile(
              displayName: displayName,
              bio: _bioController.text.trim(),
              specialty: _specialty,
              languages: _languages.toList(),
            );
      } else {
        await ref.read(usersApiProvider).updateProfile(
              displayName: displayName,
              gender: _gender,
              state: _state,
              city: _cityController.text.trim(),
              qualification: _qualification,
              stream: _stream,
              goals: _goals.toList(),
            );
      }
      ref.invalidate(myProfileProvider);
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Profile updated')));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Could not save: $e')));
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
            child: CircularProgressIndicator(color: AppColors.primary)),
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
          return SingleChildScrollView(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Display name',
                    style: TextStyle(fontSize: AppFont.sm, fontWeight: AppFont.semibold)),
                const SizedBox(height: AppSpacing.xs),
                TextField(controller: _displayNameController),
                const SizedBox(height: AppSpacing.md),
                if (isMentor) ...[
                  const Text('Area of guidance',
                      style: TextStyle(fontSize: AppFont.sm, fontWeight: AppFont.semibold)),
                  const SizedBox(height: AppSpacing.xs),
                  DropdownButtonFormField<String>(
                    initialValue: _specialty,
                    isExpanded: true,
                    hint: const Text('What can you help aspirants with?'),
                    items: kGuidanceAreas
                        .map((s) => DropdownMenuItem(value: s, child: Text(s)))
                        .toList(),
                    onChanged: (v) => setState(() => _specialty = v),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  const Text('Bio',
                      style: TextStyle(fontSize: AppFont.sm, fontWeight: AppFont.semibold)),
                  const SizedBox(height: AppSpacing.xs),
                  TextField(
                    controller: _bioController,
                    maxLines: 3,
                    decoration: const InputDecoration(
                      hintText: 'A short introduction for aspirants browsing mentors',
                    ),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  const Text('Languages',
                      style: TextStyle(fontSize: AppFont.sm, fontWeight: AppFont.semibold)),
                  const SizedBox(height: AppSpacing.xs),
                  Wrap(
                    spacing: AppSpacing.sm,
                    runSpacing: AppSpacing.sm,
                    children: kLanguageOptions.map((language) {
                      final selected = _languages.contains(language);
                      return FilterChip(
                        label: Text(language),
                        selected: selected,
                        onSelected: (v) => setState(() =>
                            v ? _languages.add(language) : _languages.remove(language)),
                        selectedColor: AppColors.primaryLight,
                        checkmarkColor: AppColors.primary,
                        labelStyle: TextStyle(
                          fontSize: AppFont.sm,
                          color: selected ? AppColors.primaryDark : AppColors.textSecondary,
                          fontWeight: selected ? AppFont.semibold : AppFont.medium,
                        ),
                        side: BorderSide(
                            color: selected ? AppColors.primary : AppColors.border),
                      );
                    }).toList(),
                  ),
                ] else ...[
                  const Text('Gender',
                      style: TextStyle(fontSize: AppFont.sm, fontWeight: AppFont.semibold)),
                  const SizedBox(height: AppSpacing.xs),
                  DropdownButtonFormField<String>(
                    initialValue: _gender,
                    isExpanded: true,
                    hint: const Text('Select gender'),
                    items: kGenders
                        .map((g) => DropdownMenuItem(value: g, child: Text(g)))
                        .toList(),
                    onChanged: (v) => setState(() => _gender = v),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  const Text('Qualification',
                      style: TextStyle(fontSize: AppFont.sm, fontWeight: AppFont.semibold)),
                  const SizedBox(height: AppSpacing.xs),
                  DropdownButtonFormField<String>(
                    initialValue: _qualification,
                    isExpanded: true,
                    hint: const Text('Select qualification'),
                    items: kQualifications
                        .map((q) => DropdownMenuItem(value: q, child: Text(q)))
                        .toList(),
                    onChanged: (v) => setState(() => _qualification = v),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  const Text('Stream',
                      style: TextStyle(fontSize: AppFont.sm, fontWeight: AppFont.semibold)),
                  const SizedBox(height: AppSpacing.xs),
                  DropdownButtonFormField<String>(
                    initialValue: _stream,
                    isExpanded: true,
                    hint: const Text('Select stream'),
                    items: kStreams
                        .map((s) => DropdownMenuItem(value: s, child: Text(s)))
                        .toList(),
                    onChanged: (v) => setState(() => _stream = v),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  const Text('State',
                      style: TextStyle(fontSize: AppFont.sm, fontWeight: AppFont.semibold)),
                  const SizedBox(height: AppSpacing.xs),
                  DropdownButtonFormField<String>(
                    initialValue: _state,
                    isExpanded: true,
                    hint: const Text('Select state'),
                    items: kIndianStates
                        .map((s) => DropdownMenuItem(value: s, child: Text(s)))
                        .toList(),
                    onChanged: (v) => setState(() => _state = v),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  const Text('City',
                      style: TextStyle(fontSize: AppFont.sm, fontWeight: AppFont.semibold)),
                  const SizedBox(height: AppSpacing.xs),
                  TextField(
                    controller: _cityController,
                    decoration: const InputDecoration(hintText: 'Enter your city'),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  const Text('Goals',
                      style: TextStyle(fontSize: AppFont.sm, fontWeight: AppFont.semibold)),
                  const SizedBox(height: AppSpacing.xs),
                  Wrap(
                    spacing: AppSpacing.sm,
                    runSpacing: AppSpacing.sm,
                    children: kGoalOptions.map((goal) {
                      final selected = _goals.contains(goal);
                      return FilterChip(
                        label: Text(goal),
                        selected: selected,
                        onSelected: (v) => setState(
                            () => v ? _goals.add(goal) : _goals.remove(goal)),
                        selectedColor: AppColors.primaryLight,
                        checkmarkColor: AppColors.primary,
                        labelStyle: TextStyle(
                          fontSize: AppFont.sm,
                          color: selected ? AppColors.primaryDark : AppColors.textSecondary,
                          fontWeight: selected ? AppFont.semibold : AppFont.medium,
                        ),
                        side: BorderSide(
                            color: selected ? AppColors.primary : AppColors.border),
                      );
                    }).toList(),
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
                                strokeWidth: 2, color: Colors.white),
                          )
                        : const Text('Save'),
                  ),
                ),
                const SizedBox(height: AppSpacing.xl),
              ],
            ),
          );
        },
      ),
    );
  }
}
