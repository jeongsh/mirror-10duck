import type { StickerToken } from "@/types/community";

/**
 * 스티커 토큰 직렬화/파싱.
 *
 * 형식: `:sticker/{characterId}/{emotion}:`
 *
 * - characterId 는 영문/숫자/`-`/`_` 만 허용 (UUID/`builtin-...` 형태 가정).
 * - emotion 은 영문/숫자/`-`/`_`.
 *
 * 본문에 들어가도 토큰 하나가 한 단위로 잘리도록 정규식을 글로벌로 사용한다.
 * (멀티라인 본문 지원, 인접 텍스트와 안전하게 분리)
 */

const STICKER_TOKEN_PATTERN = /:sticker\/([A-Za-z0-9_-]+)\/([A-Za-z0-9_-]+):/g;

export function buildStickerToken(characterId: string, emotion: string): string {
  return `:sticker/${characterId}/${emotion}:`;
}

export function parseStickerToken(input: string): StickerToken | null {
  const match = /^:sticker\/([A-Za-z0-9_-]+)\/([A-Za-z0-9_-]+):$/.exec(input);
  if (!match) return null;
  return { characterId: match[1], emotion: match[2], raw: input };
}

/**
 * 본문 문자열을 텍스트 세그먼트와 스티커 세그먼트의 시퀀스로 쪼갠다.
 * 렌더러(`RichContent`) 가 이 세그먼트를 React 노드로 매핑한다.
 */
export type ContentSegment =
  | { type: "text"; value: string }
  | { type: "sticker"; token: StickerToken };

export function splitContentSegments(content: string): ContentSegment[] {
  if (!content) return [];

  const segments: ContentSegment[] = [];
  let lastIndex = 0;

  // 정규식 인스턴스 매 호출마다 재생성: stateful lastIndex 공유 방지.
  const pattern = new RegExp(STICKER_TOKEN_PATTERN.source, "g");

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content)) !== null) {
    const [raw, characterId, emotion] = match;
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: content.slice(lastIndex, match.index) });
    }
    segments.push({
      type: "sticker",
      token: { characterId, emotion, raw },
    });
    lastIndex = match.index + raw.length;
  }

  if (lastIndex < content.length) {
    segments.push({ type: "text", value: content.slice(lastIndex) });
  }

  return segments;
}
