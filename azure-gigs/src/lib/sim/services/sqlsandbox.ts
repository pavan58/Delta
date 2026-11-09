/**
 * Runs SQL against an isolated in-memory SQLite database inside a worker thread with a hard timeout.
 * Each simulated Azure SQL database is persisted as a replay log of its successful write statements.
 */
import { Worker } from "node:worker_threads";
import { badRequest } from "@/lib/errors";

const WORKER_SRC = `
const { parentPort, workerData } = require('node:worker_threads');
process.removeAllListeners('warning');
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(':memory:');
try {
  for (const s of workerData.replay) db.exec(s);
  const sql = workerData.sql;
  const isRead = /^\\s*(select|with|explain|values)\\b/i.test(sql);
  if (isRead) {
    const stmt = db.prepare(sql);
    const rows = stmt.all().slice(0, workerData.maxRows);
    const columns = rows.length ? Object.keys(rows[0]) : (stmt.columns ? stmt.columns().map(c => c.name) : []);
    parentPort.postMessage({ ok: true, rows, columns, isRead: true });
  } else {
    const before = db.prepare('select total_changes() as c').get().c;
    db.exec(sql);
    const after = db.prepare('select total_changes() as c').get().c;
    parentPort.postMessage({ ok: true, rows: [], columns: [], isRead: false, changes: after - before });
  }
} catch (e) {
  parentPort.postMessage({ ok: false, error: String(e && e.message || e) });
}
`;

const FORBIDDEN = /\b(attach|detach|pragma|vacuum|load_extension|readfile|writefile|fts3_tokenizer)\b/i;

export type SqlResult = { ok: true; rows: Record<string, unknown>[]; columns: string[]; isRead: boolean; changes?: number } | { ok: false; error: string };

export function validateSql(sql: string) {
  if (!sql.trim()) throw badRequest("EmptyQuery", "Query is empty.");
  if (sql.length > 20000) throw badRequest("QueryTooLong", "Query exceeds 20,000 characters.");
  if (FORBIDDEN.test(sql)) throw badRequest("StatementNotAllowed", "ATTACH, PRAGMA, VACUUM and extension loading are not allowed in the sandbox.");
}

export function runSql(replay: string[], sql: string, timeoutMs = 2000, maxRows = 500): Promise<SqlResult> {
  validateSql(sql);
  return new Promise((resolve) => {
    const w = new Worker(WORKER_SRC, { eval: true, workerData: { replay, sql, maxRows }, resourceLimits: { maxOldGenerationSizeMb: 64 } });
    const timer = setTimeout(() => {
      w.terminate();
      resolve({ ok: false, error: `Execution timeout expired (${timeoutMs} ms). The query was cancelled.` });
    }, timeoutMs);
    w.once("message", (m: SqlResult) => {
      clearTimeout(timer);
      w.terminate();
      resolve(m);
    });
    w.once("error", (e) => {
      clearTimeout(timer);
      resolve({ ok: false, error: e.message });
    });
  });
}

export const SAMPLE_SCHEMA = [
  `CREATE TABLE Customers (CustomerId INTEGER PRIMARY KEY, Name TEXT NOT NULL, City TEXT, Tier TEXT, CreatedAt TEXT)`,
  `INSERT INTO Customers VALUES (1,'Fabrikam Ltd','Seattle','Gold','2025-01-12'),(2,'Northwind Traders','London','Silver','2025-02-03'),(3,'Adventure Works','Pune','Gold','2025-03-21'),(4,'Tailspin Toys','Bengaluru','Bronze','2025-04-02'),(5,'Wide World Importers','Sydney','Silver','2025-05-17'),(6,'Litware Inc','Mumbai','Bronze','2025-06-30')`,
  `CREATE TABLE Orders (OrderId INTEGER PRIMARY KEY, CustomerId INTEGER REFERENCES Customers(CustomerId), Amount REAL, Status TEXT, OrderDate TEXT)`,
  `INSERT INTO Orders VALUES (101,1,1200.50,'Shipped','2025-07-01'),(102,1,340.00,'Pending','2025-07-03'),(103,2,89.99,'Shipped','2025-07-04'),(104,3,2300.00,'Cancelled','2025-07-05'),(105,3,150.25,'Shipped','2025-07-09'),(106,4,75.00,'Pending','2025-07-11'),(107,5,980.40,'Shipped','2025-07-15'),(108,6,45.10,'Shipped','2025-07-18'),(109,2,610.00,'Pending','2025-07-20')`,
];
