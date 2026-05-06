"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useState, Suspense } from "react";
import { supabase } from "@/lib/supabase/client";
import { useAuthUser } from "@/lib/supabase/useAuthUser";
import { Board } from "@/types/community";
import CommunityEditor from "@/components/community/editor/CommunityEditor";

function WritePostContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const editId = searchParams.get("edit");
  const authUser = useAuthUser();

  const [board, setBoard] = useState<Board | null>(null);
  const [title, setTitle] = useState("");
  const [prefix, setPrefix] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [message, setMessage] = useState("");

  const userId = authUser?.id ?? "";
  const userEmail = authUser?.email ?? "";

  const PREFIXES = ["잡담", "정보", "질문", "창작", "공지"];

  // 이탈 방지 (Exit Guard)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // 내용이나 제목이 있는 경우에만 경고
      if ((title.trim() || content.trim()) && !loading) {
        e.preventDefault();
        e.returnValue = ""; // 브라우저 표준에 따라 빈 문자열 설정
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [title, content, loading]);

  useEffect(() => {
    let cancelled = false;

    const fetchBoard = async () => {
      if (!slug) return;
      const { data } = await supabase
        .from("boards")
        .select("*")
        .eq("slug", slug)
        .single();
      if (!cancelled) setBoard((data as Board | null) ?? null);
    };

    void fetchBoard();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  // 수정 모드인 경우 데이터 불러오기
  useEffect(() => {
    if (!editId) return;

    const fetchPost = async () => {
      setFetching(true);
      const { data, error } = await supabase
        .from("posts")
        .select("*")
        .eq("id", editId)
        .single();
      
      setFetching(false);

      if (error) {
        setMessage("게시글을 불러오지 못했습니다: " + error.message);
        return;
      }

      if (data) {
        if (data.author_id !== authUser?.id) {
          alert("수정 권한이 없습니다.");
          router.replace(`/board/${slug}/${editId}`);
          return;
        }
        
        // 제목에서 말머리 추출 ([말머리] 제목 형식 가정)
        const titleMatch = data.title?.match(/^\[([^\]]+)\]\s*(.*)$/);
        if (titleMatch) {
          setPrefix(titleMatch[1]);
          setTitle(titleMatch[2]);
        } else {
          setTitle(data.title || "");
        }
        
        setContent(data.content || "");
      }
    };

    if (authUser) {
      void fetchPost();
    }
  }, [editId, authUser, router, slug]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!userId || !userEmail) {
      setMessage("글쓰기는 로그인 후 가능합니다.");
      return;
    }
    if (!board) {
      setMessage("게시판 정보를 불러오지 못했습니다.");
      return;
    }

    const finalTitle = prefix ? `[${prefix}] ${title}` : title;
    
    // 등록/수정 성공 시 이탈 방지 해제를 위해 상태 변경
    setLoading(true);
    setMessage("");

    if (editId) {
      // 수정 모드
      const { error } = await supabase
        .from("posts")
        .update({
          title: finalTitle,
          content,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editId);

      setLoading(false);

      if (error) {
        setMessage(error.message);
        return;
      }

      router.push(`/board/${slug}/${editId}`);
    } else {
      // 생성 모드
      const { data, error } = await supabase
        .from("posts")
        .insert({
          title: finalTitle,
          content,
          board_id: board.id,
          source_type: "BOARD",
          author_id: userId,
          author_email: userEmail,
        })
        .select("id")
        .single();

      setLoading(false);

      if (error) {
        setMessage(error.message);
        return;
      }

      router.push(`/board/${slug}/${data.id}`);
    }
  };

  if (fetching) {
    return (
      <div className="flex flex-col gap-4">
        <header className="border border-dashed border-gray-500 bg-white/70 p-4">
          <h1 className="text-lg font-bold">데이터 불러오는 중...</h1>
        </header>
      </div>
    );
  }

  return (
    <main className="flex w-full flex-col gap-4">
      <header className="border border-dashed border-gray-500 bg-white/70 p-4">
        <h1 className="text-lg font-bold">
          {editId ? "게시글 수정" : (board ? `${board.name} - 글쓰기` : "게시글 작성")}
        </h1>
      </header>

      {!userId ? (
        <div className="border border-dashed border-gray-500 bg-white/70 p-4 text-sm">
          글쓰기를 위해 먼저 로그인해 주세요.{" "}
          <Link href="/auth" className="underline">
            로그인 페이지로 이동
          </Link>
        </div>
      ) : null}

      <form
        onSubmit={onSubmit}
        className="flex flex-col gap-3 border border-dashed border-gray-500 bg-white/70 p-4"
      >
        <div className="flex flex-col gap-1">
          <span className="text-sm">제목</span>
          <div className="flex gap-2">
            <select
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              className="border border-dashed border-gray-500 bg-white px-2 py-2 text-sm focus:outline-none"
            >
              <option value="">말머리 선택</option>
              {PREFIXES.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <input
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="flex-1 border border-dashed border-gray-500 bg-white px-3 py-2 text-sm focus:outline-none"
              placeholder="제목을 입력해 주세요"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-sm">내용</span>
          <CommunityEditor
            content={content}
            onChange={setContent}
            userId={userId}
            placeholder="내용을 작성해 주세요."
          />
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading || !userId || !board}
            className="border border-dashed border-gray-500 bg-gray-200 px-3 py-2 text-sm disabled:opacity-50"
          >
            {loading ? (editId ? "수정 중..." : "등록 중...") : (editId ? "수정 완료" : "등록")}
          </button>
          <Link
            href={editId ? `/board/${slug}/${editId}` : `/board/${slug}`}
            className="border border-dashed border-gray-500 bg-white px-3 py-2 text-sm"
          >
            취소
          </Link>
        </div>
      </form>

      {message ? (
        <p className="border border-dashed border-gray-500 bg-white/70 p-3 text-sm text-red-600">
          {message}
        </p>
      ) : null}
    </main>
  );
}

export default function WritePostPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <WritePostContent />
    </Suspense>
  );
}

