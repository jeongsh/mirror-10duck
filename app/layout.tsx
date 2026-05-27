import type { Metadata } from "next";
import localFont from "next/font/local";
import { AuthProvider } from "@/lib/supabase/useAuthUser";
import AttendanceRecorder from "@/components/AttendanceRecorder";
import GlobalNavigation from "@/components/GlobalNavigation";
import Live2DClientOnly from "@/components/Live2DClientOnly";
import MainLayoutClient from "@/components/MainLayoutClient";
import ScrollToTop from "@/components/ScrollToTop";
import "./globals.css";

const pretendard = localFont({
  src: "../node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2",
  variable: "--font-pretendard",
  display: "swap",
  weight: "45 920",
});

export const metadata: Metadata = {
  title: "SSIBDUK | Subculture Community",
  description: "Subculture community prototype",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={pretendard.variable}>
      <body className="min-h-screen font-sans antialiased">
        <ScrollToTop />
        <AuthProvider>
          <AttendanceRecorder />
          <GlobalNavigation />
          <div className="relative mx-auto w-full max-w-7xl px-4 pt-6 pb-4">
            <MainLayoutClient>{children}</MainLayoutClient>
          </div>
          <Live2DClientOnly />
        </AuthProvider>
      </body>
    </html>
  );
}
