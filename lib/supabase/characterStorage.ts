import JSZip from "jszip";
import { supabase } from "@/lib/supabase/client";
import { ALLOWED_EXTENSIONS } from "@/lib/live2d/modelPackage";

const BUCKET = "character-assets";

const IGNORED_FILENAME_PATTERNS = [
  /(^|\/)__MACOSX(\/|$)/i,
  /(^|\/)\.DS_Store$/i,
  /(^|\/)Thumbs\.db$/i,
  /(^|\/)desktop\.ini$/i,
  /\.cmo3$/i,
  /\.psd$/i,
];

function shouldIgnore(path: string): boolean {
  return IGNORED_FILENAME_PATTERNS.some((re) => re.test(path));
}

function extOf(path: string): string {
  const i = path.lastIndexOf(".");
  return i >= 0 ? path.slice(i).toLowerCase() : "";
}

function commonRoot(files: string[]): string | null {
  if (files.length === 0) return null;
  const parts = files[0].split("/");
  if (parts.length === 1) return "";
  const candidate = parts[0];
  for (const f of files) {
    if (!f.startsWith(candidate + "/")) return "";
  }
  return candidate;
}

function mimeOf(ext: string): string {
  switch (ext) {
    case ".png":
      return "image/png";
    case ".json":
      return "application/json";
    case ".wav":
      return "audio/wav";
    case ".mp3":
      return "audio/mpeg";
    case ".ogg":
      return "audio/ogg";
    case ".m4a":
      return "audio/mp4";
    case ".moc3":
      return "application/octet-stream";
    default:
      return "application/octet-stream";
  }
}

