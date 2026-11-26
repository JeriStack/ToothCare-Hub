<?php

declare(strict_types=1);

namespace App\Support;

use App\Core\HttpException;

/**
 * Reusable Server-Side Data Table Query Helper
 *
 * Enforces strict pagination bounds, allowlisted deterministic sorting,
 * safe LIKE wildcard escaping, and a unified backward-compatible pagination
 * metadata envelope exposing both total_records and filtered_records.
 */
final class ServerTableQuery
{
    public const DEFAULT_PER_PAGE = 20;
    public const MAX_PER_PAGE = 100;
    public const MAX_SEARCH_LENGTH = 120;
    public const MAX_PAGE = 100000;
    public const LIKE_ESCAPE_CHAR = '!';

    /**
     * Validate and normalize page & per_page parameters.
     *
     * - Rejects non-integer or <= 0 page / per_page values with 422.
     * - Clamps excessive per_page values (> $maxPerPage) safely to $maxPerPage.
     *
     * @param array<string, mixed> $query
     * @return array{page: int, per_page: int, offset: int}
     * @throws HttpException
     */
    public static function parsePagination(
        array $query,
        int $defaultPerPage = self::DEFAULT_PER_PAGE,
        int $maxPerPage = self::MAX_PER_PAGE
    ): array {
        $page = 1;
        if (array_key_exists('page', $query) && trim((string) $query['page']) !== '') {
            $rawPage = trim((string) $query['page']);
            if (!ctype_digit($rawPage) || (int) $rawPage < 1) {
                throw HttpException::unprocessableEntity('Invalid page parameter.', [
                    'page' => ['page must be a positive integer.'],
                ]);
            }
            $page = min(self::MAX_PAGE, (int) $rawPage);
        }

        $perPage = $defaultPerPage;
        $rawLimitKey = array_key_exists('per_page', $query)
            ? 'per_page'
            : (array_key_exists('limit', $query) ? 'limit' : null);

        if ($rawLimitKey !== null && trim((string) $query[$rawLimitKey]) !== '') {
            $rawLimit = trim((string) $query[$rawLimitKey]);
            if (!ctype_digit($rawLimit) || (int) $rawLimit < 1) {
                throw HttpException::unprocessableEntity("Invalid {$rawLimitKey} parameter.", [
                    $rawLimitKey => ["{$rawLimitKey} must be a positive integer."],
                ]);
            }
            $perPage = min($maxPerPage, max(1, (int) $rawLimit));
        }

        $offset = ($page - 1) * $perPage;

        return [
            'page' => $page,
            'per_page' => $perPage,
            'offset' => $offset,
        ];
    }

    /**
     * Resolve and validate sort_by / sort_dir strictly against an explicit allowlist.
     *
     * @param array<string, mixed> $query
     * @param array<string, string|list<string>> $allowlist Map of client key => SQL column(s)
     * @return array{sort_by: string, sort_dir: 'ASC'|'DESC', order_by_sql: string}
     * @throws HttpException
     */
    public static function parseSort(
        array $query,
        array $allowlist,
        string $defaultKey,
        string $defaultDir = 'DESC',
        string $tieBreakerColumn = 'id',
        bool $strict = true
    ): array {
        $sortBy = $defaultKey;
        if (array_key_exists('sort_by', $query) && trim((string) $query['sort_by']) !== '') {
            $candidate = strtolower(trim((string) $query['sort_by']));
            if (array_key_exists($candidate, $allowlist)) {
                $sortBy = $candidate;
            } elseif ($strict) {
                throw HttpException::unprocessableEntity('Invalid sort_by parameter.', [
                    'sort_by' => ['Allowed sort columns: ' . implode(', ', array_keys($allowlist))],
                ]);
            }
        }

        $direction = strtoupper($defaultDir) === 'ASC' ? 'ASC' : 'DESC';
        if (array_key_exists('sort_dir', $query) && trim((string) $query['sort_dir']) !== '') {
            $rawDir = strtoupper(trim((string) $query['sort_dir']));
            if ($rawDir === 'ASC' || $rawDir === 'DESC') {
                $direction = $rawDir;
            } elseif ($strict) {
                throw HttpException::unprocessableEntity('Invalid sort_dir parameter.', [
                    'sort_dir' => ['sort_dir must be either asc or desc.'],
                ]);
            }
        }

        $target = $allowlist[$sortBy] ?? $allowlist[$defaultKey];
        $columns = is_array($target) ? $target : [$target];
        $clauses = [];
        $hasTieBreaker = false;

        foreach ($columns as $col) {
            $clauses[] = "{$col} {$direction}";
            if ($col === $tieBreakerColumn) {
                $hasTieBreaker = true;
            }
        }

        if ($tieBreakerColumn !== '' && !$hasTieBreaker) {
            $clauses[] = "{$tieBreakerColumn} {$direction}";
        }

        return [
            'sort_by' => $sortBy,
            'sort_dir' => $direction,
            'order_by_sql' => implode(', ', $clauses),
        ];
    }

    /**
     * Normalize and escape a search keyword for safe literal SQL LIKE matching.
     * Uses '!' as the SQL ESCAPE character so queries execute identically on both
     * MySQL 8.0 (default backslash behavior) and SQLite 3.
     */
    public static function escapeLike(string $term, int $maxLength = self::MAX_SEARCH_LENGTH): string
    {
        $clean = mb_substr(trim($term), 0, $maxLength);
        return str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $clean);
    }

    /**
     * Build a unified, backward-compatible pagination metadata envelope exposing
     * both unfiltered total_records and filtered_records counts plus active sorting.
     *
     * @param array<string, mixed> $extra
     * @return array<string, mixed>
     */
    public static function buildMeta(
        int $totalRecords,
        int $filteredRecords,
        int $page,
        int $perPage,
        ?string $sortBy = null,
        ?string $sortDir = null,
        array $extra = []
    ): array {
        $totalRecords = max(0, $totalRecords);
        $filteredRecords = max(0, $filteredRecords);
        $page = max(1, $page);
        $perPage = max(1, $perPage);
        $totalPages = $filteredRecords > 0 ? (int) ceil($filteredRecords / $perPage) : 1;

        $meta = [
            'total' => $filteredRecords,
            'total_records' => $totalRecords,
            'filtered_records' => $filteredRecords,
            'page' => $page,
            'current_page' => $page,
            'per_page' => $perPage,
            'last_page' => $totalPages,
            'total_pages' => $totalPages,
        ];

        if ($sortBy !== null && $sortDir !== null) {
            $meta['sorting'] = [
                'sort_by' => $sortBy,
                'sort_dir' => strtolower($sortDir),
            ];
        }

        return array_merge($meta, $extra);
    }
}
