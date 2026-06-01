import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // 개발 서버에 LAN IP / 127.0.0.1 등으로 접속할 때 HMR 리소스가 차단되어
  // 콘솔이 경고로 도배되고 HMR 이 끊기는 것을 방지한다. (dev 전용)
  allowedDevOrigins: ["127.0.0.1", "localhost", "192.168.2.9"],
  experimental: {
    optimizePackageImports: ["@supabase/supabase-js", "zustand"],
  },
};

export default nextConfig;
