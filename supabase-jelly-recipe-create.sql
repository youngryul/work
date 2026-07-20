-- 레시피 등록 젤리 지급 사유 추가

ALTER TABLE jelly_rewards_log DROP CONSTRAINT IF EXISTS jelly_rewards_log_reason_check;
ALTER TABLE jelly_rewards_log ADD CONSTRAINT jelly_rewards_log_reason_check
  CHECK (reason IN (
    'task_complete',
    'diary_write',
    'weight_record',
    'weight_goal_reached',
    'farm_refund',
    'five_year_answer',
    'habit_tracker_first_today',
    'recipe_create'
  ));

CREATE OR REPLACE FUNCTION award_jelly(
  p_amount INTEGER,
  p_reason TEXT,
  p_idempotency_key TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_balance INTEGER;
  v_inserted BOOLEAN := false;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION '지급 젤리는 1 이상이어야 합니다.';
  END IF;

  IF p_reason NOT IN (
    'task_complete',
    'diary_write',
    'weight_record',
    'weight_goal_reached',
    'farm_refund',
    'five_year_answer',
    'habit_tracker_first_today',
    'recipe_create'
  ) THEN
    RAISE EXCEPTION '유효하지 않은 지급 사유입니다.';
  END IF;

  IF p_idempotency_key IS NULL OR trim(p_idempotency_key) = '' THEN
    RAISE EXCEPTION 'idempotency_key가 필요합니다.';
  END IF;

  INSERT INTO user_jelly (user_id, balance)
  VALUES (v_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO jelly_rewards_log (user_id, amount, reason, idempotency_key)
  VALUES (v_user_id, p_amount, p_reason, trim(p_idempotency_key))
  ON CONFLICT (user_id, idempotency_key) DO NOTHING
  RETURNING true INTO v_inserted;

  IF NOT COALESCE(v_inserted, false) THEN
    SELECT balance INTO v_balance FROM user_jelly WHERE user_id = v_user_id;
    RETURN json_build_object(
      'balance', COALESCE(v_balance, 0),
      'awarded', 0,
      'alreadyAwarded', true
    );
  END IF;

  UPDATE user_jelly
  SET balance = balance + p_amount,
      updated_at = NOW()
  WHERE user_id = v_user_id
  RETURNING balance INTO v_balance;

  RETURN json_build_object(
    'balance', v_balance,
    'awarded', p_amount,
    'alreadyAwarded', false
  );
END;
$$;
