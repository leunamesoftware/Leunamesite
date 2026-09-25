// MODELOS — revisar com advogado antes da publicação.
// Substituir: [RAZÃO SOCIAL], [CNPJ], [ENDEREÇO], [E-MAIL DE CONTATO], [DATA].

const termsTitle = 'Termos de Uso';
const privacyTitle = 'Política de Privacidade';

const termsSections = <(String, String)>[
  (
    '1. Sobre o EconoRota',
    'O EconoRota é uma plataforma operada por [RAZÃO SOCIAL], CNPJ [CNPJ], com sede em [ENDEREÇO], que conecta clientes, supermercados e entregadores para compra e entrega de produtos.',
  ),
  (
    '2. Cadastro',
    'Para usar o EconoRota você deve ter 18 anos ou mais e fornecer dados verdadeiros. Você é responsável pela guarda da sua senha e por toda atividade feita na sua conta.',
  ),
  (
    '3. Preços, estoque e comparação',
    'Preços, promoções e estoque são informados pelos supermercados parceiros e podem mudar sem aviso. A comparação mostra a melhor combinação disponível no momento da consulta.',
  ),
  (
    '4. Pedidos e entregas',
    'Cada pedido pode reunir produtos de até 3 mercados. Taxas de entrega e prazos são exibidos antes da confirmação. Itens indisponíveis podem ser removidos ou substituídos somente com sua autorização.',
  ),
  (
    '5. Pagamentos, cancelamentos e reembolsos',
    'Os pagamentos são processados por parceiros de pagamento certificados. Cancelamentos e reembolsos seguem o Código de Defesa do Consumidor e as regras exibidas no app no momento do pedido.',
  ),
  (
    '6. Condutas proibidas',
    'É proibido usar o app para fraudes, fornecer dados de terceiros sem autorização, tentar acessar áreas restritas ou prejudicar o funcionamento da plataforma.',
  ),
  (
    '7. Suspensão da conta',
    'Contas com uso indevido podem ser suspensas ou encerradas, com aviso ao titular sempre que possível.',
  ),
  ('8. Contato', 'Dúvidas e solicitações: [E-MAIL DE CONTATO].'),
  ('Atualização', 'Última atualização: [DATA].'),
];

const privacySections = <(String, String)>[
  (
    '1. Quem somos',
    '[RAZÃO SOCIAL], CNPJ [CNPJ], é a controladora dos seus dados pessoais no EconoRota, conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018).',
  ),
  (
    '2. Dados que coletamos',
    'Nome, e-mail, telefone, endereços de entrega, localização aproximada (somente com sua permissão), histórico de pedidos e dados técnicos do aparelho necessários para segurança. Não armazenamos dados completos de cartão: eles ficam com o parceiro de pagamento.',
  ),
  (
    '3. Para que usamos',
    'Criar e proteger sua conta, mostrar mercados e ofertas da sua região, calcular entregas, processar pedidos e pagamentos, prevenir fraudes, cumprir obrigações legais e prestar suporte.',
  ),
  (
    '4. Compartilhamento',
    'Compartilhamos apenas o necessário: com o mercado (itens do pedido e primeiro nome), com o entregador (nome, endereço e telefone mascarado durante a entrega) e com parceiros de pagamento e envio de mensagens. Não vendemos seus dados.',
  ),
  (
    '5. Localização',
    'A localização é usada somente para encontrar mercados e calcular a entrega. Você pode negar ou revogar a permissão a qualquer momento e informar o endereço manualmente.',
  ),
  (
    '6. Segurança e retenção',
    'Senhas são armazenadas com criptografia irreversível e as comunicações usam HTTPS. Mantemos os dados pelo tempo necessário às finalidades acima e às obrigações legais.',
  ),
  (
    '7. Seus direitos',
    'Você pode solicitar acesso, correção, portabilidade, anonimização ou exclusão dos seus dados e revogar consentimentos pelo e-mail [E-MAIL DE CONTATO].',
  ),
  ('Atualização', 'Última atualização: [DATA].'),
];
