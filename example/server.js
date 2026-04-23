const express = require('express');
const { schemaTracker } = require('../src/index.js');
require('dotenv').config();

const app = express();

app.use(schemaTracker({
  target: process.env.BACKEND_URL || 'https://jsonplaceholder.typicode.com',
  db: process.env.DATABASE_URL,
  dashboard: true,
  onSchemaChange: (diff, path) => {
    console.log(`[ALERT] Schema changed on ${path}:`, JSON.stringify(diff, null, 2));
  },
}));

app.listen(3000, () => {
  console.log('Proxy running on http://localhost:3000');
  console.log('Dashboard at  http://localhost:3000/schema-tracker');
});
