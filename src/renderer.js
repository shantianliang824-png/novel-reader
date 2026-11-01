'use strict';

const bridge = window.api;

const DEFAULT_SETTINGS = {
  fontSize: 18,
  lineHeight: 1.9,
  fontFamily: 'serif',
  theme: 'light',
  readingWidth: 720,
  paragraphIndent: true
};

let settings = { ...DEFAULT_SETTINGS };
let shelf = [];
let progress = {};
let bookmarks = {};

let currentBook = null;
let currentContent = '';
let chapters = [];
let currentChapter = 0;

const $ = (s) => document.querySelector(s);
const shelfView = $('#shelfView');
const readerView = $('#readerView');
const shelfGrid = $('#shelfGrid');
const emptyState = $('#emptyState');
const searchInput = $('#searchInput');
const importBtn = $('#importBtn');
const backBtn = $('#backBtn');
const readerScroll = $('#readerScroll');
const readerContent = $('#readerContent');
const readerBookTitle = $('#readerBookTitle');
const readerChapterTitle = $('#readerChapterTitle');
const readerProgress = $('#readerProgress');
const progressFill = $('#progressFill');
const tocBtn = $('#tocBtn');
const bookmarkBtn = $('#bookmarkBtn');
const settingsBtn = $('#settingsBtn');
const tocPanel = $('#tocPanel');
const tocList = $('#tocList');
const bookmarkPanel = $('#bookmarkPanel');
const bookmarkList = $('#bookmarkList');
const addBookmarkBtn = $('#addBookmarkBtn');
const settingsPanel = $('#settingsPanel');
const overlay = $('#overlay');

const renameModal = $('#renameModal');
const renameInput = $('#renameInput');
let renameTargetId = null;

const themeSwitch = $('#themeSwitch');
const fontSizeRange = $('#fontSizeRange');
const fontSizeVal = $('#fontSizeVal');
const lineHeightRange = $('#lineHeightRange');
const fontFamilySelect = $('#fontFamilySelect');
const widthRange = $('#widthRange');
const indentToggle = $('#indentToggle');

// ---------- 工具 ----------
function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function formatSize(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}
function formatTime(ts) {
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function toast(msg) {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 2000);
}

// ---------- 初始化 ----------
async function init() {
  try {
    settings = { ...DEFAULT_SETTINGS, ...(await bridge.getStore('settings')) };
    shelf = (await bridge.getStore('bookshelf')) || [];
    progress = (await bridge.getStore('progress')) || [];
    bookmarks = (await bridge.getStore('bookmarks')) || [];
    bindSettingsControls();
    applySettings();
    renderShelf();
    window.__jianyueReady = true;
  } catch (err) {
    window.__jianyueError = String((err && err.stack) || err);
  }
}

// ---------- 视图切换 ----------
function showView(name) {
  const reader = name === 'reader';
  shelfView.classList.toggle('active', !reader);
  readerView.classList.toggle('active', reader);
  if (!reader) {
    closePanels();
    renderShelf();
  }
}

// ---------- 书架 ----------
function sortedShelf() {
  return [...shelf].sort((a, b) => (b.lastReadAt || b.importedAt || 0) - (a.lastReadAt || a.importedAt || 0));
}
function renderShelf() {
  const q = (searchInput.value || '').trim().toLowerCase();
  const list = sortedShelf().filter((b) => !q || (b.title || '').toLowerCase().includes(q));
  shelfGrid.innerHTML = list.map(cardHtml).join('');
  emptyState.classList.toggle('hidden', list.length > 0);
}
function cardHtml(b) {
  const p = progress[b.id];
  const total = (p && p.totalChapters) || 1;
  const idx = (p && typeof p.chapterIndex === 'number') ? p.chapterIndex : 0;
  const ratio = (p && typeof p.ratio === 'number') ? p.ratio : 0;
  const pct = Math.min(100, Math.max(0, Math.round((idx + ratio) / total * 100)));
  const started = p && (p.chapterIndex > 0 || p.ratio > 0);
  const chLabel = p && p.totalChapters ? `读至 ${idx + 1}/${total} 章` : '未开始';
  const coverChar = escapeHtml((b.title || '').trim().charAt(0) || '书');
  return `
    <div class="book-card" data-id="${b.id}">
      <div class="book-cover">${coverChar}</div>
      <div class="book-info">
        <div class="book-title" title="${escapeHtml(b.title)}">${escapeHtml(b.title)}</div>
        <div class="book-meta">${formatSize(b.size)} · ${started ? pct + '%' : chLabel}</div>
        <div class="book-progress"><div class="bar"><i style="width:${pct}%"></i></div></div>
        <div class="book-actions">
          <button class="mini-btn" data-act="rename">重命名</button>
          <button class="mini-btn danger" data-act="delete">删除</button>
        </div>
      </div>
    </div>`;
}

