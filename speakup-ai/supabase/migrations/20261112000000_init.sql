-- SpeakUp AI — initial schema (PostgreSQL / Supabase)
-- Users live in auth.users (managed by Supabase Auth). Every user-owned table
-- references auth.users(id) ON DELETE CASCADE so deleting an account removes all data.
-- Row Level Security is enabled on every table.

-- gen_random_uuid() is built into PostgreSQL 13+ (Supabase), no extension needed.

-- ───────────────────────── helpers ─────────────────────────
create or replace function public.is_admin(uid uuid default auth.uid())
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  return exists (select 1 from public.user_profiles where id = uid and role = 'admin');
end; $$;

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

-- ───────────────────────── profiles & preferences ─────────────────────────
create table public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (char_length(display_name) <= 60),
  level text not null default 'beginner' check (level in ('beginner','elementary','intermediate','upper-intermediate','advanced')),
  first_language text check (char_length(first_language) <= 40),
  goal text check (char_length(goal) <= 120),
  xp integer not null default 0 check (xp >= 0),
  referral_code text unique check (referral_code ~ '^[A-Z0-9]{4,12}$'),
  onboarded boolean not null default false,
  role text not null default 'user' check (role in ('user','admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger user_profiles_touch before update on public.user_profiles for each row execute function public.touch_updated_at();

-- Learners must never be able to make themselves admin (enforced by trigger; RLS alone cannot restrict a column).
create or replace function public.protect_role() returns trigger language plpgsql as $$
begin
  if new.role is distinct from old.role and current_user in ('authenticated', 'anon') then
    raise exception 'role can only be changed by an administrator';
  end if;
  return new;
end; $$;
create trigger user_profiles_protect_role before update on public.user_profiles for each row execute function public.protect_role();

create table public.learning_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  daily_minutes smallint not null default 15 check (daily_minutes between 1 and 240),
  wants_ielts boolean not null default false,
  ielts_module text not null default 'academic' check (ielts_module in ('academic','general')),
  target_band numeric(2,1) check (target_band between 1 and 9),
  preparing_interviews boolean not null default false,
  difficulty text check (char_length(difficulty) <= 120),
  explain_lang text not null default 'en' check (explain_lang in ('en','hi','both')),
  updated_at timestamptz not null default now()
);

create table public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme text not null default 'system' check (theme in ('light','dark','system')),
  ai_enabled boolean not null default false,
  ai_consent boolean not null default false,
  speech_rate numeric(3,2) not null default 1 check (speech_rate between 0.5 and 2),
  recognition_lang text not null default 'en-IN',
  keep_recordings boolean not null default false,   -- local playback only; audio is never uploaded
  leaderboard_opt_in boolean not null default false,
  updated_at timestamptz not null default now()
);
-- NOTE: users' own AI API keys are intentionally NOT stored in the database.

create table public.ielts_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  module text not null default 'academic' check (module in ('academic','general')),
  target_band numeric(2,1) check (target_band between 1 and 9),
  exam_date date,
  updated_at timestamptz not null default now()
);

