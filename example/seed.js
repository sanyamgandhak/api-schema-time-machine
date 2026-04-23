'use strict';

/**
 * Seed the schema-tracker database with realistic multi-version history.
 *
 * /users/1  → 3 snapshots, 2 diffs  (shows added, removed, changed, renamed)
 * /posts/1  → 2 snapshots, 1 diff   (shows added fields)
 *
 * Run:  node example/seed.js
 * Then: node example/server.js
 * Open: http://localhost:3000/schema-tracker
 */

const path = require('path');
const fs = require('fs');
const { fingerprint, schemaToString } = require('../src/fingerprint');
const { diff } = require('../src/diff-engine');

const DB_PATH = '.schema-tracker/tracker.db';

// ─── Sample API responses, oldest → newest ───────────────────────────────────

const USERS_V1 = {
  id: 1,
  name: 'Leanne Graham',
  email: 'sincere@april.biz',
  phone: '1-770-736-0988 x56442',
  website: 'hildegard.org',
  company: 'Romaguera-Crona',
};

// v2: phone/website removed, role + verified + age added, company type changed to object
const USERS_V2 = {
  id: 1,
  name: 'Leanne Graham',
  email: 'sincere@april.biz',
  role: 'viewer',
  verified: false,
  age: 29,
  company: { name: 'Romaguera-Crona', catchPhrase: 'Multi-layered client-server' },
};

// v3: name → username rename, nested address added, age type changed to string
const USERS_V3 = {
  id: 1,
  username: 'Bret',
  email: 'sincere@april.biz',
  role: 'admin',
  verified: true,
  age: '30',
  company: { name: 'Romaguera-Crona', catchPhrase: 'Multi-layered client-server' },
  address: { street: 'Kulas Light', city: 'Gwenborough', zip: '92998-3874' },
};

const POSTS_V1 = {
  id: 1,
  userId: 1,
  title: 'sunt aut facere repellat',
  body: 'quia et suscipit\nsuscipit recusandae...',
};

// v2: tags + published + viewCount added
const POSTS_V2 = {
  id: 1,
  userId: 1,
  title: 'sunt aut facere repellat',
  body: 'quia et suscipit\nsuscipit recusandae...',
  tags: ['news', 'tech'],
  published: true,
  viewCount: 1024,
};

// ─── Timestamps spread over recent days ──────────────────────────────────────

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

// ─── Setup ───────────────────────────────────────────────────────────────────

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

// Wipe any existing DB so the seed is always a clean slate
if (fs.existsSync(DB_PATH)) {
  fs.unlinkSync(DB_PATH);
  console.log('Removed existing database.');
}

const Database = require('better-sqlite3');
const db = new Database(DB_PATH);

const sqlPath = path.join(__dirname, '../src/migrations/001_init.sql');
let sql = fs.readFileSync(sqlPath, 'utf8');
sql = sql.replace(/\bSERIAL\b/g, 'INTEGER PRIMARY KEY AUTOINCREMENT');
for (const stmt of sql.split(';').map(s => s.trim()).filter(Boolean)) {
  db.prepare(stmt).run();
}
console.log('Migrated schema.');

// ─── Helper ──────────────────────────────────────────────────────────────────

function insertEndpoint(epPath, firstSeen, lastSeen, changeCount) {
  db.prepare(`
    INSERT INTO schema_tracker_endpoints (path, first_seen, last_seen, change_count)
    VALUES (?, ?, ?, ?)
  `).run(epPath, firstSeen, lastSeen, changeCount);
  return db.prepare('SELECT id FROM schema_tracker_endpoints WHERE path = ?').get(epPath).id;
}

function insertSnapshot(endpointId, schemaStr, capturedAt) {
  const r = db.prepare(`
    INSERT INTO schema_tracker_snapshots (endpoint_id, schema, captured_at)
    VALUES (?, ?, ?)
  `).run(endpointId, schemaStr, capturedAt);
  return r.lastInsertRowid;
}

function insertDiff(endpointId, fromId, toId, diffObj, detectedAt) {
  console.log('Inserting diff for endpointId', endpointId, 'from snapshot', fromId, 'to snapshot', toId);
  db.prepare(`
    INSERT INTO schema_tracker_diffs (endpoint_id, from_snapshot_id, to_snapshot_id, diff, detected_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(endpointId, fromId, toId, JSON.stringify(diffObj), detectedAt);
}

// ─── Seed /users/1 ───────────────────────────────────────────────────────────

{
  const ep = '/users/1';
  const s1 = fingerprint(USERS_V1);
  const s2 = fingerprint(USERS_V2);
  const s3 = fingerprint(USERS_V3);

  const d1 = diff(s1, s2);
  const d2 = diff(s2, s3);

  const t1 = daysAgo(9);
  const t2 = daysAgo(4);
  const t3 = daysAgo(0);

  const epId = insertEndpoint(ep, t1, t3, 2);
  const snap1 = insertSnapshot(epId, schemaToString(s1), t1);
  const snap2 = insertSnapshot(epId, schemaToString(s2), t2);
  const snap3 = insertSnapshot(epId, schemaToString(s3), t3);

  insertDiff(epId, snap1, snap2, d1, t2);
  insertDiff(epId, snap2, snap3, d2, t3);

  console.log(`Seeded ${ep}: 3 snapshots, 2 diffs`);
  console.log('  v1 → v2:', JSON.stringify({ added: Object.keys(d1.added), removed: Object.keys(d1.removed), changed: Object.keys(d1.changed), renamed: Object.keys(d1.renamed) }));
  console.log('  v2 → v3:', JSON.stringify({ added: Object.keys(d2.added), removed: Object.keys(d2.removed), changed: Object.keys(d2.changed), renamed: Object.keys(d2.renamed) }));
}

// ─── Seed /posts/1 ───────────────────────────────────────────────────────────

{
  const ep = '/posts/1';
  const s1 = fingerprint(POSTS_V1);
  const s2 = fingerprint(POSTS_V2);

  const d1 = diff(s1, s2);

  const t1 = daysAgo(3);
  const t2 = daysAgo(1);

  const epId = insertEndpoint(ep, t1, t2, 1);
  const snap1 = insertSnapshot(epId, schemaToString(s1), t1);
  const snap2 = insertSnapshot(epId, schemaToString(s2), t2);

  insertDiff(epId, snap1, snap2, d1, t2);

  console.log(`Seeded ${ep}: 2 snapshots, 1 diff`);
  console.log('  v1 → v2:', JSON.stringify({ added: Object.keys(d1.added), removed: Object.keys(d1.removed), changed: Object.keys(d1.changed), renamed: Object.keys(d1.renamed) }));
}

db.close();
console.log('\nDone. Now run:  node example/server.js');
console.log('Dashboard:      http://localhost:3000/schema-tracker');
