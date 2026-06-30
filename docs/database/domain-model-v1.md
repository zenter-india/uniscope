# MedConnect — Domain Model v1

**Version:** 1.0  
**Status:** Draft  
**Date:** 2026-06-09  
**Owner:** Engineering

---

## 1. Design Principles

- Every mutable entity carries `createdAt`, `updatedAt`, and `deletedAt` (soft delete).
- Primary keys: `cuid2` strings — globally unique, URL-safe, non-sequential (prevents enumeration).
- Phone numbers stored as bcrypt hashes; never in plaintext columns.
- Real names and sensitive profile fields stored encrypted at rest.
- Publicly-exposed API responses strip or anonymise identity fields in the service layer.
- Indexes documented per entity; composite indexes noted where query patterns demand them.

---

## 2. Entities

---

### 2.1 User

Central identity record. One record per phone number.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | cuid2 | PK | |
| `phoneHash` | varchar(128) | UNIQUE, NOT NULL | bcrypt hash of phone; lookup via re-hash |
| `displayName` | varchar(60) | NOT NULL | Pseudonym; user-editable |
| `role` | enum | NOT NULL | `PROSPECTIVE`, `STUDENT_UNVERIFIED`, `STUDENT_VERIFIED`, `ALUMNI_UNVERIFIED`, `ALUMNI_VERIFIED`, `MODERATOR`, `ADMIN`, `SUPER_ADMIN` |
| `verificationStatus` | enum | NOT NULL, DEFAULT `NONE` | `NONE`, `PENDING`, `APPROVED`, `REJECTED` |
| `isActive` | boolean | NOT NULL, DEFAULT true | False = suspended |
| `isBanned` | boolean | NOT NULL, DEFAULT false | |
| `pushTokens` | relation | — | See `PushToken` |
| `refreshTokenHash` | varchar(256) | NULLABLE | SHA-256 of current refresh token |
| `lastActiveAt` | timestamptz | NULLABLE | |
| `createdAt` | timestamptz | NOT NULL, DEFAULT now() | |
| `updatedAt` | timestamptz | NOT NULL, @updatedAt | |
| `deletedAt` | timestamptz | NULLABLE | Soft delete |

**Indexes:**
- `UNIQUE(phoneHash)` — login lookup
- `INDEX(role)` — admin user list filters
- `INDEX(verificationStatus)` — verification queue
- `INDEX(createdAt)` — admin user list ordering
- Partial index: `INDEX(id) WHERE deletedAt IS NULL` — active user queries

---

### 2.2 UserProfile

Extended role-specific profile data. One-to-one with User. Holds sensitive fields encrypted at rest.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | cuid2 | PK | |
| `userId` | cuid2 | FK → User.id, UNIQUE | |
| `realNameEncrypted` | text | NULLABLE | AES-256-GCM encrypted; admin-only decryption |
| `universityId` | cuid2 | FK → University.id, NULLABLE | Affiliated institution |
| `graduationYear` | smallint | NULLABLE | YYYY |
| `yearOfStudy` | smallint | NULLABLE | 1–5 for MBBS; NULL for alumni |
| `specialty` | varchar(100) | NULLABLE | PG specialty for alumni |
| `bio` | varchar(500) | NULLABLE | Public-facing short bio |
| `avatarKey` | varchar(500) | NULLABLE | S3 object key |
| `isMentorAvailable` | boolean | NOT NULL, DEFAULT false | Controls chat availability |
| `createdAt` | timestamptz | NOT NULL | |
| `updatedAt` | timestamptz | NOT NULL | |

**Indexes:**
- `UNIQUE(userId)` — 1:1 enforcement
- `INDEX(universityId)` — university mentor count queries
- `INDEX(isMentorAvailable, universityId)` — "find available mentors at X university"

---

### 2.3 University

Master data for medical institutions. Admin-managed.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | cuid2 | PK | |
| `name` | varchar(200) | NOT NULL | Official name |
| `slug` | varchar(200) | UNIQUE, NOT NULL | URL-safe identifier |
| `type` | enum | NOT NULL | `GOVERNMENT`, `PRIVATE`, `DEEMED`, `CENTRAL` |
| `state` | varchar(100) | NOT NULL | |
| `city` | varchar(100) | NOT NULL | |
| `nirfRank` | smallint | NULLABLE | National ranking |
| `mbbsSeats` | smallint | NULLABLE | Annual intake |
| `establishedYear` | smallint | NULLABLE | |
| `website` | varchar(300) | NULLABLE | |
| `description` | text | NULLABLE | |
| `isActive` | boolean | NOT NULL, DEFAULT true | |
| `searchVector` | tsvector | GENERATED | Full-text search |
| `createdAt` | timestamptz | NOT NULL | |
| `updatedAt` | timestamptz | NOT NULL | |

