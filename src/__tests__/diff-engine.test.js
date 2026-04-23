'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { diff } = require('../diff-engine');

test('identical schemas → null', () => {
  const schema = { id: 'number', name: 'string' };
  assert.equal(diff(schema, schema), null);
});

test('added field', () => {
  const old = { id: 'number' };
  const next = { id: 'number', email: 'string' };
  const result = diff(old, next);
  assert.ok(result);
  assert.deepEqual(result.added, { email: 'string' });
  assert.deepEqual(result.removed, {});
  assert.deepEqual(result.changed, {});
  assert.deepEqual(result.renamed, {});
});

test('removed field', () => {
  const old = { id: 'number', legacy: 'string' };
  const next = { id: 'number' };
  const result = diff(old, next);
  assert.ok(result);
  assert.deepEqual(result.removed, { legacy: 'string' });
  assert.deepEqual(result.added, {});
});

test('changed type', () => {
  const old = { count: 'string' };
  const next = { count: 'number' };
  const result = diff(old, next);
  assert.ok(result);
  assert.deepEqual(result.changed, { count: { from: 'string', to: 'number' } });
});

test('renamed field - same type, one removed one added', () => {
  const old = { userId: 'number', name: 'string' };
  const next = { id: 'number', name: 'string' };
  const result = diff(old, next);
  assert.ok(result);
  assert.deepEqual(result.renamed, { 'userId → id': 'number' });
  assert.deepEqual(result.added, {});
  assert.deepEqual(result.removed, {});
});

test('nested field changes', () => {
  const old = { user: { id: 'number', name: 'string' } };
  const next = { user: { id: 'number', email: 'string' } };
  const result = diff(old, next);
  assert.ok(result);
  // name removed, email added — same type → rename
  assert.deepEqual(result.renamed, { 'user.name → user.email': 'string' });
  assert.deepEqual(result.added, {});
  assert.deepEqual(result.removed, {});
});

test('no change on deeply nested identical schemas', () => {
  const schema = { a: { b: { c: 'boolean' } } };
  assert.equal(diff(schema, schema), null);
});
