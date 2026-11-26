import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';

export const getStaticPaths = (async () => {
  const collections = await Promise.all([getCollection('posts'), getCollection('pages')]);
  const assets = new Map<string, string>();
  for (const entry of collections.flat()) {
    const metadata = entry.rendered?.metadata?.frontmatter as { articleDiagramAssets?: Record<string, string> } | undefined;
    for (const [id, svg] of Object.entries(metadata?.articleDiagramAssets ?? {})) assets.set(id, svg);
  }
  return Array.from(assets, ([id, svg]) => ({ params: { id }, props: { svg } }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) => new Response(props.svg, {
  headers: { 'Content-Type': 'image/svg+xml; charset=utf-8' },
});
