import { z } from "zod";

export const MetaSchema = z.object({
  version: z.string().default("1.0"),
  generatedAt: z.string().optional(),
  source: z.string().default("bestwines-etl"),
  notes: z.string().optional(),
  datasetId: z.string().optional(),
  datasetVersion: z.string().optional(),
});

export const WinerySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  countryCode: z.string().min(2).max(2),
  region: z.string().min(1),
  score: z.number().int().min(0).max(100).optional().default(0),
  geo: z.string().min(1).optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  featuredLangs: z.array(z.string().min(2)).optional().default([]),
  slug: z.string().min(1).optional(),
});

export const PackSchema = z.object({
  id: z.string().min(1),
  wineryId: z.string().min(1),
  countryCode: z.string().min(2).max(2),
  typeKey: z.string().min(1),
  title: z.string().min(1),
});

export const SlugSchema = z.object({
  slug: z.string().min(1),
  targetType: z.literal("WINERY"),
  targetId: z.string().min(1),
});

export const DatasetSchema = z.object({
  meta: MetaSchema,
  wineries: z.array(WinerySchema),
  packs: z.array(PackSchema),
  slugs: z.array(SlugSchema),
});

export type Dataset = z.infer<typeof DatasetSchema>;
export type Winery = z.infer<typeof WinerySchema>;
export type Pack = z.infer<typeof PackSchema>;
export type SlugRow = z.infer<typeof SlugSchema>;
