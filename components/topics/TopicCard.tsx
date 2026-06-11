"use client";

import Link from "next/link";
import { ExternalLink, Heart, MessageCircle, Share2 } from "lucide-react";
import { useState } from "react";
import type { SourceItem, TopicCard as TopicCardData } from "@/lib/topics/topicCards";
import { ContentTypeBadge, RiskBadge, SourceBadge } from "@/components/topics/TopicBadges";

export default function TopicCard({ card, compact = false }: { card: TopicCardData; compact?: boolean }) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const voteCount = card.voteCount + (selectedOption ? 1 : 0);

  return (
    <article className="flex h-full flex-col border border-dashed border-gray-500 bg-white/85 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <ContentTypeBadge type={card.type} />
        <span className="inline-flex border border-dashed border-gray-300 bg-white px-2 py-1 text-[11px] font-bold text-gray-600">
          {card.categoryLabel}
        </span>
        {card.riskLevel ? <RiskBadge risk={card.riskLevel} /> : null}
      </div>

      <div className="mt-3 min-w-0">
        <h2 className={compact ? "line-clamp-2 text-base font-black text-gray-950" : "text-lg font-black text-gray-950"}>
          {card.title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-gray-600">{card.summary}</p>
      </div>

      <div className="mt-4 border-t border-dashed border-gray-300 pt-3">
        <p className="text-xs font-bold text-gray-500">오늘의 질문</p>
        <p className="mt-1 text-sm font-bold text-gray-900">{card.question}</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {card.pollOptions.map((option) => {
            const active = selectedOption === option;
            return (
              <button
                key={option}
                type="button"
                onClick={() => setSelectedOption((current) => (current === option ? null : option))}
                className={`min-h-10 border border-dashed px-2 py-2 text-sm font-semibold transition-colors ${
                  active
                    ? "border-gray-800 bg-gray-300 text-gray-950"
                    : "border-gray-400 bg-white text-gray-700 hover:bg-gray-100"
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-dashed border-gray-300 pt-3 text-xs text-gray-500">
        <span className="inline-flex items-center gap-1">
          <MessageCircle size={13} />
          댓글 {card.commentCount}
        </span>
        <span className="inline-flex items-center gap-1">
          <Heart size={13} />
          반응 {card.reactionCount}
        </span>
        <span>투표 {voteCount}</span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {card.relatedEventId ? (
          <Link
            href={`/events/${card.relatedEventId}`}
            className="inline-flex h-9 items-center border border-dashed border-gray-400 bg-white px-3 text-xs font-bold text-gray-700 hover:bg-gray-100"
          >
            관련 이벤트 보기
          </Link>
        ) : null}
        {card.relatedWorkId ? (
          <Link
            href={`/releases/${card.relatedWorkId}`}
            className="inline-flex h-9 items-center border border-dashed border-gray-400 bg-white px-3 text-xs font-bold text-gray-700 hover:bg-gray-100"
          >
            관련 작품 보기
          </Link>
        ) : null}
        {card.type === "viral" ? (
          <>
            <Link
              href="/play/recommend"
              className="inline-flex h-9 items-center border border-dashed border-gray-400 bg-white px-3 text-xs font-bold text-gray-700 hover:bg-gray-100"
            >
              같은 결과 보기
            </Link>
            <button
              type="button"
              className="inline-flex h-9 items-center gap-1 border border-dashed border-gray-400 bg-white px-3 text-xs font-bold text-gray-700 hover:bg-gray-100"
            >
              <Share2 size={13} />
              공유
            </button>
          </>
        ) : null}
      </div>

      <SourceLinks officialSources={card.officialSources} referenceSources={card.referenceSources} />
    </article>
  );
}

function SourceLinks({
  officialSources,
  referenceSources,
}: {
  officialSources?: SourceItem[];
  referenceSources?: SourceItem[];
}) {
  const official = officialSources?.filter((source) => source.url) ?? [];
  const references = referenceSources?.filter((source) => source.url) ?? [];
  if (official.length === 0 && references.length === 0) return null;

  return (
    <div className="mt-4 grid gap-2 border-t border-dashed border-gray-300 pt-3 text-xs">
      {official.length > 0 ? (
        <SourceGroup label="공식 출처" badgeType="official" sources={official} />
      ) : null}
      {references.length > 0 ? (
        <SourceGroup label="참고" badgeType="reference" sources={references} />
      ) : null}
    </div>
  );
}

function SourceGroup({
  label,
  badgeType,
  sources,
}: {
  label: string;
  badgeType: SourceItem["sourceType"];
  sources: SourceItem[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <SourceBadge type={badgeType} label={label} />
      {sources.slice(0, 3).map((source) => (
        <a
          key={`${label}-${source.url}`}
          href={source.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-w-0 max-w-full items-center gap-1 border border-dashed border-gray-300 bg-white px-2 py-1 font-semibold text-blue-600 hover:bg-blue-50"
        >
          <span className="truncate">{source.title}</span>
          <ExternalLink size={12} className="shrink-0" />
        </a>
      ))}
    </div>
  );
}