**Indexes:**
- `UNIQUE(slug)` — URL routing
- `INDEX(state)` — state filter
- `INDEX(type)` — type filter
- `INDEX(nirfRank)` — ranking sort
- `GIN(searchVector)` — full-text search
- `INDEX USING gin(name gin_trgm_ops)` — trigram similarity for autocomplete

---

### 2.4 VerificationRequest

Tracks mentor identity verification submissions.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | cuid2 | PK | |
| `userId` | cuid2 | FK → User.id | |
| `universityId` | cuid2 | FK → University.id | Claimed affiliation |
| `documentType` | enum | NOT NULL | `STUDENT_ID`, `STUDENT_PORTAL_SCREENSHOT`, `DEGREE_CERTIFICATE`, `NMC_REGISTRATION` |
| `documentKey` | varchar(500) | NOT NULL | S3 object key (private bucket) |
| `status` | enum | NOT NULL, DEFAULT `PENDING` | `PENDING`, `UNDER_REVIEW`, `APPROVED`, `REJECTED` |
| `reviewedBy` | cuid2 | FK → User.id, NULLABLE | Admin who actioned |
| `reviewNote` | varchar(500) | NULLABLE | Admin rejection reason |
| `submittedAt` | timestamptz | NOT NULL | |
| `reviewedAt` | timestamptz | NULLABLE | |
| `createdAt` | timestamptz | NOT NULL | |
| `updatedAt` | timestamptz | NOT NULL | |
| `deletedAt` | timestamptz | NULLABLE | |

**Indexes:**
- `INDEX(userId)` — user's own submissions
- `INDEX(status, submittedAt)` — admin queue ordered by submission time
- `INDEX(reviewedBy)` — admin workload reporting
- Partial index: `INDEX(status) WHERE status = 'PENDING'` — hot path for queue

---

### 2.5 Question

A question posted by a prospective student, tagged to a university.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | cuid2 | PK | |
| `authorId` | cuid2 | FK → User.id | Stored but never exposed publicly |
| `universityId` | cuid2 | FK → University.id | |
| `title` | varchar(300) | NOT NULL | |
| `body` | text | NULLABLE | Optional elaboration |
| `tags` | varchar[] | NOT NULL, DEFAULT [] | e.g. `["hostel", "fees", "clinical"]` |
| `viewCount` | integer | NOT NULL, DEFAULT 0 | |
| `answerCount` | integer | NOT NULL, DEFAULT 0 | Denormalised counter |
| `isPinned` | boolean | NOT NULL, DEFAULT false | Admin can pin quality questions |
| `isLocked` | boolean | NOT NULL, DEFAULT false | Admin can lock from new answers |
| `searchVector` | tsvector | GENERATED | Full-text search on title + body |
| `createdAt` | timestamptz | NOT NULL | |
| `updatedAt` | timestamptz | NOT NULL | |
| `deletedAt` | timestamptz | NULLABLE | |

**Indexes:**
- `INDEX(universityId, createdAt DESC)` — university Q&A feed (primary access pattern)
- `INDEX(authorId)` — "my questions" page
- `GIN(searchVector)` — full-text search
- `GIN(tags)` — tag filtering
- Partial index: `INDEX(universityId) WHERE deletedAt IS NULL`

---

### 2.6 Answer

A response to a Question, posted by a verified student or alumni.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | cuid2 | PK | |
| `questionId` | cuid2 | FK → Question.id | |
| `authorId` | cuid2 | FK → User.id | Stored; public response shows role label only |
| `body` | text | NOT NULL | |
| `upvoteCount` | integer | NOT NULL, DEFAULT 0 | Denormalised counter |
| `isAccepted` | boolean | NOT NULL, DEFAULT false | Question author can accept |
| `searchVector` | tsvector | GENERATED | |
| `createdAt` | timestamptz | NOT NULL | |
| `updatedAt` | timestamptz | NOT NULL | |
| `deletedAt` | timestamptz | NULLABLE | |

