# CampusConnect — Relational Schema & Integrity Constraints

## 1. Relational Model Formulation

The logical data model for CampusConnect is structured into 12 relations. In this relational specification, primary keys are marked with **[PK]** (underlined), foreign keys with **[FK]**, candidate keys with **[CK]**, and unique constraints with **[UK]**.

---

## 2. Relations Definition

### 1. `COHORTS`
$\text{COHORTS}(\underline{\text{id}}, \text{graduationYear}, \text{createdAt}, \text{updatedAt})$
- **Primary Key:** `id`
- **Candidate Keys:** `{id}`, `{graduationYear}`
- **Integrity Constraints:**
  - `graduationYear`: $\text{INTEGER} \ge 2000 \land \le 2100$, NOT NULL, UNIQUE.

### 2. `USERS`
$\text{USERS}(\underline{\text{id}}, \text{authId}, \text{collegeId}, \text{collegeEmail}, \text{enrollmentYear}, \text{programCode}, \text{rollNumber}, \text{cohortId}, \text{role}, \text{status}, \text{createdAt}, \text{updatedAt})$
- **Primary Key:** `id`
- **Candidate Keys:** `{id}`, `{collegeId}`, `{collegeEmail}`, `{authId}` (when non-null)
- **Foreign Keys:**
  - `cohortId` $\to \text{COHORTS}(\text{id})$ $\text{ON DELETE RESTRICT}$
- **Integrity Constraints:**
  - `collegeId`: $\text{VARCHAR}(32)$, UNIQUE, NOT NULL, Pattern: `^[0-9]{4}[A-Z]{2,4}[0-9]+$`
  - `collegeEmail`: $\text{VARCHAR}(255)$, UNIQUE, NOT NULL, Check: `LIKE '%@nsut.ac.in'`
  - `role`: $\text{VARCHAR}(20) \in \{\text{'student'}, \text{'alumni'}, \text{'moderator'}, \text{'admin'}, \text{'super\_admin'}\}$, NOT NULL
  - `status`: $\text{VARCHAR}(20) \in \{\text{'active'}, \text{'suspended'}, \text{'banned'}\}$, NOT NULL

### 3. `ANONYMOUS_IDENTITIES`
$\text{ANONYMOUS\_IDENTITIES}(\underline{\text{id}}, \text{userId}, \text{displayName}, \text{avatarSeed}, \text{validFrom}, \text{validUntil}, \text{isActive}, \text{createdAt}, \text{updatedAt})$
- **Primary Key:** `id`
- **Candidate Keys:** `{id}`, `{displayName}`
- **Foreign Keys:**
  - `userId` $\to \text{USERS}(\text{id})$ $\text{ON DELETE CASCADE}$
- **Integrity Constraints:**
  - `displayName`: $\text{VARCHAR}(64)$, UNIQUE, NOT NULL, Pattern: `^Anonymous[A-Z][a-z]+[A-Z][a-z]+[0-9]+$`
  - `isActive`: $\text{BOOLEAN}$, DEFAULT `TRUE`, NOT NULL

### 4. `ROOMS`
$\text{ROOMS}(\underline{\text{id}}, \text{type}, \text{name}, \text{cohortId}, \text{createdAt}, \text{updatedAt})$
- **Primary Key:** `id`
- **Candidate Keys:** `{id}`, `{type, cohortId}` (partial where `type == 'cohort'`)
- **Foreign Keys:**
  - `cohortId` $\to \text{COHORTS}(\text{id})$ $\text{ON DELETE SET NULL}$
- **Integrity Constraints:**
  - `type`: $\text{VARCHAR}(20) \in \{\text{'global'}, \text{'cohort'}, \text{'alumni'}\}$, NOT NULL
  - Check: `(type = 'cohort' AND cohortId IS NOT NULL) OR (type != 'cohort' AND cohortId IS NULL)`

### 5. `MESSAGES`
$\text{MESSAGES}(\underline{\text{id}}, \text{roomId}, \text{senderId}, \text{content}, \text{replyToId}, \text{moderationStatus}, \text{deletedAt}, \text{editedAt}, \text{createdAt}, \text{updatedAt})$
- **Primary Key:** `id`
- **Candidate Keys:** `{id}`
- **Foreign Keys:**
  - `roomId` $\to \text{ROOMS}(\text{id})$ $\text{ON DELETE CASCADE}$
  - `senderId` $\to \text{USERS}(\text{id})$ $\text{ON DELETE RESTRICT}$
  - `replyToId` $\to \text{MESSAGES}(\text{id})$ $\text{ON DELETE SET NULL}$
- **Integrity Constraints:**
  - `content`: $\text{TEXT}$, LENGTH $\ge 1 \land \le 4000$, NOT NULL
  - `moderationStatus`: $\text{VARCHAR}(20) \in \{\text{'approved'}, \text{'pending'}, \text{'rejected'}, \text{'removed'}\}$, NOT NULL

### 6. `MESSAGE_REACTIONS`
$\text{MESSAGE\_REACTIONS}(\underline{\text{id}}, \text{messageId}, \text{userId}, \text{reaction}, \text{createdAt})$
- **Primary Key:** `id`
- **Candidate Keys:** `{id}`, `{messageId, userId, reaction}`
- **Foreign Keys:**
  - `messageId` $\to \text{MESSAGES}(\text{id})$ $\text{ON DELETE CASCADE}$
  - `userId` $\to \text{USERS}(\text{id})$ $\text{ON DELETE CASCADE}$
