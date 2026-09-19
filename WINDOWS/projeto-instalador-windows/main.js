// LeuName Gestão — Electron main process
// Este é um SCAFFOLD real de empacotamento desktop. Ele carrega o mesmo
// app.html (cópia em app/index.html) dentro de uma janela nativa do Windows,
// habilita downloads nativos (backup/restauração/CSV/impressão) e cria um
// instalador .exe profissional via electron-builder.
//
// O QUE JÁ FUNCIONA DE VERDADE aqui:
//  - Janela desktop nativa, ícone, menu, atalhos.
//  - Download de arquivos (backup .json, relatórios .csv) via diálogo
//    nativo "Salvar como" do Windows (evento will-download).
//  - Impressão nativa (window.print() funciona normalmente no Chromium).
//  - Instalador .exe profissional via NSIS (electron-builder).
//
// O QUE AINDA PRECISA DE INFRAESTRUTURA REAL (ver README.md):
//  - Assinatura digital do instalador (certificado de code signing) para
//    evitar avisos do SmartScreen do Windows.
//  - Auto-update real (electron-updater + servidor de releases).
//  - Validação de licença online (ver pasta license-server/).

const { app, BrowserWindow, Menu, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

const isSingleInstance = app.requestSingleInstanceLock();
if (!isSingleInstance) {
  app.quit();
}

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: '#F3F6FA',
    title: 'LeuName Gestão',
    icon: path.join(__dirname, 'build', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
    show: false,
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());

  mainWindow.loadFile(path.join(__dirname, 'app', 'index.html'));

  // Downloads nativos: quando o app.html tenta baixar um arquivo (backup,
  // CSV de relatório, etc.) via <a download> ou window.open, o Chromium
  // dispara este evento e abrimos o diálogo nativo "Salvar como".
  mainWindow.webContents.session.on('will-download', (event, item) => {
    const suggested = item.getFilename();
    const savePath = dialog.showSaveDialogSync(mainWindow, {
      title: 'Salvar arquivo — LeuName Gestão',
      defaultPath: path.join(app.getPath('documents'), suggested),
    });
    if (savePath) {
      item.setSavePath(savePath);
    } else {
      item.cancel();
    }
  });

  // Links externos abrem no navegador padrão, não dentro do app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

function buildMenu() {
  const template = [
    {
      label: 'Arquivo',
      submenu: [
        {
          label: 'Fazer backup agora',
          click: () => mainWindow && mainWindow.webContents.executeJavaScript(
            'window.__openQuickNew && window.__openQuickNew("backup");'
          ),
        },
        { type: 'separator' },
        { role: 'quit', label: 'Sair' },
      ],
    },
    {
      label: 'Exibir',
      submenu: [
        { role: 'reload', label: 'Recarregar' },
        { role: 'toggleDevTools', label: 'Ferramentas do desenvolvedor' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Zoom padrão' },
        { role: 'zoomIn', label: 'Aumentar zoom' },
        { role: 'zoomOut', label: 'Diminuir zoom' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Tela cheia' },
      ],
    },
    {
      label: 'Ajuda',
      submenu: [
        {
          label: 'Sobre o LeuName Gestão',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Sobre',
              message: 'LeuName Gestão',
              detail: `Fabricante: LeuName Softwares\nVersão: ${app.getVersion()}`,
            });
          },
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  buildMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
