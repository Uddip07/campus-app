# API Contract — V1

All endpoints require an authenticated session unless marked public.

## Identity

`GET /api/me`

Returns only safe client data:
```json
{
  "anonymousName": "AnonymousFox21",
  "avatarSeed": "...",
  "cohort": 2029,
  "role": "student"
}
```

Never return college ID/email from this endpoint.

## Rooms

`GET /api/rooms`

Returns rooms the current user can access.

`GET /api/rooms/:roomId/messages?before=<cursor>&limit=50`

Returns sanitized message DTOs.

`POST /api/rooms/:roomId/messages`
```json
{ "content": "hello", "replyToId": null }
```

## Messages

`PATCH /api/messages/:id`
`DELETE /api/messages/:id`
`POST /api/messages/:id/reactions`
`DELETE /api/messages/:id/reactions/:reaction`
`POST /api/messages/:id/reports`

## Announcements

`GET /api/announcements`

Returns only visible published announcements.

Admin:
`POST /api/admin/announcements`
`PATCH /api/admin/announcements/:id`
`DELETE /api/admin/announcements/:id`

Create body:
```json
{
  "title": "Placement Registration",
  "content": "Registration closes Friday.",
  "audienceType": "cohort",
  "cohortId": "...",
  "isPinned": true,
  "publishedAt": "2026-09-02T10:00:00Z",
  "expiresAt": null
}
```

## Moderation

`GET /api/admin/reports`
`PATCH /api/admin/reports/:id`
`POST /api/admin/users/:id/mute`
`POST /api/admin/users/:id/ban`

Identity resolution should NOT be a general REST endpoint. Implement it as a tightly controlled server-side admin operation requiring a reason and audit log.
