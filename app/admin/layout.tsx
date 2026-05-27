"use client";

import Link from "next/link";
import { ReactNode } from "react";
import { useAuthUser, useIsAdmin } from "@/lib/supabase/useAuthUser";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const authUser = useAuthUser();
  const isAdmin = useIsAdmin();

  if (authUser === undefined || isAdmin === undefined) {
    return <main className="p-6">로딩 중...</main>;
  }

  if (!isAdmin) {
    return (
      <main className="flex min-h-[400px] flex-col items-center justify-center gap-4 p-6">
        <h1 className="text-2xl font-bold text-red-600">접근 권한 없음</h1>
        <p className="text-gray-600">관리자 계정으로 로그인해야 접근할 수 있습니다.</p>
        <Link href="/" className="border border-dashed border-gray-500 px-4 py-2 hover:bg-gray-100">
          홈으로 돌아가기
        </Link>
      </main>
    );
  }

  return (
    <div className="flex h-[calc(100vh-64px)] w-full flex-col overflow-hidden md:flex-row">
      <aside className="w-full shrink-0 border-dashed border-gray-500 bg-white/50 p-4 md:w-72 md:overflow-y-auto md:border-r md:border-l-0">
        <h2 className="mb-6 text-xl font-bold">어드민 통합 페이지</h2>
        <nav className="flex flex-col gap-2">
          <Link
            href="/admin/works"
            className="rounded border border-transparent p-2 transition-colors hover:border-gray-300 hover:bg-gray-100"
          >
            작품/최애캐 관리
          </Link>
          <Link
            href="/admin/boards"
            className="rounded border border-transparent p-2 transition-colors hover:border-gray-300 hover:bg-gray-100"
          >
            게시판 관리
          </Link>
          <Link
            href="/admin/boards/order"
            className="rounded border border-transparent p-2 pl-6 text-sm transition-colors hover:border-gray-300 hover:bg-gray-100"
          >
            채널 노출 순서
          </Link>
          <Link
            href="/admin/reports"
            className="rounded border border-transparent p-2 transition-colors hover:border-gray-300 hover:bg-gray-100"
          >
            신고 관리
          </Link>
          <Link
            href="/admin/releases"
            className="rounded border border-transparent p-2 transition-colors hover:border-gray-300 hover:bg-gray-100"
          >
            신작 관리
          </Link>
          <Link
            href="/admin/news"
            className="rounded border border-transparent p-2 transition-colors hover:border-gray-300 hover:bg-gray-100"
          >
            뉴스 관리
          </Link>
          <Link
            href="/admin/badges"
            className="rounded border border-transparent p-2 transition-colors hover:border-gray-300 hover:bg-gray-100"
          >
            뱃지 관리
          </Link>
          <Link
            href="/admin/users"
            className="rounded border border-transparent p-2 transition-colors hover:border-gray-300 hover:bg-gray-100"
          >
            유저 관리
          </Link>
        </nav>
      </aside>
      <main className="min-w-0 flex-1 overflow-y-auto px-8 py-6">{children}</main>
    </div>
  );
}
