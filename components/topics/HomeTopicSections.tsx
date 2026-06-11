"use client";

import Link from "next/link";
import {
  BarChart3,
  ChevronRight,
  Clock3,
  ExternalLink,
  MessageCircle,
  Sparkles,
  ThumbsUp,
  Trophy,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { readApprovedSourcedTopicCards } from "@/components/topics/topicDraftStorage";
import { compareRealtimeBestPosts, isRealtimeBestPost } from "@/lib/community/realtimeBest";
import { getCurrentCours } from "@/lib/otaku/cours";
import { getCoursSlotKind, getTodayWeekdayKo, releaseDateToWeekdayKo } from "@/lib/otaku/coursPhase";
import {
  buildReviewAggByItem,
  buildVoteCountsByItem,
  compareReleasePopularity,
  lineupHeatScore,
  popularityDisplayCount,
  type ReviewAgg,
} from "@/lib/otaku/seasonPopularity";
import { EVENT_TYPE_LABELS, formatEventDatePeriod, type CalendarEventType } from "@/lib/otaku/hub";
import { supabase } from "@/lib/supabase/client";
import { formatCommunityDate } from "@/lib/utils/formatDate";
import {
  createManualPollTopicCard,
  createTopicCardFromEvent,
  createTopicCardFromSeasonalAnime,
  type ReleaseEventTopicRow,
  type SeasonalAnimeTopicRow,
  type SourceItem,
  type TopicCard,
} from "@/lib/topics/topicCards";
import { type CommunityPost, postAggregateDefaults } from "@/types/community";

const HOME_SEASONAL_WEEKDAY_TOP = 4;

const MOCK_CHARACTER_RANKING = [
  { rank: 1, name: "프리렌", votes: 1284 },
  { rank: 2, name: "후리나", votes: 1102 },
  { rank: 3, name: "마루", votes: 987 },
] as const;

const EMPTY_THUMB =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='640' height='840' viewBox='0 0 640 840'%3E%3Crect width='640' height='840' fill='%23f3f4f6'/%3E%3Ctext x='320' y='420' text-anchor='middle' fill='%239ca3af' font-family='sans-serif' font-size='30'%3ENO IMAGE%3C/text%3E%3C/svg%3E";

const EVENT_TYPES = [
  "GOODS_PREORDER",
  "GOODS_RELEASE",
  "OFFLINE_EVENT",
  "TICKET_EVENT",
  "LIVE_EVENT",
];

type HomeEventRow = ReleaseEventTopicRow & {
  image_url: string | null;
  release_items?:
    | {
        category?: string | null;
        title?: string | null;
        poster_url?: string | null;
      }
    | Array<{
        category?: string | null;
        title?: string | null;
        poster_url?: string | null;
      }>
    | null;
};

type HomeSeasonalRow = SeasonalAnimeTopicRow & {
  poster_url: string | null;
};

type HomeNewsRow = {
  id: string;
  category: string;
  title: string;
  summary: string;
  thumbnail_url: string | null;
  published_at: string | null;
};

type HomeEventItem = {
  card: TopicCard;
  imageUrl: string | null;
  dateLabel: string;
  typeLabel: string;
  ddayLabel: string;
  locationLabel: string;
};

type HomeSeasonalItem = {
  card: TopicCard;
  imageUrl: string | null;
  dateLabel: string;
  weekdayLabel: string | null;
  interestCount: number;
  popularityRank: number;
};

type HomeNewsItem = {
  id: string;
  href: string;
  title: string;
  summary: string;
  imageUrl: string | null;
  categoryLabel: string;
  publishedLabel: string;
  officialSources: SourceItem[];
};

type HomePostItem = {
  post: CommunityPost;
  href: string;
  boardName: string;
  authorName: string;
  stats: ReturnType<typeof postAggregateDefaults>;
};

export default function HomeTopicSections() {
  const [events, setEvents] = useState<HomeEventItem[]>([]);
  const [seasonal, setSeasonal] = useState<HomeSeasonalItem[]>([]);
  const [news, setNews] = useState<HomeNewsItem[]>([]);
  const [posts, setPosts] = useState<HomePostItem[]>([]);
  const [dailyTopic, setDailyTopic] = useState<TopicCard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      setLoading(true);
      const [nextEvents, nextSeasonal, nextNews, nextPosts, nextDailyTopic] = await Promise.all([
        loadHomeEvents(),
        loadHomeSeasonalAnime(),
        loadHomeNews(),
        loadHomeCommunity(),
        loadHomeDailyTopic(),
      ]);

      if (!cancelled) {
        setEvents(nextEvents);
        setSeasonal(nextSeasonal);
        setNews(nextNews);
        setPosts(nextPosts);
        setDailyTopic(nextDailyTopic);
        setLoading(false);
      }
    }

    void refresh();
    const onTopicsUpdated = () => void refresh();
    window.addEventListener("storage", onTopicsUpdated);
    window.addEventListener("ssibduk:topics-updated", onTopicsUpdated);

    return () => {
      cancelled = true;
      window.removeEventListener("storage", onTopicsUpdated);
      window.removeEventListener("ssibduk:topics-updated", onTopicsUpdated);
    };
  }, []);

  const hotPosts = useMemo(() => {
    const filtered = posts.filter((item) => isRealtimeBestPost(item.post)).sort((a, b) => compareRealtimeBestPosts(a.post, b.post));
    return filtered.length > 0 ? filtered : [...posts].sort((a, b) => b.stats.upvote_count - a.stats.upvote_count);
  }, [posts]);

  return (
    <div className="flex flex-col gap-4">
      <DailyPickSection loading={loading} topic={dailyTopic} />
      <NewsSection loading={loading} news={news} />
      <PopularPostSection loading={loading} posts={hotPosts} />
      <ScheduleSection events={events} loading={loading} />
      <SeasonWatchSection loading={loading} seasonal={seasonal} />
      <ViralResultsSection />
    </div>
  );
}