-- Create a profile row automatically when someone signs up.
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_profiles (id, display_name) values (new.id, split_part(coalesce(new.email, 'learner'), '@', 1)) on conflict do nothing;
  insert into public.user_settings (user_id) values (new.id) on conflict do nothing;
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ───────────────────────── curriculum & content (admin-managed) ─────────────────────────
create table public.daily_lessons (
  id uuid primary key default gen_random_uuid(),
  day smallint not null unique check (day between 1 and 30),
  title text not null, objective text not null, task text not null,
  lesson text[] not null default '{}', keywords text[] not null default '{}',
  min_seconds smallint not null default 45,
  published boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.vocabulary (
  id uuid primary key default gen_random_uuid(),
  word text not null, category text not null check (category in ('daily','office','interview','ielts','professional','travel','business')),
  meaning text not null, pronunciation text, example text,
  synonyms text[] not null default '{}', antonyms text[] not null default '{}', usage text, hindi text,
  published boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index vocabulary_category_idx on public.vocabulary (category) where published;

create table public.interview_questions (
  id uuid primary key default gen_random_uuid(),
  category text not null, question text not null, keywords text[] not null default '{}',
  tip text, sample_answer text, behavioural boolean not null default false,
  published boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index interview_questions_category_idx on public.interview_questions (category) where published;

create table public.ielts_questions (
  id uuid primary key default gen_random_uuid(),
  module text not null check (module in ('speaking','writing','reading','listening')),
  variant text not null default 'both' check (variant in ('academic','general','both')),
  title text not null, content jsonb not null default '{}',
  published boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index ielts_questions_module_idx on public.ielts_questions (module) where published;

-- ───────────────────────── learner activity ─────────────────────────
create table public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_key text not null, day smallint,
  score smallint check (score between 0 and 100),
  completed_at timestamptz not null default now(),
  transcript text check (char_length(transcript) <= 5000),
  details jsonb not null default '{}',
  unique (user_id, lesson_key)
);

create table public.speaking_sessions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  module text not null, prompt text, transcript text check (char_length(transcript) <= 5000),
  input text not null check (input in ('voice','text')),
  duration_sec integer not null default 0,
  overall smallint, grammar smallint, fluency smallint, vocabulary smallint, pronunciation smallint, relevance smallint, wpm smallint
);
create index speaking_sessions_user_idx on public.speaking_sessions (user_id, created_at desc);

create table public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.speaking_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('teacher','learner')),
  content text not null check (char_length(content) <= 5000),
  source text check (source in ('free','ai')),
  created_at timestamptz not null default now()
);
create index conversation_messages_session_idx on public.conversation_messages (session_id, created_at);

create table public.grammar_mistakes (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  original text not null, corrected text not null, category text not null, reason text,
  revised boolean not null default false, attempts integer not null default 0,
  created_at timestamptz not null default now()
);
create index grammar_mistakes_user_idx on public.grammar_mistakes (user_id, revised);

create table public.saved_vocabulary (
  user_id uuid not null references auth.users(id) on delete cascade,
  word_id text not null,
  box smallint not null default 0 check (box between 0 and 5),
  due date not null default current_date,
  correct integer not null default 0, wrong integer not null default 0,
  learned boolean not null default false,
  saved_at timestamptz not null default now(),
  primary key (user_id, word_id)
);
create index saved_vocabulary_due_idx on public.saved_vocabulary (user_id, due);

create table public.daily_scores (
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  score smallint check (score between 0 and 100),
  minutes numeric(7,2) not null default 0,
  sessions integer not null default 0,
  xp integer not null default 0,
  primary key (user_id, date)
);
create index daily_scores_date_idx on public.daily_scores (date);

create table public.weekly_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  xp integer not null default 0, minutes numeric(8,2) not null default 0, sessions integer not null default 0,
  primary key (user_id, week_start)
);

create table public.english_streaks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  current_streak integer not null default 0, longest_streak integer not null default 0,
  last_active date
);

create table public.ielts_attempts (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  module text not null check (module in ('listening','reading','writing','speaking')),
  variant text not null check (variant in ('academic','general')),
  test_id text not null, raw smallint, total smallint,
  band numeric(2,1) not null check (band between 0 and 9),
  details jsonb not null default '{}', mock boolean not null default false
);
create index ielts_attempts_user_idx on public.ielts_attempts (user_id, module, created_at desc);

create table public.ielts_scores (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.ielts_attempts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  criterion text not null,   -- e.g. 'task','coherence','lexical','grammar','fluency','pronunciation'
  band numeric(2,1) not null check (band between 0 and 9)
);

create table public.ielts_mock_tests (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  variant text not null check (variant in ('academic','general')),
  listening numeric(2,1), reading numeric(2,1), writing numeric(2,1), speaking numeric(2,1), overall numeric(2,1)
);

create table public.interview_sessions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  category text not null, total smallint not null check (total between 0 and 100),
  answers jsonb not null default '[]'
);
create index interview_sessions_user_idx on public.interview_sessions (user_id, created_at desc);

