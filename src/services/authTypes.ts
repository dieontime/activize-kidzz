export interface Profile {
  id: string;
  username: string;
  avatar: string;
  age_band: "3-5" | "6-8";
}

export interface SignupArgs {
  username: string;
  pin: string[];
  avatar: string;
  age_band: "3-5" | "6-8";
}

export interface SignupResult {
  profile: Profile;
  token: string;
  recoveryCode: string;
}

export interface LoginResult {
  profile: Profile;
  token: string;
}