function ensureArray<T>(value: T | T[] | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function normalizeTextures(value: unknown): string[] {
  return ensureArray(value).filter((v): v is string => typeof v === "string");
}

function normalizeExpressions(value: unknown): { Name: string; File: string }[] {
  return ensureArray(value)
    .filter(
      (v): v is { Name: string; File: string } =>
        !!v &&
        typeof v === "object" &&
        typeof (v as { Name?: unknown }).Name === "string" &&
        typeof (v as { File?: unknown }).File === "string",
    )
    .map((v) => ({ Name: v.Name, File: v.File }));
}

function normalizeMotions(value: unknown): Record<string, { File: string; Sound?: string }[]> {
  if (!value || typeof value !== "object") return {};
  const out: Record<string, { File: string; Sound?: string }[]> = {};
  for (const [group, entries] of Object.entries(value as Record<string, unknown>)) {
    out[group] = ensureArray(entries)
      .filter(
        (entry): entry is { File: string; Sound?: string } =>
          !!entry &&
          typeof entry === "object" &&
          typeof (entry as { File?: unknown }).File === "string",
      )
      .map((entry) => ({
        File: entry.File,
        ...(typeof entry.Sound === "string" ? { Sound: entry.Sound } : {}),
      }));
  }
  return out;
}

/**
 * Storage 에 올릴 model3.json 정규화:
 * - HitAreas / Groups 를 항상 배열로 고정
 * - FileReferences 하위의 배열/객체 필드를 안전한 shape 으로 정규화
 */
function sanitizeModel3Json(input: unknown): unknown {
  if (!input || typeof input !== "object") return input;
  const src = input as {
    Version?: unknown;
    FileReferences?: {
      Moc?: unknown;
      Textures?: unknown;
      Physics?: unknown;
      Pose?: unknown;
      DisplayInfo?: unknown;
      UserData?: unknown;
      Expressions?: unknown;
      Motions?: unknown;
    };
    HitAreas?: unknown;
    Groups?: unknown;
    Layout?: unknown;
  };
  if (!src.FileReferences || typeof src.FileReferences !== "object") return input;
  if (typeof src.FileReferences.Moc !== "string") return input;

  const out: Record<string, unknown> = {
    Version: typeof src.Version === "number" ? src.Version : 3,
    FileReferences: {
      Moc: src.FileReferences.Moc,
      Textures: normalizeTextures(src.FileReferences.Textures),
    },
    HitAreas: [],
    Groups: [],
  };

  const refs = out.FileReferences as Record<string, unknown>;
  if (typeof src.FileReferences.Physics === "string" && src.FileReferences.Physics) refs.Physics = src.FileReferences.Physics;
  if (typeof src.FileReferences.Pose === "string" && src.FileReferences.Pose) refs.Pose = src.FileReferences.Pose;
  if (typeof src.FileReferences.DisplayInfo === "string" && src.FileReferences.DisplayInfo) refs.DisplayInfo = src.FileReferences.DisplayInfo;
  if (typeof src.FileReferences.UserData === "string" && src.FileReferences.UserData) refs.UserData = src.FileReferences.UserData;

  const expressions = normalizeExpressions(src.FileReferences.Expressions);
  if (expressions.length > 0) refs.Expressions = expressions;

  const motions = normalizeMotions(src.FileReferences.Motions);
  if (Object.keys(motions).length > 0) refs.Motions = motions;

  if (Array.isArray(src.HitAreas)) {
    out.HitAreas = src.HitAreas
      .filter(
        (v): v is { Id: string; Name?: string } =>
          !!v &&
          typeof v === "object" &&
          typeof (v as { Id?: unknown }).Id === "string",
      )
      .map((v) => ({
        Id: v.Id,
        ...(typeof v.Name === "string" ? { Name: v.Name } : {}),
      }));
  }

  if (Array.isArray(src.Groups)) {
    out.Groups = src.Groups
      .filter(
        (v): v is { Target: string; Name: string; Ids: unknown } =>
          !!v &&
          typeof v === "object" &&
          typeof (v as { Target?: unknown }).Target === "string" &&
          typeof (v as { Name?: unknown }).Name === "string",
      )
      .map((v) => ({
        Target: v.Target,
        Name: v.Name,
        Ids: Array.isArray(v.Ids)
          ? (v.Ids as unknown[]).filter((id): id is string => typeof id === "string")
          : [],
      }));
  }

  if (src.Layout && typeof src.Layout === "object" && !Array.isArray(src.Layout)) {
    out.Layout = src.Layout;
  }

  return out;
}

export interface UploadedCharacterAssets {
  modelUrl: string;
  storagePrefix: string;
  uploadedPaths: string[];
}

/**
 * ZIP 안의 유효 파일들을 Storage 의 `${user_id}/${character_id}/` 아래에 업로드한다.
 *
 * - root 디렉터리는 제거하고 model3.json 의 상대경로 구조 그대로 유지하므로,
 *   `Live2DModel.from(<storage public url of model3.json>)` 호출 시 같은 base 의
 *   다른 리소스들이 자동으로 같이 fetch 된다.
 * - 잘 알려진 메타/쓰레기 파일과 허용 확장자 외 파일은 업로드 대상에서 제외.
 */
export async function uploadCharacterAssets(
  file: File,
  characterId: string,
): Promise<UploadedCharacterAssets> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("로그인이 필요합니다.");
  }

  const zip = await JSZip.loadAsync(file);

  const allPaths: string[] = [];
  zip.forEach((relPath, entry) => {
    if (entry.dir) return;
    if (shouldIgnore(relPath)) return;
    allPaths.push(relPath);
  });

  if (allPaths.length === 0) {
    throw new Error("ZIP 이 비어있습니다.");
  }

  const root = commonRoot(allPaths) ?? "";
  const stripRoot = (p: string) =>
    root && p.startsWith(root + "/") ? p.slice(root.length + 1) : p;

  const modelJsonCandidates = allPaths.filter((p) =>
    /\.model3\.json$/i.test(p),
  );
  if (modelJsonCandidates.length === 0) {
    throw new Error("`*.model3.json` 매니페스트가 없습니다.");
  }
  if (modelJsonCandidates.length > 1) {
    throw new Error(
      `model3.json 이 여러 개 발견되었습니다(${modelJsonCandidates.length}개).`,
    );
  }

  const modelJsonPath = modelJsonCandidates[0];
  const modelJsonRelative = stripRoot(modelJsonPath);

  const storagePrefix = `${user.id}/${characterId}`;
  const uploadedPaths: string[] = [];

  for (const path of allPaths) {
    const ext = extOf(path);
    if (!ALLOWED_EXTENSIONS.has(ext)) continue;

    const entry = zip.file(path);
    if (!entry) continue;

    const targetPath = `${storagePrefix}/${stripRoot(path)}`;

    let blob: Blob;
    if (path === modelJsonPath) {
      // 로컬 blob install 경로와 동일하게 model3.json 을 안전 shape 으로 보정.
      const text = await entry.async("string");
      const parsed = JSON.parse(text);
      const sanitized = sanitizeModel3Json(parsed);
      blob = new Blob([JSON.stringify(sanitized)], { type: "application/json" });
    } else {
      const buf = await entry.async("arraybuffer");
      blob = new Blob([buf], { type: mimeOf(ext) });
    }

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(targetPath, blob, {
        contentType: mimeOf(ext),
        upsert: true,
      });

    if (error) {
      throw new Error(
        `Storage 업로드 실패 (${targetPath}): ${error.message}`,
      );
    }

    uploadedPaths.push(targetPath);
  }

  const { data: publicUrlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(`${storagePrefix}/${modelJsonRelative}`);

  return {
    modelUrl: publicUrlData.publicUrl,
    storagePrefix,
    uploadedPaths,
  };
}

/**
 * 캐릭터의 Storage 폴더를 통째로 삭제한다.
 * (`${user_id}/${character_id}/` 아래 모든 파일 일괄 제거)
 */
export async function deleteCharacterAssets(characterId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const prefix = `${user.id}/${characterId}`;

  const { data: listed, error: listError } = await supabase.storage
    .from(BUCKET)
    .list(prefix, { limit: 1000 });

  if (listError) {
    console.error("[characterStorage] list error:", listError.message);
    return;
  }

  const flatten = async (
    base: string,
    entries: { name: string; id: string | null }[],
  ): Promise<string[]> => {
    const acc: string[] = [];
    for (const entry of entries) {
      const fullPath = `${base}/${entry.name}`;
      if (entry.id === null) {
        // 폴더로 추정 → 재귀
        const { data: sub } = await supabase.storage
          .from(BUCKET)
          .list(fullPath, { limit: 1000 });
        if (sub) {
          const subPaths = await flatten(fullPath, sub);
          acc.push(...subPaths);
        }
      } else {
        acc.push(fullPath);
      }
    }
    return acc;
  };

  const allPaths = await flatten(prefix, listed ?? []);
  if (allPaths.length === 0) return;

  const { error: removeError } = await supabase.storage
    .from(BUCKET)
    .remove(allPaths);

  if (removeError) {
    console.error("[characterStorage] remove error:", removeError.message);
  }
}
