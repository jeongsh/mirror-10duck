"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { splitMentionText } from "@/lib/community/mentionEditor";
import { splitContentSegments } from "@/lib/stickers/token";
import { useAuthUser } from "@/lib/supabase/useAuthUser";
import CharacterSticker from "./CharacterSticker";
import { supabase } from "@/lib/supabase/client";

function MentionLink({ handle }: { handle: string }) {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("nickname, display_name")
      .ilike("handle", handle)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          const p = data as { nickname?: string | null; display_name?: string | null };
          setLabel(p.display_name || p.nickname || null);
        }
      });
  }, [handle]);

  return (
    <Link
      href={`/user/${encodeURIComponent(handle)}`}
      className="font-semibold text-blue-600 hover:underline"
    >
      @{label ?? handle}
    </Link>
  );
}

function renderTextWithMentions(text: string, keyPrefix: string) {
  const parts = splitMentionText(text);
  if (parts.length === 0) return text;
  return parts.map((part, index) => {
    if (part.type === "mention") {
      return <MentionLink key={`${keyPrefix}-m-${index}`} handle={part.handle} />;
    }
    return <span key={`${keyPrefix}-t-${index}`}>{part.value}</span>;
  });
}

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
  disableMentions?: boolean;
}

function loadExternalScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    if (typeof window === "undefined") {
      resolve();
      return;
    }

    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existingScript) {
      if (existingScript.dataset.loaded === "true") {
        resolve();
        return;
      }
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.body.appendChild(script);
  });
}

function normalizeInstagramPermalink(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
}

function SnsEmbed({ url, type }: { url: string; type: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    const hydrateEmbed = async () => {
      try {
        if (type === "twitter") {
          await loadExternalScript("https://platform.twitter.com/widgets.js");
          if (cancelled) return;
          const twitterApi = (window as any).twttr;
          twitterApi?.widgets?.load(containerRef.current);
          return;
        }

        if (type === "instagram") {
          await loadExternalScript("https://www.instagram.com/embed.js");
          if (cancelled) return;
          const instagramApi = (window as any).instgrm;
          instagramApi?.Embeds?.process();
        }
      } catch {
        // 스크립트 로드 실패 시 하단 링크 fallback 이 노출된다.
      }
    };

    hydrateEmbed();
    return () => {
      cancelled = true;
    };
  }, [type, url]);

  if (type === "twitter") {
    return (
      <div ref={containerRef} className="my-4 overflow-x-auto">
        <blockquote className="twitter-tweet">
          <a href={url}>X post</a>
        </blockquote>
      </div>
    );
  }

  if (type === "instagram") {
    return (
      <div ref={containerRef} className="my-4 overflow-x-auto">
        <blockquote
          className="instagram-media"
          data-instgrm-permalink={normalizeInstagramPermalink(url)}
          data-instgrm-version="14"
        >
          <a href={url}>Instagram post</a>
        </blockquote>
      </div>
    );
  }

  return (
    <div className="my-4 border border-dashed border-gray-400 bg-gray-50 p-4 text-center">
      <p className="mb-2 text-xs font-bold uppercase tracking-widest text-gray-400">SNS Embed (generic)</p>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-blue-600 underline"
      >
        {url}
      </a>
    </div>
  );
}

function PendingImageBlock({ assetId, message = "이미지 안전 검사 중입니다." }: { assetId?: string | null; message?: string }) {
  return (
    <div className="my-2 rounded border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
      {message}
      {assetId ? <span className="ml-1 font-mono text-[10px] text-amber-700">{assetId.slice(0, 8)}</span> : null}
    </div>
  );
}

