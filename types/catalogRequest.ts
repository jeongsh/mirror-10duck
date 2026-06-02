import type { CatalogEditChanges } from "@/lib/catalogRequest";
import type { OfficialWorkCategory } from "@/types/official";

export type CatalogRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

export type CharacterAddRequestRow = {
  id: string;
  requester_id: string | null;
  character_name: string;
  character_original_name: string | null;
  character_note: string | null;
  work_title: string;
  official_work_id: string | null;
  request_new_work: boolean;
  work_category: string | null;
  source_url: string | null;
  reason: string;
  source: string | null;
  status: CatalogRequestStatus;
  admin_note: string | null;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
};

export type WorkAddRequestRow = {
  id: string;
  requester_id: string | null;
  work_title: string;
  original_title: string | null;
  category: OfficialWorkCategory;
  source_url: string | null;
  reason: string;
  source: string | null;
  status: CatalogRequestStatus;
  admin_note: string | null;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
};

export type CatalogEditRequestRow = {
  id: string;
  requester_id: string | null;
  target_type: "character" | "work";
  character_id: string | null;
  work_id: string | null;
  changes: CatalogEditChanges;
  reason: string | null;
  source: string | null;
  status: CatalogRequestStatus;
  admin_note: string | null;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
};
