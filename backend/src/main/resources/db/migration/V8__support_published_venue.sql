ALTER TABLE support_tickets ADD COLUMN published_venue_id UUID REFERENCES sport_venues(id);
ALTER TABLE support_tickets ADD CONSTRAINT support_published_venue_unique UNIQUE (published_venue_id);
