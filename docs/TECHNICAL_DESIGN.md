# Campus Technical Design

## 1. Architecture

Browser/PWA -> Next.js -> application services -> PostgreSQL.
Realtime chat uses WebSocket broadcast topics. Redis is only for ephemeral state/rate limiting. Object storage holds attachments.

## 2. Identity boundary

Verified NSUT identity is private. Public messages are rendered with the currently active anonymous identity. Never return college ID, email, roll number, or internal user UUID to ordinary clients.

Identity resolution is restricted to SUPER_ADMIN and must create an audit log entry with a reason.

## 3. Verification abstraction

Implement:

```ts
interface VerificationProvider {
  verifyStudent(input: { collegeId: string; email?: string }): Promise<{
    valid: boolean;
    enrollmentYear?: number;
    programCode?: string;
    status?: 'active' | 'graduated';
  }>;
}
```

Development provider: approved institutional-email verification / seeded test roster.
Production provider: NSUT-approved SSO, API, or roster. Never scrape IMS or collect IMS passwords.

## 4. Cohort calculation

For a four-year B.Tech:
`graduationYear = enrollmentYear + 4`.

Store the cohort permanently rather than storing first/second/third/fourth year. This survives graduation and allows students to become alumni without changing account identity.

## 5. Realtime

Topics:
- `room:global`
- `room:cohort:<graduationYear>`
- `room:alumni`

Message write flow:
1. Authenticate session.
2. Authorize room membership.
3. Rate-limit sender.
4. Validate with Zod.
5. Run cheap spam/moderation checks.
6. Insert into PostgreSQL.
7. Broadcast sanitized message DTO.

PostgreSQL is authoritative; realtime is delivery only.

## 6. Pagination

Load the newest 50 messages. Older history uses cursor pagination by `(created_at, id)`.

Never use unbounded message queries or large OFFSET pagination.

## 7. Announcements

Admins publish announcements to `all`, `cohort`, or `alumni`. Students only receive announcements authorized for their account. Pinned announcements are displayed first. Attachments use object storage, never database blobs.

## 8. Security

- Server-side authorization on every privileged action.
- PostgreSQL RLS where Supabase is directly exposed.
- Service-role key only on trusted server.
- Strict input validation.
- Message length limits.
- Rate limits for auth, messages, reports, uploads, and username rotation.
- Audit privileged actions.
- Database backups and restore tests.
- Do not put identity data in analytics events.

## 9. Suggested rate limits

Initial defaults; tune after load testing:
- Messages: 10/10 sec and 40/min/user.
- Reports: 10/hour/user.
- OTP requests: 5/hour/identity.
- File uploads: 20/hour/user.
- Username regeneration: 3/month/user.

## 10. Admin model

STUDENT: chat/report.
ALUMNI: alumni chat/report.
MODERATOR: moderation/report review.
ADMIN: announcements + user management.
SUPER_ADMIN: identity resolution + admin management.

## 11. Deployment

Vercel: Next.js.
Supabase: Postgres/Auth/Realtime/Storage.
Upstash: Redis.
Sentry: errors/performance.
GitHub Actions: lint/typecheck/test/build.

Do not introduce Kubernetes, Kafka, or microservices until measured requirements justify them.
