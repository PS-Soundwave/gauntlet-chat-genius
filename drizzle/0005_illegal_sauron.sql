CREATE TABLE "direct_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"message_id" integer NOT NULL,
	"participant1" text NOT NULL,
	"participant2" text NOT NULL,
	"parent_id" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_message_id_message_contents_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."message_contents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_parent_id_direct_messages_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."direct_messages"("id") ON DELETE no action ON UPDATE no action;