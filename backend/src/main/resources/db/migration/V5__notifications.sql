CREATE TABLE notifications (
    id UUID PRIMARY KEY,
    recipient_id UUID NOT NULL REFERENCES users(id),
    type VARCHAR(40) NOT NULL,
    title VARCHAR(200) NOT NULL,
    text VARCHAR(2000) NOT NULL,
    reason VARCHAR(1000),
    href VARCHAR(200),
    dedupe_key VARCHAR(240) NOT NULL,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    UNIQUE (recipient_id, dedupe_key)
);
CREATE INDEX notifications_recipient_created ON notifications(recipient_id, created_at DESC, id);
CREATE INDEX notifications_recipient_unread ON notifications(recipient_id, read_at, created_at);

-- Keep existing personal moderation reasons reachable after moving them out of event DTOs.
INSERT INTO notifications (id,recipient_id,type,title,text,reason,href,dedupe_key,created_at,updated_at,version)
SELECT e.id,COALESCE(e.organizer_user_id,o.created_by),'EVENT_UNPUBLISHED',
    'Мероприятие снято с публикации',e.title,e.moderation_reason,
    '/events/' || CAST(e.id AS VARCHAR), 'unpublished:' || CAST(e.id AS VARCHAR),e.updated_at,e.updated_at,0
FROM events e LEFT JOIN organizations o ON o.id=e.organizer_organization_id
WHERE e.status='UNPUBLISHED' AND e.moderation_reason IS NOT NULL;
INSERT INTO notifications (id,recipient_id,type,title,text,reason,href,dedupe_key,created_at,updated_at,version)
SELECT c.id,c.author_id,'COMMENT_HIDDEN','Ваш комментарий скрыт модератором',e.title,c.moderation_reason,
    '/events/' || CAST(c.event_id AS VARCHAR), 'comment-hidden:' || CAST(c.id AS VARCHAR),c.updated_at,c.updated_at,0
FROM event_comments c JOIN events e ON e.id=c.event_id
WHERE c.status='HIDDEN' AND c.moderation_reason IS NOT NULL;
