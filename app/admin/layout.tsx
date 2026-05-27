"use client";

import Link from "next/link";
import { ReactNode } from "react";
import { isAdminUser } from "@/lib/supabase/admin";
import { useAuthUser } from "@/lib/supabase/useAuthUser";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const authUser = useAuthUser();

  if (authUser === undefined) {
    return <main className="p-6">로딩 중...</main>;
  }

  if (!isAdminUser(authUser)) {
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
    <div className="flex min-h-[calc(100vh-64px)] w-full flex-col md:flex-row">
      <aside className="w-full border-r border-dashed border-gray-500 bg-white/50 p-4 md:w-64">
        <h2 className="mb-6 text-xl font-bold">어드민 통합 페이지</h2>
        <nav className="flex flex-col gap-2">
          <Link
            href="/admin/works"
            className="rounded border border-transparent p-2 transition-colors hover:border-gray-300 hover:bg-gray-100"
          >
            공식 작품/최애캐 관리
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
            └ 채널 표시 순서
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
        </nav>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
