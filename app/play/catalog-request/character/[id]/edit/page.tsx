"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Upload, X } from "lucide-react";
import {
  CatalogRequestError,
  CatalogRequestField,
  CatalogRequestInput,
  CatalogRequestShell,
  CatalogRequestSubmitButton,
  CatalogRequestSuccess,
  CatalogRequestTextarea,
  CollapsibleSection,
  TagCheckboxGrid,
  WorkSearchPicker,
} from "@/components/catalog-request/CatalogRequestUi";
import {
  arraysEqual,
  catalogRequestPath,
  mergeTagOptions,
  type CatalogRequestSource,
} from "@/lib/catalogRequest";
import {
  getFullCharacterForEdit,
  searchOshiAnalysisWorks,
  submitCatalogEditRequest,
  type OshiAnalysisWork,
} from "@/lib/supabase/catalogRequest";
import { useAuthUser } from "@/lib/supabase/useAuthUser";
import {
  OFFICIAL_CHARACTER_MEME_TAGS,
  OFFICIAL_CHARACTER_POSITIONS,
  OFFICIAL_CHARACTER_TAGS,
} from "@/lib/official/catalog";
import { uploadCatalogRequestCharacterImage } from "@/lib/official/storage";
import type { OfficialCharacterPosition, OfficialOshiCharacter, OfficialWork } from "@/types/official";

