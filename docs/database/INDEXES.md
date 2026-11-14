# CampusConnect — Database Indexes & Query Optimization

## 1. Overview of Indexing Strategy

In MongoDB, indexes support the efficient execution of queries by storing a small portion of the collection's data set in an easily traversable B-Tree structure. Without indexes, MongoDB must perform a collection scan (analyzing every single document in a collection) to select documents matching a query statement.

CampusConnect employs a targeted indexing strategy across all 12 collections, balancing rapid read performance, unique constraint enforcement, and minimal write amplification.

---

## 2. Complete Index Catalog Across All Collections

| Collection | Index Name | Key Pattern | Type | Business / Query Justification |
|---|---|---|---|---|
| `users` | `_id_` | `{ _id: 1 }` | Primary Key | Default document lookup |
| `users` | `collegeEmail_1` | `{ collegeEmail: 1 }` | Unique | Enforces single account per NSUT email; fast login resolution |
| `users` | `collegeId_1` | `{ collegeId: 1 }` | Unique | Prevents duplicate student onboarding with same roll number |
| `users` | `cohortId_1` | `{ cohortId: 1 }` | Secondary | Batch member queries and cohort aggregation |
| `users` | `role_1_status_1` | `{ role: 1, status: 1 }` | Compound | Fast administrative filtering (e.g., active students vs suspended users) |
| `users` | `authId_1` | `{ authId: 1 }` | Unique, Sparse | Fast lookup from external Supabase session UUID; ignores nulls |
| `cohorts` | `_id_` | `{ _id: 1 }` | Primary Key | Default document lookup |
| `cohorts` | `graduationYear_1` | `{ graduationYear: 1 }` | Unique | Unique graduating class year lookups |
| `anonymousidentities` | `_id_` | `{ _id: 1 }` | Primary Key | Default document lookup |
| `anonymousidentities` | `displayName_1` | `{ displayName: 1 }` | Unique | Guarantees uniqueness of student handles |
| `anonymousidentities` | `userId_1_createdAt_-1` | `{ userId: 1, createdAt: -1 }` | Compound | Fetches most recently active persona for a given user |
| `anonymousidentities` | `validFrom_1_validUntil_1` | `{ validFrom: 1, validUntil: 1 }` | Compound | Validates temporal rotation boundaries |
| `rooms` | `_id_` | `{ _id: 1 }` | Primary Key | Default document lookup |
| `rooms` | `type_1` | `{ type: 1 }` | Secondary | Filters system rooms (`global`, `alumni`) |
| `rooms` | `type_1_cohortId_1` | `{ type: 1, cohortId: 1 }` | Partial Unique | Guarantees exactly one room per graduating cohort (`type: "cohort"`) |
| `messages` | `_id_` | `{ _id: 1 }` | Primary Key | Default document lookup |
| `messages` | `roomId_1_createdAt_-1__id_-1` | `{ roomId: 1, createdAt: -1, _id: -1 }` | **Compound** | **Primary cursor pagination index (covers room, timestamp, tie-breaker)** |
| `messages` | `senderId_1_createdAt_-1` | `{ senderId: 1, createdAt: -1 }` | Compound | Queries user post history and rate limit enforcement |
| `messages` | `moderationStatus_1_deletedAt_1` | `{ moderationStatus: 1, deletedAt: 1 }` | Compound | Filters non-deleted approved messages for public feeds |
| `messagereactions` | `_id_` | `{ _id: 1 }` | Primary Key | Default document lookup |
| `messagereactions` | `messageId_1_userId_1_reaction_1` | `{ messageId: 1, userId: 1, reaction: 1 }` | Unique Compound | Idempotent reactions: user can react with a specific emoji once per message |
| `messagereactions` | `messageId_1_reaction_1` | `{ messageId: 1, reaction: 1 }` | Compound | Fast reaction aggregation and badge counting per message |
| `reports` | `_id_` | `{ _id: 1 }` | Primary Key | Default document lookup |
| `reports` | `messageId_1_reporterId_1` | `{ messageId: 1, reporterId: 1 }` | Unique Compound | Prevents duplicate reports from the same student on the same message |
| `reports` | `status_1_createdAt_-1` | `{ status: 1, createdAt: -1 }` | Compound | Powers staff moderation triage queue in chronological order |
| `bans` | `_id_` | `{ _id: 1 }` | Primary Key | Default document lookup |
| `bans` | `userId_1_expiresAt_1` | `{ userId: 1, expiresAt: 1 }` | Compound | Fast verification of whether user has active unexpired restriction |
| `bans` | `userId_1_type_1` | `{ userId: 1, type: 1 }` | Compound | Checks restriction tier (`mute` vs `temp_ban` vs `permanent_ban`) |
| `announcements` | `_id_` | `{ _id: 1 }` | Primary Key | Default document lookup |
| `announcements` | `audienceType_1_cohortId_1_publishedAt_-1` | `{ audienceType: 1, cohortId: 1, publishedAt: -1 }` | Compound | Serves personalized announcement feeds by student cohort |
| `announcements` | `isPinned_-1_publishedAt_-1` | `{ isPinned: -1, publishedAt: -1 }` | Compound | Renders pinned notices at the top of the announcement feed |
| `announcementattachments`| `_id_` | `{ _id: 1 }` | Primary Key | Default document lookup |
| `announcementattachments`| `announcementId_1` | `{ announcementId: 1 }` | Secondary | Fetches attachment files for a given announcement notice |
| `auditlogs` | `_id_` | `{ _id: 1 }` | Primary Key | Default document lookup |
| `auditlogs` | `createdAt_-1` | `{ createdAt: -1 }` | Secondary | Chronological compliance inspection |
| `auditlogs` | `actorId_1_createdAt_-1` | `{ actorId: 1, createdAt: -1 }` | Compound | Audits specific staff member actions over time |
| `auditlogs` | `action_1_createdAt_-1` | `{ action: 1, createdAt: -1 }` | Compound | Filters audit logs by specific security event |
| `notificationdevices` | `_id_` | `{ _id: 1 }` | Primary Key | Default document lookup |
| `notificationdevices` | `pushToken_1` | `{ pushToken: 1 }` | Unique | Prevents duplicate registration of device push tokens |
| `notificationdevices` | `userId_1_lastSeenAt_-1` | `{ userId: 1, lastSeenAt: -1 }` | Compound | Queries most recently active devices for a user |

