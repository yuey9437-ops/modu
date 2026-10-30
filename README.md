# 墨读 · 手机电子书阅读器（PWA）

一个给手机看的中文电子书阅读器。纯 HTML/CSS/JS，无框架、无构建步骤、无后端；
用 Safari 打开后「添加到主屏幕」，就和原生 App 一样全屏运行，装一次之后离线也能读。

真机尺寸（390×844，2 倍图）截图：

| 书架 | 阅读（工具条） | 目录 |
| --- | --- | --- |
| ![书架](_preview/01-shelf.png) | ![阅读](_preview/05-toolbar.png) | ![目录](_preview/03-toc.png) |

| 阅读设置 | 夜间阅读 | 夜间书架 |
| --- | --- | --- |
| ![设置](_preview/04-settings.png) | ![夜间](_preview/06-night.png) | ![夜间书架](_preview/07-shelf-night.png) |

---

## 一、功能

**书架**
- 卡片式书架，显示阅读进度条；顶部「继续阅读」直接回到上次的位置
- 右上角月亮按钮一键切夜间模式（书架也会记住）

**阅读**
- 真正的**分页翻页**（CSS 多栏排版），不是上下滚动——左右滑动翻页，翻到章末自动进下一章
- 左 1/3 轻点上一页、右 1/3 下一页、中间轻点呼出工具条
- 工具条：目录、上一章 / 下一章、字号、背景
- 目录抽屉：章节列表，当前章高亮
- 阅读设置：字号 14–26、行距三档、字体三档（宋 / 黑 / 楷，楷体为内置霞鹜文楷，真机 iOS 也不会掉回宋体）、背景四档（纸白 / 米黄 / 护眼 / 夜间）
- 进度**自动保存**（章节 + 页码 + 百分比），关掉再打开接着读

**技术**
- 版面按「整行」对齐，最后一行永远不会被切一半；换字号 / 转屏后在**同一比例位置**重排
- 适配 iPhone 刘海与底部安全区（`env(safe-area-inset-*)`），无地址栏全屏
- Service Worker 离线缓存：装到桌面后断网也能打开
- 桌面浏览器打开时自动套一个手机画框，方便调试

## 二、跑起来

### 本机预览（Windows）
```bash
cd ebook-reader
python -m http.server 8848
```
浏览器打开 <http://127.0.0.1:8848>。用 Chrome DevTools 的「设备模拟 → iPhone 14」看手机效果。

### 手机上打开（同一个 Wi-Fi，先试效果）
```bash
cd ebook-reader
python -m http.server 8848 --bind 0.0.0.0
ipconfig        # 找到本机内网 IP，例如 192.168.1.20
```
iPhone 的 Safari 打开 `http://192.168.1.20:8848` 即可。
注意：**http 下 Service Worker 不生效**（浏览器规定），所以此时不能离线，也不能可靠地「添加到主屏幕」。
要真正装到桌面，必须走下面的公网部署（https）。

### 部署到公网（免费，5 分钟）
三种任选，都是纯静态、拖上去就行：

1. **GitHub Pages**：新建仓库 → 上传 `ebook-reader/` 里的全部文件 → Settings → Pages → Source 选 `main` / 根目录 → 得到 `https://<用户名>.github.io/<仓库名>/`
2. **Cloudflare Pages / Vercel / Netlify**：把整个 `ebook-reader` 目录拖进后台，框架选「静态」，直接出 https 域名
3. **国内**：腾讯云 / 阿里云 OSS 静态网站托管（需要备案域名；否则还是用上面两家）

> 文件路径全部是相对路径，放在子目录（`/ebook-reader/`）或网站根目录都能跑，不用改代码。
> 现成的上传包：`modu-pwa.zip`（已剔除原始 txt 和截图，约 1 MB）。

### 在 iPhone 上装成 App
1. Safari 打开部署好的网址
2. 点底部「分享」→「添加到主屏幕」→ 添加
3. 桌面上出现「墨读」图标，点开是全屏无地址栏的独立 App，断网也能读

装好之后这几个 iOS 细节已经处理好了：
- **状态栏文字**：浅色主题用深色字、夜间主题用浅色字（`apple-mobile-web-app-status-bar-style` 随主题切换）
- 刘海 / 底部横条留白走 `env(safe-area-inset-*)`，正文不会被状态栏或 Home 条压住
- 首次打开底部弹出「添加到主屏幕」提示，9 秒后自动淡出，只出现一次
- 点按钮不发蓝、双击不缩放、长按不弹菜单，手感和原生一致

## 三、关于「上架 App Store 的正式 App」

这台机器是 Windows，**只能做 PWA，不能出 IPA**——iOS 任何原生包都必须用 macOS 上的 Xcode 签名。
如果以后真要上架：

1. 需要一个 Mac（或用 GitHub Actions 的 macOS runner）＋ Apple 开发者账号（$99/年）
2. 用 **Capacitor** 把现在这套代码直接包成 iOS 工程：
   ```bash
   npm i -D @capacitor/cli @capacitor/core @capacitor/ios
   npx cap init modu com.example.modu --web-dir=.
   npx cap add ios && npx cap sync ios && npx cap open ios
   ```
   现在这套代码已经是「一个静态网站」，Capacitor 可以原样塞进 WKWebView，零改动。
3. 好处：能进 App Store、能用系统手势；坏处：每年 99 美元 + 审核。

