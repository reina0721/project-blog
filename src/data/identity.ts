import { site, sampleSocials } from './site';

export const profileAvatar = site.avatar || (site.sample ? '/images/profile-qwq.jpg' : '');
export const usingSampleSocials = site.sample && site.socials.length === 0;
export const profileSocials = usingSampleSocials ? sampleSocials : site.socials;