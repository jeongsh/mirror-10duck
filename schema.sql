-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.boards (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  slug character varying NOT NULL UNIQUE,
  name character varying NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'general'::text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  hot_threshold integer NOT NULL DEFAULT 10,
  allow_anonymous boolean NOT NULL DEFAULT false,
  allow_media boolean NOT NULL DEFAULT true,
  is_nsfw boolean NOT NULL DEFAULT false,
  CONSTRAINT boards_pkey PRIMARY KEY (id),
  CONSTRAINT boards_category_check CHECK (
    category = ANY (
      ARRAY[
        'general'::text,
        'anime'::text,
        'game'::text,
        'hobby'::text,
        'life'::text,
        'media'::text,
        'other'::text
      ]
    )
  )
);
CREATE TABLE public.board_category_order (
  category text NOT NULL,
  position integer NOT NULL,
  CONSTRAINT board_category_order_pkey PRIMARY KEY (category),
  CONSTRAINT board_category_order_category_check CHECK (
    category = ANY (
      ARRAY[
        'general'::text,
        'anime'::text,
        'game'::text,
        'hobby'::text,
        'life'::text,
        'media'::text,
        'other'::text
      ]
    )
  )
);
CREATE TABLE public.characters (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  user_id uuid NOT NULL,
  character_id text NOT NULL,
  profile_json jsonb NOT NULL,
  CONSTRAINT characters_pkey PRIMARY KEY (id),
  CONSTRAINT characters_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.comments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL,
  author_id uuid,
  author_email text,
  content text,
  sticker_token text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  parent_comment_id uuid,
  status text NOT NULL DEFAULT 'NORMAL'::text,
  anonymous_nickname text,
  anonymous_password_hash text,
  is_anonymous boolean DEFAULT false,
  author_ip text,
  CONSTRAINT comments_pkey PRIMARY KEY (id),
  CONSTRAINT comments_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id),
  CONSTRAINT comments_author_id_fkey FOREIGN KEY (author_id) REFERENCES auth.users(id),
  CONSTRAINT comments_parent_comment_id_fkey FOREIGN KEY (parent_comment_id) REFERENCES public.comments(id),
  CONSTRAINT fk_comments_profiles FOREIGN KEY (author_id) REFERENCES public.profiles(user_id)
);
CREATE TABLE public.follows_board (
  user_id uuid NOT NULL,
  board_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT follows_board_pkey PRIMARY KEY (user_id, board_id),
  CONSTRAINT follows_board_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT follows_board_board_id_fkey FOREIGN KEY (board_id) REFERENCES public.boards(id)
);
CREATE TABLE public.follows_user (
  follower_id uuid NOT NULL,
  following_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT follows_user_pkey PRIMARY KEY (follower_id, following_id),
  CONSTRAINT follows_user_follower_id_fkey FOREIGN KEY (follower_id) REFERENCES auth.users(id),
  CONSTRAINT follows_user_following_id_fkey FOREIGN KEY (following_id) REFERENCES auth.users(id)
);
CREATE TABLE public.moderation_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  admin_id uuid NOT NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  reason text,
  metadata jsonb,
  CONSTRAINT moderation_logs_pkey PRIMARY KEY (id),
  CONSTRAINT moderation_logs_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES auth.users(id)
);
CREATE TABLE public.news_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  news_id uuid NOT NULL,
  author_id uuid,
  author_email text,
  content text,
  parent_comment_id uuid,
  is_anonymous boolean NOT NULL DEFAULT false,
  anonymous_nickname text,
  anonymous_password_hash text,
  author_ip text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  sticker_token text,
  CONSTRAINT news_comments_pkey PRIMARY KEY (id),
  CONSTRAINT news_comments_news_id_fkey FOREIGN KEY (news_id) REFERENCES public.news_items(id),
  CONSTRAINT news_comments_parent_comment_id_fkey FOREIGN KEY (parent_comment_id) REFERENCES public.news_comments(id),
  CONSTRAINT news_comments_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(user_id)
);
CREATE TABLE public.news_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  category USER-DEFINED NOT NULL,
  title text NOT NULL,
  summary text NOT NULL,
  body ARRAY NOT NULL DEFAULT '{}'::text[],
  thumbnail_url text,
  tags ARRAY NOT NULL DEFAULT '{}'::text[],
  status USER-DEFINED NOT NULL DEFAULT 'DRAFT'::news_status,
  published_at timestamp with time zone,
  collected_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  body_json jsonb NOT NULL DEFAULT '{"type": "doc", "content": [{"type": "paragraph"}]}'::jsonb,
  CONSTRAINT news_items_pkey PRIMARY KEY (id),
  CONSTRAINT news_items_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT news_items_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id)
);
CREATE TABLE public.news_reactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  news_id uuid NOT NULL,
  user_id uuid,
  reaction_type text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT news_reactions_pkey PRIMARY KEY (id),
  CONSTRAINT news_reactions_news_id_fkey FOREIGN KEY (news_id) REFERENCES public.news_items(id),
  CONSTRAINT news_reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  receiver_id uuid NOT NULL,
  sender_id uuid,
  type text NOT NULL,
  title text,
  content text,
  link_url text,
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamp with time zone,
  expires_at timestamp with time zone DEFAULT (now() + '30 days'::interval),
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_receiver_id_fkey FOREIGN KEY (receiver_id) REFERENCES auth.users(id),
  CONSTRAINT notifications_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES auth.users(id)
);
CREATE TABLE public.oshi_card_shares (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_id uuid,
  nickname text,
  oshi text,
  works ARRAY NOT NULL DEFAULT '{}'::text[],
  grade text NOT NULL,
  type_id text NOT NULL,
  background_image_url text,
  oshi_avatar_url text,
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + '30 days'::interval),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT oshi_card_shares_pkey PRIMARY KEY (id),
  CONSTRAINT oshi_card_shares_expires_30d CHECK (expires_at <= created_at + '30 days 00:05:00'::interval),
  CONSTRAINT oshi_card_shares_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id)
);
CREATE TABLE public.post_reactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL,
  user_id uuid NOT NULL,
  reaction_type text NOT NULL CHECK (reaction_type = ANY (ARRAY['happy'::text, 'empathy'::text, 'surprise'::text, 'sad'::text, 'funny'::text, 'cheer'::text])),
  character_id text,
  character_thumbnail_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  display_name text,
  avatar_url text,
  CONSTRAINT post_reactions_pkey PRIMARY KEY (id),
  CONSTRAINT post_reactions_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id),
  CONSTRAINT post_reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT fk_post_reactions_profiles FOREIGN KEY (user_id) REFERENCES public.profiles(user_id)
);
CREATE TABLE public.post_votes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL,
  user_id uuid NOT NULL,
  vote_type text NOT NULL CHECK (vote_type = ANY (ARRAY['up'::text, 'down'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT post_votes_pkey PRIMARY KEY (id),
  CONSTRAINT post_votes_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id),
  CONSTRAINT post_votes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT fk_post_votes_profiles FOREIGN KEY (user_id) REFERENCES public.profiles(user_id)
);
CREATE TABLE public.posts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  title text,
  content text NOT NULL,
  category text,
  author_id uuid,
  author_email text,
  board_id uuid,
  source_type character varying DEFAULT 'BOARD'::character varying,
  origin_post_id uuid,
  is_hot boolean DEFAULT false,
  hot_promoted_at timestamp with time zone,
  view_count integer NOT NULL DEFAULT 0,
  comment_count integer NOT NULL DEFAULT 0,
  upvote_count integer NOT NULL DEFAULT 0,
  downvote_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'NORMAL'::text,
  is_notice boolean NOT NULL DEFAULT false,
  tag text,
  is_locked boolean NOT NULL DEFAULT false,
  updated_at timestamp with time zone DEFAULT now(),
  anonymous_nickname text,
  anonymous_password_hash text,
  is_anonymous boolean DEFAULT false,
  author_ip text,
  CONSTRAINT posts_pkey PRIMARY KEY (id),
  CONSTRAINT posts_author_id_fkey FOREIGN KEY (author_id) REFERENCES auth.users(id),
  CONSTRAINT posts_board_id_fkey FOREIGN KEY (board_id) REFERENCES public.boards(id),
  CONSTRAINT posts_origin_post_id_fkey FOREIGN KEY (origin_post_id) REFERENCES public.posts(id),
  CONSTRAINT fk_posts_profiles FOREIGN KEY (author_id) REFERENCES public.profiles(user_id)
);

