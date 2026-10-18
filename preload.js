'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  importFiles: () => ipcRenderer.invoke('import-files'),
  readBook: (id) => ipcRenderer.invoke('read-book', id),
  deleteBook: (id) => ipcRenderer.invoke('delete-book', id),
  getStore: (key) => ipcRenderer.invoke('store-get', key),
  setStore: (key, value) => ipcRenderer.invoke('store-set', key, value),
  appInfo: () => ipcRenderer.invoke('app-info')
});
