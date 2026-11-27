<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\HttpException;
use App\Core\Request;
use App\Core\Response;
use App\Services\ArchiveService;

/**
 * Role-Aware Archive & Retention Controller
 *
 * Exposes DRBAC-protected endpoints for inspecting, archiving, restoring,
 * and exporting compliance archive records scoped per user role.
 */
class ArchiveController
{
    private ArchiveService $archiveService;

    public function __construct(?ArchiveService $archiveService = null)
    {
        $this->archiveService = $archiveService ?? new ArchiveService();
    }

    /**
     * GET /api/v1/archives
     * Server-side paginated, searchable, filterable, role-scoped archive table.
     */
    public function index(Request $request): Response
    {
        $user = $request->getUser();
        if ($user === null || !isset($user['id'])) {
            throw HttpException::unauthorized('Authentication is required to view archives.');
        }

        $result = $this->archiveService->listArchives($user, $request->getQueryParams());
        return Response::paginated($result['data'], $result['meta']);
    }

    /**
     * GET /api/v1/archives/summary
     * Role-scoped archive summary counts and actor capabilities.
     */
    public function summary(Request $request): Response
    {
        $user = $request->getUser();
        if ($user === null || !isset($user['id'])) {
            throw HttpException::unauthorized('Authentication is required.');
        }

        return Response::success($this->archiveService->getSummary($user));
    }

    /**
     * GET /api/v1/archives/{id}
     * Retrieve single archive record with SHA-256 tamper verification & sanitized snapshot.
     */
    public function show(Request $request): Response
    {
        $user = $request->getUser();
        if ($user === null || !isset($user['id'])) {
            throw HttpException::unauthorized('Authentication is required.');
        }

        $id = (int) $request->getParam('id');
        if ($id <= 0) {
            throw HttpException::badRequest('Invalid archive record ID.');
        }

        return Response::success($this->archiveService->getArchiveDetail($user, $id));
    }

    /**
     * POST /api/v1/archives
     * Archive a live eligible entity with mandatory reason and retention policy.
     */
    public function store(Request $request): Response
    {
        $user = $request->getUser();
        if ($user === null || !isset($user['id'])) {
            throw HttpException::unauthorized('Authentication is required.');
        }

        $created = $this->archiveService->archiveEntity(
            $user,
            $request->getBody() ?? [],
            $request->getClientIp(),
            $request->getHeader('user-agent')
        );

        return Response::created($created, ['message' => 'Record archived with tamper-evident snapshot.']);
    }

    /**
     * POST /api/v1/archives/{id}/restore
     * Restore a reversible soft-archived record (Admin only).
     */
    public function restore(Request $request): Response
    {
        $user = $request->getUser();
        if ($user === null || !isset($user['id'])) {
            throw HttpException::unauthorized('Authentication is required.');
        }

        $id = (int) $request->getParam('id');
        if ($id <= 0) {
            throw HttpException::badRequest('Invalid archive record ID.');
        }

        $restored = $this->archiveService->restoreArchive(
            $user,
            $id,
            $request->getBody() ?? [],
            $request->getClientIp(),
            $request->getHeader('user-agent')
        );

        return Response::success($restored, 200, ['message' => 'Archived record restored successfully.']);
    }

    /**
     * GET /api/v1/archives/eligibility
     * Pre-check archival eligibility, blocking unresolved appointments, and safeguards before confirming.
     */
    public function eligibility(Request $request): Response
    {
        $user = $request->getUser();
        if ($user === null || !isset($user['id'])) {
            throw HttpException::unauthorized('Authentication is required.');
        }

        $q = $request->getQueryParams();
        $entityType = strtolower(trim((string) ($q['entity_type'] ?? '')));
        $entityId = (int) ($q['entity_id'] ?? 0);

        return Response::success($this->archiveService->checkArchivalEligibility($user, $entityType, $entityId));
    }

    /**
     * GET /api/v1/archives/{id}/history
     * Retrieve multi-cycle archival and restoration timeline for an archived record's entity.
     */
    public function history(Request $request): Response
    {
        $user = $request->getUser();
        if ($user === null || !isset($user['id'])) {
            throw HttpException::unauthorized('Authentication is required.');
        }

        $id = (int) $request->getParam('id');
        if ($id <= 0) {
            throw HttpException::badRequest('Invalid archive record ID.');
        }

        return Response::success($this->archiveService->getArchiveCycleHistory($user, $id));
    }

    /**
     * GET /api/v1/archives/export
     * Export filtered role-scoped archive records to CSV (Admin / Receptionist).
     */
    public function export(Request $request): Response
    {
        $user = $request->getUser();
        if ($user === null || !isset($user['id'])) {
            throw HttpException::unauthorized('Authentication is required.');
        }

        $csv = $this->archiveService->exportCsv(
            $user,
            $request->getQueryParams(),
            $request->getClientIp(),
            $request->getHeader('user-agent')
        );

        $filename = 'toothcare_archives_' . date('Ymd_His') . '.csv';
        return new Response(200, $csv, [
            'Content-Type' => 'text/csv; charset=utf-8',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
            'Cache-Control' => 'no-store, no-cache',
        ]);
    }
}
