CREATE TYPE "public"."message_type" AS ENUM('message', 'direct_message');--> statement-breakpoint
CREATE TABLE "message_ids" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" "message_type" NOT NULL,
	CONSTRAINT "message_ids_id_type_unique" UNIQUE("id","type")
);
--> statement-breakpoint
ALTER TABLE "direct_messages" DROP CONSTRAINT "direct_messages_message_id_message_contents_id_fk";
--> statement-breakpoint
ALTER TABLE "direct_messages" DROP CONSTRAINT "direct_messages_parent_id_direct_messages_message_id_fk";
--> statement-breakpoint
ALTER TABLE "messages" DROP CONSTRAINT "messages_message_id_message_contents_id_fk";
--> statement-breakpoint
ALTER TABLE "messages" DROP CONSTRAINT "messages_parent_id_messages_message_id_fk";
--> statement-breakpoint
ALTER TABLE "direct_messages" ADD COLUMN "id" integer PRIMARY KEY NOT NULL;--> statement-breakpoint
ALTER TABLE "direct_messages" ADD COLUMN "type" "message_type" NOT NULL;--> statement-breakpoint
ALTER TABLE "direct_messages" ADD COLUMN "content_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "id" integer PRIMARY KEY NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "type" "message_type" NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "content_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_content_id_message_contents_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."message_contents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_parent_id_direct_messages_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."direct_messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_id_type_message_ids_id_type_fk" FOREIGN KEY ("id","type") REFERENCES "public"."message_ids"("id","type") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_content_id_message_contents_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."message_contents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_parent_id_messages_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_id_type_message_ids_id_type_fk" FOREIGN KEY ("id","type") REFERENCES "public"."message_ids"("id","type") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_messages" DROP COLUMN "message_id";--> statement-breakpoint
ALTER TABLE "messages" DROP COLUMN "message_id";--> statement-breakpoint
ALTER TABLE "direct_messages" ADD CONSTRAINT "type" CHECK (type = 'direct_message');--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "type" CHECK (type = 'message');