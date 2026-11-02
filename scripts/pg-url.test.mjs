import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { hostedPoolOptions, resolveDatabaseUrl, sqlStatements } from "./pg-url.mjs";
import { projectRoot } from "./with-app-env.mjs";

test("resolveDatabaseUrl prefers DATABASE_URL and accepts POSTGRES_URL", () => {
  assert.equal(resolveDatabaseUrl({}), undefined);
  assert.equal(resolveDatabaseUrl({ DATABASE_URL: "  " }), undefined);
  assert.equal(
    resolveDatabaseUrl({ DATABASE_URL: " postgres://db ", POSTGRES_URL: "postgres://other" }),
    "postgres://db",
  );
  assert.equal(resolveDatabaseUrl({ POSTGRES_URL: "postgres://vercel" }), "postgres://vercel");
});

test("hosted Postgres uses TLS and a single connection", () => {
  const neon = hostedPoolOptions(
    "postgres://user:pass@ep-x.pooler.neon.tech/neondb?sslmode=require",
  );
  assert.equal(neon.max, 1);
  assert.deepEqual(neon.ssl, { rejectUnauthorized: false });

  const local = hostedPoolOptions("postgres://user:pass@localhost:5432/app");
  assert.equal(local.ssl, undefined);
});

test("migration files split into individual statements", () => {
  const dir = join(projectRoot(), "migrations");
  const files = readdirSync(dir).filter((name) => name.endsWith(".sql")).sort();
  assert.deepEqual(files, ["0001_auth.sql", "0002_closet.sql"]);
  for (const name of files) {
    const statements = sqlStatements(readFileSync(join(dir, name), "utf8"));
    assert.ok(statements.length >= 1, name);
    assert.ok(
      statements.some((statement) => /create table/i.test(statement)),
      name,
    );
    for (const statement of statements) {
      assert.equal(statement.includes(";"), false, statement.slice(0, 40));
    }
  }
});
