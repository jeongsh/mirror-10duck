"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import CatalogRequestReviewModal, {
  type CatalogRequestSelection,
} from "@/components/admin/catalog/CatalogRequestReviewModal";
import {
  catalogRequestStatusLabel,
  reasonLabel,
  type CatalogEditChanges,
} from "@/lib/catalogRequest";
import { getWorkCategoryLabel } from "@/lib/official/catalog";
import { supabase } from "@/lib/supabase/client";
import { useAuthUser, useIsAdmin } from "@/lib/supabase/useAuthUser";
import type {
  CatalogEditRequestRow,
  CatalogRequestStatus,
  CharacterAddRequestRow,
  WorkAddRequestRow,
} from "@/types/catalogRequest";

type Tab = "character" | "work" | "edit";
type StatusFilter = "ALL" | CatalogRequestStatus;

const TABS: { id: Tab; label: string }[] = [
  { id: "character", label: "캐릭터 추가" },
  { id: "work", label: "작품 추가" },
  { id: "edit", label: "수정 제안" },
];

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "ALL", label: "전체" },
  { id: "PENDING", label: "대기" },
  { id: "APPROVED", label: "승인" },
  { id: "REJECTED", label: "반려" },
];

const CHANGE_LABELS: Record<string, string> = {
  name: "이름",
  original_name: "원문명",
  work_id: "작품 ID",
  work_title: "작품명",
  tags: "태그",
  meme_tags: "밈 태그",
  positions: "포지션",
  description: "설명",
  profile_image_url: "프로필 이미지",
  profile_image_note: "이미지 메모",
  title: "작품명",
  original_title: "원제",
  category: "카테고리",
  genres: "장르",
  cover_image_note: "표지 메모",
  duplicate_note: "중복 메모",
};

function formatChangeValue(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (Array.isArray(value)) return value.join(", ") || "-";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function formatChanges(changes: CatalogEditChanges): { key: string; label: string; value: string }[] {
  return Object.entries(changes).map(([key, value]) => ({
    key,
    label: CHANGE_LABELS[key] ?? key,
    value: formatChangeValue(value),
  }));
}

function statusClass(status: string) {
  if (status === "PENDING") return "text-red-600";
  if (status === "APPROVED") return "text-green-600";
  if (status === "REJECTED") return "text-gray-400";
  return "text-gray-600";
}

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[10px] font-bold text-blue-600 hover:underline"
    >
      {children}
    </a>
  );
}

