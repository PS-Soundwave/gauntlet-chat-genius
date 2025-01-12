CREATE TABLE "attachments" (
	"id" serial PRIMARY KEY NOT NULL,
	"message_content_id" integer NOT NULL,
	"url" text NOT NULL,
	"filename" text NOT NULL,
	"content_type" text NOT NULL,
	"size" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_message_content_id_message_contents_id_fk" FOREIGN KEY ("message_content_id") REFERENCES "public"."message_contents"("id") ON DELETE cascade ON UPDATE no action;