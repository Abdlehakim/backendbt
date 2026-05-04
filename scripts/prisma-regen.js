#!/usr/bin/env node

const { spawnSync } = require("node:child_process");
const path = require("node:path");

const backendRoot = path.resolve(__dirname, "..");
const composeFile = path.join(backendRoot, "docker", "docker-compose.yml");
const mode = String(process.env.MODE || process.argv[2] || "push").trim().toLowerCase();

const modeCommand = {
  push: "npx prisma db push",
  deploy: "npx prisma migrate deploy",
  reset: "npx prisma migrate reset --force",
}[mode];

if (!modeCommand) {
  console.error(`ERROR: Unknown MODE=${mode} (use push|deploy|reset).`);
  process.exit(1);
}

function run(command, args, options = {}) {
  const { capture = false } = options;
  const result = spawnSync(command, args, capture ? { encoding: "utf8" } : { stdio: "inherit" });

  if (capture) {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
  }

  if (result.error) {
    console.error(`ERROR: Failed to run '${command}': ${result.error.message}`);
    process.exit(1);
  }

  return result;
}

function runOrExit(command, args, options = {}) {
  const result = run(command, args, options);
  if (typeof result.status === "number" && result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function dc(args, options = {}) {
  return run("docker", ["compose", "-f", composeFile, ...args], options);
}

function dcOrExit(args, options = {}) {
  const result = dc(args, options);
  if (typeof result.status === "number" && result.status !== 0) {
    process.exit(result.status || 1);
  }
}

const dockerCheck = spawnSync("docker", ["--version"], { stdio: "ignore" });
if (dockerCheck.error || dockerCheck.status !== 0) {
  console.error("ERROR: docker is not installed or not in PATH.");
  process.exit(1);
}

const prismaValidateAndGenerateScript = [
  "set -e",
  "cd /app",
  "rm -rf node_modules/.prisma 2>/dev/null || true",
  "npx prisma validate",
  "npx prisma generate",
].join("\n");

const seedScript = [
  "set -e",
  "cd /app",
  "if [ -f prisma/seeds/seed.js ]; then",
  "  node prisma/seeds/seed.js",
  "else",
  "  echo \"ERROR: prisma/seeds/seed.js not found\"",
  "  exit 1",
  "fi",
].join("\n");

console.log("Starting containers (db, backend)...");
dcOrExit(["up", "-d", "db", "backend"]);

console.log("Prisma validate + generate (inside container)...");
dcOrExit(["exec", "-T", "backend", "sh", "-lc", prismaValidateAndGenerateScript]);

console.log(`Sync database schema (mode=${mode})...`);
const migrateResult = dc(["exec", "-T", "backend", "sh", "-lc", `set -e\ncd /app\n${modeCommand}`], {
  capture: mode === "deploy",
});

if (typeof migrateResult.status === "number" && migrateResult.status !== 0) {
  if (mode === "deploy") {
    const output = `${migrateResult.stdout || ""}\n${migrateResult.stderr || ""}`;
    if (output.includes("P3005")) {
      console.error("");
      console.error("Prisma migrate deploy failed with P3005.");
      console.error(
        "Reason: this database already has tables but no migration history recorded for Prisma Migrate."
      );
      console.error("");
      console.error("Use one of these options:");
      console.error("1) Local/dev quick path (destructive):");
      console.error("   node scripts/prisma-regen.js reset");
      console.error("2) Local/dev non-destructive path (keeps current schema/data shape):");
      console.error("   node scripts/prisma-regen.js push");
      console.error("");
      console.error("Note: use mode=deploy only for databases already managed by Prisma migrations.");
    }
  }
  process.exit(migrateResult.status || 1);
}

console.log("Running seed (inside container)...");
dcOrExit(["exec", "-T", "backend", "sh", "-lc", seedScript]);

console.log("Restarting backend...");
dcOrExit(["restart", "backend"]);

console.log("Done: Prisma generated, DB synced, and seed executed.");
