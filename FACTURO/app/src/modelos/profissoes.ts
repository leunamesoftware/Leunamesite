// Modelos prontos por profissão: o usuário começa com os serviços mais comuns já cadastrados.
// Preços são referência (em USD); ao criar, convertemos de forma simples para a moeda do país
// e o profissional ajusta. Nomes em pt/en/es.

type Nome = { pt: string; en: string; es: string };
export interface ModeloItem { nome: Nome; unidade: 'un' | 'h' | 'dia' | 'm2' | 'm' | 'servico' | 'visita'; precoUsd: number }
export interface Profissao { id: string; icone: string; nome: Nome; itens: ModeloItem[] }

const n = (pt: string, en: string, es: string): Nome => ({ pt, en, es });

export const PROFISSOES: Profissao[] = [
  { id: 'eletricista', icone: '⚡', nome: n('Eletricista', 'Electrician', 'Electricista'), itens: [
    { nome: n('Visita técnica', 'Service call', 'Visita técnica'), unidade: 'visita', precoUsd: 30 },
    { nome: n('Instalação de tomada', 'Outlet installation', 'Instalación de enchufe'), unidade: 'un', precoUsd: 15 },
    { nome: n('Instalação de chuveiro', 'Water heater installation', 'Instalación de ducha eléctrica'), unidade: 'un', precoUsd: 25 },
    { nome: n('Instalação de luminária', 'Light fixture installation', 'Instalación de luminaria'), unidade: 'un', precoUsd: 20 },
    { nome: n('Troca de disjuntor', 'Breaker replacement', 'Cambio de interruptor térmico'), unidade: 'un', precoUsd: 20 },
    { nome: n('Mão de obra', 'Labor', 'Mano de obra'), unidade: 'h', precoUsd: 25 },
  ] },
  { id: 'pintor', icone: '🎨', nome: n('Pintor', 'Painter', 'Pintor'), itens: [
    { nome: n('Pintura de parede', 'Wall painting', 'Pintura de pared'), unidade: 'm2', precoUsd: 4 },
    { nome: n('Pintura de teto', 'Ceiling painting', 'Pintura de techo'), unidade: 'm2', precoUsd: 5 },
    { nome: n('Massa corrida', 'Wall putty / skim coat', 'Enduido'), unidade: 'm2', precoUsd: 3 },
    { nome: n('Pintura de porta', 'Door painting', 'Pintura de puerta'), unidade: 'un', precoUsd: 25 },
    { nome: n('Material (tinta e insumos)', 'Materials (paint and supplies)', 'Materiales (pintura e insumos)'), unidade: 'servico', precoUsd: 60 },
  ] },
  { id: 'encanador', icone: '🔧', nome: n('Encanador', 'Plumber', 'Plomero'), itens: [
    { nome: n('Visita técnica', 'Service call', 'Visita técnica'), unidade: 'visita', precoUsd: 30 },
    { nome: n('Conserto de vazamento', 'Leak repair', 'Reparación de fuga'), unidade: 'un', precoUsd: 40 },
    { nome: n('Desentupimento', 'Drain unclogging', 'Destape de cañería'), unidade: 'un', precoUsd: 45 },
    { nome: n('Instalação de torneira', 'Faucet installation', 'Instalación de grifo'), unidade: 'un', precoUsd: 25 },
    { nome: n('Instalação de vaso sanitário', 'Toilet installation', 'Instalación de inodoro'), unidade: 'un', precoUsd: 60 },
    { nome: n('Mão de obra', 'Labor', 'Mano de obra'), unidade: 'h', precoUsd: 25 },
  ] },
  { id: 'pedreiro', icone: '🧱', nome: n('Pedreiro / Reformas', 'Contractor / Renovations', 'Albañil / Reformas'), itens: [
    { nome: n('Assentamento de piso', 'Floor tile installation', 'Colocación de piso'), unidade: 'm2', precoUsd: 10 },
    { nome: n('Reboco', 'Plastering', 'Revoque'), unidade: 'm2', precoUsd: 8 },
    { nome: n('Alvenaria', 'Masonry wall', 'Mampostería'), unidade: 'm2', precoUsd: 12 },
    { nome: n('Diária', 'Day rate', 'Jornal'), unidade: 'dia', precoUsd: 50 },
    { nome: n('Material', 'Materials', 'Materiales'), unidade: 'servico', precoUsd: 100 },
  ] },
  { id: 'mecanico', icone: '🚗', nome: n('Mecânico', 'Mechanic', 'Mecánico'), itens: [
    { nome: n('Troca de óleo', 'Oil change', 'Cambio de aceite'), unidade: 'servico', precoUsd: 35 },
    { nome: n('Revisão completa', 'Full inspection', 'Revisión completa'), unidade: 'servico', precoUsd: 90 },
    { nome: n('Troca de pastilhas de freio', 'Brake pad replacement', 'Cambio de pastillas de freno'), unidade: 'servico', precoUsd: 70 },
    { nome: n('Peças', 'Parts', 'Repuestos'), unidade: 'un', precoUsd: 40 },
    { nome: n('Mão de obra', 'Labor', 'Mano de obra'), unidade: 'h', precoUsd: 35 },
  ] },
  { id: 'tecnico', icone: '📱', nome: n('Técnico (celular/PC)', 'Tech repair (phone/PC)', 'Técnico (celular/PC)'), itens: [
    { nome: n('Troca de tela', 'Screen replacement', 'Cambio de pantalla'), unidade: 'servico', precoUsd: 60 },
    { nome: n('Troca de bateria', 'Battery replacement', 'Cambio de batería'), unidade: 'servico', precoUsd: 35 },
    { nome: n('Formatação', 'System reinstall', 'Formateo'), unidade: 'servico', precoUsd: 25 },
    { nome: n('Limpeza interna', 'Internal cleaning', 'Limpieza interna'), unidade: 'servico', precoUsd: 20 },
    { nome: n('Diagnóstico', 'Diagnostics', 'Diagnóstico'), unidade: 'servico', precoUsd: 10 },
  ] },
  { id: 'limpeza', icone: '🧹', nome: n('Limpeza / Diarista', 'Cleaning', 'Limpieza'), itens: [
    { nome: n('Diária de limpeza', 'Cleaning day', 'Jornada de limpieza'), unidade: 'dia', precoUsd: 40 },
    { nome: n('Limpeza pesada', 'Deep cleaning', 'Limpieza profunda'), unidade: 'servico', precoUsd: 80 },
    { nome: n('Limpeza pós-obra', 'Post-construction cleaning', 'Limpieza post obra'), unidade: 'servico', precoUsd: 120 },
    { nome: n('Passadoria', 'Ironing', 'Planchado'), unidade: 'h', precoUsd: 10 },
  ] },
  { id: 'fotografo', icone: '📷', nome: n('Fotógrafo / Vídeo', 'Photographer / Video', 'Fotógrafo / Video'), itens: [
    { nome: n('Ensaio fotográfico', 'Photo session', 'Sesión de fotos'), unidade: 'servico', precoUsd: 120 },
    { nome: n('Cobertura de evento', 'Event coverage', 'Cobertura de evento'), unidade: 'h', precoUsd: 60 },
    { nome: n('Edição de fotos', 'Photo editing', 'Edición de fotos'), unidade: 'un', precoUsd: 3 },
    { nome: n('Vídeo editado', 'Edited video', 'Video editado'), unidade: 'un', precoUsd: 150 },
  ] },
  { id: 'design', icone: '💻', nome: n('Design / Marketing', 'Design / Marketing', 'Diseño / Marketing'), itens: [
    { nome: n('Criação de logo', 'Logo design', 'Diseño de logo'), unidade: 'servico', precoUsd: 150 },
    { nome: n('Post para redes sociais', 'Social media post', 'Publicación para redes'), unidade: 'un', precoUsd: 15 },
    { nome: n('Gestão de redes sociais', 'Social media management', 'Gestión de redes'), unidade: 'servico', precoUsd: 250 },
    { nome: n('Site institucional', 'Business website', 'Sitio web'), unidade: 'servico', precoUsd: 500 },
    { nome: n('Hora de trabalho', 'Hourly work', 'Hora de trabajo'), unidade: 'h', precoUsd: 30 },
  ] },
  { id: 'beleza', icone: '💇', nome: n('Beleza / Estética', 'Beauty / Salon', 'Belleza / Estética'), itens: [
    { nome: n('Corte', 'Haircut', 'Corte'), unidade: 'servico', precoUsd: 20 },
    { nome: n('Manicure e pedicure', 'Manicure and pedicure', 'Manicura y pedicura'), unidade: 'servico', precoUsd: 25 },
    { nome: n('Maquiagem', 'Makeup', 'Maquillaje'), unidade: 'servico', precoUsd: 40 },
    { nome: n('Pacote noiva', 'Bridal package', 'Paquete novia'), unidade: 'servico', precoUsd: 250 },
  ] },
  { id: 'jardinagem', icone: '🌿', nome: n('Jardinagem', 'Gardening / Lawn care', 'Jardinería'), itens: [
    { nome: n('Corte de grama', 'Lawn mowing', 'Corte de césped'), unidade: 'm2', precoUsd: 0.5 },
    { nome: n('Poda', 'Pruning', 'Poda'), unidade: 'un', precoUsd: 30 },
    { nome: n('Manutenção mensal', 'Monthly maintenance', 'Mantenimiento mensual'), unidade: 'servico', precoUsd: 80 },
  ] },
  { id: 'outro', icone: '🧰', nome: n('Outro serviço', 'Other', 'Otro servicio'), itens: [
    { nome: n('Serviço', 'Service', 'Servicio'), unidade: 'servico', precoUsd: 50 },
    { nome: n('Hora de trabalho', 'Hourly work', 'Hora de trabajo'), unidade: 'h', precoUsd: 25 },
    { nome: n('Material', 'Materials', 'Materiales'), unidade: 'un', precoUsd: 10 },
  ] },
];

// Conversão aproximada, só para o modelo inicial parecer realista; o usuário ajusta.
const FATOR: Record<string, number> = {
  USD: 1, BRL: 4, EUR: 0.9, GBP: 0.8, MXN: 18, ARS: 900, COP: 4000, CLP: 900, PEN: 3.7,
  UYU: 40, PYG: 7300, BOB: 6.9, DOP: 58, GTQ: 7.8, CRC: 520, CAD: 1.35, AUD: 1.5, NZD: 1.6,
  INR: 83, ZAR: 18, NGN: 1500, PHP: 56, AOA: 830, MZN: 64,
};

/** Preço do modelo convertido e arredondado para um valor "redondo" na moeda local, em centavos. */
export function precoModelo(usd: number, moeda: string): number {
  const v = usd * (FATOR[moeda] ?? 1);
  const passo = v >= 1000 ? 100 : v >= 100 ? 5 : v >= 10 ? 1 : 0.5;
  return Math.round((Math.max(passo, Math.round(v / passo) * passo)) * 100);
}

export function nomeNoIdioma(nome: Nome, idioma: string): string {
  return idioma.startsWith('pt') ? nome.pt : idioma.startsWith('es') ? nome.es : nome.en;
}
