"use client";

import { Editor } from "@tiptap/react";
import { 
  Bold, 
  Italic, 
  AlignCenter,
  List, 
  ListOrdered, 
  Image as ImageIcon, 
  Smile,
  Strikethrough,
  Underline as UnderlineIcon,
  Type,
  Highlighter,
  Video,
  Share2,
  Undo,
  Redo,
} from "lucide-react";
import StickerPicker from "@/components/stickers/StickerPicker";
import { ColorPicker } from "./ColorPicker";
import { useEffect, useRef, useState } from "react";
import { getPostMediaErrorMessage } from "@/lib/supabase/postMediaAssets";
import { uploadAndInsertEditorImage } from "./editorImageUpload";

interface Props {
  editor: Editor | null;
  userId?: string;
  allowMedia?: boolean;
}

export default function Toolbar({ editor, userId, allowMedia = true }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [selectedImageType, setSelectedImageType] = useState<"imageResize" | "image" | null>(null);
  const savedColorSel = useRef<{ from: number; to: number } | null>(null);
  const savedHighlightSel = useRef<{ from: number; to: number } | null>(null);

  const saveSelection = (ref: React.MutableRefObject<{ from: number; to: number } | null>) => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    ref.current = { from, to };
  };

  const applyWithSelection = (
    ref: React.MutableRefObject<{ from: number; to: number } | null>,
    command: (chain: ReturnType<Editor["chain"]>) => boolean,
  ) => {
    if (!editor) return;
    const saved = ref.current;
    const chain = editor.chain().focus();
    if (saved && saved.from !== saved.to) {
      chain.setTextSelection(saved);
    }
    command(chain);
  };

  useEffect(() => {
    if (!editor) {
      setSelectedImageType(null);
      return;
    }

    const syncSelectedImage = () => {
      if (editor.isActive("imageResize")) {
        setSelectedImageType("imageResize");
      } else if (editor.isActive("image")) {
        setSelectedImageType("image");
      } else {
        setSelectedImageType(null);
      }
    };

    syncSelectedImage();
    editor.on("selectionUpdate", syncSelectedImage);
    editor.on("transaction", syncSelectedImage);

    return () => {
      editor.off("selectionUpdate", syncSelectedImage);
      editor.off("transaction", syncSelectedImage);
    };
  }, [editor]);

  if (!editor) return null;

  const centerSelectedImage = () => {
    const imageType = selectedImageType;
    if (!imageType) return;

    const attrs = editor.getAttributes(imageType);
    const width = attrs.width ? `${attrs.width}`.replace("px", "") : null;
    const widthStyle = width ? `width: ${width}px;` : "width: 100%;";

    editor
      .chain()
      .focus()
      .updateAttributes(imageType, {
        containerStyle: `${widthStyle} height: auto; cursor: pointer; margin: 0.5rem auto;`,
        wrapperStyle: "display: flex; margin: 0;",
      })
      .run();
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("이미지 파일만 업로드할 수 있습니다.");
      return;
    }

    setUploadingImage(true);
    try {
      await uploadAndInsertEditorImage({ editor, file, userId });
    } catch (error) {
      alert("이미지 업로드 실패: " + getPostMediaErrorMessage(error, "알 수 없는 오류"));
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const insertYoutube = () => {
    const url = window.prompt("유튜브 URL을 입력해 주세요.");
    if (url) {
      // URL에서 비디오 ID 추출 로직 강화
      let videoId = "";
      const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
      const match = url.match(regex);
      
      if (match && match[1]) {
        videoId = match[1];
      } else if (url.length === 11 && !url.includes('/')) {
        // 비디오 ID만 직접 입력한 경우
        videoId = url;
      }

      if (videoId) {
        editor.chain().focus().setYoutubeVideo({ src: `https://www.youtube.com/embed/${videoId}` }).run();
      } else {
        alert("유효한 유튜브 URL을 입력해 주세요.");
      }
    }
  };

  const insertSns = () => {
    const url = window.prompt("인스타그램 또는 트위터 게시글 URL을 입력해 주세요.");
    if (url) {
      let type = 'generic';
      if (url.includes('twitter.com') || url.includes('x.com')) type = 'twitter';
      if (url.includes('instagram.com')) type = 'instagram';
      
      editor.chain().focus().insertContent({
        type: 'embed',
        attrs: { url, type }
      }).run();
    }
  };

  const handleInsertSticker = (token: string) => {
    const match = /:sticker\/([A-Za-z0-9_-]+)\/([A-Za-z0-9_-]+):/.exec(token);
    if (match) {
      editor.chain().focus().insertContent({
        type: 'sticker',
        attrs: {
          characterId: match[1],
          emotion: match[2]
        }
      }).run();
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-dashed border-gray-400 bg-gray-50 p-2">
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={`p-1.5 hover:bg-gray-200 ${editor.isActive("bold") ? "bg-gray-300" : ""}`}
      >
        <Bold size={18} />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={`p-1.5 hover:bg-gray-200 ${editor.isActive("italic") ? "bg-gray-300" : ""}`}
      >
        <Italic size={18} />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleStrike().run()}
        className={`p-1.5 hover:bg-gray-200 ${editor.isActive("strike") ? "bg-gray-300" : ""}`}
      >
        <Strikethrough size={18} />
      </button>
      
      <div className="mx-1 h-6 w-px bg-gray-300" />

      <button
        type="button"
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        className={`p-1.5 hover:bg-gray-200 ${editor.isActive("underline") ? "bg-gray-300" : ""}`}
      >
        <UnderlineIcon size={18} />
      </button>

      <div className="mx-1 h-6 w-px bg-gray-300" />

      {/* 글자색 */}
      <ColorPicker
        value={editor.getAttributes("textStyle").color || "#000000"}
        onChange={(color) => applyWithSelection(savedColorSel, (c) => c.setColor(color).run())}
        onBeforeCustomPick={() => saveSelection(savedColorSel)}
        icon={<Type size={14} />}
        quickSetLabel="검은색으로 설정"
        quickSetValue="#000000"
      />

      {/* 배경색(형광펜) */}
      <ColorPicker
        value={editor.getAttributes("highlight").color || "transparent"}
        onChange={(color) =>
          color === "transparent"
            ? applyWithSelection(savedHighlightSel, (c) => c.unsetHighlight().run())
            : applyWithSelection(savedHighlightSel, (c) => c.setHighlight({ color }).run())
        }
        onBeforeCustomPick={() => saveSelection(savedHighlightSel)}
        icon={<Highlighter size={14} />}
        quickSetLabel="투명으로 설정"
        quickSetValue="transparent"
      />

      {/* 폰트 크기 */}
      <select 
        onChange={e => editor.chain().focus().setFontSize(e.target.value).run()}
        className="h-7 border border-dashed border-gray-400 bg-white text-[11px] outline-none"
        value={editor.getAttributes('textStyle').fontSize || '16px'}
      >
        <option value="12px">12</option>
        <option value="14px">14</option>
        <option value="16px">16</option>
        <option value="18px">18</option>
        <option value="20px">20</option>
        <option value="24px">24</option>
        <option value="32px">32</option>
      </select>

      <div className="mx-1 h-6 w-px bg-gray-300" />

      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={`p-1.5 hover:bg-gray-200 ${editor.isActive("bulletList") ? "bg-gray-300" : ""}`}
      >
        <List size={18} />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={`p-1.5 hover:bg-gray-200 ${editor.isActive("orderedList") ? "bg-gray-300" : ""}`}
      >
        <ListOrdered size={18} />
      </button>

      <div className="mx-1 h-6 w-px bg-gray-300" />

      {allowMedia && (
        <>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingImage}
            className="p-1.5 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-40"
            title="이미지 업로드"
          >
            <ImageIcon size={18} />
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImageUpload} 
            className="hidden" 
            accept="image/*"
          />

          <button
            type="button"
            onClick={centerSelectedImage}
            disabled={!selectedImageType}
            className="p-1.5 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-30"
            title="선택한 이미지 가운데 정렬"
          >
            <AlignCenter size={18} />
          </button>

          <button
            type="button"
            onClick={insertYoutube}
            className="p-1.5 hover:bg-gray-200"
            title="유튜브 영상"
          >
            <Video size={18} />
          </button>

          <button
            type="button"
            onClick={insertSns}
            className="p-1.5 hover:bg-gray-200"
            title="SNS 임베드"
          >
            <Share2 size={18} />
          </button>
        </>
      )}

      <StickerPicker onInsert={handleInsertSticker} />

      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className="p-1.5 hover:bg-gray-200 disabled:opacity-30"
        >
          <Undo size={18} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className="p-1.5 hover:bg-gray-200 disabled:opacity-30"
        >
          <Redo size={18} />
        </button>
      </div>
    </div>
  );
}
