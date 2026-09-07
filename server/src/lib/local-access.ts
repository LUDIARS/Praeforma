/** Accept loopback and the explicitly configured HTTPS tunnel origin only. */
export function isAllowedLocalOrigin(origin: string, publicUrl: string, port: number): boolean {
  try {
    const url = new URL(origin);
    if (origin !== url.origin) return false;
    if (url.protocol === 'http:' && Number(url.port || 80) === port
      && (url.hostname === '127.0.0.1' || url.hostname === 'localhost' || url.hostname === '[::1]')) {
      return true;
    }
    const external = new URL(publicUrl);
    return external.protocol === 'https:' && url.origin === external.origin;
  } catch { return false; }
}

/**
 * Origin 無しで届く状態変更要求 (cross-site form POST / simple request) を弾く。
 * ローカルモードは認証を持たないため、 CORS だけでは送信自体を止められない
 * (CORS は応答の読み取りのみを制限する)。 safe method 以外は Origin 必須にする。
 */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function requiresOriginHeader(method: string): boolean {
  return !SAFE_METHODS.has(method.toUpperCase());
}
