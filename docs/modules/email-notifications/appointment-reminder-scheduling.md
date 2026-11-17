# Appointment Reminder Scheduling

> **Policy pending clinic approval.** No reminder interval existed in earlier documents (the Phase 0 MVP scope lists the job, without a lead time). Phase 13 adds a configurable setting with a documented default of **24 hours**. The clinic must confirm the final value.

## Policy as implemented

- Eligible: appointments in status `CONFIRMED` whose `start_at` is inside `(now, now + lead]`, interpreted in `Asia/Manila`.
- Lead time: clinic setting `reminder_lead_hours` (migration 030, default 24). If the setting is missing or invalid, `EMAIL_REMINDER_LEAD_HOURS` applies (default 24, range 1 to 168).
- One reminder per appointment start time.

## Command

```
php bin/schedule-reminders.php
```

The output reports `created`, `skipped` and `invalidated` counts and the lead hours in use. Exit codes: `0` ok, `1` error, `2` invalid configuration, `4` another instance holds the lock.

In Docker, the `reminder-scheduler` service runs it every `REMINDER_SCHEDULER_INTERVAL_SECONDS` (default 300). Run exactly one instance. A second one is harmless because of the lock and the unique key, but it is wasted work.

## Duplicate and obsolete reminder handling

| Case | Mechanism |
|---|---|
| Scheduler runs repeatedly | Key `appointment:{id}:reminder:{startUnixTime}` is unique. A second insert is a no-op. |
| Two schedulers at once | MySQL `GET_LOCK('toothcare_reminder_scheduler', 0)`. The loser exits with code 4. The unique key still protects inserts. |
| Delivered reminder | A `SENT` job keeps its key, so it is never queued again, and normal retry processing never selects `SENT` jobs. |
| Appointment cancelled, rejected, completed | The same transaction cancels queued reminders (`REMINDER_OBSOLETE`). Each scheduler run also cancels queued reminders whose appointment is no longer `CONFIRMED` (`REMINDER_INELIGIBLE`). |
| Reschedule (Phase 10 cancel-and-create) | The old appointment's reminders are cancelled in the reschedule transaction. The new appointment is `PENDING` and gets a reminder only after it is confirmed. |
| Start time edited in place | The new start time gives a new key. The scheduler queues the new reminder and cancels the old one. |
| Appointment becomes ineligible after queuing | The worker re-reads the appointment before sending. If it is not `CONFIRMED`, the start time changed, or the start is in the past, the job becomes `CANCELLED` without sending. |

## Time zone

Appointments are stored as clinic-local `DATETIME` values (existing convention). The scheduler and worker compute "now" in `APP_TIMEZONE` (`Asia/Manila`) and compare clinic-local strings, so UTC and local time are never mixed. Tests cover the window crossing midnight.
