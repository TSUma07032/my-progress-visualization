-- Supabase Schema for Progress Tracker App (V2 - 4 Levels)

-- Note: To allow public access for testing/development (not recommended for production):
-- ALTER TABLE public.projects DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.phases DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.deliverables DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.tasks DISABLE ROW LEVEL SECURITY;

-- 1. Level 1: Projects (Webサイトリニューアル)
CREATE TABLE public.projects (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Level 2: Phases / Major Deliverables (要件定義, デザイン, システム開発)
CREATE TABLE public.phases (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    summary TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Level 3: Deliverables / Mid-level items (トップページデザイン, 問い合わせフォーム開発)
CREATE TABLE public.deliverables (
    id TEXT PRIMARY KEY,
    phase_id TEXT NOT NULL REFERENCES public.phases(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    summary TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Level 4: Tasks / Work packages / Progress items (HTML/CSSコーディング, 入力バリデーション実装)
CREATE TABLE public.tasks (
    id TEXT PRIMARY KEY,
    deliverable_id TEXT NOT NULL REFERENCES public.deliverables(id) ON DELETE CASCADE,
    title TEXT NOT NULL, -- Short description or current progress text
    content TEXT, -- Detail description or TODOs
    status TEXT DEFAULT 'todo', -- todo, in_progress, done
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

