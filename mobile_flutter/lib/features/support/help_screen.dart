import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_theme.dart';
import '../../state/auth_controller.dart';
import '../../widgets/app_widgets.dart';
import '../common/legal_links.dart';
import 'support_contact.dart';

/// Help Centre landing screen (route `/help`). Self-serve topics + FAQ
/// first, then the ways to reach a human further down — the "Still need
/// help?" band (Chat with us → the persistent `/support` thread, Call us)
/// and the "Report a technical issue" button (route `/report-issue`). All
/// topic/FAQ content is static and shipped in the app (see [_kArticles] /
/// [_kTopics]) so it works offline and needs no CMS. Role-aware:
/// mentor-only articles and the "Verification & payouts" topic render only
/// for MENTOR accounts.
class HelpScreen extends ConsumerStatefulWidget {
  const HelpScreen({super.key});

  @override
  ConsumerState<HelpScreen> createState() => _HelpScreenState();
}

class _HelpScreenState extends ConsumerState<HelpScreen> {
  final _searchController = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authControllerProvider).user;
    final isMentor = user?.role == UserRole.mentor;
    final firstName = user?.displayName.trim().split(' ').first;

    final articles = _kArticles
        .where((a) => !a.mentorOnly || isMentor)
        .toList(growable: false);
    final topics = _kTopics
        .where((t) => !t.mentorOnly || isMentor)
        .toList(growable: false);

    final q = _query.trim().toLowerCase();
    final matches = q.isEmpty
        ? const <_HelpArticle>[]
        : articles
              .where(
                (a) =>
                    a.question.toLowerCase().contains(q) ||
                    a.answer.toLowerCase().contains(q),
              )
              .toList(growable: false);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: GradientAppBar(title: const Text('Help Centre')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.md,
          AppSpacing.md,
          AppSpacing.md,
          AppSpacing.xl,
        ),
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xs),
            child: Text(
              firstName == null || firstName.isEmpty
                  ? 'How can we help?'
                  : 'How can we help, $firstName?',
              style: const TextStyle(
                fontSize: AppFont.lg,
                fontWeight: AppFont.extraBold,
                color: AppColors.logoNavy,
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          _SearchField(
            controller: _searchController,
            onChanged: (v) => setState(() => _query = v),
          ),
          const SizedBox(height: AppSpacing.md),

          if (q.isNotEmpty) ...[
            _SectionLabel(
              matches.isEmpty
                  ? 'No articles match "$_query"'
                  : '${matches.length} result${matches.length == 1 ? '' : 's'}',
            ),
            if (matches.isEmpty)
              const _NoResultsHint()
            else
              _ArticleCard(articles: matches),
          ] else ...[
            const _SectionLabel('Browse topics'),
            _TopicsCard(
              topics: topics,
              onTap: (topic) => Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => _HelpTopicScreen(
                    topic: topic,
                    articles: articles
                        .where((a) => a.category == topic.category)
                        .toList(growable: false),
                  ),
                ),
              ),
            ),
            const _SectionLabel('Popular questions'),
            _ArticleCard(
              articles: articles
                  .where((a) => a.popular)
                  .toList(growable: false),
            ),
            const SizedBox(height: AppSpacing.lg),
            const _TechDifficultyBlock(),
            const SizedBox(height: AppSpacing.lg),
            const _StillNeedHelpBand(),
            const SizedBox(height: AppSpacing.lg),
            const _HelpFooter(),
          ],
        ],
      ),
    );
  }
}

/// A single topic's article list, reached by tapping a "Browse topics" row.
class _HelpTopicScreen extends StatelessWidget {
  const _HelpTopicScreen({required this.topic, required this.articles});

