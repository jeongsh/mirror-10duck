"use client";

import {
  BadgeCheck,
  BarChart3,
  Image as ImageIcon,
  ListFilter,
  Loader2,
  Smile,
} from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import FeedMediaGrid from "@/components/community/feed/FeedMediaGrid";
import StickerPicker from "@/components/stickers/StickerPicker";
import { insertAtTextarea } from "@/lib/stickers/insertAtCursor";
import { supabase } from "@/lib/supabase/client";
import { grantExperience, XP_AMOUNTS } from "@/lib/supabase/experience";

const MAX_FEED_LENGTH = 280;
const MAX_MEDIA_COUNT = 4;

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
  const [content, setContent] = useState("");
  const [media, setMedia] = useState<MediaDraft[]>([]);
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [replyPolicy, setReplyPolicy] = useState<ReplyPolicy>("everyone");
  const [replyMenuOpen, setReplyMenuOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
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
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.max(textarea.scrollHeight, 84)}px`;
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
    const { next, cursor } = insertAtTextarea(textareaRef.current, content, token);
    setContent(next);
    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      textarea.focus();
      textarea.setSelectionRange(cursor, cursor);
    });
  };

  const handleSelectMedia = (files: FileList | null) => {
    if (!files) return;

    const slots = MAX_MEDIA_COUNT - media.length;
    const nextFiles = Array.from(files)
      .filter((file) => file.type.startsWith("image/"))
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

  const removeMediaAt = (index: number) => {
    setMedia((prev) => {
      const target = prev[index];
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((_, itemIndex) => itemIndex !== index);
    });
  };

  const uploadMedia = async () => {
    const urls: string[] = [];

    for (const item of media) {
      const fileExt = item.file.name.split(".").pop() || "jpg";
      const fileName = `${userId}-${crypto.randomUUID()}.${fileExt}`;
      const filePath = `uploads/${fileName}`;

      const { error } = await supabase.storage
        .from("post-assets")
        .upload(filePath, item.file);

      if (error) throw error;

      const {
        data: { publicUrl },
      } = supabase.storage.from("post-assets").getPublicUrl(filePath);

      urls.push(publicUrl);
    }

    return urls;
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canPost) return;

    setLoading(true);
    setMessage("");

    try {
      const imageUrls = await uploadMedia();
      const imageTokens = imageUrls.map((url) => `!image[${url}]`).join("\n");
      const nextContent = [content.trim(), imageTokens].filter(Boolean).join("\n");

      const { error } = await supabase.from("posts").insert({
        content: nextContent,
        source_type: "FEED",
        author_id: userId,
        author_email: userEmail,
        board_id: null,
      });

      if (error) throw error;

      if (userId) void grantExperience(userId, XP_AMOUNTS.FEED_CREATED);

      setContent("");
      setFocused(false);
      setReplyMenuOpen(false);
      setMedia((prev) => {
        prev.forEach((item) => URL.revokeObjectURL(item.previewUrl));
        return [];
      });
      onPosted();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "피드를 올리지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const iconButtonClass =
    "flex h-9 w-9 items-center justify-center border border-dashed border-gray-300 bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-40";

  return (
    <form
      onSubmit={onSubmit}
      className="border-b border-dashed border-gray-500 bg-white/70"
      onClick={focusComposer}
    >
      <div className="flex gap-3 p-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden border border-dashed border-gray-400 bg-gray-50 text-[10px] font-bold uppercase text-gray-400">
          {userEmail ? userEmail.slice(0, 2) : "ME"}
        </div>

        <div className="min-w-0 flex-1">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            onFocus={() => setFocused(true)}
            disabled={disabled || loading}
            className="block min-h-20 w-full resize-none bg-transparent text-lg leading-7 text-gray-900 outline-none placeholder:text-gray-500 disabled:opacity-60"
            placeholder={disabled ? "로그인 후 작성할 수 있습니다." : "무슨 일이 일어나고 있나요?"}
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
    </form>
  );
}
