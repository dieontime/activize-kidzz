import { mockProgressBackend } from "./mockProgressBackend";
import { supabaseProgressBackend } from "./supabaseProgressBackend";

const HAS_SUPABASE_CONFIG = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY,
);

export const progressBackend = HAS_SUPABASE_CONFIG ? supabaseProgressBackend : mockProgressBackend;
