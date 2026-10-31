/** Supabase project ko URL ra anon (public) key. `.env.local` ma halne (.env.example herne). */
export const MP_URL: string = import.meta.env.VITE_SUPABASE_URL ?? '';
export const MP_KEY: string = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';
export const mpEnabled = /^https:\/\/.+/.test(MP_URL) && MP_KEY.length > 20;
