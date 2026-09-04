import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_theme.dart';

const _brandTeal = AppColors.primary;

class _Feature {
  const _Feature({required this.icon, required this.title, required this.description});
  final IconData icon;
  final String title;
  final String description;
}

class _Slide {
  const _Slide({
    this.badge,
    required this.headline,
    this.highlight,
    this.subtext,
    this.tagline,
    this.image,
    this.useLogo = false,
    this.features,
  });

  /// Small pill label above the headline (slide 2's "Mentorship Program").
  final String? badge;
  final String headline;
  /// Substring of [headline] rendered in brand teal (slide 2's "Enrolled").
  final String? highlight;
  final String? subtext;
  /// Slide 1's "By the Students; For the Students" line.
  final String? tagline;
  final String? image;
  /// Slide 1 shows the Uniscope logo mark instead of a stock photo.
  final bool useLogo;
  /// Slide 4's feature list — rendered instead of a photo when present.
  final List<_Feature>? features;
}

/// Onboarding carousel shown before login/signup — content and structure
/// ported directly from the provided reference design (4 steps): intro,
/// "Mentorship Program", "Your College Discovery Partner", and a feature
/// summary. The reference's "College Insights" card (hidden acceptance
/// trends / financial-aid-probability stats) was deliberately dropped —
/// that's not a real Uniscope feature, and CLAUDE.md's own convention is to
/// never assert data we don't have.
class WelcomeScreen extends StatefulWidget {
  const WelcomeScreen({super.key});

  @override
  State<WelcomeScreen> createState() => _WelcomeScreenState();
}

class _WelcomeScreenState extends State<WelcomeScreen> {
  final _controller = PageController();
  int _index = 0;

  static const _slides = <_Slide>[
    _Slide(
      headline: 'Your College Discovery\nJourney Starts Here',
      subtext: 'Real Mentors, Real Insights, Right Colleges.',
      tagline: 'By the Students; For the Students',
      useLogo: true,
    ),
    _Slide(
      badge: 'Mentorship Program',
      headline: "Learn from Those Who've Successfully Enrolled",
      highlight: 'Enrolled',
      subtext:
          "Get one-on-one unfiltered guidance from real verified mentors who have already walked the path you're preparing for. Gain strategic guidance to navigate your dream college selection journey.",
      image: 'assets/onboarding/slide2_reviews.jpg',
    ),
    _Slide(
      headline: 'Everything You Need In One Place',
      subtext:
          'Explore college insights, Discover right colleges and make confident decisions at every step of your journey.',
      image: 'assets/onboarding/slide3_anonymous.jpg',
    ),
    _Slide(
      headline: 'What You Get',
      features: [
        _Feature(
          icon: Icons.groups_rounded,
          title: 'Mentor Guidance',
          description:
              'Connect with alumni and admissions experts who have walked the path before you.',
        ),
        _Feature(
          icon: Icons.forum_rounded,
          title: 'Strategic Matching',
          description:
              'Get matched with mentors who share your interests and can provide real insights into campus life and culture.',
        ),
      ],
    ),
  ];

  bool get _isLast => _index == _slides.length - 1;

  void _next() {
    if (_isLast) {
      context.push('/login');
      return;
    }
    _controller.nextPage(
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeOut,
    );
  }

