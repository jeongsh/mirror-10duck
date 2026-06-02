"use client";

import { useEffect, useMemo, useState } from "react";
import OfficialCharacterForm from "@/components/admin/catalog/OfficialCharacterForm";
import OfficialWorkForm from "@/components/admin/catalog/OfficialWorkForm";
import {
  applyCharacterChanges,
  applyWorkChanges,
  characterAddRequestToForm,
  characterToForm,
  EMPTY_CHARACTER_FORM,
  EMPTY_WORK_FORM,
  workAddRequestToForm,
  workToForm,
  type CharacterFormState,
  type CharacterPayload,
  type WorkFormState,
  type WorkPayload,
} from "@/lib/admin/catalogForms";
import {
  catalogRequestStatusLabel,
  reasonLabel,
  type CatalogEditChanges,
} from "@/lib/catalogRequest";
import { getWorkCategoryLabel } from "@/lib/official/catalog";
import { supabase } from "@/lib/supabase/client";
import type {
  CatalogEditRequestRow,
  CharacterAddRequestRow,
  WorkAddRequestRow,
} from "@/types/catalogRequest";
import type {
  OfficialOshiCharacter,
  OfficialWork,
  OfficialWorkCategory,
} from "@/types/official";

export type CatalogRequestSelection =
  | { type: "character-add"; row: CharacterAddRequestRow }
  | { type: "work-add"; row: WorkAddRequestRow }
  | { type: "edit"; row: CatalogEditRequestRow };

type Props = {
  selection: CatalogRequestSelection | null;
  reviewerId?: string | null;
  onClose: () => void;
  onChanged: () => void;
};

type CharacterWithWork = OfficialOshiCharacter & { official_works?: OfficialWork };

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

