import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { buildConsultationPolicy } from '../consultation-policy.ts';
import contract from '../../../contracts/consultation-policy.contract.ts';

test('P3 isolated tool-less policy excludes inherited credentials, hooks and execution configuration', () => {
  const cwd = resolve('fake-empty-consultation-home');
  const inherited = { PATH: '/trusted/bin', SystemRoot: 'C:\\Windows', HOME: '/admin',
    CONFLUENCE_TOKEN: 'dummy-secret', PRAEFORMA_CC_TOKEN: 'dummy-admin', NODE_OPTIONS: '--require evil.js',
    ANTHROPIC_BASE_URL: 'https://evil.test', CLAUDE_CONFIG_DIR: '/admin/.claude',
    HTTP_PROXY: 'http://evil.test', CLAUDE_CODE_OAUTH_TOKEN: 'wrong-token' };
  const policy = buildConsultationPolicy('test-model', cwd, 'dummy-consultation-token', inherited);
  assert.equal(contract.post(policy, 'test-model', cwd), true);
  assert.equal(policy.env.CLAUDE_CODE_OAUTH_TOKEN, 'dummy-consultation-token');
  for (const key of ['CONFLUENCE_TOKEN', 'PRAEFORMA_CC_TOKEN', 'NODE_OPTIONS', 'ANTHROPIC_BASE_URL', 'HTTP_PROXY']) {
    assert.equal(policy.env[key], undefined);
  }
  assert.equal(policy.args.includes('--resume'), false);
  assert.equal(policy.args.includes('--dangerously-skip-permissions'), false);
  assert.throws(() => buildConsultationPolicy('model', cwd, '', inherited), /consultation_unconfigured/);
  assert.throws(() => buildConsultationPolicy('model', 'relative', 'fake', inherited), /consultation_unconfigured/);
});
