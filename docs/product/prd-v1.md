# Uniscope — Product Requirements Document v1

**Version:** 1.0  
**Status:** Draft  
**Date:** 2026-06-09  
**Owner:** Product

---

## 1. Vision

Uniscope is the trusted discovery layer for aspiring medical professionals. We give prospective students candid, verified peer perspectives on medical universities — not glossy brochures — so they can make the most consequential decision of their academic lives with confidence.

> "The university that fits you is not necessarily the one ranked highest. It's the one whose culture, curriculum, and community match who you are."

---

## 2. Problem Statement

### For prospective medical students

The decision of which medical university to attend is high-stakes, irreversible for years, and poorly served by existing information sources:

- University websites are marketing material, not honest assessments.
- Public forums (Reddit, Quora) contain unverified, outdated, or biased opinions.
- Ranking websites collapse complex institutional realities into a single number.
- There is no structured, safe channel to ask current students candid questions anonymously.

**Result:** Students make a 5–10 year commitment based on incomplete or misleading information.

### For current students and alumni

There is no structured platform to contribute back to the community — to help the next generation avoid the pitfalls they experienced or to celebrate the genuine strengths of their institution.

---

## 3. Target Users

| Segment | Description | Size (India, Phase 1) |
|---------|-------------|----------------------|
| Prospective students | NEET aspirants and post-12th students researching MBBS/MD programs | ~1.8M NEET candidates/year |
| Current students | MBBS/MD students enrolled at target universities | ~400K active MBBS students |
| Alumni | Graduates and postgraduate doctors willing to mentor | ~2M+ registered practitioners |
| Admins | Uniscope operations and trust & safety team | Internal |

---

## 4. User Personas

### Persona 1 — Priya, the Anxious Applicant

- **Age:** 18 | **Location:** Coimbatore, Tamil Nadu
- **Context:** Just cleared NEET with a rank of 12,400. Eligible for multiple colleges. Overwhelmed by conflicting advice from family, coaching centres, and the internet.
- **Goals:** Understand the real academic environment, hostel conditions, faculty quality, and career outcomes at her shortlisted colleges.
- **Frustrations:** Cannot trust reviews on college websites. Reddit threads are old or about US schools. Afraid to ask "dumb questions" in public.
- **Needs:** Anonymous, structured Q&A with verified current students. Comparable, honest reviews. Confidence before counselling.

### Persona 2 — Rahul, the 3rd-Year Student

- **Age:** 22 | **Location:** Mangalore, Karnataka
- **Context:** 3 years into MBBS at a mid-tier private college. Has strong opinions about the college's clinical exposure and hostel quality.
- **Goals:** Help juniors make better decisions. Possibly build a reputation as a reliable mentor.
- **Frustrations:** No platform designed for this. Answering the same questions on WhatsApp groups repeatedly.
- **Needs:** A lightweight way to answer questions on his own time. Identity protection (doesn't want college admin to know he's being candid).

### Persona 3 — Dr. Meena, the Alumna

- **Age:** 31 | **Location:** Mumbai, Maharashtra
- **Context:** PG (MD Internal Medicine) at a top government college. Completed MBBS at a lesser-known private college and has nuanced views about it.
- **Goals:** Give back. Provide career-oriented advice (PG preparation, hospital placements, research opportunities).
- **Frustrations:** Lack of time. Doesn't want personal details exposed.
- **Needs:** Verified, asynchronous contribution. Selective availability (not always-on chat).

### Persona 4 — Arjun, the Trust & Safety Admin

- **Age:** 29 | **Location:** Remote
- **Context:** Uniscope internal operations staff.
- **Goals:** Keep the platform trustworthy — verify mentor credentials, moderate harmful content, manage reports.
- **Frustrations:** Scale of verification requests. False information or impersonation attempts.
- **Needs:** Efficient verification dashboard, moderation queue, user management tools.

---

## 5. MVP Scope

The MVP focuses on **discovery and trust** — the core value proposition before scaling community features.

