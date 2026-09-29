CREATE TABLE "audit_log" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"actor_id" uuid,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" uuid,
	"ip" "inet",
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ball_maintenance_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ball_id" uuid NOT NULL,
	"kind" smallint NOT NULL,
	"performed_at" timestamp with time zone NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ball_maintenance_events_kind_valid" CHECK ("ball_maintenance_events"."kind" IN (1, 2, 3, 4))
);
--> statement-breakpoint
ALTER TABLE "ball_maintenance_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "balls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"brand" text,
	"weight_lb" smallint NOT NULL,
	"layout" text,
	"surface_grit" smallint,
	"games_since_resurface" smallint DEFAULT 0 NOT NULL,
	"retired_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "balls_user_name_key" UNIQUE("user_id","name"),
	CONSTRAINT "balls_weight_range" CHECK ("balls"."weight_lb" BETWEEN 6 AND 16),
	CONSTRAINT "balls_grit_positive" CHECK ("balls"."surface_grit" > 0),
	CONSTRAINT "balls_games_since_resurface_nonnegative" CHECK ("balls"."games_since_resurface" >= 0)
);
--> statement-breakpoint
ALTER TABLE "balls" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "frames" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"frame_number" smallint NOT NULL,
	"leave_mask" smallint,
	"is_strike" boolean NOT NULL,
	"is_spare" boolean NOT NULL,
	"is_split" boolean NOT NULL,
	"frame_score" smallint,
	"cumulative_score" smallint,
	CONSTRAINT "frames_game_frame_number_key" UNIQUE("game_id","frame_number"),
	CONSTRAINT "frames_id_user_key" UNIQUE("id","user_id"),
	CONSTRAINT "frames_frame_number_range" CHECK ("frames"."frame_number" BETWEEN 1 AND 10),
	CONSTRAINT "frames_leave_mask_range" CHECK ("frames"."leave_mask" BETWEEN 0 AND 1023),
	CONSTRAINT "frames_strike_xor_spare" CHECK (NOT ("frames"."is_strike" AND "frames"."is_spare")),
	CONSTRAINT "frames_strike_leaves_nothing" CHECK (NOT "frames"."is_strike" OR "frames"."leave_mask" = 0),
	CONSTRAINT "frames_frame_score_range" CHECK ("frames"."frame_score" BETWEEN 0 AND 30),
	CONSTRAINT "frames_cumulative_score_range" CHECK ("frames"."cumulative_score" BETWEEN 0 AND 300)
);
--> statement-breakpoint
ALTER TABLE "frames" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"game_number" smallint NOT NULL,
	"total_score" smallint NOT NULL,
	"is_complete" boolean NOT NULL,
	"ball_id" uuid,
	CONSTRAINT "games_session_game_number_key" UNIQUE("session_id","game_number"),
	CONSTRAINT "games_id_user_key" UNIQUE("id","user_id"),
	CONSTRAINT "games_game_number_positive" CHECK ("games"."game_number" >= 1),
	CONSTRAINT "games_total_score_range" CHECK ("games"."total_score" BETWEEN 0 AND 300)
);
--> statement-breakpoint
ALTER TABLE "games" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "houses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"country" char(2) NOT NULL,
	"city" text,
	"lane_count" smallint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "houses_country_iso" CHECK ("houses"."country" ~ '^[A-Z]{2}$'),
	CONSTRAINT "houses_lane_count_range" CHECK ("houses"."lane_count" BETWEEN 1 AND 200)
);
--> statement-breakpoint
ALTER TABLE "houses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "leave_encounters" (
	"user_id" uuid NOT NULL,
	"leave_mask" smallint NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"conversions" integer DEFAULT 0 NOT NULL,
	"first_seen_at" timestamp with time zone NOT NULL,
	"last_converted_at" timestamp with time zone,
	CONSTRAINT "leave_encounters_pkey" PRIMARY KEY("user_id","leave_mask"),
	CONSTRAINT "leave_encounters_leave_mask_range" CHECK ("leave_encounters"."leave_mask" BETWEEN 1 AND 1023),
	CONSTRAINT "leave_encounters_conversions_range" CHECK ("leave_encounters"."conversions" BETWEEN 0 AND "leave_encounters"."attempts")
);
--> statement-breakpoint
ALTER TABLE "leave_encounters" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "oil_patterns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"category" smallint NOT NULL,
	"length_ft" smallint,
	"volume_ml" numeric(5, 2),
	"ratio" numeric(4, 1),
	CONSTRAINT "oil_patterns_name_unique" UNIQUE("name"),
	CONSTRAINT "oil_patterns_category_valid" CHECK ("oil_patterns"."category" IN (1, 2, 3)),
	CONSTRAINT "oil_patterns_length_range" CHECK ("oil_patterns"."length_ft" BETWEEN 20 AND 70)
);
--> statement-breakpoint
ALTER TABLE "oil_patterns" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "player_state" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"level" smallint DEFAULT 1 NOT NULL,
	"total_xp" integer DEFAULT 0 NOT NULL,
	"xp_into_level" integer DEFAULT 0 NOT NULL,
	"rank_tier" smallint DEFAULT 0 NOT NULL,
	"formula_version" smallint NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "player_state_level_positive" CHECK ("player_state"."level" >= 1),
	CONSTRAINT "player_state_xp_nonnegative" CHECK ("player_state"."total_xp" >= 0),
	CONSTRAINT "player_state_xp_into_level_range" CHECK ("player_state"."xp_into_level" BETWEEN 0 AND "player_state"."total_xp")
);
--> statement-breakpoint
ALTER TABLE "player_state" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"handle" text NOT NULL,
	"display_name" text NOT NULL,
	"avatar_path" text,
	"hand" smallint,
	"home_house_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_handle_unique" UNIQUE("handle"),
	CONSTRAINT "profiles_handle_format" CHECK ("profiles"."handle" ~ '^[a-z0-9_]{3,20}$'),
	CONSTRAINT "profiles_display_name_length" CHECK (char_length("profiles"."display_name") BETWEEN 1 AND 50),
	CONSTRAINT "profiles_hand_valid" CHECK ("profiles"."hand" IN (1, 2))
);
--> statement-breakpoint
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"house_id" uuid,
	"oil_pattern_id" uuid,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"voided_at" timestamp with time zone,
	"void_reason" text,
	CONSTRAINT "sessions_user_client_key" UNIQUE("user_id","client_id"),
	CONSTRAINT "sessions_id_user_key" UNIQUE("id","user_id"),
	CONSTRAINT "sessions_ended_after_started" CHECK ("sessions"."ended_at" >= "sessions"."started_at"),
	CONSTRAINT "sessions_void_reason_iff_voided" CHECK (("sessions"."voided_at" IS NULL) = ("sessions"."void_reason" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "throws" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"frame_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"throw_number" smallint NOT NULL,
	"pins_standing_before" smallint NOT NULL,
	"pins_knocked" smallint NOT NULL,
	"is_foul" boolean DEFAULT false NOT NULL,
	"new_rack" boolean NOT NULL,
	"leave_mask" smallint GENERATED ALWAYS AS (pins_standing_before & ~pins_knocked) STORED,
	"is_split" boolean DEFAULT false NOT NULL,
	"ball_id" uuid,
	"board_target" smallint,
	"speed_mph" numeric(4, 1),
	"thrown_at" timestamp with time zone NOT NULL,
	CONSTRAINT "throws_frame_throw_number_key" UNIQUE("frame_id","throw_number"),
	CONSTRAINT "throws_throw_number_range" CHECK ("throws"."throw_number" BETWEEN 1 AND 3),
	CONSTRAINT "throws_standing_range" CHECK ("throws"."pins_standing_before" BETWEEN 1 AND 1023),
	CONSTRAINT "throws_knocked_range" CHECK ("throws"."pins_knocked" BETWEEN 0 AND 1023),
	CONSTRAINT "throws_knocked_were_standing" CHECK (("throws"."pins_standing_before" & "throws"."pins_knocked") = "throws"."pins_knocked"),
	CONSTRAINT "throws_new_rack_is_full" CHECK (NOT "throws"."new_rack" OR "throws"."pins_standing_before" = 1023),
	CONSTRAINT "throws_split_needs_legal_new_rack" CHECK (NOT "throws"."is_split" OR ("throws"."new_rack" AND NOT "throws"."is_foul")),
	CONSTRAINT "throws_board_target_range" CHECK ("throws"."board_target" BETWEEN 1 AND 39),
	CONSTRAINT "throws_speed_range" CHECK ("throws"."speed_mph" > 0 AND "throws"."speed_mph" <= 40)
);
--> statement-breakpoint
ALTER TABLE "throws" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "xp_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"source_type" smallint NOT NULL,
	"source_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"formula_version" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "xp_events_source_key" UNIQUE("user_id","source_type","source_id"),
	CONSTRAINT "xp_events_source_type_valid" CHECK ("xp_events"."source_type" IN (1, 2, 3, 4))
);
--> statement-breakpoint
ALTER TABLE "xp_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ball_maintenance_events" ADD CONSTRAINT "ball_maintenance_events_ball_id_balls_id_fk" FOREIGN KEY ("ball_id") REFERENCES "public"."balls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "balls" ADD CONSTRAINT "balls_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "frames" ADD CONSTRAINT "frames_game_fk" FOREIGN KEY ("game_id","user_id") REFERENCES "public"."games"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_ball_id_balls_id_fk" FOREIGN KEY ("ball_id") REFERENCES "public"."balls"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_session_fk" FOREIGN KEY ("session_id","user_id") REFERENCES "public"."sessions"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_encounters" ADD CONSTRAINT "leave_encounters_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_state" ADD CONSTRAINT "player_state_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_home_house_id_houses_id_fk" FOREIGN KEY ("home_house_id") REFERENCES "public"."houses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_house_id_houses_id_fk" FOREIGN KEY ("house_id") REFERENCES "public"."houses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_oil_pattern_id_oil_patterns_id_fk" FOREIGN KEY ("oil_pattern_id") REFERENCES "public"."oil_patterns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "throws" ADD CONSTRAINT "throws_ball_id_balls_id_fk" FOREIGN KEY ("ball_id") REFERENCES "public"."balls"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "throws" ADD CONSTRAINT "throws_frame_fk" FOREIGN KEY ("frame_id","user_id") REFERENCES "public"."frames"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xp_events" ADD CONSTRAINT "xp_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ball_maintenance_events_ball_idx" ON "ball_maintenance_events" USING btree ("ball_id","performed_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "games_ball_idx" ON "games" USING btree ("ball_id") WHERE "games"."ball_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "sessions_user_started_idx" ON "sessions" USING btree ("user_id","started_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "throws_bestiary_idx" ON "throws" USING btree ("user_id","leave_mask") WHERE new_rack AND NOT is_foul AND leave_mask <> 0;--> statement-breakpoint
CREATE INDEX "throws_ball_idx" ON "throws" USING btree ("ball_id","thrown_at" DESC NULLS LAST) WHERE "throws"."ball_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "xp_events_user_created_idx" ON "xp_events" USING btree ("user_id","created_at" DESC NULLS LAST);