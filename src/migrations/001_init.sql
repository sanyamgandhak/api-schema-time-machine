CREATE TABLE IF NOT EXISTS schema_tracker_endpoints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT NOT NULL UNIQUE,
  first_seen DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  change_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS schema_tracker_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint_id INTEGER NOT NULL REFERENCES schema_tracker_endpoints(id),
  schema TEXT NOT NULL,
  captured_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS schema_tracker_diffs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint_id INTEGER NOT NULL REFERENCES schema_tracker_endpoints(id),
  from_snapshot_id INTEGER REFERENCES schema_tracker_snapshots(id),
  to_snapshot_id INTEGER NOT NULL REFERENCES schema_tracker_snapshots(id),
  diff TEXT NOT NULL,
  detected_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
