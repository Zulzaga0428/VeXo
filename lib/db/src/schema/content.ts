import { pgTable, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const landingMediaTable = pgTable("landing_media", {
  slot: text("slot").primaryKey(),
  media_url: text("media_url").notNull(),
  media_type: text("media_type").notNull().default("video"),
  caption: text("caption"),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
});

export const promptLibraryTable = pgTable("prompt_library", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  prompt_text: text("prompt_text").notNull(),
  category: text("category").notNull(),
  media_url: text("media_url").notNull(),
  media_type: text("media_type").notNull().default("video"),
  poster_url: text("poster_url"),
  sort_order: integer("sort_order").notNull().default(0),
  is_active: boolean("is_active").notNull().default(true),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
});

export const showcaseItemsTable = pgTable("showcase_items", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  title_mn: text("title_mn").notNull(),
  title_en: text("title_en").notNull(),
  media_url: text("media_url").notNull(),
  media_type: text("media_type").notNull().default("video"),
  poster_url: text("poster_url"),
  sort_order: integer("sort_order").notNull().default(0),
  is_active: boolean("is_active").notNull().default(true),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
});

export const voicePreviewsTable = pgTable("voice_previews", {
  voice_id: text("voice_id").primaryKey(),
  audio_url: text("audio_url").notNull(),
  label: text("label").notNull(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
});

export const insertLandingMediaSchema = createInsertSchema(landingMediaTable);
export const insertPromptLibrarySchema = createInsertSchema(promptLibraryTable).omit({ created_at: true, updated_at: true });
export const insertShowcaseItemSchema = createInsertSchema(showcaseItemsTable).omit({ created_at: true, updated_at: true });
export const insertVoicePreviewSchema = createInsertSchema(voicePreviewsTable).omit({ updated_at: true });

export type LandingMedia = typeof landingMediaTable.$inferSelect;
export type PromptLibrary = typeof promptLibraryTable.$inferSelect;
export type ShowcaseItem = typeof showcaseItemsTable.$inferSelect;
export type VoicePreview = typeof voicePreviewsTable.$inferSelect;
