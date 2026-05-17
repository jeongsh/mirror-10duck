"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Badge, BadgeRarity } from "@/types/community";

const RARITY_LABELS: Record<BadgeRarity, string> = {
  common: "일반",
  rare: "레어",
  epic: "에픽",
  legendary: "레전더리",
  season: "시즌",
};

const RARITY_STYLE: Record<BadgeRarity, string> = {
  common:    "bg-gray-100 text-gray-700 border-gray-300",
  rare:      "bg-blue-50 text-blue-700 border-blue-300",
  epic:      "bg-purple-50 text-purple-700 border-purple-300",
  legendary: "bg-amber-50 text-amber-700 border-amber-300",
  season:    "bg-green-50 text-green-700 border-green-300",
};

const CONDITION_SUGGESTIONS = [
  { value: "oshi_count",       label: "오시 등록 수" },
  { value: "post_count",       label: "게시글 작성 수" },
  { value: "comment_count",    label: "댓글 작성 수" },
  { value: "hot_post",         label: "인기글 달성 수" },
  { value: "follow_start",     label: "팔로우 수" },
  { value: "early_bird",       label: "초기 가입 (가입 후 N일)" },
  { value: "level_reach",      label: "레벨 달성" },
  { value: "reaction_received",label: "리액션 받은 수" },
  { value: "season_join",      label: "시즌 가입 (자동)" },
  { value: "manual",           label: "수동 지급" },
];

type BadgeForm = {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: BadgeRarity;
  condition_type: string;
  condition_value: number;
};

const EMPTY_FORM: BadgeForm = {
  id: "", name: "", description: "", icon: "",
  rarity: "common", condition_type: "manual", condition_value: 1,
};

type GrantTarget = { user_id: string; nickname: string; handle: string | null; avatar_url: string | null };

