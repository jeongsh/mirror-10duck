import AdminUrlDraftForm from "@/components/admin/topics/AdminUrlDraftForm";

export const dynamic = "force-dynamic";

export default function AdminTopicsPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-dashed border-gray-500 pb-4">
        <div>
          <h2 className="text-xl font-black text-gray-950">오늘의 떡밥 관리</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-600">
            참고 뉴스 URL에서 주제를 파악하고, 공식 출처로 확인 가능한 사실만 이용해 짧은 떡밥 카드 초안을 만듭니다.
            자동 게시하지 않으며, 공식 출처가 없는 초안은 승인할 수 없습니다.
          </p>
        </div>
        <a
          href="/topics"
          className="inline-flex h-10 items-center border border-dashed border-gray-400 bg-white px-3 text-sm font-bold text-gray-700 hover:bg-gray-100"
        >
          공개 페이지
        </a>
      </header>

      <AdminUrlDraftForm />
    </div>
  );
}
