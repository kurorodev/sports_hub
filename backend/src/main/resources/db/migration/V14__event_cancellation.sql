-- Keep owner cancellation distinct from administrative unpublishing.
ALTER TABLE events ADD COLUMN cancelled_at timestamp with time zone;