function CharacterSilhouette({ className = "h-full w-full" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center bg-gray-100 ${className}`}>
      <svg viewBox="0 0 60 80" className="h-3/4 w-3/4 fill-gray-300">
        <circle cx="30" cy="22" r="14" />
        <path d="M6 75 Q6 50 30 50 Q54 50 54 75Z" />
      </svg>
    </div>
  );
}

function toggleInList(list: string[], tag: string) {
  return list.includes(tag) ? list.filter((item) => item !== tag) : [...list, tag];
}

function CharacterEditRequestForm() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const user = useAuthUser();
  const characterId = params.id;
  const imageInputRef = useRef<HTMLInputElement>(null);

  const from = searchParams.get("from") ?? undefined;
  const returnTo =
    searchParams.get("returnTo") ?? (from === "oshi-analysis" ? "/play/oshi-analysis" : null);

  const [loading, setLoading] = useState(true);
  const [character, setCharacter] = useState<
    (OfficialOshiCharacter & { official_works: OfficialWork }) | null
  >(null);

  const [name, setName] = useState("");
  const [originalName, setOriginalName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedMemeTags, setSelectedMemeTags] = useState<string[]>([]);
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);
  const [profileImageNote, setProfileImageNote] = useState("");
  const [proposedImageFile, setProposedImageFile] = useState<File | null>(null);
  const [proposedImagePreview, setProposedImagePreview] = useState<string | null>(null);
  const [duplicateNote, setDuplicateNote] = useState("");
  const [changeWork, setChangeWork] = useState(false);
  const [workQuery, setWorkQuery] = useState("");
  const [workResults, setWorkResults] = useState<OshiAnalysisWork[]>([]);
  const [selectedWork, setSelectedWork] = useState<{ id: string; title: string } | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const row = await getFullCharacterForEdit(characterId);
      if (cancelled) return;
      setCharacter(row);
      if (row) {
        setName(row.name);
        setOriginalName(row.original_name ?? "");
        setDescription(row.description ?? "");
        setSelectedTags(row.tags ?? []);
        setSelectedMemeTags(row.meme_tags ?? []);
        setSelectedPositions((row.positions ?? []) as string[]);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [characterId]);

  useEffect(() => {
    return () => {
      if (proposedImagePreview) URL.revokeObjectURL(proposedImagePreview);
    };
  }, [proposedImagePreview]);

  useEffect(() => {
    if (!changeWork || selectedWork || !workQuery.trim()) {
      setWorkResults([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      const results = await searchOshiAnalysisWorks(workQuery, 8);
      if (!cancelled) setWorkResults(results);
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [workQuery, selectedWork, changeWork]);

  const tagOptions = useMemo(
    () => mergeTagOptions(OFFICIAL_CHARACTER_TAGS, character?.tags),
    [character?.tags]
  );
  const memeTagOptions = useMemo(
    () => mergeTagOptions(OFFICIAL_CHARACTER_MEME_TAGS, character?.meme_tags),
    [character?.meme_tags]
  );
  const positionOptions = useMemo(
    () =>
      mergeTagOptions(
        OFFICIAL_CHARACTER_POSITIONS as unknown as string[],
        (character?.positions ?? []) as string[]
      ),
    [character?.positions]
  );

  const tagsChanged = useMemo(
    () => character !== null && !arraysEqual(selectedTags, character.tags ?? []),
    [character, selectedTags]
  );
  const memeTagsChanged = useMemo(
    () => character !== null && !arraysEqual(selectedMemeTags, character.meme_tags ?? []),
    [character, selectedMemeTags]
  );
  const positionsChanged = useMemo(
    () =>
      character !== null &&
      !arraysEqual(selectedPositions, (character.positions ?? []) as string[]),
    [character, selectedPositions]
  );
  const imageChanged = proposedImageFile !== null || profileImageNote.trim().length > 0;

  const hasChanges = useMemo(() => {
    if (!character) return false;
    return (
      name.trim() !== character.name ||
      originalName.trim() !== (character.original_name ?? "") ||
      description.trim() !== (character.description ?? "") ||
      tagsChanged ||
      memeTagsChanged ||
      positionsChanged ||
      imageChanged ||
      duplicateNote.trim().length > 0 ||
      (changeWork && selectedWork !== null && selectedWork.id !== character.work_id)
    );
  }, [
    character,
    name,
    originalName,
    description,
    tagsChanged,
    memeTagsChanged,
    positionsChanged,
    imageChanged,
    duplicateNote,
    changeWork,
    selectedWork,
  ]);

  const handleImageSelect = (file: File | null) => {
    if (proposedImagePreview) URL.revokeObjectURL(proposedImagePreview);
    setProposedImageFile(file);
    setProposedImagePreview(file ? URL.createObjectURL(file) : null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!character || !hasChanges) return;

    setBusy(true);
    setError(null);

    try {
      const changes: Record<string, unknown> = {};
      if (name.trim() !== character.name) changes.name = name.trim();
      if (originalName.trim() !== (character.original_name ?? ""))
        changes.original_name = originalName.trim();
      if (description.trim() !== (character.description ?? ""))
        changes.description = description.trim();
      if (tagsChanged) changes.tags = selectedTags;
      if (memeTagsChanged) changes.meme_tags = selectedMemeTags;
      if (positionsChanged) changes.positions = selectedPositions as OfficialCharacterPosition[];
      if (profileImageNote.trim()) changes.profile_image_note = profileImageNote.trim();
      if (duplicateNote.trim()) changes.duplicate_note = duplicateNote.trim();
      if (changeWork && selectedWork && selectedWork.id !== character.work_id) {
        changes.work_id = selectedWork.id;
        changes.work_title = selectedWork.title;
      }

      if (proposedImageFile) {
        const publicUrl = await uploadCatalogRequestCharacterImage(character.id, proposedImageFile);
        changes.profile_image_url = publicUrl;
      }

      const result = await submitCatalogEditRequest({
        targetType: "character",
        characterId: character.id,
        changes,
        reason: reason.trim() || undefined,
        source: (from as CatalogRequestSource | undefined) ?? "play-hub",
        requesterId: user?.id ?? null,
      });

      if (!result.ok) {
        setError(result.message);
        return;
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "요청 전송에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <main className="flex items-center justify-center py-24">
        <div className="h-6 w-6 animate-spin border-2 border-gray-400 border-t-transparent" />
      </main>
    );
  }

  if (!character) {
    return (
      <CatalogRequestShell
        title="캐릭터를 찾을 수 없습니다"
        description="등록되지 않았거나 비공개 상태인 캐릭터입니다."
        returnTo={returnTo}
      >
        <section className="border border-dashed border-gray-300 bg-gray-50 p-4">
          <Link
            href={catalogRequestPath("character-add", { from, returnTo: returnTo ?? undefined })}
            className="text-xs font-bold text-gray-700 underline"
          >
            캐릭터 추가 요청하기
          </Link>
        </section>
      </CatalogRequestShell>
    );
  }

  if (done) {
    return (
      <CatalogRequestSuccess
        title="캐릭터 수정 요청을 보냈습니다"
        message="검수 후 반영되면 분석·태그 표시 등에 적용됩니다. 같은 제안이 여러 번 모이면 우선 검수됩니다."
        returnTo={returnTo}
        returnLabel={from === "oshi-analysis" ? "최애 분석으로 돌아가기" : "돌아가기"}
      />
    );
  }

  const currentTags = [...(character.tags ?? []), ...(character.meme_tags ?? [])];

  return (
    <CatalogRequestShell
      title={`${character.name} 수정 요청`}
      description="체크로 태그를 고르고, 이미지는 교체안을 올릴 수 있습니다. 기본값은 DB 정보이며 검수 후 반영됩니다."
      returnTo={returnTo}
      returnLabel={from === "oshi-analysis" ? "최애 분석으로 돌아가기" : undefined}
    >
      <section className="border border-dashed border-gray-400 bg-gray-50 p-4">
        <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">현재 정보</p>
        <div className="mt-3 flex gap-4">
          <div className="aspect-[3/4] w-24 shrink-0 overflow-hidden border border-dashed border-gray-300 bg-white">
            {character.profile_image_url ? (
              <img
                src={character.profile_image_url}
                alt={character.name}
                className="h-full w-full object-cover object-top"
              />
            ) : (
              <CharacterSilhouette />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-gray-900">{character.name}</p>
            {character.original_name && (
              <p className="text-xs text-gray-500">{character.original_name}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">{character.official_works.title}</p>
            {currentTags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {currentTags.map((tag) => (
                  <span
                    key={tag}
                    className="border border-dashed border-gray-300 px-1.5 py-0.5 text-[10px] font-bold text-gray-600"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <section className="flex flex-col gap-4 border border-dashed border-gray-500 bg-white p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <CatalogRequestField label="캐릭터명">
              <CatalogRequestInput value={name} onChange={(e) => setName(e.target.value)} />
            </CatalogRequestField>
            <CatalogRequestField label="원명">
              <CatalogRequestInput
                value={originalName}
                onChange={(e) => setOriginalName(e.target.value)}
                placeholder="일본어/영문명"
              />
            </CatalogRequestField>
          </div>

          <CatalogRequestField label="설명">
            <CatalogRequestTextarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </CatalogRequestField>
        </section>

        <CollapsibleSection
          title="캐릭터 태그"
          summary={`${selectedTags.length}개 선택`}
          defaultOpen
          changed={tagsChanged}
        >
          <p className="mb-3 text-[11px] leading-5 text-gray-500">
            체크된 태그가 최종 제안입니다. DB 기본값에서 체크를 풀거나 추가하세요.
          </p>
          <TagCheckboxGrid
            tags={tagOptions}
            selected={selectedTags}
            onToggle={(tag) => setSelectedTags((prev) => toggleInList(prev, tag))}
          />
        </CollapsibleSection>

        <CollapsibleSection
          title="밈 태그"
          summary={`${selectedMemeTags.length}개 선택`}
          changed={memeTagsChanged}
        >
          <p className="mb-3 text-[11px] leading-5 text-gray-500">
            팬덤 밈 태그도 동일하게 체크로 선택합니다.
          </p>
          <TagCheckboxGrid
            tags={memeTagOptions}
            selected={selectedMemeTags}
            onToggle={(tag) => setSelectedMemeTags((prev) => toggleInList(prev, tag))}
          />
        </CollapsibleSection>

        <CollapsibleSection
          title="포지션"
          summary={`${selectedPositions.length}개 선택`}
          changed={positionsChanged}
        >
          <TagCheckboxGrid
            tags={positionOptions}
            selected={selectedPositions}
            onToggle={(tag) => setSelectedPositions((prev) => toggleInList(prev, tag))}
          />
        </CollapsibleSection>

        <CollapsibleSection title="작품 연결" changed={changeWork && selectedWork !== null}>
          <label className="mb-3 flex cursor-pointer items-center gap-2 text-xs font-bold text-gray-700">
            <input
              type="checkbox"
              checked={changeWork}
              onChange={(e) => setChangeWork(e.target.checked)}
              className="h-4 w-4"
            />
            작품 연결이 틀렸어요
          </label>
          {changeWork && (
            <WorkSearchPicker
              query={workQuery}
              onQueryChange={setWorkQuery}
              results={workResults}
              selected={selectedWork}
              onSelect={(work) => {
                setSelectedWork(work);
                setWorkQuery("");
                setWorkResults([]);
              }}
              onClear={() => {
                setSelectedWork(null);
                setWorkQuery("");
              }}
              placeholder="올바른 작품 검색"
            />
          )}
        </CollapsibleSection>

        <CollapsibleSection
          title="프로필 이미지 교체"
          summary={proposedImageFile ? "교체 이미지 등록됨" : "현재 이미지 유지"}
          changed={imageChanged}
        >
          <p className="mb-3 text-[11px] leading-5 text-gray-500">
            잘못된 이미지라면 교체안을 올려주세요. 검수 후 반영됩니다.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-gray-400">
                현재
              </p>
              <div className="aspect-[3/4] max-w-[140px] overflow-hidden border border-dashed border-gray-300 bg-gray-50">
                {character.profile_image_url ? (
                  <img
                    src={character.profile_image_url}
                    alt={character.name}
                    className="h-full w-full object-cover object-top"
                  />
                ) : (
                  <CharacterSilhouette />
                )}
              </div>
            </div>

            <div>
              <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-gray-400">
                교체 제안
              </p>
              <div className="aspect-[3/4] max-w-[140px] overflow-hidden border border-dashed border-gray-400 bg-white">
                {proposedImagePreview ? (
                  <img
                    src={proposedImagePreview}
                    alt="교체 제안 미리보기"
                    className="h-full w-full object-cover object-top"
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-2 p-3 text-center">
                    <Upload size={18} className="text-gray-400" />
                    <p className="text-[10px] font-bold text-gray-400">이미지를 선택하세요</p>
                  </div>
                )}
              </div>

              <input
                ref={imageInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => handleImageSelect(e.target.files?.[0] ?? null)}
              />

              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  className="inline-flex items-center gap-1 border border-dashed border-gray-500 px-2 py-1 text-[11px] font-bold text-gray-700 hover:bg-gray-50"
                >
                  <Upload size={12} />
                  이미지 이걸로 바꿔주세요
                </button>
                {proposedImageFile && (
                  <button
                    type="button"
                    onClick={() => {
                      handleImageSelect(null);
                      if (imageInputRef.current) imageInputRef.current.value = "";
                    }}
                    className="inline-flex items-center gap-1 border border-dashed border-gray-300 px-2 py-1 text-[11px] font-bold text-gray-500 hover:bg-gray-50"
                  >
                    <X size={12} />
                    선택 취소
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4">
            <CatalogRequestField
              label="이미지 관련 메모"
              hint="왜 바꿔야 하는지, 출처 등 (선택)"
            >
              <CatalogRequestInput
                value={profileImageNote}
                onChange={(e) => setProfileImageNote(e.target.value)}
                placeholder="예: 다른 캐릭터 이미지가 들어가 있음 / 공식 일러스트"
              />
            </CatalogRequestField>
          </div>
        </CollapsibleSection>

        <section className="flex flex-col gap-4 border border-dashed border-gray-500 bg-white p-5">
          <CatalogRequestField label="중복 캐릭터 메모">
            <CatalogRequestInput
              value={duplicateNote}
              onChange={(e) => setDuplicateNote(e.target.value)}
              placeholder="예: ○○ 캐릭터와 같은 인물"
            />
          </CatalogRequestField>

          <CatalogRequestField label="추가 설명">
            <CatalogRequestTextarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="왜 수정이 필요한지 간단히 적어주세요."
            />
          </CatalogRequestField>

          {!user && (
            <p className="text-xs leading-5 text-gray-500">
              로그인 없이도 제안할 수 있습니다. 로그인하면 승인 시 기여도 추적이 가능합니다.
            </p>
          )}

          {error && <CatalogRequestError message={error} />}

          <CatalogRequestSubmitButton busy={busy} disabled={!hasChanges}>
            수정 제안 보내기
          </CatalogRequestSubmitButton>
        </section>
      </form>
    </CatalogRequestShell>
  );
}

export default function CharacterEditRequestPage() {
  return (
    <Suspense
      fallback={
        <main className="flex items-center justify-center py-24">
          <div className="h-6 w-6 animate-spin border-2 border-gray-400 border-t-transparent" />
        </main>
      }
    >
      <CharacterEditRequestForm />
    </Suspense>
  );
}