-- 크로스포스트 유니크·트리거(원본 숨김 전파, 삭제 시 origin 정리): db/2026-05-11-crosspost-dedup-propagate.sql

CREATE TABLE public.profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  nickname text NOT NULL UNIQUE,
  display_name text,
  avatar_url text,
  bio text,
  representative_character_id text,
  nickname_type text DEFAULT 'FIXED'::text CHECK (nickname_type = ANY (ARRAY['FIXED'::text, 'TEMPORARY'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  handle text UNIQUE,
  handle_updated_at timestamp with time zone,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.release_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  release_item_id uuid,
  event_type USER-DEFINED NOT NULL,
  title text NOT NULL,
  starts_at timestamp with time zone NOT NULL,
  timezone text NOT NULL DEFAULT 'Asia/Seoul'::text,
  episode_label text,
  platform text,
  source_url text,
  status USER-DEFINED NOT NULL DEFAULT 'PUBLISHED'::news_status,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT release_events_pkey PRIMARY KEY (id),
  CONSTRAINT release_events_release_item_id_fkey FOREIGN KEY (release_item_id) REFERENCES public.release_items(id)
);
CREATE TABLE public.release_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  category USER-DEFINED NOT NULL,
  title text NOT NULL,
  original_title text,
  synopsis text NOT NULL,
  poster_url text,
  banner_url text,
  genres ARRAY NOT NULL DEFAULT '{}'::text[],
  studios ARRAY NOT NULL DEFAULT '{}'::text[],
  season text,
  episode_count integer CHECK (episode_count IS NULL OR episode_count > 0),
  status USER-DEFINED NOT NULL DEFAULT 'DRAFT'::news_status,
  release_date date,
  created_by uuid,
  updated_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT release_items_pkey PRIMARY KEY (id),
  CONSTRAINT release_items_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT release_items_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id)
);
CREATE TABLE public.release_reminder_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  release_item_id uuid,
  release_event_id uuid,
  reminder_type text NOT NULL DEFAULT 'SAME_DAY'::text,
  offset_minutes integer NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT release_reminder_settings_pkey PRIMARY KEY (id),
  CONSTRAINT release_reminder_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT release_reminder_settings_release_item_id_fkey FOREIGN KEY (release_item_id) REFERENCES public.release_items(id),
  CONSTRAINT release_reminder_settings_release_event_id_fkey FOREIGN KEY (release_event_id) REFERENCES public.release_events(id)
);
CREATE TABLE public.reports (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  reporter_id uuid NOT NULL,
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  reason_category text NOT NULL,
  reason_detail text,
  status text NOT NULL DEFAULT 'PENDING'::text,
  admin_note text,
  processed_at timestamp with time zone,
  CONSTRAINT reports_pkey PRIMARY KEY (id),
  CONSTRAINT reports_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES auth.users(id)
);
CREATE TABLE public.user_release_follows (
  user_id uuid NOT NULL,
  release_item_id uuid NOT NULL,
  notify_enabled boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_release_follows_pkey PRIMARY KEY (user_id, release_item_id),
  CONSTRAINT user_release_follows_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT user_release_follows_release_item_id_fkey FOREIGN KEY (release_item_id) REFERENCES public.release_items(id)
);
