CREATE TABLE IF NOT EXISTS "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"isToday" boolean DEFAULT false NOT NULL,
	"category" text DEFAULT '작업' NOT NULL,
	"createdAt" bigint NOT NULL
);
