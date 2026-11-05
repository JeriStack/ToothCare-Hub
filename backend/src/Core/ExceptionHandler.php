<?php

declare(strict_types=1);

namespace App\Core;

use PDOException;
use Throwable;

/**
 * Centralized Exception and Error Handler
 * Maps exceptions to standardized API error envelopes and logs sanitized diagnostics.
 */
class ExceptionHandler
{
    private Config $config;
    private Logger $logger;

    public function __construct(?Config $config = null, ?Logger $logger = null)
    {
        $this->config = $config ?? Config::getInstance();
        $this->logger = $logger ?? Logger::getInstance($this->config);
    }

    public static function register(?Config $config = null, ?Logger $logger = null): self
    {
        $handler = new self($config, $logger);

        // Convert PHP errors/warnings/notices to ErrorException
        set_error_handler(function (int $severity, string $message, string $file, int $line): bool {
            if (!(error_reporting() & $severity)) {
                return false;
            }
            throw new \ErrorException($message, 0, $severity, $file, $line);
        });

        // Set global exception handler
        set_exception_handler(function (Throwable $e) use ($handler): void {
            $handler->handle($e);
        });

        // Handle fatal errors on shutdown
        register_shutdown_function(function () use ($handler): void {
            $error = error_get_last();
            if ($error !== null && in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
                while (ob_get_level() > 0) {
                    ob_end_clean();
                }
                $e = new \ErrorException($error['message'], 0, $error['type'], $error['file'], $error['line']);
                $handler->handle($e);
            }
        });

        return $handler;
    }

    public function handle(Throwable $e, ?Request $request = null): void
    {
        while (ob_get_level() > 0) {
            ob_end_clean();
        }

        $response = $this->render($e, $request);
        $response->send();
    }

    public function render(Throwable $e, ?Request $request = null): Response
    {
        $requestId = $request ? $request->getRequestId() : '';
        if ($requestId === '') {
            $requestId = bin2hex(random_bytes(16));
        }

        if ($e instanceof HttpException) {
            $response = Response::error(
                $e->getErrorCode(),
                $e->getMessage(),
                $e->getStatusCode(),
                $e->getDetails()
            );
            $response->setRequestId($requestId);
            return $response;
        }

        if ($e instanceof PDOException) {
            $this->logger->error('Database exception caught in handler', [
                'code' => $e->getCode(),
                'message' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
            ], $requestId);

            $response = Response::error(
                'SERVICE_UNAVAILABLE',
                'Database service is temporarily unavailable.',
                503
            );
            $response->setRequestId($requestId);
            return $response;
        }

        // Generic unexpected error
        $this->logger->critical('Unexpected server exception', [
            'type' => get_class($e),
            'message' => $e->getMessage(),
            'file' => $e->getFile(),
            'line' => $e->getLine(),
            'trace' => $this->config->isDebug() ? $e->getTraceAsString() : 'REDACTED',
        ], $requestId);

        $details = [];
        if ($this->config->isDebug()) {
            $details = [
                'exception' => get_class($e),
                'file' => basename($e->getFile()),
                'line' => $e->getLine(),
            ];
        }

        $response = Response::error(
            'INTERNAL_SERVER_ERROR',
            'An unexpected server error occurred.',
            500,
            $details
        );
        $response->setRequestId($requestId);

        return $response;
    }
}