- **Integrity Constraints:**
  - `reaction`: $\text{VARCHAR}(20) \in \{\text{'like'}, \text{'love'}, \text{'laugh'}, \text{'wow'}, \text{'sad'}, \text{'angry'}\}$, NOT NULL

### 7. `REPORTS`
$\text{REPORTS}(\underline{\text{id}}, \text{messageId}, \text{reporterId}, \text{reason}, \text{description}, \text{status}, \text{reviewedBy}, \text{resolvedAt}, \text{createdAt}, \text{updatedAt})$
- **Primary Key:** `id`
- **Candidate Keys:** `{id}`, `{messageId, reporterId}`
- **Foreign Keys:**
  - `messageId` $\to \text{MESSAGES}(\text{id})$ $\text{ON DELETE CASCADE}$
  - `reporterId` $\to \text{USERS}(\text{id})$ $\text{ON DELETE CASCADE}$
  - `reviewedBy` $\to \text{USERS}(\text{id})$ $\text{ON DELETE SET NULL}$
- **Integrity Constraints:**
  - `reason`: $\text{VARCHAR}(50) \in \{\text{'Harassment'}, \text{'Spam'}, \text{'Threat'}, \text{'Hate speech'}, \text{'Impersonation'}, \text{'Other'}\}$, NOT NULL
  - `status`: $\text{VARCHAR}(20) \in \{\text{'pending'}, \text{'resolved'}, \text{'dismissed'}\}$, NOT NULL

### 8. `BANS`
$\text{BANS}(\underline{\text{id}}, \text{userId}, \text{type}, \text{reason}, \text{expiresAt}, \text{createdBy}, \text{createdAt})$
- **Primary Key:** `id`
- **Candidate Keys:** `{id}`
- **Foreign Keys:**
  - `userId` $\to \text{USERS}(\text{id})$ $\text{ON DELETE CASCADE}$
  - `createdBy` $\to \text{USERS}(\text{id})$ $\text{ON DELETE RESTRICT}$
- **Integrity Constraints:**
  - `type`: $\text{VARCHAR}(20) \in \{\text{'mute'}, \text{'temp\_ban'}, \text{'permanent\_ban'}\}$, NOT NULL

### 9. `ANNOUNCEMENTS`
$\text{ANNOUNCEMENTS}(\underline{\text{id}}, \text{title}, \text{content}, \text{authorId}, \text{audienceType}, \text{cohortId}, \text{isPinned}, \text{publishedAt}, \text{expiresAt}, \text{createdAt}, \text{updatedAt})$
- **Primary Key:** `id`
- **Candidate Keys:** `{id}`
- **Foreign Keys:**
  - `authorId` $\to \text{USERS}(\text{id})$ $\text{ON DELETE RESTRICT}$
  - `cohortId` $\to \text{COHORTS}(\text{id})$ $\text{ON DELETE CASCADE}$
- **Integrity Constraints:**
  - `title`: $\text{VARCHAR}(200)$, NOT NULL
  - `audienceType`: $\text{VARCHAR}(20) \in \{\text{'all'}, \text{'cohort'}, \text{'alumni'}\}$, NOT NULL
  - Check: `(audienceType = 'cohort' AND cohortId IS NOT NULL) OR (audienceType != 'cohort')`

### 10. `ANNOUNCEMENT_ATTACHMENTS`
$\text{ANNOUNCEMENT\_ATTACHMENTS}(\underline{\text{id}}, \text{announcementId}, \text{storagePath}, \text{fileName}, \text{mimeType}, \text{fileSize}, \text{createdAt})$
- **Primary Key:** `id`
- **Candidate Keys:** `{id}`
- **Foreign Keys:**
  - `announcementId` $\to \text{ANNOUNCEMENTS}(\text{id})$ $\text{ON DELETE CASCADE}$
- **Integrity Constraints:**
  - `fileSize`: $\text{INTEGER} > 0$, NOT NULL

### 11. `AUDIT_LOGS`
$\text{AUDIT\_LOGS}(\underline{\text{id}}, \text{actorId}, \text{action}, \text{targetType}, \text{targetId}, \text{metadata}, \text{createdAt})$
- **Primary Key:** `id`
- **Candidate Keys:** `{id}`
- **Foreign Keys:**
  - `actorId` $\to \text{USERS}(\text{id})$ $\text{ON DELETE RESTRICT}$
- **Integrity Constraints:**
  - Immutable: No UPDATE or DELETE allowed on this relation.

### 12. `NOTIFICATION_DEVICES`
$\text{NOTIFICATION\_DEVICES}(\underline{\text{id}}, \text{userId}, \text{pushToken}, \text{platform}, \text{createdAt}, \text{lastSeenAt})$
- **Primary Key:** `id`
- **Candidate Keys:** `{id}`, `{pushToken}`
- **Foreign Keys:**
  - `userId` $\to \text{USERS}(\text{id})$ $\text{ON DELETE CASCADE}$
- **Integrity Constraints:**
  - `platform`: $\text{VARCHAR}(20) \in \{\text{'web'}, \text{'ios'}, \text{'android'}\}$, NOT NULL
