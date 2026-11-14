# CampusConnect — MongoDB Collections Specification

## 1. Overview of Application Collections

CampusConnect utilizes MongoDB as its primary persistent application datastore via the Mongoose Object Data Modeling (ODM) layer. The database hosts **12 collections**:

1. `users`
2. `cohorts`
3. `anonymousidentities`
4. `rooms`
5. `messages`
6. `messagereactions`
7. `reports`
8. `bans`
9. `announcements`
10. `announcementattachments`
11. `auditlogs`
12. `notificationdevices`

---

## 2. Collection Schemas & Field Catalog

### 2.1 Collection: `users`
Stores verified NSUT student, alumni, and administrative identities. Real PII is strictly isolated here and decoupled from public messaging.

| Field | BSON Type | Constraints & Validation | Default | Description |
|---|---|---|---|---|
| `_id` | `ObjectId` | Primary Key, Auto-generated | `ObjectId()` | Document unique identifier |
| `authId` | `String` | Unique, Sparse, Indexed | `null` | External Supabase Auth UUID |
| `collegeId` | `String` | Required, Unique, Uppercase, Pattern: `^[0-9]{4}[A-Z]{2,4}[0-9]+$` | — | NSUT Student Roll/Enrollment ID |
| `collegeEmail` | `String` | Required, Unique, Lowercase, Pattern: `/@nsut\.ac\.in$/` | — | Institutional email address |
| `enrollmentYear` | `Int32` | Required, Range: $2000 \le y \le 2100$ | — | Matriculation year |
| `programCode` | `String` | Required, Uppercase, Trimmed | — | Academic branch code (e.g. `UIT`, `CS`) |
| `rollNumber` | `String` | Required, Trimmed | — | Branch roll sequence number |
| `cohortId` | `ObjectId` | Required, Ref: `Cohort`, Indexed | — | Reference to graduating cohort class |
| `role` | `String` | Required, Enum: `student`, `alumni`, `moderator`, `admin`, `super_admin` | `'student'` | Hierarchical access control tier |
| `status` | `String` | Required, Enum: `active`, `suspended`, `banned` | `'active'` | Account activity state |
| `createdAt` | `Date` | Timestamp | `Date.now` | Creation timestamp |
| `updatedAt` | `Date` | Timestamp | `Date.now` | Last update timestamp |

---

### 2.2 Collection: `cohorts`
Represents graduating classes for batch isolation.

| Field | BSON Type | Constraints & Validation | Default | Description |
|---|---|---|---|---|
| `_id` | `ObjectId` | Primary Key | `ObjectId()` | Document unique identifier |
| `graduationYear` | `Int32` | Required, Unique, Range: $2000 \le y \le 2100$ | — | Graduation year (e.g., 2026, 2028) |
| `createdAt` | `Date` | Timestamp | `Date.now` | Record creation timestamp |
| `updatedAt` | `Date` | Timestamp | `Date.now` | Record modification timestamp |

---

### 2.3 Collection: `anonymousidentities`
Stores decoupled cryptographic anonymous handles for students.

| Field | BSON Type | Constraints & Validation | Default | Description |
|---|---|---|---|---|
| `_id` | `ObjectId` | Primary Key | `ObjectId()` | Document unique identifier |
| `userId` | `ObjectId` | Required, Ref: `User`, Indexed | — | Owning user identifier |
| `displayName` | `String` | Required, Unique, Pattern: `^Anonymous[A-Z][a-z]+[A-Z][a-z]+[0-9]+$` | — | Anonymous persona handle |
| `avatarSeed` | `String` | Optional, Trimmed | `null` | Deterministic avatar generator seed |
| `validFrom` | `Date` | Required | `Date.now` | Identity activation timestamp |
| `validUntil` | `Date` | Optional | `null` | Identity expiration timestamp (if rotated) |
| `isActive` | `Boolean` | Required, Indexed | `true` | Active status indicator |
| `createdAt` | `Date` | Timestamp | `Date.now` | Creation timestamp |
| `updatedAt` | `Date` | Timestamp | `Date.now` | Update timestamp |

---

### 2.4 Collection: `rooms`
Discussion rooms partitioned into global, batch cohort, and alumni channels.

