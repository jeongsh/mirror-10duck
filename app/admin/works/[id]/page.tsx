"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import {
  OFFICIAL_CATALOG_STATUS_OPTIONS,
  OFFICIAL_WORK_CATEGORY_OPTIONS,
  normalizeOfficialSlug,
} from "@/lib/official/catalog";
import { uploadOfficialCatalogImage } from "@/lib/official/storage";
import type {
  OfficialCatalogStatus,
  OfficialOshiCharacter,
  OfficialWork,
  OfficialWorkCategory,
} from "@/types/official";

type CharacterForm = {
  id: string | null;
  slug: string;
  name: string;
  original_name: string;
  role_label: string;
  description: string;
  profile_image_url: string;
  status: OfficialCatalogStatus;
  sort_order: number;
};

const EMPTY_CHARACTER_FORM: CharacterForm = {
  id: null,
  slug: "",
  name: "",
  original_name: "",
  role_label: "",
  description: "",
  profile_image_url: "",
  status: "DRAFT",
  sort_order: 0,
};

export default function OfficialWorkDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [savingWork, setSavingWork] = useState(false);
  const [savingCharacter, setSavingCharacter] = useState(false);
  const [deletingCharacterId, setDeletingCharacterId] = useState<string | null>(null);
  const [work, setWork] = useState<OfficialWork | null>(null);
  const [characters, setCharacters] = useState<OfficialOshiCharacter[]>([]);

  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [originalTitle, setOriginalTitle] = useState("");
  const [category, setCategory] = useState<OfficialWorkCategory>("anime");
  const [synopsis, setSynopsis] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [status, setStatus] = useState<OfficialCatalogStatus>("DRAFT");
  const [sortOrder, setSortOrder] = useState(0);
  const [characterForm, setCharacterForm] =
    useState<CharacterForm>(EMPTY_CHARACTER_FORM);
  const [uploadingWorkImage, setUploadingWorkImage] = useState(false);
  const [uploadingCharacterImage, setUploadingCharacterImage] = useState(false);

  const normalizedWorkSlug = normalizeOfficialSlug(slug);
  const normalizedCharacterSlug = useMemo(
    () => normalizeOfficialSlug(characterForm.slug),
    [characterForm.slug],
  );

  const hydrateWork = (nextWork: OfficialWork) => {
    setWork(nextWork);
    setSlug(nextWork.slug);
    setTitle(nextWork.title);
    setOriginalTitle(nextWork.original_title ?? "");
    setCategory(nextWork.category);
    setSynopsis(nextWork.synopsis ?? "");
    setCoverImageUrl(nextWork.cover_image_url ?? "");
    setStatus(nextWork.status);
    setSortOrder(nextWork.sort_order);
  };

  const fetchData = async () => {
    setLoading(true);
    const [{ data: workData, error: workError }, { data: characterData }] =
      await Promise.all([
        supabase.from("official_works").select("*").eq("id", id).single(),
        supabase
          .from("official_oshi_characters")
          .select("*")
          .eq("work_id", id)
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true }),
      ]);

    if (workError || !workData) {
      alert("작품 정보를 불러오지 못했습니다.");
      router.push("/admin/works");
      return;
    }

    hydrateWork(workData as OfficialWork);
    setCharacters((characterData ?? []) as OfficialOshiCharacter[]);
    setLoading(false);
  };

  useEffect(() => {
    void fetchData();
  }, [id]);

  const handleUpdateWork = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!normalizedWorkSlug || !title.trim()) {
      alert("슬러그와 작품명은 필수입니다.");
      return;
    }

    setSavingWork(true);
    const { data, error } = await supabase
      .from("official_works")
      .update({
        slug: normalizedWorkSlug,
        title: title.trim(),
        original_title: originalTitle.trim() || null,
        category,
        synopsis: synopsis.trim(),
        cover_image_url: coverImageUrl.trim() || null,
        status,
        sort_order: sortOrder,
      })
      .eq("id", id)
      .select("*")
      .single();
    setSavingWork(false);

    if (error) {
      alert(`작품 저장 실패: ${error.message}`);
      return;
    }

    hydrateWork(data as OfficialWork);
    alert("작품 정보를 저장했습니다.");
  };

  const handleDeleteWork = async () => {
    if (
      !confirm(
        "이 공식 작품을 삭제할까요? 연결된 공식 최애캐도 함께 삭제되며 되돌릴 수 없습니다.",
      )
    ) {
      return;
    }

    const { error } = await supabase.from("official_works").delete().eq("id", id);
    if (error) {
      alert(`작품 삭제 실패: ${error.message}`);
      return;
    }
    router.push("/admin/works");
  };

  const handleWorkImageUpload = async (file: File | null) => {
    if (!file) return;
    try {
      setUploadingWorkImage(true);
      const publicUrl = await uploadOfficialCatalogImage(
        "works",
        normalizedWorkSlug || work?.slug || id,
        file,
      );
      setCoverImageUrl(publicUrl);
    } catch (error) {
      alert(error instanceof Error ? error.message : "이미지 업로드 실패");
    } finally {
      setUploadingWorkImage(false);
    }
  };

  const handleCharacterImageUpload = async (file: File | null) => {
    if (!file) return;
    try {
      setUploadingCharacterImage(true);
      const publicUrl = await uploadOfficialCatalogImage(
        "oshi",
        normalizedCharacterSlug || characterForm.name || "draft-oshi",
        file,
      );
      setCharacterForm((current) => ({
        ...current,
        profile_image_url: publicUrl,
      }));
    } catch (error) {
      alert(error instanceof Error ? error.message : "이미지 업로드 실패");
    } finally {
      setUploadingCharacterImage(false);
    }
  };

  const editCharacter = (character: OfficialOshiCharacter) => {
    setCharacterForm({
      id: character.id,
      slug: character.slug,
      name: character.name,
      original_name: character.original_name ?? "",
      role_label: character.role_label ?? "",
      description: character.description ?? "",
      profile_image_url: character.profile_image_url ?? "",
      status: character.status,
      sort_order: character.sort_order,
    });
  };

  const resetCharacterForm = () => {
    setCharacterForm(EMPTY_CHARACTER_FORM);
  };

  const handleSaveCharacter = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!normalizedCharacterSlug || !characterForm.name.trim()) {
      alert("최애캐 슬러그와 이름은 필수입니다.");
      return;
    }

    setSavingCharacter(true);
    const payload = {
      work_id: id,
      slug: normalizedCharacterSlug,
      name: characterForm.name.trim(),
      original_name: characterForm.original_name.trim() || null,
      role_label: characterForm.role_label.trim() || null,
      description: characterForm.description.trim(),
      profile_image_url: characterForm.profile_image_url.trim() || null,
      status: characterForm.status,
      sort_order: characterForm.sort_order,
    };

    const query = characterForm.id
      ? supabase
          .from("official_oshi_characters")
          .update(payload)
          .eq("id", characterForm.id)
      : supabase.from("official_oshi_characters").insert(payload);

    const { error } = await query;
    setSavingCharacter(false);

    if (error) {
      alert(`최애캐 저장 실패: ${error.message}`);
      return;
    }

    resetCharacterForm();
    await fetchData();
  };

  const handleDeleteCharacter = async (character: OfficialOshiCharacter) => {
    if (!confirm(`"${character.name}" 최애캐를 삭제할까요?`)) return;
    setDeletingCharacterId(character.id);
    const { error } = await supabase
      .from("official_oshi_characters")
      .delete()
      .eq("id", character.id);
    setDeletingCharacterId(null);

    if (error) {
      alert(`최애캐 삭제 실패: ${error.message}`);
      return;
    }
    await fetchData();
  };

  if (loading) {
    return <div className="p-6 text-sm text-gray-500">로딩 중...</div>;
  }

  if (!work) return null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4 border-b border-dashed border-gray-500 pb-4">
        <Link href="/admin/works" className="text-gray-500 hover:text-black">
          뒤로가기
        </Link>
        <div>
          <h2 className="text-xl font-bold">{work.title} 관리</h2>
          <p className="mt-1 text-sm text-gray-600">
            공식 작품 정보와 이 작품에 연결할 공식 최애캐를 관리합니다.
          </p>
        </div>
      </div>

      <form
        onSubmit={handleUpdateWork}
        className="grid gap-4 rounded border border-dashed border-gray-500 bg-white/70 p-6 lg:grid-cols-2"
      >
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold">슬러그 *</span>
          <input
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            className="rounded border p-2 focus:border-black focus:outline-none"
            required
          />
          {normalizedWorkSlug ? (
            <p className="text-xs text-gray-600">미리보기: /works/{normalizedWorkSlug}</p>
          ) : null}
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold">작품명 *</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="rounded border p-2 focus:border-black focus:outline-none"
            required
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold">원제/별칭</span>
          <input
            value={originalTitle}
            onChange={(event) => setOriginalTitle(event.target.value)}
            className="rounded border p-2 focus:border-black focus:outline-none"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold">분류</span>
            <select
              value={category}
              onChange={(event) =>
                setCategory(event.target.value as OfficialWorkCategory)
              }
              className="rounded border border-gray-300 bg-white p-2 focus:border-black focus:outline-none"
            >
              {OFFICIAL_WORK_CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold">상태</span>
            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as OfficialCatalogStatus)
              }
              className="rounded border border-gray-300 bg-white p-2 focus:border-black focus:outline-none"
            >
              {OFFICIAL_CATALOG_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold">정렬</span>
            <input
              type="number"
              value={sortOrder}
              onChange={(event) => setSortOrder(Number(event.target.value))}
              className="rounded border p-2 focus:border-black focus:outline-none"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1 lg:col-span-2">
          <span className="text-sm font-semibold">소개</span>
          <textarea
            value={synopsis}
            onChange={(event) => setSynopsis(event.target.value)}
            rows={4}
            className="rounded border p-2 focus:border-black focus:outline-none"
          />
        </label>

        <label className="flex flex-col gap-1 lg:col-span-2">
          <span className="text-sm font-semibold">대표 이미지</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => void handleWorkImageUpload(event.target.files?.[0] ?? null)}
            disabled={uploadingWorkImage}
            className="rounded border p-2 focus:border-black focus:outline-none"
          />
          {uploadingWorkImage ? (
            <p className="text-xs text-gray-500">이미지 업로드 중...</p>
          ) : null}
          {coverImageUrl ? (
            <div className="mt-2 flex items-center gap-3">
              <img
                src={coverImageUrl}
                alt="대표 이미지 미리보기"
                className="h-20 w-14 rounded border object-cover"
              />
              <button
                type="button"
                onClick={() => setCoverImageUrl("")}
                className="text-xs text-red-600 hover:underline"
              >
                이미지 제거
              </button>
            </div>
          ) : null}
        </label>

        <div className="flex flex-wrap gap-2 pt-2 lg:col-span-2">
          <button
            type="submit"
            disabled={savingWork}
            className="rounded bg-black px-4 py-2 text-white transition-opacity hover:opacity-80 disabled:opacity-50"
          >
            {savingWork ? "저장 중..." : "작품 저장"}
          </button>
          <button
            type="button"
            onClick={handleDeleteWork}
            className="rounded border border-red-300 bg-red-50 px-4 py-2 text-red-700 transition-colors hover:bg-red-100"
          >
            작품 삭제
          </button>
        </div>
      </form>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded border border-dashed border-gray-500 bg-white/70 p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-lg font-bold">공식 최애캐 목록</h3>
            <span className="text-sm text-gray-500">{characters.length}명</span>
          </div>

          {characters.length === 0 ? (
            <p className="rounded border border-dashed border-gray-300 bg-white p-4 text-sm text-gray-500">
              아직 등록된 공식 최애캐가 없습니다.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b">
                  <tr>
                    <th className="p-3 font-semibold">이름</th>
                    <th className="p-3 font-semibold">상태</th>
                    <th className="p-3 font-semibold">정렬</th>
                    <th className="p-3 font-semibold text-right">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dashed">
                  {characters.map((character) => (
                    <tr
                      key={character.id}
                      className="transition-colors hover:bg-gray-100"
                    >
                      <td className="p-3">
                        <div className="font-medium">{character.name}</div>
                        <div className="text-xs text-gray-500">
                          /{work.slug}/{character.slug}
                        </div>
                      </td>
                      <td className="p-3 text-gray-600">{character.status}</td>
                      <td className="p-3 text-gray-600">{character.sort_order}</td>
                      <td className="p-3">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => editCharacter(character)}
                            className="text-blue-600 hover:underline"
                          >
                            수정
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteCharacter(character)}
                            disabled={deletingCharacterId === character.id}
                            className="inline-flex items-center gap-1 text-red-600 hover:underline disabled:opacity-50"
                          >
                            {deletingCharacterId === character.id ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Trash2 size={14} />
                            )}
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
        </div>

        <form
          onSubmit={handleSaveCharacter}
          className="flex flex-col gap-4 rounded border border-dashed border-gray-500 bg-white/70 p-6"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-lg font-bold">
              {characterForm.id ? "최애캐 수정" : "최애캐 추가"}
            </h3>
            {characterForm.id ? (
              <button
                type="button"
                onClick={resetCharacterForm}
                className="text-xs text-gray-500 hover:text-black"
              >
                새로 추가
              </button>
            ) : (
              <Plus size={16} className="text-gray-400" />
            )}
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold">슬러그 *</span>
            <input
              value={characterForm.slug}
              onChange={(event) =>
                setCharacterForm((current) => ({
                  ...current,
                  slug: event.target.value,
                }))
              }
              placeholder="ex) usopp"
              className="rounded border p-2 focus:border-black focus:outline-none"
              required
            />
            {normalizedCharacterSlug ? (
              <p className="text-xs text-gray-600">
                미리보기: /characters/{normalizedCharacterSlug}
              </p>
            ) : null}
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold">이름 *</span>
            <input
              value={characterForm.name}
              onChange={(event) =>
                setCharacterForm((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              className="rounded border p-2 focus:border-black focus:outline-none"
              required
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold">원문 이름/별칭</span>
            <input
              value={characterForm.original_name}
              onChange={(event) =>
                setCharacterForm((current) => ({
                  ...current,
                  original_name: event.target.value,
                }))
              }
              className="rounded border p-2 focus:border-black focus:outline-none"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold">역할/표기</span>
            <input
              value={characterForm.role_label}
              onChange={(event) =>
                setCharacterForm((current) => ({
                  ...current,
                  role_label: event.target.value,
                }))
              }
              placeholder="ex) 밀짚모자 일당"
              className="rounded border p-2 focus:border-black focus:outline-none"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-semibold">상태</span>
              <select
                value={characterForm.status}
                onChange={(event) =>
                  setCharacterForm((current) => ({
                    ...current,
                    status: event.target.value as OfficialCatalogStatus,
                  }))
                }
                className="rounded border border-gray-300 bg-white p-2 focus:border-black focus:outline-none"
              >
                {OFFICIAL_CATALOG_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm font-semibold">정렬</span>
              <input
                type="number"
                value={characterForm.sort_order}
                onChange={(event) =>
                  setCharacterForm((current) => ({
                    ...current,
                    sort_order: Number(event.target.value),
                  }))
                }
                className="rounded border p-2 focus:border-black focus:outline-none"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold">대표 이미지</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) =>
                void handleCharacterImageUpload(event.target.files?.[0] ?? null)
              }
              disabled={uploadingCharacterImage}
              className="rounded border p-2 focus:border-black focus:outline-none"
            />
            {uploadingCharacterImage ? (
              <p className="text-xs text-gray-500">이미지 업로드 중...</p>
            ) : null}
            {characterForm.profile_image_url ? (
              <div className="mt-2 flex items-center gap-3">
                <img
                  src={characterForm.profile_image_url}
                  alt="최애캐 이미지 미리보기"
                  className="h-16 w-16 rounded border object-cover"
                />
                <button
                  type="button"
                  onClick={() =>
                    setCharacterForm((current) => ({
                      ...current,
                      profile_image_url: "",
                    }))
                  }
                  className="text-xs text-red-600 hover:underline"
                >
                  이미지 제거
                </button>
              </div>
            ) : null}
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold">소개</span>
            <textarea
              value={characterForm.description}
              onChange={(event) =>
                setCharacterForm((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              rows={3}
              className="rounded border p-2 focus:border-black focus:outline-none"
            />
          </label>

          <button
            type="submit"
            disabled={savingCharacter}
            className="rounded bg-black px-4 py-2 text-white transition-opacity hover:opacity-80 disabled:opacity-50"
          >
            {savingCharacter ? "저장 중..." : characterForm.id ? "최애캐 저장" : "최애캐 추가"}
          </button>
        </form>
      </section>
    </div>
  );
}
