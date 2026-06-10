# MedConnect — User Flows v1

**Version:** 1.0  
**Status:** Draft  
**Date:** 2026-06-09  
**Owner:** Product / Engineering

---

## 1. Flow Index

| # | Flow | Actor |
|---|------|-------|
| 1.1 | Onboarding — Prospective Student | Prospective Student |
| 1.2 | Onboarding — Current Student / Alumni | Student / Alumni |
| 2.1 | Verification — Submit Documents | Student / Alumni |
| 2.2 | Verification — Admin Review | Admin |
| 3.1 | University Discovery | Prospective Student |
| 3.2 | Ask a Question | Prospective Student |
| 3.3 | Answer a Question | Verified Student / Alumni |
| 4.1 | Write a Review | Verified Student / Alumni |
| 5.1 | Initiate a Chat | Prospective Student |
| 5.2 | Receive and Respond to Chat | Verified Mentor |
| 6.1 | Report Content | Any User |
| 6.2 | Admin — Moderate Content | Admin / Moderator |
| 6.3 | Admin — User Management | Admin |

---

## 2. Prospective Student Flows

### 2.1 Onboarding — Prospective Student

```mermaid
flowchart TD
    A([App launch]) --> B[Enter phone number]
    B --> C[Request OTP]
    C --> D{OTP received?}
    D -->|No — resend| C
    D -->|Yes| E[Enter 6-digit OTP]
    E --> F{OTP valid?}
    F -->|Invalid / expired| E
    F -->|Valid| G{New user?}
    G -->|Returning| Z([Home feed])
    G -->|New| H[Select role:\nProspective Student]
    H --> I[Choose display name]
    I --> J[Optional: state / exam year]
    J --> K[Brief app walkthrough\n3-screen tooltip]
    K --> Z
```

### 2.2 University Discovery

```mermaid
flowchart TD
    A([Home feed]) --> B[University search / browse]
    B --> C{Search or filter?}
    C -->|Search| D[Type university name\nautocomplete results]
    C -->|Filter| E[Select: State / Type / Rank range]
    D & E --> F[University list results]
    F --> G[Tap university card]
    G --> H[University profile page]
    H --> I{Choose section}
    I -->|Overview| J[NIRF rank, seats, info]
    I -->|Reviews| K[Review list with rating breakdown]
    I -->|Q&A| L[Questions + top answers]
    I -->|Mentors| M[Available mentors count\nand role labels]
```

### 2.3 Ask a Question

```mermaid
flowchart TD
    A([University profile → Q&A tab]) --> B[Tap 'Ask a Question']
    B --> C[Type question title]
    C --> D[Optional: add detail body]
    D --> E[Select relevant tags\ne.g. hostel, fees, clinical]
    E --> F[Preview question]
    F --> G{Submit?}
    G -->|Edit| C
    G -->|Submit| H[POST /questions]
    H --> I{Success?}
    I -->|Error| J[Show error; retry]
    I -->|OK| K[Question posted]
    K --> L[Notification: 'Your question is live']
    L --> M[Question detail page]
    M --> N{Answers arrive?}
    N -->|Yes| O[Push notification:\n'Your question has a new answer']
    O --> M
```

### 2.4 Initiate a Chat

```mermaid
flowchart TD
    A([University profile → Mentors tab]) --> B[View available mentors\nshown as role labels only]
    B --> C[Tap 'Chat' on mentor card]
    C --> D{Existing chat room?}
    D -->|Yes| H
    D -->|No| E[POST /chat/rooms\ninitiatorId + mentorId]
    E --> F{Mentor still available?}
    F -->|No| G[Show: Mentor unavailable\nSuggest other mentors]
    F -->|Yes| H[Open chat room]
    H --> I[Type first message]
    I --> J[Send via WebSocket]
    J --> K[Message delivered]
    K --> L{Mentor online?}
    L -->|Yes| M[Message seen immediately]
    L -->|No| N[Push notification to mentor]
    N --> M
```

---

## 3. Current Student / Alumni Flows

### 3.1 Onboarding — Student / Alumni

```mermaid
flowchart TD
    A([App launch]) --> B[Enter phone number + OTP]
    B --> C{New user?}
    C -->|Returning — verified| Z([Home / Answer feed])
    C -->|New| D[Select role:\nCurrent Student OR Alumni]
    D --> E[Choose display name]
    E --> F[Select affiliated university]
    F --> G{Role?}
    G -->|Current Student| H[Enter year of study\n1st – Final year]
    G -->|Alumni| I[Enter graduation year\nand specialty if PG]
    H & I --> J[App walkthrough]
    J --> K[Prompt: Verify your identity\nto answer questions and chat]
    K --> L{Verify now?}
    L -->|Later| Z
    L -->|Yes| M[Verification flow →]
```

### 3.2 Verification — Submit Documents

