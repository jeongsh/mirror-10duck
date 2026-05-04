"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useAuthUser } from "@/lib/supabase/useAuthUser";
import { Report } from "@/types/community";

export default function AdminReportsPage() {
  const authUser = useAuthUser();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("reports")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) setReports(data as Report[]);
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

      setLoading(true);
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", authUser.id)
        .single();

      if (cancelled) return;

      if (profile?.role === "ADMIN") {
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
              <th className="px-4 py-3">날짜</th>
              <th className="px-4 py-3">유형</th>
              <th className="px-4 py-3">대상 ID</th>
              <th className="px-4 py-3">사유</th>
              <th className="px-4 py-3">상태</th>
              <th className="px-4 py-3">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dashed divide-gray-300">
            {reports.map((report) => (
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
                <td className="px-4 py-3 font-mono text-[11px] text-gray-400">
                  {report.target_id.slice(0, 8)}...
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col">
                    <span className="font-bold text-gray-700">{report.reason_category}</span>
                    <span className="text-xs text-gray-500">{report.reason_detail}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`text-xs font-bold ${
                      report.status === "PENDING"
                        ? "text-red-500"
                        : report.status === "REVIEWING"
                          ? "text-orange-500"
                          : "text-green-600"
                    }`}
                  >
                    {report.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {report.status === "PENDING" && (
                      <button
                        onClick={() => updateReportStatus(report.id, "REVIEWING")}
                        className="text-[10px] font-bold uppercase tracking-widest text-orange-500 hover:underline"
                      >
                        [검토 중]
                      </button>
                    )}
                    {report.status !== "RESOLVED" && (
                      <button
                        onClick={() => hideTarget(report)}
                        className="text-[10px] font-bold uppercase tracking-widest text-red-600 hover:underline"
                      >
                        [숨김 처리]
                      </button>
                    )}
                    {report.status !== "REJECTED" && report.status !== "RESOLVED" && (
                      <button
                        onClick={() => updateReportStatus(report.id, "REJECTED")}
                        className="text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:underline"
                      >
                        [기각]
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
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
