"use client";

import { Image as ImageIcon, Loader2, Send, X } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import StickerPicker from "@/components/stickers/StickerPicker";
import RichContent from "@/components/stickers/RichContent";
import { insertAtTextarea } from "@/lib/stickers/insertAtCursor";
import { supabase } from "@/lib/supabase/client";

const MAX_FEED_LENGTH = 280;
const MAX_MEDIA_COUNT = 4;

type MediaDraft = {
  id: string;
  file: File;
  previewUrl: string;
};

interface FeedComposerProps {
  userId: string;
  userEmail: string;
  onPosted: () => void;
  disabled?: boolean;
}

export default function FeedComposer({
  userId,
  userEmail,
  onPosted,
  disabled = false,
}: FeedComposerProps) {
  const [content, setContent] = useState("");
  const [media, setMedia] = useState<MediaDraft[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRef = useRef<MediaDraft[]>([]);

  const remaining = MAX_FEED_LENGTH - content.length;
  const isOverLimit = remaining < 0;
  const canPost = !disabled && !loading && !isOverLimit && Boolean(userId) && (
    content.trim().length > 0 || media.length > 0
  );

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.max(textarea.scrollHeight, 144)}px`;
  }, [content]);

  useEffect(() => {
    mediaRef.current = media;
  }, [media]);

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

  const removeMedia = (id: string) => {
    setMedia((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((item) => item.id !== id);
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

      setContent("");
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

  const previewContent = [
    content,
    ...media.map((item) => `!image[${item.previewUrl}]`),
  ].filter(Boolean).join("\n");

  return (
    <form
      onSubmit={onSubmit}
      className="border border-dashed border-gray-500 bg-white/80"
      onClick={focusComposer}
    >
      <div className="flex gap-3 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-dashed border-gray-400 bg-gray-50 text-[10px] font-bold uppercase text-gray-400">
          {userEmail ? userEmail.slice(0, 2) : "Me"}
        </div>

        <div className="min-w-0 flex-1">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            disabled={disabled || loading}
            className="block min-h-36 w-full resize-none bg-transparent text-lg leading-7 text-gray-900 outline-none placeholder:text-gray-400 disabled:opacity-60"
            placeholder={disabled ? "로그인 후 작성할 수 있습니다." : "무슨 일이 일어나고 있나요?"}
          />

          {media.length > 0 ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              {media.map((item) => (
                <div
                  key={item.id}
                  className="relative aspect-video overflow-hidden border border-dashed border-gray-400 bg-gray-50"
                >
                  <img
                    src={item.previewUrl}
                    alt="첨부 이미지 미리보기"
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      removeMedia(item.id);
                    }}
                    className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center bg-black/70 text-white hover:bg-black"
                    title="이미지 제거"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          {previewContent ? (
            <div className="mt-4 border-t border-dashed border-gray-300 pt-3">
              <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-gray-500">
                미리보기
              </div>
              <RichContent content={previewContent} />
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-dashed border-gray-300 px-4 py-3">
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
          className="flex h-9 w-9 items-center justify-center border border-dashed border-gray-400 bg-white text-gray-700 hover:bg-gray-100 disabled:opacity-40"
          title="이미지 추가"
        >
          <ImageIcon size={18} />
        </button>

        <StickerPicker
          onInsert={handleInsertSticker}
          label="스티커"
          className={disabled || loading ? "pointer-events-none opacity-40" : ""}
        />

        <div className="ml-auto flex items-center gap-3">
          <span
            className={`text-xs tabular-nums ${
              isOverLimit ? "font-bold text-red-600" : remaining <= 30 ? "text-amber-600" : "text-gray-500"
            }`}
          >
            {remaining}
          </span>
          <button
            type="submit"
            disabled={!canPost}
            className="flex items-center gap-2 border border-dashed border-gray-700 bg-gray-900 px-4 py-2 text-sm font-bold text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            게시
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
