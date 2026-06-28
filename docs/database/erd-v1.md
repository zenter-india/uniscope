# Uniscope — Entity Relationship Diagram v1

**Version:** 1.0  
**Status:** Draft  
**Date:** 2026-06-09  
**Owner:** Engineering

---

## 1. Full Entity Relationship Diagram

```mermaid
erDiagram
    User {
        string id PK
        string phoneHash UK
        string displayName
        string role
        string verificationStatus
        boolean isActive
        boolean isBanned
        string refreshTokenHash
        timestamptz lastActiveAt
        timestamptz createdAt
        timestamptz updatedAt
        timestamptz deletedAt
    }

    UserProfile {
        string id PK
        string userId FK
        string realNameEncrypted
        string universityId FK
        int graduationYear
        int yearOfStudy
        string specialty
        string bio
        string avatarKey
        boolean isMentorAvailable
        timestamptz createdAt
        timestamptz updatedAt
    }

    University {
        string id PK
        string name
        string slug UK
        string type
        string state
        string city
        int nirfRank
        int mbbsSeats
        int establishedYear
        string website
        text description
        boolean isActive
        timestamptz createdAt
        timestamptz updatedAt
    }

    VerificationRequest {
        string id PK
        string userId FK
        string universityId FK
        string documentType
        string documentKey
        string status
        string reviewedBy FK
        string reviewNote
        timestamptz submittedAt
        timestamptz reviewedAt
        timestamptz createdAt
        timestamptz updatedAt
        timestamptz deletedAt
    }

    Question {
        string id PK
        string authorId FK
        string universityId FK
        string title
        text body
        string[] tags
        int viewCount
        int answerCount
        boolean isPinned
        boolean isLocked
        timestamptz createdAt
        timestamptz updatedAt
        timestamptz deletedAt
    }

    Answer {
        string id PK
        string questionId FK
        string authorId FK
        text body
        int upvoteCount
        boolean isAccepted
        timestamptz createdAt
        timestamptz updatedAt
        timestamptz deletedAt
    }

    AnswerVote {
        string id PK
        string answerId FK
        string userId FK
        timestamptz createdAt
    }

    Review {
        string id PK
        string authorId FK
        string universityId FK
        int overallRating
        int facultyRating
        int infrastructureRating
        int clinicalExposureRating
        int campusLifeRating
        int placementsRating
        text pros
        text cons
        text body
        int helpfulCount
        timestamptz createdAt
        timestamptz updatedAt
        timestamptz deletedAt
    }

    ChatRoom {
        string id PK
        string initiatorId FK
        string mentorId FK
        string universityId FK
        string status
        timestamptz lastMessageAt
        timestamptz createdAt
        timestamptz updatedAt
    }

    Message {
        string id PK
        string roomId FK
        string senderId FK
        text body
        string mediaKey
        string mediaType
        boolean isRead
        timestamptz readAt
        timestamptz createdAt
        timestamptz deletedAt
    }

    Report {
        string id PK
        string reporterId FK
        string targetType
        string targetId
        string reason
        string description
        string status
        string actionedBy FK
        string resolution
        timestamptz createdAt
        timestamptz updatedAt
    }

    PushToken {
        string id PK
        string userId FK
        string token
        string platform
        timestamptz createdAt
        timestamptz updatedAt
    }

    User ||--|| UserProfile : "has"
    User ||--o{ VerificationRequest : "submits"
    User ||--o{ Question : "authors"
    User ||--o{ Answer : "authors"
    User ||--o{ AnswerVote : "casts"
    User ||--o{ Review : "authors"
    User ||--o{ ChatRoom : "initiates"
    User ||--o{ ChatRoom : "mentors in"
    User ||--o{ Message : "sends"
    User ||--o{ Report : "files"
    User ||--o{ PushToken : "registers"

    University ||--o{ UserProfile : "affiliated to"
    University ||--o{ VerificationRequest : "claimed in"
    University ||--o{ Question : "tagged in"
    University ||--o{ Review : "reviewed in"
    University ||--o{ ChatRoom : "context for"

    Question ||--o{ Answer : "receives"
    Answer ||--o{ AnswerVote : "receives"
    ChatRoom ||--o{ Message : "contains"
```