  final _HelpTopic topic;
  final List<_HelpArticle> articles;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: GradientAppBar(title: Text(topic.title)),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.md,
          AppSpacing.md,
          AppSpacing.md,
          AppSpacing.xl,
        ),
        children: [
          if (topic.subtitle.isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.xs,
                0,
                AppSpacing.xs,
                AppSpacing.md,
              ),
              child: Text(
                topic.subtitle,
                style: const TextStyle(
                  fontSize: AppFont.sm,
                  color: AppColors.textSecondary,
                ),
              ),
            ),
          if (articles.isEmpty)
            const _NoResultsHint()
          else
            _ArticleCard(articles: articles, initiallyExpandedFirst: true),
        ],
      ),
    );
  }
}

// ─────────────────────────── pieces ───────────────────────────

class _SearchField extends StatelessWidget {
  const _SearchField({required this.controller, required this.onChanged});

  final TextEditingController controller;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: AppColors.border),
        boxShadow: AppShadows.card,
      ),
      child: TextField(
        controller: controller,
        onChanged: onChanged,
        textInputAction: TextInputAction.search,
        style: const TextStyle(fontSize: AppFont.sm),
        decoration: const InputDecoration(
          hintText: 'Search help articles…',
          hintStyle: TextStyle(color: AppColors.textMuted),
          prefixIcon: Icon(Icons.search_rounded, color: AppColors.primary),
          border: InputBorder.none,
          contentPadding: EdgeInsets.symmetric(vertical: 14),
        ),
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.xs,
        AppSpacing.lg,
        AppSpacing.xs,
        AppSpacing.sm,
      ),
      child: Text(
        text.toUpperCase(),
        style: const TextStyle(
          fontSize: 11,
          fontWeight: AppFont.extraBold,
          letterSpacing: 1.1,
          color: AppColors.textMuted,
        ),
      ),
    );
  }
}

class _TopicsCard extends StatelessWidget {
  const _TopicsCard({required this.topics, required this.onTap});

  final List<_HelpTopic> topics;
  final ValueChanged<_HelpTopic> onTap;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        boxShadow: AppShadows.card,
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          for (var i = 0; i < topics.length; i++) ...[
            if (i > 0) const Divider(height: 1, color: AppColors.border),
            _TopicRow(topic: topics[i], onTap: () => onTap(topics[i])),
          ],
        ],
      ),
    );
  }
}

class _TopicRow extends StatelessWidget {
  const _TopicRow({required this.topic, required this.onTap});