  void _back() {
    _controller.previousPage(
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeOut,
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Widget _headline(_Slide slide) {
    if (slide.highlight == null || !slide.headline.contains(slide.highlight!)) {
      return Text(
        slide.headline,
        textAlign: TextAlign.center,
        style: const TextStyle(
          fontSize: AppFont.xxl,
          fontWeight: AppFont.extraBold,
          color: AppColors.textPrimary,
          height: 1.25,
        ),
      );
    }
    final parts = slide.headline.split(slide.highlight!);
    return RichText(
      textAlign: TextAlign.center,
      text: TextSpan(
        style: const TextStyle(
          fontSize: AppFont.xxl,
          fontWeight: AppFont.extraBold,
          color: AppColors.textPrimary,
          height: 1.25,
        ),
        children: [
          TextSpan(text: parts[0]),
          TextSpan(text: slide.highlight, style: const TextStyle(color: _brandTeal)),
          if (parts.length > 1) TextSpan(text: parts[1]),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surface,
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(
                  AppSpacing.xl, AppSpacing.md, AppSpacing.xl, 0),
              child: Row(
                children: [
                  Image.asset(
                    'assets/logo/uniscope_icon.png',
                    width: 28,
                    height: 28,
                    fit: BoxFit.contain,
                  ),
                  const SizedBox(width: AppSpacing.xs),
                  const Text(
                    'Uniscope',
                    style: TextStyle(
                      fontSize: AppFont.lg,
                      fontWeight: AppFont.extraBold,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const Spacer(),
                  if (_index == 0)
                    TextButton(
                      onPressed: () => context.push('/login'),
                      child: const Text(
                        'Skip',
                        style: TextStyle(
                          fontSize: AppFont.sm,
                          color: AppColors.textSecondary,
                          fontWeight: AppFont.medium,
                        ),
                      ),
                    )
                  else
                    Row(
                      children: [
                        Text(
                          'Step ${_index + 1} of ${_slides.length}',
                          style: const TextStyle(
                            fontSize: AppFont.xs,
                            color: AppColors.textMuted,
                            fontWeight: AppFont.medium,
                          ),
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        SizedBox(
                          width: 56,
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(AppRadius.full),
                            child: LinearProgressIndicator(
                              value: (_index + 1) / _slides.length,
                              minHeight: 4,
                              backgroundColor: AppColors.border,
                              valueColor:
                                  const AlwaysStoppedAnimation(_brandTeal),
                            ),
                          ),
                        ),
                      ],
                    ),
                ],
              ),
            ),
            Expanded(
              child: PageView.builder(
                controller: _controller,
                itemCount: _slides.length,
                onPageChanged: (i) => setState(() => _index = i),
                itemBuilder: (context, i) {
                  final slide = _slides[i];
                  return SingleChildScrollView(
                    padding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.xl, vertical: AppSpacing.md),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        if (slide.useLogo) ...[
                          Container(
                            height: 200,
                            width: double.infinity,
                            decoration: BoxDecoration(
                              color: _brandTeal.withValues(alpha: 0.08),
                              borderRadius: BorderRadius.circular(AppRadius.lg),
                            ),
                            alignment: Alignment.center,
                            child: Image.asset(
                              'assets/logo/uniscope_icon.png',
                              width: 140,
                              height: 140,
                              fit: BoxFit.contain,
                            ),
                          ),
                          const SizedBox(height: AppSpacing.xl),
                        ] else if (slide.image != null) ...[
                          ClipRRect(
                            borderRadius: BorderRadius.circular(AppRadius.lg),
                            child: Image.asset(
                              slide.image!,
                              height: 200,
                              width: double.infinity,
                              fit: BoxFit.cover,
                            ),
                          ),
                          const SizedBox(height: AppSpacing.xl),
                        ],
                        if (slide.badge != null) ...[
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: AppSpacing.md, vertical: 6),
                            decoration: BoxDecoration(
                              color: AppColors.primaryLight,
                              borderRadius: BorderRadius.circular(AppRadius.full),
                            ),
                            child: Text(
                              slide.badge!,
                              style: const TextStyle(
                                fontSize: AppFont.xs,
                                fontWeight: AppFont.semibold,
                                color: AppColors.primaryDark,
                              ),
                            ),
                          ),
                          const SizedBox(height: AppSpacing.md),
                        ],
                        _headline(slide),
                        if (slide.subtext != null) ...[
                          const SizedBox(height: AppSpacing.sm),
                          Text(
                            slide.subtext!,
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              fontSize: AppFont.sm,
                              color: AppColors.textSecondary,
                              height: 1.5,
                            ),
                          ),
                        ],
                        if (slide.tagline != null) ...[
                          const SizedBox(height: AppSpacing.sm),
                          Text(
                            slide.tagline!,
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              fontSize: AppFont.sm,
                              fontWeight: AppFont.bold,
                              color: _brandTeal,
                            ),
                          ),
                        ],
                        if (slide.features != null) ...[
                          const SizedBox(height: AppSpacing.xl),
                          ...slide.features!.map((f) => Padding(
                                padding:
                                    const EdgeInsets.only(bottom: AppSpacing.md),
                                child: Container(
                                  padding: const EdgeInsets.all(AppSpacing.md),
                                  decoration: BoxDecoration(
                                    color: AppColors.background,
                                    borderRadius:
                                        BorderRadius.circular(AppRadius.lg),
                                    border: Border.all(color: AppColors.border),
                                  ),
                                  child: Row(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Container(
                                        width: 40,
                                        height: 40,
                                        decoration: BoxDecoration(
                                          color: Colors.white,
                                          borderRadius:
                                              BorderRadius.circular(AppRadius.md),
                                          boxShadow: AppShadows.card,
                                        ),
                                        alignment: Alignment.center,
                                        child: Icon(f.icon,
                                            size: 20, color: AppColors.textPrimary),
                                      ),
                                      const SizedBox(width: AppSpacing.md),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              f.title,
                                              style: const TextStyle(
                                                fontSize: AppFont.md,
                                                fontWeight: AppFont.bold,
                                                color: AppColors.textPrimary,
                                              ),
                                            ),
                                            const SizedBox(height: 2),
                                            Text(
                                              f.description,
                                              style: const TextStyle(
                                                fontSize: AppFont.sm,
                                                color: AppColors.textSecondary,
                                                height: 1.4,
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              )),
                        ],
                      ],
                    ),
                  );
                },
              ),
            ),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(_slides.length, (i) {
                final active = i == _index;
                return AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  margin: const EdgeInsets.symmetric(horizontal: 3),
                  width: active ? 20 : 6,
                  height: 6,
                  decoration: BoxDecoration(
                    color: active ? _brandTeal : AppColors.border,
                    borderRadius: BorderRadius.circular(AppRadius.full),
                  ),
                );
              }),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.xl,
                AppSpacing.lg,
                AppSpacing.xl,
                AppSpacing.md,
              ),
              child: Column(
                children: [
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      style: FilledButton.styleFrom(
                        backgroundColor: _brandTeal,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(AppRadius.md),
                        ),
                      ),
                      onPressed: _next,
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            _isLast ? 'Get Started' : 'Next',
                            style: const TextStyle(
                                fontSize: AppFont.md, fontWeight: AppFont.bold),
                          ),
                          const SizedBox(width: AppSpacing.xs),
                          const Icon(Icons.arrow_forward_rounded, size: 18),
                        ],
                      ),
                    ),
                  ),
                  if (_index > 0) ...[
                    const SizedBox(height: AppSpacing.sm),
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton(
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          side: const BorderSide(color: AppColors.border),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(AppRadius.md),
                          ),
                        ),
                        onPressed: _back,
                        child: const Text(
                          'Back',
                          style: TextStyle(
                            fontSize: AppFont.md,
                            fontWeight: AppFont.semibold,
                            color: AppColors.textPrimary,
                          ),
                        ),
                      ),
                    ),
                  ],
                  const SizedBox(height: AppSpacing.md),
                  TextButton(
                    onPressed: () => context.push('/login'),
                    child: const Text(
                      'I already have an account',
                      style: TextStyle(
                        color: _brandTeal,
                        fontWeight: AppFont.semibold,
                        fontSize: AppFont.sm,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
