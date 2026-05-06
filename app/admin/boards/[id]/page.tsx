"use client";

import { useEffect, useState, use } from "react";
import { supabase } from "@/lib/supabase/client";
import { Board } from "@/types/community";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function BoardManagementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);

  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [hotThreshold, setHotThreshold] = useState<number>(5);
  const [allowAnonymous, setAllowAnonymous] = useState(true);
  const [allowMedia, setAllowMedia] = useState(true);
  const [isNsfw, setIsNsfw] = useState(false);

  useEffect(() => {
    const fetchBoard = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("boards")
        .select("*")
        .eq("id", id)
        .single();
        
      if (data) {
        setBoard(data);
        setSlug(data.slug);
        setName(data.name);
        setDescription(data.description || "");
        setHotThreshold(data.hot_threshold);
        setAllowAnonymous(data.allow_anonymous);
        setAllowMedia(data.allow_media);
        setIsNsfw(data.is_nsfw);
      } else if (error) {
        alert("게시판 정보를 불러오지 못했습니다.");
        router.push("/admin/boards");
      }
      setLoading(false);
    };

    fetchBoard();
  }, [id, router]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug || !name) return alert("슬러그와 이름은 필수입니다.");

    const { error } = await supabase
      .from("boards")
      .update({ 
        slug, 
        name, 
        description, 
        hot_threshold: hotThreshold,
        allow_anonymous: allowAnonymous,
        allow_media: allowMedia,
        is_nsfw: isNsfw
      })
      .eq("id", id);
      
    if (error) {
      alert("수정 실패: " + error.message);
    } else {
      alert("게시판 설정이 저장되었습니다.");
      // optionally refresh data
    }
  };

  const handleDelete = async () => {
    if (!confirm("정말 이 게시판을 삭제하시겠습니까? 관련된 모든 글이 함께 삭제될 수 있습니다. (되돌릴 수 없음)")) return;
    
    const { error } = await supabase.from("boards").delete().eq("id", id);
    if (error) {
      alert("삭제 실패: " + error.message);
    } else {
      alert("삭제되었습니다.");
      router.push("/admin/boards");
    }
  };

  if (loading) return <div className="p-6">로딩 중...</div>;
  if (!board) return null;

  return (
    <div className="mx-auto max-w-2xl flex flex-col gap-6">
      <div className="flex items-center gap-4 border-b border-dashed border-gray-500 pb-4">
        <Link href="/admin/boards" className="text-gray-500 hover:text-black">
          ← 뒤로가기
        </Link>
        <div>
          <h2 className="text-xl font-bold">{board.name} 관리</h2>
          <p className="mt-1 text-sm text-gray-600">게시판의 기본 설정 및 메타데이터를 수정합니다.</p>
        </div>
      </div>

      <form onSubmit={handleUpdate} className="flex flex-col gap-4 rounded border border-dashed border-gray-500 bg-white/70 p-6">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold">슬러그 (URL 경로) *</span>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
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
            className="rounded border p-2 focus:border-black focus:outline-none"
            required
          />
        </label>
        
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold">설명</span>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="rounded border p-2 focus:border-black focus:outline-none"
          />
        </label>
        
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold">개념글 추천 컷 (hot_threshold)</span>
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
              <span className="text-sm font-semibold">익명 글쓰기 허용</span>
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
              <span className="text-sm font-semibold">미디어 첨부 허용</span>
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
            저장하기
          </button>
        </div>
      </form>

      <div className="rounded border border-red-300 bg-red-50 p-6 mt-8">
        <h3 className="text-lg font-bold text-red-600 mb-2">위험 구역</h3>
        <p className="text-sm text-red-800 mb-4">게시판을 삭제하면 해당 게시판의 모든 글과 데이터가 삭제될 수 있습니다. 이 작업은 되돌릴 수 없습니다.</p>
        <button
          onClick={handleDelete}
          className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700 transition-colors"
        >
          게시판 영구 삭제
        </button>
      </div>
    </div>
  );
}
