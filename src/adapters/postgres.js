'use strict';

const path = require('path');
const fs = require('fs');
const BaseAdapter = require('./base');

class PostgresAdapter extends BaseAdapter {
  constructor(connectionString) {
    super();
    this._connectionString = connectionString;
    this._pool = null;
  }

  _getPool() {
    if (!this._pool) {
      const { Pool } = require('pg');
      this._pool = new Pool({ connectionString: this._connectionString });
    }
    return this._pool;
  }

  async migrate() {
    const sqlPath = path.join(__dirname, '../migrations/001_init.sql');
    let sql = fs.readFileSync(sqlPath, 'utf8');
    // Postgres uses SERIAL; replace SQLite AUTOINCREMENT syntax
    sql = sql.replace(/INTEGER PRIMARY KEY AUTOINCREMENT/g, 'SERIAL PRIMARY KEY');

    const pool = this._getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const statements = sql.split(';').map(s => s.trim()).filter(Boolean);
      for (const stmt of statements) {
        await client.query(stmt);
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async upsertEndpoint(endpointPath) {
    await this._getPool().query(
      `INSERT INTO schema_tracker_endpoints (path)
       VALUES ($1)
       ON CONFLICT (path) DO UPDATE SET last_seen = NOW()`,
      [endpointPath]
    );
  }

  async appendSnapshot(endpointPath, schemaString) {
    const { rows } = await this._getPool().query(
      'SELECT id FROM schema_tracker_endpoints WHERE path = $1',
      [endpointPath]
    );
    const endpointId = rows[0].id;
    const result = await this._getPool().query(
      'INSERT INTO schema_tracker_snapshots (endpoint_id, schema) VALUES ($1, $2) RETURNING id',
      [endpointId, schemaString]
    );
    return result.rows[0].id;
  }

  async getLatestSnapshot(endpointPath) {
    const { rows } = await this._getPool().query(
      `SELECT s.id, s.schema, s.captured_at
       FROM schema_tracker_snapshots s
       JOIN schema_tracker_endpoints e ON e.id = s.endpoint_id
       WHERE e.path = $1
       ORDER BY s.id DESC
       LIMIT 1`,
      [endpointPath]
    );
    return rows[0] || null;
  }

  async appendDiff(endpointPath, fromSnapshotId, toSnapshotId, diffString) {
    const { rows } = await this._getPool().query(
      'SELECT id FROM schema_tracker_endpoints WHERE path = $1',
      [endpointPath]
    );
    const endpointId = rows[0].id;
    await this._getPool().query(
      'INSERT INTO schema_tracker_diffs (endpoint_id, from_snapshot_id, to_snapshot_id, diff) VALUES ($1, $2, $3, $4)',
      [endpointId, fromSnapshotId, toSnapshotId, diffString]
    );
    await this._getPool().query(
      'UPDATE schema_tracker_endpoints SET change_count = change_count + 1 WHERE path = $1',
      [endpointPath]
    );
  }

  async getAllEndpoints() {
    const { rows } = await this._getPool().query('SELECT * FROM schema_tracker_endpoints');
    return rows;
  }

  async getHistory(endpointPath) {
    const { rows } = await this._getPool().query(
      `SELECT s.schema, s.captured_at
       FROM schema_tracker_snapshots s
       JOIN schema_tracker_endpoints e ON e.id = s.endpoint_id
       WHERE e.path = $1
       ORDER BY s.id ASC`,
      [endpointPath]
    );
    return rows;
  }

  async getLatestDiff(endpointPath) {
    const { rows } = await this._getPool().query(
      `SELECT d.diff, d.detected_at
       FROM schema_tracker_diffs d
       JOIN schema_tracker_endpoints e ON e.id = d.endpoint_id
       WHERE e.path = $1
       ORDER BY d.id DESC
       LIMIT 1`,
      [endpointPath]
    );
    return rows[0] || null;
  }
}

module.exports = PostgresAdapter;
