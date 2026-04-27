import Link from "next/link";
import CharacterControls from "@/components/CharacterControls";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-4 p-6 text-gray-700">
      <header className="border border-dashed border-gray-500 bg-white/70 p-6">
        <h1 className="text-2xl font-bold">씹덕(SSIBDUK) MVP</h1>
        <p className="mt-2 text-sm text-gray-600">
          Phase 2.2 기준으로 Supabase 인증/커뮤니티 기능이 연결되었습니다.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/auth"
            className="border border-dashed border-gray-500 bg-white px-3 py-2 text-sm"
          >
            회원가입/로그인
          </Link>
          <Link
            href="/community"
            className="border border-dashed border-gray-500 bg-white px-3 py-2 text-sm"
          >
            게시판
          </Link>
          <Link
            href="/community/write"
            className="border border-dashed border-gray-500 bg-white px-3 py-2 text-sm"
          >
            글쓰기
          </Link>
        </div>
      </header>

      <CharacterControls />
    </main>
  );
}
