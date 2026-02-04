-- Migrate existing pending_ppoints to pending_xpoints
-- ppoint_amount was already the X point amount (PV * 50%)
-- Calculate PV from ppoint_amount (pv_amount = ppoint_amount * 2)

INSERT INTO pending_xpoints (id, user_id, order_id, xpoint_amount, pv_amount, scheduled_release_date, status, created_at)
SELECT
    id,
    user_id,
    order_id,
    ppoint_amount,  -- This becomes xpoint_amount (already PV * 50%)
    ppoint_amount * 2,  -- pv_amount = xpoint * 2 (reverse calculation)
    scheduled_release_date,
    status,
    created_at
FROM pending_ppoints
WHERE status = 'pending'
ON CONFLICT (id) DO NOTHING;

-- Mark existing pending P-points as cancelled (they are now in pending_xpoints)
UPDATE pending_ppoints SET status = 'cancelled' WHERE status = 'pending';
