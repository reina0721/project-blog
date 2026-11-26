import { sync } from 'astro';

process.env.BLOG_GENERATE_MERMAID = '1';
await sync({ force: true });
