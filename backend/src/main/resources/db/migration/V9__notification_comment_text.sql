ALTER TABLE notifications ADD COLUMN comment_text VARCHAR(2000);

-- Restore the original comment in existing personal moderation notifications.
-- Keep read state, timestamps, reasons and event titles unchanged.
UPDATE notifications n
SET comment_text = (
    SELECT c.text FROM event_comments c
    WHERE n.dedupe_key = 'comment-hidden:' || CAST(c.id AS VARCHAR)
      AND n.recipient_id = c.author_id
      AND c.status = 'HIDDEN'
)
WHERE n.type = 'COMMENT_HIDDEN';
