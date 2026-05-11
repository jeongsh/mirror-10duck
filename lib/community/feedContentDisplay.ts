import { splitContentSegments } from "@/lib/stickers/token";

/**
 * 게시판 → 피드 공유 시 `shareToFeed`가 붙이는 머리줄:
 * `[게시판명에서 공유됨] 제목\n\n` + 본문(JSON/텍스트)
 */
const BOARD_SHARE_PREFIX_RE = /^(\[[^\]]+에서 공유됨\]\s*[^\n]*)\n\n([\s\S]+)$/;

export function splitFeedShareHeader(content: string): {
  shareHeaderLine: string | null;
  rawBody: string;
} {
  const m = content.match(BOARD_SHARE_PREFIX_RE);
  if (!m) {
    return { shareHeaderLine: null, rawBody: content };
  }
  return { shareHeaderLine: m[1], rawBody: m[2] };
}

export function splitFeedBodyForDisplay(content: string): {
  shareHeaderLine: string | null;
  body: string;
  imageUrls: string[];
} {
  const { shareHeaderLine, rawBody } = splitFeedShareHeader(content);

  const trimmed = rawBody.trim();
  const isJson = trimmed.startsWith("{") && trimmed.endsWith("}");
  if (isJson) {
    return { shareHeaderLine, body: trimmed, imageUrls: [] };
  }

  const imageUrls: string[] = [];
  const body = splitContentSegments(rawBody)
    .map((segment) => {
      if (segment.type === "image") {
        imageUrls.push(segment.url);
        return "";
      }
      if (segment.type === "sticker") return segment.token.raw;
      return segment.value;
    })
    .join("")
    .trim();

  return { shareHeaderLine, body, imageUrls };
}
