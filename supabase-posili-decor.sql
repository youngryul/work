-- 포실이 꾸미기 (MVP: 배경·액자)
-- Supabase SQL Editor에서 실행 (여러 번 실행해도 안전)
-- 아이템 등록·수정은 관리자만, 구매·착용은 SECURITY DEFINER RPC로만 한다.

-- ---------------------------------------------------------------------------
-- 테이블
-- ---------------------------------------------------------------------------

-- 꾸미기 아이템 목록 (관리자 등록)
CREATE TABLE IF NOT EXISTS public.decor_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- background: 포실이 뒤 배경 / frame: 포실이 위에 겹치는 투명 액자
  slot TEXT NOT NULL CHECK (slot IN ('background', 'frame')),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL,
  rarity TEXT NOT NULL DEFAULT 'common' CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
  -- 젤리 가격 (0이면 무료)
  price_jelly INTEGER NOT NULL DEFAULT 0 CHECK (price_jelly >= 0),
  -- false면 판매 종료 (이미 산 사람은 계속 사용 가능)
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS decor_items_slot_sort_idx
  ON public.decor_items (slot, sort_order);

-- 사용자가 가진 아이템
CREATE TABLE IF NOT EXISTS public.user_decor_items (
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.decor_items (id) ON DELETE CASCADE,
  -- jelly: 젤리 구매 / free: 무료 / event·subscription: 이후 지급 경로용
  acquired_via TEXT NOT NULL DEFAULT 'jelly',
  jelly_spent INTEGER NOT NULL DEFAULT 0,
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, item_id)
);

-- 부위별 착용 상태 (부위당 1개)
CREATE TABLE IF NOT EXISTS public.user_posili_loadout (
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  slot TEXT NOT NULL CHECK (slot IN ('background', 'frame')),
  item_id UUID NOT NULL REFERENCES public.decor_items (id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, slot)
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.decor_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_decor_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_posili_loadout ENABLE ROW LEVEL SECURITY;

-- 판매 중인 아이템 + 내가 가진 아이템(판매 종료 포함)은 보인다. 관리자는 전부.
DROP POLICY IF EXISTS decor_items_select ON public.decor_items;
CREATE POLICY decor_items_select ON public.decor_items
  FOR SELECT TO authenticated
  USING (
    is_active
    OR is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.user_decor_items u
      WHERE u.item_id = decor_items.id AND u.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS decor_items_admin_insert ON public.decor_items;
CREATE POLICY decor_items_admin_insert ON public.decor_items
  FOR INSERT TO authenticated
  WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS decor_items_admin_update ON public.decor_items;
CREATE POLICY decor_items_admin_update ON public.decor_items
  FOR UPDATE TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS decor_items_admin_delete ON public.decor_items;
CREATE POLICY decor_items_admin_delete ON public.decor_items
  FOR DELETE TO authenticated
  USING (is_admin(auth.uid()));

DROP POLICY IF EXISTS user_decor_items_select_own ON public.user_decor_items;
CREATE POLICY user_decor_items_select_own ON public.user_decor_items
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS user_posili_loadout_select_own ON public.user_posili_loadout;
CREATE POLICY user_posili_loadout_select_own ON public.user_posili_loadout
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- RPC: 아이템 구매
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.purchase_decor_item(p_item_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_item decor_items%ROWTYPE;
  v_balance INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  SELECT * INTO v_item FROM decor_items WHERE id = p_item_id;

  IF v_item.id IS NULL OR NOT v_item.is_active THEN
    RAISE EXCEPTION '지금은 살 수 없는 아이템이에요.';
  END IF;

  -- 보유 기록을 먼저 넣어서 동시에 두 번 눌러도 한 번만 결제되게 한다
  INSERT INTO user_decor_items (user_id, item_id, acquired_via, jelly_spent)
  VALUES (
    v_user_id,
    v_item.id,
    CASE WHEN v_item.price_jelly > 0 THEN 'jelly' ELSE 'free' END,
    v_item.price_jelly
  )
  ON CONFLICT (user_id, item_id) DO NOTHING;

  IF NOT FOUND THEN
    RAISE EXCEPTION '이미 가지고 있는 아이템이에요.';
  END IF;

  IF v_item.price_jelly > 0 THEN
    UPDATE user_jelly
    SET balance = balance - v_item.price_jelly,
        updated_at = NOW()
    WHERE user_id = v_user_id AND balance >= v_item.price_jelly
    RETURNING balance INTO v_balance;

    -- 예외가 나면 위의 보유 기록 INSERT도 함께 취소된다
    IF NOT FOUND THEN
      RAISE EXCEPTION '젤리가 부족해요. 젤리 %개가 필요해요.', v_item.price_jelly;
    END IF;
  ELSE
    SELECT balance INTO v_balance FROM user_jelly WHERE user_id = v_user_id;
  END IF;

  RETURN json_build_object(
    'itemId', v_item.id,
    'slot', v_item.slot,
    'jellySpent', v_item.price_jelly,
    'jellyBalance', COALESCE(v_balance, 0)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: 착용 / 해제 (p_item_id가 NULL이면 해당 부위 해제)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.equip_decor_item(p_slot TEXT, p_item_id UUID DEFAULT NULL)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_item_slot TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  IF p_slot NOT IN ('background', 'frame') THEN
    RAISE EXCEPTION '알 수 없는 꾸미기 부위예요.';
  END IF;

  IF p_item_id IS NULL THEN
    DELETE FROM user_posili_loadout
    WHERE user_id = v_user_id AND slot = p_slot;

    RETURN json_build_object('slot', p_slot, 'itemId', NULL);
  END IF;

  -- 판매 종료된 아이템이라도 가지고 있으면 착용할 수 있다
  SELECT d.slot INTO v_item_slot
  FROM user_decor_items u
  JOIN decor_items d ON d.id = u.item_id
  WHERE u.user_id = v_user_id AND u.item_id = p_item_id;

  IF v_item_slot IS NULL THEN
    RAISE EXCEPTION '가지고 있지 않은 아이템이에요.';
  END IF;

  IF v_item_slot <> p_slot THEN
    RAISE EXCEPTION '이 부위에는 착용할 수 없는 아이템이에요.';
  END IF;

  INSERT INTO user_posili_loadout (user_id, slot, item_id, updated_at)
  VALUES (v_user_id, p_slot, p_item_id, NOW())
  ON CONFLICT (user_id, slot) DO UPDATE SET
    item_id = EXCLUDED.item_id,
    updated_at = NOW();

  RETURN json_build_object('slot', p_slot, 'itemId', p_item_id);
END;
$$;

-- ---------------------------------------------------------------------------
-- 권한
-- ---------------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.purchase_decor_item(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.equip_decor_item(TEXT, UUID) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.purchase_decor_item(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.equip_decor_item(TEXT, UUID) TO authenticated;
