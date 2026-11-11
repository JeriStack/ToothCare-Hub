<?php

declare(strict_types=1);

namespace App\Core;

use App\Middleware\CorsMiddleware;
use App\Middleware\CsrfMiddleware;
use App\Middleware\MiddlewareInterface;
use App\Middleware\RequestIdMiddleware;
use Throwable;

/**
 * ToothCare Hub Application Kernel
 * Coordinates configuration, exception handling, middleware pipeline, and route dispatch.
 */
class Application
{
    private static ?self $instance = null;
    private Config $config;
    private Logger $logger;
    private ExceptionHandler $exceptionHandler;
    private Router $router;
    /**
     * @var list<MiddlewareInterface>
     */
    private array $middleware = [];

    public function __construct(?string $baseDir = null, bool $registerErrorHandlers = true)
    {
        $this->config = Config::getInstance($baseDir);
        $this->logger = Logger::getInstance($this->config);
        
        if ($registerErrorHandlers) {
            $this->exceptionHandler = ExceptionHandler::register($this->config, $this->logger);
        } else {
            $this->exceptionHandler = new ExceptionHandler($this->config, $this->logger);
        }

        $this->router = new Router();

        $this->registerDefaultMiddleware();
        $this->loadRoutes($baseDir);
    }

    public static function boot(?string $baseDir = null, bool $registerErrorHandlers = true): self
    {
        if (self::$instance === null) {
            self::$instance = new self($baseDir, $registerErrorHandlers);
        }

        return self::$instance;
    }

    public static function setInstance(?self $instance): void
    {
        self::$instance = $instance;
    }

    private function registerDefaultMiddleware(): void
    {
        $this->middleware = [
            new RequestIdMiddleware(),
            new CorsMiddleware($this->config),
            new CsrfMiddleware(),
        ];
    }

    public function addMiddleware(MiddlewareInterface $middleware): self
    {
        $this->middleware[] = $middleware;
        return $this;
    }

    private function loadRoutes(?string $baseDir = null): void
    {
        $routesPath = ($baseDir ?? dirname(__DIR__, 2)) . '/src/Routes/api.php';
        if (file_exists($routesPath)) {
            $router = $this->router;
            require $routesPath;
        }
    }

    public function getRouter(): Router
    {
        return $this->router;
    }

    public function getConfig(): Config
    {
        return $this->config;
    }

    public function getLogger(): Logger
    {
        return $this->logger;
    }

    /**
     * Handle incoming Request and return Response
     */
    public function handle(Request $request): Response
    {
        try {
            $pipeline = $this->middleware;

            $runner = fn (Request $req): Response => $this->router->dispatch($req);

            while ($mw = array_pop($pipeline)) {
                $next = $runner;
                $runner = fn (Request $req): Response => $mw->handle($req, $next);
            }

            return $runner($request);
        } catch (Throwable $e) {
            return $this->exceptionHandler->render($e, $request);
        }
    }

    /**
     * Run the application and send the response
     */
    public function run(): void
    {
        try {
            $request = Request::createFromGlobals($this->config);
            $response = $this->handle($request);
            $response->send();
        } catch (Throwable $e) {
            $this->exceptionHandler->handle($e);
        }
    }
}