**Indexes:**
- `INDEX(questionId, upvoteCount DESC)` — default answer sort (most upvoted)
- `INDEX(questionId, createdAt ASC)` — chronological sort
- `INDEX(authorId)` — "my answers" page
- `UNIQUE(questionId, authorId)` — one answer per user per question
- Partial index: `INDEX(questionId) WHERE deletedAt IS NULL`

---

### 2.7 AnswerVote

Tracks upvotes on answers. One vote per user per answer.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | cuid2 | PK | |
| `answerId` | cuid2 | FK → Answer.id | |
| `userId` | cuid2 | FK → User.id | Voter |
| `createdAt` | timestamptz | NOT NULL | |

**Indexes:**
- `UNIQUE(answerId, userId)` — one vote per user per answer
- `INDEX(userId)` — "votes I cast" (less frequent)

---

### 2.8 Review

A structured review of a university by a verified student or alumni.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | cuid2 | PK | |
| `authorId` | cuid2 | FK → User.id | Never exposed publicly |
| `universityId` | cuid2 | FK → University.id | |
| `overallRating` | smallint | NOT NULL, CHECK(1–5) | |
| `facultyRating` | smallint | NULLABLE, CHECK(1–5) | |
| `infrastructureRating` | smallint | NULLABLE, CHECK(1–5) | |
| `clinicalExposureRating` | smallint | NULLABLE, CHECK(1–5) | |
| `campusLifeRating` | smallint | NULLABLE, CHECK(1–5) | |
| `placementsRating` | smallint | NULLABLE, CHECK(1–5) | |
| `pros` | text | NULLABLE | |
| `cons` | text | NULLABLE | |
| `body` | text | NULLABLE | Free text |
| `helpfulCount` | integer | NOT NULL, DEFAULT 0 | |
| `searchVector` | tsvector | GENERATED | |
| `createdAt` | timestamptz | NOT NULL | |
| `updatedAt` | timestamptz | NOT NULL | |
| `deletedAt` | timestamptz | NULLABLE | |

**Indexes:**
- `UNIQUE(authorId, universityId)` — one review per user per university
- `INDEX(universityId, createdAt DESC)` — university review feed
- `INDEX(universityId, overallRating DESC)` — top-rated sort
- `INDEX(authorId)` — "my reviews"
- `GIN(searchVector)` — full-text
- Partial index: `INDEX(universityId) WHERE deletedAt IS NULL`

---

### 2.9 ChatRoom

A 1:1 conversation between a prospective student and a verified mentor.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | cuid2 | PK | |
| `initiatorId` | cuid2 | FK → User.id | Prospective student |
| `mentorId` | cuid2 | FK → User.id | Verified student/alumni |
| `universityId` | cuid2 | FK → University.id, NULLABLE | Context university |
| `status` | enum | NOT NULL, DEFAULT `ACTIVE` | `ACTIVE`, `CLOSED`, `BLOCKED` |
| `lastMessageAt` | timestamptz | NULLABLE | Denormalised for inbox sort |
| `createdAt` | timestamptz | NOT NULL | |
| `updatedAt` | timestamptz | NOT NULL | |

**Indexes:**
- `UNIQUE(initiatorId, mentorId)` — one room per pair
- `INDEX(initiatorId, lastMessageAt DESC)` — prospective student inbox
- `INDEX(mentorId, lastMessageAt DESC)` — mentor inbox
- `INDEX(status)` — filter by status

---

### 2.10 Message

An individual message within a ChatRoom.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | cuid2 | PK | |
| `roomId` | cuid2 | FK → ChatRoom.id | |
| `senderId` | cuid2 | FK → User.id | |
| `body` | text | NULLABLE | Plaintext; encrypted at DB layer |
| `mediaKey` | varchar(500) | NULLABLE | S3 key for image/file attachments |
| `mediaType` | enum | NULLABLE | `IMAGE`, `FILE` |
| `isRead` | boolean | NOT NULL, DEFAULT false | |
| `readAt` | timestamptz | NULLABLE | |
| `createdAt` | timestamptz | NOT NULL | |
| `deletedAt` | timestamptz | NULLABLE | Soft delete for "unsend" |

**Indexes:**
- `INDEX(roomId, createdAt ASC)` — message thread (primary access pattern)
- `INDEX(roomId, isRead) WHERE isRead = false` — unread count per room
- `INDEX(senderId)` — sender lookup
- Partial index: `INDEX(roomId) WHERE deletedAt IS NULL`

---

### 2.11 Report

