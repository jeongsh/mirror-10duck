"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Board } from "@/types/community";
import StickerPicker from "@/components/stickers/StickerPicker";
import RichContent from "@/components/stickers/RichContent";
import { insertAtTextarea } from "@/lib/stickers/insertAtCursor";

export default function WritePostPage() {
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;

  const [board, setBoard] = useState<Board | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const contentRef = useRef<HTMLTextAreaElement>(null);

  const handleInsertSticker = (token: string) => {
    const { next, cursor } = insertAtTextarea(contentRef.current, content, token);
    setContent(next);
    requestAnimationFrame(() => {
      const el = contentRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(cursor, cursor);
    });
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const user = data.user;
      setUserId(user?.id ?? "");
      setUserEmail(user?.email ?? "");
    });

    if (slug) {
      supabase.from("boards").select("*").eq("slug", slug).single().then(({ data }) => {
        if (data) setBoard(data);
      });
    }
  }, [slug]);

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

    setLoading(true);
    setMessage("");

    const { data, error } = await supabase
      .from("posts")
      .insert({
        title,
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
  };

  return (
    <main className="flex w-full flex-col gap-4">
      <header className="border border-dashed border-gray-500 bg-white/70 p-4">
        <h1 className="text-lg font-bold">{board ? `${board.name} - 글쓰기` : "게시글 작성"}</h1>
        <p className="mt-1 text-sm text-gray-600">
          로그인 계정: {userEmail || "미로그인"}
        </p>
      </header>

      {!userId ? (
        <div className="border border-dashed border-gray-500 bg-white/70 p-4 text-sm">
          글쓰기를 위해 먼저 로그인해 주세요.{" "}
          <Link href="/auth" className="underline">로그인 페이지로 이동</Link>
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="flex flex-col gap-3 border border-dashed border-gray-500 bg-white/70 p-4">
        <label className="text-sm">
          제목
          <input
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="mt-1 w-full border border-dashed border-gray-500 bg-white px-3 py-2"
            placeholder="제목을 입력해 주세요."
          />
        </label>

        <label className="text-sm">
          내용
          <textarea
            ref={contentRef}
            required
            rows={12}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            className="mt-1 w-full border border-dashed border-gray-500 bg-white px-3 py-2"
            placeholder="내용을 작성해 주세요. 캐릭터 스티커는 우측 버튼으로 삽입할 수 있습니다."
          />
        </label>

        <div className="flex flex-wrap items-center gap-2 border-t border-dashed border-gray-300 pt-2">
          <StickerPicker onInsert={handleInsertSticker} />
          <span className="text-[11px] text-gray-500">
            본문 커서 위치에 `:sticker/{"{id}"}/{"{emotion}"}:` 토큰으로 삽입됩니다.
          </span>
        </div>

        {content ? (
          <div className="border border-dashed border-gray-300 bg-gray-50/60 p-3">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-gray-500">
              미리보기
            </div>
            <RichContent content={content} />
          </div>
        ) : null}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading || !userId || !board}
            className="border border-dashed border-gray-500 bg-gray-200 px-3 py-2 text-sm disabled:opacity-50"
          >
            {loading ? "등록 중..." : "등록"}
          </button>
          <Link href={`/board/${slug}`} className="border border-dashed border-gray-500 bg-white px-3 py-2 text-sm">
            취소
          </Link>
        </div>
      </form>

      {message ? (
        <p className="border border-dashed border-gray-500 bg-white/70 p-3 text-sm">{message}</p>
      ) : null}
    </main>
  );
}