async function doImport() {
  const results = await bridge.importFiles();
  if (!results || !results.length) return;
  const ok = results.filter((r) => r.ok).length;
  const fail = results.length - ok;
  shelf = (await bridge.getStore('bookshelf')) || [];
  renderShelf();
  if (ok) toast(`已导入 ${ok} 本${fail ? `，${fail} 本失败` : ''}`);
  else toast('导入失败');
}

async function deleteBook(id) {
  const b = shelf.find((x) => x.id === id);
  if (!b) return;
  const sure = confirm(`确定删除《${b.title}》吗？该操作不可撤销。`);
  if (!sure) return;
  await bridge.deleteBook(id);
  shelf = shelf.filter((x) => x.id !== id);
  delete progress[id];
  delete bookmarks[id];
  renderShelf();
  toast('已删除');
}

function openRename(id) {
  const b = shelf.find((x) => x.id === id);
  if (!b) return;
  renameTargetId = id;
  renameInput.value = b.title;
  renameModal.classList.remove('hidden');
  renameInput.focus();
  renameInput.select();
}
function closeRename() {
  renameModal.classList.add('hidden');
  renameTargetId = null;
}
async function saveRename() {
  if (!renameTargetId) return;
  const name = renameInput.value.trim();
  if (!name) { toast('书名不能为空'); return; }
  const b = shelf.find((x) => x.id === renameTargetId);
  if (b) {
    b.title = name;
    await bridge.setStore('bookshelf', shelf);
    renderShelf();
    if (currentBook && currentBook.id === b.id) { currentBook.title = name; readerBookTitle.textContent = name; }
  }
  closeRename();
  toast('已重命名');
}

// ---------- 阅读 ----------
async function openBook(id) {
  const entry = shelf.find((b) => b.id === id);
  if (!entry) return;
  try {
    const res = await bridge.readBook(id);
    currentBook = entry;
    currentContent = res.content;
    chapters = splitChapters(currentContent);

    const saved = progress[id];
    if (saved && Number.isInteger(saved.chapterIndex) && saved.chapterIndex >= 0 && saved.chapterIndex < chapters.length) {
      currentChapter = saved.chapterIndex;
    } else {
      currentChapter = 0;
    }

    progress[id] = progress[id] || {};
    progress[id].chapterIndex = currentChapter;
    progress[id].totalChapters = chapters.length;

    showView('reader');
    renderChapter();
    const ratio = saved && typeof saved.ratio === 'number' ? saved.ratio : 0;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const max = readerScroll.scrollHeight - readerScroll.clientHeight;
      readerScroll.scrollTop = Math.max(0, ratio) * max;
    }));
    renderToc();
    renderBookmarks();
  } catch (err) {
    toast('打开失败：' + ((err && err.message) || err));
  }
}

function splitChapters(text) {
  const lines = text.split(/\r\n|\r|\n/);
  const headingRe = /^\s*(?:第\s*[0-9０-９一二三四五六七八九十百千万零〇两]+[0-9０-９一二三四五六七八九十百千万零〇两]*\s*[章节卷部回集话篇]|序章|序言|楔子|引子|前言|后记|尾声|终章|尾章|番外|外传|正文)\s*[^\n]{0,30}$/;
  const marks = [];
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t) continue;
    if (t.length <= 40 && headingRe.test(t)) marks.push(i);
  }
  if (!marks.length) return [{ title: '全文', lines }];
  const out = [];
  if (marks[0] > 0) out.push({ title: '开篇', lines: lines.slice(0, marks[0]) });
  for (let j = 0; j < marks.length; j++) {
    const from = marks[j];
    const to = j + 1 < marks.length ? marks[j + 1] : lines.length;
    const title = lines[from].trim();
    out.push({ title: title || ('第 ' + (j + 1) + ' 章'), lines: lines.slice(from, to) });
  }
  return out;
}

function renderChapter() {
  const ch = chapters[currentChapter];
  const html = ch.lines
    .map((l) => l.replace(/\s+$/, ''))
    .filter((l) => l.trim() !== '')
    .map((l) => '<p>' + escapeHtml(l) + '</p>')
    .join('');
  readerContent.innerHTML = html;
  readerBookTitle.textContent = currentBook.title;
  readerChapterTitle.textContent = ch.title;
  updateProgress();
}

