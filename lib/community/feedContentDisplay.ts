import { splitContentSegments } from "@/lib/stickers/token";

/**
 * 게시판 → 피드 공유 시 `shareToFeed`가 붙이는 머리줄:
 * `[게시판명에서 공유됨] 제목\n\n` + 본문(JSON/텍스트)
 */
const BOARD_SHARE_PREFIX_RE = /^(\[[^\]]+에서 공유됨\]\s*[^\n]*)\n\n([\s\S]+)$/;
const IMPORTED_IMAGE_RE = /^\[짤\]\s+(https?:\/\/\S+)$/;
const IMPORTED_WISH_RE = /^\[위시\]\s+(.+?)(?:\s+(.+))?$/;
const IMPORTED_RECRUIT_RE = /^\[모집\]\s+(.+?)(?:\s+(.+))?$/;
const URL_RE = /^https?:\/\/\S+$/;

export type FeedAttachmentCard = {
  type: "url" | "wish" | "recruit";
  label: string;
  meta?: string;
  url?: string;
};

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
  cards: FeedAttachmentCard[];
} {
  const { shareHeaderLine, rawBody } = splitFeedShareHeader(content);

  const trimmed = rawBody.trim();
  const isJson = trimmed.startsWith("{") && trimmed.endsWith("}");
  if (isJson) {
    return { shareHeaderLine, body: trimmed, imageUrls: [], cards: [] };
  }

  const imageUrls: string[] = [];
  const cards: FeedAttachmentCard[] = [];
  const parsedLines = splitContentSegments(rawBody)
    .map((segment) => {
      if (segment.type === "image") {
        imageUrls.push(segment.url);
        return "";
      }
      if (segment.type === "pendingImage") return `!image_pending[${segment.assetId}]`;
      if (segment.type === "sticker") return segment.token.raw;
      return segment.value;
    })
    .join("")
    .split("\n")
    .map((line) => {
      const trimmedLine = line.trim();
      if (!trimmedLine) return "";

      const imageMatch = trimmedLine.match(IMPORTED_IMAGE_RE);
      if (imageMatch) {
        imageUrls.push(imageMatch[1]);
        return "";
      }

      if (URL_RE.test(trimmedLine)) {
        cards.push({ type: "url", label: trimmedLine, url: trimmedLine });
        return "";
      }

      const wishMatch = trimmedLine.match(IMPORTED_WISH_RE);
      if (wishMatch) {
        cards.push({ type: "wish", label: wishMatch[1], meta: wishMatch[2] });
        return "";
      }

      const recruitMatch = trimmedLine.match(IMPORTED_RECRUIT_RE);
      if (recruitMatch) {
        cards.push({ type: "recruit", label: recruitMatch[1], meta: recruitMatch[2] });
        return "";
      }

      return line;
    });
  const body = parsedLines.filter(Boolean).join("\n").trim();

  return { shareHeaderLine, body, imageUrls, cards };
}