create table public.interview_reports (
  session_id uuid primary key references public.interview_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  total smallint not null, breakdown jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table public.achievements (
  user_id uuid not null references auth.users(id) on delete cascade,
  achievement_id text not null,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

create table public.leaderboard_entries (
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  display_name text not null check (char_length(display_name) <= 40),
  xp integer not null default 0, streak integer not null default 0,
  primary key (user_id, week_start)
);
create index leaderboard_week_idx on public.leaderboard_entries (week_start, xp desc);

create table public.referrals (
  referred_user_id uuid primary key references auth.users(id) on delete cascade,
  referrer_code text not null check (referrer_code ~ '^[A-Za-z0-9]{4,12}$'),
  created_at timestamptz not null default now()
);
create index referrals_code_idx on public.referrals (referrer_code);

-- ───────────────────────── operations ─────────────────────────
create table public.ai_usage_logs (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  task text not null, provider text not null, model text not null,
  input_tokens integer not null default 0, output_tokens integer not null default 0,
  est_cost_usd numeric(12,6) not null default 0,
  user_key boolean not null default false     -- request used the learner's own key
);
create index ai_usage_logs_user_day_idx on public.ai_usage_logs (user_id, created_at);
create index ai_usage_logs_day_idx on public.ai_usage_logs (created_at);

create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.app_settings (key, value) values ('global', '{"ai_enabled": true, "ai_daily_limit_guest": 10, "ai_daily_limit_user": 30, "ai_global_daily_limit": 2000, "features": {"speak": true, "grammar": true, "challenge": true, "ielts": true, "interview": true, "vocabulary": true, "community": true}}') on conflict do nothing;

create table public.app_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  message text not null check (char_length(message) between 3 and 2000),
  rating smallint check (rating between 1 and 5),
  page text,
  status text not null default 'new' check (status in ('new','reviewed','resolved'))
);

-- ───────────────────────── Row Level Security ─────────────────────────
do $$
declare t text;
begin
  -- Tables owned by a single user via user_id: owner has full access.
  foreach t in array array[
    'learning_preferences','user_settings','ielts_profiles','lesson_progress','speaking_sessions','conversation_messages',
    'grammar_mistakes','saved_vocabulary','daily_scores','weekly_progress','english_streaks','ielts_attempts','ielts_scores',
    'ielts_mock_tests','interview_sessions','interview_reports','achievements','leaderboard_entries'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "%1$s_owner_select" on public.%1$I for select to authenticated using (user_id = auth.uid())', t);
    execute format('create policy "%1$s_owner_insert" on public.%1$I for insert to authenticated with check (user_id = auth.uid())', t);
    execute format('create policy "%1$s_owner_update" on public.%1$I for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
    execute format('create policy "%1$s_owner_delete" on public.%1$I for delete to authenticated using (user_id = auth.uid())', t);
  end loop;
end $$;

alter table public.user_profiles enable row level security;
create policy "profiles_self_select" on public.user_profiles for select to authenticated using (id = auth.uid() or public.is_admin());
create policy "profiles_self_insert" on public.user_profiles for insert to authenticated with check (id = auth.uid() and role = 'user');
create policy "profiles_self_update" on public.user_profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Referrals: a user may record who referred them (once); reads go through the server.
alter table public.referrals enable row level security;
create policy "referrals_self_insert" on public.referrals for insert to authenticated with check (referred_user_id = auth.uid());
create policy "referrals_self_select" on public.referrals for select to authenticated using (referred_user_id = auth.uid());

-- Published content is public; only admins write (the app writes via the service role after a server-side admin check).
do $$
declare t text;
begin
  foreach t in array array['daily_lessons','vocabulary','interview_questions','ielts_questions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "%1$s_public_read" on public.%1$I for select to anon, authenticated using (published or public.is_admin())', t);
    execute format('create policy "%1$s_admin_write" on public.%1$I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- Operational tables: no direct client access (server uses the service role).
alter table public.ai_usage_logs enable row level security;
create policy "ai_usage_admin_read" on public.ai_usage_logs for select to authenticated using (public.is_admin());
alter table public.app_settings enable row level security;
create policy "app_settings_admin_all" on public.app_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());
alter table public.app_feedback enable row level security;
create policy "feedback_admin_all" on public.app_feedback for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Leaderboard entries exist only for learners who opted in; the public list is served by /api/leaderboard
-- (display name, XP and streak only). Owners manage their own row via the generic policies above.
