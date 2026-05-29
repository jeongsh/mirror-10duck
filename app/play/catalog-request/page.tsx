import Link from "next/link";
import { catalogRequestPath } from "@/lib/catalogRequest";

const CARDS = [
  {
    href: catalogRequestPath("character-add"),
    title: "캐릭터 추가 요청",
    description: "DB에 없는 최애 캐릭터를 등록해 달라고 요청합니다. 작품이 없으면 작품 추가도 함께 요청할 수 있습니다.",
  },
  {
    href: catalogRequestPath("work-add"),
    title: "작품 추가 요청",
    description: "작품만 먼저 DB에 넣어 달라고 요청합니다. 캐릭터는 나중에 따로 추가할 수 있습니다.",
  },
];

export default function CatalogRequestHubPage() {
  return (
    <main className="flex w-full flex-col gap-5">
      <section className="border border-dashed border-gray-500 bg-white p-5">
        <Link href="/play" className="text-xs font-bold text-gray-500 hover:underline">
          바이럴 허브로 돌아가기
        </Link>
        <h1 className="mt-3 text-2xl font-black text-gray-900">캐릭터 · 작품 요청</h1>
        <p className="mt-2 text-sm leading-6 text-gray-600">
          최애 분석, 월드컵, 카드 만들기 등 바이럴 기능에서 공통으로 쓰는 DB 보강 요청입니다.
          로그인 없이도 보낼 수 있고, 승인되면 다음 분석부터 반영됩니다.
        </p>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        {CARDS.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="border border-dashed border-gray-400 bg-white p-4 transition-colors hover:border-gray-600 hover:bg-gray-50"
          >
            <h2 className="text-base font-black text-gray-900">{card.title}</h2>
            <p className="mt-2 text-xs leading-5 text-gray-600">{card.description}</p>
            <span className="mt-3 inline-flex text-xs font-bold text-gray-700 underline">
              요청하기 →
            </span>
          </Link>
        ))}
      </div>

      <section className="border border-dashed border-gray-300 bg-gray-50 p-4">
        <p className="text-xs leading-5 text-gray-500">
          이미 등록된 캐릭터·작품 정보가 틀렸다면, 해당 항목의 수정 요청 페이지에서 이름·태그·작품
          연결 등을 제안할 수 있습니다. 분석 결과 화면에서도 바로 수정 요청으로 이동할 수 있습니다.
        </p>
      </section>
    </main>
  );
}
