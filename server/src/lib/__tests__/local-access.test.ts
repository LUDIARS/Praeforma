import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isAllowedLocalOrigin,
  parseAdditionalOrigins,
  requiresOriginHeader,
} from '../local-access.ts';

const PUBLIC = 'https://pf.ai-run-do.com';
const PORT = 8889;

test('local origin: 同一ポートの loopback を許可する', () => {
  for (const origin of ['http://127.0.0.1:8889', 'http://localhost:8889', 'http://[::1]:8889']) {
    assert.equal(isAllowedLocalOrigin(origin, PUBLIC, PORT), true, origin);
  }
});

test('local origin: 別ポート・別ホストの loopback 類似 Origin を拒否する', () => {
  for (const origin of [
    'http://127.0.0.1:9999', // 別ポート
    'http://127.0.0.2:8889', // loopback 帯だが許可リスト外
    'http://localhost.evil.com:8889', // suffix 偽装
    'http://evil.com:8889',
    'https://localhost:8889', // scheme 不一致
  ]) {
    assert.equal(isAllowedLocalOrigin(origin, PUBLIC, PORT), false, origin);
  }
});

test('local origin: 設定済み HTTPS 公開 Origin だけを許可する', () => {
  assert.equal(isAllowedLocalOrigin(PUBLIC, PUBLIC, PORT), true);
  // host 一致でも scheme が違えば拒否
  assert.equal(isAllowedLocalOrigin('http://pf.ai-run-do.com', PUBLIC, PORT), false);
  // 別 subdomain / 別 host
  assert.equal(isAllowedLocalOrigin('https://evil.ai-run-do.com', PUBLIC, PORT), false);
  assert.equal(isAllowedLocalOrigin('https://pf.ai-run-do.com.evil.com', PUBLIC, PORT), false);
});

test('local origin: 配備設定の追加 HTTPS Origin だけを許可する', () => {
  const additional = parseAdditionalOrigins(
    ' https://web.ai-run-do.com,https://exiv.ai-run-do.com,https://web.ai-run-do.com ',
  );
  assert.deepEqual(additional, ['https://web.ai-run-do.com', 'https://exiv.ai-run-do.com']);
  assert.equal(isAllowedLocalOrigin('https://web.ai-run-do.com', PUBLIC, PORT, additional), true);
  assert.equal(isAllowedLocalOrigin('https://exiv.ai-run-do.com', PUBLIC, PORT, additional), true);
  assert.equal(isAllowedLocalOrigin('https://evil.ai-run-do.com', PUBLIC, PORT, additional), false);
  assert.equal(isAllowedLocalOrigin('https://web.ai-run-do.com.evil.com', PUBLIC, PORT, additional), false);
});

test('local origin: 未設定の追加 Origin は空の許可リストになる', () => {
  assert.deepEqual(parseAdditionalOrigins(undefined), []);
});

test('local origin: 追加 Origin の HTTP・path・wildcard・空要素を拒否する', () => {
  for (const value of [
    '',
    'https://web.ai-run-do.com,',
    'http://web.ai-run-do.com',
    'https://web.ai-run-do.com/viewer/',
    'https://*.ai-run-do.com',
  ]) {
    assert.throws(
      () => parseAdditionalOrigins(value),
      /PRAEFORMA_ALLOWED_ORIGINS/,
      value,
    );
  }
});

test('local origin: publicUrl が HTTP 既定値なら外部 Origin を一切許可しない', () => {
  const httpDefault = `http://localhost:${PORT}`;
  assert.equal(isAllowedLocalOrigin('https://pf.ai-run-do.com', httpDefault, PORT), false);
  assert.equal(isAllowedLocalOrigin('http://evil.com', httpDefault, PORT), false);
  // loopback 判定は publicUrl と独立に成立する
  assert.equal(isAllowedLocalOrigin('http://127.0.0.1:8889', httpDefault, PORT), true);
});

test('local origin: 不正な Origin と path 付き Origin を拒否する', () => {
  for (const origin of ['', 'null', 'not a url', 'http://127.0.0.1:8889/path']) {
    assert.equal(isAllowedLocalOrigin(origin, PUBLIC, PORT), false, origin);
  }
});

test('local origin: publicUrl が壊れていても loopback 判定は維持する', () => {
  assert.equal(isAllowedLocalOrigin('http://127.0.0.1:8889', 'not a url', PORT), true);
  assert.equal(isAllowedLocalOrigin('https://pf.ai-run-do.com', 'not a url', PORT), false);
});

test('origin 必須判定: 状態変更 method のみ Origin を要求する', () => {
  for (const method of ['GET', 'HEAD', 'OPTIONS', 'get', 'head']) {
    assert.equal(requiresOriginHeader(method), false, method);
  }
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'post', 'delete']) {
    assert.equal(requiresOriginHeader(method), true, method);
  }
});