| Field | BSON Type | Constraints & Validation | Default | Description |
|---|---|---|---|---|
| `_id` | `ObjectId` | Primary Key | `ObjectId()` | Document unique identifier |
| `type` | `String` | Required, Enum: `global`, `cohort`, `alumni` | — | Access scope |
| `name` | `String` | Required, Trimmed | — | Human-readable room title |
| `cohortId` | `ObjectId` | Optional, Ref: `Cohort`, Indexed | `null` | Cohort ref (mandatory for `cohort` type) |
| `createdAt` | `Date` | Timestamp | `Date.now` | Creation timestamp |
| `updatedAt` | `Date` | Timestamp | `Date.now` | Update timestamp |

---

### 2.5 Collection: `messages`
Threaded discussion messages. Not embedded in rooms to avoid the 16MB document size limit.

| Field | BSON Type | Constraints & Validation | Default | Description |
|---|---|---|---|---|
| `_id` | `ObjectId` | Primary Key | `ObjectId()` | Document unique identifier |
| `roomId` | `ObjectId` | Required, Ref: `Room`, Indexed | — | Parent room container |
| `senderId` | `ObjectId` | Required, Ref: `User`, Indexed | — | User author |
| `content` | `String` | Required, Min: 1, Max: 4000 chars | — | Text content |
| `replyToId` | `ObjectId` | Optional, Ref: `Message`, Indexed | `null` | Parent message identifier (for replies) |
| `moderationStatus` | `String` | Required, Enum: `approved`, `pending`, `rejected`, `removed` | `'approved'` | Content moderation status |
| `deletedAt` | `Date` | Optional, Indexed | `null` | Soft deletion timestamp |
| `editedAt` | `Date` | Optional | `null` | Message edit timestamp |
| `createdAt` | `Date` | Timestamp, Indexed | `Date.now` | Message posting timestamp |
| `updatedAt` | `Date` | Timestamp | `Date.now` | Update timestamp |

---

### 2.6 Collection: `messagereactions`
Emoji reactions attached to messages.

| Field | BSON Type | Constraints & Validation | Default | Description |
|---|---|---|---|---|
| `_id` | `ObjectId` | Primary Key | `ObjectId()` | Document unique identifier |
| `messageId` | `ObjectId` | Required, Ref: `Message`, Indexed | — | Target message |
| `userId` | `ObjectId` | Required, Ref: `User`, Indexed | — | Reacting user |
| `reaction` | `String` | Required, Enum: `like`, `love`, `laugh`, `wow`, `sad`, `angry` | — | Reaction emoji token |
| `createdAt` | `Date` | Timestamp | `Date.now` | Reaction creation timestamp |

---

### 2.7 Collection: `reports`
User-submitted content violation flags for moderator queues.

| Field | BSON Type | Constraints & Validation | Default | Description |
|---|---|---|---|---|
| `_id` | `ObjectId` | Primary Key | `ObjectId()` | Document unique identifier |
| `messageId` | `ObjectId` | Required, Ref: `Message`, Indexed | — | Flagged message |
| `reporterId` | `ObjectId` | Required, Ref: `User`, Indexed | — | User filing violation |
| `reason` | `String` | Required, Enum: `Harassment`, `Spam`, `Threat`, `Hate speech`, `Impersonation`, `Other` | — | Violation reason category |
| `description` | `String` | Optional, Max: 1000 chars | `null` | Additional details |
| `status` | `String` | Required, Enum: `pending`, `resolved`, `dismissed`, Indexed | `'pending'` | Moderation triage status |
| `reviewedBy` | `ObjectId` | Optional, Ref: `User` | `null` | Staff member handling report |
| `resolvedAt` | `Date` | Optional | `null` | Resolution timestamp |
| `createdAt` | `Date` | Timestamp | `Date.now` | Filing timestamp |
| `updatedAt` | `Date` | Timestamp | `Date.now` | Resolution update timestamp |

---

### 2.8 Collection: `bans`
Restricts user privileges (mutes, temporary bans, permanent bans).