export default function AdminCatalogRequestsPage() {
  const authUser = useAuthUser();
  const isAdmin = useIsAdmin();
  const [tab, setTab] = useState<Tab>("character");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("PENDING");
  const [loading, setLoading] = useState(true);
  const [characterRows, setCharacterRows] = useState<CharacterAddRequestRow[]>([]);
  const [workRows, setWorkRows] = useState<WorkAddRequestRow[]>([]);
  const [editRows, setEditRows] = useState<CatalogEditRequestRow[]>([]);
  const [targetLabels, setTargetLabels] = useState<Record<string, string>>({});
  const [characterWorkLinks, setCharacterWorkLinks] = useState<Record<string, string>>({});
  const [selectedRequest, setSelectedRequest] = useState<CatalogRequestSelection | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);

    const [characterRes, workRes, editRes] = await Promise.all([
      supabase
        .from("character_add_requests")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase.from("work_add_requests").select("*").order("created_at", { ascending: false }),
      supabase
        .from("catalog_edit_requests")
        .select("*")
        .order("created_at", { ascending: false }),
    ]);

    if (characterRes.error) console.error(characterRes.error);
    if (workRes.error) console.error(workRes.error);
    if (editRes.error) console.error(editRes.error);

    const characters = (characterRes.data ?? []) as CharacterAddRequestRow[];
    const works = (workRes.data ?? []) as WorkAddRequestRow[];
    const edits = (editRes.data ?? []) as CatalogEditRequestRow[];

    setCharacterRows(characters);
    setWorkRows(works);
    setEditRows(edits);

    const characterIds = edits
      .filter((row) => row.target_type === "character" && row.character_id)
      .map((row) => row.character_id as string);
    const workIds = edits
      .filter((row) => row.target_type === "work" && row.work_id)
      .map((row) => row.work_id as string);

    const labels: Record<string, string> = {};
    const workLinks: Record<string, string> = {};

    if (characterIds.length > 0) {
      const { data } = await supabase
        .from("official_oshi_characters")
        .select("id, name, work_id, official_works(title)")
        .in("id", characterIds);
      data?.forEach((row) => {
        const joinedWork = Array.isArray(row.official_works)
          ? row.official_works[0]
          : row.official_works;
        const workTitle = joinedWork?.title;
        labels[`character:${row.id}`] = workTitle ? `${row.name} (${workTitle})` : row.name;
        workLinks[row.id] = `/admin/works/${row.work_id}`;
      });
    }

    if (workIds.length > 0) {
      const { data } = await supabase.from("official_works").select("id, title").in("id", workIds);
      data?.forEach((row: { id: string; title: string }) => {
        labels[`work:${row.id}`] = row.title;
      });
    }

    setTargetLabels(labels);
    setCharacterWorkLinks(workLinks);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isAdmin !== true) {
      if (isAdmin === false) setLoading(false);
      return;
    }
    void fetchAll();
  }, [isAdmin, fetchAll]);

  const counts = useMemo(
    () => ({
      characterPending: characterRows.filter((r) => r.status === "PENDING").length,
      workPending: workRows.filter((r) => r.status === "PENDING").length,
      editPending: editRows.filter((r) => r.status === "PENDING").length,
    }),
    [characterRows, workRows, editRows],
  );

  const filterByStatus = <T extends { status: string }>(rows: T[]) =>
    statusFilter === "ALL" ? rows : rows.filter((row) => row.status === statusFilter);

  const updateStatus = async (
    table: "character_add_requests" | "work_add_requests" | "catalog_edit_requests",
    id: string,
    status: CatalogRequestStatus,
  ) => {
    const note = window.prompt("관리자 메모 (선택, 비우면 변경 없음)") ?? undefined;
    const payload: Record<string, unknown> = {
      status,
      decided_by: authUser?.id ?? null,
      decided_at: new Date().toISOString(),
    };
    if (note !== undefined && note.trim().length > 0) {
      payload.admin_note = note.trim();
    }

    const { error } = await supabase.from(table).update(payload).eq("id", id);
    if (error) {
      alert(`상태 변경 실패: ${error.message}`);
      return;
    }
    void fetchAll();
  };

  const filteredCharacters = filterByStatus(characterRows);
  const filteredWorks = filterByStatus(workRows);
  const filteredEdits = filterByStatus(editRows);

  if (loading || isAdmin === undefined) return <main className="p-6">로딩 중...</main>;

  if (!isAdmin) {
    return (
      <main className="flex min-h-[400px] flex-col items-center justify-center gap-4 p-6">
        <h1 className="text-2xl font-bold text-red-600">접근 권한 없음</h1>
        <p className="text-gray-600">관리자 계정으로 로그인해야 접근할 수 있습니다.</p>
        <Link href="/" className="border border-dashed border-gray-500 px-4 py-2 hover:bg-gray-100">
          홈으로 돌아가기
        </Link>
      </main>
    );
  }

  return (
    <main className="flex w-full flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-dashed border-gray-500 pb-4">
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-widest">캐릭터 · 작품 요청</h1>
          <p className="text-sm text-gray-500">
            바이럴·분석에서 접수된 추가·수정 요청을 검토합니다. 승인 후에는 작품/최애캐 관리에서
            DB에 반영하세요.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void fetchAll()}
          className="border border-dashed border-gray-800 bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-widest hover:bg-gray-100"
        >
          새로고침
        </button>
      </header>

      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
        <span>
          대기: 캐릭터 {counts.characterPending} · 작품 {counts.workPending} · 수정{" "}
          {counts.editPending}
        </span>
        <Link href="/admin/works" className="font-bold text-gray-800 underline hover:text-black">
          작품/최애캐 관리로 이동
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`border border-dashed px-3 py-1.5 text-xs font-bold ${
              tab === item.id
                ? "border-gray-700 bg-gray-900 text-white"
                : "border-gray-400 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            {item.label}
          </button>
        ))}
        <span className="mx-1 self-center text-gray-300">|</span>
        {STATUS_FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setStatusFilter(item.id)}
            className={`border border-dashed px-2 py-1 text-[11px] font-bold ${
              statusFilter === item.id
                ? "border-gray-600 bg-gray-200 text-gray-900"
                : "border-gray-300 bg-white text-gray-500 hover:bg-gray-50"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "character" && (
        <RequestTable
          emptyMessage="캐릭터 추가 요청이 없습니다."
          rows={filteredCharacters}
          columns={[
            { key: "created_at", header: "접수일", width: "w-36" },
            { key: "character", header: "캐릭터 / 작품", width: "" },
            { key: "meta", header: "사유·출처", width: "w-40" },
            { key: "status", header: "상태", width: "w-20" },
            { key: "actions", header: "관리", width: "w-44" },
          ]}
          renderRow={(row) => (
            <tr
              key={row.id}
              onClick={() => setSelectedRequest({ type: "character-add", row })}
              className="cursor-pointer transition-colors hover:bg-white"
            >
              <td className="px-4 py-3 text-[11px] text-gray-500 tabular-nums">
                {new Date(row.created_at).toLocaleString("ko-KR")}
              </td>
              <td className="px-4 py-3">
                <p className="font-bold text-gray-900">{row.character_name}</p>
                {row.character_original_name && (
                  <p className="text-xs text-gray-500">{row.character_original_name}</p>
                )}
                <p className="mt-1 text-xs text-gray-700">
                  작품: {row.work_title}
                  {row.request_new_work && (
                    <span className="ml-1 border border-dashed border-amber-400 bg-amber-50 px-1 text-[10px] font-bold text-amber-800">
                      신규 작품
                    </span>
                  )}
                </p>
                {row.work_category && (
                  <p className="text-[10px] text-gray-400">
                    카테고리: {getWorkCategoryLabel(row.work_category)}
                  </p>
                )}
                {row.character_note && (
                  <p className="mt-1 line-clamp-2 border border-dashed border-gray-200 bg-gray-50 p-1.5 text-xs text-gray-600">
                    {row.character_note}
                  </p>
                )}
                {row.source_url && (
                  <p className="mt-1">
                    <ExternalLink href={row.source_url}>참고 URL ↗</ExternalLink>
                  </p>
                )}
                {row.official_work_id && (
                  <p className="mt-1">
                    <Link
                      href={`/admin/works/${row.official_work_id}`}
                      onClick={(event) => event.stopPropagation()}
                      className="text-[10px] font-bold text-blue-600 hover:underline"
                    >
                      연결 작품 관리 →
                    </Link>
                  </p>
                )}
              </td>
              <td className="px-4 py-3 text-xs">
                <p className="font-bold text-gray-700">{reasonLabel(row.reason)}</p>
                <p className="text-gray-500">{row.source ?? "-"}</p>
                {row.requester_id && (
                  <p className="mt-0.5 font-mono text-[10px] text-gray-400">
                    {row.requester_id.slice(0, 8)}…
                  </p>
                )}
              </td>
              <td className={`px-4 py-3 text-xs font-bold ${statusClass(row.status)}`}>
                {catalogRequestStatusLabel(row.status)}
                {row.admin_note && (
                  <p className="mt-1 font-normal text-gray-500 line-clamp-2">{row.admin_note}</p>
                )}
              </td>
              <td className="px-4 py-3">
                <StatusActions
                  status={row.status}
                  onApprove={() => void updateStatus("character_add_requests", row.id, "APPROVED")}
                  onReject={() => void updateStatus("character_add_requests", row.id, "REJECTED")}
                />
              </td>
            </tr>
          )}
        />
      )}

      {tab === "work" && (
        <RequestTable
          emptyMessage="작품 추가 요청이 없습니다."
          rows={filteredWorks}
          columns={[
            { key: "created_at", header: "접수일", width: "w-36" },
            { key: "work", header: "작품", width: "" },
            { key: "meta", header: "사유·출처", width: "w-40" },
            { key: "status", header: "상태", width: "w-20" },
            { key: "actions", header: "관리", width: "w-44" },
          ]}
          renderRow={(row) => (
            <tr
              key={row.id}
              onClick={() => setSelectedRequest({ type: "work-add", row })}
              className="cursor-pointer transition-colors hover:bg-white"
            >
              <td className="px-4 py-3 text-[11px] text-gray-500 tabular-nums">
                {new Date(row.created_at).toLocaleString("ko-KR")}
              </td>
              <td className="px-4 py-3">
                <p className="font-bold text-gray-900">{row.work_title}</p>
                {row.original_title && (
                  <p className="text-xs text-gray-500">{row.original_title}</p>
                )}
                <p className="mt-1 text-[10px] text-gray-500">
                  {getWorkCategoryLabel(row.category)}
                </p>
                {row.source_url && (
                  <p className="mt-1">
                    <ExternalLink href={row.source_url}>참고 URL ↗</ExternalLink>
                  </p>
                )}
              </td>
              <td className="px-4 py-3 text-xs">
                <p className="font-bold text-gray-700">{reasonLabel(row.reason)}</p>
                <p className="text-gray-500">{row.source ?? "-"}</p>
              </td>
              <td className={`px-4 py-3 text-xs font-bold ${statusClass(row.status)}`}>
                {catalogRequestStatusLabel(row.status)}
                {row.admin_note && (
                  <p className="mt-1 font-normal text-gray-500 line-clamp-2">{row.admin_note}</p>
                )}
              </td>
              <td className="px-4 py-3">
                <StatusActions
                  status={row.status}
                  onApprove={() => void updateStatus("work_add_requests", row.id, "APPROVED")}
                  onReject={() => void updateStatus("work_add_requests", row.id, "REJECTED")}
                />
              </td>
            </tr>
          )}
        />
      )}

      {tab === "edit" && (
        <RequestTable
          emptyMessage="수정 제안이 없습니다."
          rows={filteredEdits}
          columns={[
            { key: "created_at", header: "접수일", width: "w-36" },
            { key: "target", header: "대상", width: "w-48" },
            { key: "changes", header: "제안 내용", width: "" },
            { key: "status", header: "상태", width: "w-20" },
            { key: "actions", header: "관리", width: "w-44" },
          ]}
          renderRow={(row) => {
            const targetKey =
              row.target_type === "character"
                ? `character:${row.character_id}`
                : `work:${row.work_id}`;
            const targetLabel = targetLabels[targetKey] ?? targetKey;
            const adminHref =
              row.target_type === "work" && row.work_id
                ? `/admin/works/${row.work_id}`
                : row.character_id
                  ? characterWorkLinks[row.character_id]
                  : null;

            return (
              <tr
                key={row.id}
                onClick={() => setSelectedRequest({ type: "edit", row })}
                className="cursor-pointer transition-colors hover:bg-white"
              >
                <td className="px-4 py-3 text-[11px] text-gray-500 tabular-nums">
                  {new Date(row.created_at).toLocaleString("ko-KR")}
                </td>
                <td className="px-4 py-3 text-xs">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      row.target_type === "character"
                        ? "bg-purple-100 text-purple-700"
                        : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {row.target_type === "character" ? "캐릭터" : "작품"}
                  </span>
                  <p className="mt-1 font-bold text-gray-900">{targetLabel}</p>
                  {row.reason && <p className="mt-1 text-gray-500">{row.reason}</p>}
                  <p className="text-gray-400">{row.source ?? "-"}</p>
                  {adminHref && (
                    <Link
                      href={adminHref}
                      onClick={(event) => event.stopPropagation()}
                      className="mt-1 inline-block text-[10px] font-bold text-blue-600 hover:underline"
                    >
                      작품 관리 →
                    </Link>
                  )}
                  {row.target_type === "character" && row.character_id && (
                    <Link
                      href={`/play/catalog-request/character/${row.character_id}/edit`}
                      onClick={(event) => event.stopPropagation()}
                      className="mt-1 block text-[10px] text-gray-500 hover:underline"
                    >
                      사용자 수정 폼 보기
                    </Link>
                  )}
                </td>
                <td className="px-4 py-3">
                  <ul className="flex max-w-lg flex-col gap-1 text-xs text-gray-700">
                    {formatChanges(row.changes).map((item) => (
                      <li key={item.key} className="border border-dashed border-gray-200 bg-gray-50 px-2 py-1">
                        <span className="font-bold text-gray-800">{item.label}: </span>
                        <span className="break-all">{item.value}</span>
                      </li>
                    ))}
                  </ul>
                </td>
                <td className={`px-4 py-3 text-xs font-bold ${statusClass(row.status)}`}>
                  {catalogRequestStatusLabel(row.status)}
                  {row.admin_note && (
                    <p className="mt-1 font-normal text-gray-500 line-clamp-2">{row.admin_note}</p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <StatusActions
                    status={row.status}
                    onApprove={() => void updateStatus("catalog_edit_requests", row.id, "APPROVED")}
                    onReject={() => void updateStatus("catalog_edit_requests", row.id, "REJECTED")}
                  />
                </td>
              </tr>
            );
          }}
        />
      )}

      <CatalogRequestReviewModal
        selection={selectedRequest}
        reviewerId={authUser?.id}
        onClose={() => setSelectedRequest(null)}
        onChanged={() => void fetchAll()}
      />
    </main>
  );
}

function StatusActions({
  status,
  onApprove,
  onReject,
}: {
  status: string;
  onApprove: () => void;
  onReject: () => void;
}) {
  if (status !== "PENDING") {
    return <span className="text-[10px] text-gray-400">처리됨</span>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onApprove();
        }}
        className="text-[10px] font-bold uppercase tracking-widest text-green-700 hover:underline"
      >
        [승인]
      </button>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onReject();
        }}
        className="text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:underline"
      >
        [반려]
      </button>
    </div>
  );
}

function RequestTable<T>({
  columns,
  rows,
  emptyMessage,
  renderRow,
}: {
  columns: { key: string; header: string; width: string }[];
  rows: T[];
  emptyMessage: string;
  renderRow: (row: T) => ReactNode;
}) {
  return (
    <section className="overflow-x-auto border border-dashed border-gray-500 bg-white/70">
      <table className="w-full min-w-[960px] border-collapse text-left text-sm">
        <thead className="bg-gray-100 text-[11px] font-bold uppercase tracking-widest text-gray-500">
          <tr>
            {columns.map((col) => (
              <th key={col.key} className={`px-4 py-3 ${col.width}`}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-dashed divide-gray-300">
          {rows.map((row) => renderRow(row))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-center text-gray-500">
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
