# SafeLink API

Base path: `/api`. Requests and responses use JSON except image uploads. Errors have `{ "error": "message" }`. Zod input errors use 400; unauthenticated requests 401; forbidden requests 403; missing records 404; duplicate entries 409; unreadable images 422; rate limits 429; unavailable providers 503.

Web clients use the HttpOnly session cookie. Native clients send `X-SafeLink-Client: mobile` on login/registration, store the returned token in secure storage and send `Authorization: Bearer <token>` on subsequent calls. Tokens expire after seven days. Do not store web sessions in localStorage.

| Method | Route | Input / behavior |
|---|---|---|
| GET | `/health` | Storage mode and configured provider flags; no credentials |
| POST | `/auth/register` | `name`, `email`, `password` (12–128 chars) |
| POST | `/auth/login` | `email`, `password` |
| POST | `/auth/logout` | Revokes current session |
| GET | `/me` | Current user, no password/session hash |
| PATCH | `/me` | Optional `name`, `simpleMode` |
| POST | `/auth/forgot` | `email`; generic response to avoid enumeration |
| POST | `/auth/resend` | Resend own verification link |
| POST | `/auth/confirm` | `token`, `purpose: verify/reset`; reset also requires `password` |
| POST | `/scans` | `kind: url/message/qr/screenshot`, `text`, optional `external` (false), `save` (true) |
| POST | `/scans/image` | Multipart `image`, `kind: qr/screenshot`, `external: true/false`, `save: true/false` |
| GET | `/scans` | Current user’s latest 200 redacted results |
| PATCH | `/scans/:id` | `saved: boolean` |
| DELETE | `/scans/:id` | Delete own scan |
| GET/POST | `/reports` | Own reports; create with `entity`, `entityType`, `category`, `description` |
| GET/POST | `/contacts` | Own contacts; create with `name`, `email` |
| DELETE | `/contacts/:id` | Remove own contact |
| GET/POST | `/alerts` | Own alerts; send with `scanId`, optional `contactId` (otherwise self) |
| GET | `/dashboard` | Personal totals, risk distribution, report categories and recent scans |
| GET | `/graph` | Own reported entities linked to categories |
| GET | `/admin/:table` | Admin only: users, reports, brands, threatCategories, scans, adminLogs |
| PATCH | `/admin/reports/:id` | `status: pending/approved/rejected` |
| PATCH | `/admin/users/:id` | `disabled: boolean`; cannot disable self |
| POST | `/admin/brands` | Upsert by `name`, with `aliases[]` and official `domains[]` |
| POST | `/admin/threatCategories` | Add category with `name` |

`scans` returns `id`, `kind`, `score`, `level`, `threatType`, `evidence[]`, `checks[]`, `explanation`, nullable `aiExplanation`, `recommendation`, `urls[]`, `phones[]`, `createdAt`, `preview`, `persisted`, and extracted text for image scans. The text-based endpoint with kind `screenshot` accepts already-extracted text; use the multipart endpoint to perform OCR.

Evidence has `id`, `source` (local/community/intelligence), `title`, `detail`, `weight`. A check has `name`, `status` (complete/unavailable/skipped), and `detail`. AI adds only its labeled semantic contribution and explanation; it cannot create deterministic evidence.

All scan types pass through the same backend risk pipeline. A guest can scan without saving. QR text that is not a URL is treated as message content and is never opened.
