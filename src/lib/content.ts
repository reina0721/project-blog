import { getCollection } from 'astro:content';

export async function getPosts() {
  return (await getCollection('posts')).sort((a, b) =>
    b.data.date.localeCompare(a.data.date) || a.id.localeCompare(b.id, 'en')
  );
}

export function postHref(id: string) {
  return '/blog/' + id.split('/').map(encodeURIComponent).join('/') + '/';
}

export function formatDate(isoDate: string) {
  return isoDate.replaceAll('-', '.');
}

export function titleTransition(id: string) {
  const safeId = id.replace(/[^a-z0-9-]/giu, (char) => '_' + char.codePointAt(0)!.toString(16) + '_');
  return 'a-title-' + safeId;
}
