"use client";

import { useMemo } from "react";
import { splitContentSegments } from "@/lib/stickers/token";
import CharacterSticker from "./CharacterSticker";

/**
 * 본문 문자열을 텍스트와 캐릭터 스티커가 섞인 React 노드로 렌더링한다.
 *
 * - 텍스트 부분은 `whitespace-pre-wrap` 으로 줄바꿈 보존.
 * - 스티커 토큰은 `CharacterSticker` 로 치환.
 * - 한 단락 안에 텍스트와 스티커가 섞여도 라인 정렬이 깨지지 않도록 inline 으로 흐른다.
 */
interface Props {
  content: string;
  className?: string;
}

export default function RichContent({ content, className }: Props) {
  const isJson = content.trim().startsWith('{') && content.trim().endsWith('}');
  
  if (isJson) {
    try {
      const json = JSON.parse(content);
      return (
        <div className={`prose prose-sm max-w-none break-words text-sm leading-7 text-gray-800 ${className ?? ""}`}>
          <TiptapJsonRenderer json={json} />
        </div>
      );
    } catch (e) {
      // 파싱 실패 시 일반 텍스트로 처리
    }
  }

  // 기존 토큰 방식 렌더링
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const segments = useMemo(() => splitContentSegments(content), [content]);

  return (
    <div className={`whitespace-pre-wrap break-words text-sm leading-7 text-gray-800 ${className ?? ""}`}>
      {segments.map((seg, idx) => {
        if (seg.type === "text") {
          return <span key={idx}>{seg.value}</span>;
        }
        if (seg.type === "sticker") {
          return (
            <span key={idx} className="mx-1 inline-block align-middle">
              <CharacterSticker token={seg.token} size="md" />
            </span>
          );
        }
        if (seg.type === "image") {
          return (
            <img 
              key={idx} 
              src={seg.url} 
              alt="게시글 이미지" 
              className="my-2 block max-w-full rounded border border-dashed border-gray-300"
            />
          );
        }
        return null;
      })}
    </div>
  );
}

/**
 * Tiptap JSON 구조를 React 노드로 변환하는 간단한 렌더러
 */
function TiptapJsonRenderer({ json }: { json: any }) {
  if (!json) return null;

  const renderNode = (node: any, index: number) => {
    switch (node.type) {
      case 'doc':
        return node.content?.map((child: any, i: number) => renderNode(child, i));
      
      case 'paragraph':
        return (
          <p key={index} className="my-1 min-h-[1.2em]">
            {node.content?.map((child: any, i: number) => renderNode(child, i)) || '\u00A0'}
          </p>
        );

      case 'text':
        let text = <span key={index}>{node.text}</span>;
        if (node.marks) {
          node.marks.forEach((mark: any) => {
            if (mark.type === 'bold') text = <strong key={index}>{text}</strong>;
            if (mark.type === 'italic') text = <em key={index}>{text}</em>;
            if (mark.type === 'strike') text = <del key={index}>{text}</del>;
            if (mark.type === 'underline') text = <u key={index}>{text}</u>;
            if (mark.type === 'textStyle') {
              const style: React.CSSProperties = {};
              if (mark.attrs.color) style.color = mark.attrs.color;
              if (mark.attrs.fontSize) style.fontSize = mark.attrs.fontSize;
              text = <span key={index} style={style}>{text}</span>;
            }
            if (mark.type === 'highlight') {
              text = <mark key={index} style={{ backgroundColor: mark.attrs.color || '#ffff00' }}>{text}</mark>;
            }
          });
        }
        return text;

      case 'youtube':
        return (
          <div key={index} className="my-4 aspect-video w-full max-w-[640px] overflow-hidden rounded border border-dashed border-gray-400">
            <iframe
              src={node.attrs.src}
              className="h-full w-full"
              allowFullScreen
              title="YouTube Video"
            />
          </div>
        );

      case 'embed':
        const { url, type } = node.attrs;
        return (
          <div key={index} className="my-4 border border-dashed border-gray-400 bg-gray-50 p-4 text-center">
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-gray-400">SNS Embed ({type})</p>
            <a 
              href={url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sm text-blue-600 underline"
            >
              {url}
            </a>
            {/* 실제 인스타그램/트위터 위젯 스크립트 로드는 복잡하므로 링크로 우선 대체하거나 iframe 시도 가능 */}
          </div>
        );

      case 'bulletList':
        return (
          <ul key={index} className="my-2 list-disc pl-5">
            {node.content?.map((child: any, i: number) => renderNode(child, i))}
          </ul>
        );

      case 'orderedList':
        return (
          <ol key={index} className="my-2 list-decimal pl-5">
            {node.content?.map((child: any, i: number) => renderNode(child, i))}
          </ol>
        );

      case 'listItem':
        return (
          <li key={index}>
            {node.content?.map((child: any, i: number) => renderNode(child, i))}
          </li>
        );

      case 'image':
      case 'resizableImage':
        return (
          <img 
            key={index} 
            src={node.attrs.src} 
            alt={node.attrs.alt || '이미지'} 
            style={{ 
              width: node.attrs.width || 'auto',
              display: 'inline-block',
              verticalAlign: 'middle'
            }}
            className="mx-1 my-2 rounded border border-dashed border-gray-400"
          />
        );

      case 'sticker':
        const { characterId, emotion } = node.attrs;
        return (
          <span key={index} className="mx-1 inline-block align-middle">
            <CharacterSticker 
              token={`:sticker/${characterId}/${emotion}:`} 
              size="md" 
            />
          </span>
        );

      case 'hardBreak':
        return <br key={index} />;

      default:
        return null;
    }
  };

  return <>{renderNode(json, 0)}</>;
}
