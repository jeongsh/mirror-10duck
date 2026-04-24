import JSZip from "jszip";

/**
 * Live2D 모델 패키지(ZIP) 파서 & 검증기.
 *
 * 정책:
 *   1. ZIP 내부에서 `*.model3.json` 을 "진실의 원천" 으로 삼는다.
 *   2. model3.json 이 참조하지 않는 파일은 전부 버린다(= 크리에이터가 작업 중
 *      버렸던 cmo3 원본, 스샷, README 등 쓰레기를 서버/브라우저에 싣지 않기
 *      위함).
 *   3. moc3 바이너리 헤더의 매직 넘버("MOC3") 를 확인해서 확장자만 바꾼 악성 파일
 *      스푸핑을 조기 차단.
 *   4. 참조된 파일들을 전부 Blob 으로 만들고 `URL.createObjectURL()` 로 URL 을
 *      받아와 model3.json 내부의 상대경로를 blob URL 로 재작성한다. 그 뒤
 *      재작성된 model3.json 자체도 blob URL 로 노출하면 Live2DModel.from() 이
 *      평소처럼 fetch 로 접근 가능.
 */

export const MODEL_PACKAGE_LIMITS = {
  MAX_TOTAL_MB: 80,
  MAX_MOC3_MB: 15,
  MAX_TEXTURE_MB: 16,
  MAX_TEXTURE_COUNT: 8,
  MAX_EXPRESSION_COUNT: 64,
  MAX_MOTION_COUNT: 256,
} as const;

export const ALLOWED_EXTENSIONS = new Set([
  ".json",
  ".moc3",
  ".png",
  ".wav",
  ".mp3",
  ".ogg",
  ".m4a",
]);

const IGNORED_FILENAME_PATTERNS = [
  /(^|\/)__MACOSX(\/|$)/i,
  /(^|\/)\.DS_Store$/i,
  /(^|\/)Thumbs\.db$/i,
  /(^|\/)desktop\.ini$/i,
  /\.cmo3$/i,
  /\.psd$/i,
];

/**
 * model3.json 스키마 중 우리가 실제로 참조하는 필드만 발췌.
 * (부분 타입이므로 알 수 없는 필드가 있어도 무시)
 */
interface Model3JsonLike {
  Version?: number;
  FileReferences: {
    Moc: string;
    Textures: string[];
    Physics?: string;
    Pose?: string;
    DisplayInfo?: string;
    UserData?: string;
    Expressions?: { Name: string; File: string }[];
    Motions?: Record<string, { File: string; Sound?: string }[]>;
  };
  Groups?: unknown;
  HitAreas?: { Id: string; Name?: string }[];
}

export interface ValidationIssue {
  level: "error" | "warning";
  message: string;
}

export interface ModelPackageAnalysis {
  ok: boolean;
  issues: ValidationIssue[];

  /** 루트 폴더 이름 (ZIP 내부 최상위 디렉터리). */
  rootDir: string | null;
  /** ZIP 내부 model3.json 의 경로 (루트 기준). */
  modelJsonPath: string | null;

  /** 원본 model3.json 내용 (참조 분석용). */
  model3: Model3JsonLike | null;

  /** 찾아낸 모델의 hit area 목록. */
  hitAreas: { id: string; name: string }[];
  expressions: { name: string; file: string }[];
  motions: { group: string; index: number; file: string }[];
  /** pose3.json 의 Groups[].Ids 를 평탄화한 파츠 id 목록. */
  poseParts: { groupIndex: number; id: string }[];
  /** cdi3.json 의 파라미터 표시명. */
  displayParams: { id: string; name: string; groupId?: string }[];
  textures: string[];

  /** 참조된 모든 파일을 합친 byte. */
  totalReferencedBytes: number;
  /** 참조되지 않아서 버린 파일 갯수. */
  discardedFileCount: number;
}

export interface InstalledModelPackage extends ModelPackageAnalysis {
  /** 최종 Live2DModel.from() 에 넘길 URL (model3.json 의 blob URL). */
  modelUrl: string;
  /** revokeObjectURL 을 위해 모아둔 전체 blob URL 리스트. */
  blobUrls: string[];
}