function AdultBlurredImage({
  src,
  alt,
  style,
}: {
  src: string;
  alt: string;
  style?: React.CSSProperties;
}) {
  const user = useAuthUser();
  const [revealed, setRevealed] = useState(false);
  const [verified, setVerified] = useState<boolean | null>(null);

  useEffect(() => {
    if (user === undefined) {
      setVerified(null);
      return;
    }
    if (!user) {
      setVerified(false);
      return;
    }

    let cancelled = false;
    supabase
      .from("adult_verifications")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setVerified(Boolean(data?.user_id));
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  if (revealed) {
    return (
      <img
        src={src}
        alt={alt}
        style={style}
        className="mx-1 my-2 rounded border border-dashed border-gray-400 max-w-full"
      />
    );
  }

  return (
    <div className="relative my-2 inline-block max-w-full overflow-hidden rounded border border-dashed border-amber-400 bg-amber-50">
      <img
        src={src}
        alt={alt}
        style={style}
        className="max-w-full blur-xl"
      />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/35 p-4 text-center text-white">
        <p className="text-sm font-bold">성인 이미지입니다.</p>
        {verified ? (
          <button
            type="button"
            onClick={() => setRevealed(true)}
            className="border border-white bg-white px-3 py-1.5 text-xs font-bold text-gray-900 hover:bg-gray-100"
          >
            이미지 보기
          </button>
        ) : (
          <button
            type="button"
            disabled
            className="border border-white/60 bg-white/20 px-3 py-1.5 text-xs font-bold text-white opacity-80"
          >
            성인 인증 필요
          </button>
        )}
      </div>
    </div>
  );
}

function ModeratedPostImage({
  assetId,
  fallbackSrc,
  alt = "게시글 이미지",
  style,
}: {
  assetId?: string | null;
  fallbackSrc?: string | null;
  alt?: string;
  style?: React.CSSProperties;
}) {
  const [state, setState] = useState<{
    loading: boolean;
    status: string | null;
    riskLevel: string | null;
    publicUrl: string | null;
    rejectedReason: string | null;
  }>({
    loading: Boolean(assetId),
    status: null,
    riskLevel: null,
    publicUrl: null,
    rejectedReason: null,
  });

  useEffect(() => {
    if (!assetId) return;
    let cancelled = false;

    supabase
      .from("post_media_assets")
      .select("scan_status, risk_level, public_url, rejected_reason")
      .eq("id", assetId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        const row = data as {
          scan_status?: string | null;
          risk_level?: string | null;
          public_url?: string | null;
          rejected_reason?: string | null;
        } | null;
        setState({
          loading: false,
          status: row?.scan_status ?? null,
          riskLevel: row?.risk_level ?? null,
          publicUrl: row?.public_url ?? null,
          rejectedReason: row?.rejected_reason ?? null,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [assetId]);

  if (state.publicUrl && state.status === "approved") {
    return (
      <img
        src={state.publicUrl}
        alt={alt}
        style={style}
        className="mx-1 my-2 rounded border border-dashed border-gray-400 max-w-full"
      />
    );
  }

  if (!assetId && fallbackSrc) {
    return (
      <img
        src={fallbackSrc}
        alt={alt}
        style={style}
        className="mx-1 my-2 rounded border border-dashed border-gray-400 max-w-full"
      />
    );
  }

  if (state.status === "rejected") {
    return <PendingImageBlock assetId={assetId} message={state.rejectedReason || "이미지가 안전 정책에 따라 차단되었습니다."} />;
  }

  return (
    <PendingImageBlock
      assetId={assetId}
      message={state.loading ? "이미지 안전 검사 상태를 확인 중입니다." : "이미지 안전 검사 대기 중입니다."}
    />
  );
}

export default function RichContent({ content, className, disableMentions = false }: Props) {
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
          return <span key={idx}>{disableMentions ? seg.value : renderTextWithMentions(seg.value, `seg-${idx}`)}</span>;
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
        if (seg.type === "pendingImage") {
          return <ModeratedPostImage key={idx} assetId={seg.assetId} />;
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

      case 'youtube': {
        let src = node.attrs.src;
        if (src) {
          // http가 없는 경우 상대 경로로 인식되는 것 방지
          if (src.startsWith('www.')) src = `https://${src}`;
          
          // 일반 영상 주소(watch?v=)를 embed로 변환
          const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
          const match = src.match(regex);
          if (match && match[1]) {
            src = `https://www.youtube.com/embed/${match[1]}`;
          }
        }

        return (
          <div key={index} className="my-4 aspect-video w-full max-w-[640px] overflow-hidden rounded border border-dashed border-gray-400">
            <iframe
              src={src}
              className="h-full w-full"
              allowFullScreen
              title="YouTube Video"
            />
          </div>
        );
      }

      case 'embed':
        const { url, type } = node.attrs;
        return <SnsEmbed key={index} url={url} type={type} />;

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
      case 'imageResize':
        let imgWidth = node.attrs.width || 'auto';
        if (typeof imgWidth === 'string' && /^\d+$/.test(imgWidth)) imgWidth = `${imgWidth}px`;
        
        let imgHeight = node.attrs.height || 'auto';
        if (typeof imgHeight === 'string' && /^\d+$/.test(imgHeight)) imgHeight = `${imgHeight}px`;

        // float 스타일 지원 (옵션)
        let floatStyle: any = 'none';
        if (node.attrs.wrapperStyle?.includes('float: left')) floatStyle = 'left';
        if (node.attrs.wrapperStyle?.includes('float: right')) floatStyle = 'right';
        const isCentered =
          node.attrs.containerStyle?.includes('auto') &&
          !node.attrs.wrapperStyle?.includes('float:');

        if (node.attrs.mediaAssetId) {
          return (
            <ModeratedPostImage
              key={index}
              assetId={node.attrs.mediaAssetId}
              fallbackSrc={node.attrs.src}
              alt={node.attrs.alt || "이미지"}
              style={{
                width: imgWidth,
                height: imgHeight,
                display: floatStyle !== 'none' || isCentered ? 'block' : 'inline-block',
                float: floatStyle !== 'none' ? floatStyle : undefined,
                marginLeft: isCentered ? 'auto' : undefined,
                marginRight: isCentered ? 'auto' : undefined,
                verticalAlign: 'middle'
              }}
            />
          );
        }

        return (
          <img 
            key={index} 
            src={node.attrs.src} 
            alt={node.attrs.alt || '이미지'} 
            style={{ 
              width: imgWidth,
              height: imgHeight,
              display: floatStyle !== 'none' || isCentered ? 'block' : 'inline-block',
              float: floatStyle !== 'none' ? floatStyle : undefined,
              marginLeft: isCentered ? 'auto' : undefined,
              marginRight: isCentered ? 'auto' : undefined,
              verticalAlign: 'middle'
            }}
            className="mx-1 my-2 rounded border border-dashed border-gray-400 max-w-full"
          />
        );

      case 'sticker':
        const { characterId, emotion } = node.attrs;
        return (
          <span key={index} className="mx-1 inline-block align-middle">
            <CharacterSticker 
              token={{
                characterId,
                emotion,
                raw: `:sticker/${characterId}/${emotion}:`,
              }}
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
