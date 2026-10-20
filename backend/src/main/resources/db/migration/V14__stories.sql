CREATE TABLE stories (
    id UUID PRIMARY KEY,
    title VARCHAR(80) NOT NULL,
    text VARCHAR(1000) NOT NULL,
    author_id UUID NOT NULL REFERENCES users(id),
    has_image BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    CHECK (expires_at = created_at + INTERVAL '24' HOUR)
);
CREATE INDEX stories_active ON stories(deleted_at, expires_at, created_at);
-- Media is separate so listing stories never loads all binary images.
CREATE TABLE story_images (
    id UUID PRIMARY KEY REFERENCES stories(id) ON DELETE CASCADE,
    bytes BYTEA NOT NULL,
    content_type VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    version BIGINT NOT NULL DEFAULT 0
);
CREATE TABLE story_views (
    id UUID PRIMARY KEY,
    story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    UNIQUE (story_id, user_id)
);
CREATE INDEX story_views_user ON story_views(user_id, story_id);