// ───────────────────────────────────────────────────────────────────────────

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

function joinPath(base: string, rel: string): string {
  if (!base) return rel;
  // rel 이 `../` 를 포함할 수도 있으므로 간단 normalize
  const parts = (base + "/" + rel).split("/");
  const stack: string[] = [];
  for (const p of parts) {
    if (!p || p === ".") continue;
    if (p === "..") stack.pop();
    else stack.push(p);
  }
  return stack.join("/");
}

function dirOf(path: string): string {
  const i = path.lastIndexOf("/");
  return i >= 0 ? path.slice(0, i) : "";
}

async function readMagicBytes(buf: ArrayBuffer, len: number): Promise<string> {
  const view = new Uint8Array(buf.slice(0, len));
  return String.fromCharCode(...view);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("FileReader 가 문자열을 반환하지 않았습니다."));
    };
    reader.onerror = () => reject(reader.error ?? new Error("FileReader 오류"));
    reader.readAsDataURL(blob);
  });
}

// ───────────────────────────────────────────────────────────────────────────

/**
 * ZIP 을 받아서 검증 + 설치. 실패 시에도 `ok=false` 로 `ModelPackageAnalysis` 를
 * 반환해 UI 에서 상세 오류를 보여줄 수 있도록 한다.
 *
 * 성공 시 호출자는 반환된 `modelUrl` 로 Live2DModel.from() 을 호출할 수 있고,
 * 언로드 시 `blobUrls` 전체를 revokeObjectURL 해야 한다.
 */
