import Link from "next/link";
import { ReactNode } from "react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[calc(100vh-64px)] w-full flex-col md:flex-row">
      <aside className="w-full border-r border-dashed border-gray-500 bg-white/50 p-4 md:w-64">
        <h2 className="mb-6 text-xl font-bold">어드민 통합 페이지</h2>
        <nav className="flex flex-col gap-2">
          <Link
            href="/admin/boards"
            className="rounded border border-transparent p-2 transition-colors hover:border-gray-300 hover:bg-gray-100"
          >
            게시판 관리
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
        </nav>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
