const {
  app,
  screen,
  dialog,
  ipcMain,
  shell,
  BrowserWindow,
} = require("electron");
const net = require("net");
const path = require("path");
const express = require("express");
const { exec } = require("child_process");
const fs = require("fs");
const port = 5505;

function createServer() {
  findAvailablePort(port, (availablePort) => {
    const server = express();

    server.use(express.static(path.join(__dirname, "dist")));

    server.get("*", (_, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });

    server.listen(availablePort, () => {
      console.log(`Server is running at http://localhost:${availablePort}`);
    });
  });
}

function findAvailablePort(port, callback) {
  const server = net.createServer();

  server.once("error", (err) => {
    if (err.code === "EADDRINUSE") {
      findAvailablePort(port + 1, callback);
    } else {
      callback(port);
    }
  });

  server.once("listening", () => {
    server.close();
    callback(port);
  });

  server.listen(port);
}

let mainWindow;

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width,
    height,
    autoHideMenuBar: true,
    icon: path.join(__dirname, "public", "app-icon-sm.png"),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.maximize();

  mainWindow.loadURL(`http://localhost:${port}`);

  // mainWindow.webContents.openDevTools();

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    app.quit();
  });
}

app.whenReady().then(() => {
  createServer();

  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// show directory picker
ipcMain.handle("open-folder-dialog", async (e) => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory"],
  });

  if (canceled) {
    return;
  }

  const children = await readFolder(e, filePaths[0]);

  return {
    path: filePaths[0],
    children,
  };
});

// read folder by path
ipcMain.handle("read-folder", readFolder);

async function readFolder(event, folderPath) {
  try {
    const files = await fs.promises.readdir(folderPath, {
      withFileTypes: true,
    });

    const result = await Promise.all(
      files.map(async (file) => {
        const isDirectory = file.isDirectory();
        let children = null;
        let _path = path.join(folderPath, file.name);

        if (isDirectory) {
          children = await readFolder(event, _path);
        }

        return {
          name: file.name,
          isDirectory,
          path: _path,
          children,
        };
      })
    );

    return result;
  } catch (err) {
    return { error: err.message };
  }
}

// read folder by path
ipcMain.handle("read-file", readFile);

async function readFile(event, filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf-8");

    return { success: true, content };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// open file
ipcMain.handle("open-file-default", async (event, filePath) => {
  const command =
    process.platform === "win32"
      ? `start "" "${filePath}"`
      : `open "${filePath}"`;

  const childProcess = exec(command, (error) => {
    if (error) {
      event.sender.send("open-file-error", error.message);
      return;
    }
  });

  childProcess.on("close", (code) => {
    if (code === 0) {
      event.sender.send("open-file-success", "Open file success");
    } else {
      event.sender.send("open-file-error", `Process exited with code ${code}`);
    }
  });
});
