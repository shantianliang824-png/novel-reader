'use strict';

const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

let mainWindow = null;
let dataDir = null;
let booksDir = null;

// ---------- 存储 ----------
function ensureDirs() {
  dataDir = app.getPath('userData');
  booksDir = path.join(dataDir, 'books');
  fs.mkdirSync(booksDir, { recursive: true });
}

function safeKey(key) {
  if (typeof key !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(key)) {
    throw new Error('非法存储键名');
  }
  return key;
}

function readStore(key) {
  try {
    const p = path.join(dataDir, safeKey(key) + '.json');
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch (e) {
    return null;
  }
}

function writeStore(key, value) {
  const p = path.join(dataDir, safeKey(key) + '.json');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(p, JSON.stringify(value, null, 2), 'utf-8');
}

// ---------- 编码识别（UTF-8 / UTF-16 / GB18030） ----------
function decodeBuffer(buf) {
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(buf.subarray(3));
  }
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(buf.subarray(2));
  }
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(buf.subarray(2));
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch (e) {
    try {
      return new TextDecoder('gb18030').decode(buf);
    } catch (e2) {
      return buf.toString('utf-8');
    }
  }
}

// ---------- IPC ----------
function registerIpc() {
  ipcMain.handle('import-files', async () => {
    const win = BrowserWindow.getFocusedWindow() || mainWindow;
    const res = await dialog.showOpenDialog(win, {
      title: '导入小说（TXT）',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: '文本文件', extensions: ['txt'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    });
    if (res.canceled || !res.filePaths || !res.filePaths.length) return [];

    const shelf = readStore('bookshelf') || [];
    const results = [];
    for (const fp of res.filePaths) {
      try {
        const stat = fs.statSync(fp);
        if (!stat.isFile()) {
          results.push({ ok: false, fileName: path.basename(fp), error: '不是文件' });
          continue;
        }
        const id = crypto.randomUUID();
        const ext = (path.extname(fp) || '.txt').toLowerCase();
        const target = path.join(booksDir, id + ext);
        fs.copyFileSync(fp, target);
        const entry = {
          id,
          title: path.basename(fp, path.extname(fp)),
          fileName: path.basename(fp),
          path: target,
          size: stat.size,
          importedAt: Date.now(),
          lastReadAt: null
        };
        shelf.unshift(entry);
        results.push({ ok: true, id, title: entry.title, fileName: entry.fileName, size: entry.size });
      } catch (err) {
        results.push({ ok: false, fileName: path.basename(fp), error: (err && err.message) || String(err) });
      }
    }
    writeStore('bookshelf', shelf);
    return results;
  });

  ipcMain.handle('read-book', (e, id) => {
    const shelf = readStore('bookshelf') || [];
    const entry = shelf.find((b) => b.id === id);
    if (!entry) throw new Error('未找到该书');
    const buf = fs.readFileSync(entry.path);
    return { content: decodeBuffer(buf) };
  });

  ipcMain.handle('delete-book', (e, id) => {
    const shelf = readStore('bookshelf') || [];
    const entry = shelf.find((b) => b.id === id);
    if (entry) {
      try { fs.unlinkSync(entry.path); } catch (e) {}
    }
    writeStore('bookshelf', shelf.filter((b) => b.id !== id));

    const progress = readStore('progress') || {};
    if (progress[id]) { delete progress[id]; writeStore('progress', progress); }
    const bookmarks = readStore('bookmarks') || {};
    if (bookmarks[id]) { delete bookmarks[id]; writeStore('bookmarks', bookmarks); }
    return { ok: true };
  });

  ipcMain.handle('store-get', (e, key) => readStore(key));
  ipcMain.handle('store-set', (e, key, value) => { writeStore(key, value); return { ok: true }; });
  ipcMain.handle('app-info', () => ({ version: app.getVersion(), dataDir }));
}

// ---------- 窗口 ----------
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 720,
    minHeight: 500,
    backgroundColor: '#f6f7f9',
    autoHideMenuBar: true,
    title: '简阅',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
  ensureDirs();
  registerIpc();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
