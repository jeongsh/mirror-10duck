import type { CharacterProfile } from "@/types/character";
import { withRecommendedScenarioMap } from "@/types/character";
import { PICHU_PROFILE, MAO_PRO_PROFILE } from "./defaultProfile";

export const BASE_PROFILES: CharacterProfile[] = [PICHU_PROFILE, MAO_PRO_PROFILE];

export const resolvePreferredProfile = (
  allProfiles: CharacterProfile[],
  preferredId?: string
) =>
  allProfiles.find((p) => p.id === preferredId) ??
  allProfiles.find((p) => p.id === PICHU_PROFILE.id) ??
  null;

export const mergeProfiles = (
  defaults: CharacterProfile[],
  savedProfiles: CharacterProfile[]
): CharacterProfile[] => {
  const byId = new Map<string, CharacterProfile>();
  for (const p of defaults) byId.set(p.id, withRecommendedScenarioMap(p));
  for (const p of savedProfiles) byId.set(p.id, withRecommendedScenarioMap(p));
  return Array.from(byId.values()).sort((a, b) => b.createdAt - a.createdAt);
};