  final _HelpTopic topic;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: 14,
        ),
        child: Row(
          children: [
            Container(
              width: 34,
              height: 34,
              decoration: BoxDecoration(
                color: topic.mentorOnly
                    ? AppColors.primaryLight
                    : AppColors.logoNavy.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(AppRadius.sm),
              ),
              child: Icon(
                topic.icon,
                size: 18,
                color: topic.mentorOnly
                    ? AppColors.primary
                    : AppColors.logoNavy,
              ),
            ),
            const SizedBox(width: 13),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Flexible(
                        child: Text(
                          topic.title,
                          style: const TextStyle(
                            fontSize: AppFont.sm,
                            fontWeight: AppFont.bold,
                          ),
                        ),
                      ),
                      if (topic.mentorOnly) ...[
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 6,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: AppColors.primaryLight,
                            borderRadius: BorderRadius.circular(5),
                          ),
                          child: const Text(
                            'MENTORS',
                            style: TextStyle(
                              fontSize: 9,
                              fontWeight: AppFont.extraBold,
                              letterSpacing: 0.5,
                              color: AppColors.primary,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                  if (topic.subtitle.isNotEmpty) ...[
                    const SizedBox(height: 1),
                    Text(
                      topic.subtitle,
                      style: const TextStyle(
                        fontSize: AppFont.xs,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const Icon(Icons.chevron_right_rounded, color: AppColors.textMuted),
          ],
        ),
      ),
    );
  }
}

class _ArticleCard extends StatelessWidget {
  const _ArticleCard({
    required this.articles,
    this.initiallyExpandedFirst = false,
  });

  final List<_HelpArticle> articles;
  final bool initiallyExpandedFirst;

  @override
  Widget build(BuildContext context) {
    if (articles.isEmpty) return const SizedBox.shrink();
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        boxShadow: AppShadows.card,
      ),
      clipBehavior: Clip.antiAlias,
      child: Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: Column(
          children: [
            for (var i = 0; i < articles.length; i++) ...[
              if (i > 0) const Divider(height: 1, color: AppColors.border),
              ExpansionTile(
                initiallyExpanded: initiallyExpandedFirst && i == 0,
                tilePadding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.md,
                  vertical: 2,
                ),
                childrenPadding: const EdgeInsets.fromLTRB(
                  AppSpacing.md,
                  0,
                  AppSpacing.md,
                  AppSpacing.md,
                ),
                expandedCrossAxisAlignment: CrossAxisAlignment.start,
                iconColor: AppColors.primary,
                collapsedIconColor: AppColors.primary,
                title: Text(
                  articles[i].question,
                  style: const TextStyle(
                    fontSize: AppFont.sm,
                    fontWeight: AppFont.bold,
                  ),
                ),
                children: [
                  Text(
                    articles[i].answer,
                    style: const TextStyle(
                      fontSize: 13,
                      height: 1.55,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _NoResultsHint extends StatelessWidget {
  const _NoResultsHint();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        boxShadow: AppShadows.card,
      ),
      child: const Text(
        'Nothing here yet. Try a different word, or start a conversation with '
        'support above and we’ll help you directly.',
        style: TextStyle(
          fontSize: 13,
          height: 1.5,
          color: AppColors.textSecondary,
        ),
      ),
    );
  }
}

/// "Facing technical difficulties with the application?" → the
/// Report-a-technical-issue form (`/report-issue`).
class _TechDifficultyBlock extends StatelessWidget {
  const _TechDifficultyBlock();

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: AppSpacing.xs),
          child: Text(
            'Facing technical difficulties with the application?',
            style: TextStyle(
              fontSize: AppFont.sm,
              fontWeight: AppFont.bold,
              color: AppColors.textPrimary,
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        OutlinedButton(
          onPressed: () => context.push('/report-issue'),
          style: OutlinedButton.styleFrom(
            foregroundColor: AppColors.textPrimary,
            side: const BorderSide(color: AppColors.border),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppRadius.xl),
            ),
          ),
          child: const Text('Report a technical issue'),
        ),
      ],
    );
  }
}

/// The grey "Still can't find what you're looking for?" band — moved here
/// from the Report-a-technical-issue screen (2026-09-06) so it lives once,
/// at the bottom of the Help Centre, right after the technical-difficulty
/// block rather than duplicated on a form the user may never open. Gained a
/// third "Mail us" option alongside the existing Chat/Call ones.
class _StillNeedHelpBand extends StatelessWidget {
  const _StillNeedHelpBand();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.primaryLight.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(AppRadius.lg),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            "Still can't find what you're looking for? Don't worry we're "
            'here to help',
            style: TextStyle(
              fontSize: AppFont.sm,
              fontWeight: AppFont.bold,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: [
              FilledButton.icon(
                onPressed: () => context.push('/support'),
                icon: const Icon(Icons.chat_bubble_rounded, size: 16),
                label: const Text('Chat with us'),
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppRadius.xl),
                  ),
                ),
              ),
              OutlinedButton.icon(
                onPressed: () => callSupport(context),
                icon: const Icon(
                  Icons.call_rounded,
                  size: 16,
                  color: Colors.green,
                ),
                label: const Text('Call us'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.textPrimary,
                  side: const BorderSide(color: AppColors.border),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppRadius.xl),
                  ),
                ),
              ),
              OutlinedButton.icon(
                onPressed: () => mailSupport(context),
                icon: const Icon(
                  Icons.email_rounded,
                  size: 16,
                  color: AppColors.primary,
                ),
                label: const Text('Mail us'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.textPrimary,
                  side: const BorderSide(color: AppColors.border),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppRadius.xl),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _HelpFooter extends StatelessWidget {
  const _HelpFooter();

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Wrap(
          alignment: WrapAlignment.center,
          crossAxisAlignment: WrapCrossAlignment.center,
          runSpacing: 4,
          children: [
            _FootLink('Terms', () => openLegalPage(context, LegalPage.terms)),
            const _FootDot(),
            _FootLink(
              'Privacy',
              () => openLegalPage(context, LegalPage.privacy),
            ),
            const _FootDot(),
            _FootLink(
              'Community guidelines',
              () => openLegalPage(context, LegalPage.communityGuidelines),
            ),
            const _FootDot(),
            _FootLink(
              'Refund policy',
              () => openLegalPage(context, LegalPage.refund),
            ),
          ],
        ),
        const SizedBox(height: 6),
        const Text(
          'Uniscope v1.0.0',
          style: TextStyle(fontSize: 11, color: AppColors.textMuted),
        ),
      ],
    );
  }
}

