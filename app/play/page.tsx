import Link from "next/link";
import { CREATE_NAV_GROUPS } from "@/lib/navigation";

const FLOW_STEPS = [
  "성향 테스트로 유입",
  "최애 프로필 카드 생성",
  "가입하면 카드 저장",
  "같은 최애 유저와 게시판 추천",
  "분기 체크리스트 등록",
  "관심작 알림과 피드로 재방문",
];

export default function PlayHubPage() {
  return (
    <main className="flex w-full flex-col gap-6">
      <section className="border border-dashed border-gray-500 bg-white p-5">
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Viral Entry Hub</p>
          <h1 className="mt-2 text-2xl font-black text-gray-900">너의 오타쿠 정체성을 만들어봐</h1>
          <p className="mt-3 text-sm leading-6 text-gray-600">
            가입 전에도 바로 만들고 공유할 수 있는 기능을 이곳에 모읍니다. GNB에는 개별 도구를
            늘어놓지 않고, 바이럴 허브 하나로 진입시킨 뒤 프로필, 게시판, 시즌 기능으로 연결합니다.
          </p>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-4">
          {CREATE_NAV_GROUPS.map((group) => (
            <section key={group.label} className="border border-dashed border-gray-500 bg-white p-4">
              <div className="mb-3 flex items-center justify-between border-b border-dashed border-gray-300 pb-2">
                <h2 className="text-lg font-black text-gray-900">{group.label}</h2>
                <span className="text-xs text-gray-400">{group.items.length}개</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {group.items.map((item) => {
                  const isLive = item.status === "live";

                  return (
                    <article key={item.href} className="border border-dashed border-gray-300 bg-gray-50 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-sm font-black text-gray-900">{item.label}</h3>
                          <p className="mt-1 text-xs leading-5 text-gray-600">{item.description}</p>
                        </div>
                        <span
                          className={`shrink-0 border border-dashed px-1.5 py-0.5 text-[10px] font-bold ${
                            isLive
                              ? "border-green-400 bg-green-50 text-green-700"
                              : "border-gray-300 bg-white text-gray-400"
                          }`}
                        >
                          {isLive ? "운영중" : "예정"}
                        </span>
                      </div>
                      <Link
                        href={isLive ? item.href : "/play"}
                        className="mt-3 inline-flex border border-dashed border-gray-500 bg-white px-2 py-1 text-xs font-bold text-gray-700 hover:bg-gray-100"
                      >
                        {isLive ? "바로가기" : "설계 대기"}
                      </Link>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <aside className="border border-dashed border-gray-500 bg-white p-4 lg:sticky lg:top-24 lg:self-start">
          <h2 className="border-b border-dashed border-gray-300 pb-2 text-sm font-black text-gray-900">
            추천 진입 흐름
          </h2>
          <ol className="mt-3 flex flex-col gap-2">
            {FLOW_STEPS.map((step, index) => (
              <li key={step} className="flex gap-2 text-xs leading-5 text-gray-700">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center border border-dashed border-gray-400 bg-gray-100 font-bold">
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <div className="mt-4 border-t border-dashed border-gray-300 pt-3">
            <Link
              href="/profile?tab=oshi"
              className="inline-flex w-full justify-center border border-dashed border-gray-700 bg-gray-900 px-3 py-2 text-xs font-bold text-white hover:bg-gray-800"
            >
              현재 프로필/최애 설정으로 이동
            </Link>
          </div>
        </aside>
      </section>
    </main>
  );
}
