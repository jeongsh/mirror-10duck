"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { Comment } from "@/types/community";
import { parseStickerToken } from "@/lib/stickers/token";
import RichContent from "@/components/stickers/RichContent";
import StickerPicker from "@/components/stickers/StickerPicker";
import CharacterSticker from "@/components/stickers/CharacterSticker";
import { insertAtTextarea } from "@/lib/stickers/insertAtCursor";
import IdentityBadge from "@/components/community/IdentityBadge";
import { createNotification } from "@/lib/community/notifications";

/**
 * 게시글 한 개의 댓글 섹션.
 *
 * - 텍스트 댓글 입력 시 본문 안에 스티커 토큰을 섞을 수 있다 (`StickerPicker`).
 * - 입력란을 비워두고 "스티커 답글" 버튼으로 한 장만 찍는 코멘트도 가능.
 * - 본인 댓글은 삭제 가능.
 */
interface Props {
  postId: string;
  postAuthorId?: string; // 알림용 게시글 작성자 ID
  viewerId: string | null;
  viewerEmail: string | null;
  /** 댓글 스레드가 바뀐 뒤(등록/삭제) 상위에서 글 집계를 다시 읽을 때 */
  onThreadChanged?: () => void;
}

export default function CommentSection({ postId, postAuthorId, viewerId, viewerEmail, onThreadChanged }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editRef = useRef<HTMLTextAreaElement>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("comments")
      .select("*, profiles(*)")
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
      parent_comment_id: replyTo,
    });
    setSubmitting(false);
    if (error) {
      alert(`등록 실패: ${error.message}`);
      return;
    }

    // 알림 전송
    if (replyTo) {
      const parent = comments.find(c => c.id === replyTo);
      if (parent && parent.author_id !== viewerId) {
        createNotification({
          receiverId: parent.author_id,
          senderId: viewerId,
          type: 'REPLY',
          title: '새 답글',
          content: '내 댓글에 새로운 답글이 달렸습니다.',
          linkUrl: window.location.pathname
        });
      }
    } else if (postAuthorId && postAuthorId !== viewerId) {
      createNotification({
        receiverId: postAuthorId,
        senderId: viewerId,
        type: 'COMMENT',
        title: '새 댓글',
        content: '내 글에 새로운 댓글이 달렸습니다.',
        linkUrl: window.location.pathname
      });
    }

    setText("");
    setReplyTo(null);
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
      parent_comment_id: replyTo,
    });
    setSubmitting(false);
    if (error) {
      alert(`등록 실패: ${error.message}`);
      return;
    }

    // 알림 전송 (스티커 전용)
    if (replyTo) {
      const parent = comments.find(c => c.id === replyTo);
      if (parent && parent.author_id !== viewerId) {
        createNotification({
          receiverId: parent.author_id,
          senderId: viewerId,
          type: 'REPLY',
          title: '새 답글 (스티커)',
          content: '내 댓글에 새로운 스티커 답글이 달렸습니다.',
          linkUrl: window.location.pathname
        });
      }
    } else if (postAuthorId && postAuthorId !== viewerId) {
      createNotification({
        receiverId: postAuthorId,
        senderId: viewerId,
        type: 'COMMENT',
        title: '새 댓글 (스티커)',
        content: '내 글에 새로운 스티커 댓글이 달렸습니다.',
        linkUrl: window.location.pathname
      });
    }

    setReplyTo(null);
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
    if (replyTo === commentId) setReplyTo(null);
    if (editingCommentId === commentId) setEditingCommentId(null);
    await refresh();
    onThreadChanged?.();
  };

  const handleUpdate = async (commentId: string) => {
    if (!editText.trim()) return;
    setSubmitting(true);
    const { error } = await supabase
      .from("comments")
      .update({ content: editText })
      .eq("id", commentId);
    
    setSubmitting(false);
    if (error) {
      alert(`수정 실패: ${error.message}`);
      return;
    }
    setEditingCommentId(null);
    await refresh();
  };

  const handleReport = async (commentId: string) => {
    if (!viewerId) {
      alert("로그인이 필요합니다.");
      return;
    }
    const reason = window.prompt("신고 사유를 입력해주세요 (예: 욕설, 도배 등)");
    if (!reason) return;

    const { error } = await supabase.from("reports").insert({
      reporter_id: viewerId,
      target_type: "COMMENT",
      target_id: commentId,
      reason_category: "기타",
      reason_detail: reason
    });

    if (error) {
      alert(`신고 실패: ${error.message}`);
    } else {
      alert("신고가 접수되었습니다.");
    }
  };

  const root = comments.filter(c => !c.parent_comment_id);
  const replies = comments.filter(c => !!c.parent_comment_id);

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
          root.map((c) => {
            const stickerToken = c.sticker_token ? parseStickerToken(c.sticker_token) : null;
            const canDelete = viewerId === c.author_id;
            const commentReplies = replies.filter(r => r.parent_comment_id === c.id);

            return (
              <div key={c.id} className="flex flex-col gap-2">
                <li className="flex items-start gap-3 border border-dashed border-gray-300 bg-white p-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <IdentityBadge 
                        profile={c.profiles} 
                        fallback={{ nickname: c.author_email.split('@')[0] }}
                        size="sm"
                      />
                      <span className="text-[10px] text-gray-400">
                        {new Date(c.created_at).toLocaleString("ko-KR")}
                      </span>
                      {c.sticker_token ? (
                        <span className="rounded border border-dashed border-gray-300 px-1 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                          Sticker
                        </span>
                      ) : null}
                    </div>
                    {editingCommentId === c.id ? (
                      <div className="flex flex-col gap-2">
                        <textarea
                          ref={editRef}
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          className="w-full border border-dashed border-gray-400 p-2 text-sm focus:outline-none"
                          rows={3}
                        />
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => setEditingCommentId(null)}
                            className="text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:underline"
                          >
                            [취소]
                          </button>
                          <button 
                            onClick={() => handleUpdate(c.id)}
                            className="text-[10px] font-bold uppercase tracking-widest text-blue-500 hover:underline"
                          >
                            [수정 완료]
                          </button>
                        </div>
                      </div>
                    ) : stickerToken ? (
                      <div className="mt-1">
                        <CharacterSticker token={stickerToken} size="lg" />
                      </div>
                    ) : c.content ? (
                      <RichContent content={c.content} />
                    ) : (
                      <p className="text-xs italic text-gray-400">(빈 댓글)</p>
                    )}

                    <div className="mt-3 flex items-center gap-3">
                      <button 
                        onClick={() => setReplyTo(replyTo === c.id ? null : c.id)}
                        className={`text-[10px] font-bold uppercase tracking-widest ${replyTo === c.id ? "text-red-500" : "text-blue-500 hover:underline"}`}
                      >
                        {replyTo === c.id ? "[취소]" : "[답글 달기]"}
                      </button>
                      {canDelete && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCommentId(c.id);
                              setEditText(c.content || "");
                            }}
                            className="text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:underline"
                          >
                            [수정]
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(c.id)}
                            className="text-[10px] font-bold uppercase tracking-widest text-red-400 hover:underline"
                          >
                            [삭제]
                          </button>
                        </>
                      )}
                      {!canDelete && (
                        <button
                          type="button"
                          onClick={() => handleReport(c.id)}
                          className="text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:underline"
                        >
                          [신고]
                        </button>
                      )}
                    </div>
                  </div>
                </li>

                {/* 대댓글 영역 */}
                {commentReplies.length > 0 && (
                  <ul className="ml-8 flex flex-col gap-2 border-l-2 border-dashed border-gray-200 pl-4">
                    {commentReplies.map(r => {
                      const rStickerToken = r.sticker_token ? parseStickerToken(r.sticker_token) : null;
                      const canDeleteReply = viewerId === r.author_id;
                      return (
                        <li key={r.id} className="flex items-start gap-3 border border-dashed border-gray-200 bg-gray-50/50 p-3">
                          <div className="min-w-0 flex-1">
                            <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                              <IdentityBadge 
                                profile={r.profiles} 
                                fallback={{ nickname: r.author_email.split('@')[0] }}
                                size="sm"
                              />
                              <span className="text-[10px] text-gray-400">
                                {new Date(r.created_at).toLocaleString("ko-KR")}
                              </span>
                            </div>
                            {rStickerToken ? (
                              <div className="mt-1">
                                <CharacterSticker token={rStickerToken} size="md" />
                              </div>
                            ) : r.content ? (
                              <div className="text-sm">
                                <RichContent content={r.content} />
                              </div>
                            ) : (
                              <p className="text-xs italic text-gray-400">(빈 답글)</p>
                            )}
                            {canDeleteReply && (
                              <div className="mt-2 flex items-center gap-3">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingCommentId(r.id);
                                    setEditText(r.content || "");
                                  }}
                                  className="text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:underline"
                                >
                                  [수정]
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDelete(r.id)}
                                  className="text-[10px] font-bold uppercase tracking-widest text-red-400 hover:underline"
                                >
                                  [삭제]
                                </button>
                              </div>
                            )}
                            {!canDeleteReply && (
                              <div className="mt-2">
                                <button
                                  type="button"
                                  onClick={() => handleReport(r.id)}
                                  className="text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:underline"
                                >
                                  [신고]
                                </button>
                              </div>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })
        )}
      </ul>

      <div className="flex flex-col gap-2 border-t border-dashed border-gray-300 pt-3">
        {replyTo && (
          <div className="flex items-center justify-between border border-dashed border-blue-200 bg-blue-50 px-3 py-1.5 text-[10px] font-bold text-blue-700">
            <span>
              {root.find(c => c.id === replyTo)?.profiles?.nickname || 
               root.find(c => c.id === replyTo)?.author_email?.split('@')[0]} 님에게 답글 작성 중...
            </span>
            <button onClick={() => setReplyTo(null)} className="text-gray-400 hover:text-red-500 uppercase tracking-widest">[취소]</button>
          </div>
        )}
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
