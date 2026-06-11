export async function postPerplexity(apiKey: string, payload: object) {
  return fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export function readPerplexityContent(value: unknown): string {
  if (!isRecord(value)) return "";
  const choices = value.choices;
  if (!Array.isArray(choices)) return "";
  const first = choices[0];
  if (!isRecord(first) || !isRecord(first.message)) return "";
  return typeof first.message.content === "string" ? first.message.content : "";
}

export function parseJsonContent(content: string): unknown {
  const trimmed = content.trim();
  if (!trimmed) throw new Error("AI 응답이 비어 있습니다.");

  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("AI 응답을 JSON으로 파싱하지 못했습니다.");
  }
}

export function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function callPerplexityWithFallback(
  apiKey: string,
  buildPayload: (structured: boolean) => object,
): Promise<string> {
  const response = await postPerplexity(apiKey, buildPayload(true));

  if (!response.ok && response.status === 400) {
    const fallback = await postPerplexity(apiKey, buildPayload(false));
    if (!fallback.ok) {
      const raw = await fallback.text();
      throw new Error(`Perplexity 요청 실패 (${fallback.status}): ${raw.slice(0, 500)}`);
    }
    return readPerplexityContent(await fallback.json());
  }

  if (!response.ok) {
    const raw = await response.text();
    throw new Error(`Perplexity 요청 실패 (${response.status}): ${raw.slice(0, 500)}`);
  }

  return readPerplexityContent(await response.json());
}
