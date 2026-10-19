-- Portable PostgreSQL / H2 schema; production database is PostgreSQL.
create table users (
id uuid primary key, created_at timestamp(6) with time zone not null, updated_at timestamp(6) with time zone not null, version bigint not null default 0,
nickname varchar(40) not null unique, normalized_nickname varchar(40) not null unique,
display_name varchar(100) not null, first_name varchar(80), last_name varchar(80), bio varchar(1000),
avatar_url varchar(2048), city varchar(100), preferred_time varchar(20), admin boolean not null default false, demo_account varchar(80) unique
);

create table sports (
id uuid primary key, created_at timestamp(6) with time zone not null, updated_at timestamp(6) with time zone not null, version bigint not null default 0,
name varchar(80) not null, normalized_name varchar(80) not null unique, is_custom boolean not null default false
);

create table organizations (
id uuid primary key, created_at timestamp(6) with time zone not null, updated_at timestamp(6) with time zone not null, version bigint not null default 0,
name varchar(160) not null, description varchar(2000) not null, avatar_url varchar(2048),
created_by uuid not null references users(id), status varchar(30) not null check(status in ('PENDING','APPROVED','REJECTED')),
decision_reason varchar(1000), decided_at timestamp(6) with time zone, decided_by uuid references users(id),
check(status <> 'REJECTED' or length(trim(decision_reason)) >= 3)
);

create table events (
id uuid primary key, created_at timestamp(6) with time zone not null, updated_at timestamp(6) with time zone not null, version bigint not null default 0,
title varchar(160) not null, description varchar(5000) not null, sport_id uuid not null references sports(id),
event_kind varchar(30) not null check(event_kind in ('ACTIVITY','COMPETITION')), starts_at timestamp(6) with time zone not null,
ends_at timestamp(6) with time zone, city varchar(120) not null, address varchar(300) not null, latitude double precision,
longitude double precision, skill_level varchar(30) not null, requirements varchar(2000), join_mode varchar(30) not null check(join_mode in ('OPEN','APPROVAL')),
max_participants integer check(max_participants between 2 and 10000), organizer_user_id uuid references users(id),
organizer_organization_id uuid references organizations(id), status varchar(30) not null check(status in ('DRAFT','PUBLISHED','UNPUBLISHED','DELETED')),
moderation_reason varchar(1000), check((organizer_user_id is not null and organizer_organization_id is null) or
(organizer_user_id is null and organizer_organization_id is not null)), check(ends_at is null or ends_at > starts_at),
check(latitude is null or latitude between -90 and 90), check(longitude is null or longitude between -180 and 180)
);

create table event_registrations (
id uuid primary key, created_at timestamp(6) with time zone not null, updated_at timestamp(6) with time zone not null, version bigint not null default 0,
event_id uuid not null references events(id), user_id uuid not null references users(id),
status varchar(30) not null check(status in ('PENDING','CONFIRMED','REJECTED','CANCELLED','WAITLISTED')), message varchar(1000),
decision_reason varchar(1000), decided_at timestamp(6) with time zone, decided_by uuid references users(id), unique(event_id,user_id)
);

create table event_comments (
id uuid primary key, created_at timestamp(6) with time zone not null, updated_at timestamp(6) with time zone not null, version bigint not null default 0,
event_id uuid not null references events(id), author_id uuid not null references users(id), text varchar(2000) not null,
status varchar(30) not null check(status in ('VISIBLE','HIDDEN')), moderation_reason varchar(1000)
);

create table moderation_actions (
id uuid primary key, created_at timestamp(6) with time zone not null, updated_at timestamp(6) with time zone not null, version bigint not null default 0,
actor_id uuid not null references users(id), target_id uuid not null, action varchar(40) not null, reason varchar(1000)
);

create table event_staff (
id uuid primary key, created_at timestamp(6) with time zone not null, updated_at timestamp(6) with time zone not null, version bigint not null default 0,
event_id uuid not null references events(id), user_id uuid not null references users(id), assigned_by uuid not null references users(id), unique(event_id,user_id)
);

create table competition_participations (
id uuid primary key, created_at timestamp(6) with time zone not null, updated_at timestamp(6) with time zone not null, version bigint not null default 0,
registration_id uuid not null unique references event_registrations(id), event_id uuid not null references events(id),
user_id uuid not null references users(id), status varchar(30) not null, verified_by uuid references users(id),
verified_at timestamp(6) with time zone, note varchar(300)
);

create table rating_ledger (
id uuid primary key, created_at timestamp(6) with time zone not null, updated_at timestamp(6) with time zone not null, version bigint not null default 0,
user_id uuid not null references users(id), event_id uuid not null references events(id), registration_id uuid not null references event_registrations(id),
participation_id uuid not null references competition_participations(id), points integer not null, reason varchar(80) not null,
verified_by uuid not null references users(id), idempotency_key varchar(160) not null unique
);

create table conversations (
id uuid primary key, created_at timestamp(6) with time zone not null, updated_at timestamp(6) with time zone not null, version bigint not null default 0,
type varchar(30) not null check(type in ('DIRECT','COMMUNITY')), title varchar(120), organization_id uuid references organizations(id),
user_low_id uuid references users(id), user_high_id uuid references users(id), direct_key varchar(80) unique, last_message_at timestamp(6) with time zone,
check((type='DIRECT' and user_low_id is not null and user_high_id is not null and user_low_id <> user_high_id and direct_key is not null and organization_id is null)
or (type='COMMUNITY' and organization_id is not null and user_low_id is null and user_high_id is null and direct_key is null))
);

create table chat_messages (
id uuid primary key, created_at timestamp(6) with time zone not null, updated_at timestamp(6) with time zone not null, version bigint not null default 0,
conversation_id uuid not null references conversations(id), author_id uuid not null references users(id), text varchar(3000) not null
);

create table community_members (
id uuid primary key, created_at timestamp(6) with time zone not null, updated_at timestamp(6) with time zone not null, version bigint not null default 0,
organization_id uuid not null references organizations(id), user_id uuid not null references users(id),
status varchar(30) not null check(status in ('ACTIVE','LEFT')), joined_at timestamp(6) with time zone not null, unique(organization_id,user_id)
);

create table user_sport_roles (user_id uuid not null references users(id), sports_role varchar(30) not null, primary key(user_id,sports_role));
create table user_sport_preferences (user_id uuid not null references users(id), sport_id uuid not null references sports(id), level varchar(30) not null, primary key(user_id,sport_id));
create table organization_sports (organization_id uuid not null references organizations(id), sport_id uuid not null references sports(id), primary key(organization_id,sport_id));
create index idx_events_catalog on events(status,starts_at,id);
create index idx_events_sport on events(sport_id,status,starts_at);
create index idx_events_organization on events(organizer_organization_id,status);
create index idx_registrations_queue on event_registrations(event_id,status,created_at,id);
create index idx_registrations_user on event_registrations(user_id,status);
create index idx_comments_event on event_comments(event_id,status,created_at,id);
create index idx_organizations_status on organizations(status,created_at);
create index idx_messages_history on chat_messages(conversation_id,created_at desc,id desc);
create index idx_community_user on community_members(user_id,status);
create index idx_ledger_user on rating_ledger(user_id,created_at,id);
create index idx_moderation_target on moderation_actions(target_id,created_at);
