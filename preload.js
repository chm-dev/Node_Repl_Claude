const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  executeCode: (code) => ipcRenderer.invoke('execute-code', code),
  
  // Listen for console output
  onConsoleOutput: (callback) => {
    ipcRenderer.on('console-output', (event, data) => {
      callback(event, data);
    });
    return () => ipcRenderer.removeListener('console-output', callback);
  },
  
  // Listen for menu events
  onMenuNew: (callback) => {
    ipcRenderer.on('menu-new', callback);
    return () => ipcRenderer.removeListener('menu-new', callback);
  },
  
  onMenuClear: (callback) => {
    ipcRenderer.on('menu-clear', callback);
    return () => ipcRenderer.removeListener('menu-clear', callback);
  },
  
  onMenuRun: (callback) => {
    ipcRenderer.on('menu-run', callback);
    return () => ipcRenderer.removeListener('menu-run', callback);
  },
  
  // Get app version
  getAppVersion: () => ipcRenderer.invoke('app-version')
});
