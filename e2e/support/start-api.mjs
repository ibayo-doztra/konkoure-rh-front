// Starts the real API on a disposable database, recreated for every run.
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

const DATABASE = "konkoure_e2e";
const apiDir = process.env.E2E_API_DIR;
const outbox = process.env.E2E_OUTBOX;
if (!apiDir || !outbox) throw new Error("E2E_API_DIR and E2E_OUTBOX are required");
if (process.env.DB_DATABASE !== DATABASE) throw new Error(`DB_DATABASE must be ${DATABASE}`);

async function recreateDatabase() {
  const require = createRequire(path.join(apiDir, "package.json"));
  const { Client } = require("pg");
  // The API's own parser, so that escapes and interpolation match its behaviour.
  const { EnvParser } = await import(pathToFileURL(require.resolve("@adonisjs/core/env")).href);
  const env = await new EnvParser(readFileSync(path.join(apiDir, ".env"), "utf8")).parse();
  const client = new Client({
    host: env.DB_HOST,
    port: Number(env.DB_PORT),
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: "postgres",
  });
  await client.connect();
  try {
    await client.query(`DROP DATABASE IF EXISTS ${DATABASE} WITH (FORCE)`);
    await client.query(`CREATE DATABASE ${DATABASE}`);
  } finally {
    await client.end();
  }
}

await recreateDatabase();
rmSync(path.dirname(outbox), { recursive: true, force: true });
mkdirSync(path.dirname(outbox), { recursive: true });

const migration = spawnSync(process.execPath, ["ace", "migration:run", "--force"], {
  cwd: apiDir,
  env: process.env,
  stdio: "inherit",
});
if (migration.status !== 0) process.exit(migration.status ?? 1);

const fakeMail = pathToFileURL(path.join(import.meta.dirname, "fake-mail.mjs")).href;
const server = spawn(
  process.execPath,
  ["--import=@poppinss/ts-exec", `--import=${fakeMail}`, "bin/server.ts"],
  { cwd: apiDir, env: process.env, stdio: "inherit" },
);
server.on("exit", (code) => process.exit(code ?? 0));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.kill(signal));
