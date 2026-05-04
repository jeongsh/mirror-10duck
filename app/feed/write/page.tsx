"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import FeedComposer from "@/components/community/feed/FeedComposer";
import { useAuthUser } from "@/lib/supabase/useAuthUser";

export default function WriteFeedPage() {
  const router = useRouter();
  const authUser = useAuthUser();

  const userId = authUser?.id ?? "";
  const userEmail = authUser?.email ?? "";

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <header className="flex items-center justify-between border border-dashed border-gray-500 bg-white/80 p-4">
        <div>
          <h1 className="text-lg font-bold">피드 작성</h1>
          <p className="mt-1 text-sm text-gray-600">
            짧게 쓰고, 스티커와 이미지로 바로 공유하세요.
          </p>
        </div>
        <Link
          href="/feed"
          className="border border-dashed border-gray-500 bg-white px-3 py-2 text-sm hover:bg-gray-100"
        >
          닫기
        </Link>
      </header>

      {!userId ? (
        <div className="border border-dashed border-gray-500 bg-white/80 p-4 text-sm">
          피드를 작성하려면 먼저{" "}
          <Link href="/auth" className="font-semibold underline hover:text-blue-600">
            로그인
          </Link>
          해 주세요.
        </div>
      ) : null}

      <FeedComposer
        userId={userId}
        userEmail={userEmail}
        disabled={!userId}
        onPosted={() => router.push("/feed")}
      />
    </main>
  );
}
