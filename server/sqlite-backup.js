import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { currentSqliteSchemaVersion } from './sqlite-migrations.js';

function requirePath(name, value) {
  if (typeof value !== 'string' || value.length === 0) throw new TypeError(`${name} is required`);
  return resolve(value);
}

function sqliteLiteral(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

/** Create a transactionally consistent SQLite snapshot using VACUUM INTO. */
export function createSqliteBackup({ sourcePath, backupPath }) {
  const source = requirePath('sourcePath', sourcePath);
  const destination = requirePath('backupPath', backupPath);
  if (source === destination) throw new TypeError('backupPath must differ from sourcePath');
  if (!existsSync(source)) throw new Error('Source database does not exist.');
  if (existsSync(destination)) throw new Error('Backup destination already exists.');

  mkdirSync(dirname(destination), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(source, { readOnly: false });
  try {
    db.exec('PRAGMA wal_checkpoint(PASSIVE);');
    db.exec(`VACUUM INTO ${sqliteLiteral(destination)};`);
  } finally {
    db.close();
  }

  return verifySqliteBackup({ path: destination });
}

/** Verify integrity and report the repository schema version of a SQLite file. */
export function verifySqliteBackup({ path }) {
  const databasePath = requirePath('path', path);
  if (!existsSync(databasePath)) throw new Error('SQLite database does not exist.');

  const db = new DatabaseSync(databasePath, { readOnly: true });
  try {
    const rows = db.prepare('PRAGMA integrity_check').all();
    const integrity = rows.map((row) => Object.values(row)[0]);
    if (integrity.length !== 1 || integrity[0] !== 'ok') {
      throw new Error(`SQLite integrity check failed: ${integrity.join('; ')}`);
    }
    return Object.freeze({
      path: databasePath,
      integrity: 'ok',
      schemaVersion: currentSqliteSchemaVersion(db),
    });
  } finally {
    db.close();
  }
}
