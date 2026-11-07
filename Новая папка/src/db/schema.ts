import { integer, jsonb, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

export const gameSaves = pgTable(
  "game_saves",
  {
    clientId: text("client_id").notNull(),
    slot: integer("slot").notNull(),
    data: jsonb("data").notNull(),
    summary: jsonb("summary").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.clientId, t.slot] })],
);
