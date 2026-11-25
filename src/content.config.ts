import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const posts = defineCollection({
  loader: glob({ base: './src/content/posts', pattern: '**/*.md' }),
  schema: z.object({
    title: z.string().min(1),
    date: z.coerce.date().transform((date) => date.toISOString().slice(0, 10)),
    category: z.string().default('手记'),
    summary: z.string().optional(),
    sample: z.boolean().default(false),
  }),
});

const pages = defineCollection({
  loader: glob({ base: './src/content/pages', pattern: '*.md' }),
  schema: z.object({ title: z.string() }),
});

export const collections = { posts, pages };
