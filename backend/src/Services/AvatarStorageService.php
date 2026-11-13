<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\HttpException;
use App\Core\Response;

/**
 * Shared Avatar Image Validation, Storage, and Secure Delivery Service
 */
class AvatarStorageService
{
    public const MAX_AVATAR_BYTES = 2097152; // 2 MB

    private const ALLOWED_AVATAR_MIMES = [
        'image/jpeg' => ['ext' => 'jpg', 'type' => IMAGETYPE_JPEG],
        'image/png' => ['ext' => 'png', 'type' => IMAGETYPE_PNG],
        'image/webp' => ['ext' => 'webp', 'type' => IMAGETYPE_WEBP],
    ];

    private string $storageDir;

    public function __construct(?string $storageDir = null)
    {
        $this->storageDir = $storageDir ?? (dirname(__DIR__, 2) . '/storage/uploads/avatars');
    }

    /**
     * Validate an uploaded avatar file and persist it with a randomized filename.
     *
     * @param array<string, mixed>|null $file
     * @return array{filename: string, mime: string, size_bytes: int}
     */
    public function storeUploadedImage(?array $file): array
    {
        if ($file === null || !isset($file['tmp_name'])) {
            throw HttpException::unprocessableEntity(
                'Please select an image file to upload.',
                ['avatar' => ['Please select a JPG, PNG, or WebP image.']]
            );
        }

        $errorCode = (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE);
        if ($errorCode === UPLOAD_ERR_INI_SIZE || $errorCode === UPLOAD_ERR_FORM_SIZE) {
            throw HttpException::unprocessableEntity(
                'Profile photo must be 2 MB or smaller.',
                ['avatar' => ['Profile photo must be 2 MB or smaller.']]
            );
        }
        if ($errorCode !== UPLOAD_ERR_OK) {
            throw HttpException::unprocessableEntity(
                'Unable to process uploaded image.',
                ['avatar' => ['Please upload a valid JPG, PNG, or WebP image file.']]
            );
        }

        $tmpPath = (string) $file['tmp_name'];
        $isValidUploadSource = PHP_SAPI === 'cli'
            ? ($tmpPath !== '' && is_file($tmpPath))
            : ($tmpPath !== '' && is_uploaded_file($tmpPath));

        if (!$isValidUploadSource) {
            throw HttpException::unprocessableEntity(
                'Invalid uploaded file.',
                ['avatar' => ['Uploaded file could not be verified.']]
            );
        }

        $actualSize = (int) (filesize($tmpPath) ?: ($file['size'] ?? 0));
        if ($actualSize <= 0 || $actualSize > self::MAX_AVATAR_BYTES) {
            throw HttpException::unprocessableEntity(
                'Profile photo must be between 1 byte and 2 MB.',
                ['avatar' => ['Profile photo must be 2 MB or smaller.']]
            );
        }

        $finfo = new \finfo(FILEINFO_MIME_TYPE);
        $detectedMime = strtolower((string) $finfo->file($tmpPath));
        if (!isset(self::ALLOWED_AVATAR_MIMES[$detectedMime])) {
            throw HttpException::unprocessableEntity(
                'Unsupported image format. Please use JPG, PNG, or WebP.',
                ['avatar' => ['Only JPG, PNG, and WebP images are supported.']]
            );
        }

        $imageInfo = @getimagesize($tmpPath);
        $expectedType = self::ALLOWED_AVATAR_MIMES[$detectedMime]['type'];
        if ($imageInfo === false || ($imageInfo[0] ?? 0) <= 0 || ($imageInfo[1] ?? 0) <= 0 || ($imageInfo[2] ?? 0) !== $expectedType) {
            throw HttpException::unprocessableEntity(
                'Uploaded file does not appear to be a valid image.',
                ['avatar' => ['The selected file is corrupted or does not match its image type.']]
            );
        }

        if (!is_dir($this->storageDir) && !mkdir($this->storageDir, 0755, true) && !is_dir($this->storageDir)) {
            throw HttpException::internalError('Failed to prepare profile photo storage directory.');
        }

        $extension = self::ALLOWED_AVATAR_MIMES[$detectedMime]['ext'];
        $filename = bin2hex(random_bytes(16)) . '.' . $extension;
        $destination = $this->storageDir . DIRECTORY_SEPARATOR . $filename;

        $stored = is_uploaded_file($tmpPath)
            ? @move_uploaded_file($tmpPath, $destination)
            : @copy($tmpPath, $destination);

        if (!$stored || !is_file($destination)) {
            throw HttpException::internalError('Failed to store uploaded profile photo.');
        }

        return [
            'filename' => $filename,
            'mime' => $detectedMime,
            'size_bytes' => $actualSize,
        ];
    }

    public function deleteFile(?string $avatarPath): void
    {
        $filename = !empty($avatarPath) ? basename((string) $avatarPath) : '';
        if ($filename === '') {
            return;
        }

        $fullPath = $this->storageDir . DIRECTORY_SEPARATOR . $filename;
        if (is_file($fullPath)) {
            @unlink($fullPath);
        }
    }

    public function buildImageResponse(
        ?string $avatarPath,
        ?string $avatarMime,
        string $cacheControl = 'private, max-age=3600'
    ): Response {
        $filename = !empty($avatarPath) ? basename((string) $avatarPath) : '';
        if ($filename === '') {
            throw HttpException::notFound('Profile photo not found.');
        }

        $filePath = $this->storageDir . DIRECTORY_SEPARATOR . $filename;
        if (!is_file($filePath)) {
            throw HttpException::notFound('Profile photo not found.');
        }

        $bytes = @file_get_contents($filePath);
        if ($bytes === false) {
            throw HttpException::internalError('Failed to read profile photo.');
        }

        $mime = strtolower((string) ($avatarMime ?? ''));
        if (!isset(self::ALLOWED_AVATAR_MIMES[$mime])) {
            $mime = 'application/octet-stream';
        }

        return Response::raw($bytes, 200, [
            'Content-Type' => $mime,
            'Content-Length' => (string) strlen($bytes),
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => $cacheControl,
            'Content-Disposition' => 'inline',
        ]);
    }
}
