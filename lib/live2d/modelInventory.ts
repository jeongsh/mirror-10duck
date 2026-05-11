import type { MotionRef } from "@/types/character";

export interface Live2DModelInventory {
  expressions: string[];
  motions: MotionRef[];
  hitAreas: string[];
}

interface Model3Json {
  FileReferences?: {
    Expressions?: { Name?: string; File?: string }[];
    Motions?: Record<string, { File?: string }[]>;
  };
  HitAreas?: { Id?: string; Name?: string }[];
}

export async function loadLive2DModelInventory(modelPath: string): Promise<Live2DModelInventory> {
  const res = await fetch(modelPath);
  if (!res.ok) {
    throw new Error(`model3.json 을 읽지 못했습니다. (${res.status})`);
  }

  const model3 = (await res.json()) as Model3Json;
  const expressions = Array.from(
    new Set(
      (model3.FileReferences?.Expressions ?? [])
        .map((expression) => expression.Name || expression.File)
        .filter((value): value is string => Boolean(value))
    )
  );

  const motions: MotionRef[] = [];
  for (const [group, entries] of Object.entries(model3.FileReferences?.Motions ?? {})) {
    entries.forEach((_, index) => {
      motions.push({ group, index });
    });
  }

  const hitAreas = Array.from(
    new Set(
      (model3.HitAreas ?? [])
        .map((hitArea) => hitArea.Id || hitArea.Name)
        .filter((value): value is string => Boolean(value))
    )
  );

  return { expressions, motions, hitAreas };
}
