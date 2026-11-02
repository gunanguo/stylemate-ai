import { pendingMigrations } from "../../scripts/migration-plan.mjs";
import { hostedPoolOptions, resolveDatabaseUrl, sqlStatements } from "../../scripts/pg-url.mjs";

/** Which database backend is active. */
export type DbSource = "postgres" | "pglite";

// An empty/whitespace URL must mean "unset" — otherwise production would
// silently run on the PGLite fallback. Vercel Postgres injects POSTGRES_URL.
const databaseUrl =
  typeof process !== "undefined" ? resolveDatabaseUrl() : undefined;

/**
 * Hosted Postgres when `DATABASE_URL` or `POSTGRES_URL` is set (Render + Neon,
 * or Vercel). Otherwise a local embedded PGLite so `npm run dev` works with no
 * database. PGLite is not used on Render or Vercel: those disks do not persist.
 */
export const dbSource: DbSource = databaseUrl ? "postgres" : "pglite";

function isEphemeralHost() {
  return process.env.VERCEL === "1" || process.env.RENDER === "true";
}

function bundledMigrations(): Record<string, string> {
  return import.meta.glob("/migrations/*.sql", {
    query: "?raw",
    import: "default",
    eager: true,
  }) as Record<string, string>;
}

function refuseServerlessPglite() {
  if (isEphemeralHost()) {
    throw new Error(
      "DATABASE_URL is required on Render and Vercel. Embedded PGlite does not persist there. See DEPLOY.md.",
    );
  }
}

/**
 * Minimal shared SQL surface, satisfied by both Neon and PGLite. Both the
 * tagged-template and `.query()` forms resolve to an array of row objects:
 *
 *   const sql = await getSql();
 *   const rows = await sql`select * from todos where id = ${id}`; // parameterized
 *   const rows2 = await sql.query("select * from todos where id = $1", [id]);
 */
export interface Sql {
  <T = Record<string, unknown>>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<T[]>;
  query<T = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<T[]>;
}

/**
 * Init state lives on globalThis as promises: dev HMR creates new instances of
 * this module, and two instances racing module-level state would open a second
 * pool or run two concurrent PGLite migration passes (whose duplicate
 * `_migrations` insert rejects — and would get memoized, poisoning every later
 * `getSql()`). A failed init clears its slot so the next call retries.
 */
const globalRef = globalThis as typeof globalThis & {
  __pgSqlPromise__?: Promise<Sql>;
  __pgPool__?: import("pg").Pool;
  __pgliteInstance__?: Promise<import("@electric-sql/pglite").PGlite>;
  __pgliteMigrateChain__?: Promise<void>;
};

/**
 * Result-type parity: Postgres sends every value as text plus a type OID — the
 * JS value is the DRIVER's parsing choice, and pg and PGLite disagree (pg:
 * int8 -> string, date -> local-midnight Date; PGLite: int8 -> BigInt, which
 * JSON.stringify rejects, date -> UTC Date). Normalize both so preview and
 * production return identical, JSON-safe shapes:
 *   int8/bigint (incl. count(*)) -> number (past 2^53 loses precision — cast
 *                                   `::text` if you ever need huge integers)
 *   date                         -> 'YYYY-MM-DD' string
 *   interval                     -> Postgres interval text
 * numeric already comes back as a string on both (arbitrary precision).
 */
const OID_INT8 = 20;
const OID_DATE = 1082;
const OID_INTERVAL = 1186;
const identity = (v: string) => v;

type Run = <T>(text: string, params: unknown[]) => Promise<T[]>;

/** Wrap a query runner in the tagged-template + `.query()` `Sql` surface. */
function toSql(run: Run): Sql {
  const sql = (async <T = Record<string, unknown>>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<T[]> => {
    // Rebuild with $1, $2, … placeholders so values stay parameterized.
    let text = strings[0];
    for (let i = 0; i < values.length; i += 1) text += `$${i + 1}${strings[i + 1]}`;
    return run<T>(text, values);
  }) as unknown as Sql;
  sql.query = <T = Record<string, unknown>>(text: string, params: unknown[] = []) =>
    run<T>(text, params);
  return sql;
}

