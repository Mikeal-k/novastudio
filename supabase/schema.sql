-- ============================================================================
-- Nova Studio — Database Schema
-- Run this in Supabase SQL Editor.
-- ============================================================================

-- ─── 1. Profiles ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  credits integer NOT NULL DEFAULT 30,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ─── 2. Credit Transactions ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  amount integer NOT NULL,
  balance_after integer NOT NULL,
  description text,
  generation_id uuid,
  created_at timestamptz DEFAULT now()
);

-- ─── 3. Generations ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  model text NOT NULL,
  prompt text NOT NULL,
  output_type text NOT NULL,
  status text NOT NULL,
  cost integer NOT NULL,
  task_id text,
  video_url text,
  cover_url text,
  error text,
  settings jsonb DEFAULT '{}'::jsonb,
  charged_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ─── 4. Auto-create profile on signup ───────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  -- Insert profile with 30 free credits
  INSERT INTO public.profiles (id, email, credits)
  VALUES (NEW.id, NEW.email, 30);

  -- Record the signup bonus transaction
  INSERT INTO public.credit_transactions (user_id, type, amount, balance_after, description)
  VALUES (NEW.id, 'signup_bonus', 30, 30, '新用户注册赠送积分');

  RETURN NEW;
END;
$$;

-- Trigger: after a new user signs up via Supabase Auth
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ─── 5. Row-Level Security ──────────────────────────────────────────────────

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generations ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read their own profile
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Credit transactions: users can read their own transactions
DROP POLICY IF EXISTS "Users can read own transactions" ON public.credit_transactions;
CREATE POLICY "Users can read own transactions"
  ON public.credit_transactions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Generations: users can read their own generations
DROP POLICY IF EXISTS "Users can read own generations" ON public.generations;
CREATE POLICY "Users can read own generations"
  ON public.generations
  FOR SELECT
  USING (auth.uid() = user_id);

-- ─── 6. Recharge Orders ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.recharge_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  package_name text NOT NULL,
  amount_yuan numeric NOT NULL,
  credits integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  contact_note text,
  admin_note text,
  payment_proof_url text,
  payment_proof_uploaded_at timestamptz,
  payer_note text,
  created_at timestamptz DEFAULT now(),
  paid_at timestamptz
);

COMMENT ON TABLE public.recharge_orders IS '人工充值订单，由管理员确认后加积分';
COMMENT ON COLUMN public.recharge_orders.status IS 'pending / paid / canceled';

ALTER TABLE public.recharge_orders ENABLE ROW LEVEL SECURITY;

-- Users can read their own recharge orders
DROP POLICY IF EXISTS "Users can read own recharge orders" ON public.recharge_orders;
CREATE POLICY "Users can read own recharge orders"
  ON public.recharge_orders
  FOR SELECT
  USING (auth.uid() = user_id);

-- ─── 7. Indexes ─────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON public.credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_generations_user_id ON public.generations(user_id);
CREATE INDEX IF NOT EXISTS idx_generations_task_id ON public.generations(task_id);
CREATE INDEX IF NOT EXISTS idx_generations_created_at ON public.generations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recharge_orders_user_id ON public.recharge_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_recharge_orders_status ON public.recharge_orders(status);

-- ─── 8. Migration: Add payment proof columns (safe for existing tables) ─────

ALTER TABLE public.recharge_orders
ADD COLUMN IF NOT EXISTS payment_proof_url text;

ALTER TABLE public.recharge_orders
ADD COLUMN IF NOT EXISTS payment_proof_uploaded_at timestamptz;

ALTER TABLE public.recharge_orders
ADD COLUMN IF NOT EXISTS payer_note text;

-- ─── 9. Public Generations Sharing & Likes ─────────────────────────────

ALTER TABLE public.generations
ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT false;

ALTER TABLE public.generations
ADD COLUMN IF NOT EXISTS public_title text;

ALTER TABLE public.generations
ADD COLUMN IF NOT EXISTS public_description text;

ALTER TABLE public.generations
ADD COLUMN IF NOT EXISTS public_category text;

ALTER TABLE public.generations
ADD COLUMN IF NOT EXISTS published_at timestamptz;

ALTER TABLE public.generations
ADD COLUMN IF NOT EXISTS likes_count integer DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.generation_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_id uuid NOT NULL REFERENCES public.generations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(generation_id, user_id)
);

ALTER TABLE public.generation_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read generation likes" ON public.generation_likes;
CREATE POLICY "Anyone can read generation likes"
  ON public.generation_likes
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can like as themselves" ON public.generation_likes;
CREATE POLICY "Users can like as themselves"
  ON public.generation_likes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can unlike own likes" ON public.generation_likes;
CREATE POLICY "Users can unlike own likes"
  ON public.generation_likes
  FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can read public generations" ON public.generations;
CREATE POLICY "Anyone can read public generations"
  ON public.generations
  FOR SELECT
  USING (is_public = true OR auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_generations_public_published
  ON public.generations(is_public, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_generation_likes_generation_id
  ON public.generation_likes(generation_id);

