"use client";

import Link from "next/link";
import { CalendarDays, ExternalLink, MapPin } from "lucide-react";
import type { FeedAttachmentCard } from "@/lib/community/feedContentDisplay";

const MOCK_EVENT = {
  id: "e02d23ce-10f5-4773-b84c-52507367d928",
  title: "코믹월드 SUMMER 2026",
  startsAt: "2026.07.18 - 07.19",
  location: "일산 킨텍스 제1전시장",
  imageUrl: "https://comicw.net/data/item/1775781342/16_7ISc7L2U7Ys7Iqk7YSw_7I2464Sk7J28.png",
};

export default function FeedAttachmentCards({ cards }: { cards: FeedAttachmentCard[] }) {
  if (cards.length === 0) return null;

  return (
    <div className="mt-3 space-y-2">
      {cards.map((card, index) => {
        if (card.type === "url") {
          return (
            <a
              key={`${card.type}-${card.label}-${index}`}
              href={card.url ?? card.label}
              target="_blank"
              rel="noreferrer"
              className="flex min-w-0 items-center gap-3 rounded-[8px] border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-blue-600 hover:border-blue-300 hover:bg-blue-50"
            >
              <ExternalLink size={17} className="shrink-0" />
              <span className="line-clamp-1 min-w-0 break-all">{card.url ?? card.label}</span>
            </a>
          );
        }

        const isWish = card.type === "wish";

        return (
          <Link
            key={`${card.type}-${card.label}-${index}`}
            href={`/events/${MOCK_EVENT.id}`}
            className={`group flex min-w-0 items-center gap-3 rounded-[8px] border bg-white p-2 text-left hover:border-gray-900 hover:bg-gray-50 ${
              isWish ? "border-rose-200" : "border-sky-200"
            }`}
          >
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-[6px] border border-gray-200 bg-gray-100">
              <img
                src={MOCK_EVENT.imageUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-2">
                <span
                  className={`rounded-[6px] px-2 py-0.5 text-[11px] font-bold ${
                    isWish ? "bg-rose-50 text-rose-700" : "bg-sky-50 text-sky-700"
                  }`}
                >
                  {isWish ? "위시" : "모집"}
                </span>
                {card.meta ? (
                  <span className="line-clamp-1 text-xs font-semibold text-gray-500">{card.meta}</span>
                ) : null}
              </div>
              <p className="line-clamp-1 text-sm font-bold text-gray-950 group-hover:underline">
                {MOCK_EVENT.title}
              </p>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-gray-500">
                <span className="flex items-center gap-1">
                  <CalendarDays size={13} />
                  {MOCK_EVENT.startsAt}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin size={13} />
                  {MOCK_EVENT.location}
                </span>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
