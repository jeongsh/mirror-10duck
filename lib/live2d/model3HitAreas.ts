/**
 * model3.json 의 HitAreas 배열에서 ID/이름만 추출한다.
 * (ZIP 파서와 캐릭터 관리 UI 가 동일 규칙을 쓰도록 공유)
 */
export interface ModelHitAreaEntry {
  id: string;
  name: string;
}

export function parseHitAreasFromModel3Json(model3: unknown): ModelHitAreaEntry[] {
  if (!model3 || typeof model3 !== "object") return [];
  const raw = (model3 as { HitAreas?: unknown }).HitAreas;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (v): v is { Id: string; Name?: string } =>
        !!v &&
        typeof v === "object" &&
        typeof (v as { Id?: unknown }).Id === "string"
    )
    .map((h) => ({ id: h.Id, name: h.Name ?? h.Id }));
}

export async function fetchModel3HitAreas(modelPath: string): Promise<ModelHitAreaEntry[]> {
  const res = await fetch(modelPath);
  if (!res.ok) {
    throw new Error(`model3.json 을 불러오지 못했습니다 (${res.status})`);
  }
  const json: unknown = await res.json();
  return parseHitAreasFromModel3Json(json);
}