export async function installModelFromZip(
  file: File
): Promise<InstalledModelPackage | ModelPackageAnalysis> {
  const issues: ValidationIssue[] = [];

  // -- Size guard
  if (file.size > MODEL_PACKAGE_LIMITS.MAX_TOTAL_MB * 1024 * 1024) {
    return emptyAnalysis([
      {
        level: "error",
        message: `ZIP 크기가 ${MODEL_PACKAGE_LIMITS.MAX_TOTAL_MB}MB 제한을 초과했습니다.`,
      },
    ]);
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(file);
  } catch (e) {
    return emptyAnalysis([
      {
        level: "error",
        message: `ZIP 압축을 해제할 수 없습니다: ${
          e instanceof Error ? e.message : String(e)
        }`,
      },
    ]);
  }

  // -- 1단계: 유효 파일 수집
  const allPaths: string[] = [];
  zip.forEach((relPath, entry) => {
    if (entry.dir) return;
    if (shouldIgnore(relPath)) return;
    allPaths.push(relPath);
  });

  if (allPaths.length === 0) {
    return emptyAnalysis([{ level: "error", message: "ZIP 이 비어있습니다." }]);
  }

  const root = commonRoot(allPaths) ?? "";
  const stripRoot = (p: string) => (root && p.startsWith(root + "/") ? p.slice(root.length + 1) : p);

  // -- 2단계: model3.json 엔트리 찾기
  const modelJsonCandidates = allPaths.filter((p) => /\.model3\.json$/i.test(p));
  if (modelJsonCandidates.length === 0) {
    return emptyAnalysis([
      { level: "error", message: "`*.model3.json` 매니페스트가 없습니다." },
    ]);
  }
  if (modelJsonCandidates.length > 1) {
    return emptyAnalysis([
      {
        level: "error",
        message: `model3.json 이 여러 개 발견되었습니다(${modelJsonCandidates.length}개). 한 ZIP 에 한 모델만 넣어주세요.`,
      },
    ]);
  }

  const modelJsonPath = modelJsonCandidates[0];
  const modelJsonDir = dirOf(stripRoot(modelJsonPath));
  const modelJsonText = await zip.file(modelJsonPath)!.async("string");

  let model3: Model3JsonLike;
  try {
    model3 = JSON.parse(modelJsonText);
  } catch (e) {
    return emptyAnalysis([
      {
        level: "error",
        message: `model3.json 이 유효한 JSON 이 아닙니다: ${
          e instanceof Error ? e.message : String(e)
        }`,
      },
    ]);
  }
  if (!model3.FileReferences?.Moc) {
    return emptyAnalysis([
      { level: "error", message: "FileReferences.Moc 이 없습니다." },
    ]);
  }

  // -- 3단계: 참조 그래프 구성
  // (모두 "루트 제외 상대경로" 기준으로 통일)
  const resolveRef = (rel: string) => joinPath(modelJsonDir, rel);

  const requiredRefs = new Set<string>();
  const refKinds = new Map<
    string,
    "moc3" | "texture" | "physics" | "pose" | "displayinfo" | "userdata" | "expression" | "motion" | "sound"
  >();

  const addRef = (
    p: string,
    kind:
      | "moc3"
      | "texture"
      | "physics"
      | "pose"
      | "displayinfo"
      | "userdata"
      | "expression"
      | "motion"
      | "sound"
  ) => {
    requiredRefs.add(p);
    refKinds.set(p, kind);
  };

  addRef(resolveRef(model3.FileReferences.Moc), "moc3");
  for (const t of model3.FileReferences.Textures ?? []) addRef(resolveRef(t), "texture");
  if (model3.FileReferences.Physics) addRef(resolveRef(model3.FileReferences.Physics), "physics");
  if (model3.FileReferences.Pose) addRef(resolveRef(model3.FileReferences.Pose), "pose");
  if (model3.FileReferences.DisplayInfo)
    addRef(resolveRef(model3.FileReferences.DisplayInfo), "displayinfo");
  if (model3.FileReferences.UserData)
    addRef(resolveRef(model3.FileReferences.UserData), "userdata");

  const expressions = (model3.FileReferences.Expressions ?? []).slice(
    0,
    MODEL_PACKAGE_LIMITS.MAX_EXPRESSION_COUNT
  );
  for (const exp of expressions) addRef(resolveRef(exp.File), "expression");

  let motionCount = 0;
  const motionRefs: { group: string; index: number; file: string }[] = [];
  for (const [group, entries] of Object.entries(model3.FileReferences.Motions ?? {})) {
    entries.forEach((m, i) => {
      if (motionCount >= MODEL_PACKAGE_LIMITS.MAX_MOTION_COUNT) return;
      addRef(resolveRef(m.File), "motion");
      if (m.Sound) addRef(resolveRef(m.Sound), "sound");
      motionRefs.push({ group, index: i, file: m.File });
      motionCount++;
    });
  }

  // -- 4단계: 참조 파일 존재 확인 & 확장자/크기 검증
  const referencedFiles = new Map<string, JSZip.JSZipObject>();
  for (const refPath of requiredRefs) {
    const zipPath = root ? `${root}/${refPath}` : refPath;
    const entry = zip.file(zipPath);
    if (!entry) {
      issues.push({
        level: "error",
        message: `참조된 파일을 찾을 수 없음: ${refPath}`,
      });
      continue;
    }
    const ext = extOf(refPath);
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      issues.push({
        level: "error",
        message: `허용되지 않은 확장자: ${refPath}`,
      });
      continue;
    }
    referencedFiles.set(refPath, entry);
  }

  if (referencedFiles.size === 0) {
    return {
      ...emptyAnalysis(issues),
      rootDir: root,
      modelJsonPath: stripRoot(modelJsonPath),
      model3,
    };
  }

  // 텍스처 개수 체크
  const textures = model3.FileReferences.Textures ?? [];
  if (textures.length > MODEL_PACKAGE_LIMITS.MAX_TEXTURE_COUNT) {
    issues.push({
      level: "error",
      message: `텍스처가 ${MODEL_PACKAGE_LIMITS.MAX_TEXTURE_COUNT} 개 제한을 초과했습니다(${textures.length}).`,
    });
  }

  // -- 5단계: 실제 바이너리 추출 & magic 검증
  const blobs = new Map<string, Blob>();
  let totalReferencedBytes = 0;

  for (const [refPath, entry] of referencedFiles) {
    const kind = refKinds.get(refPath)!;
    const ext = extOf(refPath);
    const isBinary = ext !== ".json";
    const buf = await entry.async("arraybuffer");

    // 크기 상한
    if (kind === "moc3" && buf.byteLength > MODEL_PACKAGE_LIMITS.MAX_MOC3_MB * 1024 * 1024) {
      issues.push({
        level: "error",
        message: `moc3 가 ${MODEL_PACKAGE_LIMITS.MAX_MOC3_MB}MB 를 초과합니다.`,
      });
    }
    if (kind === "texture" && buf.byteLength > MODEL_PACKAGE_LIMITS.MAX_TEXTURE_MB * 1024 * 1024) {
      issues.push({
        level: "warning",
        message: `텍스처 ${refPath} 가 ${MODEL_PACKAGE_LIMITS.MAX_TEXTURE_MB}MB 를 초과합니다(성능 저하 가능).`,
      });
    }

    // magic number 검사
    if (kind === "moc3") {
      const magic = await readMagicBytes(buf, 4);
      if (magic !== "MOC3") {
        issues.push({
          level: "error",
          message: `moc3 파일 헤더가 올바르지 않습니다(magic="${magic}").`,
        });
      }
    } else if (kind === "texture" && ext === ".png") {
      const head = new Uint8Array(buf.slice(0, 4));
      const isPng = head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47;
      if (!isPng) {
        issues.push({
          level: "error",
          message: `PNG 텍스처 헤더가 올바르지 않음: ${refPath}`,
        });
      }
    }

    totalReferencedBytes += buf.byteLength;

    const mime =
      ext === ".png"
        ? "image/png"
        : ext === ".json"
          ? "application/json"
          : ext === ".wav"
            ? "audio/wav"
            : ext === ".mp3"
              ? "audio/mpeg"
              : ext === ".ogg"
                ? "audio/ogg"
                : ext === ".m4a"
                  ? "audio/mp4"
                  : "application/octet-stream";

    blobs.set(refPath, new Blob([buf], { type: mime }));
    void isBinary;
  }

  const hasError = issues.some((i) => i.level === "error");

  // 추가 분석 정보 (UI 노출용)
  const hitAreas = (model3.HitAreas ?? []).map((h) => ({ id: h.Id, name: h.Name ?? h.Id }));

  let poseParts: { groupIndex: number; id: string }[] = [];
  if (model3.FileReferences.Pose) {
    const posePath = resolveRef(model3.FileReferences.Pose);
    const poseBlob = blobs.get(posePath);
    if (poseBlob) {
      try {
        const poseJson = JSON.parse(await poseBlob.text());
        const groups: { Id: string }[][] = poseJson.Groups ?? [];
        poseParts = groups.flatMap((grp, gi) => grp.map((p) => ({ groupIndex: gi, id: p.Id })));
      } catch {
        /* ignore */
      }
    }
  }

  let displayParams: { id: string; name: string; groupId?: string }[] = [];
  if (model3.FileReferences.DisplayInfo) {
    const cdiPath = resolveRef(model3.FileReferences.DisplayInfo);
    const cdiBlob = blobs.get(cdiPath);
    if (cdiBlob) {
      try {
        const cdi = JSON.parse(await cdiBlob.text());
        const params: { Id: string; Name?: string; GroupId?: string }[] = cdi.Parameters ?? [];
        displayParams = params.map((p) => ({
          id: p.Id,
          name: p.Name ?? p.Id,
          groupId: p.GroupId,
        }));
      } catch {
        /* ignore */
      }
    }
  }

  const discarded = allPaths.length - referencedFiles.size - 1;
  const issuesWithDiscarded: ValidationIssue[] = [...issues];
  if (discarded > 0) {
    issuesWithDiscarded.push({
      level: "warning",
      message: `${discarded} 개의 파일은 model3.json 이 참조하지 않아 무시되었습니다.`,
    });
  }

  const analysis: ModelPackageAnalysis = {
    ok: !hasError,
    issues: issuesWithDiscarded,
    rootDir: root,
    modelJsonPath: stripRoot(modelJsonPath),
    model3,
    hitAreas,
    expressions: expressions.map((e) => ({ name: e.Name, file: e.File })),
    motions: motionRefs,
    poseParts,
    displayParams,
    textures: [...textures],
    totalReferencedBytes,
    discardedFileCount: discarded,
  };

  if (hasError) return analysis;

  // -- 6단계: 리소스 URL 매핑 테이블 구축.
  //
  // 중요: Pixi v8 의 `Assets.load(url)` 은 URL 확장자/쿼리로 파일 포맷을 추정한다.
  //       `blob:http://.../<uuid>` 는 확장자가 없어서 PNG 파서를 못 타고 null 을
  //       돌려주며, 그 결과 `Live2DModel._onRenderCallback` 이 `textures[i]` 를
  //       null 로 읽어 매 프레임 `Cannot read properties of null (reading 'source')`
  //       를 뱉어낸다. 한 번 터지면 ticker 루프가 계속 터져서 다른 모델로 전환해도
  //       복구되지 않는다.
  //
  // 해결: 텍스처(PNG)는 blob URL 대신 `data:image/png;base64,...` 데이터 URL 로
  //       변환한다. 데이터 URL 은 MIME 타입이 URL 안에 명시되어 있어 Pixi 가
  //       확장자 없이도 곧바로 이미지로 인식한다. moc3/json/audio 는 blob URL 그대로.
  const urlByRefPath = new Map<string, string>();
  const blobUrls: string[] = [];
  for (const [refPath, blob] of blobs) {
    const ext = extOf(refPath);
    let url: string;
    if (ext === ".png") {
      url = await blobToDataUrl(blob);
      // 데이터 URL 은 revoke 대상 아님 (GC 로 처리). blobUrls 에는 넣지 않는다.
    } else {
      url = URL.createObjectURL(blob);
      blobUrls.push(url);
    }
    urlByRefPath.set(refPath, url);
  }

  // -- 7단계: model3.json 재작성 (상대경로 → blob URL)
  const rewritten = rewriteModel3Json(model3, modelJsonDir, urlByRefPath);
  const modelJsonBlob = new Blob([JSON.stringify(rewritten)], { type: "application/json" });
  const modelUrl = URL.createObjectURL(modelJsonBlob);
  blobUrls.push(modelUrl);

  return {
    ...analysis,
    modelUrl,
    blobUrls,
  };
}

