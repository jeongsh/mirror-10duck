"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase/client";
import { useAuthUser, useAuthState } from "@/lib/supabase/useAuthUser";
import type { UserProfile } from "@/types/community";
import { Search, Shield, ShieldOff, RefreshCw, User } from "lucide-react";

type UserRow = UserProfile & { email?: string };

const ROLE_OPTIONS = [
  { value: "", label: "전체 권한" },
  { value: "ADMIN", label: "어드민" },
  { value: "USER", label: "일반 유저" },
];

const SORT_OPTIONS = [
  { value: "created_at_desc", label: "가입일 최신순" },
  { value: "created_at_asc", label: "가입일 오래된순" },
  { value: "level_desc", label: "레벨 높은순" },
  { value: "experience_points_desc", label: "경험치 높은순" },
  { value: "nickname_asc", label: "닉네임 가나다순" },
];

export default function AdminUsersPage() {
  const authUser = useAuthUser();
  const { refreshProfileRole } = useAuthState();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [sortKey, setSortKey] = useState("created_at_desc");

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("유저 목록 로드 실패:", error);
      setUsers([]);
    } else {
      setUsers((data ?? []) as UserRow[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    void fetchUsers();
  }, []);

  const filtered = useMemo(() => {
    let list = [...users];

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (u) =>
          u.nickname?.toLowerCase().includes(q) ||
          u.handle?.toLowerCase().includes(q) ||
          u.display_name?.toLowerCase().includes(q) ||
          u.user_id?.toLowerCase().includes(q),
      );
    }

    if (roleFilter) {
      list = list.filter((u) => u.role === roleFilter);
    }

    const dir = sortKey.endsWith("_asc") ? "asc" : "desc";
    const field = sortKey.replace(/_(?:asc|desc)$/, "");

    list.sort((a, b) => {
      const av = (a as Record<string, unknown>)[field];
      const bv = (b as Record<string, unknown>)[field];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "string" && typeof bv === "string") {
        return dir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      if (typeof av === "number" && typeof bv === "number") {
        return dir === "asc" ? av - bv : bv - av;
      }
      return 0;
    });

    return list;
  }, [users, search, roleFilter, sortKey]);

  const handleRoleChange = async (user: UserRow, newRole: "USER" | "ADMIN") => {
    if (
      !confirm(
        `${user.nickname} 유저의 권한을 "${newRole === "ADMIN" ? "어드민" : "일반 유저"}"으로 변경할까요?`,
      )
    )
      return;

    setActionLoading(user.user_id);
    const { error } = await supabase
      .from("profiles")
      .update({ role: newRole })
      .eq("user_id", user.user_id);

    if (error) {
      alert(`권한 변경 실패: ${error.message}`);
    } else {
      setUsers((prev) =>
        prev.map((u) => (u.user_id === user.user_id ? { ...u, role: newRole } : u)),
      );
      if (authUser?.id === user.user_id) {
        await refreshProfileRole();
      }
    }
    setActionLoading(null);
  };

  const adminCount = users.filter((u) => u.role === "ADMIN").length;

  return (
    <div className="flex flex-col gap-6">
      {/* 헤더 */}
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-dashed border-gray-500 pb-4">
        <div>
          <h2 className="text-xl font-bold">유저 관리</h2>
          <p className="mt-1 text-sm text-gray-600">
            전체 유저를 검색하고 권한을 관리합니다.
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <span>전체 {users.length}명</span>
          <span className="text-orange-600 font-medium">어드민 {adminCount}명</span>
          <button
            type="button"
            onClick={() => void fetchUsers()}
            disabled={loading}
            className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-3 py-1.5 transition-colors hover:bg-gray-100 disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            새로고침
          </button>
        </div>
      </div>

      {/* 검색/필터 */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="닉네임, 핸들, UID 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-gray-500"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="rounded border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-500"
        >
          {ROLE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value)}
          className="rounded border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-500"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* 결과 수 */}
      {!loading && (
        <p className="text-sm text-gray-500">
          {filtered.length === users.length
            ? `${users.length}명`
            : `${filtered.length}명 / 전체 ${users.length}명`}
        </p>
      )}

      {/* 테이블 */}
      <section className="rounded border border-dashed border-gray-500 bg-white/70 p-6">
        {loading ? (
          <p className="text-sm text-gray-500">로딩 중...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-gray-500">검색 결과가 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b">
                <tr>
                  <th className="p-3 font-semibold">유저</th>
                  <th className="p-3 font-semibold">핸들</th>
                  <th className="p-3 font-semibold text-center">레벨</th>
                  <th className="p-3 font-semibold text-center">경험치</th>
                  <th className="p-3 font-semibold text-center">권한</th>
                  <th className="p-3 font-semibold">가입일</th>
                  <th className="p-3 font-semibold text-right">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dashed">
                {filtered.map((user) => (
                  <tr key={user.user_id} className="transition-colors hover:bg-gray-50">
                    {/* 유저 */}
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-dashed border-gray-300 bg-gray-100 text-gray-400">
                          {user.avatar_url ? (
                            <img
                              src={user.avatar_url}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <User size={16} />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-medium">{user.nickname}</div>
                          {user.display_name && user.display_name !== user.nickname && (
                            <div className="truncate text-xs text-gray-400">{user.display_name}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    {/* 핸들 */}
                    <td className="p-3 text-gray-500">
                      {user.handle ? `@${user.handle}` : <span className="text-gray-300">-</span>}
                    </td>
                    {/* 레벨 */}
                    <td className="p-3 text-center font-semibold text-gray-700">
                      {user.level ?? "-"}
                    </td>
                    {/* 경험치 */}
                    <td className="p-3 text-center text-gray-600">
                      {user.experience_points?.toLocaleString() ?? "-"}
                    </td>
                    {/* 권한 */}
                    <td className="p-3 text-center">
                      {user.role === "ADMIN" ? (
                        <span className="inline-flex items-center gap-1 rounded bg-orange-100 px-2 py-0.5 text-xs font-bold text-orange-700">
                          <Shield size={11} />
                          ADMIN
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                          USER
                        </span>
                      )}
                    </td>
                    {/* 가입일 */}
                    <td className="p-3 text-gray-500 text-xs">
                      {new Date(user.created_at).toLocaleDateString("ko-KR")}
                    </td>
                    {/* 관리 */}
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-2">
                        {user.role === "ADMIN" ? (
                          <button
                            type="button"
                            disabled={actionLoading === user.user_id}
                            onClick={() => void handleRoleChange(user, "USER")}
                            className="inline-flex items-center gap-1 rounded border border-red-200 bg-red-50 px-2.5 py-1 text-xs text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50"
                          >
                            <ShieldOff size={12} />
                            {actionLoading === user.user_id ? "처리 중..." : "권한 해제"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={actionLoading === user.user_id}
                            onClick={() => void handleRoleChange(user, "ADMIN")}
                            className="inline-flex items-center gap-1 rounded border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs text-orange-600 transition-colors hover:bg-orange-100 disabled:opacity-50"
                          >
                            <Shield size={12} />
                            {actionLoading === user.user_id ? "처리 중..." : "어드민 부여"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
