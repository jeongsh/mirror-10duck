"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { ArrowLeft, ExternalLink, Heart, ImageIcon, MapPin, Send } from "lucide-react";
import RichContent from "@/components/stickers/RichContent";
import { supabase } from "@/lib/supabase/client";
import {
  EVENT_TYPE_LABELS,
  formatEventDatePeriod,
  getCalendarEventCategory,
  type CalendarEvent,
  type CalendarEventType,
} from "@/lib/otaku/hub";
import type { EventSectionKind } from "@/components/calendar/EventGalleryPage";

type ReleaseEventDetailRow = {
  id: string;
  event_type: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  timezone: string;
  episode_label: string | null;
  platform: string | null;
  location: string | null;
  source_url: string | null;
  image_url: string | null;
  detail_image_url: string | null;
  release_item_id: string | null;
  release_items?: {
    id?: string;
    category?: string | null;
    title?: string | null;
    poster_url?: string | null;
  } | null;
};

const DETAIL_META: Record<EventSectionKind, { listHref: string; listLabel: string; title: string }> = {
  release: { listHref: "/events", listLabel: "이벤트 목록", title: "이벤트 상세" },
};

export default function EventDetailPage({
  params,
  kind,
}: {
  params: Promise<{ id: string }>;
  kind: EventSectionKind;
}) {
  const { id } = use(params);
  const meta = DETAIL_META[kind];
  const [event, setEvent] = useState<CalendarEvent | null>(null);
  const [relatedReleaseTitle, setRelatedReleaseTitle] = useState<string | null>(null);
  const [detailImageUrl, setDetailImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("release_events")
        .select(`
          id,
          event_type,
          title,
          description,
          starts_at,
          ends_at,
          timezone,
          episode_label,
          platform,
          location,
          source_url,
          image_url,
          detail_image_url,
          release_item_id,
          release_items (
            id,
            category,
            title,
            poster_url
          )
        `)
        .eq("id", id)
        .eq("status", "PUBLISHED")
        .single();

      if (cancelled) return;
      if (error || !data) {
        setEvent(null);
        setRelatedReleaseTitle(null);
        setDetailImageUrl(null);
      } else {
        const row = data as ReleaseEventDetailRow;
        setEvent(mapReleaseEvent(row));
        setRelatedReleaseTitle(row.release_items?.title ?? null);
        setDetailImageUrl(row.detail_image_url);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) return <main className="p-6 text-sm text-gray-500">일정 불러오는 중...</main>;

  if (!event) {
    return (
      <main className="flex min-h-[360px] flex-col items-center justify-center gap-3 p-6">
        <h1 className="text-xl font-bold text-gray-900">일정을 찾을 수 없습니다.</h1>
        <Link href={meta.listHref} className="border border-dashed border-gray-500 px-3 py-2 text-sm hover:bg-gray-100">
          {meta.listLabel}
        </Link>
      </main>
    );
  }

  const isGoods = ["goods_preorder", "goods_release"].includes(event.type);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <Link
        href={meta.listHref}
        className="inline-flex w-fit items-center gap-1 border border-dashed border-gray-500 bg-white px-3 py-2 text-sm hover:bg-gray-100"
      >
        <ArrowLeft size={15} />
        {meta.listLabel}
      </Link>

      <article className="border border-dashed border-gray-500 bg-white/85">
        <div className="flex min-h-[280px] items-center justify-center border-b border-dashed border-gray-400 bg-gray-100">
          {event.imageUrl ? (
            <img src={event.imageUrl} alt="" className="max-h-[520px] w-full object-contain" />
          ) : (
            <ImageIcon size={40} className="text-gray-400" />
          )}
        </div>

        <div className="p-4">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-gray-500">
            <span className="border border-dashed border-gray-400 bg-gray-100 px-2 py-1">
              {EVENT_TYPE_LABELS[event.type]}
            </span>
            <span>{meta.title}</span>
          </div>
          <h1 className="mt-3 text-2xl font-bold text-gray-950">{event.title}</h1>
          {relatedReleaseTitle ? <p className="mt-2 text-sm text-gray-600">관련 작품: {relatedReleaseTitle}</p> : null}

          <section className="mt-4 grid gap-3 border-t border-dashed border-gray-300 pt-4 md:grid-cols-2">
            <InfoBlock label="일정" value={formatEventDatePeriod(event.startsAt, event.endsAt)} />
            {!isGoods ? (
              <InfoBlock label="위치" value={event.location ?? event.platform ?? "미정"} icon={<MapPin size={13} />} />
            ) : null}
          </section>

          {/* {!isGoods ? (
            <section className="mt-4 border border-dashed border-gray-300 bg-gray-50 p-4">
              <p className="text-xs font-bold text-gray-500">지도</p>
              <div className="mt-2 flex h-44 items-center justify-center border border-dashed border-gray-300 bg-white text-sm text-gray-400">
                지도 영역
              </div>
            </section>
          ) : null} */}

          <section className="mt-4">
            <h2 className="text-sm font-bold text-gray-900">정보</h2>
            {event.description ? (
              <RichContent content={event.description} className="mt-2" disableMentions />
            ) : (
              <p className="mt-2 text-sm text-gray-500">등록된 상세 정보가 없습니다.</p>
            )}
          </section>

          {detailImageUrl ? (
            <section className="mt-4">
              <h2 className="text-sm font-bold text-gray-900">상세 이미지</h2>
              <div className="mt-2 overflow-hidden border border-dashed border-gray-300 bg-gray-50">
                <img src={detailImageUrl} alt="" className="w-full object-contain" />
              </div>
            </section>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex h-10 items-center gap-1 border border-dashed border-gray-500 bg-white px-3 text-sm font-semibold hover:bg-gray-100"
            >
              <Heart size={15} />
              팔로우
            </button>
            <button
              type="button"
              className="inline-flex h-10 items-center gap-1 border border-dashed border-gray-500 bg-white px-3 text-sm font-semibold hover:bg-gray-100"
            >
              <Send size={15} />
              제보하기
            </button>
            {event.sourceUrl ? (
              <a
                href={event.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center gap-1 border border-dashed border-blue-400 bg-blue-50 px-3 text-sm font-semibold text-blue-700 hover:bg-blue-100"
              >
                <ExternalLink size={15} />
                홈페이지
              </a>
            ) : null}
          </div>
        </div>
      </article>

      <section className="border border-dashed border-gray-500 bg-white/80 p-4">
        <h2 className="text-sm font-bold text-gray-900">후기</h2>
        <p className="mt-2 text-sm text-gray-500">후기 영역은 다음 단계에서 연결합니다.</p>
      </section>
    </main>
  );
}

function InfoBlock({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) {
  return (
    <div className="border border-dashed border-gray-300 bg-white p-3">
      <p className="text-xs font-bold text-gray-500">{label}</p>
      <p className="mt-1 flex items-center gap-1 text-sm font-semibold text-gray-900">
        {icon}
        {value}
      </p>
    </div>
  );
}

function mapReleaseEvent(row: ReleaseEventDetailRow): CalendarEvent {
  const type = row.event_type.toLowerCase() as CalendarEventType;
  return {
    id: row.id,
    contentId: row.release_item_id ?? undefined,
    category: getCalendarEventCategory(row.event_type, row.release_items?.category),
    type,
    title: row.title,
    description: row.description ?? undefined,
    startsAt: row.starts_at,
    endsAt: row.ends_at ?? undefined,
    timezone: row.timezone,
    episodeLabel: row.episode_label ?? undefined,
    platform: row.platform ?? row.release_items?.title ?? undefined,
    location: row.location ?? undefined,
    sourceUrl: row.source_url ?? undefined,
    imageUrl: row.image_url ?? row.release_items?.poster_url ?? undefined,
    isFollowing: false,
    reminderOffsetMinutes: null,
  };
}