async function migratePostgres(pool: import("pg").Pool) {
  const client = await pool.connect();
  try {
    await client.query(
      "create table if not exists _migrations (name text primary key, applied_at timestamptz not null default now())",
    );
    const doneRows = await client.query<{ name: string }>("select name from _migrations");
    const done = doneRows.rows.map((row) => row.name);
    const migrations = bundledMigrations();
    for (const { name, path } of pendingMigrations(Object.keys(migrations), done)) {
      try {
        await client.query("begin");
        for (const statement of sqlStatements(migrations[path] ?? "")) {
          await client.query(statement);
        }
        await client.query("insert into _migrations (name) values ($1)", [name]);
        await client.query("commit");
      } catch (err) {
        try {
          await client.query("rollback");
        } catch {
          // keep the original error
        }
        // Another instance applied this file between our select and insert.
        if ((err as { code?: string }).code === "23505") continue;
        throw err;
      }
    }
  } finally {
    client.release();
  }
}

function createPostgresSql(): Promise<Sql> {
  globalRef.__pgSqlPromise__ ??= (async () => {
    if (!databaseUrl) throw new Error("DATABASE_URL is not set");
    const { Pool, types } = await import("pg");
    types.setTypeParser(OID_INT8, Number);
    types.setTypeParser(OID_DATE, identity);
    types.setTypeParser(OID_INTERVAL, identity);
    const pool = new Pool(hostedPoolOptions(databaseUrl));
    globalRef.__pgPool__ = pool;
    await migratePostgres(pool);
    return toSql(async <T>(text: string, params: unknown[]) => {
      const res = await pool.query(text, params);
      return res.rows as T[];
    });
  })().catch((err) => {
    globalRef.__pgSqlPromise__ = undefined;
    globalRef.__pgPool__ = undefined;
    throw err;
  });
  return globalRef.__pgSqlPromise__;
}

async function pgliteDataDir() {
  try {
    const { mkdirSync } = await import("node:fs");
    const { join } = await import("node:path");
    const dir = join(process.cwd(), ".data", "pglite");
    mkdirSync(dir, { recursive: true });
    return dir;
  } catch {
    return undefined;
  }
}

async function createPgliteSql(): Promise<Sql> {
  refuseServerlessPglite();
  // Embedded Postgres, imported on demand so it never loads on the Neon path.
  // One shared instance per process. The files live under .data/pglite so a
  // preview restart keeps accounts. If that directory cannot be created, fall
  // back to memory.
  globalRef.__pgliteInstance__ ??= (async () => {
    const { PGlite } = await import("@electric-sql/pglite");
    const dataDir = await pgliteDataDir();
    const pg = new PGlite({
      ...(dataDir ? { dataDir } : {}),
      parsers: {
        [OID_INT8]: Number,
        [OID_DATE]: identity,
        [OID_INTERVAL]: identity,
      },
    });
    await pg.waitReady;
    await pg.exec(
      "create table if not exists _migrations (name text primary key, applied_at timestamptz not null default now())",
    );
    return pg;
  })().catch((err) => {
    globalRef.__pgliteInstance__ = undefined;
    throw err;
  });
  const pg = await globalRef.__pgliteInstance__;

  // Apply migrations/ (the single schema source) so preview matches production.
  // SQL is inlined by the bundler via import.meta.glob (no runtime fs); applied
  // files are tracked in _migrations. The glob does not descend, so the opt-in
  // auth schema under migrations/auth/ stays out. Runs once per module instance
  // — so an HMR reload after adding a migration file applies it live — with
  // passes serialized on a global chain so concurrent callers never
  // double-apply.
  const migrate = async (): Promise<void> => {
    const migrations = bundledMigrations();
    const doneRows = await pg.query<{ name: string }>(
      "select name from _migrations",
    );
    const done = doneRows.rows.map((r) => r.name);
    for (const { name, path } of pendingMigrations(Object.keys(migrations), done)) {
      // Apply + record atomically (parity with scripts/migrate.mjs) so a failed
      // statement can't leave a file half-applied but untracked.
      await pg.transaction(async (tx) => {
        await tx.exec(migrations[path]);
        await tx.query("insert into _migrations (name) values ($1)", [name]);
      });
    }
  };
  const pass = (globalRef.__pgliteMigrateChain__ ?? Promise.resolve())
    .catch(() => undefined) // an earlier failed pass must not wedge the chain
    .then(migrate);
  globalRef.__pgliteMigrateChain__ = pass;
  await pass;

  return toSql(async <T>(text: string, params: unknown[]) => {
    const result = await pg.query<T>(text, params);
    return result.rows;
  });
}