export default function AdminBadgesPage() {
  const [badges, setBadges]   = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode]       = useState<"list" | "add" | "edit">("list");
  const [form, setForm]       = useState<BadgeForm>(EMPTY_FORM);
  const [saving, setSaving]   = useState(false);
  const [formError, setFormError] = useState("");

  /* 뱃지 지급 패널 */
  const [grantBadge, setGrantBadge]       = useState<Badge | null>(null);
  const [searchQuery, setSearchQuery]     = useState("");
  const [searchResults, setSearchResults] = useState<GrantTarget[]>([]);
  const [searching, setSearching]         = useState(false);
  const [grantingId, setGrantingId]       = useState<string | null>(null);
  const [grantMsg, setGrantMsg]           = useState<Record<string, string>>({});
  const searchRef = useRef<HTMLInputElement>(null);

  const fetchBadges = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("badges")
      .select("*")
      .order("rarity", { ascending: true });
    if (data) setBadges(data);
    setLoading(false);
  };

  useEffect(() => { fetchBadges(); }, []);

  /* 뱃지 CRUD */
  const openAdd = () => { setForm(EMPTY_FORM); setFormError(""); setMode("add"); };

  const openEdit = (b: Badge) => {
    setForm({ id: b.id, name: b.name, description: b.description,
              icon: b.icon, rarity: b.rarity,
              condition_type: b.condition_type, condition_value: b.condition_value });
    setFormError(""); setMode("edit");
  };

  const cancel = () => { setMode("list"); setFormError(""); };

  const handleSave = async () => {
    if (!form.name.trim() || !form.icon.trim()) {
      setFormError("이름과 아이콘은 필수입니다."); return;
    }
    setSaving(true); setFormError("");
    const payload = {
      name: form.name.trim(), description: form.description.trim(),
      icon: form.icon.trim(), rarity: form.rarity,
      condition_type: form.condition_type, condition_value: form.condition_value,
    };
    const { error: err } = mode === "add"
      ? await supabase.from("badges").insert(payload)
      : await supabase.from("badges").update(payload).eq("id", form.id);

    if (err) { setFormError(err.message); setSaving(false); return; }
    setSaving(false); setMode("list"); await fetchBadges();
  };

  const handleDelete = async (b: Badge) => {
    if (!confirm(`"${b.name}" 뱃지를 삭제할까요?\n이미 지급된 뱃지도 함께 삭제됩니다.`)) return;
    const { error: err } = await supabase.from("badges").delete().eq("id", b.id);
    if (err) alert(err.message);
    else await fetchBadges();
  };

  /* 지급 패널 열기 */
  const openGrant = (b: Badge) => {
    setGrantBadge(b);
    setSearchQuery("");
    setSearchResults([]);
    setGrantMsg({});
    setTimeout(() => searchRef.current?.focus(), 50);
  };

  const closeGrant = () => { setGrantBadge(null); setSearchResults([]); setGrantMsg({}); };

  /* 유저 검색 */
  const handleSearch = async () => {
    const q = searchQuery.trim();
    if (!q) return;
    setSearching(true);
    const { data } = await supabase
      .from("profiles")
      .select("user_id, nickname, handle, avatar_url")
      .or(`nickname.ilike.%${q}%,handle.ilike.%${q}%`)
      .limit(10);
    setSearchResults((data ?? []) as GrantTarget[]);
    setSearching(false);
  };

  /* 뱃지 지급 */
  const handleGrant = async (target: GrantTarget) => {
    if (!grantBadge) return;
    setGrantingId(target.user_id);

    const { data: already } = await supabase
      .from("user_badges")
      .select("id")
      .eq("user_id", target.user_id)
      .eq("badge_id", grantBadge.id)
      .maybeSingle();

    if (already) {
      setGrantMsg((m) => ({ ...m, [target.user_id]: "이미 보유 중" }));
      setGrantingId(null); return;
    }

    const { error: err } = await supabase
      .from("user_badges")
      .insert({ user_id: target.user_id, badge_id: grantBadge.id });

    setGrantMsg((m) => ({
      ...m,
      [target.user_id]: err ? `오류: ${err.message}` : "지급 완료 ✓",
    }));
    setGrantingId(null);
  };

  return (
    <div className="flex flex-col gap-6">

      {/* 헤더 */}
      <div className="flex items-center justify-between border-b border-dashed border-gray-500 pb-4">
        <div>
          <h2 className="text-xl font-bold">뱃지 관리</h2>
          <p className="mt-1 text-sm text-gray-600">{badges.length}개의 뱃지</p>
        </div>
        {mode === "list" && !grantBadge && (
          <button
            onClick={openAdd}
            className="rounded bg-black px-4 py-2 text-sm text-white transition-opacity hover:opacity-80"
          >
            + 새 뱃지 추가
          </button>
        )}
      </div>

      {/* 추가 / 수정 폼 */}
      {(mode === "add" || mode === "edit") && (
        <div className="rounded border border-dashed border-gray-500 bg-white/70 p-5 flex flex-col gap-4">
          <h3 className="font-bold text-sm uppercase tracking-widest text-gray-600">
            {mode === "add" ? "뱃지 추가" : "뱃지 수정"}
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-600">아이콘 (이모지) *</label>
              <input className="border border-dashed border-gray-400 bg-white px-3 py-2 text-2xl w-20"
                placeholder="✨" value={form.icon} maxLength={4}
                onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-600">희귀도</label>
              <select className="border border-dashed border-gray-400 bg-white px-3 py-2 text-sm"
                value={form.rarity}
                onChange={(e) => setForm((f) => ({ ...f, rarity: e.target.value as BadgeRarity }))}>
                {(Object.keys(RARITY_LABELS) as BadgeRarity[]).map((r) => (
                  <option key={r} value={r}>{RARITY_LABELS[r]}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-xs font-bold text-gray-600">뱃지 이름 *</label>
              <input className="border border-dashed border-gray-400 bg-white px-3 py-2 text-sm"
                placeholder="입덕 완료" value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-xs font-bold text-gray-600">설명</label>
              <input className="border border-dashed border-gray-400 bg-white px-3 py-2 text-sm"
                placeholder="오시 첫 등록 시 지급" value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-600">
                조건 종류 <span className="font-normal text-gray-400">(직접 입력 가능)</span>
              </label>
              <input list="condition-suggestions"
                className="border border-dashed border-gray-400 bg-white px-3 py-2 text-sm"
                placeholder="ex) post_count, season_join ..."
                value={form.condition_type}
                onChange={(e) => setForm((f) => ({ ...f, condition_type: e.target.value }))} />
              <datalist id="condition-suggestions">
                {CONDITION_SUGGESTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </datalist>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-600">조건 값</label>
              <input type="number" min={0}
                className="border border-dashed border-gray-400 bg-white px-3 py-2 text-sm"
                value={form.condition_value}
                onChange={(e) => setForm((f) => ({ ...f, condition_value: Number(e.target.value) }))} />
            </div>
          </div>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <div className="flex gap-2 pt-1">
            <button onClick={handleSave} disabled={saving}
              className="rounded bg-black px-5 py-2 text-sm text-white disabled:opacity-50 hover:opacity-80">
              {saving ? "저장 중..." : "저장"}
            </button>
            <button onClick={cancel}
              className="rounded border border-dashed border-gray-400 px-5 py-2 text-sm hover:bg-gray-100">
              취소
            </button>
          </div>
        </div>
      )}

      {/* 뱃지 지급 패널 */}
      {grantBadge && (
        <div className="rounded border border-dashed border-blue-400 bg-blue-50/40 p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{grantBadge.icon}</span>
              <div>
                <p className="font-bold text-sm">{grantBadge.name} 지급</p>
                <p className="text-xs text-gray-500">{grantBadge.description}</p>
              </div>
            </div>
            <button onClick={closeGrant}
              className="text-xs border border-dashed border-gray-400 px-2 py-1 hover:bg-gray-100">
              닫기
            </button>
          </div>

          {/* 유저 검색 */}
          <div className="flex gap-2">
            <input
              ref={searchRef}
              className="flex-1 border border-dashed border-gray-400 bg-white px-3 py-2 text-sm"
              placeholder="닉네임 또는 핸들로 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <button
              onClick={handleSearch}
              disabled={searching || !searchQuery.trim()}
              className="border border-dashed border-gray-400 px-4 py-2 text-sm hover:bg-gray-100 disabled:opacity-40"
            >
              {searching ? "검색 중..." : "검색"}
            </button>
          </div>

          {/* 검색 결과 */}
          {searchResults.length > 0 && (
            <div className="flex flex-col divide-y divide-dashed divide-gray-200 rounded border border-dashed border-gray-300 bg-white">
              {searchResults.map((u) => (
                <div key={u.user_id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="w-8 h-8 shrink-0 overflow-hidden border border-dashed border-gray-300 bg-gray-100">
                    {u.avatar_url
                      ? <img src={u.avatar_url} alt={u.nickname} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center text-[9px] text-gray-400">No</div>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{u.nickname}</p>
                    {u.handle && <p className="text-xs text-gray-400">@{u.handle}</p>}
                  </div>
                  {grantMsg[u.user_id] ? (
                    <span className={`text-xs font-bold shrink-0 ${
                      grantMsg[u.user_id].startsWith("오류") ? "text-red-500"
                      : grantMsg[u.user_id] === "이미 보유 중" ? "text-gray-400"
                      : "text-blue-600"
                    }`}>
                      {grantMsg[u.user_id]}
                    </span>
                  ) : (
                    <button
                      onClick={() => handleGrant(u)}
                      disabled={grantingId === u.user_id}
                      className="shrink-0 rounded bg-blue-600 px-3 py-1 text-xs text-white disabled:opacity-50 hover:bg-blue-700"
                    >
                      {grantingId === u.user_id ? "지급 중..." : "지급"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {searchResults.length === 0 && searchQuery && !searching && (
            <p className="text-sm text-gray-400">검색 결과가 없습니다.</p>
          )}
        </div>
      )}

      {/* 뱃지 목록 */}
      <section className="rounded border border-dashed border-gray-500 bg-white/70 p-5">
        {loading ? (
          <p className="text-sm text-gray-500">로딩 중...</p>
        ) : badges.length === 0 ? (
          <p className="text-sm text-gray-500">등록된 뱃지가 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-dashed border-gray-300 text-xs uppercase tracking-widest text-gray-500">
                  <th className="py-2 pr-4">아이콘</th>
                  <th className="py-2 pr-4">이름</th>
                  <th className="py-2 pr-4">설명</th>
                  <th className="py-2 pr-4">희귀도</th>
                  <th className="py-2 pr-4">조건</th>
                  <th className="py-2 pr-4">값</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dashed divide-gray-200">
                {badges.map((b) => (
                  <tr key={b.id}
                    className={`group transition-colors ${grantBadge?.id === b.id ? "bg-blue-50" : ""}`}>
                    <td className="py-3 pr-4 text-2xl leading-none">{b.icon}</td>
                    <td className="py-3 pr-4 font-bold">{b.name}</td>
                    <td className="py-3 pr-4 text-gray-500 max-w-[160px] truncate" title={b.description}>
                      {b.description || "—"}
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`inline-block border px-1.5 py-0.5 text-[11px] font-bold ${RARITY_STYLE[b.rarity]}`}>
                        {RARITY_LABELS[b.rarity]}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-gray-500 text-xs font-mono">
                      {CONDITION_SUGGESTIONS.find((o) => o.value === b.condition_type)?.label ?? b.condition_type}
                    </td>
                    <td className="py-3 pr-4 tabular-nums">{b.condition_value}</td>
                    <td className="py-3">
                      <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => grantBadge?.id === b.id ? closeGrant() : openGrant(b)}
                          className={`border border-dashed px-2 py-1 text-xs transition-colors ${
                            grantBadge?.id === b.id
                              ? "border-blue-400 bg-blue-100 text-blue-700"
                              : "border-blue-300 text-blue-600 hover:bg-blue-50"
                          }`}
                        >
                          지급
                        </button>
                        <button onClick={() => openEdit(b)}
                          className="border border-dashed border-gray-400 px-2 py-1 text-xs hover:bg-gray-100">
                          수정
                        </button>
                        <button onClick={() => handleDelete(b)}
                          className="border border-dashed border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50">
                          삭제
                        </button>
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
