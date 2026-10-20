-- Existing accounts are not interrupted by onboarding. New users start PENDING.
-- V10/V11 are reserved by the administrator-panel branch.
alter table users add column questionnaire_status varchar(20) not null default 'SKIPPED';
alter table users add column questionnaire_completed_at timestamp(6) with time zone;
alter table users add column recommendation_time_zone varchar(64) not null default 'UTC';
alter table users add constraint users_questionnaire_status check (questionnaire_status in ('PENDING','SKIPPED','COMPLETED'));
