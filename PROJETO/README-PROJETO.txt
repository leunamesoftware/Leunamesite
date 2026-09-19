LEUNAME GESTÃO — PASTA DO PROJETO
LeuName Softwares
==================================================

O QUE TEM AQUI

leuname-gestao.html
  O sistema completo, funcional, o mesmo que está embutido dentro do
  instalador Windows e do projeto Android. Pode ser aberto direto no
  navegador — é o "coração" de tudo. Se algum dia precisar atualizar o
  sistema, é este arquivo que muda, e depois ele é recopiado para dentro
  das pastas WINDOWS/projeto-instalador-windows/app/index.html e
  ANDROID/projeto-instalador-android/www/index.html antes de gerar
  novos instaladores.

licenca-servidor-para-versao-comercial-futura/
  O servidor de licenças (ativação online, controle de dispositivo por
  cliente) já preparado e funcional em código, mas AINDA NÃO conectado
  ao sistema nem hospedado em lugar nenhum — conforme pedido, esta
  entrega não mexe nisso. Fica guardado aqui pronto para quando vocês
  decidirem partir para a versão comercial (Hotmart/Kiwify, licença
  online, vários clientes).

gerador-chave-ativacao-local/
  Script Node.js (gerar-chave.js) que gera chaves de ativação para a
  proteção local descrita abaixo. Roda 100% offline, sem instalar nada
  além do Node.js. Veja "SOBRE A PROTEÇÃO/LICENÇA NESTA ENTREGA".

==================================================
SOBRE A PROTEÇÃO/LICENÇA NESTA ENTREGA

Agora a ativação é OBRIGATÓRIA antes de liberar o sistema: na primeira
vez que o LeuName Gestão é aberto (Windows, Android ou navegador), ele
mostra a tela "Ativação da licença" e não deixa passar para o cadastro
da loja/login enquanto uma chave válida não for digitada. Fluxo:

  instala → abre pela 1ª vez → tela "Ativação da licença" → digita a
  chave LEU-XXXX-XXXX-XXXX → sistema confere a chave → se válida, libera
  o sistema e grava a ativação naquele dispositivo → nas próximas
  aberturas não pede a chave de novo (a menos que apaguem os dados do
  app/navegador daquele dispositivo).

A validação é LOCAL e criptográfica (HMAC-SHA256): os 2 primeiros
grupos da chave são livres e o 3º grupo é a assinatura desses 2 grupos
usando um segredo embutido dentro do próprio app. O app recalcula essa
assinatura na hora e só libera o sistema se ela confirmar — ou seja, não
é mais "só formato", é uma chave de verdade, só que verificada sem
precisar de internet nem servidor (como foi pedido nesta etapa).

Isso é ativação LOCAL, para o primeiro cliente: não impede que a mesma
chave seja digitada em mais de uma instalação/dispositivo diferente,
porque não há servidor central conferindo isso — essa é a limitação
conhecida de qualquer proteção 100% offline, e continua sendo o motivo
de existir a pasta licenca-servidor-para-versao-comercial-futura/ para
quando vocês quiserem controlar isso de verdade (várias licenças,
dispositivos por cliente, bloqueio remoto) na versão comercial.

Para gerar uma chave nova, veja gerador-chave-ativacao-local/gerar-chave.js.

==================================================
O QUE FOI ALTERADO NESTA ETAPA

Só a parte de ativação/licença do arquivo leuname-gestao.html (e suas
2 cópias dentro dos pacotes Windows e Android) foi alterada, para
acrescentar a tela obrigatória de ativação descrita acima. Nenhum outro
módulo foi tocado: Dashboard, Produtos, Peças, Clientes, Fornecedores,
Vendas, Ordens de Serviço, Financeiro, Relatórios, Usuários, Permissões,
Backup, Dispositivos, Configurações, Login, Impressão, funcionamento
offline, banco local e interface responsiva continuam exatamente como
estavam.
