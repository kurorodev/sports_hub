-- Retired roles are removed without changing profiles or historical event records.
DELETE FROM user_sport_roles WHERE sports_role IN ('COACH', 'REFEREE');
