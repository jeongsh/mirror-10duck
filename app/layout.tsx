import type { Metadata } from "next";
import { AuthProvider } from "@/lib/supabase/useAuthUser";
import GlobalNavigation from "@/components/GlobalNavigation";
import Live2DClientOnly from "@/components/Live2DClientOnly";
import MainLayoutClient from "@/components/MainLayoutClient";
import "./globals.css";

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
    <html lang="ko">
      <body className="min-h-screen antialiased">
        <AuthProvider>
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
