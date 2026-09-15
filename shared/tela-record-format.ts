/**
 * Tela のレコード書式。Tela は `std::quoted` で読むので、引用符と円記号だけを
 * 円記号で退避し、1 レコード 1 行 (LF) にする。改行・タブは空白へ潰す。
 */
export function telaField(value: string): string {
  return `"${value.replace(/[\r\n\t]+/g, ' ').replace(/[\\"]/g, match => `\\${match}`)}"`;
}

/** 座標は小数第 2 位まで。Tela 側の浮動小数の読み取りと桁を合わせる。 */
export const telaCoordinate = (value: number): string => String(Math.round(value * 100) / 100);
