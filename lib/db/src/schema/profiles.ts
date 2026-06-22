import { pgTable, uuid, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const profilesTable = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  username: text("username").unique().notNull(),
  display_name: text("display_name"),
  bio: text("bio"),
  avatar_url: text("avatar_url"),
  banner_url: text("banner_url"),
  website: text("website"),
  location: text("location"),
  credits: integer("credits").notNull().default(0),
  plan: text("plan").default("free"),
  created_at: timestamp("created_at").notNull().defaultNow(),
});

export const insertProfileSchema = createInsertSchema(profilesTable).omit({ created_at: true });
export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type Profile = typeof profilesTable.$inferSelect;
