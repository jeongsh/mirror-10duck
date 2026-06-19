"use client";

import {
  BadgeCheck,
  BarChart3,
  CalendarDays,
  Heart,
  Image as ImageIcon,
  ListFilter,
  Loader2,
  MapPin,
  Smile,
  Users,
  X,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import FeedMediaGrid from "@/components/community/feed/FeedMediaGrid";
import StickerPicker from "@/components/stickers/StickerPicker";
import { insertAtContentEditable } from "@/lib/stickers/insertAtCursor";
import {
  getContentEditableCaretOffset,
  setContentEditableCaretOffset,
} from "@/lib/community/mentionEditor";
import { supabase } from "@/lib/supabase/client";
import MentionTextarea from "@/components/community/MentionTextarea";
import { processMentionsForFeedPost } from "@/lib/community/mentions";
import { grantExperience, XP_AMOUNTS } from "@/lib/supabase/experience";
import {
  attachPostMediaAssetsToPost,
  getPostMediaErrorMessage,
  uploadPostMediaAsset,
  validatePostImageFile,
} from "@/lib/supabase/postMediaAssets";

const MAX_FEED_LENGTH = 280;
const MAX_MEDIA_COUNT = 4;
const MOCK_EVENT = {
  id: "e02d23ce-10f5-4773-b84c-52507367d928",
  title: "코믹월드 SUMMER 2026",
  startsAt: "2026.07.18 - 07.19",
  location: "일산 킨텍스 제1전시장",
  imageUrl: "https://comicw.net/data/item/1775781342/16_7ISc7L2U7Ys7Iqk7YSw_7I2464Sk7J28.png",
};

type MediaDraft = {
  id: string;
  file: File;
  previewUrl: string;
};

type ReplyPolicy = "everyone" | "following" | "mentioned" | "verified";

const REPLY_POLICY_LABELS: Record<ReplyPolicy, string> = {
  everyone: "모두 답글 가능",
  following: "내가 팔로우한 계정",
  mentioned: "멘션한 계정만",
  verified: "인증된 계정",
};

interface FeedComposerProps {
  userId: string;
  userEmail: string;
  onPosted: () => void;
  disabled?: boolean;
  autoFocus?: boolean;
  showReplyControl?: boolean;
}

export default function FeedComposer({
  userId,
  userEmail,
  onPosted,
  disabled = false,
  autoFocus = false,
  showReplyControl = true,
}: FeedComposerProps) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [media, setMedia] = useState<MediaDraft[]>([]);
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [mockPickerType, setMockPickerType] = useState<"wish" | "recruit" | null>(null);
  const [replyPolicy, setReplyPolicy] = useState<ReplyPolicy>("everyone");
  const [replyMenuOpen, setReplyMenuOpen] = useState(false);
  const [restoreCaret, setRestoreCaret] = useState<number | null>(null);
  const textareaRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRef = useRef<MediaDraft[]>([]);

  const remaining = MAX_FEED_LENGTH - content.length;
  const isOverLimit = remaining < 0;
  const canPost =
    !disabled &&
    !loading &&
    !isOverLimit &&
    Boolean(userId) &&
    (content.trim().length > 0 || media.length > 0);

  useEffect(() => {
    const editor = textareaRef.current;
    if (!editor) return;
    editor.style.height = "auto";
    editor.style.height = `${Math.max(editor.scrollHeight, 84)}px`;
  }, [content]);

  useEffect(() => {
    mediaRef.current = media;
  }, [media]);

  useEffect(() => {
    if (autoFocus) focusComposer();
  }, [autoFocus]);

  useEffect(() => {
    return () => {
      mediaRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    };
  }, []);

  const focusComposer = () => {
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const handleInsertSticker = (token: string) => {
    const { next, cursor } = insertAtContentEditable(
      textareaRef.current,
      content,
      token,
      getContentEditableCaretOffset,
      setContentEditableCaretOffset,
    );
    setRestoreCaret(cursor);
    setContent(next);
  };

  const openMockPicker = (type: "wish" | "recruit") => {
    setMockPickerType(type);
  };

  const addMediaFiles = (files: File[]) => {
    const slots = MAX_MEDIA_COUNT - media.length;
    const nextFiles = files
      .filter((file) => {
        try {
          validatePostImageFile(file);
          return true;
        } catch (error) {
          setMessage(getPostMediaErrorMessage(error, "이미지 파일을 확인해 주세요."));
          return false;
        }
      })
      .slice(0, slots);

    if (nextFiles.length === 0) return;

    setMedia((prev) => [
      ...prev,
      ...nextFiles.map((file) => ({
        id: `${file.name}-${file.lastModified}-${crypto.randomUUID()}`,
        file,
        previewUrl: URL.createObjectURL(file),
      })),
    ]);

    if (fileInputRef.current) fileInputRef.current.value = "";
    focusComposer();
  };

  const handleSelectMedia = (files: FileList | null) => {
    if (!files) return;
    addMediaFiles(Array.from(files));
  };

  const removeMediaAt = (index: number) => {
    setMedia((prev) => {
      const target = prev[index];
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((_, itemIndex) => itemIndex !== index);
    });
  };

  const uploadMedia = async () => {
    const assetIds: string[] = [];

    for (const item of media) {
      const asset = await uploadPostMediaAsset({
        file: item.file,
        userId,
        source: "feed_composer",
      });
      assetIds.push(asset.id);
    }

    return assetIds;
  };

  const submitPost = useCallback(async () => {
    if (
      disabled ||
      loading ||
      isOverLimit ||
      !userId ||
      (content.trim().length === 0 && media.length === 0)
    ) {
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const imageAssetIds = await uploadMedia();
      const imageTokens = imageAssetIds.map((id) => `!image_pending[${id}]`).join("\n");
      const nextContent = [content.trim(), imageTokens].filter(Boolean).join("\n");

      const { data, error } = await supabase
        .from("posts")
        .insert({
          content: nextContent,
          source_type: "FEED",
          author_id: userId,
          author_email: userEmail,
          board_id: null,
        })
        .select("id")
        .single();

      if (error) throw error;

      if (userId && data?.id) {
        try {
          await attachPostMediaAssetsToPost(nextContent, data.id as string);
        } catch (assetError) {
          await supabase.from("posts").delete().eq("id", data.id as string);
          throw assetError;
        }
        void grantExperience(userId, XP_AMOUNTS.FEED_CREATED);
        await processMentionsForFeedPost({
          text: nextContent,
          postId: data.id as string,
          actorId: userId,
        });
      }

      setContent("");
      setFocused(false);
      setReplyMenuOpen(false);
      setMedia((prev) => {
        prev.forEach((item) => URL.revokeObjectURL(item.previewUrl));
        return [];
      });
      onPosted();
    } catch (error) {
      setMessage(getPostMediaErrorMessage(error, "피드를 올리지 못했습니다."));
    } finally {
      setLoading(false);
    }
  }, [content, disabled, isOverLimit, loading, media, onPosted, userEmail, userId]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await submitPost();
  };

  const iconButtonClass =
    "flex h-9 w-9 items-center justify-center border border-dashed border-gray-300 bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-40";

  return (
    <form
      onSubmit={onSubmit}
      className="border-b border-dashed border-gray-500 bg-white/70"
      onClick={focusComposer}
      onPaste={(event) => {
        const imageFiles = Array.from(event.clipboardData.files).filter((file) => file.type.startsWith("image/"));
        if (imageFiles.length === 0) return;
        event.preventDefault();
        addMediaFiles(imageFiles);
      }}
      onDragOver={(event) => {
        if (Array.from(event.dataTransfer.items).some((item) => item.kind === "file" && item.type.startsWith("image/"))) {
          event.preventDefault();
        }
      }}
      onDrop={(event) => {
        const imageFiles = Array.from(event.dataTransfer.files).filter((file) => file.type.startsWith("image/"));
        if (imageFiles.length === 0) return;
        event.preventDefault();
        addMediaFiles(imageFiles);
      }}
    >
      <div className="flex gap-3 p-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden border border-dashed border-gray-400 bg-gray-50 text-[10px] font-bold uppercase text-gray-400">
          {userEmail ? userEmail.slice(0, 2) : "ME"}
        </div>

        <div className="min-w-0 flex-1">
          <MentionTextarea
            textareaRef={textareaRef}
            userId={userId || null}
            value={content}
            onChange={setContent}
            restoreCaret={restoreCaret}
            onRestoreCaret={() => setRestoreCaret(null)}
            onSubmitShortcut={submitPost}
            onFocus={() => setFocused(true)}
            disabled={disabled || loading}
            maxLength={MAX_FEED_LENGTH}
            rows={4}
            className="block min-h-20 w-full resize-none bg-transparent text-lg leading-7 text-gray-900 outline-none placeholder:text-gray-500 disabled:opacity-60"
            placeholder={
              disabled
                ? "로그인 후 작성할 수 있습니다."
                : "무슨 일이 일어나고 있나요? @ 로 팔로우한 친구를 멘션할 수 있어요."
            }
          />

          {showReplyControl && (focused || content || media.length > 0) ? (
            <div className="relative mb-3 inline-block">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setReplyMenuOpen((open) => !open);
                }}
                className="flex items-center gap-1 border border-dashed border-gray-300 bg-white px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-100"
              >
                <BadgeCheck size={15} />
                {REPLY_POLICY_LABELS[replyPolicy]}
              </button>

              {replyMenuOpen ? (
                <div className="absolute left-0 top-8 z-30 w-64 border border-dashed border-gray-500 bg-white p-3 shadow-sm">
                  <div className="mb-2 text-xs font-bold">누가 답글을 달 수 있나요?</div>
                  <div className="flex flex-col gap-1">
                    {(Object.keys(REPLY_POLICY_LABELS) as ReplyPolicy[]).map((policy) => (
                      <button
                        key={policy}
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setReplyPolicy(policy);
                          setReplyMenuOpen(false);
                        }}
                        className={`border border-dashed px-3 py-2 text-left text-xs hover:bg-gray-100 ${
                          replyPolicy === policy
                            ? "border-gray-700 bg-gray-100 font-bold"
                            : "border-gray-300 bg-white"
                        }`}
                      >
                        {REPLY_POLICY_LABELS[policy]}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          <FeedMediaGrid
            imageUrls={media.map((item) => item.previewUrl)}
            onRemove={removeMediaAt}
          />
        </div>
      </div>

      <div className="ml-16 flex flex-wrap items-center gap-1 border-t border-dashed border-gray-300 px-4 py-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(event) => handleSelectMedia(event.target.files)}
        />

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            fileInputRef.current?.click();
          }}
          disabled={disabled || loading || media.length >= MAX_MEDIA_COUNT}
          className={iconButtonClass}
          title="이미지 추가"
        >
          <ImageIcon size={18} />
        </button>

        <button type="button" disabled className={iconButtonClass} title="GIF">
          <span className="text-[10px] font-black">GIF</span>
        </button>
        <AttachmentToolButton
          label="위시"
          icon={<Heart size={15} />}
          onClick={() => openMockPicker("wish")}
          disabled={disabled || loading}
        />
        <AttachmentToolButton
          label="모집"
          icon={<Users size={15} />}
          onClick={() => openMockPicker("recruit")}
          disabled={disabled || loading}
        />
        <button type="button" disabled className={iconButtonClass} title="Grok">
          <Smile size={18} />
        </button>
        <button type="button" disabled className={iconButtonClass} title="투표">
          <ListFilter size={18} />
        </button>

        <StickerPicker
          onInsert={handleInsertSticker}
          label="스티커"
          className={disabled || loading ? "pointer-events-none opacity-40" : ""}
        />

        <div className="ml-auto flex items-center gap-3">
          <BarChart3 size={16} className="text-gray-400" />
          <span
            className={`text-xs tabular-nums ${
              isOverLimit
                ? "font-bold text-red-600"
                : remaining <= 30
                  ? "text-amber-600"
                  : "text-gray-500"
            }`}
          >
            {remaining}
          </span>
          <button
            type="submit"
            disabled={!canPost}
            title="Ctrl+Enter로 게시 (Mac: ⌘+Enter)"
            className="border border-dashed border-gray-500 bg-gray-200 px-5 py-2 text-sm font-bold text-gray-900 hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : "게시"}
          </button>
        </div>
      </div>

      {message ? (
        <p className="border-t border-dashed border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {message}
        </p>
      ) : null}

      {mockPickerType ? (
        <MockEventPickerModal
          type={mockPickerType}
          onClose={() => setMockPickerType(null)}
          onOpenEvent={() => router.push(`/events/${MOCK_EVENT.id}`)}
        />
      ) : null}
    </form>
  );
}

function MockEventPickerModal({
  type,
  onClose,
  onOpenEvent,
}: {
  type: "wish" | "recruit";
  onClose: () => void;
  onOpenEvent: () => void;
}) {
  const isWish = type === "wish";
  const cards = [
    {
      id: `${type}-event-main`,
      eyebrow: isWish ? "위시 이벤트" : "모집 이벤트",
      description: isWish ? "관심 이벤트로 담아둘 항목" : "동행이나 공구 모집으로 이어질 항목",
    },
    {
      id: `${type}-event-sub`,
      eyebrow: isWish ? "가고 싶음" : "동행 모집",
      description: isWish ? "일정 확인 후 위시로 저장할 이벤트" : "함께 갈 사람을 찾는 모집 카드",
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      onClick={(event) => {
        event.stopPropagation();
        onClose();
      }}
    >
      <div
        className="flex max-h-[86vh] w-full max-w-xl flex-col overflow-hidden rounded-[8px] border border-gray-200 bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <div>
            <p className="text-[11px] font-bold uppercase text-gray-400">
              {isWish ? "Wishlist" : "Recruit"}
            </p>
            <h2 className="text-sm font-bold text-gray-950">
              {isWish ? "위시 카드 선택" : "모집 카드 선택"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-100"
            title="닫기"
          >
            <X size={16} />
          </button>
        </div>

        <div className="grid gap-2 overflow-y-auto p-3">
          {cards.map((card) => (
            <button
              key={card.id}
              type="button"
              onClick={onOpenEvent}
              className="group flex min-w-0 items-center gap-3 rounded-[8px] border border-gray-200 bg-white p-2 text-left hover:border-gray-900 hover:bg-gray-50"
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
                    {card.eyebrow}
                  </span>
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
                <p className="mt-1 line-clamp-1 text-xs text-gray-500">{card.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function AttachmentToolButton({
  label,
  icon,
  onClick,
  disabled,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      disabled={disabled}
      className="flex h-9 items-center gap-1.5 border border-dashed border-gray-300 bg-white px-3 text-xs font-bold text-gray-700 hover:bg-gray-100 disabled:opacity-40"
      title={`${label} 카드`}
    >
      {icon}
      {label}
    </button>
  );
}
