/**
 * Test stub for the `server-only` package.
 *
 * In the application this import is a build-time guard: it fails the build if
 * a server module is pulled into a client bundle. Under Vitest there is no
 * such bundle, so the guard has nothing to guard and is stubbed away. The
 * application code is unchanged — this only affects the test resolver.
 */
export {}