class _FootLink extends StatelessWidget {
  const _FootLink(this.label, this.onTap);

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Text(
        label,
        style: const TextStyle(
          fontSize: 12,
          fontWeight: AppFont.bold,
          color: AppColors.primary,
        ),
      ),
    );
  }
}

class _FootDot extends StatelessWidget {
  const _FootDot();

  @override
  Widget build(BuildContext context) => const Padding(
    padding: EdgeInsets.symmetric(horizontal: 8),
    child: Text('·', style: TextStyle(color: AppColors.textMuted)),
  );
}

// ─────────────────────────── content ───────────────────────────

enum _HelpCategory {
  gettingStarted,
  chatsCalls,
  wallet,
  reviews,
  account,
  mentor,
}

class _HelpTopic {
  const _HelpTopic({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.category,
    this.mentorOnly = false,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final _HelpCategory category;
  final bool mentorOnly;
}

class _HelpArticle {
  const _HelpArticle({
    required this.category,
    required this.question,
    required this.answer,
    this.popular = false,
    this.mentorOnly = false,
  });

  final _HelpCategory category;
  final String question;
  final String answer;

  /// Surfaces in the "Popular questions" list on the landing screen.
  final bool popular;

  /// Only shown to MENTOR accounts.
  final bool mentorOnly;
}

const _kTopics = <_HelpTopic>[
  _HelpTopic(
    icon: Icons.rocket_launch_rounded,
    title: 'Getting started',
    subtitle: 'Set up your profile, find a mentor',
    category: _HelpCategory.gettingStarted,
  ),
  _HelpTopic(
    icon: Icons.event_rounded,
    title: 'Chats & calls',
    subtitle: 'Booking, joining, no-shows, call slots',
    category: _HelpCategory.chatsCalls,
  ),
  _HelpTopic(
    icon: Icons.savings_rounded,
    title: 'Wallet & Uniminutes',
    subtitle: 'Recharge, reserved vs available, refunds',
    category: _HelpCategory.wallet,
  ),
  _HelpTopic(
    icon: Icons.star_rounded,
    title: 'Reviews & ratings',
    subtitle: 'Rating a mentor, college reviews',
    category: _HelpCategory.reviews,
  ),
  _HelpTopic(
    icon: Icons.lock_rounded,
    title: 'Account, privacy & safety',
    subtitle: 'Your data, blocking, reporting, deletion',
    category: _HelpCategory.account,
  ),
  _HelpTopic(
    icon: Icons.verified_user_rounded,
    title: 'Verification & payouts',
    subtitle: 'ID review, earnings, withdrawing',
    category: _HelpCategory.mentor,
    mentorOnly: true,
  ),
];

const _kArticles = <_HelpArticle>[
  // ── Wallet ──
  _HelpArticle(
    category: _HelpCategory.wallet,
    question: 'Why does my balance show "reserved"?',
    popular: true,
    answer:
        'When you request a call, the Uniminutes for that slot are held, not '
        'spent. Your total balance is unchanged, but that amount shows as '
        'reserved and can’t be used for another booking. It becomes a real '
        'charge only when both of you join the call, and is released in full '
        'if the call doesn’t happen.',
  ),
  _HelpArticle(
    category: _HelpCategory.wallet,
    question: 'What’s the difference between reserved and available?',
    answer:
        'Available Uniminutes are what you can spend on a new booking right '
        'now. Reserved Uniminutes are held against calls you’ve already '
        'requested that haven’t started yet. Available + reserved = your '
        'total balance.',
  ),
  _HelpArticle(
    category: _HelpCategory.wallet,
    question: 'How do I recharge my wallet?',
    popular: true,
    answer:
        'Open the Wallet tab and tap Recharge. The minimum recharge is ₹250, '
        'which credits 10 Uniminutes. Payment is handled securely by '
        'Razorpay. Your Uniminutes appear as soon as the payment succeeds.',
  ),
  _HelpArticle(
    category: _HelpCategory.wallet,
    question: 'What is a Uniminute worth?',
    answer:
        '1 Uniminute = 1 minute of call time with a mentor. Chat isn’t '
        'charged per message. Rupees only appear when you top up your wallet '
        '— everywhere else in the app your balance is shown in Uniminutes.',
  ),
  _HelpArticle(
    category: _HelpCategory.wallet,
    question: 'Can I get a refund?',
    answer:
        'If a call didn’t connect, the hold is released automatically and '
        'nothing is charged. If a call was disrupted after connecting, use '
        'the Report action on that session — our team reviews each report '
        'and can issue a refund to your wallet.',
  ),

  // ── Chats & calls ──
  _HelpArticle(
    category: _HelpCategory.chatsCalls,
    question: 'The mentor didn’t join my call — am I charged?',
    popular: true,
    answer:
        'No. If the mentor doesn’t join, the hold on your Uniminutes is '
        'released in full and nothing is charged. If the mentor joined and '
        'the call then dropped, you’ll see a Report action on that session '
        'so our team can review it.',
  ),
  _HelpArticle(
    category: _HelpCategory.chatsCalls,
    question: 'How do call slots and the "When?" step work?',
    answer:
        'When you request a call you pick a slot length (6, 10 or 20 minutes) '
        'and when you’d like it. Your Uniminutes for that slot are held right '
        'away, before the mentor sees the request. The mentor then accepts, '
        'and you both join at the agreed time.',
  ),
  _HelpArticle(
    category: _HelpCategory.chatsCalls,
    question: 'What if I miss a call I booked?',
    answer:
        'If the mentor showed up and you didn’t within the grace period, a '
        'fee equal to that grace time is charged and the rest of the hold is '
        'released. If neither of you joined, the full hold is released and '
        'nothing is charged.',
  ),
  _HelpArticle(
    category: _HelpCategory.chatsCalls,
    question: 'My call ran out of time — what happens?',
    answer:
        'At the end of your slot you’ll get a prompt to add another short '
        'block of minutes if you want to keep talking. It’s billed the same '
        'way as the original booking. If you don’t extend, the call ends.',
  ),
  _HelpArticle(
    category: _HelpCategory.chatsCalls,
    question: 'Can I message a mentor before booking a call?',
    answer:
        'Yes. Open a mentor’s profile and tap Chat to start a conversation. '
        'You can ask questions there first and book a call later if you want '
        'to talk live.',
  ),

  // ── Getting started ──
  _HelpArticle(
    category: _HelpCategory.gettingStarted,
    question: 'How do I find the right mentor?',
    answer:
        'Open the Mentors tab. You can filter by stream, degree, language and '
        'rating, and tap any mentor to see their profile, expertise and '
        'reviews before reaching out.',
  ),
  _HelpArticle(
    category: _HelpCategory.gettingStarted,
    question: 'How do I edit my profile?',
    answer:
        'Go to the Profile tab and tap the edit button next to your avatar. '
        'You can update your photo, location, field of interest and the '
        'other details you set during sign-up.',
  ),
  _HelpArticle(
    category: _HelpCategory.gettingStarted,
    question: 'What does the "Colleges" tab do?',
    answer:
        'It’s a searchable directory of colleges across every stream. Filter '
        'by state, stream and specialization, save the ones you’re '
        'interested in, and read honest reviews left by verified students.',
  ),

  // ── Reviews & ratings ──
  _HelpArticle(
    category: _HelpCategory.reviews,
    question: 'Are my reviews anonymous?',
    answer:
        'Yes. A college review or mentor rating only ever shows your role '
        '(aspirant or mentor), never your name or profile.',
  ),
  _HelpArticle(
    category: _HelpCategory.reviews,
    question: 'Can I edit a review I’ve posted?',
    answer:
        'You can post one review per college and edit it any time — reopen '
        'the review form and your previous answers are pre-filled. Mentor '
        'ratings are left from the session screen after a session ends.',
  ),
  _HelpArticle(
    category: _HelpCategory.reviews,
    question: 'How is a mentor’s rating calculated?',
    answer:
        'It’s the average of the star ratings aspirants leave after their '
        'sessions, shown alongside the number of reviews so you can see how '
        'much feedback it’s based on.',
  ),

  // ── Account, privacy & safety ──
  _HelpArticle(
    category: _HelpCategory.account,
    question: 'How do I block or report someone?',
    answer:
        'Open the chat with that person and use the menu in the top-right to '
        'block or report them. Blocking stops new messages in both '
        'directions; your existing history stays readable.',
  ),
  _HelpArticle(
    category: _HelpCategory.account,
    question: 'How do I delete my account?',
    answer:
        'Go to Profile → Settings → Delete account. This is reversible: '
        'signing in again with the same phone number and verifying it '
        'restores your account. To have your data permanently erased '
        'instead, message support.',
  ),
  _HelpArticle(
    category: _HelpCategory.account,
    question: 'Who can see my phone number?',
    answer:
        'No one. Your number is only used to sign you in and is never shown '
        'to mentors, aspirants or on your profile.',
  ),
  _HelpArticle(
    category: _HelpCategory.account,
    question: 'I’m being logged out unexpectedly.',
    answer:
        'Make sure you’re on the latest version from the store. If it keeps '
        'happening, start a conversation with support and tell us roughly '
        'how often and after how long — that helps us trace it.',
  ),

  // ── Mentor-only ──
  _HelpArticle(
    category: _HelpCategory.mentor,
    mentorOnly: true,
    question: 'How long does verification take?',
    popular: true,
    answer:
        'ID submissions are reviewed in the order they’re received, usually '
        'within a couple of days. You’ll get a notification when it’s '
        'approved or if we need a clearer document.',
  ),
  _HelpArticle(
    category: _HelpCategory.mentor,
    mentorOnly: true,
    question: 'Why can’t I turn on "Accepting calls"?',
    answer:
        'Three things need to be true: your account is a mentor account, '
        'your ID is verified, and — for mentors verified recently — you’ve '
        'posted a review of your own college. Once all three are met the '
        'switch unlocks.',
  ),
  _HelpArticle(
    category: _HelpCategory.mentor,
    mentorOnly: true,
    question: 'How and when do I get paid?',
    answer:
        'Calls pay a flat ₹10 per minute. Your earnings build up as sessions '
        'complete. When your balance is at least ₹200 you can request a '
        'payout to your bank account from the wallet screen; our team '
        'processes it and marks it paid.',
  ),
  _HelpArticle(
    category: _HelpCategory.mentor,
    mentorOnly: true,
    question: 'Does "Accepting calls" mean I show as online?',
    answer:
        'No. It’s your stated intent to take call bookings, not a live '
        'presence indicator. It only controls whether aspirants can book a '
        'call with you — you stay listed and reachable by chat either way — '
        'and it switches itself off after 24 hours so a forgotten toggle '
        'can’t make a stale promise.',
  ),
];
