<?php

declare(strict_types=1);

namespace App\Core;

/**
 * REST API Router
 * Supports method routing, dynamic route parameters, route-level middleware, and standard 404/405 dispatching.
 */
class Router
{
    /**
     * @var array<int, array{
     *   method: string,
     *   pattern: string,
     *   regex: string,
     *   param_names: list<string>,
     *   handler: callable|array{0: class-string, 1: string},
     *   middleware: list<callable|string>
     * }>
     */
    private array $routes = [];

    private string $groupPrefix = '';
    /**
     * @var list<callable|string>
     */
    private array $groupMiddleware = [];

    public function get(string $path, callable|array $handler, array $middleware = []): self
    {
        return $this->addRoute('GET', $path, $handler, $middleware);
    }

    public function post(string $path, callable|array $handler, array $middleware = []): self
    {
        return $this->addRoute('POST', $path, $handler, $middleware);
    }

    public function put(string $path, callable|array $handler, array $middleware = []): self
    {
        return $this->addRoute('PUT', $path, $handler, $middleware);
    }

    public function patch(string $path, callable|array $handler, array $middleware = []): self
    {
        return $this->addRoute('PATCH', $path, $handler, $middleware);
    }

    public function delete(string $path, callable|array $handler, array $middleware = []): self
    {
        return $this->addRoute('DELETE', $path, $handler, $middleware);
    }

    public function options(string $path, callable|array $handler, array $middleware = []): self
    {
        return $this->addRoute('OPTIONS', $path, $handler, $middleware);
    }

    /**
     * @param list<callable|string> $middleware
     */
    public function group(string $prefix, callable $callback, array $middleware = []): void
    {
        $previousPrefix = $this->groupPrefix;
        $previousMiddleware = $this->groupMiddleware;

        $this->groupPrefix = rtrim($previousPrefix . '/' . trim($prefix, '/'), '/');
        $this->groupMiddleware = array_merge($previousMiddleware, $middleware);

        $callback($this);

        $this->groupPrefix = $previousPrefix;
        $this->groupMiddleware = $previousMiddleware;
    }

    /**
     * @param list<callable|string> $middleware
     */
    public function addRoute(string $method, string $path, callable|array $handler, array $middleware = []): self
    {
        $fullPath = rtrim($this->groupPrefix . '/' . trim($path, '/'), '/');
        $normalizedPath = Request::normalizePath($fullPath);

        // Convert {param} or {param:[regex]} to regex
        $paramNames = [];
        $pattern = preg_replace_callback('#\{([a-zA-Z0-9_]+)(?::([^}]+))?\}#', function ($matches) use (&$paramNames) {
            $paramNames[] = $matches[1];
            $customRegex = !empty($matches[2]) ? $matches[2] : '[^/]+';
            return "({$customRegex})";
        }, $normalizedPath);

        $regex = '#^' . $pattern . '$#';

        $this->routes[] = [
            'method' => strtoupper($method),
            'pattern' => $normalizedPath,
            'regex' => $regex,
            'param_names' => $paramNames,
            'handler' => $handler,
            'middleware' => array_merge($this->groupMiddleware, $middleware),
        ];

        return $this;
    }

    /**
     * Dispatch the request against registered routes
     */
    public function dispatch(Request $request): Response
    {
        $method = $request->getMethod();
        $path = $request->getPath();

        $matchedRoute = null;
        $allowedMethods = [];

        foreach ($this->routes as $route) {
            if (preg_match($route['regex'], $path, $matches)) {
                $allowedMethods[] = $route['method'];

                if ($route['method'] === $method) {
                    $matchedRoute = $route;
                    // Extract named parameters
                    array_shift($matches);
                    $params = [];
                    foreach ($route['param_names'] as $index => $name) {
                        $params[$name] = $matches[$index] ?? '';
                    }
                    $request->setRouteParams($params);
                    break;
                }
            }
        }

        if ($matchedRoute !== null) {
            return $this->executeRoute($matchedRoute, $request);
        }

        if (!empty($allowedMethods)) {
            $uniqueAllowed = array_values(array_unique($allowedMethods));
            $exception = HttpException::methodNotAllowed($uniqueAllowed);
            $response = Response::error(
                $exception->getErrorCode(),
                $exception->getMessage(),
                $exception->getStatusCode(),
                $exception->getDetails()
            );
            $response->withHeader('Allow', implode(', ', $uniqueAllowed));
            return $response;
        }

        throw HttpException::notFound("The requested route '{$path}' was not found.");
    }

    /**
     * @param array{
     *   method: string,
     *   pattern: string,
     *   regex: string,
     *   param_names: list<string>,
     *   handler: callable|array{0: class-string, 1: string},
     *   middleware: list<callable|string>
     * } $route
     */
    private function executeRoute(array $route, Request $request): Response
    {
        $pipeline = $route['middleware'];
        $handler = $route['handler'];

        $runner = function (Request $req) use ($handler): Response {
            if (is_array($handler)) {
                [$class, $method] = $handler;
                $controller = new $class();
                return $controller->$method($req);
            }

            return $handler($req);
        };

        // If route has middleware, pipe through them
        while ($middleware = array_pop($pipeline)) {
            $next = $runner;
            $runner = function (Request $req) use ($middleware, $next): Response {
                if (is_string($middleware)) {
                    $mw = new $middleware();
                    return $mw->handle($req, $next);
                }
                return $middleware($req, $next);
            };
        }

        return $runner($request);
    }

    /**
     * @return array<int, array{method: string, pattern: string}>
     */
    public function getRoutes(): array
    {
        return array_map(fn ($r) => ['method' => $r['method'], 'pattern' => $r['pattern']], $this->routes);
    }
}

