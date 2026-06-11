"use client";

import {
  createTopicCardFromSourcedDraft,
  type SourcedTopicDraftResult,
  type TopicCard,
} from "@/lib/topics/topicCards";

const STORAGE_KEY = "ssibduk.approvedTopicDrafts";

type StoredSourcedDraft = SourcedTopicDraftResult & {
  id: string;
  approvedAt: string;
};

export function readApprovedSourcedTopicCards(): TopicCard[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const rows = JSON.parse(raw) as StoredSourcedDraft[];
    if (!Array.isArray(rows)) return [];

    return rows
      .filter((row) => row.status === "approved" && row.officialSources.length > 0)
      .map((row) => ({
        ...createTopicCardFromSourcedDraft(row, row.id),
        createdAt: row.approvedAt,
      }));
  } catch {
    return [];
  }
}

export function storeApprovedSourcedTopicDraft(result: SourcedTopicDraftResult): TopicCard {
  if (typeof window === "undefined") {
    return createTopicCardFromSourcedDraft(result);
  }

  const id = `sourced-${crypto.randomUUID()}`;
  const approvedAt = new Date().toISOString();
  const row: StoredSourcedDraft = {
    ...result,
    id,
    approvedAt,
    status: "approved",
  };

  const current = readStoredRows();
  const next = [row, ...current].slice(0, 20);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("ssibduk:topics-updated"));
  return {
    ...createTopicCardFromSourcedDraft(row, id),
    createdAt: approvedAt,
  };
}

function readStoredRows(): StoredSourcedDraft[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const rows = JSON.parse(raw) as StoredSourcedDraft[];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}
