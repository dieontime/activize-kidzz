export interface KnownProfile {
  profileId: string;
  username: string;
  avatar: string;
}

const KEY = "activize:knownProfiles";

export function getKnownProfiles(): KnownProfile[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as KnownProfile[];
  } catch {
    return [];
  }
}

export function addKnownProfile(profile: KnownProfile): void {
  const others = getKnownProfiles().filter((p) => p.profileId !== profile.profileId);
  window.localStorage.setItem(KEY, JSON.stringify([...others, profile]));
}
