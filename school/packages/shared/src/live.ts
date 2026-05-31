import { z } from "zod";

export const liveSessionSchema = z.object({
  title: z.string().min(3).max(150),
  scheduledAt: z.string().datetime(),
});

export const liveSessionUpdateSchema = liveSessionSchema.partial().extend({
  isLive: z.boolean().optional(),
});

// Types based on the schema
export type LiveSessionInput = z.infer<typeof liveSessionSchema>;
export type LiveSessionUpdateInput = z.infer<typeof liveSessionUpdateSchema>;
