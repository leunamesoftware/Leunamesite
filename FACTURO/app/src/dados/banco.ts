// Banco de dados do próprio aparelho (IndexedDB). Funciona sem internet.
import type { Cliente, Documento, Item, Negocio, TipoDocumento } from '../dominio/tipos';

const NOME = 'facturo';
const VERSAO = 1;
type Loja = 'negocio' | 'clientes' | 'itens' | 'documentos' | 'meta';
const LOJAS: Loja[] = ['negocio', 'clientes', 'itens', 'documentos', 'meta'];

let conexao: Promise<IDBDatabase> | null = null;

function abrir(): Promise<IDBDatabase> {
  if (!conexao) {
    conexao = new Promise((resolve, reject) => {
      const req = indexedDB.open(NOME, VERSAO);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const l of LOJAS) if (!db.objectStoreNames.contains(l)) db.createObjectStore(l, { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return conexao;
}

function pedido<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

async function loja(nome: Loja, modo: IDBTransactionMode = 'readonly'): Promise<IDBObjectStore> {
  return (await abrir()).transaction(nome, modo).objectStore(nome);
}

async function todos<T>(nome: Loja): Promise<T[]> {
  return pedido((await loja(nome)).getAll()) as Promise<T[]>;
}
async function um<T>(nome: Loja, id: string): Promise<T | undefined> {
  return pedido((await loja(nome)).get(id)) as Promise<T | undefined>;
}
async function gravar<T>(nome: Loja, valor: T): Promise<T> {
  await pedido((await loja(nome, 'readwrite')).put(valor));
  return valor;
}
async function apagar(nome: Loja, id: string): Promise<void> {
  await pedido((await loja(nome, 'readwrite')).delete(id));
}

export function novoId(): string {
  return crypto.randomUUID();
}
export function agora(): string {
  return new Date().toISOString();
}

// ---- Negócio (um por aparelho nesta versão)
export const negocio = {
  obter: () => um<Negocio>('negocio', 'principal'),
  salvar: (n: Negocio) => gravar('negocio', { ...n, id: 'principal', atualizadoEm: agora() }),
};

// ---- Clientes
export const clientes = {
  listar: async () => (await todos<Cliente>('clientes')).sort((a, b) => a.nome.localeCompare(b.nome)),
  obter: (id: string) => um<Cliente>('clientes', id),
  salvar: (c: Cliente) => gravar('clientes', { ...c, atualizadoEm: agora() }),
  excluir: (id: string) => apagar('clientes', id),
};

// ---- Itens (serviços e produtos)
export const itens = {
  listar: async () => (await todos<Item>('itens')).sort((a, b) => a.nome.localeCompare(b.nome)),
  salvar: (i: Item) => gravar('itens', { ...i, atualizadoEm: agora() }),
  excluir: (id: string) => apagar('itens', id),
};

// ---- Documentos (orçamentos, faturas e recibos)
export const documentos = {
  listar: async () => (await todos<Documento>('documentos')).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)),
  obter: (id: string) => um<Documento>('documentos', id),
  salvar: (d: Documento) => gravar('documentos', { ...d, atualizadoEm: agora() }),
  excluir: (id: string) => apagar('documentos', id),
};

/** Próximo número sequencial de cada tipo de documento. */
export async function proximoNumero(tipo: TipoDocumento): Promise<number> {
  const id = 'contador-' + tipo;
  const atual = (await um<{ id: string; valor: number }>('meta', id))?.valor ?? 0;
  await gravar('meta', { id, valor: atual + 1 });
  return atual + 1;
}

export async function preferencia<T>(chave: string): Promise<T | undefined> {
  return (await um<{ id: string; valor: T }>('meta', 'pref-' + chave))?.valor;
}
export async function definirPreferencia<T>(chave: string, valor: T): Promise<void> {
  await gravar('meta', { id: 'pref-' + chave, valor });
}

// ---- Cópia de segurança (arquivo .json que o usuário guarda onde quiser)
export interface Copia { app: 'facturo'; versao: 1; geradoEm: string; dados: Record<Loja, unknown[]> }

export async function exportarCopia(): Promise<Copia> {
  const dados = {} as Record<Loja, unknown[]>;
  for (const l of LOJAS) dados[l] = await todos(l);
  return { app: 'facturo', versao: 1, geradoEm: agora(), dados };
}

export async function importarCopia(copia: Copia): Promise<void> {
  if (copia?.app !== 'facturo' || !copia.dados) throw new Error('arquivo inválido');
  const db = await abrir();
  const tx = db.transaction(LOJAS, 'readwrite');
  for (const l of LOJAS) {
    const s = tx.objectStore(l);
    s.clear();
    for (const v of copia.dados[l] ?? []) s.put(v);
  }
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
