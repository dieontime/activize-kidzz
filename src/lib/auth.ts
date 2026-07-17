import type { Profile, SignupArgs } from "@/services/mockBackend";
import { backend } from "@/services/backend";
import { useAuthStore } from "@/store/authStore";
import { addKnownProfile } from "@/lib/knownProfiles";
import { loadProgress } from "@/lib/progress";

export type { Profile, SignupArgs };

export async function signup(args: SignupArgs): Promise<{ profile: Profile; recoveryCode: string }> {
  const { profile, token, recoveryCode } = await backend.signup(args);
  useAuthStore.getState().login(token, profile);
  addKnownProfile({ profileId: profile.id, username: profile.username, avatar: profile.avatar });
  await loadProgress(profile.id);
  return { profile, recoveryCode };
}

export async function login(username: string, pin: string[]): Promise<Profile> {
  const { profile, token } = await backend.login(username, pin);
  useAuthStore.getState().login(token, profile);
  addKnownProfile({ profileId: profile.id, username: profile.username, avatar: profile.avatar });
  await loadProgress(profile.id);
  return profile;
}

export async function recoverPin(
  username: string,
  recoveryCode: string,
  newPin: string[],
): Promise<{ recoveryCode: string }> {
  return backend.recoverPin(username, recoveryCode, newPin);
}

export async function checkUsernameAvailable(username: string): Promise<boolean> {
  return backend.checkUsernameAvailable(username);
}