function gotoChapter(i) {
  if (i < 0 || i >= chapters.length) return;
  currentChapter = i;
  readerScroll.scrollTop = 0;
  renderChapter();
  renderToc();
  saveProgressNow();
}

function getScrollRatio() {
  const max = readerScroll.scrollHeight - readerScroll.clientHeight;
  if (max <= 0) return 0;
  return Math.min(1, Math.max(0, readerScroll.scrollTop / max));
}
function updateProgress() {
  if (!currentBook || !chapters.length) return;
  const ratio = getScrollRatio();
  const total = chapters.length;
  const overall = Math.round((currentChapter + ratio) / total * 100);
  readerProgress.textContent = `${currentChapter + 1} / ${total} 章 · ${overall}%`;
  progressFill.style.width = overall + '%';
}

let saveTimer = null;
function saveProgressSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveProgressNow, 400);
}
function saveProgressNow() {
  if (!currentBook) return;
  progress[currentBook.id] = {
    chapterIndex: currentChapter,
    ratio: getScrollRatio(),
    totalChapters: chapters.length,
    updatedAt: Date.now()
  };
  bridge.setStore('progress', progress);
  const b = shelf.find((x) => x.id === currentBook.id);
  if (b) { b.lastReadAt = Date.now(); bridge.setStore('bookshelf', shelf); }
}

// ---------- 目录 ----------
function renderToc() {
  if (!chapters.length) { tocList.innerHTML = '<div class="muted">暂无章节</div>'; return; }
  tocList.innerHTML = chapters.map((c, i) =>
    `<div class="toc-item ${i === currentChapter ? 'active' : ''}" data-i="${i}">
       <span class="toc-title">${escapeHtml(c.title)}</span>
       <span class="toc-count">${countLines(c.lines)}</span>
     </div>`).join('');
  const act = tocList.querySelector('.toc-item.active');
  if (act) act.scrollIntoView({ block: 'nearest' });
}
function countLines(lines) {
  let n = 0;
  for (const l of lines) if (l.trim()) n++;
  return n + ' 行';
}

// ---------- 书签 ----------
function renderBookmarks() {
  const list = currentBook ? (bookmarks[currentBook.id] || []) : [];
  if (!list.length) { bookmarkList.innerHTML = '<div class="muted">暂无书签</div>'; return; }
  bookmarkList.innerHTML = list.map((b) => `
    <div class="bm-item" data-bid="${b.id}">
      <div class="bm-head">
        <span class="bm-ch">第 ${b.chapterIndex + 1} 章</span>
        <button class="bm-del" data-del="${b.id}">删除</button>
      </div>
      <div class="bm-text">${escapeHtml(b.text)}</div>
      <div class="bm-time">${formatTime(b.createdAt)}</div>
    </div>`).join('');
}
function addBookmark() {
  if (!currentBook || !chapters.length) return;
  const ch = chapters[currentChapter];
  const firstText = (ch.lines.find((l) => l.trim()) || ch.title).trim();
  const bm = {
    id: 'bm-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    chapterIndex: currentChapter,
    ratio: getScrollRatio(),
    text: firstText.slice(0, 40),
    createdAt: Date.now()
  };
  (bookmarks[currentBook.id] = bookmarks[currentBook.id] || []).push(bm);
  bridge.setStore('bookmarks', bookmarks);
  renderBookmarks();
  toast('已添加书签');
}

