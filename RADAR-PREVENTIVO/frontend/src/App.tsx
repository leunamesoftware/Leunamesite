import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ProvedorSessao, RotaProtegida, RotaPublica } from './estado/SessaoContexto';
import { LayoutApp } from './componentes/app/LayoutApp';
import { Abertura } from './telas/abertura/Abertura';
import { Entrar } from './telas/entrar/Entrar';
import { CriarConta } from './telas/criar-conta/CriarConta';
import { TelaRadar } from './telas/radar/TelaRadar';
import { TelaDocumentos } from './telas/documentos/TelaDocumentos';
import { TelaCadastrarItem } from './telas/itens/TelaCadastrarItem';
import { TelaEditarItem } from './telas/itens/TelaEditarItem';
import { TelaDetalheItem } from './telas/itens/TelaDetalheItem';
import { TelaAlertas } from './telas/alertas/TelaAlertas';
import { TelaPendente } from './telas/pendente/TelaPendente';
import { rotas } from './rotas';

/** Tela interna: exige login e usa o layout com a barra de navegação. */
function Interna({ children }: { children: ReactNode }) {
  return (
    <RotaProtegida>
      <LayoutApp>{children}</LayoutApp>
    </RotaProtegida>
  );
}

// Cada tela entra aqui conforme a referência visual dela for entregue.
export function App() {
  return (
    <BrowserRouter>
      <ProvedorSessao>
        <Routes>
          <Route path={rotas.abertura} element={<Abertura />} />
          <Route path={rotas.entrar} element={<RotaPublica><Entrar /></RotaPublica>} />
          <Route path={rotas.criarConta} element={<RotaPublica><CriarConta /></RotaPublica>} />
          <Route path={rotas.radar} element={<Interna><TelaRadar /></Interna>} />
          <Route path={rotas.documentos} element={<Interna><TelaDocumentos /></Interna>} />
          <Route path={rotas.novoItem} element={<Interna><TelaCadastrarItem /></Interna>} />
          <Route path="/itens/:id/editar" element={<Interna><TelaEditarItem /></Interna>} />
          <Route path="/itens/:id" element={<Interna><TelaDetalheItem /></Interna>} />
          <Route path={rotas.alertas} element={<Interna><TelaAlertas /></Interna>} />
          <Route path={rotas.conta} element={<RotaProtegida><TelaPendente titulo="Conta" /></RotaProtegida>} />
          <Route path="*" element={<Navigate to={rotas.abertura} replace />} />
        </Routes>
      </ProvedorSessao>
    </BrowserRouter>
  );
}
