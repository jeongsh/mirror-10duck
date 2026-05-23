import type { Metadata } from "next";
import OshiCardViewPage from "../page";
import { fetchOshiCardShare } from "@/lib/supabase/oshiCardShares";

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const share = await fetchOshiCardShare(id).catch(() => null);
  const nickname = share?.nickname?.trim() || "누군가";
  const oshi = share?.oshi?.trim() || "아직 고르는 중";
  const title = `${nickname}의 덕질 프로필 카드`;
  const description = `덕질 타입: ${share?.type_id ?? "unknown"} · 최애캐: ${oshi}`;
  const images = share?.og_image_url ? [{ url: share.og_image_url, width: 734, height: 1024, alt: title }] : undefined;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      images,
    },
    twitter: {
      card: images ? "summary_large_image" : "summary",
      title,
      description,
      images: share?.og_image_url ? [share.og_image_url] : undefined,
    },
  };
}

export default function OshiCardShareRoute() {
  return <OshiCardViewPage />;
}
