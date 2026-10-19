ALTER TABLE support_tickets ADD COLUMN venue_latitude DOUBLE PRECISION;
ALTER TABLE support_tickets ADD COLUMN venue_longitude DOUBLE PRECISION;
ALTER TABLE support_tickets ADD CONSTRAINT support_venue_point CHECK (
    (venue_latitude IS NULL AND venue_longitude IS NULL) OR
    (category = 'VENUE_SUGGESTION' AND venue_latitude IS NOT NULL AND venue_longitude IS NOT NULL
     AND venue_latitude BETWEEN -90 AND 90 AND venue_longitude BETWEEN -180 AND 180)
);
