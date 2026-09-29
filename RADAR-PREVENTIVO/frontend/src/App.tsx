import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Abertura } from './telas/abertura/Abertura';
import { Entrar } from './telas/entrar/Entrar';
import { CriarConta } from './telas/criar-conta/CriarConta';
import { TelaPendente } from './telas/pendente/TelaPendente';
import { rotas } from './rotas';

// Cada tela entra aqui conforme a referência visual dela for entregue.
export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path={rotas.abertura} element={<Abertura />} />
        <Route path={rotas.entrar} element={<Entrar />} />
        <Route path={rotas.criarConta} element={<CriarConta />} />
        <Route path={rotas.radar} element={<TelaPendente titulo="Radar" />} />
        <Route path="*" element={<Navigate to={rotas.abertura} replace />} />
      </Routes>
    </BrowserRouter>
  );
}
