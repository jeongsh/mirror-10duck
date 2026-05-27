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
  aliases: string[] | null;
  category: OfficialWorkCategory;
  genres: string[] | null;
  age_rating: string | null;
  start_date: string | null;
  end_date: string | null;
  season: string | null;
  episode_count: number | null;
  studios: string[] | null;
  director: string | null;
  original_author: string | null;
  anilist_id: number | null;
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
  aliases: string[] | null;
  birthday: string | null;
  gender: string | null;
  age: string | null;
  height: string | null;
  voice_actor: string | null;
  quote: string | null;
  role_label: string | null;
  description: string;
  profile_image_url: string | null;
  status: OfficialCatalogStatus;
  sort_order: number;
  created_at: string;
  updated_at: string;
};
