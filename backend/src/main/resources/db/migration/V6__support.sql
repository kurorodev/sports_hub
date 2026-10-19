CREATE TABLE support_tickets (
    id UUID PRIMARY KEY,
    author_id UUID NOT NULL REFERENCES users(id),
    assigned_to UUID REFERENCES users(id),
    category VARCHAR(30) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'OPEN',
    priority VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
    title VARCHAR(160) NOT NULL,
    description VARCHAR(5000) NOT NULL,
    comment_id UUID REFERENCES event_comments(id),
    active_comment_id UUID REFERENCES event_comments(id),
    event_id UUID REFERENCES events(id),
    comment_text VARCHAR(2000),
    comment_author VARCHAR(100),
    report_reason VARCHAR(20),
    venue_city VARCHAR(120),
    venue_address VARCHAR(300),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT support_category CHECK (category IN ('HELP','BUG','IDEA','VENUE_SUGGESTION','COMMENT_REPORT')),
    CONSTRAINT support_status CHECK (status IN ('OPEN','IN_PROGRESS','WAITING_USER','RESOLVED','CLOSED')),
    CONSTRAINT support_priority CHECK (priority IN ('NORMAL','HIGH','URGENT')),
    CONSTRAINT support_active_report UNIQUE (author_id,active_comment_id)
);
CREATE INDEX support_author_updated ON support_tickets(author_id,updated_at DESC,id);
CREATE INDEX support_queue ON support_tickets(status,updated_at DESC,id);
CREATE TABLE support_messages (
    id UUID PRIMARY KEY,
    ticket_id UUID NOT NULL REFERENCES support_tickets(id),
    author_id UUID NOT NULL REFERENCES users(id),
    from_support BOOLEAN NOT NULL,
    kind VARCHAR(20) NOT NULL,
    text VARCHAR(5000) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    version BIGINT NOT NULL DEFAULT 0
);
CREATE INDEX support_messages_thread ON support_messages(ticket_id,created_at DESC,id);
