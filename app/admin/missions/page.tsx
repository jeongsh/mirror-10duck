"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { fetchActiveMissions, type DailyMission, type MissionActionType } from "@/lib/community/missions";
import { supabase } from "@/lib/supabase/client";
import { useIsAdmin } from "@/lib/supabase/useAuthUser";

const ACTION_TYPE_OPTIONS: MissionActionType[] = ["attendance", "comment", "reaction", "post"];

type AdminMissionRow = DailyMission;

export default function AdminMissionsPage() {
  const isAdmin = useIsAdmin();
  const [missions, setMissions] = useState<AdminMissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [draftSlug, setDraftSlug] = useState("");
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [draftAction, setDraftAction] = useState<MissionActionType>("comment");
  const [draftTarget, setDraftTarget] = useState(1);
  const [draftSortOrder, setDraftSortOrder] = useState(10);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: queryError } = await supabase
      .from("daily_missions")
      .select(
        "id, slug, title, description, action_type, target_count, reward_type, reward_payload, active, sort_order",
      )
      .order("sort_order", { ascending: true });
    if (queryError) {
      setError(queryError.message);
      setLoading(false);
      return;
    }
    setMissions(
      ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
        id: row.id as string,
        slug: row.slug as string,
        title: row.title as string,
        description: (row.description as string | null) ?? null,
        actionType: row.action_type as MissionActionType,
        targetCount: (row.target_count as number) ?? 1,
        rewardType: (row.reward_type as string | null) ?? null,
        rewardPayload: (row.reward_payload as Record<string, unknown> | null) ?? null,
        active: Boolean(row.active),
        sortOrder: (row.sort_order as number) ?? 0,
      })),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isAdmin !== true) return;
    void load();
  }, [isAdmin, load]);

  async function toggleActive(mission: AdminMissionRow) {
    const { error: updateError } = await supabase
      .from("daily_missions")
      .update({ active: !mission.active, updated_at: new Date().toISOString() })
      .eq("id", mission.id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    await load();
  }

  async function deleteMission(mission: AdminMissionRow) {
    if (!confirm(`'${mission.title}' 미션을 삭제할까요? 진행 기록도 함께 정리됩니다.`)) return;
    const { error: deleteError } = await supabase
      .from("daily_missions")
      .delete()
      .eq("id", mission.id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    await load();
  }

  async function createMission() {
    if (!draftSlug.trim() || !draftTitle.trim()) {
      setError("슬러그와 제목은 필수입니다.");
      return;
    }
    setCreating(true);
    setError(null);
    const { error: insertError } = await supabase.from("daily_missions").insert({
      slug: draftSlug.trim(),
      title: draftTitle.trim(),
      description: draftDescription.trim() || null,
      action_type: draftAction,
      target_count: Math.max(1, draftTarget),
      sort_order: draftSortOrder,
      active: true,
    });
    setCreating(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setDraftSlug("");
    setDraftTitle("");
    setDraftDescription("");
    setDraftTarget(1);
    setDraftSortOrder((value) => value + 1);
    await load();
  }

  if (isAdmin === undefined) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-sm text-gray-500">로딩 중...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold">미션 관리</h1>
        <Link href="/missions" className="text-xs text-gray-500 underline">
          사용자 화면 보기
        </Link>
      </div>

      <section className="mb-8 rounded border border-dashed border-gray-300 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold">새 미션 추가</h2>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input
            type="text"
            placeholder="슬러그 (예: comment-3)"
            value={draftSlug}
            onChange={(event) => setDraftSlug(event.target.value)}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          />
          <input
            type="text"
            placeholder="제목"
            value={draftTitle}
            onChange={(event) => setDraftTitle(event.target.value)}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          />
          <input
            type="text"
            placeholder="설명 (선택)"
            value={draftDescription}
            onChange={(event) => setDraftDescription(event.target.value)}
            className="rounded border border-gray-300 px-2 py-1 text-sm sm:col-span-2"
          />
          <select
            value={draftAction}
            onChange={(event) => setDraftAction(event.target.value as MissionActionType)}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          >
            {ACTION_TYPE_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            value={draftTarget}
            onChange={(event) => setDraftTarget(Number(event.target.value) || 1)}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          />
          <input
            type="number"
            value={draftSortOrder}
            onChange={(event) => setDraftSortOrder(Number(event.target.value) || 0)}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          />
          <button
            type="button"
            onClick={createMission}
            disabled={creating}
            className="rounded bg-pink-500 px-3 py-1 text-sm font-semibold text-white disabled:opacity-60"
          >
            {creating ? "추가 중" : "추가"}
          </button>
        </div>
      </section>

      {error && <p className="mb-4 text-sm text-red-500">{error}</p>}

      {loading ? (
        <p className="text-sm text-gray-500">불러오는 중이에요.</p>
      ) : missions.length === 0 ? (
        <p className="text-sm text-gray-500">등록된 미션이 없어요.</p>
      ) : (
        <ul className="space-y-2">
          {missions.map((mission) => (
            <li
              key={mission.id}
              className="flex items-center justify-between gap-3 rounded border border-gray-200 bg-white p-3 shadow-sm"
            >
              <div>
                <p className="font-semibold">{mission.title}</p>
                <p className="mt-1 text-xs text-gray-500">
                  {mission.slug} · {mission.actionType} · 목표 {mission.targetCount} · sort {mission.sortOrder}
                </p>
                {mission.description && (
                  <p className="mt-1 text-xs text-gray-400">{mission.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleActive(mission)}
                  className={`rounded px-2 py-1 text-xs font-semibold ${
                    mission.active
                      ? "bg-pink-50 text-pink-600 hover:bg-pink-100"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {mission.active ? "비활성화" : "활성화"}
                </button>
                <button
                  type="button"
                  onClick={() => deleteMission(mission)}
                  className="rounded bg-red-50 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-100"
                >
                  삭제
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
