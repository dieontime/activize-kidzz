import type { Profile, SignupArgs } from "@/services/mockBackend";
import { backend } from "@/services/backend";
import { useAuthStore } from "@/store/authStore";

export type { Profile, SignupArgs };

export async function signup(args: SignupArgs): Promise<{ profile: Profile; recoveryCode: string }> {
  const { profile, token, recoveryCode } = await backend.signup(args);
  useAuthStore.getState().login(token, profile);
  return { profile, recoveryCode };
}

export async function login(username: string, pin: string[]): Promise<Profile> {
  const { profile, token } = await backend.login(username, pin);
  useAuthStore.getState().login(token, profile);
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