function rewriteModel3Json(
  src: Model3JsonLike,
  modelJsonDir: string,
  urlByRefPath: Map<string, string>
): Model3JsonLike {
  const resolve = (rel: string) => {
    const resolved = joinPath(modelJsonDir, rel);
    return urlByRefPath.get(resolved) ?? rel;
  };

  const out: Model3JsonLike = {
    ...src,
    FileReferences: {
      ...src.FileReferences,
      Moc: resolve(src.FileReferences.Moc),
      Textures: (src.FileReferences.Textures ?? []).map(resolve),
    },
  };

  if (src.FileReferences.Physics) out.FileReferences.Physics = resolve(src.FileReferences.Physics);
  if (src.FileReferences.Pose) out.FileReferences.Pose = resolve(src.FileReferences.Pose);
  if (src.FileReferences.DisplayInfo)
    out.FileReferences.DisplayInfo = resolve(src.FileReferences.DisplayInfo);
  if (src.FileReferences.UserData)
    out.FileReferences.UserData = resolve(src.FileReferences.UserData);

  if (src.FileReferences.Expressions) {
    out.FileReferences.Expressions = src.FileReferences.Expressions.map((e) => ({
      ...e,
      File: resolve(e.File),
    }));
  }
  if (src.FileReferences.Motions) {
    const m: Record<string, { File: string; Sound?: string }[]> = {};
    for (const [g, arr] of Object.entries(src.FileReferences.Motions)) {
      m[g] = arr.map((entry) => ({
        ...entry,
        File: resolve(entry.File),
        ...(entry.Sound ? { Sound: resolve(entry.Sound) } : {}),
      }));
    }
    out.FileReferences.Motions = m;
  }

  return out;
}

function emptyAnalysis(issues: ValidationIssue[]): ModelPackageAnalysis {
  return {
    ok: false,
    issues,
    rootDir: null,
    modelJsonPath: null,
    model3: null,
    hitAreas: [],
    expressions: [],
    motions: [],
    poseParts: [],
    displayParams: [],
    textures: [],
    totalReferencedBytes: 0,
    discardedFileCount: 0,
  };
}

export function isInstalled(
  r: ModelPackageAnalysis | InstalledModelPackage
): r is InstalledModelPackage {
  return (r as InstalledModelPackage).modelUrl != null;
}
