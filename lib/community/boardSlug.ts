/**
 * URL 세그먼트와 `boards.slug` 저장값을 맞추기 위한 정규화.
 * - 앞뒤 공백, ASCII 대소문자 통일
 * - 워드/웹에서 흔히 섞이는 "빼기 모양" 문자를 URL용 ASCII 하이픈(U+002D)으로 통일
 *   (눈으로는 one-piece 같아도 DB·주소의 코드포인트가 달라 .eq 조회가 빗나가는 경우 방지)
 */
const UNICODE_DASH_OR_MINUS = /[\u2010\u2011\u2012\u2013\u2014\u2212\uFE58\uFE63\uFF0D]/g;

function tryDecodeURIComponent(s: string): string {
  if (!s.includes("%")) return s;
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

export function normalizeBoardSlug(raw: string): string {
  const s = tryDecodeURIComponent(raw.trim().toLowerCase());
  return s.replace(UNICODE_DASH_OR_MINUS, "-").trim();
}
