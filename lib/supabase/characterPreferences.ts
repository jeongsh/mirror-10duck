import { supabase } from "@/lib/supabase/client";

type GenericMetadata = Record<string, unknown>;

const PREFERRED_CHARACTER_ID_STORAGE_KEY = "10duck:preferred-character-id";
const LIVE2D_ENABLED_STORAGE_KEY = "10duck:live2d-enabled";

function toMetadata(value: unknown): GenericMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as GenericMetadata;
}

function toTrackingMap(value: unknown): Record<string, boolean> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, boolean> = {};
  for (const [key, mapValue] of Object.entries(value as Record<string, unknown>)) {
    if (typeof mapValue === "boolean") out[key] = mapValue;
  }
  return out;
}

function savePreferredCharacterIdLocally(characterId: string | null): void {
  if (typeof window === "undefined") return;
  if (characterId) {
    window.localStorage.setItem(PREFERRED_CHARACTER_ID_STORAGE_KEY, characterId);
  } else {
    window.localStorage.removeItem(PREFERRED_CHARACTER_ID_STORAGE_KEY);
  }
}

function saveLive2DEnabledLocally(enabled: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LIVE2D_ENABLED_STORAGE_KEY, enabled ? "1" : "0");
}

export function getPreferredCharacterId(userMetadata: unknown): string | undefined {
  const metadata = toMetadata(userMetadata);
  if (typeof metadata.activeCharacterId === "string") {
    return metadata.activeCharacterId;
  }
  if (typeof window === "undefined") return undefined;
  return window.localStorage.getItem(PREFERRED_CHARACTER_ID_STORAGE_KEY) ?? undefined;
}

let authMutationQueue: Promise<void> = Promise.resolve();

function isLockBrokenError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("Lock broken");
}

async function runQueuedAuthMutation(task: () => Promise<void>): Promise<void> {
  const run = authMutationQueue.then(async () => {
    try {
      await task();
    } catch (error) {
      if (!isLockBrokenError(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 200));
      await task();
    }
  });
  authMutationQueue = run.catch(() => {});
  return run;
}

export async function savePreferredCharacter(characterId: string | null): Promise<void> {
  savePreferredCharacterIdLocally(characterId);
  await runQueuedAuthMutation(async () => {
    const { data, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!data.user) return;
    const metadata = toMetadata(data.user.user_metadata);
    const { error } = await supabase.auth.updateUser({
      data: {
        ...metadata,
        activeCharacterId: characterId,
      },
    });
    if (error) throw error;
  });
}

export function getLive2DEnabledPreference(userMetadata: unknown, fallback = true): boolean {
  const metadata = toMetadata(userMetadata);
  if (typeof metadata.live2dEnabled === "boolean") {
    return metadata.live2dEnabled;
  }

  if (typeof window === "undefined") return fallback;
  const stored = window.localStorage.getItem(LIVE2D_ENABLED_STORAGE_KEY);
  if (stored === "1") return true;
  if (stored === "0") return false;
  return fallback;
}

export async function saveLive2DEnabledPreference(enabled: boolean): Promise<void> {
  saveLive2DEnabledLocally(enabled);
  await runQueuedAuthMutation(async () => {
    const { data, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!data.user) return;
    const metadata = toMetadata(data.user.user_metadata);
    const { error } = await supabase.auth.updateUser({
      data: {
        ...metadata,
        live2dEnabled: enabled,
      },
    });
    if (error) throw error;
  });
}

export function getTrackingPreference(
  userMetadata: unknown,
  characterId: string,
  fallback = true
): boolean {
  const metadata = toMetadata(userMetadata);
  const trackingById = toTrackingMap(metadata.characterTrackingById);
  return trackingById[characterId] ?? fallback;
}

export async function saveTrackingPreference(characterId: string, tracking: boolean): Promise<void> {
  await runQueuedAuthMutation(async () => {
    const { data, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!data.user) return;
    const metadata = toMetadata(data.user.user_metadata);
    const trackingById = toTrackingMap(metadata.characterTrackingById);
    const { error } = await supabase.auth.updateUser({
      data: {
        ...metadata,
        characterTrackingById: {
          ...trackingById,
          [characterId]: tracking,
        },
      },
    });
    if (error) throw error;
  });
}
