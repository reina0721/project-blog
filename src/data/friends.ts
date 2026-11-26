export type Friend = {
  name: string;
  url: string;
  description?: string;
  avatar?: string;
};

export const friends: Friend[] = [];

export const designReferences: Friend[] = [
  {
    name: 'Aira Café',
    url: 'https://aira.cafe/',
    description: '很喜欢的设计站长',
  },
  // {
  //   name: 'Kirakira',
  //   url: 'https://kirakira.moe/',
  //   description: '留意它的菜单和按钮。图标、文字与按下时的反馈，共同解释了每次点击。',
  // },
];
