# Campus — Anonymous NSUT Community Platform

Campus is a verified, pseudonymous communication platform engineered specifically for the Netaji Subhas University of Technology (NSUT) community. Students verify their institutional identity to participate, receive an unguessable anonymous public alias, and converse in College-wide, Cohort-specific, and Alumni rooms. The backend maintains the cryptographic identity link under strict RBAC and audited resolution protocols.

---

## 1. Architectural Principles & Anonymity Boundary

1. **Zero Client Leakage**: Public users and API responses NEVER receive student names, college IDs, institutional emails, roll numbers, or internal user UUIDs. The client only sees:
   ```json
   {
     "displayName": "AnonymousCosmicFox42",
     "avatarSeed": "a1b2c3d4",
     "cohort": 2029
   }
   ```
2. **PostgreSQL as Source of Truth**: Messages, reactions, reports, bans, and announcements are fully persisted in PostgreSQL before broadcast.
3. **Realtime Broadcast**: Uses Supabase Realtime broadcast channels for sub-second live message synchronization across connected browser sessions.
4. **Privileged Audited Resolution**: Only users with the `super_admin` role can resolve an anonymous identity to a student record. Every resolution mandates a legitimate reason (min 10 characters) and creates an immutable audit trail entry.
5. **Zero Mock Data**: No hardcoded mock users, mock chats, mock announcements, or fake statistics exist anywhere in the application runtime. If a room or queue is empty, it truthfully displays an empty state (e.g., *"No messages yet."*).

---

## 2. Prerequisites

- **Node.js**: v18.17.0+ or v20+ (tested on Node v24)
- **npm**: v9+ (or pnpm / yarn)
- **PostgreSQL Database** (e.g. Supabase Postgres instance)
- **Supabase Project** (for Auth, Realtime, and Storage)
- **Redis / Upstash** (Optional for local development; in-memory limiter used with explicit warning if unconfigured)

---

## 3. Installation

Clone the repository and install dependencies:

```bash
git clone <repository-url>
cd campus-app
npm install
```

---

## 4. Environment Configuration

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Every value in `.env.example` is left blank by design. Populate the required values from your infrastructure providers:

```env
# Supabase Configuration (Supabase Dashboard -> Project Settings -> API Keys)
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-id>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<your-publishable-key>
SUPABASE_SECRET_KEY=<your-secret-key>

# Database Connection (Supabase Dashboard -> Database -> Connection string URI)
DATABASE_URL=postgresql://postgres:<password>@db.<your-project-id>.supabase.co:5432/postgres

# Rate Limiting & Ephemeral Cache (Upstash / Redis)
# Optional in local development (falls back to in-memory limiter with development warning)
REDIS_URL=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Error Tracking (Optional)
SENTRY_DSN=

# Official NSUT Verification Integration Boundary
# When unconfigured, the application gracefully reports: "NSUT student verification is not configured."
NSUT_VERIFICATION_URL=
NSUT_VERIFICATION_CLIENT_ID=
NSUT_VERIFICATION_CLIENT_SECRET=
```

---

## 5. Database Setup & Migrations

Campus uses PostgreSQL with Row Level Security (RLS). Apply the migration scripts to your PostgreSQL database:

1. **Apply Initial Schema**:
   Run `infrastructure/sql/001_initial.sql` in your Supabase SQL Editor or via `psql`. This creates:
   - Enums: `user_role`, `user_status`, `room_type`, `moderation_status`, `report_status`, `announcement_audience`, `ban_type`.
   - Core tables: `cohorts`, `users`, `anonymous_identities`, `rooms`, `messages`, `message_reactions`, `reports`, `bans`, `announcements`, `announcement_attachments`, `audit_logs`, `notification_devices`.
   - Structural seeds: Pre-populates cohort years (2026–2033) and system rooms (*All College*, *Alumni*, and batch cohort rooms). Zero fake users or fake chats are inserted.

2. **Apply Row Level Security (RLS) Policies**:
   Run `infrastructure/sql/002_rls.sql` in your SQL editor. This enables RLS across all 12 tables and enforces JWT-based access controls for rooms, messages, reports, announcements, and profiles.

3. **Storage Bucket**:
   Create a public bucket named `announcements` in Supabase Storage if you plan to upload announcement attachments.

---

## 6. Local Development

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Expected Startup Behavior:
- **Missing Supabase Config**: Clear alert indicating Supabase configuration is missing.
- **Missing Redis**: Application runs normally; logs development warning:
  `[RateLimit] Warning: Redis is unconfigured. Operating with in-memory development rate limiter.`
- **Missing NSUT Provider**: Attempting verification displays explicit error:
  *"NSUT student verification is not configured."*
- **Empty Database**: Rooms render truthful empty states (*"No messages yet."*, *"No announcements yet."*).

---

## 7. Automated Testing & Verification

Run the test suite (unit tests, integration tests, and security boundaries):

```bash
npm test
```

To run tests in watch mode:

```bash
npm run test:watch
```

Run static type checking:

```bash
npm run typecheck
```

### Test Coverage Highlights:
- **College ID Parsing**: Validates patterns (e.g. `2025UIT3090`, `2024COE1020`), rejects malformed inputs, validates branch codes, and derives cohort graduation years (`enrollmentYear + duration`).
- **Anonymous Identity**: Verifies entropy, format (`Anonymous<Adj><Noun><Num>`), uniqueness, and absence of hardcoded names.
- **RBAC & Room Authorization**: Verifies access matrix across `student`, `alumni`, `moderator`, `admin`, `super_admin`.
- **Security Boundaries**: Confirms students cannot access other cohorts, cannot create announcements, cannot resolve identities, and that public profiles never leak real student data.

---

## 8. Production Build

Verify the production build:

```bash
npm run build
npm start
```

---

## 9. NSUT Student Verification Integration

The platform abstracts student verification through the `StudentVerificationProvider` interface:

```typescript
export interface StudentVerificationProvider {
  name: string;
  isConfigured(): boolean;
  verifyStudent(input: VerifyStudentInput): Promise<VerifiedStudent>;
}
```

- **Current Status**: The external NSUT IT production endpoint is currently an external unconfigured dependency.
- **Policy**: Campus **never** scrapes the IMS portal, automates IMS login, or collects IMS passwords.
- **When Unconfigured**: Student verification gracefully halts with a clear configuration message:
  *"NSUT student verification is not configured."*
- **Once Configured**: Simply set `NSUT_VERIFICATION_URL`, `NSUT_VERIFICATION_CLIENT_ID`, and `NSUT_VERIFICATION_CLIENT_SECRET` in `.env.local`.

---

## 10. Initial Admin Setup

To grant administrative access to a verified account:

1. Sign in and complete student verification with your account.
2. In your Supabase SQL Editor, run:
   ```sql
   UPDATE users
   SET role = 'super_admin'
   WHERE college_id = 'YOUR_COLLEGE_ID';
   ```
3. Refresh the app. The **Admin** tab will appear in the navigation bar.

### Role Hierarchy:
- **`student`**: Global chat, own cohort batch room, message replies, reactions, reports.
- **`alumni`**: Global chat, alumni room, replies, reactions, reports.
- **`moderator`**: Room access, reports queue (dismiss, warn, mute user, temp ban, permanent ban, remove message).
- **`admin`**: All moderation powers + create/delete announcements + user management.
- **`super_admin`**: Full admin access + privileged audited identity resolution + audit log inspection.
