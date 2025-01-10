CREATE TABLE "message_contents" (
	"id" serial PRIMARY KEY NOT NULL,
	"content" text NOT NULL,
	"username" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reactions" DROP CONSTRAINT "reactions_message_id_messages_id_fk";
--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "message_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_message_id_message_contents_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."message_contents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_message_id_message_contents_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."message_contents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" DROP COLUMN "content";--> statement-breakpoint
ALTER TABLE "messages" DROP COLUMN "username";