ALTER TABLE "direct_messages" DROP CONSTRAINT "direct_messages_parent_id_direct_messages_id_fk";
--> statement-breakpoint
ALTER TABLE "messages" DROP CONSTRAINT "messages_parent_id_messages_id_fk";
--> statement-breakpoint
ALTER TABLE "direct_messages" ADD PRIMARY KEY ("message_id");--> statement-breakpoint
ALTER TABLE "messages" ADD PRIMARY KEY ("message_id");--> statement-breakpoint
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_message_id_username_emoji_pk" PRIMARY KEY("message_id","username","emoji");--> statement-breakpoint
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_parent_id_direct_messages_message_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."direct_messages"("message_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_parent_id_messages_message_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."messages"("message_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_messages" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "messages" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "reactions" DROP COLUMN "id";