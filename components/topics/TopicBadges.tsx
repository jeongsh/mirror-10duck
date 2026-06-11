import type { SourceType, TopicCardType, TopicRiskLevel } from "@/lib/topics/topicCards";
import { TOPIC_TYPE_LABELS } from "@/lib/topics/topicCards";

const TYPE_CLASS: Record<TopicCardType, string> = {
  event: "border-rose-300 bg-rose-50 text-rose-700",
  seasonal: "border-sky-300 bg-sky-50 text-sky-700",
  poll: "border-amber-300 bg-amber-50 text-amber-700",
  viral: "border-emerald-300 bg-emerald-50 text-emerald-700",
  sourced: "border-violet-300 bg-violet-50 text-violet-700",
};

const SOURCE_CLASS: Record<SourceType, string> = {
  official: "border-green-300 bg-green-50 text-green-700",
  reference: "border-gray-300 bg-gray-50 text-gray-600",
  news: "border-gray-300 bg-gray-50 text-gray-600",
  unknown: "border-gray-300 bg-white text-gray-500",
};

const RISK_CLASS: Record<TopicRiskLevel, string> = {
  low: "border-green-300 bg-green-50 text-green-700",
  medium: "border-amber-300 bg-amber-50 text-amber-700",
  high: "border-red-300 bg-red-50 text-red-700",
  blocked: "border-gray-400 bg-gray-100 text-gray-700",
};

export function ContentTypeBadge({ type }: { type: TopicCardType }) {
  return (
    <span className={`inline-flex border border-dashed px-2 py-1 text-[11px] font-bold ${TYPE_CLASS[type]}`}>
      {TOPIC_TYPE_LABELS[type]}
    </span>
  );
}

export function SourceBadge({ type, label }: { type: SourceType; label: string }) {
  return (
    <span className={`inline-flex border border-dashed px-2 py-1 text-[11px] font-bold ${SOURCE_CLASS[type]}`}>
      {label}
    </span>
  );
}

export function RiskBadge({ risk }: { risk: TopicRiskLevel }) {
  return (
    <span className={`inline-flex border border-dashed px-2 py-1 text-[11px] font-bold ${RISK_CLASS[risk]}`}>
      위험도 {risk}
    </span>
  );
}
