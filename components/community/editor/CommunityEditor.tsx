"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Underline } from "@tiptap/extension-underline";
import { Color } from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import { Highlight } from "@tiptap/extension-highlight";
import { Youtube } from "@tiptap/extension-youtube";
import { StickerExtension } from "./extensions/StickerExtension";
import { FontSize } from "./extensions/FontSize";
import { EmbedExtension } from "./extensions/EmbedExtension";
import ResizeImage from "tiptap-extension-resize-image";
import Toolbar from "./Toolbar";
import { useEffect } from "react";

interface Props {
  content: string;
  onChange: (content: string) => void;
  userId?: string;
  placeholder?: string;
}

export default function CommunityEditor({ content, onChange, userId, placeholder }: Props) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      FontSize,
      ResizeImage.configure({
        inline: true,
        allowBase64: true,
        HTMLAttributes: {
          class: 'rounded border border-dashed border-gray-400',
        },
      }),
      Youtube.configure({
        width: 480,
        height: 270,
        HTMLAttributes: {
          class: 'my-4 rounded border border-dashed border-gray-400',
        },
      }),
      StickerExtension,
      EmbedExtension,
    ],
    content: content,
    onUpdate: ({ editor }) => {
      onChange(JSON.stringify(editor.getJSON()));
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[300px] p-4 text-sm leading-7 text-gray-800',
      },
    },
  });

  // 외부에서 content가 바뀔 때 (초기 로드 등) 반영
  useEffect(() => {
    if (!editor) return;
    
    try {
      const currentJson = JSON.stringify(editor.getJSON());
      if (content && content !== currentJson) {
        editor.commands.setContent(JSON.parse(content));
      }
    } catch (e) {
      // JSON이 아닌 경우 (기존 호환성)
      if (content && content !== editor.getHTML()) {
        editor.commands.setContent(content);
      }
    }
  }, [content, editor]);

  return (
    <div className="flex flex-col border border-dashed border-gray-500 bg-white tiptap-container">
      <Toolbar editor={editor} userId={userId} />
      <EditorContent editor={editor} />
      <style>{`
        .tiptap-container .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #adb5bd;
          pointer-events: none;
          height: 0;
        }
        .tiptap-container .ProseMirror {
          outline: none !important;
        }
        .tiptap-container .ProseMirror p {
          margin-top: 0.25rem !important;
          margin-bottom: 0.25rem !important;
          min-height: 1.2em;
        }
        .tiptap-container .ProseMirror img {
            display: block;
            margin: 1rem 0;
        }
      `}</style>
    </div>
  );
}
