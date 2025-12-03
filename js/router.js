/**
 * Simple hash-based router for AA Literature Study
 * Compatible with GitHub Pages (no server-side routing needed)
 */

class Router {
    constructor() {
        this.routes = [];
        this.currentRoute = null;
        this.beforeHooks = [];
        this.afterHooks = [];
        this.ready = false; // Flag to prevent handling before routes are registered

        // Listen for hash changes
        window.addEventListener('hashchange', () => {
            if (this.ready) {
                this.handleRoute();
            } else {
                console.warn('Router: Ignoring hashchange - router not ready yet');
            }
        });
        // Note: Initial route handling is done by app.js after initialization
    }

    /**
     * Mark router as ready (call after all routes are registered)
     */
    setReady() {
        this.ready = true;
        console.log('Router: Now ready to handle routes');
    }

    /**
     * Register a route
     * @param {string} pattern - Route pattern (e.g., '/book/:bookId/chapter/:chapterId')
     * @param {Function} handler - Handler function receiving params object
     */
    on(pattern, handler) {
        const paramNames = [];

        // Handle catch-all route specially
        if (pattern === '*') {
            this.routes.push({
                pattern,
                regex: null, // Special marker for catch-all
                paramNames: [],
                handler,
                isCatchAll: true
            });
            return this;
        }

        // Convert pattern to regex
        // IMPORTANT: Extract param names BEFORE escaping slashes
        const regexPattern = pattern
            .replace(/:([^/]+)/g, (_, name) => {
                paramNames.push(name);
                return '([^/]+)';
            })
            .replace(/\//g, '\\/');

        this.routes.push({
            pattern,
            regex: new RegExp(`^${regexPattern}$`),
            paramNames,
            handler
        });

        return this;
    }

    /**
     * Add a before navigation hook
     */
    before(hook) {
        this.beforeHooks.push(hook);
        return this;
    }

    /**
     * Add an after navigation hook
     */
    after(hook) {
        this.afterHooks.push(hook);
        return this;
    }

    /**
     * Navigate to a route
     */
    navigate(path) {
        console.log('Router.navigate called with path:', path);
        console.log('Router.navigate stack trace:', new Error().stack);

        // Validate path doesn't contain undefined
        if (path.includes('undefined')) {
            console.error('Router.navigate: Path contains "undefined"!', path);
            console.error('This indicates a bug - check the calling code');
            return; // Don't navigate to invalid path
        }

        window.location.hash = path;
    }

    /**
     * Get current path from hash
     */
    getPath() {
        const hash = window.location.hash.slice(1); // Remove #
        // Strip query string if present
        const queryIndex = hash.indexOf('?');
        if (queryIndex !== -1) {
            return hash.slice(0, queryIndex) || '/';
        }
        return hash || '/';
    }

    /**
     * Handle route change
     */
    async handleRoute() {
        const path = this.getPath();
        console.log('Router.handleRoute: Processing path:', path);
        console.log('Router.handleRoute: Current hash:', window.location.hash);

        // Auto-fix corrupted URLs containing "undefined" or "null"
        if (path.includes('undefined') || path.includes('null')) {
            console.warn('Router: Detected corrupted URL with undefined/null, redirecting to home');
            window.location.hash = '/';
            return;
        }

        // Run before hooks
        for (const hook of this.beforeHooks) {
            const result = await hook(path);
            if (result === false) return;
        }

        // Find matching route
        let matched = false;
        for (const route of this.routes) {
            // Skip catch-all routes during normal matching
            if (route.isCatchAll) continue;

            const match = path.match(route.regex);
            if (match) {
                matched = true;

                // Extract params
                const params = {};
                route.paramNames.forEach((name, index) => {
                    params[name] = decodeURIComponent(match[index + 1]);
                });

                // Store current route info
                this.currentRoute = {
                    path,
                    pattern: route.pattern,
                    params
                };

                // Call handler
                try {
                    await route.handler(params);
                } catch (error) {
                    console.error('Route handler error:', error);
                }

                break;
            }
        }

        // If no route matched, try catch-all route
        if (!matched) {
            const catchAllRoute = this.routes.find(r => r.isCatchAll);
            if (catchAllRoute) {
                this.currentRoute = { path, pattern: '*', params: {} };
                await catchAllRoute.handler({ path });
            }
        }

        // Run after hooks
        for (const hook of this.afterHooks) {
            await hook(path, this.currentRoute);
        }
    }

    /**
     * Get current route info
     */
    getCurrent() {
        return this.currentRoute;
    }

    /**
     * Parse query string from hash
     */
    getQuery() {
        const hash = window.location.hash.slice(1);
        const queryIndex = hash.indexOf('?');
        if (queryIndex === -1) return {};

        const queryString = hash.slice(queryIndex + 1);
        const params = new URLSearchParams(queryString);
        const query = {};
        for (const [key, value] of params) {
            query[key] = value;
        }
        return query;
    }

    /**
     * Build a path with params
     */
    buildPath(pattern, params = {}) {
        let path = pattern;
        for (const [key, value] of Object.entries(params)) {
            path = path.replace(`:${key}`, encodeURIComponent(value));
        }
        return path;
    }
}

// Create and export singleton instance
export const router = new Router();

// Utility function for navigation
export function navigateTo(path) {
    console.log('navigateTo() called with:', path);
    if (!path || path.includes('undefined') || path.includes('null')) {
        console.error('navigateTo: Invalid path detected!', path);
        console.error('Stack trace:', new Error().stack);
        return;
    }
    router.navigate(path);
}

// Utility to build links
export function buildLink(pattern, params) {
    return '#' + router.buildPath(pattern, params);
}
