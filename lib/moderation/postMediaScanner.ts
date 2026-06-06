import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

type PostMediaAssetRow = {
  id: string;
  created_at: string;
  bucket_id: string;
  object_path: string;
  attached_post_id: string | null;
  original_name: string | null;
  mime_type: string;
  size_bytes: number;
  source: string;
};

type PostContext = {
  title: string | null;
  content: string | null;
  boardIsNsfw: boolean;
};

type ModerationResult = {
  flagged?: boolean;
  categories?: Record<string, boolean>;
  category_scores?: Record<string, number>;
  category_applied_input_types?: Record<string, string[]>;
};

type MinorVisionRisk = {
  minorSexualRisk?: "none" | "ambiguous" | "high";
  minorAppearsUnder18?: boolean | "unknown";
  adultNsfwLevel?: "none" | "suggestive" | "explicit";
  confidence?: number;
  reasons?: string[];
};

type ScanDecision = {
  scanStatus: "approved" | "rejected" | "needs_review";
  riskLevel: "safe" | "low" | "medium" | "high" | "blocked";
  reason: string | null;
};

export type PostMediaScanResult = {
  id: string;
  scanStatus: ScanDecision["scanStatus"];
  riskLevel: ScanDecision["riskLevel"];
  reason: string | null;
};

const PUBLIC_POST_ASSETS_BUCKET = "post-assets";
const OPENAI_MODERATION_MODEL = "omni-moderation-latest";

const MINOR_KEYWORDS = [
  "미성년",
  "아청",
  "아동",
  "초등학생",
  "중학생",
  "고등학생",
  "교복",
  "로리",
  "쇼타",
  "loli",
  "shota",
  "minor",
  "underage",
  "teen",
  "schoolgirl",
  "schoolboy",
];

const SEXUAL_KEYWORDS = [
  "야짤",
  "누드",
  "나체",
  "성적",
  "섹스",
  "성행위",
  "가슴",
  "팬티",
  "속옷",
  "fetish",
  "nude",
  "naked",
  "sex",
  "sexual",
  "explicit",
  "porn",
  "lingerie",
];

