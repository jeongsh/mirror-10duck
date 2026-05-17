interface LevelBadgeProps {
  level: number;
  size?: "xs" | "sm";
}

function getTierStyle(level: number): string {
  if (level >= 20) return "bg-red-600 text-white border-red-700";
  if (level >= 15) return "bg-amber-500 text-white border-amber-600";
  if (level >= 10) return "bg-purple-600 text-white border-purple-700";
  if (level >= 5)  return "bg-blue-500 text-white border-blue-600";
  return "bg-gray-400 text-white border-gray-500";
}

export default function LevelBadge({ level, size = "xs" }: LevelBadgeProps) {
  const tierStyle = getTierStyle(level);
  const sizeStyle = size === "xs"
    ? "text-[8px] px-1 leading-tight"
    : "text-[10px] px-1.5 py-0.5 leading-tight";

  return (
    <span className={`inline-flex items-center border font-black uppercase tracking-tighter shrink-0 ${sizeStyle} ${tierStyle}`}>
      Lv.{level}
    </span>
  );
}
