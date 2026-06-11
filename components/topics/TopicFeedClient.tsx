"use client";

import { useEffect, useMemo, useState } from "react";
import EmptyState from "@/components/topics/EmptyState";
import TopicCard from "@/components/topics/TopicCard";
import { readApprovedSourcedTopicCards } from "@/components/topics/topicDraftStorage";
import { supabase } from "@/lib/supabase/client";
import { getCurrentCours } from "@/lib/otaku/cours";
import {
  TOPIC_EMPTY_MESSAGE,
  TOPIC_TABS,
  createManualPollTopicCard,
  createTopicCardFromEvent,
  createTopicCardFromSeasonalAnime,
  createViralResultTopicCard,
  filterTopicCards,
  type ReleaseEventTopicRow,
  type SeasonalAnimeTopicRow,
  type TopicCard as TopicCardData,
  type TopicTab,
} from "@/lib/topics/topicCards";

const EVENT_TYPES = [
  "GOODS_PREORDER",
  "GOODS_RELEASE",
  "OFFLINE_EVENT",
  "TICKET_EVENT",
  "LIVE_EVENT",
];

export default function TopicFeedClient({ mode = "page" }: { mode?: "page" | "home" }) {
  const [cards, setCards] = useState<TopicCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TopicTab>("all");

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      setLoading(true);
      const nextCards = await loadTopicCards(mode);
      if (!cancelled) {
        setCards(nextCards);
        setLoading(false);
      }
    };

    void refresh();

    const onStorage = () => {
      void refresh();
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("ssibduk:topics-updated", onStorage);

    return () => {
      cancelled = true;
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("ssibduk:topics-updated", onStorage);
    };
  }, [mode]);

  const visibleCards = useMemo(() => filterTopicCards(cards, activeTab), [activeTab, cards]);

  if (mode === "home") {
    return (
      <section className="border border-dashed border-gray-500 bg-white/70 p-4">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2 border-b border-dashed border-gray-400 pb-2">
          <div>
            <h2 className="text-xl font-bold text-gray-800">오늘의 떡밥</h2>
            <p className="mt-1 text-xs text-gray-500">
              오늘 반응할 이벤트, 분기작, 투표, 공식 소식만 짧게 봅니다.
            </p>
          </div>
          <a href="/topics" className="text-xs text-gray-500 hover:underline">
            더 보기
          </a>
        </div>
        {loading ? (
          <p className="py-8 text-center text-sm text-gray-500">떡밥 불러오는 중...</p>
        ) : visibleCards.length === 0 ? (
          <EmptyState message={TOPIC_EMPTY_MESSAGE} />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {visibleCards.map((card) => (
              <TopicCard key={card.id} card={card} compact />
            ))}
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="border border-dashed border-gray-500 bg-white/70 p-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {TOPIC_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveTab(tab.value)}
              className={`min-h-10 border border-dashed px-3 py-2 text-sm font-bold ${
                activeTab === tab.value
                  ? "border-gray-800 bg-gray-300 text-gray-950"
                  : "border-gray-500 bg-white text-gray-600 hover:bg-gray-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="border border-dashed border-gray-400 bg-white/70 p-6 text-sm text-gray-500">
          오늘의 떡밥을 불러오는 중...
        </div>
      ) : visibleCards.length === 0 ? (
        <EmptyState message={TOPIC_EMPTY_MESSAGE} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {visibleCards.map((card) => (
            <TopicCard key={card.id} card={card} />
          ))}
        </div>
      )}
    </section>
  );
}

async function loadTopicCards(mode: "page" | "home"): Promise<TopicCardData[]> {
  const now = new Date();
  const [eventCards, seasonalCards] = await Promise.all([
    loadEventTopicCards(now, mode === "home" ? 8 : 32),
    loadSeasonalTopicCards(mode === "home" ? 4 : 12),
  ]);
  const pollCard = createManualPollTopicCard(now);
  const viralCard = createViralResultTopicCard(now);
  const sourcedCards = readApprovedSourcedTopicCards();

  if (mode === "home") {
    return uniqueCards([
      eventCards[0],
      seasonalCards[0],
      pollCard,
      sourcedCards[0] ?? eventCards.find((card) => card.categoryLabel === "마감 임박") ?? viralCard,
    ]).slice(0, 4);
  }

  return uniqueCards([
    ...sourcedCards,
    ...eventCards,
    ...seasonalCards,
    pollCard,
    viralCard,
  ]).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

async function loadEventTopicCards(now: Date, limit: number): Promise<TopicCardData[]> {
  const { data, error } = await supabase
    .from("release_events")
    .select(
      `
      id,
      event_type,
      title,
      description,
      starts_at,
      ends_at,
      timezone,
      platform,
      location,
      source_url,
      release_item_id,
      release_items (
        category,
        title
      )
    `,
    )
    .eq("status", "PUBLISHED")
    .in("event_type", EVENT_TYPES)
    .order("starts_at", { ascending: true })
    .limit(limit);

  if (error) {
    console.warn("[topics] failed to load event topics:", error.message);
    return [];
  }

  return ((data ?? []) as ReleaseEventTopicRow[])
    .map((row) => ({
      ...row,
      release_items: Array.isArray(row.release_items) ? row.release_items[0] : row.release_items,
    }))
    .map((row) => createTopicCardFromEvent(row, now));
}

async function loadSeasonalTopicCards(limit: number): Promise<TopicCardData[]> {
  const currentCours = getCurrentCours();
  const baseQuery = supabase
    .from("release_items")
    .select("id, title, synopsis, release_date, cours")
    .eq("category", "ANIME")
    .eq("status", "PUBLISHED")
    .order("release_date", { ascending: true, nullsFirst: false })
    .limit(limit);

  const { data, error } = await baseQuery.eq("cours", currentCours);
  if (!error) {
    return ((data ?? []) as SeasonalAnimeTopicRow[]).map((row, index) =>
      createTopicCardFromSeasonalAnime(row, index),
    );
  }

  if (error.code !== "42703") {
    console.warn("[topics] failed to load seasonal topics:", error.message);
    return [];
  }

  const { data: fallbackRows, error: fallbackError } = await supabase
    .from("release_items")
    .select("id, title, synopsis, release_date")
    .eq("category", "ANIME")
    .eq("status", "PUBLISHED")
    .order("release_date", { ascending: true, nullsFirst: false })
    .limit(40);

  if (fallbackError) {
    console.warn("[topics] failed to load seasonal fallback topics:", fallbackError.message);
    return [];
  }

  return ((fallbackRows ?? []) as SeasonalAnimeTopicRow[])
    .filter((row) => releaseDateToCours(row.release_date) === currentCours)
    .slice(0, limit)
    .map((row, index) => createTopicCardFromSeasonalAnime(row, index));
}

function uniqueCards(cards: Array<TopicCardData | undefined>): TopicCardData[] {
  const seen = new Set<string>();
  const result: TopicCardData[] = [];
  for (const card of cards) {
    if (!card || seen.has(card.id)) continue;
    seen.add(card.id);
    result.push(card);
  }
  return result;
}

function releaseDateToCours(dateValue: string | null): string | null {
  if (!dateValue) return null;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;
  const month = date.getMonth() + 1;
  const quarter = month <= 3 ? 1 : month <= 6 ? 2 : month <= 9 ? 3 : 4;
  return `${date.getFullYear()}-Q${quarter}`;
}
