import { readFileSync } from 'node:fs';

const BASELINE_SCHEMA = readFileSync(new URL('../docs/persistence-schema.sql', import.meta.url), 'utf8');

export const SQLITE_MIGRATIONS = Object.freeze([
  Object.freeze({
    version: 1,
    name: 'baseline-mail-state',
    sql: BASELINE_SCHEMA,
  }),
]);

function ensureMigrationTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);
}

/**
 * Apply repository-owned SQLite migrations exactly once and in ascending order.
 *
 * Migrations execute inside BEGIN IMMEDIATE transactions so a failed migration
 * cannot be recorded as applied. The current baseline migration intentionally
 * uses idempotent CREATE statements so databases created before this migration
 * framework can be adopted without destructive schema recreation.
 */
export function applySqliteMigrations(db, { now = () => new Date().toISOString() } = {}) {
  if (!db || typeof db.exec !== 'function' || typeof db.prepare !== 'function') {
    throw new TypeError('db must be a SQLite database');
  }

  ensureMigrationTable(db);
  const applied = new Set(
    db.prepare('SELECT version FROM schema_migrations ORDER BY version').all().map((row) => Number(row.version)),
  );

  const newlyApplied = [];
  for (const migration of SQLITE_MIGRATIONS) {
    if (applied.has(migration.version)) continue;

    db.exec('BEGIN IMMEDIATE;');
    try {
      db.exec(migration.sql);
      db.prepare('INSERT OR IGNORE INTO schema_migrations (version,name,applied_at) VALUES (?,?,?)')
        .run(migration.version, migration.name, now());
      db.exec('COMMIT;');
      newlyApplied.push(migration.version);
    } catch (error) {
      db.exec('ROLLBACK;');
      throw error;
    }
  }

  return Object.freeze({
    currentVersion: currentSqliteSchemaVersion(db),
    newlyApplied: Object.freeze(newlyApplied),
  });
}

export function currentSqliteSchemaVersion(db) {
  if (!db || typeof db.prepare !== 'function') throw new TypeError('db must be a SQLite database');
  try {
    const row = db.prepare('SELECT COALESCE(MAX(version),0) AS version FROM schema_migrations').get();
    return Number(row.version);
  } catch (error) {
    if (/no such table: schema_migrations/i.test(String(error?.message))) return 0;
    throw error;
  }
}
