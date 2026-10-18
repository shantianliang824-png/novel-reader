# 简阅 · 小说阅读器

一款**简洁、本地、无广告**的桌面小说阅读器。基于 Electron 构建，支持导入 TXT 文件，自动识别章节，记住阅读进度与书签。

## ✨ 功能特性

- 📥 **导入 TXT**：支持多选导入，自动复制到本地书库，自动识别 UTF-8 / UTF-16 / GBK(GB18030) 编码
- 📚 **书架管理**：导入、删除、重命名、搜索，按最近阅读排序
- 📖 **舒适阅读**：字号、行距、字体（衬线/无衬线）、阅读宽度、首行缩进随心调
- 🌗 **三套主题**：浅色 / 护眼(羊皮纸) / 夜间
- 📑 **章节目录**：自动识别「第X章 / 序章 / 楔子 / 番外」等标题，一键跳转
- 🔖 **书签**：任意位置添加书签，点击快速回到原处
- 💾 **进度记忆**：自动保存阅读位置，再次打开从上次处继续

## 🖥️ 技术栈

- Electron 44（Node.js 主进程 + Chromium 渲染层）
- 原生 HTML / CSS / JavaScript（零前端框架，简洁轻量）
- 数据存储在本地用户目录（`app.getPath('userData')`），不上传任何内容

## 📁 目录结构

```
novel-reader/
├── main.js            # 主进程：窗口、文件读写、编码识别、IPC
├── preload.js         # 预加载：安全的 contextBridge 桥接
├── src/
│   ├── index.html     # 界面结构
│   ├── styles.css     # 样式与三套主题变量
│   └── renderer.js    # 渲染层逻辑：书架/阅读/目录/书签/设置
├── package.json
└── start.bat          # Windows 一键启动脚本
```

## 🚀 本地运行

需要 [Node.js](https://nodejs.org)（≥ 18）与 pnpm。

```bash
# 1. 安装依赖（Electron 二进制会自动下载）
pnpm install

# 2. 启动
pnpm start
```

> 若 pnpm 因安全策略未自动下载 Electron 二进制，可手动执行：
> `node node_modules/electron/install.js`

Windows 用户也可直接双击 `start.bat` 启动。

## 🔐 隐私说明

所有书籍、书签、阅读进度均保存在本机用户目录，**不会联网、不上传任何数据**。

## 📄 License

MIT
