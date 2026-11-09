// Loads env for tests. Integration tests use TEST_DATABASE_URL (a separate database).
import { readFileSync, existsSync } from "node:fs";

if (existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const m = /^([A-Z_]+)="?(.*?)"?$/.exec(line.trim());
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgresql://azuregigs:azuregigs@localhost:5432/azuregigs_test?schema=public";
process.env.ENCRYPTION_KEY ??= Buffer.alloc(32, 7).toString("base64");
