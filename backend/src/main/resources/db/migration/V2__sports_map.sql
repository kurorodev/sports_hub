CREATE TABLE sport_venues (
    id UUID PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    normalized_name VARCHAR(120) NOT NULL,
    sport_id UUID REFERENCES sports(id),
    city VARCHAR(120) NOT NULL,
    address VARCHAR(300) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
    longitude DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    version BIGINT NOT NULL DEFAULT 0
);
CREATE INDEX idx_venues_bbox ON sport_venues(latitude, longitude);
CREATE INDEX idx_venues_name ON sport_venues(normalized_name);
CREATE INDEX idx_venues_creator ON sport_venues(created_by, created_at);
CREATE INDEX idx_events_bbox ON events(latitude, longitude, starts_at);
CREATE TABLE venue_occupancy_reports (
    id UUID PRIMARY KEY,
    venue_id UUID NOT NULL REFERENCES sport_venues(id),
    user_id UUID NOT NULL REFERENCES users(id),
    level VARCHAR(10) NOT NULL CHECK (level IN ('LOW','MEDIUM','HIGH')),
    people_count INTEGER CHECK (people_count BETWEEN 0 AND 1000),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    version BIGINT NOT NULL DEFAULT 0
);
CREATE INDEX idx_reports_time ON venue_occupancy_reports(venue_id, created_at DESC);
CREATE INDEX idx_reports_user_time ON venue_occupancy_reports(venue_id, user_id, created_at DESC);
