"use client";

import Link from "next/link";
import { Repeat2 } from "lucide-react";
import type { CommunityPost, PostSharedFrom } from "@/types/community";
import IdentityBadge from "@/components/community/IdentityBadge";

function originAuthorHandle(origin: PostSharedFrom): string {
  return (
    origin.profiles?.handle ||
    origin.profiles?.nickname ||
    origin.author_id?.slice(0, 8) ||
    "익명"
  );
}

interface Props {
  post: CommunityPost;
  /** 접두사 분리 전 원문 머리줄 — 원본 조회 실패 시에만 표시 */
  shareHeaderFallback: string | null;
  /**
   * `unified`: 바깥에서 본문과 같은 박스로 감쌀 때 — 안쪽 중복 보더/위쪽 여백 없음.
   * `standalone`(기본): 기존처럼 단독 카드(내부 보더).
   */
  variant?: "standalone" | "unified";
}

/**
 * 피드에서 게시판 글을 공유한 경우(FEED + origin_post_id): 리포스트 표시 + 원 작성자·원본 링크.
 */
export default function SharedPostOriginCard({
  post,
  shareHeaderFallback,
  variant = "standalone",
}: Props) {
  if (post.source_type !== "FEED" || !post.origin_post_id) return null;

  const origin = post.shared_from;
  const isUnified = variant === "unified";

  if (!origin) {
    return (
      <div className={isUnified ? "space-y-1" : "mt-1.5 space-y-1"}>
        <div className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest text-gray-500">
          <Repeat2 size={14} className="shrink-0" aria-hidden />
          <span>게시판 글 공유</span>
        </div>
        {shareHeaderFallback ? (
          <p className="text-xs text-gray-600">{shareHeaderFallback}</p>
        ) : (
          <p className="text-[11px] text-gray-400">원본 게시글을 불러오지 못했습니다.</p>
        )}
      </div>
    );
  }

  const handle = originAuthorHandle(origin);
  const profileHref = `/user/${encodeURIComponent(handle)}`;
  const boardSlug = origin.boards?.slug;
  const postHref =
    origin.source_type === "BOARD" && boardSlug ? `/board/${boardSlug}/${origin.id}` : null;

  const inner = (
    <>
      <div className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest text-gray-500">
        <Repeat2 size={14} className="shrink-0 text-gray-600" aria-hidden />
        <span>게시판 글 공유</span>
      </div>

      <div className="flex gap-2 pt-1">
        <Link href={profileHref} className="shrink-0 pt-0.5" title="원 작성자 프로필">
          <IdentityBadge
            profile={origin.profiles}
            fallback={{ nickname: handle }}
            size="sm"
            showAvatar={true}
            showName={false}
          />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
            <Link href={profileHref} className="min-w-0 font-semibold text-gray-900 hover:underline">
              <IdentityBadge
                profile={origin.profiles}
                fallback={{ nickname: handle }}
                size="sm"
                showAvatar={false}
                showName={true}
              />
            </Link>
            <span className="text-gray-400">@{handle}</span>
          </div>
          {postHref ? (
            <Link
              href={postHref}
              className="mt-0.5 inline-block text-[11px] text-blue-600 hover:underline"
            >
              원본 글 보기
              {origin.boards?.name ? ` · ${origin.boards.name}` : ""}
            </Link>
          ) : null}
        </div>
      </div>
      {origin.source_type === "BOARD" && origin.title ? (
        <p className="mt-2 border-t border-dashed border-gray-200 pt-2 text-sm font-bold text-gray-900">
          {origin.title}
        </p>
      ) : null}
    </>
  );

  if (isUnified) {
    return <div className="space-y-2">{inner}</div>;
  }

  return (
    <div className="mt-1.5 space-y-2">
      <div className="rounded border border-dashed border-gray-200 bg-gray-50/90 px-3 py-2.5">{inner}</div>
    </div>
  );
}
