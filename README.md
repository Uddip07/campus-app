# CampusConnect — Anonymous NSUT Community Platform

CampusConnect is a verified, pseudonymous student and academic collaboration platform designed specifically for the **Netaji Subhas University of Technology (NSUT)** community. Built as a university Database Management Systems (DBMS) project, it combines institutional email authentication, cryptographic anonymous identities, partitioned batch and alumni discussion rooms, university announcements, moderation queues, audit logging, and an interactive **MongoDB Database Administration Explorer**.

---

## 1. Architectural Principles & Anonymity Boundary

1. **Zero Client Leakage**: Public users and client API responses NEVER receive student names, college IDs, institutional emails, roll numbers, or internal user ObjectIds. The client only sees:
   ```json
   {
     "displayName": "AnonymousCosmicFox42",
     "avatarSeed": "a1b2c3d4",
     "cohort": 2028
   }
   ```
2. **MongoDB as Primary Application Database**: All application collections (`users`, `cohorts`, `anonymousidentities`, `rooms`, `messages`, `messagereactions`, `reports`, `bans`, `announcements`, `announcementattachments`, `auditlogs`, `notificationdevices`) are persisted in MongoDB via Mongoose.
3. **Realtime Broadcast**: Utilizes Supabase Realtime broadcast channels for live message and reaction synchronization across active browser sessions.
4. **Stable Composite Cursor Pagination**: Message streams use a deterministic composite cursor `(createdAt, _id)` encoded in Base64url to ensure $O(1)$ index seek performance and zero missed messages during simultaneous postings.
5. **Privileged Audited Resolution**: Only users with the `super_admin` role can resolve an anonymous identity to a student record. Every resolution mandates a legitimate reason ($\ge 10$ characters) and records an immutable entry in `auditlogs`.
6. **Zero Mock Data**: No hardcoded mock users, mock chats, or fabricated statistics exist in the application runtime. All statistics are queried live from MongoDB collections.

---

## 2. Technology Stack

- **Framework**: Next.js `^14.2.24` (App Router, Server Components & Route Handlers)
- **Language**: TypeScript `^5.7.3` (Strict mode enabled)
- **Styling**: Tailwind CSS `^3.4.17`, Lucide Icons
- **Primary Database**: MongoDB Atlas (v7.0+ / M0 Sandbox) via Mongoose `^8.10.x`
- **Auth & Realtime**: `@supabase/ssr` & `@supabase/supabase-js` (Auth session cookies & WebSockets)
- **Validation**: Zod `^3.24.1`
- **Testing**: Vitest `^2.1.8` (15 test suites, 103 automated tests)

---

## 3. Prerequisites

- **Node.js**: `v18.17.0+`, `v20+`, or `v24+`
- **npm**: `v9+` or `v11+`
- **MongoDB Database**: MongoDB Atlas cluster URI or local MongoDB instance (`mongodb://127.0.0.1:27017/campusconnect`)
- **Supabase Project**: For Authentication sessions and Realtime WebSockets

---

## 4. Installation & Local Setup

```bash
# 1. Clone the repository
git clone https://github.com/Uddip07/dbms-project.git
cd campus-app

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env.local
```

### Environment Configuration (`.env.local`)

Populate `.env.local` with your database and service credentials (values kept private):

```env
# MongoDB Atlas Connection URI (Primary Application Database)
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/campusconnect?retryWrites=true&w=majority

# Supabase Configuration (Supabase Dashboard -> Project Settings -> API Keys)
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-anon-key>
SUPABASE_SECRET_KEY=<service-role-secret-key>

# Ephemeral Cache & Rate Limiting (Optional in local development)
REDIS_URL=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

---

## 5. Database Initialization & Seeding

CampusConnect includes a comprehensive database seed script that provisions default cohorts (2024–2033), system rooms, and baseline demonstration records:

```bash
# Seed MongoDB collections with structural data and demonstration personas
npm run db:seed
```

### Seeded Demonstration Personas:
- **Super Admin**: `admin@nsut.ac.in` (`2022UIT0001`, Handle: `StaffGuardian01`)
- **Moderator**: `moderator@nsut.ac.in` (`2022CS0100`, Handle: `AnonymousWiseOwl17`)
- **Student**: `student@nsut.ac.in` (`2024UIT1010`, Batch 2028, Handle: `AnonymousCosmicFox42`)
- **Alumni**: `alumni@nsut.ac.in` (`2020ECE0055`, Batch 2024, Handle: `AnonymousSilverFalcon88`)

---

## 6. Running the Application

```bash
# Start local development server
npm run dev

# Open http://localhost:3000 in your browser
```

---

## 7. Testing & Quality Verification

```bash
# Run complete automated Vitest test suite (15 suites, 103 tests)
npm test

# Run TypeScript strict type verification
npm run typecheck

# Run ESLint static analysis
npm run lint

# Build optimized production bundle
npm run build
```

---

## 8. Database Administration & Visual Explorer

CampusConnect includes an administrative database inspector at `/admin/database`:
- **Real-Time Health Pill**: Shows live MongoDB Atlas connection status and host.
- **Collection Browser**: Inspect documents across all 12 collections with BSON ObjectId display, pagination, and text/ID search.
- **JSON Inspector Modal**: Formatted view with one-click JSON copying.
- **Collection Export**: Stream-export up to 1,000 collection documents as structured JSON.
- **Engine Metrics & Indexes**: Inspect compound B-Tree indexes, storage size, and Mongoose model configurations.
- **Schema Relationships**: Visual representation of foreign key references across entities.

---

## 9. Cloud Deployment (Vercel & MongoDB Atlas)

1. **MongoDB Atlas Network Access**:
   - In MongoDB Atlas $\to$ **Network Access**, add `0.0.0.0/0` (Allow Access from Anywhere) to permit connections from Vercel dynamic serverless IP ranges.
2. **Vercel Environment Variables**:
   - In Vercel Project Settings $\to$ **Environment Variables**, set:
     - `MONGODB_URI`
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
     - `SUPABASE_SECRET_KEY`
3. **Deploy**:
   - Trigger deployment via Git push to `main` or `feature/campusconnect-final-submission`.

---

## 10. Comprehensive Documentation Index

- **Database Architecture Suite**:
  - [ER Diagram Specification](docs/database/ER_DIAGRAM.md) & [Mermaid Source](docs/database/ER_DIAGRAM.mmd)
  - [Relational Schema & Integrity Constraints](docs/database/RELATIONAL_SCHEMA.md)
  - [Functional Dependencies & Candidate Keys](docs/database/FUNCTIONAL_DEPENDENCIES.md)
  - [Mathematical Normalization & Proofs](docs/database/NORMALIZATION.md)
  - [MongoDB Schema Design & Referencing Rationale](docs/database/MONGODB_SCHEMA.md)
  - [Indexes & Composite Cursor Pagination](docs/database/INDEXES.md)
  - [Collections Field Catalog](docs/database/COLLECTIONS.md)
- **Project Report**: [University DBMS Project Report (27 Sections)](docs/PROJECT_REPORT.md)
- **Testing Report**: [QA & Verification Results (103 Tests)](docs/TESTING_REPORT.md)
- **Live Demo Protocol**: [Step-by-Step Demonstration Walkthrough](docs/DEMO_GUIDE.md)
