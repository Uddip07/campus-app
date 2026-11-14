# CampusConnect — Live Evaluation & Demonstration Guide

This guide provides the complete evaluation protocol and step-by-step oral demonstration script for the **CampusConnect** DBMS project evaluation.

---

## 1. Demo Preparation & Environment Setup

### 1.1 Local Execution (Recommended & Bulletproof)
To ensure the demonstration does not depend on external internet jitter or third-party outages during evaluation:

```bash
# 1. Clone or navigate to the repository
cd campus-app

# 2. Ensure dependencies are installed
npm install

# 3. Verify environment configuration (.env.local)
# MONGODB_URI=mongodb+srv://... or local mongodb://127.0.0.1:27017/campusconnect
# NEXT_PUBLIC_SUPABASE_URL=...
# NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
# SUPABASE_SECRET_KEY=...

# 4. Seed database with NSUT cohorts, system rooms, and baseline demo activity
npm run db:seed

# 5. Start the Next.js development server
npm run dev
# App will be accessible at: http://localhost:3000
```

### 1.2 Cloud Production Deployment (Vercel)
- Live Production URL: `https://campus-app-gamma.vercel.app`
- Database: MongoDB Atlas (M0 Shared Cluster, AWS / ap-south-1 Mumbai region)
- Network Access: Set to allow `0.0.0.0/0` in MongoDB Atlas Network Access.

### 1.3 Emergency Recovery Steps
If network connectivity fails during the live evaluation:
1. Start local MongoDB: `mongod --dbpath <data_dir>` (or run local MongoDB service).
2. Set in `.env.local`: `MONGODB_URI=mongodb://127.0.0.1:27017/campusconnect`.
3. Run `npm run db:seed`.
4. Run `npm run dev` and present directly from `http://localhost:3000`.

---

## 2. Demonstration Accounts & Roles Matrix

> **Note:** The demonstration dataset uses structured institutional test personas adhering strictly to privacy guidelines. Zero real student credentials or passwords are used.

| Role | Email Handle | College Roll ID | Cohort Graduation | Assigned Handle | Capabilities Demonstrated |
|---|---|---|---|---|---|
| **Super Admin** | `admin@nsut.ac.in` | `2022UIT0001` | 2026 | `StaffGuardian01` | Full moderation, Announcement creation, Audited de-anonymization, MongoDB Visual Explorer |
| **Moderator** | `moderator@nsut.ac.in` | `2022CS0100` | 2026 | `AnonymousWiseOwl17` | Reports triage, Content dismissal, User mute, Ban issuance |
| **Student (Batch 2028)** | `student@nsut.ac.in` | `2024UIT1010` | 2028 | `AnonymousCosmicFox42` | Global chat, 2028 Cohort room, Reactions, Message reporting |
| **Alumni (Batch 2024)** | `alumni@nsut.ac.in` | `2020ECE0055` | 2024 | `AnonymousSilverFalcon88` | Global chat, Alumni room (restricted to undergrads) |

---

## 3. Step-by-Step Live Demonstration Walkthrough

Follow these 12 structured stages during the evaluation:

### Stage 1: Authentication & Institutional Email Domain Enforcement
- **Action:** Navigate to `/login`.
- **Demonstration:**
  - Enter non-institutional email (e.g. `student@gmail.com`).
  - Show server-side validation rejecting non-`@nsut.ac.in` domains.
  - Sign in using an `@nsut.ac.in` institutional account (or Magic Link / OAuth session).
- **DBMS Course Relevance:** Demonstrates strict application-layer domain constraints and identity verification.

### Stage 2: Student Onboarding & Deterministic Batch Parsing
- **Action:** If first-time login, user is routed to `/verify`.
- **Demonstration:**
  - Input Student ID `2024UIT1010`.
  - Explain how `parseCollegeId()` extracts:
    - Enrollment Year: `2024`
    - Branch: `Information Technology (UIT)`
    - Roll Number: `1010`
    - Cohort Year: `2028` ($\text{enrollmentYear} + 4$)
  - Show the generation of cryptographic handle `AnonymousCosmicFox42` and avatar seed.
  - Submit: user is persisted into MongoDB `users`, `anonymousidentities`, and redirected to `/chat`.

