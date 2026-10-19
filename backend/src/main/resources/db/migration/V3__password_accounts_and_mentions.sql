ALTER TABLE users ADD COLUMN password_hash VARCHAR(255);
CREATE TABLE comment_mentions (
    comment_id UUID NOT NULL REFERENCES event_comments(id) ON DELETE CASCADE,
    mention_index INTEGER NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id),
    nickname VARCHAR(40) NOT NULL,
    start_index INTEGER NOT NULL,
    end_index INTEGER NOT NULL,
    PRIMARY KEY (comment_id, mention_index)
);
CREATE TABLE message_mentions (
    message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
    mention_index INTEGER NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id),
    nickname VARCHAR(40) NOT NULL,
    start_index INTEGER NOT NULL,
    end_index INTEGER NOT NULL,
    PRIMARY KEY (message_id, mention_index)
);
