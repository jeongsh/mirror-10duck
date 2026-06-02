/** 바이럴 좌·우 세로 배너 — LeftSidebar 좌측 배너와 동일 크기·그리드 열 위치 (globals.css) */
export default function ViralSideAds() {
  return (
    <>
      <aside className="viral-ad-slot viral-ad-slot--left" aria-label="좌측 광고">
        <div className="viral-ad-slot__frame">
          <span className="sr-only">광고</span>
          [Left
          <br />
          promo banner]
        </div>
      </aside>
      <aside className="viral-ad-slot viral-ad-slot--right" aria-label="우측 광고">
        <div className="viral-ad-slot__frame">
          <span className="sr-only">광고</span>
          [Left
          <br />
          promo banner]
        </div>
      </aside>
    </>
  );
}
