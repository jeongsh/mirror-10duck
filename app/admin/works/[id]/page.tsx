"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import {
  OFFICIAL_CATALOG_STATUS_OPTIONS,
  OFFICIAL_WORK_CATEGORY_OPTIONS,
  joinList,
  normalizeOfficialSlug,
  splitList,
} from "@/lib/official/catalog";
import { OSHI_TEMPLATE_PATH, parseOshiExcel } from "@/lib/official/excel";
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
  aliases: string;
  birthday: string;
  gender: string;
  age: string;
  height: string;
  voice_actor: string;
  quote: string;
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
  aliases: "",
  birthday: "",
  gender: "",
  age: "",
  height: "",
  voice_actor: "",
  quote: "",
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
  const oshiUploadInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [savingWork, setSavingWork] = useState(false);
  const [savingCharacter, setSavingCharacter] = useState(false);
  const [uploadingOshiExcel, setUploadingOshiExcel] = useState(false);
  const [deletingCharacterId, setDeletingCharacterId] = useState<string | null>(null);
  const [work, setWork] = useState<OfficialWork | null>(null);
  const [characters, setCharacters] = useState<OfficialOshiCharacter[]>([]);

  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [originalTitle, setOriginalTitle] = useState("");
  const [aliases, setAliases] = useState("");
  const [category, setCategory] = useState<OfficialWorkCategory>("anime");
  const [genres, setGenres] = useState("");
  const [ageRating, setAgeRating] = useState("");
  const [ottPlatforms, setOttPlatforms] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [season, setSeason] = useState("");
  const [episodeCount, setEpisodeCount] = useState("");
  const [studios, setStudios] = useState("");
  const [director, setDirector] = useState("");
  const [originalAuthor, setOriginalAuthor] = useState("");
  const [anilistId, setAnilistId] = useState("");
  const [synopsis, setSynopsis] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [status, setStatus] = useState<OfficialCatalogStatus>("DRAFT");
  const [sortOrder, setSortOrder] = useState(0);
  const [characterForm, setCharacterForm] =
    useState<CharacterForm>(EMPTY_CHARACTER_FORM);
  const [uploadingWorkImage, setUploadingWorkImage] = useState(false);
  const [uploadingCharacterImage, setUploadingCharacterImage] = useState(false);

  const normalizedWorkSlug = normalizeOfficialSlug(slug || title);
  const normalizedCharacterSlug = useMemo(
    () => normalizeOfficialSlug(characterForm.slug || characterForm.name),
    [characterForm.slug, characterForm.name],
  );

  const hydrateWork = (nextWork: OfficialWork) => {
    setWork(nextWork);
    setSlug(nextWork.slug);
    setTitle(nextWork.title);
    setOriginalTitle(nextWork.original_title ?? "");
    setAliases(joinList(nextWork.aliases));
    setCategory(nextWork.category);
    setGenres(joinList(nextWork.genres));
    setAgeRating(nextWork.age_rating ?? "");
    setOttPlatforms(joinList(nextWork.ott_platforms));
    setStartDate(nextWork.start_date ?? "");
    setEndDate(nextWork.end_date ?? "");
    setSeason(nextWork.season ?? "");
    setEpisodeCount(nextWork.episode_count ? String(nextWork.episode_count) : "");
    setStudios(joinList(nextWork.studios));
    setDirector(nextWork.director ?? "");
    setOriginalAuthor(nextWork.original_author ?? "");
    setAnilistId(nextWork.anilist_id ? String(nextWork.anilist_id) : "");
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

  const workPayload = () => ({
    slug: normalizedWorkSlug,
    title: title.trim(),
    original_title: originalTitle.trim() || null,
    aliases: splitList(aliases),
    category,
    genres: splitList(genres),
    age_rating: ageRating.trim() || null,
    ott_platforms: splitList(ottPlatforms),
    start_date: startDate || null,
    end_date: endDate || null,
    season: season.trim() || null,
    episode_count: episodeCount ? Number(episodeCount) : null,
    studios: splitList(studios),
    director: director.trim() || null,
    original_author: originalAuthor.trim() || null,
    anilist_id: anilistId ? Number(anilistId) : null,
    synopsis: synopsis.trim(),
    cover_image_url: coverImageUrl.trim() || null,
    status,
    sort_order: sortOrder,
  });

  const handleUpdateWork = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!normalizedWorkSlug || !title.trim()) {
      alert("슬러그와 작품명은 필수입니다.");
      return;
    }

    setSavingWork(true);
    const { data, error } = await supabase
      .from("official_works")
      .update(workPayload())
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
        "이 작품을 삭제할까요? 연결된 공식 최애캐도 함께 삭제되며 되돌릴 수 없습니다.",
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
      aliases: joinList(character.aliases),
      birthday: character.birthday ?? "",
      gender: character.gender ?? "",
      age: character.age ?? "",
      height: character.height ?? "",
      voice_actor: character.voice_actor ?? "",
      quote: character.quote ?? "",
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

  const characterPayload = () => ({
    work_id: id,
    slug: normalizedCharacterSlug,
    name: characterForm.name.trim(),
    original_name: characterForm.original_name.trim() || null,
    aliases: splitList(characterForm.aliases),
    birthday: characterForm.birthday || null,
    gender: characterForm.gender.trim() || null,
    age: characterForm.age.trim() || null,
    height: characterForm.height.trim() || null,
    voice_actor: characterForm.voice_actor.trim() || null,
    quote: characterForm.quote.trim() || null,
    role_label: characterForm.role_label.trim() || null,
    description: characterForm.description.trim(),
    profile_image_url: characterForm.profile_image_url.trim() || null,
    status: characterForm.status,
    sort_order: characterForm.sort_order,
  });

  const handleSaveCharacter = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!normalizedCharacterSlug || !characterForm.name.trim()) {
      alert("최애캐 슬러그와 이름은 필수입니다.");
      return;
    }

    setSavingCharacter(true);
    const payload = characterPayload();
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

  const handleOshiExcelUpload = async (file: File | null) => {
    if (!file) return;
    setUploadingOshiExcel(true);
    try {
      const rows = await parseOshiExcel(file, id);
      if (rows.length === 0) {
        alert("추가할 최애 데이터가 없습니다.");
        return;
      }

      const { error } = await supabase.from("official_oshi_characters").upsert(
        rows.map((row) => ({
          ...row,
          role_label: null,
          profile_image_url: null,
        })),
        { onConflict: "work_id,slug" },
      );

      if (error) throw error;
      alert(`${rows.length}개 최애 데이터를 반영했습니다.`);
      await fetchData();
    } catch (error) {
      alert(error instanceof Error ? error.message : "엑셀 업로드 실패");
    } finally {
      setUploadingOshiExcel(false);
      if (oshiUploadInputRef.current) oshiUploadInputRef.current.value = "";
    }
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
            작품 정보와 이 작품에 연결할 공식 최애캐를 관리합니다.
          </p>
        </div>
      </div>

      <form
        onSubmit={handleUpdateWork}
        className="flex flex-col gap-6 rounded border border-dashed border-gray-500 bg-white/70 p-6"
      >
        <section className="grid gap-4 lg:grid-cols-2">
          <h3 className="lg:col-span-2 text-sm font-bold uppercase tracking-widest text-gray-500">기본</h3>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold">작품명 *</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} className="rounded border p-2 focus:border-black focus:outline-none" required />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold">원제</span>
            <input value={originalTitle} onChange={(event) => setOriginalTitle(event.target.value)} className="rounded border p-2 focus:border-black focus:outline-none" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold">슬러그 *</span>
            <input value={slug} onChange={(event) => setSlug(event.target.value)} className="rounded border p-2 focus:border-black focus:outline-none" required />
            {normalizedWorkSlug ? <p className="text-xs text-gray-600">미리보기: /works/{normalizedWorkSlug}</p> : null}
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold">별칭</span>
            <input value={aliases} onChange={(event) => setAliases(event.target.value)} placeholder="쉼표로 구분" className="rounded border p-2 focus:border-black focus:outline-none" />
          </label>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <h3 className="lg:col-span-3 text-sm font-bold uppercase tracking-widest text-gray-500">분류</h3>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold">장르(태그)</span>
            <input value={genres} onChange={(event) => setGenres(event.target.value)} placeholder="액션, 판타지" className="rounded border p-2 focus:border-black focus:outline-none" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold">연령등급</span>
            <input value={ageRating} onChange={(event) => setAgeRating(event.target.value)} className="rounded border p-2 focus:border-black focus:outline-none" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold">국내 시청 가능 OTT</span>
            <input value={ottPlatforms} onChange={(event) => setOttPlatforms(event.target.value)} placeholder="라프텔, 티빙, 웨이브, 넷플릭스" className="rounded border p-2 focus:border-black focus:outline-none" />
          </label>
        </section>

        <section className="grid gap-4 lg:grid-cols-4">
          <h3 className="lg:col-span-4 text-sm font-bold uppercase tracking-widest text-gray-500">방영정보</h3>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold">시작일</span>
            <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="rounded border p-2 focus:border-black focus:outline-none" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold">종료일</span>
            <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="rounded border p-2 focus:border-black focus:outline-none" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold">분기</span>
            <input value={season} onChange={(event) => setSeason(event.target.value)} className="rounded border p-2 focus:border-black focus:outline-none" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold">화수</span>
            <input type="number" min={1} value={episodeCount} onChange={(event) => setEpisodeCount(event.target.value)} className="rounded border p-2 focus:border-black focus:outline-none" />
          </label>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <h3 className="lg:col-span-3 text-sm font-bold uppercase tracking-widest text-gray-500">제작</h3>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold">제작사</span>
            <input value={studios} onChange={(event) => setStudios(event.target.value)} placeholder="쉼표로 구분" className="rounded border p-2 focus:border-black focus:outline-none" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold">감독</span>
            <input value={director} onChange={(event) => setDirector(event.target.value)} className="rounded border p-2 focus:border-black focus:outline-none" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold">원작자</span>
            <input value={originalAuthor} onChange={(event) => setOriginalAuthor(event.target.value)} className="rounded border p-2 focus:border-black focus:outline-none" />
          </label>
        </section>

        <section className="grid gap-4 lg:grid-cols-4">
          <h3 className="lg:col-span-4 text-sm font-bold uppercase tracking-widest text-gray-500">외부 / 관리</h3>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold">AniList ID</span>
            <input type="number" value={anilistId} onChange={(event) => setAnilistId(event.target.value)} className="rounded border p-2 focus:border-black focus:outline-none" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold">상태</span>
            <select value={status} onChange={(event) => setStatus(event.target.value as OfficialCatalogStatus)} className="rounded border border-gray-300 bg-white p-2 focus:border-black focus:outline-none">
              {OFFICIAL_CATALOG_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold">우선순위</span>
            <input type="number" value={sortOrder} onChange={(event) => setSortOrder(Number(event.target.value))} className="rounded border p-2 focus:border-black focus:outline-none" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold">분류</span>
            <select value={category} onChange={(event) => setCategory(event.target.value as OfficialWorkCategory)} className="rounded border border-gray-300 bg-white p-2 focus:border-black focus:outline-none">
              {OFFICIAL_WORK_CATEGORY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
        </section>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold">소개</span>
          <textarea value={synopsis} onChange={(event) => setSynopsis(event.target.value)} rows={4} className="rounded border p-2 focus:border-black focus:outline-none" />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold">대표 이미지</span>
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void handleWorkImageUpload(event.target.files?.[0] ?? null)} disabled={uploadingWorkImage} className="rounded border p-2 focus:border-black focus:outline-none" />
          {uploadingWorkImage ? <p className="text-xs text-gray-500">이미지 업로드 중...</p> : null}
          {coverImageUrl ? (
            <div className="mt-2 flex items-center gap-3">
              <img src={coverImageUrl} alt="대표 이미지 미리보기" className="h-20 w-14 rounded border object-cover" />
              <button type="button" onClick={() => setCoverImageUrl("")} className="text-xs text-red-600 hover:underline">이미지 제거</button>
            </div>
          ) : null}
        </label>

        <div className="flex flex-wrap gap-2 pt-2">
          <button type="submit" disabled={savingWork} className="rounded bg-black px-4 py-2 text-white transition-opacity hover:opacity-80 disabled:opacity-50">
            {savingWork ? "저장 중..." : "작품 저장"}
          </button>
          <button type="button" onClick={handleDeleteWork} className="rounded border border-red-300 bg-red-50 px-4 py-2 text-red-700 transition-colors hover:bg-red-100">
            작품 삭제
          </button>
        </div>
      </form>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="rounded border border-dashed border-gray-500 bg-white/70 p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold">공식 최애캐 목록</h3>
              <p className="mt-1 text-xs text-gray-500">{characters.length}명</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a href={OSHI_TEMPLATE_PATH} download className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-3 py-2 text-xs transition-colors hover:bg-gray-100">
                <Download size={14} />
                엑셀 폼
              </a>
              <button type="button" onClick={() => oshiUploadInputRef.current?.click()} disabled={uploadingOshiExcel} className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-3 py-2 text-xs transition-colors hover:bg-gray-100 disabled:opacity-50">
                <Upload size={14} />
                {uploadingOshiExcel ? "업로드 중..." : "엑셀 업로드"}
              </button>
              <input ref={oshiUploadInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(event) => void handleOshiExcelUpload(event.target.files?.[0] ?? null)} />
            </div>
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
                    <th className="p-3 font-semibold">프로필</th>
                    <th className="p-3 font-semibold">상태</th>
                    <th className="p-3 font-semibold">우선순위</th>
                    <th className="p-3 font-semibold text-right">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dashed">
                  {characters.map((character) => (
                    <tr key={character.id} className="transition-colors hover:bg-gray-100">
                      <td className="p-3">
                        <div className="font-medium">{character.name}</div>
                        <div className="text-xs text-gray-500">/{work.slug}/{character.slug}</div>
                        {character.original_name ? <div className="text-xs text-gray-400">{character.original_name}</div> : null}
                      </td>
                      <td className="p-3 text-gray-600">
                        <div>{character.voice_actor || "-"}</div>
                        <div className="text-xs text-gray-400">{[character.gender, character.age, character.height].filter(Boolean).join(" / ") || "-"}</div>
                      </td>
                      <td className="p-3 text-gray-600">{getCatalogLabel(character.status)}</td>
                      <td className="p-3 text-gray-600">{character.sort_order}</td>
                      <td className="p-3">
                        <div className="flex justify-end gap-2">
                          <button type="button" onClick={() => editCharacter(character)} className="text-blue-600 hover:underline">수정</button>
                          <button type="button" onClick={() => void handleDeleteCharacter(character)} disabled={deletingCharacterId === character.id} className="inline-flex items-center gap-1 text-red-600 hover:underline disabled:opacity-50">
                            {deletingCharacterId === character.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
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

        <form onSubmit={handleSaveCharacter} className="flex flex-col gap-4 rounded border border-dashed border-gray-500 bg-white/70 p-6">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-lg font-bold">{characterForm.id ? "최애 수정" : "최애 추가"}</h3>
            {characterForm.id ? (
              <button type="button" onClick={resetCharacterForm} className="text-xs text-gray-500 hover:text-black">새로 추가</button>
            ) : (
              <Plus size={16} className="text-gray-400" />
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-semibold">이름 *</span>
              <input value={characterForm.name} onChange={(event) => setCharacterForm((current) => ({ ...current, name: event.target.value }))} className="rounded border p-2 focus:border-black focus:outline-none" required />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-semibold">원문명</span>
              <input value={characterForm.original_name} onChange={(event) => setCharacterForm((current) => ({ ...current, original_name: event.target.value }))} className="rounded border p-2 focus:border-black focus:outline-none" />
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold">슬러그 *</span>
            <input value={characterForm.slug} onChange={(event) => setCharacterForm((current) => ({ ...current, slug: event.target.value }))} placeholder="ex) usopp" className="rounded border p-2 focus:border-black focus:outline-none" />
            {normalizedCharacterSlug ? <p className="text-xs text-gray-600">미리보기: /characters/{normalizedCharacterSlug}</p> : null}
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold">별칭</span>
            <input value={characterForm.aliases} onChange={(event) => setCharacterForm((current) => ({ ...current, aliases: event.target.value }))} placeholder="쉼표로 구분" className="rounded border p-2 focus:border-black focus:outline-none" />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-semibold">생일</span>
              <input value={characterForm.birthday} onChange={(event) => setCharacterForm((current) => ({ ...current, birthday: event.target.value }))} className="rounded border p-2 focus:border-black focus:outline-none" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-semibold">성별</span>
              <input value={characterForm.gender} onChange={(event) => setCharacterForm((current) => ({ ...current, gender: event.target.value }))} className="rounded border p-2 focus:border-black focus:outline-none" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-semibold">나이</span>
              <input value={characterForm.age} onChange={(event) => setCharacterForm((current) => ({ ...current, age: event.target.value }))} className="rounded border p-2 focus:border-black focus:outline-none" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-semibold">키</span>
              <input value={characterForm.height} onChange={(event) => setCharacterForm((current) => ({ ...current, height: event.target.value }))} className="rounded border p-2 focus:border-black focus:outline-none" />
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold">성우</span>
            <input value={characterForm.voice_actor} onChange={(event) => setCharacterForm((current) => ({ ...current, voice_actor: event.target.value }))} className="rounded border p-2 focus:border-black focus:outline-none" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold">대표대사</span>
            <input value={characterForm.quote} onChange={(event) => setCharacterForm((current) => ({ ...current, quote: event.target.value }))} className="rounded border p-2 focus:border-black focus:outline-none" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold">역할/표기</span>
            <input value={characterForm.role_label} onChange={(event) => setCharacterForm((current) => ({ ...current, role_label: event.target.value }))} placeholder="ex) 밀짚모자 일당" className="rounded border p-2 focus:border-black focus:outline-none" />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-semibold">상태</span>
              <select value={characterForm.status} onChange={(event) => setCharacterForm((current) => ({ ...current, status: event.target.value as OfficialCatalogStatus }))} className="rounded border border-gray-300 bg-white p-2 focus:border-black focus:outline-none">
                {OFFICIAL_CATALOG_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-semibold">우선순위</span>
              <input type="number" value={characterForm.sort_order} onChange={(event) => setCharacterForm((current) => ({ ...current, sort_order: Number(event.target.value) }))} className="rounded border p-2 focus:border-black focus:outline-none" />
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold">대표 이미지</span>
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void handleCharacterImageUpload(event.target.files?.[0] ?? null)} disabled={uploadingCharacterImage} className="rounded border p-2 focus:border-black focus:outline-none" />
            {uploadingCharacterImage ? <p className="text-xs text-gray-500">이미지 업로드 중...</p> : null}
            {characterForm.profile_image_url ? (
              <div className="mt-2 flex items-center gap-3">
                <img src={characterForm.profile_image_url} alt="최애캐 이미지 미리보기" className="h-16 w-16 rounded border object-cover" />
                <button type="button" onClick={() => setCharacterForm((current) => ({ ...current, profile_image_url: "" }))} className="text-xs text-red-600 hover:underline">이미지 제거</button>
              </div>
            ) : null}
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold">소개</span>
            <textarea value={characterForm.description} onChange={(event) => setCharacterForm((current) => ({ ...current, description: event.target.value }))} rows={3} className="rounded border p-2 focus:border-black focus:outline-none" />
          </label>

          <button type="submit" disabled={savingCharacter} className="rounded bg-black px-4 py-2 text-white transition-opacity hover:opacity-80 disabled:opacity-50">
            {savingCharacter ? "저장 중..." : characterForm.id ? "최애 저장" : "최애 추가"}
          </button>
        </form>
      </section>
    </div>
  );
}

function getCatalogLabel(status: OfficialCatalogStatus) {
  return OFFICIAL_CATALOG_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;
}
