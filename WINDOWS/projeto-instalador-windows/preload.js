// Preload — roda em contexto isolado, entre o main process e o app.html.
// Hoje não expõe nenhuma API extra: o app.html já funciona sozinho com
// IndexedDB (via Chromium embutido) e window.print(). Este arquivo existe
// como ponto de extensão seguro para o futuro, por exemplo:
//   - contextBridge.exposeInMainWorld('leunameNative', { ... })
//     para impressão térmica direta, leitor de código de barras USB,
//     ou upload assinado para Google Drive/OneDrive/Dropbox via um
//     fluxo OAuth nativo (evitando abrir navegador externo).
//
// Nada aqui simula funcionalidade: é apenas o "gancho" seguro (contextBridge)
// que uma integração nativa real usaria, seguindo as boas práticas de
// segurança do Electron (contextIsolation: true, nodeIntegration: false).

const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('leunameDesktop', {
  isDesktop: true,
  platform: process.platform,
});
