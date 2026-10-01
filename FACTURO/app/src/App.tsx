import { ProvedorEstado, useEstado } from './estado';
import { AvisoFlutuante, BarraNav } from './componentes/base';
import { BoasVindas } from './telas/BoasVindas';
import { Inicio } from './telas/Inicio';
import { Documentos } from './telas/Documentos';
import { Editor } from './telas/Editor';
import { Detalhe } from './telas/Detalhe';
import { Clientes, Itens, MeuNegocio } from './telas/Cadastros';
import { Ajustes, Mais } from './telas/Mais';

function Telas() {
  const { negocio, tela } = useEstado();
  if (negocio === undefined) return null;
  if (negocio === null) return <BoasVindas />;
  const comBarra = ['inicio', 'documentos', 'clientes', 'mais'].includes(tela.nome);
  return (
    <div className="app">
      {tela.nome === 'inicio' && <Inicio />}
      {tela.nome === 'documentos' && <Documentos />}
      {tela.nome === 'editor' && <Editor key={tela.id ?? 'novo-' + tela.tipo} id={tela.id} tipo={tela.tipo} />}
      {tela.nome === 'documento' && <Detalhe key={tela.id} id={tela.id} enviar={tela.enviar} />}
      {tela.nome === 'clientes' && <Clientes />}
      {tela.nome === 'itens' && <Itens />}
      {tela.nome === 'negocio' && <MeuNegocio />}
      {tela.nome === 'mais' && <Mais />}
      {tela.nome === 'ajustes' && <Ajustes />}
      {comBarra && <BarraNav />}
      <AvisoFlutuante />
    </div>
  );
}

export function App() {
  return (
    <ProvedorEstado>
      <Telas />
    </ProvedorEstado>
  );
}