A user-submitted flag on any content.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | cuid2 | PK | |
| `reporterId` | cuid2 | FK → User.id | |
| `targetType` | enum | NOT NULL | `QUESTION`, `ANSWER`, `REVIEW`, `MESSAGE`, `USER` |
| `targetId` | cuid2 | NOT NULL | References ID in target table |
| `reason` | enum | NOT NULL | `SPAM`, `MISINFORMATION`, `HARASSMENT`, `IMPERSONATION`, `INAPPROPRIATE`, `OTHER` |
| `description` | varchar(500) | NULLABLE | User-supplied detail |
| `status` | enum | NOT NULL, DEFAULT `OPEN` | `OPEN`, `UNDER_REVIEW`, `RESOLVED`, `DISMISSED` |
| `actionedBy` | cuid2 | FK → User.id, NULLABLE | Admin who resolved |
| `resolution` | varchar(500) | NULLABLE | Admin note |
| `createdAt` | timestamptz | NOT NULL | |
| `updatedAt` | timestamptz | NOT NULL | |

**Indexes:**
- `INDEX(status, createdAt DESC)` — moderation queue
- `INDEX(reporterId)` — reporter history
- `INDEX(targetType, targetId)` — "all reports on this content"
- `INDEX(actionedBy)` — admin workload

---

## 3. Relationships Summary

```
User ──< UserProfile (1:1)
User ──< VerificationRequest (1:many)
User ──< Question (1:many, as author)
User ──< Answer (1:many, as author)
User ──< AnswerVote (1:many, as voter)
User ──< Review (1:many, as author)
User ──< ChatRoom (1:many, as initiator OR mentor)
User ──< Message (1:many, as sender)
User ──< Report (1:many, as reporter OR actioned-by)

University ──< UserProfile (1:many, affiliation)
University ──< VerificationRequest (1:many)
University ──< Question (1:many)
University ──< Review (1:many)
University ──< ChatRoom (1:many, context)

Question ──< Answer (1:many)
Answer ──< AnswerVote (1:many)

ChatRoom ──< Message (1:many)
```

---

## 4. Cardinality Table

| Relationship | Cardinality | Enforced by |
|-------------|------------|-------------|
| User → UserProfile | 1:1 | UNIQUE FK |
| User → VerificationRequest | 1:many | FK; max 1 PENDING enforced in service |
| User → Question | 1:many | FK |
| User → Answer | 1:many | FK; UNIQUE(questionId, authorId) |
| User → AnswerVote | 1:many | UNIQUE(answerId, userId) |
| User → Review | 1:many | UNIQUE(authorId, universityId) |
| User → ChatRoom | many:many | Via initiatorId / mentorId FKs; UNIQUE(initiatorId, mentorId) |
| ChatRoom → Message | 1:many | FK |
| Question → Answer | 1:many | FK |
| Answer → AnswerVote | 1:many | FK |
| University → Review | 1:many | FK |
| University → Question | 1:many | FK |

---

## 5. Index Recommendations Summary

| Table | Index Type | Columns | Query Pattern |
|-------|-----------|---------|---------------|
| users | UNIQUE | phoneHash | OTP login lookup |
| users | BTREE | role, createdAt | Admin user list |
| users | PARTIAL | id WHERE deletedAt IS NULL | Active user guards |
| user_profiles | BTREE | universityId, isMentorAvailable | Find available mentors |
| universities | GIN | searchVector | Full-text search |
| universities | GIN (trgm) | name | Autocomplete |
| universities | BTREE | state, type | Filter |
| verification_requests | PARTIAL BTREE | status=PENDING, submittedAt | Admin queue hot path |
| questions | BTREE | universityId, createdAt DESC | University Q&A feed |
| questions | GIN | searchVector | Q&A search |
| questions | GIN | tags | Tag filter |
| answers | BTREE | questionId, upvoteCount DESC | Default answer rank |
| answers | UNIQUE | questionId, authorId | One answer per user |
| reviews | UNIQUE | authorId, universityId | One review per user |
| reviews | BTREE | universityId, overallRating DESC | Top reviews |
| chat_rooms | UNIQUE | initiatorId, mentorId | Prevent duplicate rooms |
| chat_rooms | BTREE | mentorId, lastMessageAt DESC | Mentor inbox |
| messages | BTREE | roomId, createdAt ASC | Message thread |
| messages | PARTIAL | roomId, isRead=false | Unread count |
| reports | BTREE | status, createdAt DESC | Moderation queue |
| reports | BTREE | targetType, targetId | Reports on content |
