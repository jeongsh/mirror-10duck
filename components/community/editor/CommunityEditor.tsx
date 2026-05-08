"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Color } from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import { Highlight } from "@tiptap/extension-highlight";
import { Youtube } from "@tiptap/extension-youtube";
import { StickerExtension } from "./extensions/StickerExtension";
import { FontSize } from "./extensions/FontSize";
import { EmbedExtension } from "./extensions/EmbedExtension";
import ResizeImage from "tiptap-extension-resize-image";
import Toolbar from "./Toolbar";
import { useEffect, useRef, useState } from "react";

interface Props {
  content: string;
  onChange: (content: string) => void;
  userId?: string;
  allowMedia?: boolean;
  placeholder?: string;
}

export default function CommunityEditor({ content, onChange, userId, allowMedia = true, placeholder }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [imageSizeOverlay, setImageSizeOverlay] = useState<{
    left: number;
    top: number;
    currentWidth: number;
    currentHeight: number;
    naturalWidth: number;
    naturalHeight: number;
  } | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      FontSize,
      ResizeImage.configure({
        inline: false,
        minWidth: 80,
        maxWidth: 900,
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

  const loadExternalScript = (src: string) =>
    new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
      if (existing) {
        resolve();
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      document.body.appendChild(script);
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

  useEffect(() => {
    if (!editor) return;

    let frame = 0;

    const syncImageSizeOverlay = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const container = containerRef.current;
        if (!container) return;

        const { selection } = editor.state;
        const selectionNode = (selection as {
          node?: { type?: { name?: string } };
        }).node;
        const selectedNode =
          selectionNode?.type?.name === "imageResize" || selectionNode?.type?.name === "image";

        let img: HTMLImageElement | null = null;

        if (selectedNode) {
          const dom = editor.view.nodeDOM(selection.from);
          if (dom instanceof HTMLImageElement) {
            img = dom;
          } else if (dom instanceof HTMLElement) {
            img = dom.querySelector("img");
          }
        }

        img ??= editor.view.dom.querySelector(
          ".ProseMirror-selectednode img, img.ProseMirror-selectednode",
        );

        if (!img) {
          setImageSizeOverlay(null);
          return;
        }

        const imageRect = img.getBoundingClientRect();
        if (imageRect.width <= 0 || imageRect.height <= 0) {
          setImageSizeOverlay(null);
          return;
        }

        const containerRect = container.getBoundingClientRect();
        setImageSizeOverlay({
          left: imageRect.right - containerRect.left - 8,
          top: imageRect.bottom - containerRect.top - 8,
          currentWidth: Math.round(imageRect.width),
          currentHeight: Math.round(imageRect.height),
          naturalWidth: img.naturalWidth || Math.round(imageRect.width),
          naturalHeight: img.naturalHeight || Math.round(imageRect.height),
        });
      });
    };

    syncImageSizeOverlay();
    editor.on("selectionUpdate", syncImageSizeOverlay);
    editor.on("transaction", syncImageSizeOverlay);
    window.addEventListener("resize", syncImageSizeOverlay);
    document.addEventListener("mousemove", syncImageSizeOverlay);

    return () => {
      cancelAnimationFrame(frame);
      editor.off("selectionUpdate", syncImageSizeOverlay);
      editor.off("transaction", syncImageSizeOverlay);
      window.removeEventListener("resize", syncImageSizeOverlay);
      document.removeEventListener("mousemove", syncImageSizeOverlay);
    };
  }, [editor]);

  useEffect(() => {
    if (!editor) return;

    let cancelled = false;

    const hydrateEmbeds = async () => {
      const root = editor.view.dom;
      const hasTwitter = !!root.querySelector(".twitter-tweet");
      const hasInstagram = !!root.querySelector(".instagram-media");
      if (!hasTwitter && !hasInstagram) return;

      try {
        if (hasTwitter) {
          await loadExternalScript("https://platform.twitter.com/widgets.js");
          if (!cancelled) {
            (window as any).twttr?.widgets?.load(root);
          }
        }

        if (hasInstagram) {
          await loadExternalScript("https://www.instagram.com/embed.js");
          if (!cancelled) {
            (window as any).instgrm?.Embeds?.process();
          }
        }
      } catch {
        // 스크립트 로드 실패 시 링크 fallback 으로 보인다.
      }
    };

    hydrateEmbeds();
    editor.on("transaction", hydrateEmbeds);

    return () => {
      cancelled = true;
      editor.off("transaction", hydrateEmbeds);
    };
  }, [editor]);

  return (
    <div ref={containerRef} className="relative flex flex-col border border-dashed border-gray-500 bg-white tiptap-container">
      <Toolbar editor={editor} userId={userId} allowMedia={allowMedia} />
      <EditorContent editor={editor} />
      {imageSizeOverlay && (
        <div
          className="pointer-events-none absolute z-20 rounded bg-black/80 px-2 py-1 text-[11px] text-white shadow"
          style={{
            left: imageSizeOverlay.left,
            top: imageSizeOverlay.top,
            transform: "translate(-100%, -100%)",
          }}
        >
          {imageSizeOverlay.currentWidth}x{imageSizeOverlay.currentHeight} (원본:{" "}
          {imageSizeOverlay.naturalWidth}x{imageSizeOverlay.naturalHeight})
        </div>
      )}
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
            margin: 0;
        }
        .tiptap-container .ProseMirror [data-resize-image-ui] img {
          margin: 0;
        }
      `}</style>
    </div>
  );
}
