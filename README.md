# 蓝笺

用 Astro 构建的中文个人站。首页介绍站主，博客按发布时间选文，归档按年份找文，友链以站点头像和名字浏览。文章、导航与外部链接可在关闭 JavaScript 时使用。

## 本地运行

环境为 Node.js 24.19 与 npm。首次进入项目后运行 `npm ci`。

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 编辑网站并即时预览 |
| `npm run check` | 检查 Astro 和 TypeScript |
| `npm run build` | 在 `dist/` 生成可以部署的静态文件 |
| `npm run preview -- --host 127.0.0.1 --port 4321` | 在本机预览上述生产构建 |
| `npm run research` | 在本机 4322 端口打开研究图册、录屏与转场实验 |

## 更换身份资料

修改 [站点配置](src/data/site.ts) 里的 `name`、`romanName`、`brand`、`motto`、`socials` 与 `avatar`。头像可放在 `public/images/` 并填写以 `/images/` 开头的地址。各账号填 `label`、`url`、`icon`，请使用自己的公开个人主页。图标库以图标名选择字形，未知平台使用通用链接图标。

当前「青屿」、座右铭、插画头像及三篇文章属于示例。真实资料齐备后把站点的 `sample` 设为 `false`，示例平台入口、参考站点和示例头像随之退出。关于页的正文直接编辑 [about.md](src/content/pages/about.md)。文章各自通过 frontmatter 的 `sample` 标识样稿，发布新站时可替换或移走示范文章。

## 发布一篇文章

在 `src/content/posts/` 新建 Markdown。文件名作为稳定地址，例如 `evening-walk.md` 对应 `/blog/evening-walk/`。内容集合用同一批文章生成主页最近文章、博客列表、正文和按年归档；日期相同时使用文章 ID 确定顺序。

```markdown
---
title: 傍晚的一条小路
date: 2026-11-25
category: 随笔
summary: 这篇文章写了什么。
---

正文从这里开始。
```

编辑 [好友数据](src/data/friends.ts) 的 `friends` 数组即可增加友链。每项填写 `name`、`url`，可选 `avatar`、`description`。缺头像时使用站名首字。

## 主题和交互

从 `site.themeColor` 修改种子蓝。[全站样式](src/styles/global.css) 负责强调色、表面、轮廓、文字和 Material 状态层的语义映射。[ActionLink](src/components/ActionLink.astro) 给原生链接提供 Material Web 的按压和键盘焦点反馈。[SiteNav](src/components/SiteNav.astro) 根据当前页面输出菜单状态，手机底栏随选中项展开文字。[转场实现](src/lib/motion-inline.js) 在浏览器交换文档时匹配方向、来源标题和当前栏目。动画视觉由 [motion.css](src/styles/motion.css) 控制。

## 研究与验收

- [三站按下、换页与返回的双端现场对照](research/comparison/index.html) · [本轮组件修改和生产复测](research/comparison/results.md)
- [参考站截图、双端线框、游戏分镜、灰度和原色对照](research/index.html)
- [四种转场的可操作对照实验](research/motion.html)
- [正式站原速导航录屏](research/samples/navigation.webm)
- [生产验收记录](research/qa.md)

`research/` 随项目源码交付；`dist/` 是面向访客的博客。把构建目录部署到域名根路径即可。托管服务可把未匹配路径指向 `404.html` 并返回 HTTP 404。

## 素材

头像与文章里的桔梗图版由内置图像生成工具制作。头像提示为「蓝发、中性原创动漫角色、三分之二侧脸、星形发夹、白色与钴蓝衣领、适合圆形头像裁切」；图版提示为「深普鲁士蓝底的桔梗蓝晒植物图、白色叶脉、满版、无文字」。站标是原创几何图形。实心导航与 GitHub 字形来自 [Pictogrammers](public/licenses/material-design-icons.txt)，哔哩哔哩字形来自 [Simple Icons](public/licenses/simple-icons.md)。
