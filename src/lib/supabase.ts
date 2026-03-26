import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || "https://hcpkwudltyglfmzxgiyt.supabase.co";
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjcGt3dWRsdHlnbGZtenhnaXl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4Mjk4MTUsImV4cCI6MjA4NzQwNTgxNX0.km3GFWVs5V_IRrz6oL6kWnsdo1HAYWEPgzg1mBk3UVc";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