### 5.1 Included in MVP

#### Onboarding & Identity
- Mobile OTP-based registration (phone number only)
- Role selection at signup: Prospective Student | Current Student | Alumni
- Anonymous display names (system-generated, user-modifiable within policy)
- Profile: university affiliation, graduation year, specialty (students/alumni only)

#### Verification
- Current students: upload college ID card or student portal screenshot
- Alumni: upload degree certificate or MCI/NMC registration
- Admin manual review queue for verification requests
- Verified badge on approved profiles

#### University Discovery
- Searchable, filterable university directory
- University profile pages: location, type (government/private/deemed), NIRF rank, seat matrix
- Aggregate rating display (from reviews — future sprint)

#### Anonymous Q&A
- Prospective students post questions tagged to a university
- Verified current students and alumni answer
- Questioner identity always anonymous publicly
- Answerer identity shown only as "Verified 3rd Year Student, [University]" or "Verified Alumni, [University], Batch [Year]"
- Upvoting answers

#### Reviews
- Verified students/alumni submit structured reviews (faculty, infrastructure, clinical exposure, campus life, placements — 1–5 scale + text)
- Reviews shown with anonymised role ("Verified Current Student") not name
- One review per user per university

#### Basic Chat
- Prospective student initiates 1:1 chat with a verified mentor who has enabled availability
- Mentor controls availability (on/off)
- Chat content encrypted in transit
- No group chat in MVP

#### Reporting & Moderation
- Report button on any content (Q, A, Review, Message)
- Admin moderation queue
- Content soft-deletion on admin action

#### Admin Portal
- User management (view, suspend, ban)
- Verification request queue
- Report/moderation queue
- University data management (CRUD)

### 5.2 Feature Priority Matrix

| Feature | Priority | Sprint Target |
|---------|----------|---------------|
| OTP auth + registration | P0 | Sprint 1 |
| University directory | P0 | Sprint 1 |
| Q&A (post + answer) | P0 | Sprint 2 |
| Verification flow | P0 | Sprint 2 |
| Reviews | P1 | Sprint 3 |
| 1:1 Chat | P1 | Sprint 3–4 |
| Reporting & moderation | P1 | Sprint 4 |
| Admin portal | P1 | Sprint 2–4 |
| Push notifications | P2 | Sprint 4–5 |

---

## 6. Out of Scope (v1)

| Item | Rationale |
|------|-----------|
| Social login (Google, Apple) | Add in v1.1; OTP-first reduces friction for India market |
| Video/audio chat | Complexity; text chat sufficient for MVP |
| Group chats or forums | Moderation complexity; Q&A serves the need |
| University official responses | Partnership track; not MVP |
| Payment / premium tiers | Post-PMF |
| Web app (mobile-only MVP) | Focus platform; admin portal is web |
| AI-generated answers | Post-MVP; trust concerns |
| Internationalisation (non-English) | Phase 2 |
| NEET counselling guidance | Regulatory complexity |
| ML-based content ranking | Post-MVP |

---

## 7. Success Metrics

### Acquisition
| Metric | 3-Month Target | 6-Month Target |
|--------|---------------|----------------|
| Registered users | 5,000 | 25,000 |
| Verified mentors (students + alumni) | 500 | 3,000 |
| Universities indexed | 200 | 500 |

### Engagement
| Metric | Target |
|--------|--------|
| Questions answered within 48h | > 70% |
| Average answers per question | ≥ 2 |
| Monthly active users / registered | > 40% |
| Review submission rate (verified users) | > 30% within 30 days of verification |

### Trust & Quality
| Metric | Target |
|--------|--------|
| Verification approval rate | > 80% (legitimate submissions) |
| Report rate on answers | < 2% |
| Mentor churn within 60 days | < 25% |

### Business
| Metric | Notes |
|--------|-------|
| CAC | Track from first paid campaign |
| NPS | Survey at 30-day mark; target > 50 |
| Mentor NPS | Separate survey; target > 60 |
