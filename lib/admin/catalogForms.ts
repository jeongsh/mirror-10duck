import {
  joinList,
  normalizeOfficialSlug,
  splitList,
  uniqueList,
} from "@/lib/official/catalog";
import type { CatalogEditChanges } from "@/lib/catalogRequest";
import type {
  CharacterAddRequestRow,
  WorkAddRequestRow,
} from "@/types/catalogRequest";
import type {
  OfficialCatalogStatus,
  OfficialOshiCharacter,
  OfficialWork,
  OfficialWorkCategory,
} from "@/types/official";

export type WorkFormState = {
  slug: string;
  title: string;
  original_title: string;
  aliases: string;
  category: OfficialWorkCategory;
  genres: string;
  age_rating: string;
  ott_platforms: string;
  start_date: string;
  end_date: string;
  season: string;
  episode_count: string;
  studios: string;
  director: string;
  original_author: string;
  anilist_id: string;
  synopsis: string;
  cover_image_url: string;
  status: OfficialCatalogStatus;
  sort_order: number;
};

export type WorkPayload = {
  slug: string;
  title: string;
  original_title: string | null;
  aliases: string[];
  category: OfficialWorkCategory;
  genres: string[];
  age_rating: string | null;
  ott_platforms: string[];
  start_date: string | null;
  end_date: string | null;
  season: string | null;
  episode_count: number | null;
  studios: string[];
  director: string | null;
  original_author: string | null;
  anilist_id: number | null;
  synopsis: string;
  cover_image_url: string | null;
  status: OfficialCatalogStatus;
  sort_order: number;
};

export type CharacterFormState = {
  id: string | null;
  slug: string;
  name: string;
  original_name: string;
  aliases: string;
  gender: string;
  positions: string;
  tags: string;
  meme_tags: string;
  description: string;
  profile_image_url: string;
  status: OfficialCatalogStatus;
  sort_order: number;
};

export type CharacterPayload = {
  work_id: string;
  slug: string;
  name: string;
  original_name: string | null;
  aliases: string[];
  gender: string | null;
  positions: string[];
  tags: string[];
  meme_tags: string[];
  description: string;
  profile_image_url: string | null;
  status: OfficialCatalogStatus;
  sort_order: number;
};

export const EMPTY_WORK_FORM: WorkFormState = {
  slug: "",
  title: "",
  original_title: "",
  aliases: "",
  category: "anime",
  genres: "",
  age_rating: "",
  ott_platforms: "",
  start_date: "",
  end_date: "",
  season: "",
  episode_count: "",
  studios: "",
  director: "",
  original_author: "",
  anilist_id: "",
  synopsis: "",
  cover_image_url: "",
  status: "DRAFT",
  sort_order: 0,
};

export const EMPTY_CHARACTER_FORM: CharacterFormState = {
  id: null,
  slug: "",
  name: "",
  original_name: "",
  aliases: "",
  gender: "",
  positions: "",
  tags: "",
  meme_tags: "",
  description: "",
  profile_image_url: "",
  status: "DRAFT",
  sort_order: 0,
};

export function workToForm(work: OfficialWork): WorkFormState {
  return {
    slug: work.slug,
    title: work.title,
    original_title: work.original_title ?? "",
    aliases: joinList(work.aliases),
    category: work.category,
    genres: joinList(work.genres),
    age_rating: work.age_rating ?? "",
    ott_platforms: joinList(work.ott_platforms),
    start_date: work.start_date ?? "",
    end_date: work.end_date ?? "",
    season: work.season ?? "",
    episode_count: work.episode_count ? String(work.episode_count) : "",
    studios: joinList(work.studios),
    director: work.director ?? "",
    original_author: work.original_author ?? "",
    anilist_id: work.anilist_id ? String(work.anilist_id) : "",
    synopsis: work.synopsis ?? "",
    cover_image_url: work.cover_image_url ?? "",
    status: work.status,
    sort_order: work.sort_order,
  };
}