let sqlPromise: Promise<Sql> | null = null;

async function createSql(): Promise<Sql> {
  if (typeof window !== "undefined") {
    throw new Error(
      "@/lib/db is server-only — call getSql() from a createServerFn handler " +
        "or a server route loader, never from client code.",
    );
  }
  return dbSource === "postgres" ? createPostgresSql() : createPgliteSql();
}

/**
 * Get the shared, **server-only** SQL client. Hosted Postgres when
 * `DATABASE_URL` or `POSTGRES_URL` is set, otherwise the local PGLite fallback.
 * Memoized — safe to call per request. Migrations run before the first query.
 *
 * Schema comes from `migrations/*.sql`, auto-applied before the first query on
 * both backends — define tables there, never inline in server functions.
 */
export function getSql(): Promise<Sql> {
  sqlPromise ??= createSql().catch((err) => {
    sqlPromise = null; // don't memoize failures — let the next call retry
    throw err;
  });
  return sqlPromise;
}

/**
 * The shared PGLite instance (preview only), with `migrations/*.sql` applied.
 * Lets Better Auth persist to the SAME embedded DB as app data in preview (via a
 * Kysely dialect). Throws when `DATABASE_URL` is set (that path uses Neon).
 */
/**
 * Run queries on one connection. PGLite uses its transaction helper; Neon
 * uses a checked-out pool client. A thrown error rolls the transaction back.
 */
export async function withTransaction<T>(fn: (sql: Sql) => Promise<T>): Promise<T> {
  if (typeof window !== "undefined") {
    throw new Error("withTransaction is server-only");
  }
  if (dbSource === "pglite") {
    const pg = await getPglite();
    return pg.transaction(async (tx) => {
      const sql = toSql(async <Row>(text: string, params: unknown[]) => {
        const result = await tx.query<Row>(text, params);
        return result.rows;
      });
      return fn(sql);
    });
  }
  await getSql();
  const pool = globalRef.__pgPool__;
  if (!pool) throw new Error("Postgres pool failed to initialize");
  const client = await pool.connect();
  try {
    await client.query("begin");
    const sql = toSql(async <Row>(text: string, params: unknown[]) => {
      const result = await client.query(text, params);
      return result.rows as Row[];
    });
    const value = await fn(sql);
    await client.query("commit");
    return value;
  } catch (err) {
    try {
      await client.query("rollback");
    } catch {
      // keep the original error
    }
    throw err;
  } finally {
    client.release();
  }
}

export async function getPglite(): Promise<import("@electric-sql/pglite").PGlite> {
  refuseServerlessPglite();
  if (dbSource !== "pglite") {
    throw new Error("getPglite() is only available on the PGLite fallback (no DATABASE_URL)");
  }
  await getSql();
  const pg = await globalRef.__pgliteInstance__;
  if (!pg) throw new Error("PGLite instance failed to initialize");
  return pg;
}

/**
 * Finish DB bootstrap before the server handles traffic.
 *
 * - **PGLite** (preview / no `DATABASE_URL`): open the in-memory DB and apply
 *   `migrations/*.sql`. Idempotent — concurrent callers share one promise.
 * - **Neon**: no-op (pool is created lazily on first query).
 *
 * Vite `configureServer` awaits this at dev startup; production imports of this
 * module kick it off immediately (see bottom of file).
 */
export function ensureDbReady(): Promise<void> {
  if (dbSource !== "pglite" || isEphemeralHost()) return Promise.resolve();
  return getSql().then(() => undefined);
}

// Server-only eager start: kick PGLite bootstrap as soon as this module loads in
// Node. Client bundles never hit this path (`getSql` throws in the browser).
const globalBoot = globalThis as typeof globalThis & {
  __pgBootstrapPromise__?: Promise<void>;
};
if (typeof window === "undefined" && dbSource === "pglite" && process.env.VERCEL !== "1" && process.env.RENDER !== "true") {
  globalBoot.__pgBootstrapPromise__ ??= ensureDbReady().catch((err) => {
    globalBoot.__pgBootstrapPromise__ = undefined;
    console.error("[db] PGLite bootstrap failed:", err);
    throw err;
  });
}
