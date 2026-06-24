-- First-party analytics for devonte.design
-- Run once against your Neon Postgres database.

create table if not exists events (
  id          bigserial primary key,
  ts          timestamptz not null default now(),
  session_id  text not null,            -- cookieless daily hash
  type        text not null,            -- pageview | heartbeat | exit
  path        text not null,
  referrer    text,
  duration_ms integer,                  -- time on page (heartbeat/exit only)
  country     text,
  region      text,
  city        text,
  device      text,                     -- mobile | tablet | desktop
  browser     text,
  os          text,
  screen_w    integer,
  screen_h    integer
);

create index if not exists events_ts_idx         on events (ts);
create index if not exists events_session_id_idx on events (session_id);
create index if not exists events_path_idx       on events (path);
create index if not exists events_type_idx       on events (type);
