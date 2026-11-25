type SocialLink = { label: string; url: string; icon: string };
type Section = 'home' | 'blog' | 'archive' | 'links' | 'about';

export const site = {
  name: '青屿',
  romanName: 'Qingyu',
  brand: '蓝笺',
  englishBrand: 'Blue Notes',
  motto: '在日常的缝隙里，记下微小而明亮的事。',
  sample: true,
  socials: [] as SocialLink[],
  avatar: '',
  themeColor: '#446bdd',
  nav: [
    { key: 'home', href: '/', label: '主页', icon: 'home' },
    { key: 'blog', href: '/blog/', label: '博客', icon: 'book' },
    { key: 'archive', href: '/archive/', label: '归档', icon: 'archive' },
    { key: 'links', href: '/links/', label: '友链', icon: 'link' },
    { key: 'about', href: '/about/', label: '关于', icon: 'user' },
  ] satisfies { key: Section; href: string; label: string; icon: string }[],
};

export const sampleSocials: SocialLink[] = [
  { label: 'GitHub', url: 'https://github.com/', icon: 'github' },
  { label: '哔哩哔哩', url: 'https://www.bilibili.com/', icon: 'bilibili' },
];
