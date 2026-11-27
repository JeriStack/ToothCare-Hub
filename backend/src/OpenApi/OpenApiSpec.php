<?php

declare(strict_types=1);

namespace App\OpenApi;

use OpenApi\Attributes as OA;

#[OA\OpenApi(
    openapi: '3.0.3',
    info: new OA\Info(
        version: '1.0.0',
        title: 'ToothCare Hub REST API',
        description: 'Authoritative native PHP REST API (/api/v1) for ToothCare Hub — Dental Appointment and Clinic Management System. Uses server-side PHP sessions (HttpOnly, SameSite=Lax cookie) with synchronizer CSRF tokens on state-changing requests and server-enforced DRBAC + resource ownership checks.'
    ),
    servers: [
        new OA\Server(url: '/api/v1', description: 'Same-origin API base path (Nginx reverse proxy / Vite dev proxy)'),
        new OA\Server(url: 'http://localhost:8080/api/v1', description: 'Local Docker Compose Nginx edge gateway'),
    ],
    tags: [
        new OA\Tag(name: 'Health', description: 'Liveness, readiness, and Prometheus metrics'),
        new OA\Tag(name: 'Authentication', description: 'Session authentication, registration, CSRF, email verification, and password reset'),
        new OA\Tag(name: 'Users', description: 'Self-service user profiles, avatars, and administrator account management'),
        new OA\Tag(name: 'RBAC', description: 'Dynamic Role-Based Access Control (DRBAC) roles and permissions matrix'),
        new OA\Tag(name: 'Patients', description: 'Patient self-service profiles and front-desk/admin patient directory'),
        new OA\Tag(name: 'Dentists', description: 'Public dentist directory, dentist self-service profile, schedules, time-off, and admin roster'),
        new OA\Tag(name: 'Services', description: 'Public dental service catalog and administrative service management'),
        new OA\Tag(name: 'Scheduling', description: 'Clinic operating hours, closures, and real-time slot availability'),
        new OA\Tag(name: 'Appointments', description: 'Appointment booking, role-scoped search, triage review, cancellation, rescheduling, and completion'),
        new OA\Tag(name: 'Receptionist', description: 'Front-desk workspace, daily arrival check-ins, waiting queue, and walk-in intake'),
        new OA\Tag(name: 'Clinical', description: 'Versioned clinical treatment records and FDI tooth charting'),
        new OA\Tag(name: 'Notifications', description: 'Persistent in-app notifications and Socket.IO real-time connection tickets'),
        new OA\Tag(name: 'Messages', description: 'Private participant-scoped Patient-Dentist direct messaging, cursor pagination, receipts, typing, and presence'),
        new OA\Tag(name: 'Dashboards', description: 'Role-appropriate database-driven executive, receptionist, dentist, and patient dashboards'),
        new OA\Tag(name: 'Reports', description: 'Database-driven operational reports (appointments, service utilization, dentist workload, patients)'),
        new OA\Tag(name: 'Operations', description: 'Audit logs, security events, email/realtime outbox monitoring, and redacted operational errors'),
        new OA\Tag(name: 'Settings', description: 'Clinic-wide configuration settings'),
        new OA\Tag(name: 'Legal', description: 'Public Terms of Service and Privacy Policy documents, versioning, and auditable user legal acceptance records'),
    ]
)]
#[OA\SecurityScheme(
    securityScheme: 'CookieAuth',
    type: 'apiKey',
    name: 'toothcare_session',
    in: 'cookie',
    description: 'Server-side PHP session cookie (HttpOnly, SameSite=Lax, Secure in production).'
)]
#[OA\SecurityScheme(
    securityScheme: 'CsrfToken',
    type: 'apiKey',
    name: 'X-CSRF-Token',
    in: 'header',
    description: 'Synchronizer CSRF token obtained from GET /api/v1/auth/csrf-token; required on POST, PUT, PATCH, and DELETE requests.'
)]
final class OpenApiSpec
{
}
