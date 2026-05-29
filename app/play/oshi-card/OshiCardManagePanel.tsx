"use client";

import Link from "next/link";
import { Plus, Trash2, Pencil, ExternalLink } from "lucide-react";
import {
  MAX_OWNED_CARDS,
  isPermanentOshiCardShare,
  type OshiCardShare,
} from "@/lib/supabase/oshiCardShares";

type OshiCardManagePanelProps = {
  cards: OshiCardShare[];
  loading: boolean;
  busy: boolean;
  onDelete: (id: string) => void;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function OshiCardManagePanel({ cards, loading, busy, onDelete }: OshiCardManagePanelProps) {
  const canAdd = cards.length < MAX_OWNED_CARDS;

  return (
    <main className="w-full space-y-6">
      <div className="border border-dashed border-gray-500 bg-white p-5">
        <Link href="/play" className="text-xs font-bold text-gray-500 hover:underline">
          바이럴 허브로 돌아가기
        </Link>
        <h1 className="mt-3 text-2xl font-black text-gray-900">내 최애 카드 관리</h1>
        <p className="mt-2 text-sm leading-6 text-gray-600">
          로그인 계정에 최대 {MAX_OWNED_CARDS}장까지 저장할 수 있습니다. 카드는 삭제하지 않는 한 계속 유지됩니다.
        </p>
      </div>

      {loading ? (
        <p className="py-12 text-center text-sm text-gray-400">카드 목록 불러오는 중...</p>
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((share) => {
            const thumb = share.og_image_url ?? share.oshi_avatar_url ?? share.background_image_url;
            return (
              <article
                key={share.id}
                className="flex flex-col border border-dashed border-gray-400 bg-white overflow-hidden"
              >
                <Link
                  href={`/play/oshi-card/view/${share.id}`}
                  className="group relative aspect-[734/1024] bg-gray-100"
                >
                  {thumb ? (
                    <img
                      src={thumb}
                      alt={share.oshi ?? "최애 카드"}
                      className="h-full w-full object-cover transition-opacity group-hover:opacity-90"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[10px] text-gray-400">NO IMAGE</div>
                  )}
                  <span className="absolute right-2 top-2 inline-flex items-center gap-1 border border-white/60 bg-black/50 px-2 py-0.5 text-[10px] font-bold text-white opacity-0 transition-opacity group-hover:opacity-100">
                    <ExternalLink size={11} />
                    미리보기
                  </span>
                </Link>
                <div className="flex flex-1 flex-col gap-3 p-4">
                  <div>
                    <p className="truncate text-sm font-bold text-gray-900">{share.oshi ?? "최애 카드"}</p>
                    <p className="mt-1 text-[10px] text-gray-400">
                      {formatDate(share.created_at)}
                      {isPermanentOshiCardShare(share) ? " · 영구 보관" : ""}
                    </p>
                  </div>
                  <div className="mt-auto grid grid-cols-2 gap-2">
                    <Link
                      href={`/play/oshi-card?edit=${share.id}`}
                      className="inline-flex items-center justify-center gap-1 border border-dashed border-gray-500 px-2 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"
                    >
                      <Pencil size={13} />
                      수정
                    </Link>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onDelete(share.id)}
                      className="inline-flex items-center justify-center gap-1 border border-dashed border-red-300 px-2 py-2 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      <Trash2 size={13} />
                      삭제
                    </button>
                  </div>
                </div>
              </article>
            );
          })}

          {canAdd ? (
            <Link
              href="/play/oshi-card?new=1"
              className="flex min-h-[280px] flex-col items-center justify-center gap-3 border border-dashed border-gray-400 bg-gray-50/80 p-6 text-center transition-colors hover:border-gray-700 hover:bg-white"
            >
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-gray-400 bg-white">
                <Plus size={22} className="text-gray-600" />
              </span>
              <div>
                <p className="text-sm font-bold text-gray-900">새 카드 만들기</p>
                <p className="mt-1 text-xs text-gray-500">
                  {cards.length}/{MAX_OWNED_CARDS}장 사용 중
                </p>
              </div>
            </Link>
          ) : null}
        </section>
      )}

      <Link
        href="/profile?tab=play"
        className="block border border-dashed border-gray-400 bg-white p-3 text-center text-xs font-bold text-gray-600 hover:bg-gray-100"
      >
        프로필의 내 놀이 기록에서도 확인할 수 있습니다
      </Link>
    </main>
  );
}
