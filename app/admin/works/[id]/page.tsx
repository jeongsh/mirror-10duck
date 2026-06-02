"use client";

import Link from "next/link";
import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2, Trash2, Upload } from "lucide-react";
import OfficialCharacterForm from "@/components/admin/catalog/OfficialCharacterForm";
import OfficialWorkForm from "@/components/admin/catalog/OfficialWorkForm";
import {
  characterToForm,
  EMPTY_CHARACTER_FORM,
  workToForm,
  type CharacterPayload,
  type WorkPayload,
} from "@/lib/admin/catalogForms";
import { getCatalogStatusLabel, joinList } from "@/lib/official/catalog";
import { OSHI_TEMPLATE_PATH, parseOshiExcel } from "@/lib/official/excel";
import { supabase } from "@/lib/supabase/client";
import type { OfficialOshiCharacter, OfficialWork } from "@/types/official";

export default function OfficialWorkDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const oshiUploadInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingOshiExcel, setUploadingOshiExcel] = useState(false);
  const [deletingCharacterId, setDeletingCharacterId] = useState<string | null>(null);
  const [work, setWork] = useState<OfficialWork | null>(null);
  const [characters, setCharacters] = useState<OfficialOshiCharacter[]>([]);
  const [editingCharacter, setEditingCharacter] = useState<OfficialOshiCharacter | null>(null);

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

    setWork(workData as OfficialWork);
    setCharacters((characterData ?? []) as OfficialOshiCharacter[]);
    setLoading(false);
  };

  useEffect(() => {
    void fetchData();
  }, [id]);

  const handleUpdateWork = async (payload: WorkPayload) => {
    const { data, error } = await supabase
      .from("official_works")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      alert(`작품 저장 실패: ${error.message}`);
      throw error;
    }

    setWork(data as OfficialWork);
    alert("작품 정보를 저장했습니다.");
    return data as OfficialWork;
  };

  const handleDeleteWork = async () => {
    if (!confirm("이 작품을 삭제할까요? 연결된 공식 최애캐도 함께 삭제되며 되돌릴 수 없습니다.")) {
      return;
    }

    const { error } = await supabase.from("official_works").delete().eq("id", id);
    if (error) {
      alert(`작품 삭제 실패: ${error.message}`);
      return;
    }
    router.push("/admin/works");
  };

  const handleSaveCharacter = async (
    payload: CharacterPayload,
    characterId: string | null,
  ) => {
    const query = characterId
      ? supabase
          .from("official_oshi_characters")
          .update(payload)
          .eq("id", characterId)
          .select("*")
          .single()
      : supabase.from("official_oshi_characters").insert(payload).select("*").single();

    const { data, error } = await query;
    if (error) {
      alert(`최애캐 저장 실패: ${error.message}`);
      throw error;
    }

    setEditingCharacter(null);
    await fetchData();
    return data as OfficialOshiCharacter;
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

      <OfficialWorkForm
        mode="edit"
        initialValue={workToForm(work)}
        onSave={handleUpdateWork}
        onDelete={handleDeleteWork}
      />

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="rounded border border-dashed border-gray-500 bg-white/70 p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold">공식 최애캐 목록</h3>
              <p className="mt-1 text-xs text-gray-500">{characters.length}명</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href={OSHI_TEMPLATE_PATH}
                download
                className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-3 py-2 text-xs transition-colors hover:bg-gray-100"
              >
                <Download size={14} />
                엑셀 폼
              </a>
              <button
                type="button"
                onClick={() => oshiUploadInputRef.current?.click()}
                disabled={uploadingOshiExcel}
                className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-3 py-2 text-xs transition-colors hover:bg-gray-100 disabled:opacity-50"
              >
                <Upload size={14} />
                {uploadingOshiExcel ? "업로드 중..." : "엑셀 업로드"}
              </button>
              <input
                ref={oshiUploadInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(event) => void handleOshiExcelUpload(event.target.files?.[0] ?? null)}
              />
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
                    <th className="w-20 p-3 font-semibold">썸네일</th>
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
                      <td className="p-3 align-top">
                        <div className="flex h-16 w-12 items-center justify-center overflow-hidden rounded border border-dashed border-gray-300 bg-gray-100 text-center text-[9px] font-bold leading-tight text-gray-400">
                          {character.profile_image_url ? (
                            <img
                              src={character.profile_image_url}
                              alt={`${character.name} 썸네일`}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span>
                              NO
                              <br />
                              IMAGE
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="font-medium">{character.name}</div>
                        <div className="text-xs text-gray-500">
                          /{work.slug}/{character.slug}
                        </div>
                        {character.original_name ? (
                          <div className="text-xs text-gray-400">{character.original_name}</div>
                        ) : null}
                      </td>
                      <td className="p-3 text-gray-600">
                        <div className="text-xs font-semibold text-gray-700">
                          {joinList(character.positions) || "-"}
                        </div>
                        <div className="mt-1 line-clamp-2 text-xs text-gray-400">
                          {joinList(character.tags) || "-"}
                        </div>
                        {character.meme_tags?.length ? (
                          <div className="mt-1 line-clamp-1 text-xs text-pink-500">
                            {joinList(character.meme_tags)}
                          </div>
                        ) : null}
                      </td>
                      <td className="p-3 text-gray-600">
                        {getCatalogStatusLabel(character.status)}
                      </td>
                      <td className="p-3 text-gray-600">{character.sort_order}</td>
                      <td className="p-3">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingCharacter(character)}
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

        <OfficialCharacterForm
          key={editingCharacter?.id ?? "new-character"}
          workId={id}
          initialValue={editingCharacter ? characterToForm(editingCharacter) : EMPTY_CHARACTER_FORM}
          onSave={handleSaveCharacter}
          onReset={() => setEditingCharacter(null)}
        />
      </section>
    </div>
  );
}
