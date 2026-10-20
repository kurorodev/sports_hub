ALTER TABLE users ADD COLUMN recommendation_age integer CHECK (recommendation_age BETWEEN 1 AND 120);
ALTER TABLE events ADD COLUMN recommended_min_age integer CHECK (recommended_min_age BETWEEN 1 AND 120);
ALTER TABLE events ADD COLUMN recommended_max_age integer CHECK (recommended_max_age BETWEEN 1 AND 120);
ALTER TABLE events ADD CONSTRAINT events_recommended_age_order CHECK (recommended_min_age IS NULL OR recommended_max_age IS NULL OR recommended_min_age <= recommended_max_age);
