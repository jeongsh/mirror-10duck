"use client";

import Link from "next/link";
import { Edit3, ExternalLink, FilePlus2, ImageIcon, Loader2, Plus, RefreshCw, Save, Sparkles, Trash2, Upload, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import CommunityEditor from "@/components/community/editor/CommunityEditor";
import { supabase } from "@/lib/supabase/client";
import { useAuthUser } from "@/lib/supabase/useAuthUser";
import { EVENT_TYPE_LABELS, formatEventPeriod, type CalendarEventType } from "@/lib/otaku/hub";

export type AdminEventKind = "release";

type AdminEventRow = {
  id: string;
  event_type: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  source_url: string | null;
  image_url: string | null;
  detail_image_url: string | null;
  status: string;
};

type EventEditForm = {
  id: string;
  eventType: CalendarEventType;
  title: string;
  startsAt: string;
  endsAt: string;
  location: string;
  sourceUrl: string;
  imageUrl: string;
  detailImageUrl: string;
  status: string;
  description: string;
};

type EventCandidateRow = {
  id: string;
  title: string;
  source_name: string;
  source_url: string;
  normalized_url: string;
  summary: string;
  category: string;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  is_checked: boolean;
  searched_at: string;
  checked_at: string | null;
  checked_by: string | null;
  duplicate_status: "none" | "suspected";
  duplicate_event_id: string | null;
  duplicate_similarity: number | null;
  duplicate_reason: string | null;
  release_events?: {
    id: string;
    title: string;
    starts_at: string;
    ends_at: string | null;
    location: string | null;
    source_url: string | null;
  } | null;
};

type AiSearchResult = {
  insertedCount: number;
  duplicateUrlCount: number;
  duplicateSuspectedCount: number;
  returnedCount: number;
  mode?: "daily" | "full";
};

type DraftCreateResult = {
  createdCount: number;
  skippedCount: number;
  message?: string;
};

const RELEASE_EVENT_TYPES: CalendarEventType[] = [
  "goods_preorder",
  "goods_release",
  "offline_event",
  "ticket_event",
  "live_event",
];

const ADMIN_EVENT_TYPES: Record<AdminEventKind, CalendarEventType[]> = {
  release: RELEASE_EVENT_TYPES,
};

const ADMIN_META: Record<AdminEventKind, { title: string; description: string; publicHref: string }> = {
  release: {
    title: "이벤트 관리",
    description: "공식 발매, 예약, 티켓 오픈, 팝업, 라이브 일정을 관리합니다.",
    publicHref: "/events",
  },
};

export default function AdminEventListPage({ kind }: { kind: AdminEventKind }) {
  const meta = ADMIN_META[kind];
  const authUser = useAuthUser();
  const [events, setEvents] = useState<AdminEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [candidateModalOpen, setCandidateModalOpen] = useState(false);
  const [candidates, setCandidates] = useState<EventCandidateRow[]>([]);
  const [candidatesLoaded, setCandidatesLoaded] = useState(false);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [collectingMode, setCollectingMode] = useState<"daily" | "full" | null>(null);
  const [collectResult, setCollectResult] = useState<AiSearchResult | null>(null);
  const [candidateError, setCandidateError] = useState<string | null>(null);
  const [hideChecked, setHideChecked] = useState(false);
  const [showDuplicatesOnly, setShowDuplicatesOnly] = useState(false);
  const [draftCreating, setDraftCreating] = useState(false);
  const [draftResult, setDraftResult] = useState<DraftCreateResult | null>(null);
  const [editForm, setEditForm] = useState<EventEditForm | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [uploadingImageField, setUploadingImageField] = useState<"imageUrl" | "detailImageUrl" | null>(null);

  async function fetchEvents() {
    setLoading(true);
    const { data, error } = await supabase
      .from("release_events")
      .select("id, event_type, title, description, starts_at, ends_at, location, source_url, image_url, detail_image_url, status")
      .in("event_type", ADMIN_EVENT_TYPES[kind].map((type) => type.toUpperCase()))
      .order("starts_at", { ascending: false });

    if (error) {
      console.error(`[admin:${kind}] failed to load events:`, error);
      setEvents([]);
    } else {
      setEvents((data as AdminEventRow[] | null) ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    void fetchEvents();
  }, [kind]);

  const visibleCandidates = useMemo(() => {
    return candidates.filter((candidate) => {
      if (hideChecked && candidate.is_checked) return false;
      if (showDuplicatesOnly && candidate.duplicate_status !== "suspected") return false;
      return true;
    });
  }, [candidates, hideChecked, showDuplicatesOnly]);

  const allVisibleChecked =
    visibleCandidates.length > 0 && visibleCandidates.every((candidate) => candidate.is_checked);
  const checkedCandidateCount = candidates.filter((candidate) => candidate.is_checked).length;

  async function getAccessToken(): Promise<string | null> {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }

  async function fetchCandidates() {
    setCandidatesLoading(true);
    setCandidateError(null);

    const token = await getAccessToken();
    if (!token) {
      setCandidateError("로그인이 필요합니다.");
      setCandidatesLoading(false);
      return;
    }

    const response = await fetch("/admin/events/candidates", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const json = (await response.json().catch(() => null)) as {
      candidates?: EventCandidateRow[];
      error?: string;
    } | null;

    if (!response.ok) {
      setCandidateError(json?.error ?? "후보 목록을 불러오지 못했습니다.");
      setCandidates([]);
    } else {
      setCandidates(json?.candidates ?? []);
      setCandidatesLoaded(true);
    }

    setCandidatesLoading(false);
  }

  async function handleOpenCandidates() {
    setCandidateModalOpen(true);
    setCandidateError(null);
    if (!candidatesLoaded) {
      await fetchCandidates();
    }
  }

  async function handleFindCandidates(mode: "daily" | "full" = "full") {
    setCandidateModalOpen(true);
    setCollectingMode(mode);
    setCandidateError(null);
    setCollectResult(null);

    const token = await getAccessToken();
    if (!token) {
      setCandidateError("로그인이 필요합니다.");
      setCollectingMode(null);
      return;
    }

    const response = await fetch("/admin/events/find-candidates", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ mode }),
    });
    const json = (await response.json().catch(() => null)) as (AiSearchResult & { error?: string }) | null;

    if (!response.ok) {
      setCandidateError(json?.error ?? "AI 이벤트 찾기에 실패했습니다.");
    } else if (json) {
      setCollectResult({
        insertedCount: json.insertedCount,
        duplicateUrlCount: json.duplicateUrlCount,
        duplicateSuspectedCount: json.duplicateSuspectedCount,
        returnedCount: json.returnedCount,
        mode: json.mode,
      });
      await fetchCandidates();
    }

    setCollectingMode(null);
  }

  async function handleCreateDrafts() {
    setDraftCreating(true);
    setCandidateError(null);
    setDraftResult(null);

    const token = await getAccessToken();
    if (!token) {
      setCandidateError("로그인이 필요합니다.");
      setDraftCreating(false);
      return;
    }

    const response = await fetch("/admin/events/candidates/create-drafts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        candidate_ids: candidates
          .filter((candidate) => candidate.is_checked)
          .map((candidate) => candidate.id),
      }),
    });
    const json = (await response.json().catch(() => null)) as (DraftCreateResult & { error?: string }) | null;

    if (!response.ok) {
      setCandidateError(json?.error ?? "초안 생성에 실패했습니다.");
    } else if (json) {
      setDraftResult({
        createdCount: json.createdCount,
        skippedCount: json.skippedCount,
        message: json.message,
      });
      await fetchEvents();
    }

    setDraftCreating(false);
  }

  async function updateCandidateChecked(id: string, isChecked: boolean) {
    const previous = candidates;
    setCandidates((current) =>
      current.map((candidate) =>
        candidate.id === id
          ? {
              ...candidate,
              is_checked: isChecked,
              checked_at: isChecked ? new Date().toISOString() : null,
            }
          : candidate,
      ),
    );

    const token = await getAccessToken();
    if (!token) {
      setCandidateError("로그인이 필요합니다.");
      setCandidates(previous);
      return;
    }

    const response = await fetch(`/admin/events/candidates/${id}/check`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ is_checked: isChecked }),
    });

    if (!response.ok) {
      const json = (await response.json().catch(() => null)) as { error?: string } | null;
      setCandidateError(json?.error ?? "체크 상태 저장에 실패했습니다.");
      setCandidates(previous);
    }
  }

  async function toggleVisibleCandidates(isChecked: boolean) {
    for (const candidate of visibleCandidates) {
      if (candidate.is_checked !== isChecked) {
        await updateCandidateChecked(candidate.id, isChecked);
      }
    }
  }

  function openEditModal(event: AdminEventRow) {
    setEditForm({
      id: event.id,
      eventType: event.event_type.toLowerCase() as CalendarEventType,
      title: event.title,
      startsAt: toLocalDateValue(event.starts_at),
      endsAt: event.ends_at ? toLocalDateValue(event.ends_at) : "",
      location: event.location ?? "",
      sourceUrl: event.source_url ?? "",
      imageUrl: event.image_url ?? "",
      detailImageUrl: event.detail_image_url ?? "",
      status: event.status,
      description: toEditorBody(event.description),
    });
  }

  async function handleSaveEvent() {
    if (!editForm) return;
    if (!editForm.title.trim() || !editForm.startsAt) {
      alert("제목과 시작일은 필수입니다.");
      return;
    }

    setSavingId(editForm.id);
    try {
      const { error } = await supabase
        .from("release_events")
        .update({
          event_type: editForm.eventType.toUpperCase(),
          title: editForm.title.trim(),
          description: emptyToNull(editForm.description),
          starts_at: dateToKstIso(editForm.startsAt),
          ends_at: editForm.endsAt ? dateToKstIso(editForm.endsAt) : null,
          location: emptyToNull(editForm.location),
          source_url: emptyToNull(editForm.sourceUrl),
          image_url: emptyToNull(editForm.imageUrl),
          detail_image_url: emptyToNull(editForm.detailImageUrl),
          status: editForm.status,
        })
        .eq("id", editForm.id);

      if (error) throw error;
      setEditForm(null);
      await fetchEvents();
    } catch (error) {
      const message = error instanceof Error ? error.message : "알 수 없는 오류";
      alert(`이벤트 수정 실패: ${message}`);
    } finally {
      setSavingId(null);
    }
  }

  async function handleEventImageUpload(field: "imageUrl" | "detailImageUrl", files: FileList | null) {
    const file = files?.[0];
    if (!file || !editForm) return;

    if (!file.type.startsWith("image/")) {
      alert("이미지 파일만 업로드할 수 있습니다.");
      return;
    }

    setUploadingImageField(field);
    try {
      const fileExt = file.name.split(".").pop() || "jpg";
      const filePath = `event-images/${editForm.id}/${field}-${crypto.randomUUID()}.${fileExt}`;
      const { error } = await supabase.storage.from("post-assets").upload(filePath, file, {
        contentType: file.type,
        upsert: false,
      });

      if (error) throw error;

      const {
        data: { publicUrl },
      } = supabase.storage.from("post-assets").getPublicUrl(filePath);

      setEditForm((current) => (current ? { ...current, [field]: publicUrl } : current));
    } catch (error) {
      const message = error instanceof Error ? error.message : "알 수 없는 오류";
      alert(`이미지 업로드 실패: ${message}`);
    } finally {
      setUploadingImageField(null);
    }
  }

  async function handleDeleteEvent(event: AdminEventRow) {
    if (!confirm(`"${event.title}" 이벤트를 삭제할까요? 이 작업은 되돌릴 수 없습니다.`)) return;

    setDeletingId(event.id);
    try {
      const { error } = await supabase.from("release_events").delete().eq("id", event.id);
      if (error) throw error;
      setEvents((current) => current.filter((item) => item.id !== event.id));
    } catch (error) {
      const message = error instanceof Error ? error.message : "알 수 없는 오류";
      alert(`이벤트 삭제 실패: ${message}`);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-dashed border-gray-500 pb-4">
        <div>
          <h2 className="text-xl font-bold">{meta.title}</h2>
          <p className="mt-1 text-sm text-gray-600">{meta.description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleOpenCandidates()}
            className="inline-flex items-center gap-1 rounded border border-dashed border-gray-500 bg-gray-900 px-3 py-2 text-sm font-semibold text-white hover:bg-gray-700"
          >
            <Sparkles size={15} />
            AI 이벤트 후보
          </button>
          <Link
            href={meta.publicHref}
            className="inline-flex items-center gap-1 rounded border border-dashed border-gray-400 bg-white px-3 py-2 text-sm hover:bg-gray-100"
          >
            공개 페이지
          </Link>
          <button
            type="button"
            disabled
            className="inline-flex cursor-not-allowed items-center gap-1 rounded border border-dashed border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-400"
            title="다음 단계에서 등록 페이지를 연결합니다."
          >
            <Plus size={15} />
            새로 등록
          </button>
        </div>
      </div>

      <section className="border border-dashed border-gray-500 bg-white/70">
        <div className="grid grid-cols-[72px_minmax(0,1fr)_130px_120px_88px_120px] border-b border-dashed border-gray-300 px-3 py-2 text-xs font-bold text-gray-500">
          <span>이미지</span>
          <span>제목</span>
          <span>일정</span>
          <span>상태</span>
          <span>링크</span>
          <span className="text-right">관리</span>
        </div>
        {loading ? <p className="p-4 text-sm text-gray-500">불러오는 중...</p> : null}
        {!loading && events.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">등록된 이벤트가 없습니다.</p>
        ) : null}
        {events.map((event) => (
          <article
            key={event.id}
            className="grid grid-cols-[72px_minmax(0,1fr)_130px_120px_88px_120px] items-center gap-3 border-b border-dashed border-gray-200 px-3 py-2 last:border-b-0"
          >
            <div className="flex h-12 w-16 items-center justify-center overflow-hidden border border-dashed border-gray-300 bg-gray-100">
              {event.image_url ? (
                <img src={event.image_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <ImageIcon size={18} className="text-gray-400" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-gray-500">
                {EVENT_TYPE_LABELS[event.event_type.toLowerCase() as CalendarEventType]}
              </p>
              <p className="truncate text-sm font-bold text-gray-900">{event.title}</p>
              <p className="truncate text-xs text-gray-500">
                {isGoodsType(event.event_type) ? "공식 발매 정보" : event.location ?? "위치 미정"}
              </p>
            </div>
            <p className="text-xs text-gray-600">{formatEventPeriod(event.starts_at, event.ends_at ?? undefined)}</p>
            <span className="w-fit border border-dashed border-gray-300 bg-white px-2 py-1 text-xs font-semibold text-gray-600">
              {event.status}
            </span>
            {event.source_url ? (
              <a
                href={event.source_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
              >
                <ExternalLink size={12} />
                URL
              </a>
            ) : (
              <span className="text-xs text-gray-400">없음</span>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => openEditModal(event)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"
              >
                <Edit3 size={12} />
                수정
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteEvent(event)}
                disabled={deletingId === event.id}
                className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 size={12} />
                {deletingId === event.id ? "삭제 중" : "삭제"}
              </button>
            </div>
          </article>
        ))}
      </section>

      {editForm ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/35 px-4 py-8">
          <div className="w-full max-w-3xl border border-dashed border-gray-600 bg-white shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-dashed border-gray-300 p-4">
              <div>
                <h3 className="text-lg font-bold">이벤트 수정</h3>
                <p className="mt-1 text-sm text-gray-500">공개 이벤트 목록과 상세 페이지에 반영됩니다.</p>
              </div>
              <button
                type="button"
                onClick={() => setEditForm(null)}
                className="inline-flex h-8 w-8 items-center justify-center border border-dashed border-gray-400 bg-white hover:bg-gray-100"
              >
                <X size={14} />
              </button>
            </div>

            <div className="grid gap-3 p-4 md:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs font-bold text-gray-500">
                유형
                <select
                  value={editForm.eventType}
                  onChange={(event) =>
                    setEditForm((current) =>
                      current
                        ? { ...current, eventType: event.target.value as CalendarEventType }
                        : current,
                    )
                  }
                  className="h-10 border border-dashed border-gray-400 bg-white px-3 text-sm font-normal text-gray-900 outline-none focus:border-gray-700"
                >
                  {RELEASE_EVENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {EVENT_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-xs font-bold text-gray-500">
                상태
                <select
                  value={editForm.status}
                  onChange={(event) =>
                    setEditForm((current) => (current ? { ...current, status: event.target.value } : current))
                  }
                  className="h-10 border border-dashed border-gray-400 bg-white px-3 text-sm font-normal text-gray-900 outline-none focus:border-gray-700"
                >
                  <option value="PUBLISHED">PUBLISHED</option>
                  <option value="DRAFT">DRAFT</option>
                  <option value="HIDDEN">HIDDEN</option>
                </select>
              </label>

              <label className="flex flex-col gap-1 text-xs font-bold text-gray-500 md:col-span-2">
                제목
                <input
                  value={editForm.title}
                  onChange={(event) =>
                    setEditForm((current) => (current ? { ...current, title: event.target.value } : current))
                  }
                  className="h-10 border border-dashed border-gray-400 bg-white px-3 text-sm font-normal text-gray-900 outline-none focus:border-gray-700"
                />
              </label>

              <label className="flex flex-col gap-1 text-xs font-bold text-gray-500">
                시작일
                <input
                  value={editForm.startsAt}
                  onChange={(event) =>
                    setEditForm((current) => (current ? { ...current, startsAt: event.target.value } : current))
                  }
                  type="date"
                  className="h-10 border border-dashed border-gray-400 bg-white px-3 text-sm font-normal text-gray-900 outline-none focus:border-gray-700"
                />
              </label>

              <label className="flex flex-col gap-1 text-xs font-bold text-gray-500">
                종료일
                <input
                  value={editForm.endsAt}
                  onChange={(event) =>
                    setEditForm((current) => (current ? { ...current, endsAt: event.target.value } : current))
                  }
                  type="date"
                  className="h-10 border border-dashed border-gray-400 bg-white px-3 text-sm font-normal text-gray-900 outline-none focus:border-gray-700"
                />
              </label>

              <label className="flex flex-col gap-1 text-xs font-bold text-gray-500">
                위치 / 판매처
                <input
                  value={editForm.location}
                  onChange={(event) =>
                    setEditForm((current) => (current ? { ...current, location: event.target.value } : current))
                  }
                  className="h-10 border border-dashed border-gray-400 bg-white px-3 text-sm font-normal text-gray-900 outline-none focus:border-gray-700"
                />
              </label>

              <label className="flex flex-col gap-1 text-xs font-bold text-gray-500">
                홈페이지 URL
                <input
                  value={editForm.sourceUrl}
                  onChange={(event) =>
                    setEditForm((current) => (current ? { ...current, sourceUrl: event.target.value } : current))
                  }
                  className="h-10 border border-dashed border-gray-400 bg-white px-3 text-sm font-normal text-gray-900 outline-none focus:border-gray-700"
                />
              </label>

              <div className="flex flex-col gap-1 text-xs font-bold text-gray-500 md:col-span-2">
                <span>대표 이미지 URL</span>
                <EventImageUrlInput
                  id={`event-image-${editForm.id}`}
                  value={editForm.imageUrl}
                  uploading={uploadingImageField === "imageUrl"}
                  onChange={(value) =>
                    setEditForm((current) => (current ? { ...current, imageUrl: value } : current))
                  }
                  onUpload={(files) => void handleEventImageUpload("imageUrl", files)}
                />
              </div>

              <div className="flex flex-col gap-1 text-xs font-bold text-gray-500 md:col-span-2">
                <span>상세 이미지 URL</span>
                <EventImageUrlInput
                  id={`event-detail-image-${editForm.id}`}
                  value={editForm.detailImageUrl}
                  uploading={uploadingImageField === "detailImageUrl"}
                  onChange={(value) =>
                    setEditForm((current) => (current ? { ...current, detailImageUrl: value } : current))
                  }
                  onUpload={(files) => void handleEventImageUpload("detailImageUrl", files)}
                />
              </div>

              <label className="flex flex-col gap-1 text-xs font-bold text-gray-500 md:col-span-2">
                설명
                <CommunityEditor
                  content={editForm.description}
                  onChange={(content) =>
                    setEditForm((current) => (current ? { ...current, description: content } : current))
                  }
                  userId={authUser?.id ?? ""}
                  allowMedia={true}
                  placeholder="상세 설명을 작성해 주세요."
                />
              </label>
            </div>

            <div className="flex justify-end gap-2 border-t border-dashed border-gray-300 p-4">
              <button
                type="button"
                onClick={() => setEditForm(null)}
                className="inline-flex h-9 items-center justify-center border border-dashed border-gray-400 bg-white px-3 text-sm hover:bg-gray-100"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void handleSaveEvent()}
                disabled={savingId === editForm.id}
                className="inline-flex h-9 items-center justify-center gap-1 border border-dashed border-gray-600 bg-gray-900 px-3 text-sm font-semibold text-white hover:bg-gray-700 disabled:cursor-wait disabled:bg-gray-400"
              >
                <Save size={14} />
                {savingId === editForm.id ? "저장 중" : "저장"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {candidateModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/35 px-4 py-8">
          <div className="flex max-h-[calc(100vh-64px)] w-full max-w-6xl flex-col overflow-hidden border border-dashed border-gray-600 bg-white shadow-xl">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-dashed border-gray-300 p-4">
              <div>
                <h3 className="text-lg font-bold">AI 이벤트 후보</h3>
                <p className="mt-1 text-sm text-gray-500">
                  AI가 공식 출처 위주로 찾은 등록 후보입니다. 실제 등록은 관리자가 직접 진행합니다.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleFindCandidates("daily")}
                  disabled={Boolean(collectingMode)}
                  className="inline-flex items-center gap-1 rounded border border-dashed border-blue-500 bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-wait disabled:bg-gray-400"
                >
                  <Sparkles size={14} />
                  {collectingMode === "daily" ? "오늘 후보 검색 중..." : "오늘 새 후보 찾기"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleFindCandidates("full")}
                  disabled={Boolean(collectingMode)}
                  className="inline-flex items-center gap-1 rounded border border-dashed border-gray-600 bg-gray-900 px-3 py-2 text-sm font-semibold text-white hover:bg-gray-700 disabled:cursor-wait disabled:bg-gray-400"
                >
                  <Sparkles size={14} />
                  {collectingMode === "full" ? "전체 검색 중..." : "AI 새로 찾기"}
                </button>
                <button
                  type="button"
                  onClick={() => void fetchCandidates()}
                  className="inline-flex items-center gap-1 rounded border border-dashed border-gray-400 px-3 py-2 text-sm hover:bg-gray-100"
                >
                  <RefreshCw size={14} />
                  새로고침
                </button>
                <button
                  type="button"
                  onClick={() => void handleCreateDrafts()}
                  disabled={draftCreating || checkedCandidateCount === 0}
                  className="inline-flex items-center gap-1 rounded border border-dashed border-gray-600 bg-white px-3 py-2 text-sm font-semibold hover:bg-gray-100 disabled:cursor-not-allowed disabled:border-gray-300 disabled:text-gray-400"
                >
                  <FilePlus2 size={14} />
                  {draftCreating ? "초안 생성 중..." : "체크 항목 초안 만들기"}
                </button>
                <button
                  type="button"
                  onClick={() => setCandidateModalOpen(false)}
                  className="inline-flex items-center gap-1 rounded border border-dashed border-gray-400 px-3 py-2 text-sm hover:bg-gray-100"
                >
                  <X size={14} />
                  닫기
                </button>
              </div>
            </div>

            <div className="border-b border-dashed border-gray-300 bg-gray-50 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void toggleVisibleCandidates(!allVisibleChecked)}
                  disabled={visibleCandidates.length === 0}
                  className="rounded border border-dashed border-gray-400 bg-white px-3 py-1.5 text-sm hover:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-400"
                >
                  {allVisibleChecked ? "전체 체크 해제" : "전체 체크"}
                </button>
                <label className="inline-flex items-center gap-2 rounded border border-dashed border-gray-300 bg-white px-3 py-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={hideChecked}
                    onChange={(event) => setHideChecked(event.target.checked)}
                  />
                  체크된 항목 숨기기
                </label>
                <label className="inline-flex items-center gap-2 rounded border border-dashed border-gray-300 bg-white px-3 py-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={showDuplicatesOnly}
                    onChange={(event) => setShowDuplicatesOnly(event.target.checked)}
                  />
                  중복 의심만 보기
                </label>
                <span className="text-sm text-gray-500">
                  표시 {visibleCandidates.length}개 / 전체 {candidates.length}개 / 체크 {checkedCandidateCount}개
                </span>
              </div>

              {collectResult ? (
                <div className="mt-3 grid gap-2 text-sm md:grid-cols-[180px_1fr]">
                  <div className="font-semibold text-gray-700">
                    {collectResult.mode === "daily" ? "오늘 후보" : "전체 검색"} 신규 {collectResult.insertedCount}개 저장
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-gray-600">
                    <span className="border border-dashed border-gray-300 bg-white px-2 py-1">
                      AI 반환 {collectResult.returnedCount}개
                    </span>
                    <span className="border border-dashed border-gray-300 bg-white px-2 py-1">
                      URL 중복 제외 {collectResult.duplicateUrlCount}개
                    </span>
                    <span className="border border-dashed border-amber-300 bg-amber-50 px-2 py-1 text-amber-700">
                      중복 의심 {collectResult.duplicateSuspectedCount}개
                    </span>
                  </div>
                </div>
              ) : null}

              {candidateError ? <p className="mt-3 text-sm text-red-600">{candidateError}</p> : null}
              {draftResult ? (
                <p className="mt-3 text-sm font-semibold text-gray-700">
                  초안 {draftResult.createdCount}개 생성, {draftResult.skippedCount}개 건너뜀
                  {draftResult.message ? ` (${draftResult.message})` : null}
                </p>
              ) : null}
            </div>

            <div className="min-h-0 overflow-auto">
              <div className="grid min-w-[1120px] grid-cols-[52px_minmax(240px,1fr)_120px_120px_minmax(220px,1fr)_150px_130px] border-b border-dashed border-gray-300 px-3 py-2 text-xs font-bold text-gray-500">
                <span>확인</span>
                <span>제목</span>
                <span>카테고리</span>
                <span>출처</span>
                <span>URL</span>
                <span>검색 시간</span>
                <span>중복</span>
              </div>
              {candidatesLoading || collectingMode ? (
                <p className="p-4 text-sm text-gray-500">불러오는 중...</p>
              ) : null}
              {!candidatesLoading && !collectingMode && visibleCandidates.length === 0 ? (
                <p className="p-4 text-sm text-gray-500">표시할 이벤트 후보가 없습니다.</p>
              ) : null}
              {!candidatesLoading && !collectingMode
                ? visibleCandidates.map((candidate) => (
                    <div
                      key={candidate.id}
                      className="grid min-w-[1120px] grid-cols-[52px_minmax(240px,1fr)_120px_120px_minmax(220px,1fr)_150px_130px] items-center gap-3 border-b border-dashed border-gray-200 px-3 py-2 text-sm last:border-b-0"
                    >
                      <input
                        type="checkbox"
                        checked={candidate.is_checked}
                        onChange={(event) =>
                          void updateCandidateChecked(candidate.id, event.target.checked)
                        }
                        className="h-4 w-4"
                        aria-label={`${candidate.title} 확인`}
                      />
                      <div className="min-w-0">
                        <p className={candidate.is_checked ? "truncate text-gray-400 line-through" : "truncate font-semibold"}>
                          {candidate.title || "제목 없음"}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-gray-500">{candidate.summary}</p>
                      </div>
                      <span className="w-fit border border-dashed border-gray-300 bg-white px-2 py-1 text-xs font-semibold text-gray-600">
                        {candidate.category}
                      </span>
                      <span className="truncate text-xs font-semibold text-gray-600">
                        {candidate.source_name}
                      </span>
                      <a
                        href={candidate.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate text-blue-600 hover:underline"
                        title={candidate.normalized_url}
                      >
                        {candidate.normalized_url}
                      </a>
                      <span className="text-xs text-gray-500">{formatCollectedAt(candidate.searched_at)}</span>
                      <DuplicateCell
                        candidate={candidate}
                        onIgnore={() => void updateCandidateChecked(candidate.id, true)}
                      />
                    </div>
                  ))
                : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function isGoodsType(value: string): boolean {
  return ["GOODS_PREORDER", "GOODS_RELEASE"].includes(value);
}

function EventImageUrlInput({
  id,
  value,
  uploading,
  onChange,
  onUpload,
}: {
  id: string;
  value: string;
  uploading: boolean;
  onChange: (value: string) => void;
  onUpload: (files: FileList | null) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 min-w-0 flex-1 border border-dashed border-gray-400 bg-white px-3 text-sm font-normal text-gray-900 outline-none focus:border-gray-700"
      />
      <input
        ref={fileInputRef}
        id={id}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          onUpload(event.target.files);
          event.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="inline-flex h-10 shrink-0 items-center justify-center gap-1 border border-dashed border-gray-500 bg-white px-3 text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:cursor-wait disabled:text-gray-400"
      >
        {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
        {uploading ? "업로드 중" : "업로드"}
      </button>
    </div>
  );
}

function DuplicateCell({
  candidate,
  onIgnore,
}: {
  candidate: EventCandidateRow;
  onIgnore: () => void;
}) {
  if (candidate.duplicate_status !== "suspected") {
    return <span className="text-xs text-gray-400">없음</span>;
  }

  const existingEvent = Array.isArray(candidate.release_events)
    ? candidate.release_events[0]
    : candidate.release_events;

  return (
    <div className="min-w-0 text-xs">
      <span className="inline-flex border border-dashed border-amber-300 bg-amber-50 px-2 py-1 font-bold text-amber-700">
        중복 의심
      </span>
      {existingEvent ? (
        <p className="mt-1 truncate text-gray-600" title={candidate.duplicate_reason ?? undefined}>
          기존: {existingEvent.title}
        </p>
      ) : (
        <p className="mt-1 truncate text-gray-600" title={candidate.duplicate_reason ?? undefined}>
          유사도 높음
        </p>
      )}
      <div className="mt-1 flex flex-wrap gap-1">
        <span className="border border-dashed border-gray-300 px-1.5 py-0.5 text-gray-500">
          그대로 검토
        </span>
        <button
          type="button"
          onClick={onIgnore}
          className="border border-dashed border-gray-300 px-1.5 py-0.5 text-gray-600 hover:bg-gray-100"
        >
          무시
        </button>
        {existingEvent ? (
          <Link
            href={`/events/${existingEvent.id}`}
            className="border border-dashed border-gray-300 px-1.5 py-0.5 text-blue-600 hover:bg-blue-50"
          >
            기존 참고
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function formatCollectedAt(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function toLocalDateValue(value: string): string {
  const date = new Date(value);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date);
}

function dateToKstIso(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  const utcMs = Date.UTC(year, month - 1, day, 0, 0, 0) - 9 * 60 * 60 * 1000;
  return new Date(utcMs).toISOString();
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function toEditorBody(value: string | null | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) return JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] });

  try {
    JSON.parse(trimmed);
    return trimmed;
  } catch {
    return JSON.stringify({
      type: "doc",
      content: trimmed
        .split(/\n{2,}|\n/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean)
        .map((paragraph) => ({
          type: "paragraph",
          content: [{ type: "text", text: paragraph }],
        })),
    });
  }
}
