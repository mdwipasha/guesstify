/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly SPOTIFY_CLIENT_ID?: string;
  readonly SPOTIFY_CLIENT_SECRET?: string;
  readonly SPOTIFY_REDIRECT_URI?: string;
  readonly SESSION_SECRET?: string;
  readonly SUPABASE_URL?: string;
  readonly SUPABASE_PUBLISHABLE_KEY?: string;
  readonly SUPABASE_SECRET_KEY?: string;
  readonly PUBLIC_SUPABASE_URL?: string;
  readonly PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
