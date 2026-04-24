# api-schema-time-machine

[![npm version](https://img.shields.io/npm/v/@phonepe/api-schema-time-machine)](https://artifactory.phonepe.com/repository/npm-releases/@phonepe/api-schema-time-machine)
[![license](https://img.shields.io/npm/l/@phonepe/api-schema-time-machine)](./LICENSE)
[![node](https://img.shields.io/node/v/@phonepe/api-schema-time-machine)](https://nodejs.org)

Zero-config API response schema tracker — plug into any Express app and automatically detect when your upstream API responses change shape.

## Why?

Upstream APIs change silently. A field gets renamed, a type switches from `string` to `number`, a nested object disappears — and you only find out when something breaks in production. `api-schema-time-machine` sits between your app and the upstream, fingerprints every JSON response, and alerts you the moment the shape changes. No annotations, no code generation, no schema files to maintain.

## Install

```bash
pnpm add @phonepe/api-schema-time-machine
```

## Quickstart

```js
const express = require('express');
const { schemaTracker } = require('@phonepe/api-schema-time-machine');

const app = express();

app.use(schemaTracker({ target: 'https://api.example.com' }));

app.listen(3000);
```

Open `http://localhost:3000/schema-tracker` to see the dashboard — all tracked endpoints, their snapshot history, and a diff view of the latest change.

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `target` | `string` | **required** | Upstream base URL to proxy requests to |
| `db` | `string` | `undefined` | Storage connection. `undefined`/`sqlite://` → SQLite. `postgres://…` → PostgreSQL. Bare path → SQLite at that path |
| `dashboard` | `boolean` | `true` | Mount the schema dashboard UI |
| `dashboardPath` | `string` | `"/schema-tracker"` | URL path where the dashboard is served |
| `ignoreRoutes` | `string[]` | `["/health", "/favicon.ico"]` | Paths to skip tracking entirely |
| `onSchemaChange` | `async (diff, path) => void` | `undefined` | Callback fired whenever a schema change is detected |

## Storage

**SQLite (default, zero config)** — data is written to `.schema-tracker/tracker.db` in your project directory. No setup required.

**PostgreSQL (opt-in)** — install the `pg` package and pass a connection string:

```bash
npm install pg
```

```js
app.use(schemaTracker({
  target: 'https://api.example.com',
  db: 'postgres://user:password@localhost:5432/mydb',
}));
```

## Dashboard

The built-in dashboard shows all tracked endpoints, their full snapshot history, and a diff view of the latest schema change.

```
http://localhost:3000/schema-tracker
```

## How it works

- Every JSON response from the proxied upstream is **fingerprinted** — each value is reduced to its type (`"string"`, `"number"`, `"boolean"`, `"null"`, or a nested structure).
- The fingerprint is compared against the **last stored snapshot** for that endpoint. If it differs, a diff is computed and stored.
- Diffs are computed at the **dot-notation field level**: added, removed, changed, and renamed fields are all tracked separately.

## Contributing

Contributions are welcome. Fork the repo, create a branch, and open a pull request.

```bash
npm test   # run the test suite before submitting
```

Please keep PRs focused — one fix or feature per PR.

## License

MIT © gandhaksanyam@gmail.com
