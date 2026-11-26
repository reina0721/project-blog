# 蓝笺

用 Astro 构建的中文个人站。首页介绍站主，博客按发布时间选文，归档按年份找文，友链以站点头像和名字浏览。文章、导航与外部链接可在关闭 JavaScript 时使用。

## 本地运行

环境为 Node.js 24.19 与 pnpm 12.9.1。首次进入项目后运行 `pnpm install --frozen-lockfile`。

| 命令 | 用途 |
| --- | --- |
| `pnpm dev` | 访问 `http://127.0.0.1:4320/`，保存源码后自动更新 |
| `pnpm check` | 检查 Astro 和 TypeScript |
| `pnpm build` | 在 `dist/` 生成可以部署的静态文件 |
| `pnpm preview` | 访问 `http://127.0.0.1:4323/`，预览最近一次生产构建 |
| `pnpm research` | 在本机 4322 端口打开研究图册、录屏与转场实验 |

开发时打开 `pnpm dev` 终端打印的地址。Astro 和 Vite 会在保存样式、组件或 Markdown 后自动更新预览。`pnpm preview` 读取 `dist/`，改动源码后需要重新运行 `pnpm build` 才能看到变化。Astro 客户端路由在开发预览和部署后的站点都可用，点击站内链接会切换页面内容并更新地址栏，保留当前浏览器文档。文章地址也可直接打开或手动刷新。

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

文章里的图表用 `mermaid` 代码围栏编写。正文显示 SVG 缩略图，点击可进入图廊。可以用 `accTitle` 给图命名，作为缩略图的替代文本和图廊标题。

首次编写或修改图表时，在本地运行 `pnpm exec playwright-core install chromium`。编辑图表时，`pnpm dev` 可以即时预览。发布前运行 `pnpm diagrams:generate`，将 `src/generated/mermaid/` 新增的 SVG 和元数据与 Markdown 一起提交。在支持 Playwright 的精简 Linux 环境，可通过 `pnpm exec playwright-core install --with-deps chromium` 同时安装系统依赖。

编辑 [好友数据](src/data/friends.ts) 的 `friends` 数组即可增加友链。每项填写 `name`、`url`，可选 `avatar`、`description`。缺头像时使用站名首字。

## 主题和交互

从 `site.themeColor` 修改种子蓝。[全站样式](src/styles/global.css) 提供文字、表面和 Material 的颜色角色。按下控件时，水波样式取决于入口。

| 按下的位置 | 水波 |
| --- | --- |
| 归档页各年份下的文章行 | Material Web 2.5.0 绘制渐变水波，圆的外缘逐渐变淡。 |
| 首页最近文章、博客文章卡、友链、主导航和各页按钮 | 从触点扩出均匀填色的半透明圆，由 Angular Material 21.2.14 的 `RippleRenderer` 绘制。归档页首的「浏览文章摘要」也使用这种实心水波，宽屏时它位于右上角。 |

- [按钮封装](src/components/ActionLink.astro) 在静态 HTML 中提供链接，加载后交给 `md-filled-tonal-button`、`md-text-button` 或 `md-icon-button` 的链接模式。图标单独响应悬停和按住。
- [文章与友链封装](src/components/MaterialEntry.astro) 使用 `md-list-item type="link"`。博客和首页的每篇文章各有独立的 `md-elevated-card`，归档按年使用 `md-list`。文章入口的悬停层透明，友链保留组件自带的悬停反馈。
- [主导航](src/components/SiteNav.astro) 从同一份配置生成五个栏目。桌面显示顶部导航。手机从左侧向右拖动，或点右上角菜单按钮，正文会向右让位，露出抽屉。点露出的页面、向左拖或按 Escape 都能收回。

[首页样式](src/styles/home.css) 控制头像、网名和社区入口的出场间隔。内页用 `data-enter-group` 标出依次进入的标题、文章卡或年份组。[转场实现](src/lib/motion.ts) 和[动效样式](src/styles/motion.css) 负责旧页退场、标题交接与内容载入。正文行宽和卡片间距在[页面样式](src/styles/pages.css)调整。

首页首次打开和刷新时，左上角的站名与 Logo 从第一帧起就固定显示。从首页、博客或归档点开文章时，站标向上退出，返回箭头从下方进入。连读下一篇时箭头留在原位。退出文章回到普通页面时，箭头向下退出，站标从上方归位。从归档连续阅读多篇后，点箭头仍会回到最初选择的那一行。浏览器的后退键可以逐篇回看。直接打开分享链接时，箭头通往博客列表。[阅读来源与位置恢复](src/lib/reading-origin.ts)

## 研究与验收

- [首页冷加载、刷新与进出文章的页头实拍对照](research/comparison/brand-back.webp)
- [博客文章卡、归档文章行与归档页首按钮的水波实拍](research/comparison/ripple-modes.webp)
- [三站按下、换页与返回的双端对照](research/comparison/index.html) · [桌面选文与左上返回录像](research/comparison/current-desktop.webm) · [手机抽屉、归档与连续读文返回录像](research/comparison/current-mobile.webm)
- [参考站截图、双端线框、游戏分镜、灰度和原色对照](research/index.html)
- [四种转场的可操作对照实验](research/motion.html)
- [正式站原速导航录屏](research/samples/navigation.webm)
- [生产验收记录](research/qa.md)

`research/` 随项目源码交付；`dist/` 是面向访客的博客。把构建目录部署到域名根路径即可。托管服务可把未匹配路径指向 `404.html` 并返回 HTTP 404。

在阿里云 ESA Pages 中使用 Node.js `24.x`，安装命令 `pnpm install`，构建命令 `pnpm build`，静态资源目录 `dist`。构建直接读取仓库中的 Mermaid SVG。

## 素材

头像与文章里的桔梗图版由内置图像生成工具制作。头像提示为「蓝发、中性原创动漫角色、三分之二侧脸、星形发夹、白色与钴蓝衣领、适合圆形头像裁切」；图版提示为「深普鲁士蓝底的桔梗蓝晒植物图、白色叶脉、满版、无文字」。站标是原创几何图形。实心导航与 GitHub 字形来自 [Pictogrammers](public/licenses/material-design-icons.txt)，哔哩哔哩字形来自 [Simple Icons](public/licenses/simple-icons.md)。
