import { pgTable, uuid, text, integer, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const paymentsTable = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id").notNull(),
  invoice_id: text("invoice_id").notNull(),
  payment_id: text("payment_id"),
  plan_type: text("plan_type").notNull(),
  amount: numeric("amount").notNull(),
  credits: integer("credits").notNull(),
  status: text("status").notNull().default("pending"),
  created_at: timestamp("created_at").notNull().defaultNow(),
});

export const insertPaymentSchema = createInsertSchema(paymentsTable).omit({ id: true, created_at: true });
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof paymentsTable.$inferSelect;