function stringifyValue(value: unknown) {
  if (value === null || value === undefined) return "-";
  if (Array.isArray(value)) return value.join(", ") || "-";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function ChangeList({ changes }: { changes: CatalogEditChanges }) {
  const entries = Object.entries(changes);
  if (entries.length === 0) {
    return <p className="text-xs text-gray-400">제안된 변경값이 없습니다.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {entries.map(([key, value]) => (
        <li key={key} className="border border-dashed border-gray-300 bg-white p-2 text-xs">
          <p className="font-bold text-gray-800">{CHANGE_LABELS[key] ?? key}</p>
          <p className="mt-1 break-all text-gray-600">{stringifyValue(value)}</p>
        </li>
      ))}
    </ul>
  );
}

function InfoItem({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="border border-dashed border-gray-300 bg-white p-2 text-xs">
      <p className="font-bold text-gray-800">{label}</p>
      <p className="mt-1 break-all text-gray-600">{stringifyValue(value)}</p>
    </div>
  );
}

export default function CatalogRequestReviewModal({
  selection,
  reviewerId,
  onClose,
  onChanged,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [work, setWork] = useState<OfficialWork | null>(null);
  const [character, setCharacter] = useState<CharacterWithWork | null>(null);
  const [createdWork, setCreatedWork] = useState<OfficialWork | null>(null);
  const [workForm, setWorkForm] = useState<WorkFormState>(EMPTY_WORK_FORM);
  const [characterForm, setCharacterForm] = useState<CharacterFormState>(EMPTY_CHARACTER_FORM);

  useEffect(() => {
    if (!selection) return;

    let cancelled = false;
    setLoading(true);
    setWork(null);
    setCharacter(null);
    setCreatedWork(null);

    const load = async () => {
      if (selection.type === "work-add") {
        const next = workAddRequestToForm(selection.row);
        if (!cancelled) {
          setWorkForm(next);
          setCharacterForm(EMPTY_CHARACTER_FORM);
        }
      }

      if (selection.type === "character-add") {
        const nextCharacter = characterAddRequestToForm(selection.row);
        if (selection.row.official_work_id) {
          const { data } = await supabase
            .from("official_works")
            .select("*")
            .eq("id", selection.row.official_work_id)
            .maybeSingle();
          if (!cancelled) setWork((data as OfficialWork | null) ?? null);
        } else if (selection.row.request_new_work) {
          const nextWork: WorkFormState = {
            ...EMPTY_WORK_FORM,
            slug: selection.row.work_title,
            title: selection.row.work_title,
            category: (selection.row.work_category as OfficialWorkCategory | null) ?? "anime",
          };
          if (!cancelled) setWorkForm(nextWork);
        }

        if (!cancelled) setCharacterForm(nextCharacter);
      }

      if (selection.type === "edit") {
        if (selection.row.target_type === "work" && selection.row.work_id) {
          const { data } = await supabase
            .from("official_works")
            .select("*")
            .eq("id", selection.row.work_id)
            .maybeSingle();
          const currentWork = (data as OfficialWork | null) ?? null;
          if (!cancelled) {
            setWork(currentWork);
            setWorkForm(currentWork ? workToForm(currentWork) : EMPTY_WORK_FORM);
          }
        }

        if (selection.row.target_type === "character" && selection.row.character_id) {
          const { data } = await supabase
            .from("official_oshi_characters")
            .select("*, official_works(*)")
            .eq("id", selection.row.character_id)
            .maybeSingle();
          const currentCharacter = (data as CharacterWithWork | null) ?? null;
          if (!cancelled) {
            setCharacter(currentCharacter);
            setWork(currentCharacter?.official_works ?? null);
            setCharacterForm(currentCharacter ? characterToForm(currentCharacter) : EMPTY_CHARACTER_FORM);
          }
        }
      }

      if (!cancelled) setLoading(false);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [selection]);

  const title = useMemo(() => {
    if (!selection) return "";
    if (selection.type === "work-add") return "작품 추가 요청 검수";
    if (selection.type === "character-add") return "캐릭터 추가 요청 검수";
    return selection.row.target_type === "work" ? "작품 수정 제안 검수" : "캐릭터 수정 제안 검수";
  }, [selection]);

  if (!selection) return null;

  const markApproved = async () => {
    const table =
      selection.type === "work-add"
        ? "work_add_requests"
        : selection.type === "character-add"
          ? "character_add_requests"
          : "catalog_edit_requests";

    const { error } = await supabase
      .from(table)
      .update({
        status: "APPROVED",
        decided_by: reviewerId ?? null,
        decided_at: new Date().toISOString(),
      })
      .eq("id", selection.row.id);

    if (error) {
      alert(`요청 승인 처리 실패: ${error.message}`);
      throw error;
    }
  };

  const finish = async () => {
    await markApproved();
    onChanged();
    onClose();
  };

  const saveWork = async (payload: WorkPayload) => {
    if (selection.type === "work-add") {
      const { data, error } = await supabase
        .from("official_works")
        .insert(payload)
        .select("*")
        .single();
      if (error) {
        alert(`작품 추가 실패: ${error.message}`);
        throw error;
      }
      await finish();
      return data as OfficialWork;
    }

    if (selection.type === "character-add" && selection.row.request_new_work && !createdWork) {
      const { data, error } = await supabase
        .from("official_works")
        .insert(payload)
        .select("*")
        .single();
      if (error) {
        alert(`작품 추가 실패: ${error.message}`);
        throw error;
      }
      setCreatedWork(data as OfficialWork);
      setWork(data as OfficialWork);
      return data as OfficialWork;
    }

    if (selection.type === "edit" && selection.row.target_type === "work" && selection.row.work_id) {
      const { data, error } = await supabase
        .from("official_works")
        .update(payload)
        .eq("id", selection.row.work_id)
        .select("*")
        .single();
      if (error) {
        alert(`작품 저장 실패: ${error.message}`);
        throw error;
      }
      await finish();
      return data as OfficialWork;
    }
  };

  const saveCharacter = async (payload: CharacterPayload, characterId: string | null) => {
    const query =
      selection.type === "edit" && characterId
        ? supabase
            .from("official_oshi_characters")
            .update(payload)
            .eq("id", characterId)
            .select("*")
            .single()
        : supabase.from("official_oshi_characters").insert(payload).select("*").single();

    const { data, error } = await query;
    if (error) {
      alert(`캐릭터 저장 실패: ${error.message}`);
      throw error;
    }

    await finish();
    return data as OfficialOshiCharacter;
  };

  const requestWorkId =
    selection.type === "character-add"
      ? selection.row.official_work_id ?? createdWork?.id ?? work?.id ?? null
      : selection.type === "edit" && selection.row.target_type === "character"
        ? character?.work_id ?? work?.id ?? null
        : null;

  const canShowCharacterForm =
    selection.type === "edit" && selection.row.target_type === "character"
      ? Boolean(requestWorkId)
      : selection.type === "character-add"
        ? Boolean(requestWorkId)
        : false;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 p-4">
      <div className="mx-auto flex h-full max-w-7xl flex-col overflow-hidden border border-dashed border-gray-700 bg-gray-100 shadow-xl">
        <header className="flex items-center justify-between gap-3 border-b border-dashed border-gray-400 bg-white px-4 py-3">
          <div>
            <h2 className="text-lg font-black text-gray-900">{title}</h2>
            <p className="text-xs text-gray-500">
              저장 성공 후 요청 상태가 {catalogRequestStatusLabel("APPROVED")}으로 변경됩니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="border border-dashed border-gray-500 bg-white px-3 py-1.5 text-xs font-bold hover:bg-gray-50"
          >
            닫기
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {loading ? (
            <p className="p-6 text-sm text-gray-500">요청 정보를 불러오는 중...</p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_420px]">
              <section className="min-w-0">
                {selection.type === "work-add" && (
                  <OfficialWorkForm
                    key={`work-add-${selection.row.id}-${workForm.title}`}
                    mode="create"
                    compact
                    initialValue={workForm}
                    submitLabel="작품 저장 후 승인"
                    onSave={saveWork}
                  />
                )}

                {selection.type === "edit" && selection.row.target_type === "work" && work && (
                  <OfficialWorkForm
                    key={`work-edit-${selection.row.id}-${workForm.title}`}
                    mode="edit"
                    compact
                    initialValue={workForm}
                    submitLabel="작품 저장 후 승인"
                    onSave={saveWork}
                  />
                )}

                {selection.type === "character-add" && selection.row.request_new_work && !createdWork && !selection.row.official_work_id && (
                  <OfficialWorkForm
                    key={`character-work-${selection.row.id}-${workForm.title}`}
                    mode="create"
                    compact
                    initialValue={workForm}
                    submitLabel="작품 먼저 저장"
                    onSave={saveWork}
                  />
                )}

                {canShowCharacterForm && requestWorkId && (
                  <OfficialCharacterForm
                    key={`character-${selection.row.id}-${characterForm.name}-${requestWorkId}`}
                    workId={requestWorkId}
                    compact
                    initialValue={characterForm}
                    submitLabel="캐릭터 저장 후 승인"
                    onSave={saveCharacter}
                  />
                )}

                {selection.type === "edit" && selection.row.target_type === "work" && !work && (
                  <p className="border border-dashed border-red-300 bg-red-50 p-4 text-sm text-red-700">
                    수정 대상 작품을 찾을 수 없습니다.
                  </p>
                )}
                {selection.type === "edit" && selection.row.target_type === "character" && !character && (
                  <p className="border border-dashed border-red-300 bg-red-50 p-4 text-sm text-red-700">
                    수정 대상 캐릭터를 찾을 수 없습니다.
                  </p>
                )}
              </section>

              <RequestPanel
                selection={selection}
                work={work}
                character={character}
                createdWork={createdWork}
                onApplyWorkChanges={() => {
                  if (selection.type === "edit") {
                    setWorkForm(applyWorkChanges(workForm, selection.row.changes));
                  }
                }}
                onApplyCharacterChanges={() => {
                  if (selection.type === "edit") {
                    setCharacterForm(applyCharacterChanges(characterForm, selection.row.changes));
                  }
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RequestPanel({
  selection,
  work,
  character,
  createdWork,
  onApplyWorkChanges,
  onApplyCharacterChanges,
}: {
  selection: CatalogRequestSelection;
  work: OfficialWork | null;
  character: CharacterWithWork | null;
  createdWork: OfficialWork | null;
  onApplyWorkChanges: () => void;
  onApplyCharacterChanges: () => void;
}) {
  return (
    <aside className="flex flex-col gap-3 border border-dashed border-gray-500 bg-white/80 p-4">
      <h3 className="text-sm font-black text-gray-900">유저 요청값</h3>

      {selection.type === "work-add" && (
        <>
          <InfoItem label="작품명" value={selection.row.work_title} />
          <InfoItem label="원제" value={selection.row.original_title} />
          <InfoItem label="분류" value={getWorkCategoryLabel(selection.row.category)} />
          <InfoItem label="사유" value={reasonLabel(selection.row.reason)} />
          <InfoItem label="출처" value={selection.row.source} />
          <InfoItem label="참고 URL" value={selection.row.source_url} />
        </>
      )}

      {selection.type === "character-add" && (
        <>
          <InfoItem label="캐릭터명" value={selection.row.character_name} />
          <InfoItem label="원문명" value={selection.row.character_original_name} />
          <InfoItem label="작품명" value={selection.row.work_title} />
          <InfoItem
            label="작품 상태"
            value={
              selection.row.official_work_id
                ? work?.title ?? "기존 작품 연결"
                : createdWork
                  ? `새 작품 생성됨: ${createdWork.title}`
                  : selection.row.request_new_work
                    ? "신규 작품 요청"
                    : "작품 미연결"
            }
          />
          <InfoItem label="작품 분류" value={selection.row.work_category} />
          <InfoItem label="메모" value={selection.row.character_note} />
          <InfoItem label="사유" value={reasonLabel(selection.row.reason)} />
          <InfoItem label="참고 URL" value={selection.row.source_url} />
        </>
      )}

      {selection.type === "edit" && (
        <>
          <div className="border border-dashed border-gray-300 bg-gray-50 p-3 text-xs">
            <p className="font-bold text-gray-900">현재 대상</p>
            <p className="mt-1 text-gray-600">
              {selection.row.target_type === "work"
                ? work?.title ?? "작품 없음"
                : character
                  ? `${character.name}${character.official_works?.title ? ` (${character.official_works.title})` : ""}`
                  : "캐릭터 없음"}
            </p>
          </div>
          <ChangeList changes={selection.row.changes} />
          <button
            type="button"
            onClick={selection.row.target_type === "work" ? onApplyWorkChanges : onApplyCharacterChanges}
            className="border border-dashed border-gray-700 bg-gray-900 px-3 py-2 text-xs font-bold text-white hover:bg-gray-800"
          >
            제안값을 좌측 폼에 적용
          </button>
          <InfoItem label="요청 사유" value={selection.row.reason} />
          <InfoItem label="출처" value={selection.row.source} />
        </>
      )}
    </aside>
  );
}
