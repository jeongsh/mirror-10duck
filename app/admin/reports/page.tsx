"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { isAdminUser } from "@/lib/supabase/admin";
import { supabase } from "@/lib/supabase/client";
import { useAuthUser } from "@/lib/supabase/useAuthUser";
import { Report } from "@/types/community";

interface TargetContent {
  title?: string;
  content?: string;
  board_slug?: string;
  post_id?: string;
}

export default function AdminReportsPage() {
  const authUser = useAuthUser();
  const [reports, setReports] = useState<Report[]>([]);
  const [targetContents, setTargetContents] = useState<Record<string, TargetContent>>({});
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("reports")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      const reportsData = data as Report[];
      setReports(reportsData);
      
      // 대상 콘텐츠들 가져오기
      const contents: Record<string, TargetContent> = {};
      
      const postIds = reportsData.filter(r => r.target_type === "POST").map(r => r.target_id);
      const commentIds = reportsData.filter(r => r.target_type === "COMMENT").map(r => r.target_id);

      if (postIds.length > 0) {
        const { data: posts } = await supabase
          .from("posts")
          .select("id, title, content, boards(slug)")
          .in("id", postIds);
        
        posts?.forEach((p: any) => {
          contents[p.id] = {
            title: p.title,
            content: p.content,
            board_slug: p.boards?.slug,
            post_id: p.id
          };
        });
      }

      if (commentIds.length > 0) {
        const { data: comments } = await supabase
          .from("comments")
          .select("id, content, post_id, posts(board_id, boards(slug))")
          .in("id", commentIds);
        
        comments?.forEach((c: any) => {
          contents[c.id] = {
            content: c.content,
            board_slug: c.posts?.boards?.slug,
            post_id: c.post_id
          };
        });
      }

      setTargetContents(contents);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const checkAdmin = async () => {
      if (authUser === undefined) return;

      if (!authUser) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      if (cancelled) return;
      if (isAdminUser(authUser)) {
        setIsAdmin(true);
        await fetchReports();
      } else {
        setIsAdmin(false);
        setLoading(false);
      }
    };

    void checkAdmin();

    return () => {
      cancelled = true;
    };
  }, [authUser, fetchReports]);

  const updateReportStatus = async (reportId: string, status: Report["status"]) => {
    const { error } = await supabase
      .from("reports")
      .update({
        status,
        processed_at: new Date().toISOString(),
      })
      .eq("id", reportId);

    if (error) alert("상태 업데이트 실패: " + error.message);
    else void fetchReports();
  };

  const hideTarget = async (report: Report) => {
    const table = report.target_type === "POST" ? "posts" : "comments";
    
    const isConfirmed = window.confirm("해당 게시물/댓글을 '숨김' 처리할까요? 사용자에겐 보이지 않게 됩니다.");
    if (!isConfirmed) return;

    const { error } = await supabase
      .from(table)
      .update({ status: "HIDDEN" })
      .eq("id", report.target_id);

    if (error) {
      alert("숨김 처리 실패: " + error.message);
    } else {
      alert("숨김 처리가 완료되었습니다.");
      void updateReportStatus(report.id, "RESOLVED");
    }
  };

  if (loading) return <main className="p-6">로딩 중...</main>;

  if (!isAdmin) {
    return (
      <main className="flex min-h-[400px] flex-col items-center justify-center gap-4 p-6">
        <h1 className="text-2xl font-bold text-red-600">접근 권한 없음</h1>
        <p className="text-gray-600">
          관리자 계정으로 로그인해야 접근할 수 있습니다.
        </p>
        <Link href="/" className="border border-dashed border-gray-500 px-4 py-2 hover:bg-gray-100">
          홈으로 돌아가기
        </Link>
      </main>
    );
  }

  return (
    <main className="flex w-full flex-col gap-6 p-6">
      <header className="flex items-center justify-between border-b border-dashed border-gray-500 pb-4">
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-widest">신고 관리</h1>
          <p className="text-sm text-gray-500">커뮤니티 신고 내역을 검토하고 처리합니다.</p>
        </div>
        <button
          onClick={fetchReports}
          className="border border-dashed border-gray-800 bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-widest hover:bg-gray-100"
        >
          새로고침
        </button>
      </header>

      <section className="overflow-x-auto border border-dashed border-gray-500 bg-white/70">
        <table className="w-full min-w-[1000px] border-collapse text-left text-sm">
          <thead className="bg-gray-100 text-[11px] font-bold uppercase tracking-widest text-gray-500">
            <tr>
              <th className="px-4 py-3 w-32">날짜</th>
              <th className="px-4 py-3 w-20">유형</th>
              <th className="px-4 py-3">신고 대상 및 내용</th>
              <th className="px-4 py-3 w-40">사유</th>
              <th className="px-4 py-3 w-24">상태</th>
              <th className="px-4 py-3 w-48">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dashed divide-gray-300">
            {reports.map((report) => {
              const target = targetContents[report.target_id];
              const linkUrl = target?.board_slug && target?.post_id 
                ? `/board/${target.board_slug}/${target.post_id}${report.target_type === "COMMENT" ? `#comment-${report.target_id}` : ""}`
                : null;

              return (
                <tr key={report.id} className="transition-colors hover:bg-white">
                  <td className="px-4 py-3 text-[11px] text-gray-500 tabular-nums">
                    {new Date(report.created_at).toLocaleString("ko-KR")}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        report.target_type === "POST"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-orange-100 text-orange-700"
                      }`}
                    >
                      {report.target_type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1 max-w-md">
                      {target ? (
                        <>
                          {target.title && <p className="font-bold text-gray-900 truncate">{target.title}</p>}
                          <p className="text-xs text-gray-600 line-clamp-2 bg-gray-50 p-1.5 border border-dashed border-gray-200">
                            {target.content || "(내용 없음)"}
                          </p>
                          {linkUrl && (
                            <Link 
                              href={linkUrl} 
                              target="_blank"
                              className="text-[10px] text-blue-500 hover:underline"
                            >
                              [원본 게시물 보기 ↗]
                            </Link>
                          )}
                        </>
                      ) : (
                        <span className="text-[10px] text-gray-400 italic">삭제되었거나 찾을 수 없는 대상 ({report.target_id.slice(0, 8)})</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="font-bold text-gray-700">{report.reason_category}</span>
                      <span className="text-xs text-gray-500 line-clamp-2">{report.reason_detail}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs font-bold ${
                        report.status === "PENDING"
                          ? "text-red-500"
                          : report.status === "REVIEWING"
                            ? "text-orange-500"
                            : report.status === "REJECTED"
                              ? "text-gray-400"
                              : "text-green-600"
                      }`}
                    >
                      {report.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {report.status === "PENDING" && (
                        <button
                          onClick={() => updateReportStatus(report.id, "REVIEWING")}
                          className="text-[10px] font-bold uppercase tracking-widest text-orange-500 hover:underline"
                        >
                          [검토 중]
                        </button>
                      )}
                      {report.status !== "RESOLVED" && target && (
                        <button
                          onClick={() => hideTarget(report)}
                          className="text-[10px] font-bold uppercase tracking-widest text-red-600 hover:underline"
                        >
                          [숨김 처리]
                        </button>
                      )}
                      {(report.status === "PENDING" || report.status === "REVIEWING") && (
                        <button
                          onClick={() => updateReportStatus(report.id, "REJECTED")}
                          className="text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:underline"
                        >
                          [기각]
                        </button>
                      )}
                      {report.status === "RESOLVED" && (
                        <span className="text-[10px] text-gray-400">처리 완료</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {reports.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-gray-500">
                  신고 내역이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
