"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { Comment } from "@/types/community";
import { parseStickerToken } from "@/lib/stickers/token";
import RichContent from "@/components/stickers/RichContent";
import StickerPicker from "@/components/stickers/StickerPicker";
import CharacterSticker from "@/components/stickers/CharacterSticker";
import { insertAtTextarea } from "@/lib/stickers/insertAtCursor";

/**
 * 게시글 한 개의 댓글 섹션.
 *
 * - 텍스트 댓글 입력 시 본문 안에 스티커 토큰을 섞을 수 있다 (`StickerPicker`).
 * - 입력란을 비워두고 "스티커 답글" 버튼으로 한 장만 찍는 코멘트도 가능.
 * - 본인 댓글은 삭제 가능.
 */
interface Props {
  postId: string;
  viewerId: string | null;
  viewerEmail: string | null;
  /** 댓글 스레드가 바뀐 뒤(등록/삭제) 상위에서 글 집계를 다시 읽을 때 */
  onThreadChanged?: () => void;
}

export default function CommentSection({ postId, viewerId, viewerEmail, onThreadChanged }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("comments")
      .select("*")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });

    if (!error && data) setComments(data as Comment[]);
    setLoading(false);
  }, [postId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleInsertSticker = (token: string) => {
    const { next, cursor } = insertAtTextarea(textareaRef.current, text, token);
    setText(next);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(cursor, cursor);
    });
  };

  const handleSubmitText = async () => {
    if (!viewerId || !viewerEmail) {
      alert("댓글은 로그인 후 작성 가능합니다.");
      return;
    }
    if (!text.trim()) {
      alert("내용을 입력해 주세요.");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("comments").insert({
      post_id: postId,
      author_id: viewerId,
      author_email: viewerEmail,
      content: text,
      sticker_token: null,
    });
    setSubmitting(false);
    if (error) {
      alert(`등록 실패: ${error.message}`);
      return;
    }
    setText("");
    await refresh();
    onThreadChanged?.();
  };

  const handleSubmitStickerOnly = async (token: string) => {
    if (!viewerId || !viewerEmail) {
      alert("스티커 답글은 로그인 후 가능합니다.");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("comments").insert({
      post_id: postId,
      author_id: viewerId,
      author_email: viewerEmail,
      content: null,
      sticker_token: token,
    });
    setSubmitting(false);
    if (error) {
      alert(`등록 실패: ${error.message}`);
      return;
    }
    await refresh();
    onThreadChanged?.();
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm("이 댓글을 삭제할까요?")) return;
    const { error } = await supabase.from("comments").delete().eq("id", commentId);
    if (error) {
      alert(`삭제 실패: ${error.message}`);
      return;
    }
    await refresh();
    onThreadChanged?.();
  };

  return (
    <section className="flex flex-col gap-3 border border-dashed border-gray-500 bg-white/70 p-4">
      <header className="flex items-center justify-between border-b border-dashed border-gray-300 pb-2">
        <h2 className="text-sm font-bold uppercase tracking-widest text-gray-700">
          댓글 {comments.length > 0 ? `(${comments.length})` : ""}
        </h2>
      </header>

      <ul className="flex flex-col gap-2">
        {loading ? (
          <li className="border border-dashed border-gray-300 bg-white p-3 text-xs text-gray-500">
            로딩 중...
          </li>
        ) : comments.length === 0 ? (
          <li className="border border-dashed border-gray-300 bg-white p-3 text-center text-xs text-gray-500">
            아직 댓글이 없습니다. 첫 댓글을 남겨 보세요.
          </li>
        ) : (
          comments.map((c) => {
            const stickerToken = c.sticker_token ? parseStickerToken(c.sticker_token) : null;
            const canDelete = viewerId === c.author_id;
            return (
              <li
                key={c.id}
                className="flex items-start gap-3 border border-dashed border-gray-300 bg-white p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2 text-[11px] text-gray-500">
                    <span className="font-bold text-gray-700">{c.author_email}</span>
                    <span>·</span>
                    <span>{new Date(c.created_at).toLocaleString("ko-KR")}</span>
                    {c.sticker_token ? (
                      <span className="rounded border border-dashed border-gray-300 px-1 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                        Sticker
                      </span>
                    ) : null}
                  </div>
                  {stickerToken ? (
                    <div className="mt-1">
                      <CharacterSticker token={stickerToken} size="lg" />
                    </div>
                  ) : c.content ? (
                    <RichContent content={c.content} />
                  ) : (
                    <p className="text-xs italic text-gray-400">(빈 댓글)</p>
                  )}
                </div>
                {canDelete ? (
                  <button
                    type="button"
                    onClick={() => handleDelete(c.id)}
                    className="shrink-0 border border-dashed border-red-300 bg-red-50 px-2 py-1 text-[10px] font-bold text-red-600 hover:bg-red-100"
                  >
                    삭제
                  </button>
                ) : null}
              </li>
            );
          })
        )}
      </ul>

      <div className="flex flex-col gap-2 border-t border-dashed border-gray-300 pt-3">
        <textarea
          ref={textareaRef}
          rows={3}
          placeholder={
            viewerId
              ? "텍스트 댓글을 작성하세요. 본문에 스티커 토큰을 섞을 수 있습니다."
              : "댓글을 작성하려면 로그인하세요."
          }
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={!viewerId}
          className="w-full border border-dashed border-gray-400 bg-white px-3 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-400"
        />

        <div className="flex flex-wrap items-center gap-2">
          <StickerPicker onInsert={handleInsertSticker} label="본문에 스티커 삽입" />
          <StickerPicker
            onInsert={handleSubmitStickerOnly}
            label="스티커 답글로 바로 등록"
          />
          <button
            type="button"
            onClick={handleSubmitText}
            disabled={!viewerId || submitting || !text.trim()}
            className="ml-auto border border-dashed border-gray-800 bg-gray-900 px-4 py-2 text-xs font-bold uppercase tracking-widest text-white hover:bg-gray-700 disabled:opacity-50"
          >
            {submitting ? "등록 중..." : "댓글 등록"}
          </button>
        </div>
        <p className="text-[10px] text-gray-400">
          텍스트 입력 후 [댓글 등록] / 입력 없이 [스티커 답글로 바로 등록] 으로 짧은 감정 답을 보낼 수 있습니다.
        </p>
      </div>
    </section>
  );
}
