// Applies the Supabase migration to PGlite (in-memory Postgres) with a stub of
// Supabase's auth schema, then checks Row Level Security behaviour.
// Run: node tests/db/rls.test.mjs   (requires `npm i -D @electric-sql/pglite`)
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import assert from "node:assert/strict";

const db = new PGlite();
await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claim.role', true), '') $$;
  grant usage on schema public, auth to anon, authenticated, service_role;
  grant execute on all functions in schema auth to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`);
const dir = new URL("../../supabase/migrations/", import.meta.url);
for (const f of readdirSync(dir).sort()) await db.exec(readFileSync(new URL(f, dir), "utf8"));

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
await db.exec(`insert into auth.users values ('${A}','a@example.com'), ('${B}','b@example.com');`);

const as = async (uid, sql) => {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid ?? ""}', false); select set_config('request.jwt.claim.role', '${uid ? "authenticated" : "anon"}', false); set role ${uid ? "authenticated" : "anon"};`);
  try { return await db.query(sql); } finally { await db.exec("reset role;"); }
};

// Signup trigger created profile + settings rows.
assert.equal((await db.query(`select count(*)::int n from public.user_profiles`)).rows[0].n, 2);

// Owner can write and read own rows; other users cannot see them.
await as(A, `insert into public.speaking_sessions (id, user_id, module, input) values (gen_random_uuid(), '${A}', 'speak', 'text')`);
assert.equal((await as(A, `select count(*)::int n from public.speaking_sessions`)).rows[0].n, 1);
assert.equal((await as(B, `select count(*)::int n from public.speaking_sessions`)).rows[0].n, 0);
assert.equal((await as(null, `select count(*)::int n from public.speaking_sessions`)).rows[0].n, 0);

// Cannot insert rows for someone else.
await assert.rejects(as(B, `insert into public.speaking_sessions (id, user_id, module, input) values (gen_random_uuid(), '${A}', 'speak', 'text')`));

// Cannot promote yourself to admin.
await assert.rejects(as(A, `update public.user_profiles set role = 'admin' where id = '${A}'`));
// Profile of another user is invisible.
assert.equal((await as(B, `select count(*)::int n from public.user_profiles where id = '${A}'`)).rows[0].n, 0);

// Content: public can read published rows, cannot write; admin can write.
await assert.rejects(as(A, `insert into public.vocabulary (word, category, meaning) values ('x','daily','y')`));
await db.exec(`update public.user_profiles set role = 'admin' where id = '${A}'`); // as superuser (service role)
await as(A, `insert into public.vocabulary (word, category, meaning) values ('hello','daily','greeting')`);
await as(A, `insert into public.vocabulary (word, category, meaning, published) values ('draft','daily','unpublished', false)`);
assert.equal((await as(null, `select count(*)::int n from public.vocabulary`)).rows[0].n, 1);
assert.equal((await as(A, `select count(*)::int n from public.vocabulary`)).rows[0].n, 2);

// Operational tables are closed to normal users.
assert.equal((await as(B, `select count(*)::int n from public.app_settings`)).rows[0].n, 0);
await assert.rejects(as(B, `update public.app_settings set value = '{}' where key = 'global'`).then((r) => { if (r.affectedRows === 0) throw new Error("no rows"); }));

// Account deletion cascades.
await db.exec(`delete from auth.users where id = '${A}'`);
assert.equal((await db.query(`select count(*)::int n from public.speaking_sessions`)).rows[0].n, 0);
assert.equal((await db.query(`select count(*)::int n from public.user_profiles`)).rows[0].n, 1);

console.log("RLS tests passed ✔");
