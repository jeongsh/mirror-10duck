/** 바이럴 좌·우 세로 배너 — globals.css `.viral-ad-slot` 좌표 공유 */
export default function ViralSideAds() {
  return (
    <>
      <aside className="viral-ad-slot viral-ad-slot--left bg-gray-100/50" aria-label="좌측 광고">
        <div className="viral-ad-slot__frame">
          <span className="sr-only">광고</span>
          [Left
          <br />
          ad]
        </div>
      </aside>
      <aside className="viral-ad-slot viral-ad-slot--right bg-gray-100/50" aria-label="우측 광고">
        <div className="viral-ad-slot__frame">
          <span className="sr-only">광고</span>
          [Right
          <br />
          ad]
        </div>
      </aside>
    </>
  );
}
