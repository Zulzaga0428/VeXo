import { pgTable, uuid, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const videosTable = pgTable("videos", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id").notNull(),
  prompt: text("prompt").notNull(),
  voice: text("voice"),
  video_url: text("video_url"),
  status: text("status").notNull().default("pending"),
  series_count: integer("series_count").default(1),
  scene_index: integer("scene_index").default(0),
  expires_at: timestamp("expires_at"),
  created_at: timestamp("created_at").notNull().defaultNow(),
});

export const insertVideoSchema = createInsertSchema(videosTable).omit({ id: true, created_at: true });
export type InsertVideo = z.infer<typeof insertVideoSchema>;
export type Video = typeof videosTable.$inferSelect;