// ---------- 设置 ----------
function bindSettingsControls() {
  themeSwitch.querySelectorAll('[data-theme]').forEach((btn) => {
    btn.addEventListener('click', () => {
      settings.theme = btn.dataset.theme;
      applySettings();
      persistSettings();
    });
  });
  fontSizeRange.addEventListener('input', () => {
    settings.fontSize = Number(fontSizeRange.value);
    applySettings();
  });
  fontSizeRange.addEventListener('change', persistSettings);
  lineHeightRange.addEventListener('input', () => {
    settings.lineHeight = Number(lineHeightRange.value);
    applySettings();
  });
  lineHeightRange.addEventListener('change', persistSettings);
  fontFamilySelect.addEventListener('change', () => {
    settings.fontFamily = fontFamilySelect.value;
    applySettings();
    persistSettings();
  });
  widthRange.addEventListener('input', () => {
    settings.readingWidth = Number(widthRange.value);
    applySettings();
  });
  widthRange.addEventListener('change', persistSettings);
  indentToggle.addEventListener('change', () => {
    settings.paragraphIndent = indentToggle.checked;
    applySettings();
    persistSettings();
  });
}
function persistSettings() {
  bridge.setStore('settings', settings);
}
function applySettings() {
  document.body.dataset.theme = settings.theme;
  readerContent.style.fontSize = settings.fontSize + 'px';
  readerContent.style.lineHeight = settings.lineHeight;
  readerContent.style.maxWidth = settings.readingWidth + 'px';
  readerContent.style.fontFamily = settings.fontFamily === 'serif'
    ? 'Georgia, "Songti SC", "SimSun", "Noto Serif CJK SC", serif'
    : 'system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", "Segoe UI", sans-serif';
  document.body.classList.toggle('indent', settings.paragraphIndent);

  themeSwitch.querySelectorAll('[data-theme]').forEach((b) => b.classList.toggle('active', b.dataset.theme === settings.theme));
  fontSizeRange.value = settings.fontSize;
  fontSizeVal.textContent = settings.fontSize;
  lineHeightRange.value = settings.lineHeight;
  fontFamilySelect.value = settings.fontFamily;
  widthRange.value = settings.readingWidth;
  indentToggle.checked = settings.paragraphIndent;
}

// ---------- 面板 ----------
function openPanel(p) {
  closePanels();
  p.classList.add('open');
  overlay.classList.remove('hidden');
}
function closePanels() {
  [tocPanel, bookmarkPanel, settingsPanel].forEach((p) => p.classList.remove('open'));
  overlay.classList.add('hidden');
}

// ---------- 事件 ----------
importBtn.addEventListener('click', doImport);
searchInput.addEventListener('input', renderShelf);
backBtn.addEventListener('click', () => { saveProgressNow(); showView('shelf'); });

shelfGrid.addEventListener('click', (e) => {
  const card = e.target.closest('.book-card');
  if (!card) return;
  const id = card.dataset.id;
  const actBtn = e.target.closest('[data-act]');
  if (actBtn) {
    if (actBtn.dataset.act === 'rename') openRename(id);
    else if (actBtn.dataset.act === 'delete') deleteBook(id);
    return;
  }
  openBook(id);
});

tocBtn.addEventListener('click', () => openPanel(tocPanel));
bookmarkBtn.addEventListener('click', () => openPanel(bookmarkPanel));
settingsBtn.addEventListener('click', () => openPanel(settingsPanel));
addBookmarkBtn.addEventListener('click', addBookmark);
overlay.addEventListener('click', closePanels);
document.querySelectorAll('.panel-close').forEach((b) => b.addEventListener('click', closePanels));

tocList.addEventListener('click', (e) => {
  const item = e.target.closest('.toc-item');
  if (!item) return;
  gotoChapter(Number(item.dataset.i));
  closePanels();
});

bookmarkList.addEventListener('click', (e) => {
  const del = e.target.closest('[data-del]');
  if (del) {
    const bid = del.dataset.del;
    bookmarks[currentBook.id] = (bookmarks[currentBook.id] || []).filter((b) => b.id !== bid);
    bridge.setStore('bookmarks', bookmarks);
    renderBookmarks();
    return;
  }
  const item = e.target.closest('.bm-item');
  if (item) {
    const bm = (bookmarks[currentBook.id] || []).find((b) => b.id === item.dataset.bid);
    if (bm) {
      currentChapter = bm.chapterIndex;
      renderChapter();
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const max = readerScroll.scrollHeight - readerScroll.clientHeight;
        readerScroll.scrollTop = (bm.ratio || 0) * max;
      }));
      closePanels();
    }
  }
});

readerScroll.addEventListener('scroll', () => { updateProgress(); saveProgressSoon(); });

document.getElementById('renameCancel').addEventListener('click', closeRename);
document.getElementById('renameOk').addEventListener('click', saveRename);
renameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveRename(); });

document.addEventListener('keydown', (e) => {
  if (!renameModal.classList.contains('hidden')) return;
  if (readerView.classList.contains('active')) {
    if (e.key === 'Escape') closePanels();
    else if (e.key === 'ArrowRight') gotoChapter(currentChapter + 1);
    else if (e.key === 'ArrowLeft') gotoChapter(currentChapter - 1);
  }
});

window.addEventListener('beforeunload', saveProgressNow);

init();
