"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import RichContent from "@/components/stickers/RichContent";
import CommentSection from "@/components/community/CommentSection";
import { supabase } from "@/lib/supabase/client";
import {
  CATEGORY_LABELS,
  formatDateTime,
  getNewsItemById,
  type NewsItem,
  type OtakuCategory,
} from "@/lib/otaku/hub";

export default function NewsDetailPage() {
  const params = useParams<{ id: string }>();
  const [item, setItem] = useState<NewsItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewer, setViewer] = useState<{ id: string; email: string } | null>(null);

  // 로컬 상태로 기능 구현 (데모용 기본값)
  const [reactions, setReactions] = useState([
    { type: "열혈", count: 0, emoji: "😡" },
    { type: "좋아요", count: 0, emoji: "👍" },
    { type: "재미", count: 0, emoji: "🍕" },
    { type: "웃김", count: 0, emoji: "😆" },
    { type: "신기", count: 0, emoji: "🐱" },
    { type: "부러워요", count: 0, emoji: "🥺" },
    { type: "응원", count: 0, emoji: "👏" },
    { type: "녹는다", count: 0, emoji: "🫠" },
  ]);

  const fetchReactions = async (id: string) => {
    const { data, error } = await supabase
      .from("news_reactions")
      .select("reaction_type")
      .eq("news_id", id);

    if (!error && data) {
      const counts: Record<string, number> = {};
      data.forEach((r) => {
        counts[r.reaction_type] = (counts[r.reaction_type] || 0) + 1;
      });

      setReactions((prev) =>
        prev.map((r) => ({
          ...r,
          count: counts[r.type] || 0,
        }))
      );
    }
  };

  useEffect(() => {
    const fetchItem = async () => {
      setLoading(true);
      const id = decodeURIComponent(params.id);
      
      // 유저 정보 가져오기
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        setViewer({ id: userData.user.id, email: userData.user.email || "" });
      }

      const { data, error } = await supabase
        .from("news_items")
        .select("id, category, title, summary, body_json, status, published_at, thumbnail_url, tags")
        .eq("id", id)
        .single();

      if (error) {
        console.error("Error fetching news detail:", error);
        setItem(getNewsItemById(id));
      } else if (data) {
        const mappedData: NewsItem = {
          id: data.id,
          category: data.category.toLowerCase() as Exclude<OtakuCategory, "all">,
          title: data.title,
          summary: data.summary,
          body: JSON.stringify(data.body_json),
          publishedAt: data.published_at || new Date().toISOString(),
          thumbnailUrl: data.thumbnail_url || "",
          tags: data.tags || [],
          status: data.status.toLowerCase() as "draft" | "published" | "hidden",
          editorName: "운영팀",
        };
        setItem(mappedData);
        
        void fetchReactions(data.id);
      }
      setLoading(false);
    };

    if (params.id) {
      void fetchItem();
    }
  }, [params.id]);

  const handleReaction = async (index: number) => {
    const reaction = reactions[index];
    const id = decodeURIComponent(params.id);
    
    setReactions((prev) =>
      prev.map((r, i) => (i === index ? { ...r, count: r.count + 1 } : r))
    );

    if (!viewer) {
      alert("로그인이 필요합니다.");
      return;
    }

    const { error } = await supabase.from("news_reactions").insert({
      news_id: id,
      user_id: viewer.id,
      reaction_type: reaction.type,
    });

    if (error) {
      console.error("Reaction failed:", error);
      setReactions((prev) =>
        prev.map((r, i) => (i === index ? { ...r, count: r.count - 1 } : r))
      );
    }
  };

  if (loading) {
    return (
      <main className="border border-dashed border-gray-500 bg-white/80 p-6">
        <p className="text-sm text-gray-500">로딩 중...</p>
      </main>
    );
  }

  if (!item) {
    return (
      <main className="border border-dashed border-gray-500 bg-white/80 p-6">
        <h1 className="text-xl font-bold text-gray-900">소식을 찾을 수 없습니다.</h1>
        <Link href="/news" className="mt-4 inline-block text-sm text-gray-600 hover:underline">
          소식 목록으로 돌아가기
        </Link>
      </main>
    );
  }

  return (
    <main className="flex w-full flex-col gap-4 bg-white p-6 max-w-4xl mx-auto text-gray-900">
      {/* Header */}
      <header className="border-b border-gray-300 pb-4">
        <div className="flex justify-between text-xs text-gray-500 mb-2">
          <span>날짜: {formatDateTime(item.publishedAt)}</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-950 mb-3">{item.title}</h1>
        <div className="flex justify-between items-center text-sm text-gray-600">
          <span>{item.editorName} 기자</span>
          <span className="text-xs border border-gray-300 px-2 py-0.5 bg-gray-50">{CATEGORY_LABELS[item.category]}</span>
        </div>
      </header>

      {/* Body */}
      <article className="py-4">
        {item.thumbnailUrl && (
          <div className="w-full mb-6 overflow-hidden">
            <img src={item.thumbnailUrl} alt="" className="w-full h-auto object-cover" />
          </div>
        )}
        
        <p className="font-bold text-lg mb-4 text-gray-800">{item.summary}</p>
        
        <div className="leading-8 text-gray-800 text-base">
          <RichContent content={item.body} />
        </div>
      </article>

      {/* Tags */}
      <div className="flex flex-wrap gap-2 py-4 border-t border-gray-200">
        <span className="text-sm font-bold text-gray-600">TAGS:</span>
        {item.tags.map((tag) => (
          <span key={tag} className="text-sm text-blue-600 hover:underline cursor-pointer">
            #{tag}
          </span>
        ))}
      </div>

      {/* Reactions */}
      <section className="border-t border-b border-gray-200 py-6 my-4">
        <p className="text-center text-sm text-gray-600 mb-4">이 기사에 대해 어떻게 생각하시나요?</p>
        <div className="flex justify-center gap-4 flex-wrap">
          {reactions.map((r, index) => (
            <button
              key={r.type}
              onClick={() => handleReaction(index)}
              className="flex flex-col items-center p-2 border border-transparent hover:border-gray-200 rounded min-w-[60px]"
            >
              <span className="text-3xl mb-1">{r.emoji}</span>
              <span className="text-xs text-gray-700">{r.type}</span>
              <span className="text-xs font-bold text-gray-900">{r.count}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Author Box */}
      <section className="bg-gray-50 p-4 flex gap-4 items-center border border-gray-200">
        <div className="w-16 h-16 bg-gray-300 rounded-full flex-shrink-0 flex items-center justify-center text-2xl">
          📰
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-base">{item.editorName} 기자</p>
          <p className="text-xs text-gray-500 truncate">contact@10duck.com</p>
          <div className="flex gap-2 mt-2 text-xs">
            <button className="border border-gray-300 bg-white px-2 py-1 hover:bg-gray-50">구독하기</button>
            <button className="border border-gray-300 bg-white px-2 py-1 hover:bg-gray-50">다른 기사 보기</button>
          </div>
        </div>
      </section>

      {/* Comments */}
      <div className="mt-6">
        <CommentSection
          postId={item.id}
          viewerId={viewer?.id || null}
          viewerEmail={viewer?.email || null}
          allowAnonymous={false}
          isNews={true}
          mentionMode="none"
        />
      </div>

      {/* Navigation */}
      <div className="flex justify-between mt-6 border-t border-gray-200 pt-4 text-sm">
        <Link href="/news" className="text-gray-600 hover:underline">
          ← 목록으로
        </Link>
        <button className="text-gray-600 hover:underline" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          위로 가기
        </button>
      </div>
    </main>
  );
}