function SectionFrame({
  title,
  caption,
  badge,
  href,
  moreLabel = "더보기",
  children,
}: {
  title: string;
  caption?: string;
  badge?: string;
  href?: string;
  moreLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-dashed border-gray-400 bg-white/75 p-2.5 shadow-sm">
      <div className="mb-2.5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-black text-gray-950">{title}</h2>
            {badge ? (
              <span className="border border-dashed border-gray-300 bg-gray-50 px-1.5 py-0.5 text-[10px] font-black text-gray-600">
                {badge}
              </span>
            ) : null}
          </div>
          {caption ? <p className="mt-1 text-[11px] leading-4 text-gray-500">{caption}</p> : null}
        </div>
        {href ? (
          <Link href={href} className="shrink-0 text-[11px] font-black text-gray-500 hover:text-gray-950">
            {moreLabel}
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function DailyPickSection({
  loading,
  topic,
}: {
  loading: boolean;
  topic: TopicCard | null;
}) {
  const pollCard = topic ?? createManualPollTopicCard();
  const topicLabel = pollCard.type === "poll" ? "오늘의 투표" : "오늘의 토픽";

  return (
    <SectionFrame title="오늘의 덕질픽" href="/topics" moreLabel="떡밥 더보기">
      {loading ? (
        <LoadingBox />
      ) : (
        <div className="grid gap-2.5 md:grid-cols-3">
          <TopicVotePickCard card={pollCard} label={topicLabel} />
          <CharacterRankPickCard />
          <SmallPickCard
            icon={<Sparkles size={16} />}
            label="매일 갱신"
            title="오늘 나랑 찰떡인 캐릭터는?"
            meta="별자리 운세 · 덕질운 · 추천 캐릭터"
            href="/play/fortune"
            cta="운세 보기"
            thumb={{ label: "운" }}
          />
        </div>
      )}
    </SectionFrame>
  );
}

function TopicVotePickCard({ card, label }: { card: TopicCard; label: string }) {
  const previewOptions = card.pollOptions.slice(0, 2);

  return (
    <Link href="/topics" className="group flex min-h-[142px] flex-col justify-between border border-dashed border-gray-300 bg-white p-2.5 hover:border-gray-700">
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-[11px] font-black text-gray-600">
          <span className="text-gray-400">
            <MessageCircle size={16} />
          </span>
          {label}
        </p>
        <h3 className="mt-1 line-clamp-2 text-xs font-black leading-[18px] text-gray-950 group-hover:underline">
          {card.title}
        </h3>
        <p className="mt-1 line-clamp-1 text-[11px] font-bold text-purple-700">{card.question}</p>
        {previewOptions.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {previewOptions.map((option) => (
              <span
                key={option}
                className="border border-dashed border-gray-300 px-1.5 py-0.5 text-[10px] font-bold text-gray-600"
              >
                {option}
              </span>
            ))}
            {card.pollOptions.length > 2 ? (
              <span className="px-1 py-0.5 text-[10px] font-bold text-gray-400">+{card.pollOptions.length - 2}</span>
            ) : null}
          </div>
        ) : null}
      </div>
      <span className="mt-2 inline-flex w-fit items-center gap-1 border border-dashed border-gray-300 px-2 py-0.5 text-[10px] font-black text-gray-700">
        참여하기
        <ChevronRight size={13} />
      </span>
    </Link>
  );
}

function CharacterRankPickCard() {
  return (
    <Link href="/play/worldcup" className="group flex min-h-[142px] flex-col justify-between border border-dashed border-gray-300 bg-white p-2.5 hover:border-gray-700">
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-[11px] font-black text-gray-600">
          <span className="text-gray-400">
            <Trophy size={16} />
          </span>
          캐릭터 순위
        </p>
        <h3 className="mt-1 line-clamp-1 text-xs font-black leading-[18px] text-gray-950 group-hover:underline">
          이번 주 최애 월드컵 TOP 3
        </h3>
        <ol className="mt-2 space-y-1">
          {MOCK_CHARACTER_RANKING.map((item) => (
            <li key={item.name} className="grid grid-cols-[18px_minmax(0,1fr)_52px] items-center gap-1.5 text-[11px]">
              <span className="font-black text-gray-400">{item.rank}</span>
              <span className="line-clamp-1 font-bold text-gray-800">{item.name}</span>
              <span className="text-right font-black text-amber-600">{item.votes.toLocaleString()}</span>
            </li>
          ))}
        </ol>
      </div>
      <span className="mt-2 inline-flex w-fit items-center gap-1 border border-dashed border-gray-300 px-2 py-0.5 text-[10px] font-black text-gray-700">
        순위 보기
        <ChevronRight size={13} />
      </span>
    </Link>
  );
}

function SmallPickCard({
  icon,
  label,
  title,
  meta,
  href,
  cta,
  thumb,
}: {
  icon: React.ReactNode;
  label: string;
  title: string;
  meta: string;
  href: string;
  cta: string;
  thumb: { src?: string | null; label: string };
}) {
  return (
    <Link href={href} className="group flex min-h-[142px] flex-col justify-between border border-dashed border-gray-300 bg-white p-2.5 hover:border-gray-700">
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[11px] font-black text-gray-600">
            <span className="text-gray-400">{icon}</span>
            {label}
          </p>
          <h3 className="mt-1 line-clamp-2 text-xs font-black leading-[18px] text-gray-950 group-hover:underline">{title}</h3>
          <p className="mt-1 text-[11px] font-bold text-red-500">{meta}</p>
        </div>
        <ThumbOne thumb={thumb} />
      </div>
      <span className="mt-2 inline-flex w-fit items-center gap-1 border border-dashed border-gray-300 px-2 py-0.5 text-[10px] font-black text-gray-700">
        {cta}
        <ChevronRight size={13} />
      </span>
    </Link>
  );
}

function ThumbOne({ thumb }: { thumb: { src?: string | null; label: string } }) {
  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden border border-dashed border-gray-300 bg-gray-100 text-xs font-black text-gray-400">
      {thumb.src ? <img src={thumb.src} alt="" className="h-full w-full object-cover" /> : thumb.label.slice(0, 1)}
    </div>
  );
}

const HOME_NEWS_TOTAL = 4;
const HOME_NEWS_SIDE_MAX = 3;

function NewsSection({ loading, news }: { loading: boolean; news: HomeNewsItem[] }) {
  const featured = news[0];
  const sideItems = news.slice(1, 1 + HOME_NEWS_SIDE_MAX);

  return (
    <SectionFrame title="새소식" href="/news" moreLabel="새소식 전체 보기">
      {loading ? (
        <LoadingBox />
      ) : !featured ? (
        <EmptyBox message="등록된 새소식이 아직 없습니다." />
      ) : (
        <div className="grid gap-2 lg:grid-cols-[minmax(0,1.15fr)_minmax(200px,0.85fr)] lg:items-start">
          <Link
            href={featured.href}
            className="group flex flex-col overflow-hidden border border-dashed border-gray-300 bg-white hover:border-gray-500"
          >
            <div className="aspect-[16/9] max-h-[132px] overflow-hidden bg-gray-100">
              <img
                src={featured.imageUrl ?? EMPTY_THUMB}
                alt=""
                className="h-full w-full object-cover transition-transform group-hover:scale-[1.03]"
              />
            </div>
            <div className="p-2.5">
              <p className="text-[11px] font-black text-gray-500">
                {featured.categoryLabel} · {featured.publishedLabel}
              </p>
              <h3 className="mt-0.5 line-clamp-2 text-sm font-black leading-5 text-gray-950 group-hover:underline">
                {featured.title}
              </h3>
              <p className="mt-0.5 line-clamp-1 text-xs leading-5 text-gray-600">{featured.summary}</p>
              <SourceButtons sources={featured.officialSources} />
            </div>
          </Link>

          <div className="grid gap-1.5">
            {sideItems.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className="grid grid-cols-[48px_minmax(0,1fr)] gap-1.5 border border-dashed border-gray-300 bg-white p-1.5 hover:bg-gray-50"
              >
                <div className="h-12 w-12 shrink-0 overflow-hidden bg-gray-100">
                  <img src={item.imageUrl ?? EMPTY_THUMB} alt="" className="h-full w-full object-cover" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black text-gray-500">
                    {item.categoryLabel} · {item.publishedLabel}
                  </p>
                  <p className="mt-0.5 line-clamp-1 text-xs font-black leading-4 text-gray-900">{item.title}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </SectionFrame>
  );
}

function SourceButtons({ sources }: { sources: SourceItem[] }) {
  const officialSources = sources.filter((source) => source.sourceType === "official").slice(0, 3);
  if (officialSources.length === 0) return null;

  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {officialSources.map((source) => (
        <a
          key={source.url}
          href={source.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 border border-dashed border-gray-300 px-2 py-0.5 text-[10px] font-black text-gray-600 hover:border-gray-700 hover:text-gray-950"
        >
          {source.title || "출처"}
          <ExternalLink size={10} />
        </a>
      ))}
    </div>
  );
}

function PopularPostSection({
  loading,
  posts,
}: {
  loading: boolean;
  posts: HomePostItem[];
}) {
  const cards = posts.slice(0, 3);

  return (
    <SectionFrame title="인기 게시글" href="/hot" moreLabel="실시간 베스트">
      {loading ? (
        <LoadingBox />
      ) : cards.length === 0 ? (
        <EmptyBox message="아직 인기 게시글이 없습니다." />
      ) : (
        <div className="grid gap-2.5 md:grid-cols-3">
          {cards.map((item, index) => (
            <Link key={item.post.id} href={item.href} className="group border border-dashed border-gray-300 bg-white p-2.5 hover:border-gray-700">
              <div className="flex gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center bg-gray-950 text-xs font-black text-white">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <span className="inline-flex border border-dashed border-gray-300 px-1.5 py-0.5 text-[10px] font-black text-gray-500">
                    {item.boardName}
                  </span>
                  <h3 className="mt-1 line-clamp-2 text-xs font-black leading-[18px] text-gray-950 group-hover:underline">{item.post.title || "제목 없음"}</h3>
                  <p className="mt-1 line-clamp-1 text-[11px] text-gray-500">
                    {item.authorName} · {formatCommunityDate(item.post.created_at)}
                  </p>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-3 text-[10px] font-bold text-gray-500">
                <Metric icon={<ThumbsUp size={12} />} value={item.stats.upvote_count} />
                <Metric icon={<MessageCircle size={12} />} value={item.stats.comment_count} />
                <Metric icon={<BarChart3 size={12} />} value={item.stats.view_count} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </SectionFrame>
  );
}

function ScheduleSection({ events, loading }: { events: HomeEventItem[]; loading: boolean }) {
  return (
    <SectionFrame
      title="놓치면 아쉬운 일정"
      caption="마감 임박, 티켓 오픈, 예약 마감 등 중요한 일정을 모았어요."
      href="/events"
      moreLabel="전체 일정 보기"
    >
      {loading ? (
        <LoadingBox />
      ) : events.length === 0 ? (
        <EmptyBox message="표시할 행사 일정이 없습니다." />
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-5">
          {events.slice(0, 4).map((item) => (
            <Link key={item.card.id} href={`/events/${item.card.relatedEventId}`} className="group block border border-dashed border-gray-300 bg-white p-1.5 hover:border-gray-700">
              <div className="relative mx-auto aspect-[3/4] max-w-[118px] overflow-hidden bg-gray-100">
                <img src={item.imageUrl ?? EMPTY_THUMB} alt="" className="h-full w-full object-cover transition-transform group-hover:scale-[1.03]" />
                <span className="absolute left-1.5 top-1.5 bg-gray-950 px-1.5 py-0.5 text-[10px] font-black text-white">{item.ddayLabel}</span>
                <span className="absolute bottom-1.5 left-1.5 border border-dashed border-gray-400 bg-white/90 px-1.5 py-0.5 text-[10px] font-black text-gray-700">
                  {item.typeLabel}
                </span>
              </div>
              <h3 className="mt-1.5 line-clamp-2 min-h-8 text-[11px] font-black leading-4 text-gray-950 group-hover:underline">{item.card.title}</h3>
              <p className="mt-1 line-clamp-1 text-[10px] font-bold text-gray-500">{item.dateLabel}</p>
              <p className="mt-0.5 line-clamp-1 text-[10px] text-gray-500">{item.locationLabel}</p>
            </Link>
          ))}
          <ScheduleAdCard />
        </div>
      )}
    </SectionFrame>
  );
}

function ScheduleAdCard() {
  return (
    <div className="flex min-h-[190px] flex-col justify-between border border-dashed border-gray-500 bg-gray-950 p-2 text-white">
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">AD</p>
        <h3 className="mt-1 text-sm font-black">일정 광고</h3>
        <p className="mt-1 text-[11px] leading-4 text-gray-300">팝업, 예매, 굿즈 프로모션 슬롯</p>
      </div>
      <span className="inline-flex w-fit border border-dashed border-gray-600 px-2 py-1 text-[10px] font-black text-gray-300">
        동일 카드 크기
      </span>
    </div>
  );
}

function SeasonWatchSection({ loading, seasonal }: { loading: boolean; seasonal: HomeSeasonalItem[] }) {
  const todayWeekday = getTodayWeekdayKo();
  const todayAll = seasonal.filter((item) => item.weekdayLabel === todayWeekday);
  const todayItems = [...todayAll]
    .sort((a, b) => a.popularityRank - b.popularityRank)
    .slice(0, HOME_SEASONAL_WEEKDAY_TOP);
  const topItems = seasonal.slice(0, 5);

  return (
    <SectionFrame title="이번 분기 뭐 봄?" caption="오늘 방영작과 유저 관심작을 확인해보세요." href="/season/current" moreLabel="전체 시간표 보기">
      {loading ? (
        <LoadingBox />
      ) : seasonal.length === 0 ? (
        <EmptyBox message="이번 분기 작품 정보가 없습니다." />
      ) : (
        <div className="grid gap-2.5 lg:grid-cols-3">
          <InfoPanel
            title={`오늘 방영작 · ${todayWeekday}요일`}
            icon={<Clock3 size={15} />}
            caption={
              todayAll.length > 0
                ? `인기순 TOP ${Math.min(HOME_SEASONAL_WEEKDAY_TOP, todayAll.length)} · 전체 ${todayAll.length}작`
                : undefined
            }
          >
            {todayItems.length > 0 ? (
              <ol className="space-y-1.5">
                {todayItems.map((item, index) => (
                  <li key={item.card.id}>
                    <Link
                      href={`/releases/${item.card.relatedWorkId}`}
                      className="grid grid-cols-[20px_34px_minmax(0,1fr)] items-center gap-2 text-xs hover:underline"
                    >
                      <span className="font-black text-gray-400">{index + 1}</span>
                      <span className="border border-dashed border-gray-800 bg-gray-900 px-1 py-0.5 text-center text-[10px] font-black text-white">
                        {todayWeekday}
                      </span>
                      <span className="line-clamp-1 font-bold text-gray-800">
                        {item.card.relatedWorkName ?? item.card.title}
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-xs leading-5 text-gray-500">오늘 요일로 등록된 방영작이 없습니다.</p>
            )}
            <Link href="/season/current" className="mt-3 inline-flex text-[11px] font-black text-gray-600 hover:underline">
              전체 시간표 보기
            </Link>
          </InfoPanel>
          <InfoPanel title="유저 관심 TOP 5" icon={<Trophy size={15} />}>
            <ol className="space-y-1.5">
              {topItems.map((item, index) => (
                <li key={item.card.id} className="grid grid-cols-[20px_minmax(0,1fr)_56px] items-center gap-2 text-xs">
                  <span className="font-black text-gray-400">{index + 1}</span>
                  <span className="line-clamp-1 font-bold text-gray-800">{item.card.relatedWorkName ?? item.card.title}</span>
                  <span className="text-right font-black text-gray-500">{item.interestCount.toLocaleString()}</span>
                </li>
              ))}
            </ol>
          </InfoPanel>
          <SeasonAdCard />
        </div>
      )}
    </SectionFrame>
  );
}

function SeasonAdCard() {
  return (
    <div className="flex min-h-[128px] flex-col justify-between border border-dashed border-gray-500 bg-gray-950 p-2.5 text-white">
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">AD</p>
        <h3 className="mt-1 text-sm font-black">분기 광고</h3>
        <p className="mt-1 text-[11px] leading-4 text-gray-300">신작, 스트리밍, 굿즈 캠페인 노출 영역</p>
      </div>
      <span className="inline-flex w-fit border border-dashed border-gray-600 px-2 py-1 text-[10px] font-black text-gray-300">
        300x120
      </span>
    </div>
  );
}

function ViralResultsSection() {
  return (
    <SectionFrame title="오늘의 덕질 결과" caption="오늘의 인기 결과를 확인하고, 나도 참여해보세요." href="/play" moreLabel="전체 보기">
      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <ResultCard
          title="애니 처방전 인기 결과"
          value="과몰입 회복불가형"
          percent="78%"
          summary="더 세계관을 충전했어요!"
          href="/play/recommend"
          cta="나도 해보기"
        />
        <ResultCard
          title="최애 카드 뽑기 결과"
          value="이번 주 가장 많이 뽑힌 카드"
          percent="61%"
          summary="이 카드가 가장 많았어요!"
          href="/play/oshi-card"
          cta="카드 만들기"
        />
        <div className="border border-dashed border-gray-300 bg-white p-2.5">
          <p className="text-[11px] font-black text-gray-500">많이 공유된 결과</p>
          <ol className="mt-2 space-y-1.5 text-xs">
            {["푸른 별과 마법의 서 2기", "하늘의 멜로디 OST", "성우 토크쇼 Vol.3 후기"].map((item, index) => (
              <li key={item} className="grid grid-cols-[18px_minmax(0,1fr)_54px] gap-2">
                <span className="font-black text-gray-400">{index + 1}</span>
                <span className="line-clamp-1 font-bold text-gray-800">{item}</span>
                <span className="text-right text-gray-500">공유 {1248 - index * 356}</span>
              </li>
            ))}
          </ol>
          <Link href="/news" className="mt-3 inline-flex text-[11px] font-black text-gray-600 hover:underline">
            결과 보러가기
          </Link>
        </div>
        <div className="border border-dashed border-gray-300 bg-gray-950 p-2.5 text-white">
          <p className="text-[11px] font-black text-gray-400">참여 CTA</p>
          <h3 className="mt-1 text-sm font-black">나도 참여해보세요!</h3>
          <div className="mt-3 grid grid-cols-3 gap-1.5">
            <MiniCta label="애니 처방전" />
            <MiniCta label="최애 카드" />
            <MiniCta label="덕질 테스트" />
          </div>
          <Link href="/play" className="mt-3 inline-flex h-7 w-full items-center justify-center border border-dashed border-gray-600 text-[11px] font-black hover:bg-white hover:text-gray-950">
            지금 참여하기
          </Link>
        </div>
      </div>
    </SectionFrame>
  );
}

function ResultCard({
  cta,
  href,
  percent,
  summary,
  title,
  value,
}: {
  cta: string;
  href: string;
  percent: string;
  summary: string;
  title: string;
  value: string;
}) {
  return (
    <Link href={href} className="group border border-dashed border-gray-300 bg-white p-2.5 hover:border-gray-700">
      <p className="text-[11px] font-black text-gray-500">{title}</p>
      <h3 className="mt-1.5 line-clamp-2 text-xs font-black leading-[18px] text-gray-950 group-hover:underline">{value}</h3>
      <p className="mt-2 text-2xl font-black text-gray-950">{percent}</p>
      <p className="mt-1 text-xs text-gray-500">{summary}</p>
      <span className="mt-2 inline-flex border border-dashed border-gray-300 px-2 py-0.5 text-[10px] font-black text-gray-700">
        {cta}
      </span>
    </Link>
  );
}

function MiniCta({ label }: { label: string }) {
  return (
    <div className="flex h-10 items-center justify-center border border-dashed border-gray-600 px-1 text-center text-[10px] font-black text-gray-100">
      {label}
    </div>
  );
}

function InfoPanel({
  caption,
  children,
  icon,
  title,
}: {
  caption?: string;
  children: React.ReactNode;
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <div className="border border-dashed border-gray-300 bg-white p-2.5">
      <h3 className="mb-1 flex items-center gap-1.5 text-xs font-black text-gray-950">
        <span className="text-gray-400">{icon}</span>
        {title}
      </h3>
      {caption ? <p className="mb-2.5 text-[10px] font-bold text-gray-500">{caption}</p> : <div className="mb-2.5" />}
      {children}
    </div>
  );
}

function Metric({ icon, value }: { icon: React.ReactNode; value: number }) {
  return (
    <span className="inline-flex items-center gap-1">
      {icon}
      {value.toLocaleString()}
    </span>
  );
}

function LoadingBox() {
  return <div className="border border-dashed border-gray-300 bg-white p-4 text-sm text-gray-500">불러오는 중...</div>;
}

function EmptyBox({ message }: { message: string }) {
  return <div className="border border-dashed border-gray-300 bg-white p-4 text-sm text-gray-500">{message}</div>;
}

async function loadHomeDailyTopic(): Promise<TopicCard> {
  const sourced = readApprovedSourcedTopicCards().find(
    (card) => card.status === "approved" && card.question.trim() && card.pollOptions.length > 0,
  );
  if (sourced) return sourced;
  return createManualPollTopicCard();
}

async function loadHomeNews(): Promise<HomeNewsItem[]> {
  const { data, error } = await supabase
    .from("news_items")
    .select("id, category, title, summary, thumbnail_url, published_at")
    .eq("status", "PUBLISHED")
    .order("published_at", { ascending: false })
    .limit(HOME_NEWS_TOTAL);

  if (error) {
    console.warn("[home] failed to load news items:", error.message);
    return [];
  }

  return ((data ?? []) as HomeNewsRow[]).map((row) => ({
    id: `news-${row.id}`,
    href: `/news/${row.id}`,
    title: row.title,
    summary: enforceTwoSentences(row.summary),
    imageUrl: row.thumbnail_url,
    categoryLabel: categoryLabel(row.category),
    publishedLabel: formatShortDate(row.published_at),
    officialSources: [],
  }));
}

async function loadHomeEvents(): Promise<HomeEventItem[]> {
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
      image_url,
      release_item_id,
      release_items (
        category,
        title,
        poster_url
      )
    `,
    )
    .eq("status", "PUBLISHED")
    .in("event_type", EVENT_TYPES)
    .order("starts_at", { ascending: true })
    .limit(5);

  if (error) {
    console.warn("[home] failed to load event topics:", error.message);
    return [];
  }

  return ((data ?? []) as HomeEventRow[]).map((row) => {
    const releaseItem = Array.isArray(row.release_items) ? row.release_items[0] : row.release_items;
    const normalized = { ...row, release_items: releaseItem };
    const card = createTopicCardFromEvent(normalized);
    const eventType = row.event_type.toLowerCase() as CalendarEventType;
    return {
      card,
      imageUrl: row.image_url ?? releaseItem?.poster_url ?? null,
      dateLabel: formatEventDatePeriod(row.starts_at, row.ends_at ?? undefined),
      typeLabel: EVENT_TYPE_LABELS[eventType] ?? "행사",
      ddayLabel: getDdayLabel(row.starts_at),
      locationLabel: row.location ?? row.platform ?? "장소 미정",
    };
  });
}

async function loadHomeSeasonalAnime(): Promise<HomeSeasonalItem[]> {
  const currentCours = getCurrentCours();
  const coursSlot = getCoursSlotKind(currentCours);
  const { data, error } = await supabase
    .from("release_items")
    .select("id, title, synopsis, poster_url, release_date, cours")
    .eq("category", "ANIME")
    .eq("status", "PUBLISHED")
    .eq("cours", currentCours)
    .order("release_date", { ascending: true, nullsFirst: false });

  let rows = (data ?? []) as HomeSeasonalRow[];

  if (error) {
    if (error.code !== "42703") {
      console.warn("[home] failed to load seasonal topics:", error.message);
      return [];
    }

    const { data: fallbackRows, error: fallbackError } = await supabase
      .from("release_items")
      .select("id, title, synopsis, poster_url, release_date")
      .eq("category", "ANIME")
      .eq("status", "PUBLISHED")
      .order("release_date", { ascending: true, nullsFirst: false });

    if (fallbackError) {
      console.warn("[home] failed to load seasonal fallback topics:", fallbackError.message);
      return [];
    }

    rows = ((fallbackRows ?? []) as HomeSeasonalRow[])
      .filter((row) => releaseDateToCours(row.release_date) === currentCours);
  }

  const ids = rows.map((row) => row.id);
  const votesByItem = ids.length
    ? buildVoteCountsByItem(
        (
          (
            await supabase
              .from("season_lineup_votes")
              .select("release_item_id, intent")
              .in("release_item_id", ids)
          ).data ?? []
        ) as Array<{ release_item_id: string; intent: "watch" | "maybe" | "skip" }>,
      )
    : {};

  let reviewAgg: Record<string, ReviewAgg> = {};
  if (ids.length > 0) {
    const { data: reviewRows, error: reviewError } = await supabase
      .from("release_item_reviews")
      .select("release_item_id, stars")
      .in("release_item_id", ids);

    if (reviewError) {
      if (reviewError.code !== "42P01" && !reviewError.message?.includes("does not exist")) {
        console.warn("[home] failed to load release_item_reviews:", reviewError.message);
      }
    } else {
      reviewAgg = buildReviewAggByItem(
        (reviewRows ?? []) as Array<{ release_item_id: string; stars: number }>,
      );
    }
  }

  const sortedRows = [...rows].sort((a, b) => {
    if (coursSlot === "ahead") {
      const heatDiff = lineupHeatScore(votesByItem[b.id]) - lineupHeatScore(votesByItem[a.id]);
      if (heatDiff !== 0) return heatDiff;
      return (a.release_date ?? "").localeCompare(b.release_date ?? "");
    }
    return compareReleasePopularity(a.id, b.id, reviewAgg, votesByItem);
  });

  return sortedRows.map((row, index) => ({
    card: createTopicCardFromSeasonalAnime(row, index),
    imageUrl: row.poster_url,
    dateLabel: formatShortDate(row.release_date),
    weekdayLabel: releaseDateToWeekdayKo(row.release_date),
    interestCount: popularityDisplayCount(row.id, reviewAgg, votesByItem),
    popularityRank: index,
  }));
}

async function loadHomeCommunity(): Promise<HomePostItem[]> {
  const { data, error } = await supabase
    .from("posts")
    .select("*, profiles(id, nickname, display_name), boards(slug, name)")
    .eq("status", "NORMAL")
    .eq("source_type", "BOARD")
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    console.warn("[home] failed to load posts:", error.message);
    return [];
  }

  return ((data ?? []) as CommunityPost[]).map((post) => {
    const boardName = post.boards?.name ?? "게시판";
    const boardSlug = post.boards?.slug;
    const authorName =
      post.profiles?.nickname ||
      post.profiles?.display_name ||
      post.anonymous_nickname ||
      post.author_email?.split("@")[0] ||
      "익명";

    return {
      post,
      href: boardSlug ? `/board/${boardSlug}/${post.id}` : "/board",
      boardName,
      authorName: truncate(authorName, 8),
      stats: postAggregateDefaults(post),
    };
  });
}

function categoryLabel(value: string): string {
  const normalized = value.toLowerCase();
  if (normalized === "anime") return "애니";
  if (normalized === "manga") return "만화";
  if (normalized === "game") return "게임";
  return "소식";
}

function enforceTwoSentences(value: string): string {
  const trimmed = value.trim().replace(/\s+/g, " ");
  const sentences = trimmed.match(/[^.!?。！？]+[.!?。！？]?/g) ?? [trimmed];
  return sentences.slice(0, 2).join(" ").trim();
}

function formatShortDate(value: string | null | undefined): string {
  if (!value) return "날짜 미정";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).format(new Date(value));
}

function getDdayLabel(value: string | null | undefined): string {
  if (!value) return "D-?";
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return "D-?";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  const diff = Math.ceil((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  if (diff === 0) return "D-DAY";
  if (diff < 0) return "진행중";
  return `D-${diff}`;
}

function releaseDateToCours(dateValue: string | null): string | null {
  if (!dateValue) return null;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;
  const month = date.getMonth() + 1;
  const quarter = month <= 3 ? 1 : month <= 6 ? 2 : month <= 9 ? 3 : 4;
  return `${date.getFullYear()}-Q${quarter}`;
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}
