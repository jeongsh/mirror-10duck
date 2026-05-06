"use client";

import { Editor } from "@tiptap/react";
import { 
  Bold, 
  Italic, 
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
  ChevronDown
} from "lucide-react";
import StickerPicker from "@/components/stickers/StickerPicker";
import { useRef } from "react";
import { supabase } from "@/lib/supabase/client";

interface Props {
  editor: Editor | null;
  userId?: string;
  allowMedia?: boolean;
}

export default function Toolbar({ editor, userId, allowMedia = true }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!editor) return null;

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;

    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}-${Math.random()}.${fileExt}`;
    const filePath = `uploads/${fileName}`;

    const { error } = await supabase.storage
      .from('post-assets')
      .upload(filePath, file);

    if (error) {
      alert("이미지 업로드 실패: " + error.message);
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('post-assets')
      .getPublicUrl(filePath);

    editor.chain().focus().setImage({ src: publicUrl }).run();
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

      {/* 폰트 색상 */}
      <div className="relative flex items-center">
        <input 
          type="color" 
          onInput={e => editor.chain().focus().setColor((e.target as HTMLInputElement).value).run()}
          className="h-7 w-7 cursor-pointer border-none bg-transparent p-0"
          value={editor.getAttributes('textStyle').color || '#000000'}
        />
        <Type size={14} className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 mix-blend-difference invert" />
      </div>

      {/* 하이라이트 색상 */}
      <div className="relative flex items-center">
        <input 
          type="color" 
          onInput={e => editor.chain().focus().toggleHighlight({ color: (e.target as HTMLInputElement).value }).run()}
          className="h-7 w-7 cursor-pointer border-none bg-transparent p-0"
          value={editor.getAttributes('highlight').color || '#ffff00'}
        />
        <Highlighter size={14} className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 mix-blend-difference invert" />
      </div>

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
            className="p-1.5 hover:bg-gray-200"
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
