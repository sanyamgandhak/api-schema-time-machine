'use strict';

const { fingerprint, schemaToString } = require('./fingerprint');
const { diff } = require('./diff-engine');

function resolveAdapter(db) {
  if (!db || db.startsWith('sqlite://')) {
    const SqliteAdapter = require('./adapters/sqlite');
    const filePath = db && db !== 'sqlite://'
      ? db.replace(/^sqlite:\/\//, '')
      : '.schema-tracker/tracker.db';
    return new SqliteAdapter(filePath);
  }

  if (db.startsWith('postgres://') || db.startsWith('postgresql://')) {
    try {
      require('pg');
    } catch {
      throw new Error('[schema-tracker] pg not installed. Run: npm install pg');
    }
    const PostgresAdapter = require('./adapters/postgres');
    return new PostgresAdapter(db);
  }

  // Bare file path → sqlite
  const SqliteAdapter = require('./adapters/sqlite');
  return new SqliteAdapter(db);
}

function schemaTracker(options = {}) {
  const {
    target,
    db,
    dashboard = true,
    dashboardPath = '/schema-tracker',
    ignoreRoutes = ['/health', '/favicon.ico'],
    onSchemaChange,
  } = options;

  if (!target) throw new Error('[schema-tracker] options.target is required');

  const adapter = resolveAdapter(db);
  let migrated = false;

  async function ensureMigrated() {
    if (!migrated) {
      await adapter.migrate();
      migrated = true;
    }
  }

  let dashboardRouterInstance = null;
  if (dashboard) {
    const buildDashboardRouter = require('./dashboard/router');
    dashboardRouterInstance = buildDashboardRouter(adapter, dashboardPath);
  }

  const middleware = async function (req, res, next) {
    // Dispatch dashboard requests to the dashboard handler
    if (dashboard && req.path.startsWith(dashboardPath)) {
      return dashboardRouterInstance(req, res);
    }

    if (ignoreRoutes.includes(req.path)) {
      return next();
    }

    let upstreamRes;
    try {
      const url = target.replace(/\/$/, '') + req.path + (req.url.includes('?') ? '?' + req.url.split('?')[1] : '');
      const fetchOptions = {
        method: req.method,
        headers: Object.fromEntries(
          Object.entries(req.headers).filter(([k]) => !['host', 'connection'].includes(k))
        ),
      };
      if (!['GET', 'HEAD'].includes(req.method) && req.body) {
        fetchOptions.body = JSON.stringify(req.body);
        fetchOptions.headers['content-type'] = 'application/json';
      }

      upstreamRes = await fetch(url, fetchOptions);
    } catch (err) {
      return next(err);
    }

    const contentType = upstreamRes.headers.get('content-type') || '';
    if (!upstreamRes.ok || !contentType.includes('application/json')) {
      const body = await upstreamRes.text();
      upstreamRes.headers.forEach((value, key) => res.setHeader(key, value));
      return res.status(upstreamRes.status).send(body);
    }

    let body;
    try {
      body = await upstreamRes.json();
    } catch {
      return res.status(upstreamRes.status).end();
    }

    upstreamRes.headers.forEach((value, key) => {
      if (!['content-encoding', 'transfer-encoding', 'content-length'].includes(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });
    res.status(upstreamRes.status).json(body);

    setImmediate(async () => {
      try {
        await ensureMigrated();
        await adapter.upsertEndpoint(req.path);

        const schema = fingerprint(body);
        const schemaStr = schemaToString(schema);
        const latest = await adapter.getLatestSnapshot(req.path);

        if (!latest || latest.schema !== schemaStr) {
          const newSnapshotId = await adapter.appendSnapshot(req.path, schemaStr);

          if (latest) {
            const oldSchema = JSON.parse(latest.schema);
            const diffResult = diff(oldSchema, schema);
            if (diffResult) {
              await adapter.appendDiff(req.path, latest.id, newSnapshotId, JSON.stringify(diffResult));
              if (onSchemaChange) {
                await onSchemaChange(diffResult, req.path);
              }
            }
          }

          console.log(`[schema-tracker] ${req.method} ${req.path} → ${upstreamRes.status} (schema changed)`);
        } else {
          console.log(`[schema-tracker] ${req.method} ${req.path} → ${upstreamRes.status} (schema unchanged)`);
        }
      } catch (err) {
        console.error('[schema-tracker] error tracking schema:', err.message);
      }
    });
  };

  return middleware;
}

module.exports = { schemaTracker };
