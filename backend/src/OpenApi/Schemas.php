<?php

declare(strict_types=1);

namespace App\OpenApi;

use OpenApi\Attributes as OA;

#[OA\Schema(
    schema: 'ResponseMeta',
    type: 'object',
    properties: [
        new OA\Property(property: 'request_id', type: 'string', example: 'req-9f8e7d6c'),
        new OA\Property(property: 'message', type: 'string', nullable: true),
        new OA\Property(property: 'total', type: 'integer', nullable: true, example: 42),
        new OA\Property(property: 'page', type: 'integer', nullable: true, example: 1),
        new OA\Property(property: 'per_page', type: 'integer', nullable: true, example: 20),
        new OA\Property(property: 'last_page', type: 'integer', nullable: true, example: 3),
    ]
)]
#[OA\Schema(
    schema: 'ErrorDetail',
    type: 'object',
    required: ['code', 'message'],
    properties: [
        new OA\Property(property: 'code', type: 'string', example: 'VALIDATION_ERROR'),
        new OA\Property(property: 'message', type: 'string', example: 'The given data was invalid.'),
        new OA\Property(property: 'details', type: 'object', nullable: true, additionalProperties: true),
    ]
)]
#[OA\Schema(
    schema: 'SuccessEnvelope',
    type: 'object',
    required: ['data', 'meta', 'error'],
    properties: [
        new OA\Property(property: 'data', nullable: true),
        new OA\Property(property: 'meta', ref: '#/components/schemas/ResponseMeta'),
        new OA\Property(property: 'error', type: 'object', nullable: true, example: null),
    ]
)]
#[OA\Schema(
    schema: 'ErrorEnvelope',
    type: 'object',
    required: ['data', 'meta', 'error'],
    properties: [
        new OA\Property(property: 'data', nullable: true, example: null),
        new OA\Property(property: 'meta', ref: '#/components/schemas/ResponseMeta'),
        new OA\Property(property: 'error', ref: '#/components/schemas/ErrorDetail'),
    ]
)]
#[OA\Schema(
    schema: 'PaginationMeta',
    type: 'object',
    required: ['total', 'page', 'per_page', 'last_page'],
    properties: [
        new OA\Property(property: 'total', type: 'integer', example: 120),
        new OA\Property(property: 'page', type: 'integer', minimum: 1, example: 1),
        new OA\Property(property: 'per_page', type: 'integer', minimum: 1, maximum: 100, example: 20),
        new OA\Property(property: 'last_page', type: 'integer', minimum: 1, example: 6),
    ]
)]
#[OA\Schema(
    schema: 'User',
    type: 'object',
    properties: [
        new OA\Property(property: 'id', type: 'integer', example: 10),
        new OA\Property(property: 'email', type: 'string', format: 'email', example: 'patient.demo@example.com'),
        new OA\Property(property: 'first_name', type: 'string', nullable: true, example: 'Ana'),
        new OA\Property(property: 'last_name', type: 'string', nullable: true, example: 'Reyes'),
        new OA\Property(property: 'role', type: 'string', enum: ['ADMIN', 'RECEPTIONIST', 'DENTIST', 'PATIENT']),
        new OA\Property(property: 'is_active', type: 'boolean', example: true),
        new OA\Property(property: 'email_verified', type: 'boolean', example: true),
        new OA\Property(property: 'avatar_url', type: 'string', nullable: true, example: '/api/v1/users/10/avatar'),
        new OA\Property(property: 'created_at', type: 'string', format: 'date-time'),
    ]
)]
#[OA\Schema(
    schema: 'Patient',
    type: 'object',
    properties: [
        new OA\Property(property: 'id', type: 'integer', example: 5),
        new OA\Property(property: 'user_id', type: 'integer', example: 10),
        new OA\Property(property: 'first_name', type: 'string', example: 'Ana'),
        new OA\Property(property: 'last_name', type: 'string', example: 'Reyes'),
        new OA\Property(property: 'date_of_birth', type: 'string', format: 'date', example: '1993-04-12'),
        new OA\Property(property: 'phone', type: 'string', example: '09171234567'),
        new OA\Property(property: 'gender', type: 'string', enum: ['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']),
        new OA\Property(property: 'address', type: 'string', nullable: true),
        new OA\Property(property: 'avatar_url', type: 'string', nullable: true),
    ]
)]
#[OA\Schema(
    schema: 'Dentist',
    type: 'object',
    properties: [
        new OA\Property(property: 'id', type: 'integer', example: 2),
        new OA\Property(property: 'user_id', type: 'integer', example: 4),
        new OA\Property(property: 'first_name', type: 'string', example: 'Clara'),
        new OA\Property(property: 'last_name', type: 'string', example: 'Mendoza'),
        new OA\Property(property: 'specialization', type: 'string', example: 'General Dentistry'),
        new OA\Property(property: 'license_number', type: 'string', example: 'PRC-2026-001'),
        new OA\Property(property: 'default_operatory_chair', type: 'string', example: 'Chair 1'),
        new OA\Property(property: 'is_active', type: 'boolean', example: true),
        new OA\Property(property: 'avatar_url', type: 'string', nullable: true),
    ]
)]
#[OA\Schema(
    schema: 'Service',
    type: 'object',
    properties: [
        new OA\Property(property: 'id', type: 'integer', example: 1),
        new OA\Property(property: 'name', type: 'string', example: 'Dental Prophylaxis (Cleaning)'),
        new OA\Property(property: 'category', type: 'string', example: 'Preventive'),
        new OA\Property(property: 'description', type: 'string', nullable: true),
        new OA\Property(property: 'price', type: 'number', format: 'float', example: 1500.00),
        new OA\Property(property: 'duration_minutes', type: 'integer', enum: [15, 30, 45, 60, 90, 120], example: 30),
        new OA\Property(property: 'is_active', type: 'boolean', example: true),
    ]
)]
#[OA\Schema(
    schema: 'Appointment',
    type: 'object',
    properties: [
        new OA\Property(property: 'id', type: 'integer', example: 101),
        new OA\Property(property: 'patient_id', type: 'integer', example: 5),
        new OA\Property(property: 'dentist_id', type: 'integer', example: 2),
        new OA\Property(property: 'service_id', type: 'integer', example: 1),
        new OA\Property(property: 'start_at', type: 'string', example: '2026-12-01 09:00:00'),
        new OA\Property(property: 'end_at', type: 'string', example: '2026-12-01 09:30:00'),
        new OA\Property(property: 'duration_snapshot', type: 'integer', example: 30),
        new OA\Property(property: 'price_snapshot', type: 'number', format: 'float', example: 1500.00),
        new OA\Property(property: 'status', type: 'string', enum: ['PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED', 'COMPLETED']),
        new OA\Property(property: 'operatory_chair', type: 'string', example: 'Chair 1'),
        new OA\Property(property: 'rescheduled_from_id', type: 'integer', nullable: true),
        new OA\Property(property: 'cancellation_reason', type: 'string', nullable: true),
        new OA\Property(property: 'created_at', type: 'string', format: 'date-time'),
    ]
)]
#[OA\Schema(
    schema: 'AppointmentStatusHistory',
    type: 'object',
    properties: [
        new OA\Property(property: 'id', type: 'integer', example: 12),
        new OA\Property(property: 'appointment_id', type: 'integer', example: 101),
        new OA\Property(property: 'old_status', type: 'string', nullable: true, example: 'PENDING'),
        new OA\Property(property: 'new_status', type: 'string', example: 'CONFIRMED'),
        new OA\Property(property: 'actor_user_id', type: 'integer', nullable: true),
        new OA\Property(property: 'reason', type: 'string', nullable: true),
        new OA\Property(property: 'created_at', type: 'string', format: 'date-time'),
    ]
)]
#[OA\Schema(
    schema: 'Notification',
    type: 'object',
    properties: [
        new OA\Property(property: 'id', type: 'integer', example: 501),
        new OA\Property(property: 'user_id', type: 'integer', example: 10),
        new OA\Property(property: 'role', type: 'string', enum: ['ADMIN', 'RECEPTIONIST', 'DENTIST', 'PATIENT']),
        new OA\Property(property: 'type', type: 'string', example: 'APPOINTMENT_CONFIRMED'),
        new OA\Property(property: 'title', type: 'string', example: 'Appointment Confirmed'),
        new OA\Property(property: 'message', type: 'string', example: 'Your dental visit has been confirmed.'),
        new OA\Property(property: 'reference_type', type: 'string', example: 'appointments'),
        new OA\Property(property: 'reference_id', type: 'integer', nullable: true, example: 101),
        new OA\Property(property: 'read_at', type: 'string', nullable: true),
        new OA\Property(property: 'created_at', type: 'string', format: 'date-time'),
    ]
)]
#[OA\Schema(
    schema: 'TreatmentRecord',
    type: 'object',
    properties: [
        new OA\Property(property: 'id', type: 'integer', example: 21),
        new OA\Property(property: 'appointment_id', type: 'integer', example: 101),
        new OA\Property(property: 'dentist_id', type: 'integer', example: 2),
        new OA\Property(property: 'patient_id', type: 'integer', example: 5),
        new OA\Property(property: 'teeth_treated', type: 'string', nullable: true, example: '11, 21'),
        new OA\Property(property: 'diagnosis', type: 'string', example: 'Mild plaque buildup'),
        new OA\Property(property: 'procedure_notes', type: 'string', example: 'Ultrasonic scaling completed'),
        new OA\Property(property: 'created_at', type: 'string', format: 'date-time'),
    ]
)]
#[OA\Schema(
    schema: 'DashboardSummary',
    type: 'object',
    properties: [
        new OA\Property(property: 'counts', type: 'object'),
        new OA\Property(property: 'appointment_trends', type: 'array', items: new OA\Items(type: 'object')),
        new OA\Property(property: 'outbox_summary', type: 'object'),
        new OA\Property(property: 'recent_errors', type: 'array', items: new OA\Items(type: 'object')),
        new OA\Property(property: 'timezone', type: 'string', example: 'Asia/Manila'),
        new OA\Property(property: 'generated_at', type: 'string', format: 'date-time'),
    ]
)]
#[OA\Schema(
    schema: 'OperationalError',
    type: 'object',
    properties: [
        new OA\Property(property: 'id', type: 'string', example: 'email-42'),
        new OA\Property(property: 'timestamp', type: 'string'),
        new OA\Property(property: 'severity', type: 'string', enum: ['WARNING', 'ERROR']),
        new OA\Property(property: 'module', type: 'string', example: 'email_outbox'),
        new OA\Property(property: 'correlation_id', type: 'string'),
        new OA\Property(property: 'summary', type: 'string', description: 'Redacted operational summary (no stack traces, paths, or secrets).'),
        new OA\Property(property: 'resolution_status', type: 'string'),
    ]
)]
final class Schemas
{
}
