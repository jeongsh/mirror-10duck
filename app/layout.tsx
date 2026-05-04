import type { Metadata } from "next";
import { AuthProvider } from "@/lib/supabase/useAuthUser";
import GlobalNavigation from "@/components/GlobalNavigation";
import Live2DClientOnly from "@/components/Live2DClientOnly";
import RightSidebar from "@/components/RightSidebar";
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
            <div className="sticky top-20 z-10 hidden h-0 w-0 2xl:block">
              <aside className="absolute right-[calc(100%+20px)] top-0 flex h-[600px] w-[200px] flex-col items-center justify-center border border-dashed border-gray-400 bg-gray-100/50 text-center text-xs text-gray-400">
                [Left
                <br />
                promo banner]
              </aside>
            </div>

            <div className="flex flex-col items-start gap-6 lg:flex-row">
              <div className="min-w-0 flex-1 w-full">{children}</div>
              <RightSidebar />
            </div>
          </div>
          <Live2DClientOnly />
        </AuthProvider>
      </body>
    </html>
  );
}
