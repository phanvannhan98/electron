const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  selectFolder: () => ipcRenderer.invoke("open-folder-dialog"),
  readFolder: (folderPath) => ipcRenderer.invoke("read-folder", folderPath),
  readFile: (filePath) => ipcRenderer.invoke("read-file", filePath),
  openFileDefault: (filePath) =>
    ipcRenderer.invoke("open-file-default", filePath),
  onOpenFileSuccess: (callback) =>
    ipcRenderer.on("open-file-success", callback),
  onOpenFileError: (callback) => ipcRenderer.on("open-file-error", callback),
});
