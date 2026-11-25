# Notification REST API Reference

All endpoints require an authenticated PHP session (`AuthenticationMiddleware`) and enforce strict recipient ownership (`user_id === authenticatedUserId`) server-side.

## Endpoints (`/api/v1`)

### `GET /api/v1/notifications`
Returns paginated notifications for the authenticated user.
- Query params: `page` (default `1`), `per_page` / `limit` (`1..100`, default `20`), `unread_only` (`1`/`true`).
- Response `data`: `{ items, total, unread_count, latest_id, page, per_page, total_pages }`.

### `GET /api/v1/notifications/unread-count`
Returns `{ unread_count: number }` for the authenticated user.

### `GET /api/v1/notifications/sync`
Cursor-based incremental recovery endpoint used on WebSocket reconnection and browser tab reactivation.
- Query params: `after_id` (`>= 0`), `since` (optional ISO-8601 timestamp), `limit` (`1..100`, default `50`).
- Response `data`: `{ items, unread_count, latest_id, has_more, server_time }`.

### `GET /api/v1/notifications/{id}`
Returns a single notification owned by the authenticated user.
- Returns `403 Forbidden` if the notification belongs to another user (IDOR protection) and `404 Not Found` if absent.

### `PATCH /api/v1/notifications/{id}/read`
Marks a single owned notification as read (`read_at = NOW()`). Returns `403` for non-owners and `404` if absent.

### `POST /api/v1/notifications/read-all` & `PATCH /api/v1/notifications/read-all`
Marks all unread notifications owned by the authenticated user as read and returns `{ success: true, updated_count }`.
