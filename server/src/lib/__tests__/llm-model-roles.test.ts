import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { resolveAstraModel } from '../astra-cli.ts';
import { getClaudeModel, setClaudeModel } from '../llm.ts';

test('Praeforma resolves model roles per use and preserves explicit overrides', (context) => {
  const directory = mkdtempSync(join(tmpdir(), 'pf-model-roles-'));
  context.after(() => {
    setClaudeModel(null);
    rmSync(directory, { recursive: true, force: true });
  });
  const mapPath = join(directory, 'model-roles.json');
  const env = { LUDIARS_MODEL_ROLES_FILE: mapPath };
  assert.throws(() => resolveAstraModel(env), /model_role_unresolved:astra/);

  const writeRoles = (version: string, updatedAt: Date): void => {
    writeFileSync(mapPath, JSON.stringify({ schemaVersion: 1, roles: {
      codex: { astra: `gpt-test-astra-${version}` },
      claude: { sonnet: `claude-test-sonnet-${version}`, opus: `claude-test-opus-${version}` },
    } }));
    utimesSync(mapPath, updatedAt, updatedAt);
  };
  writeRoles('before', new Date('2026-01-01T00:00:00Z'));
  assert.equal(resolveAstraModel(env), 'gpt-test-astra-before');
  assert.equal(getClaudeModel(env), 'claude-test-sonnet-before');
  writeRoles('after', new Date('2026-01-02T00:00:00Z'));
  assert.equal(resolveAstraModel(env), 'gpt-test-astra-after');
  assert.equal(getClaudeModel(env), 'claude-test-sonnet-after');
  assert.equal(resolveAstraModel({ ...env, LUDIARS_ONESHOT_MODEL_ASTRA: 'gpt-test-pinned' }), 'gpt-test-pinned');
  setClaudeModel('opus');
  assert.equal(getClaudeModel(env), 'claude-test-opus-after');
  setClaudeModel('claude-test-pinned');
  assert.equal(getClaudeModel(env), 'claude-test-pinned');
});
