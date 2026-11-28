export type Friend = {
  name: string;
  url: string;
  description?: string;
  avatar?: string;
};

export const friends: Friend[] = [
  {
    name: '恬炘的小屋',
    url: 'https://blog.chacewebsite.cn/',
    description: '这不是一个很热闹的地方，更像一间小屋，灯开着，东西各自安放。',
    // avatar: 'https://github.com/ChaceQC.png',
  },
];

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
