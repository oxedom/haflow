-- Recreate demo user as superadmin (id/user_id will be auto-assigned; user_id is synced by trigger)
-- Safe to run repeatedly.

BEGIN;

-- If better-auth verification records exist for this identifier, remove them
DELETE FROM verification
WHERE identifier = 'demo@demo.com';

-- Remove the demo user (FK cascades will handle dependent rows where configured)
DELETE FROM users
WHERE email = 'demo@demo.com';

-- Insert fresh demo user (superadmin + all roles enabled)
INSERT INTO users (
  name,
  "emailVerified",
  image,
  gender,
  first_name,
  last_name,
  phone,
  email,
  birthday,
  is_active,
  is_coach,
  is_trainee,
  is_gym_admin,
  is_super_admin,
  gym_id,
  "createdAt",
  "updatedAt"
)
VALUES (
  'Demo User',
  TRUE,
  NULL,
  'OTHER',
  'DemoU',
  'User',
  NULL,
  'demo@demo.com',
  '1990-01-01',
  TRUE,
  TRUE,
  TRUE,
  TRUE,
  TRUE,
  1,
  NOW(),
  NOW()
);

-- Confirm
SELECT
  id,
  user_id,
  email,
  "emailVerified",
  name,
  is_active,
  is_coach,
  is_trainee,
  is_gym_admin,
  is_super_admin,
  gym_id
FROM users
WHERE email = 'demo@demo.com';

COMMIT;