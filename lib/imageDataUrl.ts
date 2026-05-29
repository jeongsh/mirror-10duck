function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error ?? new Error("이미지를 읽지 못했습니다."));
    reader.readAsDataURL(blob);
  });
}

/** 외부 CDN 이미지를 data URL로 변환 (PNG 캡처용) */
export async function urlToDataUrl(url: string): Promise<string | null> {
  try {
    const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(url)}`;
    const res = await fetch(proxyUrl);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await blobToDataUrl(blob);
  } catch {
    return null;
  }
}

export async function mapUrlsToDataUrls(urls: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(urls.filter(Boolean))];
  const entries = await Promise.all(
    unique.map(async (url) => {
      const dataUrl = await urlToDataUrl(url);
      return [url, dataUrl] as const;
    })
  );
  const map: Record<string, string> = {};
  for (const [url, dataUrl] of entries) {
    if (dataUrl) map[url] = dataUrl;
  }
  return map;
}

export function resolveImageSrc(
  url: string | null | undefined,
  dataUrls: Record<string, string>
): string | null {
  if (!url) return null;
  return dataUrls[url] ?? url;
}
