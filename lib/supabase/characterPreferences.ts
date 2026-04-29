import { supabase } from "@/lib/supabase/client";

type GenericMetadata = Record<string, unknown>;

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
