-- Supabase Schema for Progress Tracker App

-- 1. Projects Table
CREATE TABLE public.projects (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Nodes Table
CREATE TABLE public.nodes (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    parent_id TEXT REFERENCES public.nodes(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Logs Table
CREATE TABLE public.logs (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    node_id TEXT NOT NULL REFERENCES public.nodes(id) ON DELETE CASCADE,
    raw_memo TEXT NOT NULL,
    situation TEXT NOT NULL,
    task TEXT NOT NULL,
    action TEXT NOT NULL,
    result TEXT NOT NULL,
    question TEXT,
    next_todo TEXT,
    talked BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Note: In Supabase, if you want anyone to be able to read/write without authentication for testing,
-- you may need to disable Row Level Security (RLS) on these tables or write open policies.
-- By default, inserting via anon key might fail if RLS is enabled without policies.
-- To allow public access (for testing/development):
-- ALTER TABLE public.projects DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.nodes DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.logs DISABLE ROW LEVEL SECURITY;
