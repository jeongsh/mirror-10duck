/**
 * 커뮤니티용 날짜 포맷터.
 * - 오늘인 경우: HH:mm
 * - 오늘이 아닌 경우: MM.DD
 */
export function formatCommunityDate(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  
  const isToday = 
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (isToday) {
    return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
  } else {
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${mm}.${dd}`;
  }
}
