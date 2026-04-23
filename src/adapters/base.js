'use strict';

class BaseAdapter {
  async migrate() { throw new Error('not implemented'); }
  async upsertEndpoint(path) { throw new Error('not implemented'); }
  async appendSnapshot(path, schemaString) { throw new Error('not implemented'); }
  async getLatestSnapshot(path) { throw new Error('not implemented'); }
  async appendDiff(path, fromSnapshotId, toSnapshotId, diffString) { throw new Error('not implemented'); }
  async getAllEndpoints() { throw new Error('not implemented'); }
  async getHistory(path) { throw new Error('not implemented'); }
  async getLatestDiff(path) { throw new Error('not implemented'); }
}

module.exports = BaseAdapter;
