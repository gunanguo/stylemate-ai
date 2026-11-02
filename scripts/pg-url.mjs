/**
 * Hosted Postgres connection settings shared by the Vercel migrator and the
 * server runtime. Local dev leaves DATABASE_URL unset and uses PGLite instead.
 */

const URL_KEYS = ["DATABASE_URL", "POSTGRES_URL"];

/**
 * First non-empty connection string. Vercel Postgres injects POSTGRES_URL.
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string | undefined}
 */
export function resolveDatabaseUrl(env = process.env) {
  for (const key of URL_KEYS) {
    const value = env[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

/**
 * Split a migration file into single statements. PgBouncer (Neon pooler,
 * Vercel Postgres) rejects several statements in one query.
 * @param {string} sql
 * @returns {string[]}
 */
export function sqlStatements(sql) {
  return sql
    .split(";")
    .map((part) => part.trim())
    .filter((part) =>
      part.split("\n").some((line) => {
        const trimmed = line.trim();
        return trimmed.length > 0 && !trimmed.startsWith("--");
      }),
    );
}

/**
 * Pool options for Neon / Vercel Postgres. One connection per serverless instance.
 * @param {string} connectionString
 */
export function hostedPoolOptions(connectionString) {
  const local = /@(localhost|127\.0\.0\.1|\[::1\])(?::|\/|$)/.test(connectionString);
  const disableSsl = /sslmode=disable/.test(connectionString);
  return {
    connectionString,
    max: 1,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 15_000,
    ssl: local || disableSsl ? undefined : { rejectUnauthorized: false },
  };
}