```mermaid
flowchart TD
    A([Profile → Verify Identity]) --> B[Explanation screen:\nwhat verification means\nwhat stays private]
    B --> C[Select document type]
    C --> D{Role?}
    D -->|Current Student| E[Options:\nCollege ID card\nStudent portal screenshot]
    D -->|Alumni| F[Options:\nDegree certificate\nNMC registration]
    E & F --> G[Upload document\ndirect S3 pre-signed PUT]
    G --> H{Upload success?}
    H -->|Error| I[Retry upload]
    H -->|OK| J[POST /verification/submit\ndocumentKey + type]
    J --> K[Status: PENDING]
    K --> L[In-app banner:\n'Verification under review — usually within 48h']
    L --> M([Continue using app with limited permissions])
    M --> N{Admin reviews →}
    N -->|Approved| O[Push: 'Verified! You can now answer questions.']
    O --> P[Role updated: STUDENT_VERIFIED / ALUMNI_VERIFIED]
    N -->|Rejected| Q[Push: 'Verification rejected — see reason']
    Q --> R[Rejection reason shown in app]
    R --> S{Re-submit?}
    S -->|Yes| C
    S -->|No| M
```

### 3.3 Answer a Question

```mermaid
flowchart TD
    A([Q&A feed or notification]) --> B[Open question detail]
    B --> C{Verified?}
    C -->|Not verified| D[Prompt: Verify to answer]
    C -->|Verified| E[Tap 'Write an answer']
    E --> F[Compose answer\n500+ char recommended]
    F --> G[Preview]
    G --> H{Submit?}
    H -->|Edit| F
    H -->|Submit| I[POST /answers]
    I --> J[Answer posted\nShown as: 'Verified 3rd Year Student, XYZ College']
    J --> K[Notification to question author]
    K --> L{Others upvote?}
    L -->|Upvote| M[Push: 'Your answer was upvoted']
```

### 3.4 Receive and Respond to Chat

```mermaid
flowchart TD
    A{Mentor availability} -->|ON| B[Mentor discoverable in university mentors list]
    A -->|OFF| C[Not listed; no new requests]
    B --> D([Prospective student sends chat])
    D --> E{Mentor online in app?}
    E -->|Yes| F[WebSocket: message appears in real time]
    E -->|No| G[Push notification: new message]
    G & F --> H[Open chat room]
    H --> I[Read message]
    I --> J{Respond?}
    J -->|Reply| K[Type and send reply]
    K --> L[Delivered to student]
    J -->|Block or report| M[Report → Moderation flow]
    J -->|Ignore| N[Message marked unread; no action taken]
    H --> O{Turn off availability?}
    O -->|Yes| P[PATCH /profile isMentorAvailable=false\nNo new rooms; existing rooms unaffected]
```

### 3.5 Write a Review

```mermaid
flowchart TD
    A([University profile → Reviews tab]) --> B[Tap 'Write a Review']
    B --> C{Verified for this university?}
    C -->|Not verified| D[Prompt: Verify your affiliation first]
    C -->|Verified| E{Already reviewed?}
    E -->|Yes| F[Show existing review\noffer to edit]
    E -->|No| G[Star rating: Overall]
    G --> H[Optional sub-ratings:\nFaculty / Infrastructure /\nClinical / Campus / Placements]
    H --> I[Pros text field]
    I --> J[Cons text field]
    J --> K[Optional: general body text]
    K --> L[Preview]
    L --> M{Submit?}
    M -->|Edit| G
    M -->|Submit| N[POST /reviews]
    N --> O[Review published as:\n'Verified Current Student' or 'Verified Alumni, Batch YYYY']
    O --> P[Shown on university reviews tab]
```

---

## 4. Admin Flows

### 4.1 Admin Onboarding

```mermaid
flowchart TD
    A([Admin portal URL]) --> B[Enter phone number]
    B --> C[OTP requested — same SMS flow]
    C --> D[Enter OTP]
    D --> E{JWT issued with aud=admin?}
    E -->|Role not ADMIN/MODERATOR| F[403 Access denied]
    E -->|Valid admin role| G[Admin dashboard]
```

### 4.2 Verification Review Queue

```mermaid
flowchart TD
    A([Admin dashboard]) --> B[Verification queue\nordered by submittedAt ASC]
    B --> C[Select pending request]
    C --> D[View: user role, university claim, submission date]
    D --> E[Click: View Document\n→ 5-min pre-signed S3 URL]
    E --> F[Examine document]
    F --> G{Decision}
    G -->|Approve| H[PATCH /admin/verification/:id\naction: APPROVE]
    G -->|Reject| I[Select rejection reason\noptional free-text note]
    I --> J[PATCH /admin/verification/:id\naction: REJECT, note]
    H & J --> K[User role and verificationStatus updated]
    K --> L[Push notification sent to user]
    L --> B
```

