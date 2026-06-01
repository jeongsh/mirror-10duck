import Link from "next/link";

const UPCOMING_FLOW = [
  "편하게 볼 작품, 몰입감 있는 작품, 반응 좋은 작품 중 하나를 고릅니다.",
  "선택한 카테고리 안에서 2~3개의 짧은 질문으로 취향을 좁힙니다.",
  "추천 결과와 짧은 이유를 보여주고, 저장/공유 가능한 바이럴 결과로 확장합니다.",
];

export default function AnimeRecommendPage() {
  return (
    <main className="flex w-full flex-col gap-6">
      <section className="border border-dashed border-gray-500 bg-white p-5">
        <Link href="/play" className="text-xs font-bold text-gray-500 hover:underline">
          바이럴 허브로 돌아가기
        </Link>
        <p className="mt-4 text-xs font-black uppercase tracking-wider text-gray-500">
          Anime Recommendation
        </p>
        <h1 className="mt-2 text-2xl font-black text-gray-900">애니 추천</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600">
          정식 추천 바이럴은 개발 중입니다. 지금은 메인 캐릭터 말풍선에서 간이 추천기로
          먼저 체험할 수 있습니다.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="border border-dashed border-gray-500 bg-white p-5">
          <h2 className="text-base font-black text-gray-900">개발 예정 플로우</h2>
          <ol className="mt-4 flex flex-col gap-3">
            {UPCOMING_FLOW.map((step, index) => (
              <li key={step} className="flex gap-3 text-sm leading-6 text-gray-700">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center border border-dashed border-gray-400 bg-gray-100 text-xs font-black">
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>

        <aside className="border border-dashed border-gray-500 bg-gray-50 p-4 lg:sticky lg:top-24 lg:self-start">
          <h2 className="border-b border-dashed border-gray-300 pb-2 text-sm font-black text-gray-900">
            현재 사용 가능
          </h2>
          <p className="mt-3 text-xs leading-5 text-gray-600">
            로그인 이후 메인에 떠 있는 캐릭터를 눌러 `작품 추천`을 선택하면 간이 추천을
            받을 수 있습니다.
          </p>
        </aside>
      </section>
    </main>
  );
}
