-- Supabase Schema for WBS Progress Tracker App

-- Drop existing tables if they exist
DROP TABLE IF EXISTS public.todos CASCADE;
DROP TABLE IF EXISTS public.logs CASCADE;
DROP TABLE IF EXISTS public.nodes CASCADE;
DROP TABLE IF EXISTS public.wbs_nodes CASCADE;
DROP TABLE IF EXISTS public.projects CASCADE;

-- 1. Projects Table (Level 1: プロジェクト)
CREATE TABLE public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. WBS Nodes Table (Level 2~4: 階層ノード)
CREATE TABLE public.wbs_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES public.wbs_nodes(id) ON DELETE CASCADE,
    node_level INTEGER NOT NULL,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'not_started',
    order_rank TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Todos Table (Level 3付帯情報: 課題・メモ)
CREATE TABLE public.todos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id UUID NOT NULL REFERENCES public.wbs_nodes(id) ON DELETE CASCADE,
    content TEXT,
    is_completed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS Settings
-- Allow public access for testing/development
ALTER TABLE public.projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.wbs_nodes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.todos DISABLE ROW LEVEL SECURITY;