---

## 3. High-Performance Stable Composite Cursor Pagination

### 3.1 The Flaw of Offset-Based Pagination (`skip`)
In traditional web APIs, pagination is implemented using offset skipping:
```javascript
// AVOID: Degrades to O(N) linear scan
Message.find({ roomId }).sort({ createdAt: -1 }).skip(offset).limit(limit)
```
When `offset = 10000`, the MongoDB WiredTiger storage engine must scan all 10,000 preceding index entries and discard them before reading the target 50 items. As conversation rooms grow, database latency scales linearly with depth ($O(N)$ complexity). Furthermore, if a new message arrives while a student is scrolling, items shift down by one position, resulting in duplicate or skipped messages.

### 3.2 The Flaw of Timestamp-Only Cursors
Using only `createdAt < lastSeenTimestamp` solves the $O(N)$ scan problem by seeking directly in the B-Tree index. However, in active chat rooms, multiple messages frequently share the exact same millisecond timestamp:
$$t_A = t_B = \text{2026-11-14T12:00:00.123Z}$$
If message $A$ is the last item on page 1, requesting messages where `createdAt < 2026-11-14T12:00:00.123Z` skips message $B$ entirely!

### 3.3 The Solution: Composite Cursor `(createdAt, _id)`
CampusConnect implements a deterministic, stable composite cursor combining the message's ISO timestamp and its unique BSON `ObjectId`:
$$\text{Cursor} = \text{Base64url}(\{ t: \text{createdAt}, i: \text{_id} \})$$

#### Query Formulation:
To fetch the next page of messages, the MongoDB query uses an `$or` compound seek:
```javascript
{
  roomId: roomObjectId,
  moderationStatus: "approved",
  deletedAt: null,
  $or: [
    { createdAt: { $lt: cursor.createdAt } },
    {
      createdAt: cursor.createdAt,
      _id: { $lt: cursor.id }
    }
  ]
}
```

#### B-Tree Index Utilization:
This query is supported by the compound index:
$$\{ \text{roomId}: 1, \text{createdAt}: -1, \text{\_id}: -1 \}$$
Because `roomId` is an equality match and both `createdAt` and `_id` follow the index sort direction, MongoDB performs an **index seek** in $O(\log N)$ time, streaming the subsequent 50 items in $O(1)$ constant time regardless of whether the message is the 10th or the 1,000,000th message in the room.

---

## 4. Write Amplification & Index Overhead

Every additional index on a collection requires the database engine to perform a corresponding insert/update operation in the index B-Tree on every document write.
To maintain optimal write throughput:
- Collections with high write frequency (`messages`, `messagereactions`) maintain only strictly necessary compound indexes.
- Unbounded multi-key array indexing is avoided by referencing relations rather than embedding unbounded subdocuments.
- Low-churn collections (`cohorts`, `rooms`) prioritize read indexing without compromising write latency.
