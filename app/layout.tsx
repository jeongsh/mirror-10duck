import type { Metadata } from "next";
import localFont from "next/font/local";
import { AuthProvider } from "@/lib/supabase/useAuthUser";
import AttendanceRecorder from "@/components/AttendanceRecorder";
import StreakMilestoneModal from "@/components/streak/StreakMilestoneModal";
import GlobalNavigation from "@/components/GlobalNavigation";
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
          <StreakMilestoneModal />
          <GlobalNavigation />
          <MainLayoutClient>{children}</MainLayoutClient>
        </AuthProvider>
      </body>
    </html>
  );
}