| Field | BSON Type | Constraints & Validation | Default | Description |
|---|---|---|---|---|
| `_id` | `ObjectId` | Primary Key | `ObjectId()` | Document unique identifier |
| `userId` | `ObjectId` | Required, Ref: `User`, Indexed | — | Sanctioned student |
| `type` | `String` | Required, Enum: `mute`, `temp_ban`, `permanent_ban` | — | Penalty severity |
| `reason` | `String` | Required, Trimmed | — | Sanction justification |
| `expiresAt` | `Date` | Optional, Indexed | `null` | Expiry timestamp (null for permanent bans) |
| `createdBy` | `ObjectId` | Required, Ref: `User` | — | Admin or moderator who issued penalty |
| `createdAt` | `Date` | Timestamp | `Date.now` | Issue timestamp |

---

### 2.9 Collection: `announcements`
Administrative broadcasts and campus bulletins.

| Field | BSON Type | Constraints & Validation | Default | Description |
|---|---|---|---|---|
| `_id` | `ObjectId` | Primary Key | `ObjectId()` | Document unique identifier |
| `title` | `String` | Required, Max: 200 chars | — | Notice headline |
| `content` | `String` | Required, Text | — | Announcement body |
| `authorId` | `ObjectId` | Required, Ref: `User` | — | Admin creator |
| `audienceType` | `String` | Required, Enum: `all`, `cohort`, `alumni`, Indexed | — | Targeted audience |
| `cohortId` | `ObjectId` | Optional, Ref: `Cohort`, Indexed | `null` | Targeted cohort |
| `isPinned` | `Boolean` | Required, Indexed | `false` | Pin priority flag |
| `publishedAt` | `Date` | Required, Indexed | `Date.now` | Broadcast time |
| `expiresAt` | `Date` | Optional, Indexed | `null` | Expiry time |
| `createdAt` | `Date` | Timestamp | `Date.now` | Record creation timestamp |
| `updatedAt` | `Date` | Timestamp | `Date.now` | Record update timestamp |

---

### 2.10 Collection: `announcementattachments`
File attachments associated with official announcements.

| Field | BSON Type | Constraints & Validation | Default | Description |
|---|---|---|---|---|
| `_id` | `ObjectId` | Primary Key | `ObjectId()` | Document unique identifier |
| `announcementId` | `ObjectId` | Required, Ref: `Announcement`, Indexed | — | Parent announcement |
| `storagePath` | `String` | Required | — | Supabase Storage object path |
| `fileName` | `String` | Required | — | Original file name |
| `mimeType` | `String` | Required | — | MIME content type |
| `fileSize` | `Int32` | Required, Range: $> 0$ | — | File size in bytes |
| `createdAt` | `Date` | Timestamp | `Date.now` | Upload timestamp |

---

### 2.11 Collection: `auditlogs`
Immutable compliance audit trail for privileged staff actions.

| Field | BSON Type | Constraints & Validation | Default | Description |
|---|---|---|---|---|
| `_id` | `ObjectId` | Primary Key | `ObjectId()` | Document unique identifier |
| `actorId` | `ObjectId` | Required, Ref: `User`, Indexed | — | Staff performing action |
| `action` | `String` | Required, Indexed | — | Action identifier |
| `targetType` | `String` | Required | — | Target entity category |
| `targetId` | `String` | Optional | `null` | Target entity identifier |
| `metadata` | `Object` | Required, BSON Document | `{}` | Additional structured parameters |
| `createdAt` | `Date` | Timestamp, Indexed | `Date.now` | Audit log timestamp |

---

### 2.12 Collection: `notificationdevices`
User push notification subscriptions and WebPush tokens.

| Field | BSON Type | Constraints & Validation | Default | Description |
|---|---|---|---|---|
| `_id` | `ObjectId` | Primary Key | `ObjectId()` | Document unique identifier |
| `userId` | `ObjectId` | Required, Ref: `User`, Indexed | — | Device owner |
| `pushToken` | `String` | Required, Unique | — | Push delivery endpoint token |
| `platform` | `String` | Required, Enum: `web`, `ios`, `android` | `'web'` | Platform OS |
| `createdAt` | `Date` | Timestamp | `Date.now` | Registration timestamp |
| `lastSeenAt` | `Date` | Timestamp, Indexed | `Date.now` | Device heartbeat timestamp |
