export type OfficialWorkCategory =
  | "anime"
  | "manga"
  | "light_novel"
  | "webtoon"
  | "other";

export type OfficialCatalogStatus = "DRAFT" | "PUBLISHED" | "HIDDEN";

export type OfficialWork = {
  id: string;
  slug: string;
  title: string;
  original_title: string | null;
  category: OfficialWorkCategory;
  synopsis: string;
  cover_image_url: string | null;
  status: OfficialCatalogStatus;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type OfficialOshiCharacter = {
  id: string;
  work_id: string;
  slug: string;
  name: string;
  original_name: string | null;
  role_label: string | null;
  description: string;
  profile_image_url: string | null;
  status: OfficialCatalogStatus;
  sort_order: number;
  created_at: string;
  updated_at: string;
};
