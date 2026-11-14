# CampusConnect — Complete Project Audit & Repository Assessment

**Audit Date:** 14 November 2026  
**Project:** CampusConnect (NSUT Verified Academic & Student Collaboration Platform)  
**Target Repository:** [https://github.com/Uddip07/dbms-project](https://github.com/Uddip07/dbms-project)  
**Database Requirement:** MongoDB (Compulsory Primary Application Database via Mongoose)

---

## 1. Executive Summary

CampusConnect is an institutional web platform designed for Netaji Subhas University of Technology (NSUT), Delhi. It combines institutional email authentication, privacy-preserving cryptographic anonymous handles, university-wide, batch-specific, and alumni chat rooms, official announcements, moderation queues, audit logging, and administrative controls.

This audit evaluates the codebase prior to the MongoDB migration and final DBMS submission.

---

## 2. Dependency & Toolchain Audit

### `package.json` Inspection
- **Framework:** Next.js `^14.2.24` (App Router)
- **UI Core:** React `^18.3.1`, React-DOM `^18.3.1`, Tailwind CSS `^3.4.17`, Lucide Icons `^0.475.0`
- **Auth & Realtime:** `@supabase/ssr` `^0.5.2`, `@supabase/supabase-js` `^2.48.1`
- **Existing Relational ORM:** `drizzle-orm` `^0.38.4`, `postgres` `^3.4.5`, `drizzle-kit` `^0.30.4`
- **Validation:** `zod` `^3.24.1`
- **Testing:** `vitest` `^2.1.8` (13 test suites, 91 tests passing)
- **TypeScript:** `^5.7.3` with strict checking enabled (`tsconfig.json`)

### Observations & Migration Needs:
1. `mongoose` (`^8.x`) must be added to package dependencies for persistent schema validation, indexing, and connection management.
2. PostgreSQL/Drizzle is currently used as the database layer (`src/db/schema.ts`, `src/db/index.ts`). In accordance with project instructions, MongoDB Atlas/Mongoose will become the sole persistent application database.
3. Supabase Auth is preserved for OAuth session management and realtime WebSockets.

---

## 3. Environment Variables Audit (Values Excluded)

The following environment variables were identified in the codebase without printing secret values:

| Variable Name | Purpose | Sensitivity Level | Status in Codebase |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase API endpoint | Public | Configured |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase Client Key | Public | Configured |
| `SUPABASE_SECRET_KEY` | Supabase Service Role Key | Highly Confidential | Configured server-side |
| `DATABASE_URL` | Legacy PostgreSQL URI | Highly Confidential | Configured server-side |
| `MONGODB_URI` | MongoDB Atlas Connection URI | Highly Confidential | **Mandatory to add** |
| `REDIS_URL` / `UPSTASH_REDIS_*` | Ephemeral caching & rate limits | Confidential | Optional / In-memory fallback |
| `NSUT_VERIFICATION_*` | Enterprise SSO boundary | Confidential | Optional / Mock fallback |
| `SENTRY_DSN` | Error tracking | Public/Confidential | Optional |

---

## 4. Frontend & Route Surface Audit

### Client Pages (`src/app`)
- `/` — Landing page / redirect router.
- `/login` — Institutional Google OAuth & Magic Link entry.
- `/verify` — Student onboarding (College ID parser, cohort assignment, anonymous identity generation).
- `/chat` — Primary university-wide chat ("All College").
- `/chat/[roomId]` — Generic room container.
- `/chat/all` — Explicit link to university-wide room.
- `/chat/cohort` — Batch-specific room based on student's graduation year.
- `/chat/alumni` — Alumni room restricted to graduated cohorts/moderators.
- `/announcements` — Official university announcements feed with pinned notices.
- `/admin` — Moderation dashboard, reports queue, announcements publishing, identity resolution, audit log view.
- **Missing Required Route:** `/admin/database` — Admin visual database explorer & developer health metrics (Phase 3).

### Components (`src/components`)
- `layout/Navbar.tsx` — Desktop & mobile responsive header, status pill, sign-out control.
- `chat/ChatContainer.tsx` — Realtime chat interface, auto-scroll, optimistic updates, message reporting modal.
- `chat/MessageItem.tsx` — Anonymous identity rendering, avatar generation, reaction badges, timestamp display.
- `chat/MessageInput.tsx` — Auto-resizing message composer, rate limit defense, character counter.
- `chat/ReportModal.tsx` — Structured violation reporting dialog.
- `chat/ConnectionStatus.tsx` — WebSocket connection heartbeat indicator.
- `announcements/AnnouncementFeed.tsx` — Filtered announcement cards with pinned priorities.
- `announcements/AnnouncementCard.tsx` — Rich presentation of notices and attachments.
- `admin/AdminDashboard.tsx` — Tabbed moderation desk with actions (dismiss, mute, temp-ban, perm-ban, resolve).

---

## 5. API Routes Audit

All API routes are located under `src/app/api`:

1. `POST /api/auth/login` — Initiates OTP / OAuth redirect with rate limiting and domain check.
2. `POST /api/auth/logout` — Revokes session and clears auth cookies.
3. `GET /api/auth/me` — Fetches sanitized user profile (`anonymousName`, `cohort`, `role`, `status`).
4. `POST /api/auth/verify` — Validates NSUT College ID, assigns cohort, generates handle, saves to DB.
5. `GET /api/rooms` — Lists accessible rooms based on student role and batch.
6. `GET /api/rooms/[roomId]/messages` — Fetches messages with reaction counts and reply threads.
7. `POST /api/rooms/[roomId]/messages` — Creates a message, checks rate limits, triggers realtime broadcast.
8. `DELETE /api/messages/[id]` — Soft deletes message (author or moderator only).
9. `POST /api/messages/[id]/reactions` — Toggles message reactions (`like`, `love`, `laugh`, `wow`, `sad`, `angry`).
10. `DELETE /api/messages/[id]/reactions` — Removes reaction.
11. `POST /api/messages/[id]/reports` — Files content violation report.
12. `GET /api/announcements` — Returns visible announcements based on role and expiration.
13. `POST /api/admin/announcements` — Admin-only announcement creation.
14. `DELETE /api/admin/announcements/[id]` — Admin-only announcement deletion.
15. `GET /api/admin/stats` — Real document counts (students, alumni, reports, announcements).
16. `GET /api/admin/reports` — Pending reports moderation queue.
17. `PATCH /api/admin/reports/[id]` — Moderator actions (dismiss, mute, temp_ban, permanent_ban, remove_message).
18. `POST /api/admin/resolve-identity` — SUPER_ADMIN privileged de-anonymization with mandatory audit log.
19. `GET /api/admin/audit` — Immutable audit trail retrieval.
20. `POST /api/admin/users/[id]/ban` — Issues temporary or permanent ban.
21. `POST /api/admin/users/[id]/mute` — Mutes user posting privileges.

---

## 6. Authentication, Session & Security Boundaries Audit

1. **Email Domain Enforcement:** Strictly rejects non-`@nsut.ac.in` email addresses in middleware, OAuth callback, and verification API.
2. **Session Persistence:** Configured with 400-day cookies and automatic token refresh in `src/middleware.ts`.
3. **Role-Based Access Control (RBAC):** Hierarchical permissions: `student` < `alumni` < `moderator` < `admin` < `super_admin`.
4. **Privacy Invariant:** Real identity (`collegeId`, `collegeEmail`, `rollNumber`, UUID) is strictly decoupled from message authoring. Messages render only `anonymousName` and `avatarSeed`.
5. **Auditing:** Privileged operations (identity resolution, bans, message deletion) mandatorily write audit records.

---

## 7. Existing Database (PostgreSQL/Drizzle) & Required MongoDB Collections

The existing schema defines 12 relational tables:
1. `cohorts`
2. `users`
3. `anonymous_identities`
4. `rooms`
5. `messages`
6. `message_reactions`
7. `reports`
8. `bans`
9. `announcements`
10. `announcement_attachments`
11. `audit_logs`
12. `notification_devices`

### Required MongoDB Mongoose Models:
1. `User` (`users`)
2. `Cohort` (`cohorts`)
3. `AnonymousIdentity` (`anonymousidentities`)
4. `Room` (`rooms`)
5. `Message` (`messages`)
6. `MessageReaction` (`messagereactions`)
7. `Report` (`reports`)
8. `Ban` (`bans`)
9. `Announcement` (`announcements`)
10. `AnnouncementAttachment` (`announcementattachments`)
11. `AuditLog` (`auditlogs`)
12. `NotificationDevice` (`notificationdevices`)

---

## 8. Deficiencies, Inconsistencies & Issues to Remediate

| # | Item | Current State | Required State | Severity |
|---|---|---|---|---|
| 1 | **Application Database** | Uses PostgreSQL via Drizzle ORM | Must use MongoDB Atlas via Mongoose as the sole application database | High |
| 2 | **Message Pagination Cursor** | Uses timestamp-only `beforeDate` | Must use composite cursor `(createdAt, _id)` to prevent skipping simultaneous messages | Medium |
| 3 | **Database Visualizer** | None exists | Admin-only interactive explorer at `/admin/database` + developer metrics dashboard | High |
| 4 | **Database Documentation** | `docs/` has high-level notes | Comprehensive 8-file database documentation suite with ER diagrams, relational schema, FDs, and normalization proofs | High |
| 5 | **Academic Project Report** | None | 27-section comprehensive university DBMS project report (`docs/PROJECT_REPORT.md`) | High |
| 6 | **Testing Report** | None | Real test execution report with outputs (`docs/TESTING_REPORT.md`) | Medium |
| 7 | **Demonstration Guide** | None | Complete live demonstration walkthrough and seed scripts (`docs/DEMO_GUIDE.md`) | Medium |
| 8 | **GitHub Target Repository** | Remote currently points to old repo | Configure remote `https://github.com/Uddip07/dbms-project.git`, branch `feature/campusconnect-final-submission`, push & verify | High |

---

## 9. Baseline Verification Results

- **Vitest:** 13 test files passed, 91 tests passed (0 failures).
- **TypeScript:** `tsc --noEmit` passed with 0 errors.
- **Next.js Production Build:** `npm run build` compiled successfully (all 24 routes valid).