export async function scanPendingPostMediaAssets(params: {
  supabase: SupabaseClient;
  openaiApiKey: string;
  limit: number;
}): Promise<{ processed: PostMediaScanResult[]; skipped: number }> {
  const { supabase, openaiApiKey, limit } = params;
  const { data, error } = await supabase
    .from("post_media_assets")
    .select("id, created_at, bucket_id, object_path, attached_post_id, original_name, mime_type, size_bytes, source")
    .eq("scan_status", "pending")
    .not("attached_post_id", "is", null)
    .order("created_at", { ascending: true })
    .limit(Math.max(1, Math.min(limit, 25)));

  if (error) throw error;

  const processed: PostMediaScanResult[] = [];
  let skipped = 0;

  for (const row of (data ?? []) as PostMediaAssetRow[]) {
    const claimed = await claimAssetForScan(supabase, row.id);
    if (!claimed) {
      skipped += 1;
      continue;
    }

    try {
      processed.push(await scanPostMediaAsset({ supabase, openaiApiKey, row }));
    } catch (error) {
      await supabase
        .from("post_media_assets")
        .update({
          scan_status: "pending",
          risk_level: "unknown",
          moderation_labels: {
            scanner: "post-media-openai-v1",
            error: error instanceof Error ? error.message : "scan failed",
            failedAt: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      processed.push({
        id: row.id,
        scanStatus: "needs_review",
        riskLevel: "medium",
        reason: error instanceof Error ? error.message : "scan failed",
      });
    }
  }

  return { processed, skipped };
}

export async function scanPostMediaAssetsByIds(params: {
  supabase: SupabaseClient;
  openaiApiKey: string;
  assetIds: string[];
  userId: string;
}): Promise<{ processed: PostMediaScanResult[]; skipped: number }> {
  const { supabase, openaiApiKey, assetIds, userId } = params;
  const ids = Array.from(new Set(assetIds)).filter((id) => /^[0-9a-f-]{36}$/i.test(id));
  if (ids.length === 0) return { processed: [], skipped: 0 };

  const { data, error } = await supabase
    .from("post_media_assets")
    .select("id, created_at, bucket_id, object_path, attached_post_id, original_name, mime_type, size_bytes, source")
    .in("id", ids)
    .eq("uploaded_by", userId)
    .eq("scan_status", "pending")
    .not("attached_post_id", "is", null)
    .limit(25);

  if (error) throw error;

  const rows = (data ?? []) as PostMediaAssetRow[];
  const processed: PostMediaScanResult[] = [];
  let skipped = ids.length - rows.length;

  for (const row of rows) {
    const claimed = await claimAssetForScan(supabase, row.id);
    if (!claimed) {
      skipped += 1;
      continue;
    }
    try {
      processed.push(await scanPostMediaAsset({ supabase, openaiApiKey, row }));
    } catch (error) {
      await supabase
        .from("post_media_assets")
        .update({
          scan_status: "pending",
          risk_level: "unknown",
          moderation_labels: {
            scanner: "post-media-openai-v1",
            error: error instanceof Error ? error.message : "scan failed",
            failedAt: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      processed.push({
        id: row.id,
        scanStatus: "needs_review",
        riskLevel: "medium",
        reason: error instanceof Error ? error.message : "scan failed",
      });
    }
  }

  return { processed, skipped };
}

async function claimAssetForScan(supabase: SupabaseClient, id: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("post_media_assets")
    .update({ scan_status: "scanning", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("scan_status", "pending")
    .select("id")
    .maybeSingle();

  if (error) throw error;
  return Boolean(data?.id);
}

async function scanPostMediaAsset(params: {
  supabase: SupabaseClient;
  openaiApiKey: string;
  row: PostMediaAssetRow;
}): Promise<PostMediaScanResult> {
  const { supabase, openaiApiKey, row } = params;
  const { data: blob, error: downloadError } = await supabase.storage
    .from(row.bucket_id)
    .download(row.object_path);

  if (downloadError || !blob) throw downloadError ?? new Error("이미지를 다운로드하지 못했습니다.");

  const imageBuffer = Buffer.from(await blob.arrayBuffer());
  const imageSha256 = createHash("sha256").update(imageBuffer).digest("hex");
  const blockedHash = await findBlockedMediaHash(supabase, imageSha256);
  if (blockedHash) {
    return rejectBlockedHash({ supabase, row, imageSha256, blockedHash });
  }

  const dataUrl = `data:${row.mime_type};base64,${imageBuffer.toString("base64")}`;
  const postContext = await loadPostContext(supabase, row.attached_post_id);
  const textForModeration = buildTextForModeration(row, postContext);

  const [moderation, minorVisionRisk] = await Promise.all([
    runOpenAiModeration(openaiApiKey, dataUrl, textForModeration),
    runMinorVisionClassifier(openaiApiKey, dataUrl, textForModeration),
  ]);

  const textMinorRisk = classifyTextMinorRisk(textForModeration);
  const decision = decidePostMediaStatus({
    moderation,
    minorVisionRisk,
    textMinorRisk,
    boardIsNsfw: postContext.boardIsNsfw,
  });
  const publicUrl = decision.scanStatus === "approved"
    ? await promoteApprovedAsset(supabase, row, blob)
    : null;

  const now = new Date().toISOString();
  const moderationLabels = {
    scanner: "post-media-openai-v1",
    imageSha256,
    checkedAt: now,
    policy: {
      nsfw: "lenient",
      minorSexualRisk: "conservative",
    },
    boardIsNsfw: postContext.boardIsNsfw,
    textMinorRisk,
    decision,
    openaiModeration: {
      model: OPENAI_MODERATION_MODEL,
      flagged: moderation.flagged ?? false,
      categories: moderation.categories ?? {},
      categoryScores: moderation.category_scores ?? {},
      appliedInputTypes: moderation.category_applied_input_types ?? {},
    },
    minorVisionRisk,
  };

  const { error: updateError } = await supabase
    .from("post_media_assets")
    .update({
      scan_status: decision.scanStatus,
      risk_level: decision.riskLevel,
      public_url: publicUrl,
      rejected_reason: decision.scanStatus === "rejected" ? decision.reason : null,
      moderation_labels: moderationLabels,
      reviewed_at: decision.scanStatus === "needs_review" ? null : now,
      updated_at: now,
    })
    .eq("id", row.id);

  if (updateError) throw updateError;

  if (decision.scanStatus === "rejected" && decision.riskLevel === "blocked") {
    await registerBlockedMediaHash({
      supabase,
      sha256: imageSha256,
      row,
      reason: decision.reason ?? "자동 차단된 이미지입니다.",
      moderationLabels,
    });
  }

  return {
    id: row.id,
    scanStatus: decision.scanStatus,
    riskLevel: decision.riskLevel,
    reason: decision.reason,
  };
}

async function findBlockedMediaHash(
  supabase: SupabaseClient,
  sha256: string,
): Promise<{ sha256: string; reason: string } | null> {
  const { data, error } = await supabase
    .from("blocked_media_hashes")
    .select("sha256, reason")
    .eq("sha256", sha256)
    .maybeSingle();

  if (error) throw error;
  return data as { sha256: string; reason: string } | null;
}

async function rejectBlockedHash(params: {
  supabase: SupabaseClient;
  row: PostMediaAssetRow;
  imageSha256: string;
  blockedHash: { sha256: string; reason: string };
}): Promise<PostMediaScanResult> {
  const { supabase, row, imageSha256, blockedHash } = params;
  const now = new Date().toISOString();
  const reason = blockedHash.reason || "차단된 이미지 해시와 일치하여 자동 차단되었습니다.";
  const hashFilterMessage = `[해시 필터링] 이미 차단된 이미지와 동일한 해시입니다. ${reason}`;
  const { error } = await supabase
    .from("post_media_assets")
    .update({
      scan_status: "rejected",
      risk_level: "blocked",
      public_url: null,
      rejected_reason: reason,
      moderation_labels: {
        scanner: "post-media-hash-v1",
        imageSha256,
        checkedAt: now,
        hashFilterMessage,
        decision: {
          scanStatus: "rejected",
          riskLevel: "blocked",
          reason,
        },
        blockedHashMatch: true,
      },
      reviewed_at: now,
      updated_at: now,
    })
    .eq("id", row.id);

  if (error) throw error;
  return {
    id: row.id,
    scanStatus: "rejected",
    riskLevel: "blocked",
    reason: hashFilterMessage,
  };
}

async function registerBlockedMediaHash(params: {
  supabase: SupabaseClient;
  sha256: string;
  row: PostMediaAssetRow;
  reason: string;
  moderationLabels: Record<string, unknown>;
}): Promise<void> {
  const { supabase, sha256, row, reason, moderationLabels } = params;
  const { error } = await supabase
    .from("blocked_media_hashes")
    .upsert({
      sha256,
      source_asset_id: row.id,
      reason,
      metadata: {
        scanner: "post-media-openai-v1",
        source: row.source,
        mimeType: row.mime_type,
        sizeBytes: row.size_bytes,
        moderationLabels,
      },
    }, { onConflict: "sha256" });

  if (error) throw error;
}

async function loadPostContext(supabase: SupabaseClient, postId: string | null): Promise<PostContext> {
  if (!postId) return { title: null, content: null, boardIsNsfw: false };

  const { data } = await supabase
    .from("posts")
    .select("title, content, boards(is_nsfw)")
    .eq("id", postId)
    .maybeSingle();

  const row = data as { title?: string | null; content?: string | null; boards?: { is_nsfw?: boolean | null } | null } | null;
  return {
    title: row?.title ?? null,
    content: row?.content ?? null,
    boardIsNsfw: Boolean(row?.boards?.is_nsfw),
  };
}

function buildTextForModeration(row: PostMediaAssetRow, postContext: PostContext): string {
  return [
    postContext.title ? `title: ${postContext.title}` : "",
    postContext.content ? `content: ${postContext.content.slice(0, 3000)}` : "",
    row.original_name ? `filename: ${row.original_name}` : "",
    `source: ${row.source}`,
  ].filter(Boolean).join("\n");
}

async function runOpenAiModeration(
  openaiApiKey: string,
  imageDataUrl: string,
  text: string,
): Promise<ModerationResult> {
  const input: Array<Record<string, unknown>> = [
    { type: "image_url", image_url: { url: imageDataUrl } },
  ];
  if (text.trim()) {
    input.push({ type: "text", text });
  }

  const response = await fetch("https://api.openai.com/v1/moderations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openaiApiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODERATION_MODEL,
      input,
    }),
  });

  if (!response.ok) {
    const raw = await response.text();
    throw new Error(`OpenAI moderation failed: ${response.status} ${raw.slice(0, 200)}`);
  }

  const json = await response.json() as { results?: ModerationResult[] };
  return json.results?.[0] ?? {};
}

async function runMinorVisionClassifier(
  openaiApiKey: string,
  imageDataUrl: string,
  text: string,
): Promise<MinorVisionRisk> {
  const prompt = [
    "You are a safety classifier for an image upload pipeline.",
    "Return JSON only.",
    "Classify sexual content involving minors conservatively.",
    "Do not be overly conservative for adult NSFW: adult swimwear, cleavage, pin-up, lingerie, or covered erotic fan art should not become minor risk unless there are childlike, school-age, underage, loli/shota, or minor-coded indicators.",
    "For adultNsfwLevel, use suggestive for swimwear, underwear, cleavage, covered breasts, or erotic posing without explicit nudity. Use explicit for visible genitals, anus, bare nipples/breasts, or sex acts.",
    "If the image is sexualized and the person/character appears under 18, childlike, school-age, or ambiguous-underage, set minorSexualRisk to high or ambiguous.",
    "If it is clearly adult-only sexual content, set adultNsfwLevel but minorSexualRisk should be none.",
    "Schema: {\"minorSexualRisk\":\"none|ambiguous|high\",\"minorAppearsUnder18\":true|false|\"unknown\",\"adultNsfwLevel\":\"none|suggestive|explicit\",\"confidence\":0.0,\"reasons\":[\"short reason\"]}.",
    text ? `Related post text:\n${text.slice(0, 2500)}` : "",
  ].filter(Boolean).join("\n\n");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openaiApiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_VISION_MODERATION_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: imageDataUrl, detail: "low" } },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const raw = await response.text();
    throw new Error(`OpenAI vision moderation failed: ${response.status} ${raw.slice(0, 200)}`);
  }

  const json = await response.json() as { choices?: Array<{ message?: { content?: string | null } }> };
  const content = json.choices?.[0]?.message?.content ?? "{}";
  try {
    return JSON.parse(content) as MinorVisionRisk;
  } catch {
    return { minorSexualRisk: "ambiguous", minorAppearsUnder18: "unknown", adultNsfwLevel: "none", confidence: 0, reasons: ["invalid classifier json"] };
  }
}

function classifyTextMinorRisk(text: string): "none" | "minor_keyword" | "sexual_minor_keyword" {
  const normalized = text.toLowerCase();
  const hasMinorKeyword = MINOR_KEYWORDS.some((keyword) => normalized.includes(keyword.toLowerCase()));
  if (!hasMinorKeyword) return "none";
  const hasSexualKeyword = SEXUAL_KEYWORDS.some((keyword) => normalized.includes(keyword.toLowerCase()));
  return hasSexualKeyword ? "sexual_minor_keyword" : "minor_keyword";
}

function decidePostMediaStatus(params: {
  moderation: ModerationResult;
  minorVisionRisk: MinorVisionRisk;
  textMinorRisk: "none" | "minor_keyword" | "sexual_minor_keyword";
  boardIsNsfw: boolean;
}): ScanDecision {
  const { moderation, minorVisionRisk, textMinorRisk, boardIsNsfw } = params;
  const categories = moderation.categories ?? {};
  const scores = moderation.category_scores ?? {};
  const sexualScore = Number(scores.sexual ?? 0);
  const sexualMinorScore = Number(scores["sexual/minors"] ?? 0);
  const graphicViolenceScore = Number(scores["violence/graphic"] ?? 0);
  const selfHarmScore = Math.max(
    Number(scores["self-harm"] ?? 0),
    Number(scores["self-harm/intent"] ?? 0),
    Number(scores["self-harm/instructions"] ?? 0),
  );

  if (
    categories["sexual/minors"] ||
    sexualMinorScore >= 0.01 ||
    textMinorRisk === "sexual_minor_keyword" ||
    minorVisionRisk.minorSexualRisk === "high"
  ) {
    return {
      scanStatus: "rejected",
      riskLevel: "blocked",
      reason: "미성년자 성적 콘텐츠 위험 신호가 감지되어 자동 차단되었습니다.",
    };
  }

  if (minorVisionRisk.minorSexualRisk === "ambiguous" || textMinorRisk === "minor_keyword") {
    return {
      scanStatus: "needs_review",
      riskLevel: "high",
      reason: "미성년자/연령 불명 위험 신호가 있어 예외 검수가 필요합니다.",
    };
  }

  if (graphicViolenceScore >= 0.9 || selfHarmScore >= 0.85) {
    return {
      scanStatus: "needs_review",
      riskLevel: "medium",
      reason: "고위험 이미지 정책 검토가 필요합니다.",
    };
  }

  if (minorVisionRisk.adultNsfwLevel === "explicit") {
    return {
      scanStatus: "rejected",
      riskLevel: "blocked",
      reason: "명시적 성인 누드/성행위 이미지로 분류되어 자동 차단되었습니다.",
    };
  }

  if (!boardIsNsfw && sexualScore >= 0.9) {
    return {
      scanStatus: "approved",
      riskLevel: "medium",
      reason: "선정적 성인 이미지 가능성이 있으나 명시적 누드 기준에는 해당하지 않아 자동 통과되었습니다.",
    };
  }

  if (!boardIsNsfw && sexualScore >= 0.72) {
    return {
      scanStatus: "approved",
      riskLevel: "low",
      reason: "성인/선정성 점수가 있으나 자동 차단 기준에는 미달합니다.",
    };
  }

  return {
    scanStatus: "approved",
    riskLevel: sexualScore >= 0.72 || minorVisionRisk.adultNsfwLevel === "suggestive" ? "low" : "safe",
    reason: null,
  };
}

async function promoteApprovedAsset(
  supabase: SupabaseClient,
  row: PostMediaAssetRow,
  blob: Blob,
): Promise<string> {
  const publicPath = `approved/${row.id}.${publicExtension(row)}`;
  const { error: uploadError } = await supabase.storage
    .from(PUBLIC_POST_ASSETS_BUCKET)
    .upload(publicPath, blob, { contentType: row.mime_type, upsert: true });
  if (uploadError) throw uploadError;

  const {
    data: { publicUrl },
  } = supabase.storage.from(PUBLIC_POST_ASSETS_BUCKET).getPublicUrl(publicPath);

  return publicUrl;
}

function publicExtension(row: PostMediaAssetRow): string {
  const fromPath = row.object_path.split(".").pop()?.toLowerCase();
  if (fromPath && /^[a-z0-9]+$/.test(fromPath)) return fromPath;
  if (row.mime_type === "image/png") return "png";
  if (row.mime_type === "image/webp") return "webp";
  if (row.mime_type === "image/gif") return "gif";
  return "jpg";
}
