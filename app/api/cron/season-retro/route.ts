import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { formatCoursShort, getCurrentCours } from "@/lib/otaku/cours";
import {
  coursQuarterStartDate,
  getCoursCalendarPhase,
  parseCours,
} from "@/lib/otaku/coursPhase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 분기 회고 토픽 큐 + (선택) 게시글 자동 생성
 *
 * 환경 변수:
 * - CRON_SECRET: Authorization: Bearer 와 일치해야 함
 * - SUPABASE_SERVICE_ROLE_KEY: 서버 전용 (post·큐 upsert)
 * - SEASON_RETRO_BOARD_SLUG: 회고 글이 올라갈 게시판 slug
 * - SEASON_RETRO_AUTHOR_ID: 글 작성자 profiles.user_id (uuid)
 * - NEXT_PUBLIC_SITE_URL (선택): 본문 링크
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const boardSlug = process.env.SEASON_RETRO_BOARD_SLUG;
  const authorId = process.env.SEASON_RETRO_AUTHOR_ID;

  if (!url || !serviceKey) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY 또는 NEXT_PUBLIC_SUPABASE_URL 없음" },
      { status: 500 },
    );
  }

  if (!boardSlug) {
    return NextResponse.json({ skipped: true, reason: "SEASON_RETRO_BOARD_SLUG 미설정" });
  }

  const admin = createClient(url, serviceKey);
  const now = new Date();

  const { data: board, error: boardError } = await admin
    .from("boards")
    .select("id")
    .eq("slug", boardSlug)
    .maybeSingle();

  if (boardError || !board?.id) {
    return NextResponse.json(
      { error: "게시판을 찾을 수 없습니다.", slug: boardSlug, detail: boardError?.message },
      { status: 404 },
    );
  }

  const boardId = board.id as string;
  const coursList = collectCoursPossiblyInRetro(now);
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");

  const results: Array<{ cours: string; action: string; postId?: string }> = [];

  for (const cours of coursList) {
    if (getCoursCalendarPhase(cours, now) !== "retro") continue;

    const { data: existing } = await admin
      .from("season_retro_topics")
      .select("id, post_id, status")
      .eq("cours", cours)
      .eq("board_id", boardId)
      .maybeSingle();

    if (existing?.post_id) {
      results.push({ cours, action: "already_opened", postId: String(existing.post_id) });
      continue;
    }

    if (!existing) {
      const start = coursQuarterStartDate(cours);
      const scheduledFor = start ?? now;
      const { error: insErr } = await admin.from("season_retro_topics").insert({
        cours,
        board_id: boardId,
        status: "pending",
        scheduled_for: scheduledFor.toISOString(),
        note: "cron_queue",
      });
      if (insErr && insErr.code !== "23505") {
        results.push({ cours, action: "queue_insert_failed", postId: insErr.message });
        continue;
      }
      if (!insErr) {
        results.push({ cours, action: "queued" });
      }
    }

    if (!authorId) {
      results.push({ cours, action: "no_author_skip_post" });
      continue;
    }

    const { data: row } = await admin
      .from("season_retro_topics")
      .select("id, post_id")
      .eq("cours", cours)
      .eq("board_id", boardId)
      .maybeSingle();

    if (!row?.id || row.post_id) continue;

    const title = `[${formatCoursShort(cours)}] 분기 회고`;
    const seasonPath = `/season/${cours.toLowerCase()}`;
    const bodyLines = [
      `${formatCoursShort(cours)} 한 줄 평, 베스트 작품, 아쉬웠던 점을 자유롭게 남겨 주세요.`,
      siteUrl ? `라인업 보기: ${siteUrl}${seasonPath}` : `라인업 경로: ${seasonPath}`,
    ];
    const content = bodyLines.join("\n\n");

    const { data: post, error: postErr } = await admin
      .from("posts")
      .insert({
        board_id: boardId,
        author_id: authorId,
        title,
        content,
        category: "anime",
        status: "NORMAL",
      })
      .select("id")
      .maybeSingle();

    if (postErr || !post?.id) {
      results.push({ cours, action: "post_failed", postId: postErr?.message });
      await admin
        .from("season_retro_topics")
        .update({ status: "failed", note: postErr?.message ?? "post insert failed" })
        .eq("id", row.id);
      continue;
    }

    const openedAt = new Date().toISOString();
    await admin
      .from("season_retro_topics")
      .update({
        post_id: post.id,
        status: "opened",
        opened_at: openedAt,
      })
      .eq("id", row.id);

    results.push({ cours, action: "opened", postId: String(post.id) });
  }

  return NextResponse.json({
    ok: true,
    at: now.toISOString(),
    currentCours: getCurrentCours(now),
    checked: coursList,
    results,
  });
}

function collectCoursPossiblyInRetro(now: Date): string[] {
  const current = getCurrentCours(now);
  const prev = shiftCours(current, -1);
  return Array.from(new Set([current, prev]));
}

function shiftCours(cours: string, deltaQ: number): string {
  const p = parseCours(cours);
  if (!p) return cours;
  let { year, quarter } = p;
  let q = quarter + deltaQ;
  while (q > 4) {
    q -= 4;
    year += 1;
  }
  while (q < 1) {
    q += 4;
    year -= 1;
  }
  return `${year}-Q${q}`;
}
