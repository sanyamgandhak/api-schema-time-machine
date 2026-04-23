'use strict';

function flatten(schema, prefix = '', out = {}) {
  if (typeof schema !== 'object' || schema === null || Array.isArray(schema)) {
    out[prefix] = Array.isArray(schema) ? JSON.stringify(schema) : String(schema);
    return out;
  }
  for (const key of Object.keys(schema)) {
    const full = prefix ? `${prefix}.${key}` : key;
    flatten(schema[key], full, out);
  }
  return out;
}

function diff(oldSchema, newSchema) {
  const oldFlat = flatten(oldSchema);
  const newFlat = flatten(newSchema);

  const added = {};
  const removed = {};
  const changed = {};
  const renamed = {};

  for (const key of Object.keys(newFlat)) {
    if (!(key in oldFlat)) added[key] = newFlat[key];
  }
  for (const key of Object.keys(oldFlat)) {
    if (!(key in newFlat)) removed[key] = oldFlat[key];
    else if (oldFlat[key] !== newFlat[key]) changed[key] = { from: oldFlat[key], to: newFlat[key] };
  }

  // Detect renames: removed key with exact one added key of same type
  for (const removedKey of Object.keys(removed)) {
    const sameType = Object.keys(added).filter(k => added[k] === removed[removedKey]);
    if (sameType.length === 1) {
      const addedKey = sameType[0];
      renamed[`${removedKey} → ${addedKey}`] = removed[removedKey];
      delete added[addedKey];
      delete removed[removedKey];
    }
  }

  if (
    Object.keys(added).length === 0 &&
    Object.keys(removed).length === 0 &&
    Object.keys(changed).length === 0 &&
    Object.keys(renamed).length === 0
  ) {
    return null;
  }

  return { added, removed, changed, renamed, timestamp: new Date().toISOString() };
}

module.exports = { diff };
