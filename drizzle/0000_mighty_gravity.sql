CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"content" text NOT NULL,
	"chat_id" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
