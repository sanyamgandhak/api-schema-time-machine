'use strict';

function fingerprint(value) {
  if (value === null) return 'null';

  const type = typeof value;
  if (type === 'string') return 'string';
  if (type === 'number') return 'number';
  if (type === 'boolean') return 'boolean';

  if (Array.isArray(value)) {
    return value.length === 0 ? ['unknown'] : [fingerprint(value[0])];
  }

  if (type === 'object') {
    const result = {};
    for (const key of Object.keys(value)) {
      result[key] = fingerprint(value[key]);
    }
    return result;
  }

  return 'unknown';
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  const keys = Object.keys(value).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify(value[k])).join(',') + '}';
}

function schemaToString(schema) {
  return stableStringify(schema);
}

module.exports = { fingerprint, schemaToString };
