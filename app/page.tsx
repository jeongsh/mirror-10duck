import Live2DClientOnly from "@/components/Live2DClientOnly";
import CharacterControls from "@/components/CharacterControls";

const DUMMY_POSTS = [
  { id: 1, board: "[일반]", title: "씹덕 v0.1 와이어프레임 검증 시작", author: "admin", comments: 12 },
  { id: 2, board: "[캐릭터]", title: "Live2D 모델 로드 테스트용 게시글", author: "duck01", comments: 3 },
  { id: 3, board: "[잡담]", title: "오늘 본 애니 얘기하실 분", author: "otaku_kun", comments: 48 },
  { id: 4, board: "[굿즈]", title: "피규어 예약 공구 모집 (샘플)", author: "figure_san", comments: 7 },
  { id: 5, board: "[질문]", title: "Pixi v8 + Cubism 5 호환 이슈 해결법", author: "dev_nyan", comments: 21 },
];

const GNB_ITEMS = ["[홈]", "[게시판]", "[캐릭터]", "[갤러리]", "[굿즈]", "[내 정보]"];
const SIDEBAR_BOARDS = ["[일반]", "[캐릭터]", "[잡담]", "[굿즈]", "[질문]", "[공지]"];

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-4 p-6 text-gray-700">
      {/* ============================================================== */}
      {/* GNB 영역                                                        */}
      {/* ============================================================== */}
      <header className="border-2 border-dashed border-gray-500 bg-gray-200/60 p-4">
        <div className="mb-3 text-[11px] tracking-[0.2em] text-gray-500 uppercase">
          [GNB · Global Navigation Bar 영역]
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="border border-dashed border-gray-500 bg-white/60 px-3 py-2 text-sm font-bold tracking-widest">
            [LOGO] 씹덕 / SSIBDUK
          </div>
          <nav className="flex flex-wrap gap-2">
            {GNB_ITEMS.map((item) => (
              <span
                key={item}
                className="border border-dashed border-gray-500 bg-white/60 px-3 py-2 text-xs tracking-widest"
              >
                {item}
              </span>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <span className="border border-dashed border-gray-500 bg-white/60 px-3 py-2 text-xs tracking-widest">
              [검색 input]
            </span>
            <span className="border border-dashed border-gray-500 bg-white/60 px-3 py-2 text-xs tracking-widest">
              [로그인 / 프로필]
            </span>
          </div>
        </div>
      </header>

      {/* ============================================================== */}
      {/* 캐릭터 컨트롤 패널 (검증용)                                      */}
      {/* ============================================================== */}
      <CharacterControls />

      {/* ============================================================== */}
      {/* 본문: 사이드바 + 게시판 리스트                                   */}
      {/* ============================================================== */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-[220px_1fr]">
        {/* 사이드바 ---------------------------------------------------- */}
        <aside className="border-2 border-dashed border-gray-500 bg-gray-200/60 p-4">
          <div className="mb-3 text-[11px] tracking-[0.2em] text-gray-500 uppercase">
            [사이드바 · 게시판 카테고리 영역]
          </div>
          <ul className="flex flex-col gap-2">
            {SIDEBAR_BOARDS.map((b) => (
              <li
                key={b}
                className="border border-dashed border-gray-500 bg-white/60 px-3 py-2 text-xs tracking-widest"
              >
                {b}
              </li>
            ))}
          </ul>
        </aside>

        {/* 게시판 리스트 ------------------------------------------------ */}
        <section className="border-2 border-dashed border-gray-500 bg-gray-200/60 p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[11px] tracking-[0.2em] text-gray-500 uppercase">
              [게시판 리스트 영역]
            </span>
            <span className="border border-dashed border-gray-500 bg-white/60 px-3 py-1 text-[11px] tracking-widest">
              [글쓰기 버튼]
            </span>
          </div>

          <div className="flex flex-col divide-y divide-dashed divide-gray-400 border border-dashed border-gray-500 bg-white/40">
            {/* 리스트 헤더 */}
            <div className="grid grid-cols-[56px_88px_1fr_120px_80px] gap-2 bg-gray-300/60 px-3 py-2 text-[11px] tracking-widest uppercase">
              <span>No.</span>
              <span>Board</span>
              <span>Title</span>
              <span>Author</span>
              <span>Cmts</span>
            </div>

            {DUMMY_POSTS.map((p) => (
              <div
                key={p.id}
                className="grid grid-cols-[56px_88px_1fr_120px_80px] items-center gap-2 px-3 py-3 text-xs"
              >
                <span className="text-gray-500">{p.id}</span>
                <span className="border border-dashed border-gray-400 bg-white/60 px-2 py-1 text-[11px]">
                  {p.board}
                </span>
                <span className="truncate">{p.title}</span>
                <span className="text-gray-500">{p.author}</span>
                <span className="text-gray-500">{p.comments}</span>
              </div>
            ))}
          </div>

          {/* 페이지네이션 */}
          <div className="mt-3 flex items-center justify-center gap-1 text-[11px] tracking-widest">
            {["<<", "<", "1", "2", "3", "4", "5", ">", ">>"].map((t) => (
              <span
                key={t}
                className="border border-dashed border-gray-500 bg-white/60 px-2 py-1"
              >
                {t}
              </span>
            ))}
          </div>
        </section>
      </section>

      {/* ============================================================== */}
      {/* 푸터                                                            */}
      {/* ============================================================== */}
      <footer className="border-2 border-dashed border-gray-500 bg-gray-200/60 p-4 text-[11px] tracking-[0.2em] text-gray-500 uppercase">
        [푸터 영역 · 회사정보 / 약관 / 문의 / © SSIBDUK]
      </footer>

      {/* Live2D 캐릭터 (우측 하단 고정) */}
      <Live2DClientOnly />
    </main>
  );
}
