'use strict';

const path = require('path');
const fs = require('fs');
const BaseAdapter = require('./base');

class SqliteAdapter extends BaseAdapter {
  constructor(dbPath = '.schema-tracker/tracker.db') {
    super();
    this._dbPath = dbPath;
    this._db = null;
  }

  _getDb() {
    if (!this._db) {
      const Database = require('better-sqlite3');
      this._db = new Database(this._dbPath);
    }
    return this._db;
  }

  async migrate() {
    const dir = path.dirname(this._dbPath);
    fs.mkdirSync(dir, { recursive: true });

    const sqlPath = path.join(__dirname, '../migrations/001_init.sql');
    let sql = fs.readFileSync(sqlPath, 'utf8');
    sql = sql.replace(/\bSERIAL\b/g, 'INTEGER PRIMARY KEY AUTOINCREMENT');

    const db = this._getDb();
    const statements = sql.split(';').map(s => s.trim()).filter(Boolean);
    for (const stmt of statements) {
      db.prepare(stmt).run();
    }
  }

  async upsertEndpoint(endpointPath) {
    const db = this._getDb();
    db.prepare(
      'INSERT OR IGNORE INTO schema_tracker_endpoints (path) VALUES (?)'
    ).run(endpointPath);
    db.prepare(
      'UPDATE schema_tracker_endpoints SET last_seen = CURRENT_TIMESTAMP WHERE path = ?'
    ).run(endpointPath);
  }

  async appendSnapshot(endpointPath, schemaString) {
    const db = this._getDb();
    const endpoint = db.prepare(
      'SELECT id FROM schema_tracker_endpoints WHERE path = ?'
    ).get(endpointPath);
    const result = db.prepare(
      'INSERT INTO schema_tracker_snapshots (endpoint_id, schema) VALUES (?, ?)'
    ).run(endpoint.id, schemaString);
    return result.lastInsertRowid;
  }

  async getLatestSnapshot(endpointPath) {
    const db = this._getDb();
    return db.prepare(`
      SELECT s.id, s.schema, s.captured_at
      FROM schema_tracker_snapshots s
      JOIN schema_tracker_endpoints e ON e.id = s.endpoint_id
      WHERE e.path = ?
      ORDER BY s.id DESC
      LIMIT 1
    `).get(endpointPath) || null;
  }

  async appendDiff(endpointPath, fromSnapshotId, toSnapshotId, diffString) {
    const db = this._getDb();
    const endpoint = db.prepare(
      'SELECT id FROM schema_tracker_endpoints WHERE path = ?'
    ).get(endpointPath);
    db.prepare(
      'INSERT INTO schema_tracker_diffs (endpoint_id, from_snapshot_id, to_snapshot_id, diff) VALUES (?, ?, ?, ?)'
    ).run(endpoint.id, fromSnapshotId, toSnapshotId, diffString);
    db.prepare(
      'UPDATE schema_tracker_endpoints SET change_count = change_count + 1 WHERE path = ?'
    ).run(endpointPath);
  }

  async getAllEndpoints() {
    return this._getDb().prepare('SELECT * FROM schema_tracker_endpoints').all();
  }

  async getHistory(endpointPath) {
    const db = this._getDb();
    return db.prepare(`
      SELECT s.schema, s.captured_at
      FROM schema_tracker_snapshots s
      JOIN schema_tracker_endpoints e ON e.id = s.endpoint_id
      WHERE e.path = ?
      ORDER BY s.id ASC
    `).all(endpointPath);
  }

  async getLatestDiff(endpointPath) {
    const db = this._getDb();
    return db.prepare(`
      SELECT d.diff, d.detected_at
      FROM schema_tracker_diffs d
      JOIN schema_tracker_endpoints e ON e.id = d.endpoint_id
      WHERE e.path = ?
      ORDER BY d.id DESC
      LIMIT 1
    `).get(endpointPath) || null;
  }
}

module.exports = SqliteAdapter;
