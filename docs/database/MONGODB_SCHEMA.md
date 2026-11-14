# CampusConnect — MongoDB Schema Design & Modeling Rationale

## 1. Document Modeling Paradigm: Embedding vs. Referencing

When migrating from a relational database (PostgreSQL) to a document database (MongoDB), software architects frequently face the fundamental decision between **document embedding** (denormalization) and **document referencing** (normalized pointers via `ObjectId`).

### 1.1 The Anti-Pattern of Unlimited Embedding in Social & Chat Systems
In a collaborative communication application, naive MongoDB designs often attempt to embed sub-documents:
- *Anti-Pattern 1:* Embedding an array of `messages: [...]` directly inside a `Room` document.
- *Anti-Pattern 2:* Embedding an unbounded array of `reactions: [...]` inside each `Message` document.
- *Anti-Pattern 3:* Embedding user activity or audit records inside a `User` document.

In high-concurrency systems, unbounded embedding causes critical failures:
1. **The 16 Megabyte BSON Document Size Limit:** MongoDB imposes a hard limit of 16MB per document. In active university rooms (e.g. "All College"), millions of messages would rapidly breach this limit, throwing unrecoverable driver errors.
2. **Document Growth and Memory Thrashing:** Continually pushing elements to an embedded array causes the on-disk document size to grow. When a document outgrows its allocated storage slot in WiredTiger, the storage engine must reallocate and move the entire document elsewhere on disk, creating extreme I/O overhead and memory fragmentation.
3. **Concurrency and Lock Contention:** Two users posting messages or reactions at the same millisecond to the same room document would experience write lock contention and atomic update conflicts.
4. **Pagination Inefficiency:** Paginating messages through an embedded array requires slicing operations (`$slice`), loading unnecessary parent document metadata into memory on every scroll page.

### 1.2 Architectural Decision: Typed References (`ObjectId`)
CampusConnect adopts a **referenced document architecture** across all high-cardinality collections:
- `MESSAGES` are first-class, independent documents in the `messages` collection, referencing `Room` via `roomId: Types.ObjectId` and `User` via `senderId: Types.ObjectId`.
- `MESSAGE_REACTIONS` are separate documents referencing `messageId: Types.ObjectId`.
- `REPORTS`, `BANS`, and `AUDIT_LOGS` are separate append-optimized collections.

This achieves:
- Strict $O(1)$ constant document size.
- Zero risk of hitting the 16MB document boundary.
- High concurrent write throughput (independent document insertions without locking parent containers).
- High performance compound index pagination via B-Trees.

---

## 2. Mapping from Relational Tables to MongoDB Collections

| PostgreSQL Relational Table | MongoDB Collection | Mongoose Model | Primary Key Mapping | Foreign Key Handling |
|---|---|---|---|---|
| `cohorts` | `cohorts` | `Cohort` | `id (UUID)` $\to$ `_id (ObjectId)` | Referenced by `users.cohortId`, `rooms.cohortId` |
| `users` | `users` | `User` | `id (UUID)` $\to$ `_id (ObjectId)` | `cohortId` typed as `Schema.Types.ObjectId` |
| `anonymous_identities` | `anonymousidentities` | `AnonymousIdentity` | `id (UUID)` $\to$ `_id (ObjectId)` | `userId` typed as `Schema.Types.ObjectId` |
| `rooms` | `rooms` | `Room` | `id (UUID)` $\to$ `_id (ObjectId)` | `cohortId` typed as `Schema.Types.ObjectId` (nullable) |
| `messages` | `messages` | `Message` | `id (UUID)` $\to$ `_id (ObjectId)` | `roomId`, `senderId`, `replyToId` as `ObjectId` refs |
| `message_reactions` | `messagereactions` | `MessageReaction` | `id (UUID)` $\to$ `_id (ObjectId)` | `messageId`, `userId` as `ObjectId` refs |
| `reports` | `reports` | `Report` | `id (UUID)` $\to$ `_id (ObjectId)` | `messageId`, `reporterId`, `reviewedBy` as `ObjectId` refs |
| `bans` | `bans` | `Ban` | `id (UUID)` $\to$ `_id (ObjectId)` | `userId`, `createdBy` as `ObjectId` refs |
| `announcements` | `announcements` | `Announcement` | `id (UUID)` $\to$ `_id (ObjectId)` | `authorId`, `cohortId` as `ObjectId` refs |
| `announcement_attachments` | `announcementattachments` | `AnnouncementAttachment` | `id (UUID)` $\to$ `_id (ObjectId)` | `announcementId` as `ObjectId` ref |
| `audit_logs` | `auditlogs` | `AuditLog` | `id (UUID)` $\to$ `_id (ObjectId)` | `actorId` as `ObjectId` ref |
| `notification_devices` | `notificationdevices` | `NotificationDevice` | `id (UUID)` $\to$ `_id (ObjectId)` | `userId` as `ObjectId` ref |

---

## 3. Mongoose Schema Features in CampusConnect

### 3.1 Strict Typing & Schema Validation
All Mongoose schemas in `src/db/models/` are typed using TypeScript interfaces extending `Document` (e.g. `export interface IMessage extends Document`). Schema options include `strict: true` (default in Mongoose) to prevent arbitrary unrecognized fields from contaminating database collections.

### 3.2 Pre-Save Validation Hooks
Conditional schema integrity rules that cannot be expressed purely through basic types are implemented as Mongoose middleware hooks:
```typescript
// RoomSchema: ensures cohortId is mandatory when type is 'cohort'
RoomSchema.pre("save", function () {
  if (this.type === "cohort" && !this.cohortId) {
    throw new Error("cohortId is required for cohort rooms");
  }
});
```

### 3.3 Safe Serialization (`toJSON` Transforms)
To prevent internal implementation details (such as Mongoose version keys `__v`) from leaking over network APIs, every model defines a `toJSON` transform:
```typescript
toJSON: {
  virtuals: true,
  transform: (_doc, ret: Record<string, any>) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  },
}
```
This guarantees consistent serialization where `_id` is exposed cleanly as a standard string `id` in client JSON payloads.

---

## 4. Connection Lifecycle & Hot-Reload Management

In serverless execution environments (Vercel) and local development (Next.js Hot Module Replacement), re-evaluating route files can create multiple uncoordinated database connections.
CampusConnect implements a cached global connection manager in `src/db/mongodb.ts`:
- Caches the `mongoose.connect()` promise on the global object (`global.mongooseConnection`).
- Uses connection pooling (`maxPoolSize: 10`, `serverSelectionTimeoutMS: 5000`, `socketTimeoutMS: 45000`).
- Disables command buffering (`bufferCommands: false`) to fail fast if the database is unreachable, avoiding hanging requests.
