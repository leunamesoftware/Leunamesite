import { useEffect, useState } from 'react';
import { documentos } from '../dados/banco';
import { codigo } from '../dominio/calculos';
import type { Documento, TipoDocumento } from '../dominio/tipos';
import { useEstado } from '../estado';
import { t, useIdioma } from '../i18n';
import { Topo } from '../componentes/base';
import { ItemDocumento } from './Inicio';

export function Documentos() {
  useIdioma();
  const { ir } = useEstado();
  const [docs, setDocs] = useState<Documento[]>([]);
  const [tipo, setTipo] = useState<TipoDocumento>('orcamento');
  const [busca, setBusca] = useState('');
  useEffect(() => { void documentos.listar().then(setDocs); }, []);

  const q = busca.trim().toLowerCase();
  const lista = docs.filter((d) => d.tipo === tipo && (!q || d.cliente.nome.toLowerCase().includes(q) || codigo(d).toLowerCase().includes(q)));

  return (
    <>
      <Topo titulo={t('nav.documentos')} />
      <main className="conteudo">
        <div className="chips" role="tablist">
          {(['orcamento', 'fatura', 'recibo'] as const).map((tp) => (
            <button key={tp} role="tab" aria-selected={tipo === tp} className={'chip' + (tipo === tp ? ' ativo' : '')} onClick={() => setTipo(tp)}>
              {t('tipos.' + tp)}
            </button>
          ))}
        </div>
        <input id="busca-docs" className="entrada" placeholder={t('comum.buscar')} value={busca} onChange={(e) => setBusca(e.target.value)} />
        <section className="cartao">
          {lista.length ? <div className="lista">{lista.map((d) => <ItemDocumento key={d.id} d={d} />)}</div> : <div className="vazio">{q ? t('vazios.busca') : t('vazios.' + tipo)}</div>}
        </section>
      </main>
      {tipo !== 'recibo' && (
        <button className="fab" onClick={() => ir({ nome: 'editor', tipo })}>
          ＋ {tipo === 'orcamento' ? t('inicio.novoOrcamento') : t('inicio.novaFatura')}
        </button>
      )}
    </>
  );
}
