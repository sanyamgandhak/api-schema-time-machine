'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fingerprint, schemaToString } = require('../fingerprint');

test('primitives - string', () => {
  assert.equal(fingerprint('hello'), 'string');
});

test('primitives - number', () => {
  assert.equal(fingerprint(42), 'number');
  assert.equal(fingerprint(3.14), 'number');
});

test('primitives - boolean', () => {
  assert.equal(fingerprint(true), 'boolean');
  assert.equal(fingerprint(false), 'boolean');
});

test('primitives - null', () => {
  assert.equal(fingerprint(null), 'null');
});

test('nested object', () => {
  const result = fingerprint({ user: { id: 1, name: 'Alice' } });
  assert.deepEqual(result, { user: { id: 'number', name: 'string' } });
});

test('array with items', () => {
  const result = fingerprint([{ id: 1, active: true }]);
  assert.deepEqual(result, [{ id: 'number', active: 'boolean' }]);
});

test('empty array', () => {
  assert.deepEqual(fingerprint([]), ['unknown']);
});

test('deeply nested', () => {
  const input = { a: { b: { c: { d: 'value' } } } };
  assert.deepEqual(fingerprint(input), { a: { b: { c: { d: 'string' } } } });
});

test('schemaToString produces stable output', () => {
  const a = schemaToString({ z: 'string', a: 'number' });
  const b = schemaToString({ a: 'number', z: 'string' });
  assert.equal(a, b);
});

test('schemaToString handles primitives', () => {
  assert.equal(schemaToString('string'), '"string"');
  assert.equal(schemaToString('null'), '"null"');
});
