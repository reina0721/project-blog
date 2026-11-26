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

从 `site.themeColor` 修改种子蓝。[全站样式](src/styles/global.css) 提供文字、表面和 Material 的颜色角色。按下控件时，水波样式取决于入口。

| 按下的位置 | 水波 |
| --- | --- |
| 归档页各年份下的文章行 | Material Web 2.5.0 绘制渐变水波，圆的外缘逐渐变淡。 |
| 首页最近文章、博客文章卡、友链、主导航和各页按钮 | 从触点扩出均匀填色的半透明圆，由 Angular Material 21.2.14 的 `RippleRenderer` 绘制。归档页首的「浏览文章摘要」也使用这种实心水波，宽屏时它位于右上角。 |

- [按钮封装](src/components/ActionLink.astro) 在静态 HTML 中提供链接，加载后交给 `md-filled-tonal-button`、`md-text-button` 或 `md-icon-button` 的链接模式。图标单独响应悬停和按住。
- [文章与友链封装](src/components/MaterialEntry.astro) 使用 `md-list-item type="link"`。博客和首页的每篇文章各有独立的 `md-elevated-card`，归档按年使用 `md-list`。文章入口的悬停层透明，友链保留组件自带的悬停反馈。
- [主导航](src/components/SiteNav.astro) 提供五个可在新标签页打开的原生链接，使用 `md-icon` 和 `md-focus-ring`。手机上胶囊标记当前栏目，按下时水波在所点导航项内扩散。

[首页样式](src/styles/home.css) 控制头像、网名和社区入口的出场间隔。内页用 `data-enter-group` 标出应先后出现的标题、文章卡或年份组；[转场实现](src/lib/motion-inline.js) 负责路由、所选标题及来源位置，[动效样式](src/styles/motion.css) 控制交接。正文行宽和卡片间距在[页面样式](src/styles/pages.css)调整。

## 研究与验收

- [博客文章卡、归档文章行与归档页首按钮的水波实拍](research/comparison/ripple-modes.webp)
- [三站按下、换页与返回的双端对照](research/comparison/index.html) · [桌面首页与阅读转场录像](research/comparison/current-desktop.webm) · [手机首页与阅读转场录像](research/comparison/current-mobile.webm)
- [参考站截图、双端线框、游戏分镜、灰度和原色对照](research/index.html)
- [四种转场的可操作对照实验](research/motion.html)
- [正式站原速导航录屏](research/samples/navigation.webm)
- [生产验收记录](research/qa.md)

`research/` 随项目源码交付；`dist/` 是面向访客的博客。把构建目录部署到域名根路径即可。托管服务可把未匹配路径指向 `404.html` 并返回 HTTP 404。

## 素材

头像与文章里的桔梗图版由内置图像生成工具制作。头像提示为「蓝发、中性原创动漫角色、三分之二侧脸、星形发夹、白色与钴蓝衣领、适合圆形头像裁切」；图版提示为「深普鲁士蓝底的桔梗蓝晒植物图、白色叶脉、满版、无文字」。站标是原创几何图形。实心导航与 GitHub 字形来自 [Pictogrammers](public/licenses/material-design-icons.txt)，哔哩哔哩字形来自 [Simple Icons](public/licenses/simple-icons.md)。
