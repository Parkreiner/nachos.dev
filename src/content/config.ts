import { defineCollection, z } from "astro:content";

const nonEmptyString = z.string().min(1);

// Slugs are not allowed to be part of the schema; make sure that every post I
// publish has one so that I have something close to permalinks!
const blog = defineCollection({
  type: "content",
  schema: z.object({
    title: nonEmptyString,
    description: nonEmptyString,
    datePublished: z.coerce.date(),
    tags: z.array(nonEmptyString).min(1),

    dateUpdated: z.coerce.date().optional(),
    hasAudioNarration: z.boolean().optional(),
    customLayout: z.boolean().optional(),
  }),
});

export const collections = { blog };
