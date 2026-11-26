type SocialLink = { label: string; url: string; icon: string };
type Section = 'home' | 'blog' | 'archive' | 'links' | 'about';

export const site = {
  name: '小林',
  romanName: 'Reina',
  brand: "Reina' Blog",
  englishBrand: 'Blue Notes',
  motto: '在这里，不知道要记录什么。',
  sample: true,
  socials: [] as SocialLink[],
  avatar: '',
  themeColor: '#9bc0c9', // 9bc0c9 b6cacf
  nav: [
    { key: 'home', href: '/', label: 'Home', icon: 'home' },
    { key: 'blog', href: '/blog/', label: 'Blog', icon: 'book' },
    { key: 'archive', href: '/archive/', label: 'Archive', icon: 'archive' },
    { key: 'links', href: '/links/', label: 'Links', icon: 'link' },
    { key: 'about', href: '/about/', label: 'About', icon: 'user' },
  ] satisfies { key: Section; href: string; label: string; icon: string }[],
};

export const sampleSocials: SocialLink[] = [
  { label: 'GitHub', url: 'https://github.com/reina0721', icon: 'github' },
  { label: '哔哩哔哩', url: 'https://www.bilibili.com/', icon: 'bilibili' },
];
