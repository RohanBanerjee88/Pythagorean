const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  selectFile: () => ipcRenderer.invoke('select-file'),
  uploadFile: (filePath) => ipcRenderer.invoke('upload-file', filePath),
  copyToClipboard: (text) => ipcRenderer.invoke('copy-to-clipboard', text),
  openChat: (linkId) => ipcRenderer.invoke('open-chat', linkId)
});