### Stage 3: University-Wide Chat ("All College")
- **Action:** Visit `/chat` or `/chat/all`.
- **Demonstration:**
  - Notice messages from across all cohorts.
  - Point out that real student names, emails, and roll numbers are **completely absent** from the UI and network payloads.
  - Inspect Chrome DevTools Network response for `/api/rooms/[roomId]/messages`: verify payload only contains `{ displayName, avatarSeed }`.

### Stage 4: Batch-Specific Cohort Chat
- **Action:** Click "Cohort" tab (`/chat/cohort`).
- **Demonstration:**
  - For the 2028 student, this opens the "2028 Batch" room.
  - Explain **cohort isolation**: Students from Batch 2026 or 2027 cannot access or read Batch 2028 discussions. Server-side RBAC returns HTTP 403.

### Stage 5: Alumni Discussion Room
- **Action:** Click "Alumni" tab (`/chat/alumni`).
- **Demonstration:**
  - If signed in as undergraduate student, access is forbidden.
  - If signed in as `alumni@nsut.ac.in` (Class of 2024), room opens seamlessly.
  - Discuss role transition: when $\text{currentYear} \ge \text{graduationYear}$, the user dynamically becomes `alumni`.

### Stage 6: Real-time Message Posting & Composite Cursor
- **Action:** Post a new message: *"Has anyone completed the DBMS normalization assignment?"*
- **Demonstration:**
  - Message appears immediately via optimistic UI and persists to MongoDB `messages` collection.
  - Explain message pagination: uses composite cursor `(createdAt, _id)` with Base64url encoding to ensure zero missed messages.

### Stage 7: Message Reactions
- **Action:** Hover over an existing message and click the ❤️ reaction.
- **Demonstration:**
  - Badge counter increments.
  - Show unique compound index `{ messageId, userId, reaction }`: clicking again toggles the reaction off idempotently.

### Stage 8: Official Announcements Feed
- **Action:** Navigate to `/announcements`.
- **Demonstration:**
  - Pinned notices (e.g. "Welcome to CampusConnect") appear at the top.
  - Cohort-targeted announcements (e.g. "DBMS Project Evaluation Schedule — Batch 2028") are visible only to relevant batches.

### Stage 9: Content Violation Reporting & Staff Moderation Desk
- **Action:** As a student, click the Flag/Report button on a message, select reason *"Spam"*, and submit.
- **Demonstration:**
  - Sign in as `admin@nsut.ac.in` or `moderator@nsut.ac.in` and visit `/admin`.
  - Open "Moderation Queue": report appears instantly with flagged content.
  - Demonstrate staff actions: *Dismiss*, *Mute User*, *Remove Message*.
  - Demonstrate **Super Admin Audited Identity Resolution**:
    - Under "De-Anonymize", input the handle.
    - Provide legal/disciplinary reason ($\ge 10$ characters).
    - Submitting resolves the real student ID and writes an immutable entry into `auditlogs`.

### Stage 10: MongoDB Visual Database Explorer
- **Action:** In Admin dashboard header, click **"MongoDB Database Explorer"** (`/admin/database`).
- **Demonstration:**
  - Show live Atlas cluster connection indicator (Green pill: `Connected`).
  - Highlight real statistics: Host, Active Collections (12), Total Documents, Storage size.

### Stage 11: Collection Inspection & Document Drill-Down
- **Action:** In `/admin/database`:
  - Browse sidebar: select `users`, `messages`, `reports`, `auditlogs`.
  - Show paged table with BSON `_id` values, primary fields, and timestamps.
  - Click **"View JSON"**: inspect formatted JSON modal with copyable ObjectIds.
  - Click **"Export JSON"**: show streaming download of `campusconnect-<collection>.json`.
  - Switch to **"Engine Metrics & Indexes"** tab: show compound indexes on `{ roomId: 1, createdAt: -1, _id: -1 }`.

### Stage 12: Entity-Relationship Model & Normalization Proof
- **Action:** Switch to **"Schema Relationships & Topologies"** tab or present `docs/database/ER_DIAGRAM.md`.
- **Demonstration:**
  - Explain 12-relation schema, referencing vs embedding rationale, and why messages are independent documents.
  - Walk through normalization proofs: why 11 relations satisfy **BCNF**, while `ROOMS` sits in **3NF** due to conditional nullable cohort scope.
