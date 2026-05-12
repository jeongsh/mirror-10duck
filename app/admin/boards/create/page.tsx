"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import {
  BOARD_CATEGORY_OPTIONS,
  type BoardCategory,
} from "@/lib/community/boardCategories";

export default function CreateBoardPage() {
  const router = useRouter();
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState<BoardCategory>("general");
  const [description, setDescription] = useState("");
  const [hotThreshold, setHotThreshold] = useState<number>(5);
  const [allowAnonymous, setAllowAnonymous] = useState(true);
  const [allowMedia, setAllowMedia] = useState(true);
  const [isNsfw, setIsNsfw] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug || !name) return alert("슬러그와 이름은 필수입니다.");

    const { error } = await supabase
      .from("boards")
      .insert([{ 
        slug, 
        name, 
        category,
        description, 
        hot_threshold: hotThreshold,
        allow_anonymous: allowAnonymous,
        allow_media: allowMedia,
        is_nsfw: isNsfw
      }]);
      
    if (error) {
      alert("생성 실패: " + error.message);
    } else {
      alert("게시판이 성공적으로 추가되었습니다.");
      router.push("/admin/boards");
    }
  };

  return (
    <div className="mx-auto max-w-2xl flex flex-col gap-6">
      <div className="border-b border-dashed border-gray-500 pb-4">
        <h2 className="text-xl font-bold">새 게시판 추가</h2>
        <p className="mt-1 text-sm text-gray-600">새로운 게시판 채널을 개설합니다.</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded border border-dashed border-gray-500 bg-white/70 p-6">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold">슬러그 (URL 경로) *</span>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="ex) free, humor"
            className="rounded border p-2 focus:border-black focus:outline-none"
            required
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold">게시판 이름 *</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ex) 자유게시판"
            className="rounded border p-2 focus:border-black focus:outline-none"
            required
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold">카테고리 *</span>
          <p className="text-xs text-gray-500">채널 목록에서 애니, 게임, 취미 등으로 묶여 표시됩니다.</p>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as BoardCategory)}
            className="rounded border border-gray-300 bg-white p-2 focus:border-black focus:outline-none"
          >
            {BOARD_CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold">설명</span>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="게시판에 대한 간단한 설명"
            className="rounded border p-2 focus:border-black focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold">초기 개념글 추천 컷 (hot_threshold)</span>
          <p className="text-xs text-gray-500">추천 수가 이 수치를 넘으면 피드의 '개념글'에 노출됩니다.</p>
          <input
            type="number"
            value={hotThreshold}
            onChange={(e) => setHotThreshold(Number(e.target.value))}
            min={1}
            className="rounded border p-2 focus:border-black focus:outline-none"
          />
        </label>
        <div className="flex flex-col gap-3 border-t border-dashed border-gray-300 pt-4 mt-2">
          <h3 className="text-sm font-bold">운영 정책</h3>
          
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={allowAnonymous}
              onChange={(e) => setAllowAnonymous(e.target.checked)}
              className="w-4 h-4"
            />
            <div className="flex flex-col">
              <span className="text-sm font-semibold">익명 글쓰기 허용 (기본 활성)</span>
              <p className="text-xs text-gray-500">비로그인 사용자가 글과 댓글을 작성할 수 있습니다.</p>
            </div>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={allowMedia}
              onChange={(e) => setAllowMedia(e.target.checked)}
              className="w-4 h-4"
            />
            <div className="flex flex-col">
              <span className="text-sm font-semibold">미디어 첨부 허용 (기본 활성)</span>
              <p className="text-xs text-gray-500">이미지, 영상 등 멀티미디어 업로드를 허용합니다.</p>
            </div>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isNsfw}
              onChange={(e) => setIsNsfw(e.target.checked)}
              className="w-4 h-4"
            />
            <div className="flex flex-col">
              <span className="text-sm font-semibold">NSFW (성인용 콘텐츠)</span>
              <p className="text-xs text-gray-500">성인용 콘텐츠가 포함될 수 있는 게시판으로 설정합니다.</p>
            </div>
          </label>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="submit"
            className="rounded bg-black px-4 py-2 text-white transition-opacity hover:opacity-80"
          >
            추가하기
          </button>
          <button
            type="button"
            onClick={() => router.push("/admin/boards")}
            className="rounded border border-gray-300 bg-gray-100 px-4 py-2 transition-colors hover:bg-gray-200"
          >
            취소
          </button>
        </div>
      </form>
    </div>
  );
}