**结论**：先用 PWA 装到桌面用，体验和原生 App 几乎没区别（全屏、离线、有图标、有启动图）；
真需要上架再走 Capacitor，现在的代码不用改。

## 四、加书

书都是公版书（Project Gutenberg），已经转成简体、按章切好、生成封面。

```
assets/books/
  index.json          # 书架索引：id / title / author / intro / cover / chapters / chars
  liaozhai.json       # 一本书一个文件：{ id, title, author, chars, chapters: [{ t, p: [段落...] }] }
  _raw/               # Gutenberg 原始 txt / epub（构建用，可删）
assets/covers/*.jpg   # 600×800 封面（脚本按书名 + 配色生成）
```

加一本新书：
1. 在 `tools/fetch_books.py` 的 `BOOKS` 里加 `(gutenberg_id, slug)`
2. 在 `tools/build_books.py` 的 `BOOKS` 里加一条（标题、作者、简介、封面配色），并在 `HEAD` 里给它一条章节标题正则
3. `python tools/build_books.py` → 生成 `assets/books/<slug>.json` + 封面 + 更新 `index.json`

现有 4 本：聊斋志异（493 篇）、浮生六记（4 卷）、老残游记（21 回）、论语（21 篇）。

## 五、体积

运行时要加载的东西合计约 6.5 MB（不含按需加载的书）：字体分片 4.27 MB、策展 JSON 1.86 MB、封面 124 KB、图标 76 KB、代码 137 KB。
书是**按需加载**的：打开书架只拉 `index.json`（762 字节）+ 4 张封面；点开某本书才拉它的正文。
托管方默认开 gzip/brotli，聊斋那本 1.4 MB 的 JSON 实际传输约 350 KB。

**字体也是按需的**：`css/font-kai.css` 把霞鹜文楷拆成 89 个 `unicode-range` 分片，浏览器只下载「当前这页出现的字」所在的分片（一页通常几百 KB），进过就长期缓存。若一直用宋体/黑体，这些分片一个都不会下载。

`assets/books/_raw/` 是 Gutenberg 原始 txt/epub，只有重新构建书才需要，部署时可以删掉（省 3.2 MB，打包脚本已排除）。

### 为什么内置楷体

iOS 上的 Safari 不把系统「楷体」暴露给网页（`Kaiti SC` / `STKaiti` 都拿不到），选「楷体」实际回退成宋体——在真机上截图确认过。
所以本应用自带 **霞鹜文楷（LXGW WenKai）Regular**，SIL Open Font License 1.1，`assets/fonts/` + `css/font-kai.css`。
全库 5496 个字种里覆盖 5309 个；缺的 187 个是古籍生僻字（如 㑩 䜩 觍），在正文里合计出现 1731 次，这些字回落到系统宋体，肉眼看基本一致。

## 六、目录结构

```
ebook-reader/
├─ index.html            单页：书架 + 阅读器 + 目录抽屉 + 设置面板
├─ css/app.css           全部样式（四套主题、阅读排版、安全区、桌面预览画框）
├─ css/font-kai.css      霞鹜文楷 89 个 unicode-range 分片（按需下载）
├─ assets/fonts/         上述分片的 woff2 实体（4.27 MB，SIL OFL 1.1）
├─ js/
│  ├─ main.js            启动：拉书库、绑按钮、iOS 安装提示、注册 SW
│  ├─ shelf.js           书架渲染（继续阅读卡 + 封面网格 + 进度条）
│  ├─ reader.js          阅读器核心：CSS 多栏分页、翻页、手势、进度、设置重排
│  ├─ store.js           localStorage：主题/字号/行距/字体、每本书的阅读进度
│  └─ ui.js              toast 等小组件
├─ sw.js                 离线缓存（导航请求网络优先，静态资源缓存优先）
├─ manifest.webmanifest  PWA 清单（全屏、竖屏、图标、主题色）
├─ assets/
│  ├─ books/             书籍数据 + 索引
│  ├─ covers/            封面
│  └─ icons/             PWA 图标（180/192/512/maskable）
├─ tools/                构建脚本（抓 Gutenberg、切章、转简体、画封面、拼图标）
└─ _preview/             验收截图（真机尺寸 390×844 @3x）
```

## 七、已验证（Chrome/WebKit 内核，390×844）

- 书架、阅读、目录、设置、夜间四套主题全部正常，无横向溢出、无控制台报错
- 跨章翻页：章末下一页自动进下一章；第一章上一页 / 最后一章下一页有提示
- 换字号 17→21：21 页变 32 页，重排后无溢出、位置按比例保持
- 关闭再打开：恢复到「第 1 / 4 章 第 7 / 21 页」，书架卡显示「已读 8%」
- 目录跳章：点第 4 章 → 正文与底部滑块同步
- 进度、主题、字号全部落在 `localStorage`，杀进程不丢

## 八、还能加的

- 翻页动画目前是横向滑动；可加「仿真翻页（书页卷曲）」
- 书签 / 划线笔记 / 全文搜索（书名要改成预建索引）
- 字体：楷体已内置霞鹜文楷（分片按需加载）；宋/黑仍跟随系统（iOS 上是宋体 SC / 苹方）
- 导入本地 epub（需要在前端解压 + 解析，jszip + 简易 OPF 解析）
- 双指捏合调字号