export function workAddRequestToForm(row: WorkAddRequestRow): WorkFormState {
  return {
    ...EMPTY_WORK_FORM,
    slug: normalizeOfficialSlug(row.work_title),
    title: row.work_title,
    original_title: row.original_title ?? "",
    category: row.category,
    status: "DRAFT",
  };
}

export function applyWorkChanges(
  base: WorkFormState,
  changes: CatalogEditChanges,
): WorkFormState {
  return {
    ...base,
    title: changes.title ?? base.title,
    original_title: changes.original_title ?? base.original_title,
    category: changes.category ?? base.category,
    genres: changes.genres ? joinList(changes.genres) : base.genres,
    cover_image_url: changes.profile_image_url ?? base.cover_image_url,
  };
}

export function workFormToPayload(form: WorkFormState): WorkPayload {
  return {
    slug: normalizeOfficialSlug(form.slug || form.title),
    title: form.title.trim(),
    original_title: form.original_title.trim() || null,
    aliases: splitList(form.aliases),
    category: form.category,
    genres: splitList(form.genres),
    age_rating: form.age_rating.trim() || null,
    ott_platforms: splitList(form.ott_platforms),
    start_date: form.start_date || null,
    end_date: form.end_date || null,
    season: form.season.trim() || null,
    episode_count: form.episode_count ? Number(form.episode_count) : null,
    studios: splitList(form.studios),
    director: form.director.trim() || null,
    original_author: form.original_author.trim() || null,
    anilist_id: form.anilist_id ? Number(form.anilist_id) : null,
    synopsis: form.synopsis.trim(),
    cover_image_url: form.cover_image_url.trim() || null,
    status: form.status,
    sort_order: form.sort_order,
  };
}

export function characterToForm(character: OfficialOshiCharacter): CharacterFormState {
  return {
    id: character.id,
    slug: character.slug,
    name: character.name,
    original_name: character.original_name ?? "",
    aliases: joinList(character.aliases),
    gender: character.gender ?? "",
    positions: joinList(character.positions),
    tags: joinList(character.tags),
    meme_tags: joinList(character.meme_tags),
    description: character.description ?? "",
    profile_image_url: character.profile_image_url ?? "",
    status: character.status,
    sort_order: character.sort_order,
  };
}

export function characterAddRequestToForm(row: CharacterAddRequestRow): CharacterFormState {
  return {
    ...EMPTY_CHARACTER_FORM,
    slug: normalizeOfficialSlug(row.character_name),
    name: row.character_name,
    original_name: row.character_original_name ?? "",
    description: row.character_note ?? "",
    status: "DRAFT",
  };
}

export function applyCharacterChanges(
  base: CharacterFormState,
  changes: CatalogEditChanges,
): CharacterFormState {
  return {
    ...base,
    name: changes.name ?? base.name,
    original_name: changes.original_name ?? base.original_name,
    tags: changes.tags ? joinList(changes.tags) : base.tags,
    meme_tags: changes.meme_tags ? joinList(changes.meme_tags) : base.meme_tags,
    positions: changes.positions ? joinList(changes.positions) : base.positions,
    description: changes.description ?? base.description,
    profile_image_url: changes.profile_image_url ?? base.profile_image_url,
  };
}

export function characterFormToPayload(
  form: CharacterFormState,
  workId: string,
): CharacterPayload {
  return {
    work_id: workId,
    slug: normalizeOfficialSlug(form.slug || form.name),
    name: form.name.trim(),
    original_name: form.original_name.trim() || null,
    aliases: splitList(form.aliases),
    gender: form.gender.trim() || null,
    positions: uniqueList(splitList(form.positions)),
    tags: uniqueList(splitList(form.tags)),
    meme_tags: uniqueList(splitList(form.meme_tags)),
    description: form.description.trim(),
    profile_image_url: form.profile_image_url.trim() || null,
    status: form.status,
    sort_order: form.sort_order,
  };
}