### 4.3 Content Moderation Queue

```mermaid
flowchart TD
    A([Admin dashboard → Moderation]) --> B[Report queue\nfiltered by status=OPEN\nordered by createdAt ASC]
    B --> C[Select report]
    C --> D[View: target type, content, reporter reason]
    D --> E{Content type}
    E -->|Question / Answer / Review| F[Read full content in context]
    E -->|Message| G[Read message thread\nboth sides visible to admin]
    E -->|User| H[View user profile + history]
    F & G & H --> I{Action}
    I -->|No violation| J[Dismiss report\nmark DISMISSED]
    I -->|Remove content| K[Soft-delete content\nmark RESOLVED]
    I -->|Warn user| L[Mark RESOLVED + flag on user record]
    I -->|Suspend user| M[Set user.isActive = false\ntime-limited or indefinite]
    I -->|Ban user| N[Set user.isBanned = true\nall tokens revoked]
    J & K & L & M & N --> O[Write ModerationAction audit log]
    O --> P[Notify reporter: 'Report actioned' in-app]
    P --> B
```

### 4.4 University Management

```mermaid
flowchart TD
    A([Admin → Universities]) --> B[List universities\nsearch + filter]
    B --> C{Action}
    C -->|Add new| D[Fill: name, slug, type, state, city,\nNIRF rank, seats, description]
    D --> E[POST /admin/universities]
    E --> F[University goes live]
    C -->|Edit existing| G[Prefilled edit form]
    G --> H[PATCH /admin/universities/:id]
    H --> F
    C -->|Deactivate| I[Confirm dialog]
    I --> J[PATCH → isActive=false\nContent preserved; removed from discovery]
```

### 4.5 User Management

```mermaid
flowchart TD
    A([Admin → Users]) --> B[Search by display name or phone suffix\nor filter by role / status]
    B --> C[Select user]
    C --> D[View: role, verificationStatus, joinDate,\ncontent count, reports filed, reports against]
    D --> E{Action}
    E -->|View content| F[List user's questions, answers, reviews]
    E -->|Suspend| G[Set isActive=false\nEnter reason + duration]
    G --> H[All active sessions revoked]
    E -->|Ban| I[Set isBanned=true\nAll sessions revoked\nContent flagged for review]
    E -->|Reinstate| J[Set isActive=true\nisBanned=false]
    G & H & I & J --> K[Audit log entry created]
```

---

## 5. Cross-Cutting Flow: Push Notification Delivery

```mermaid
sequenceDiagram
    participant Domain as Domain Event
    participant NotiSvc as Notification Service
    participant DB as PostgreSQL
    participant Redis
    participant FCM as FCM / APNs
    participant Device as User Device

    Domain->>NotiSvc: Event fired (e.g. answer posted)
    NotiSvc->>DB: INSERT notification record
    NotiSvc->>DB: SELECT push tokens for recipient
    DB-->>NotiSvc: [{ token, platform }]
    NotiSvc->>FCM: Send push payload
    FCM->>Device: Deliver push
    Device->>NotiSvc: App opened → GET /notifications
    NotiSvc->>DB: Mark notification as read
```

---

## 6. Flow State Summary

### User states

```mermaid
stateDiagram-v2
    [*] --> Unauthenticated
    Unauthenticated --> ProspectiveStudent : OTP verified, role = PROSPECTIVE
    Unauthenticated --> StudentUnverified : OTP verified, role = STUDENT
    Unauthenticated --> AlumniUnverified : OTP verified, role = ALUMNI

    StudentUnverified --> StudentVerified : Verification APPROVED
    AlumniUnverified --> AlumniVerified : Verification APPROVED
    StudentUnverified --> StudentUnverified : Verification REJECTED (can retry)
    AlumniUnverified --> AlumniUnverified : Verification REJECTED (can retry)

    ProspectiveStudent --> Suspended : Admin suspends
    StudentVerified --> Suspended : Admin suspends
    AlumniVerified --> Suspended : Admin suspends
    Suspended --> StudentVerified : Admin reinstates
    Suspended --> AlumniVerified : Admin reinstates
    Suspended --> Banned : Admin bans
    Banned --> [*] : Account effectively closed
```

### Verification request states

```mermaid
stateDiagram-v2
    [*] --> Pending : User submits document
    Pending --> UnderReview : Admin opens request
    UnderReview --> Approved : Admin approves
    UnderReview --> Rejected : Admin rejects
    Rejected --> Pending : User re-submits
    Approved --> [*]
```

### Chat room states

```mermaid
stateDiagram-v2
    [*] --> Active : Room created
    Active --> Closed : Either party closes
    Active --> Blocked : Either party blocks or report actioned
    Closed --> Active : Re-opened by initiator (future)
    Blocked --> [*]
```
