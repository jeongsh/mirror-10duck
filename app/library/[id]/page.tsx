"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import LibraryManagerPanel from "@/components/character/LibraryManagerPanel";
import { useAuthUser } from "@/lib/supabase/useAuthUser";

export default function CharacterManagePage() {
  const params = useParams<{ id: string }>();
  const targetId = decodeURIComponent(params.id);
  const user = useAuthUser();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-4 p-6 text-gray-700">
      <div className="flex items-center justify-between border-2 border-dashed border-gray-500 bg-gray-200/60 p-4">
        <div className="text-[11px] tracking-[0.2em] uppercase text-gray-500">
          [캐릭터 통합 관리 페이지]
        </div>
        <Link
          href="/"
          className="border border-dashed border-gray-600 bg-white/80 px-3 py-1 text-[11px] tracking-widest uppercase"
        >
          [BACK]
        </Link>
      </div>
      {user === undefined ? (
        <div className="border border-dashed border-gray-400 bg-white/40 p-3 text-xs text-gray-500">
          확인 중...
        </div>
      ) : !user ? (
        <div className="border-2 border-dashed border-gray-400 bg-gray-100/60 p-6 text-center text-sm text-gray-600">
          <div className="mb-3">로그인 후 이용 가능한 페이지입니다.</div>
          <Link
            href="/auth"
            className="inline-block border border-dashed border-gray-500 bg-white px-3 py-1 text-xs tracking-widest uppercase"
          >
            [로그인 / 회원가입]
          </Link>
        </div>
      ) : (
        <LibraryManagerPanel initialTargetId={targetId} />
      )}
    </main>
  );
}
