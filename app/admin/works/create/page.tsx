"use client";

import { useRouter } from "next/navigation";
import OfficialWorkForm from "@/components/admin/catalog/OfficialWorkForm";
import { supabase } from "@/lib/supabase/client";
import type { WorkPayload } from "@/lib/admin/catalogForms";
import type { OfficialWork } from "@/types/official";

export default function CreateOfficialWorkPage() {
  const router = useRouter();

  const handleSave = async (payload: WorkPayload) => {
    const { data, error } = await supabase
      .from("official_works")
      .insert({ ...payload, cover_image_url: null })
      .select("*")
      .single();

    if (error) {
      alert(`작품 추가 실패: ${error.message}`);
      throw error;
    }

    return data as OfficialWork;
  };

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div className="border-b border-dashed border-gray-500 pb-4">
        <h2 className="text-xl font-bold">작품 추가</h2>
        <p className="mt-1 text-sm text-gray-600">
          온보딩과 작품 허브에서 선택할 수 있는 작품 정보를 등록합니다. 이미지는 상세 화면에서 직접 넣으면 됩니다.
        </p>
      </div>

      <OfficialWorkForm
        mode="create"
        onSave={handleSave}
        onSaved={(work) => {
          if (work?.id) router.push(`/admin/works/${work.id}`);
        }}
        onCancel={() => router.push("/admin/works")}
      />
    </div>
  );
}
