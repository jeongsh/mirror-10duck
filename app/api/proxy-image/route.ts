import { NextRequest, NextResponse } from "next/server";

const ALLOWED_HOSTS = [
  "anilist.co",
  "s4.anilist.co",
  "img1.ak.crunchyroll.com",
  "supabase.co",
];

function isAllowedImageUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:") return false;
    return ALLOWED_HOSTS.some(
      (host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`)
    );
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url || !isAllowedImageUrl(url)) {
    return NextResponse.json({ error: "invalid url" }, { status: 400 });
  }

  try {
    const upstream = await fetch(url, { cache: "force-cache" });
    if (!upstream.ok) {
      return NextResponse.json({ error: "upstream failed" }, { status: 502 });
    }

    const buffer = await upstream.arrayBuffer();
    const contentType = upstream.headers.get("content-type") ?? "image/png";

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return NextResponse.json({ error: "fetch failed" }, { status: 500 });
  }
}
