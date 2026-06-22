import { pgTable, uuid, text, integer, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const galleryPostsTable = pgTable("gallery_posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  media_url: text("media_url").notNull(),
  media_type: text("media_type").notNull().default("video"),
  thumbnail_url: text("thumbnail_url"),
  likes_count: integer("likes_count").notNull().default(0),
  comments_count: integer("comments_count").notNull().default(0),
  created_at: timestamp("created_at").notNull().defaultNow(),
});

export const galleryLikesTable = pgTable("gallery_likes", {
  post_id: uuid("post_id").notNull(),
  user_id: uuid("user_id").notNull(),
}, (t) => [primaryKey({ columns: [t.post_id, t.user_id] })]);

export const galleryCommentsTable = pgTable("gallery_comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  post_id: uuid("post_id").notNull(),
  user_id: uuid("user_id").notNull(),
  content: text("content").notNull(),
  created_at: timestamp("created_at").notNull().defaultNow(),
});

export const insertGalleryPostSchema = createInsertSchema(galleryPostsTable).omit({ id: true, created_at: true, likes_count: true, comments_count: true });
export const insertGalleryCommentSchema = createInsertSchema(galleryCommentsTable).omit({ id: true, created_at: true });

export type InsertGalleryPost = z.infer<typeof insertGalleryPostSchema>;
export type GalleryPost = typeof galleryPostsTable.$inferSelect;
export type GalleryLike = typeof galleryLikesTable.$inferSelect;
export type InsertGalleryComment = z.infer<typeof insertGalleryCommentSchema>;
export type GalleryComment = typeof galleryCommentsTable.$inferSelect;