---

## 2. Identity & Verification Cluster

```mermaid
erDiagram
    User {
        string id PK
        string phoneHash UK
        string role
        string verificationStatus
        boolean isActive
    }

    UserProfile {
        string id PK
        string userId FK
        string universityId FK
        string realNameEncrypted
        int yearOfStudy
        int graduationYear
        boolean isMentorAvailable
    }

    VerificationRequest {
        string id PK
        string userId FK
        string universityId FK
        string documentType
        string documentKey
        string status
        string reviewedBy FK
        timestamptz submittedAt
    }

    University {
        string id PK
        string name
        string slug UK
        string state
        string type
    }

    User ||--|| UserProfile : "has profile"
    User ||--o{ VerificationRequest : "submits"
    UserProfile }o--|| University : "affiliated to"
    VerificationRequest }o--|| University : "claims affiliation at"
    VerificationRequest }o--|| User : "reviewed by admin"
```

---

## 3. Q&A Cluster

```mermaid
erDiagram
    User {
        string id PK
        string displayName
        string role
        string verificationStatus
    }

    University {
        string id PK
        string name
        string slug UK
    }

    Question {
        string id PK
        string authorId FK
        string universityId FK
        string title
        text body
        string[] tags
        int answerCount
        boolean isPinned
    }

    Answer {
        string id PK
        string questionId FK
        string authorId FK
        text body
        int upvoteCount
        boolean isAccepted
    }

    AnswerVote {
        string id PK
        string answerId FK
        string userId FK
    }

    User ||--o{ Question : "posts"
    User ||--o{ Answer : "posts"
    User ||--o{ AnswerVote : "casts"
    University ||--o{ Question : "tagged in"
    Question ||--o{ Answer : "answered by"
    Answer ||--o{ AnswerVote : "upvoted via"
```

---

## 4. Chat Cluster

```mermaid
erDiagram
    User {
        string id PK
        string displayName
        string role
    }

    University {
        string id PK
        string name
    }

    ChatRoom {
        string id PK
        string initiatorId FK
        string mentorId FK
        string universityId FK
        string status
        timestamptz lastMessageAt
    }

    Message {
        string id PK
        string roomId FK
        string senderId FK
        text body
        string mediaKey
        boolean isRead
        timestamptz createdAt
    }

    User ||--o{ ChatRoom : "initiates as prospective"
    User ||--o{ ChatRoom : "participates as mentor"
    University ||--o{ ChatRoom : "provides context"
    ChatRoom ||--o{ Message : "contains"
    User ||--o{ Message : "sends"
```

---

## 5. Reviews Cluster

```mermaid
erDiagram
    User {
        string id PK
        string role
        string verificationStatus
    }

    University {
        string id PK
        string name
        string slug UK
        string type
        string state
    }

    Review {
        string id PK
        string authorId FK
        string universityId FK
        int overallRating
        int facultyRating
        int infrastructureRating
        int clinicalExposureRating
        int campusLifeRating
        int placementsRating
        text pros
        text cons
        text body
        int helpfulCount
    }

    User ||--o{ Review : "writes"
    University ||--o{ Review : "receives"
```

---

## 6. Moderation Cluster

```mermaid
erDiagram
    User {
        string id PK
        string displayName
        string role
    }

    Report {
        string id PK
        string reporterId FK
        string targetType
        string targetId
        string reason
        string status
        string actionedBy FK
        string resolution
        timestamptz createdAt
    }

    User ||--o{ Report : "files as reporter"
    User ||--o{ Report : "actions as admin"
```

---

## 7. Notifications & Devices Cluster

```mermaid
erDiagram
    User {
        string id PK
        string displayName
    }

    PushToken {
        string id PK
        string userId FK
        string token
        string platform
        timestamptz createdAt
    }

    Notification {
        string id PK
        string recipientId FK
        string type
        string title
        string body
        string deepLink
        boolean isRead
        timestamptz createdAt
        timestamptz readAt
    }

    User ||--o{ PushToken : "registers"
    User ||--o{ Notification : "receives"
```
