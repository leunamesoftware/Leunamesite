# Servidor de licenças LeuName Softwares (Cloudflare)

Backend único e reutilizável para gerar, listar e revogar chaves de
licença — serve o LeuName Gestão e qualquer app futuro, em qualquer
idioma. Roda inteiro na Cloudflare (Worker + banco D1), sem precisar de
servidor tradicional.

As chaves geradas aqui são **idênticas** (mesmo formato, mesma
assinatura) às que o script local `gerador-chave-ativacao-local/gerar-chave.js`
já gera — testado e confirmado. O app não precisa de nenhuma alteração
para aceitar chaves vindas daqui.

## Passo a passo (pelo painel da Cloudflare, sem usar terminal)

### 1. Criar o banco de dados
1. Entre em dash.cloudflare.com → seu domínio `leunamesoftware.com`.
2. No menu lateral, vá em **Workers & Pages → D1 SQL Database**.
3. **Create database** → nome: `leuname_licencas` → Create.
4. Abra o banco recém-criado → aba **Console**.
5. Cole o conteúdo do arquivo `schema.sql` (deste mesmo pacote) e clique
   em **Execute**. Isso cria as tabelas e já cadastra o app
   "leuname-gestao".

### 2. Criar o Worker (o "servidor")
1. **Workers & Pages → Create → Create Worker**.
2. Nome: `leuname-licencas` → **Deploy** (ele cria com um código padrão,
   sem problema, vamos trocar).
3. Clique em **Edit code** (ou "Quick edit").
4. Apague todo o conteúdo e cole o conteúdo do arquivo `src/index.js`
   (deste mesmo pacote).
5. **Save and deploy**.

### 3. Ligar o Worker ao banco de dados
1. Na página do Worker → aba **Settings → Bindings** (ou "Variables and
   Bindings", dependendo da versão do painel).
2. **Add binding → D1 Database**.
3. Variable name: `DB` (exatamente assim, maiúsculo).
4. Database: selecione `leuname_licencas`.
5. Salvar.

### 4. Configurar a senha de administrador
1. Ainda em **Settings → Variables** (ou "Bindings") do Worker.
2. **Add variable** → nome: `ADMIN_TOKEN`.
3. Valor: o token que a LeuName Softwares te entregou separadamente
   (fora deste repositório, por segurança — não fica salvo aqui em
   texto puro).
4. Marque como **Encrypt** (vira um secret, ninguém mais vê o valor
   depois de salvo — guarde esse valor em local seguro, é a "senha
   mestra" pra gerar/consultar licenças).
5. Salvar (o Worker reinicia sozinho).

### 5. Colocar no subdomínio api.leunamesoftware.com
1. Ainda na página do Worker → aba **Settings → Domains & Routes** (ou
   **Triggers → Custom Domains**, dependendo da versão).
2. **Add Custom Domain** → digite `api.leunamesoftware.com` → Add.
   Como o domínio já está na Cloudflare, ele configura o DNS sozinho.
3. Espera 1-2 minutos.

### 6. Testar
Abra no navegador: `https://api.leunamesoftware.com/health`
Deve aparecer algo como `{"ok": true, "servico": "leuname-licencas"}`.
Se aparecer isso, está tudo funcionando.

## Como usar no dia a dia

Estas chamadas podem ser feitas de qualquer lugar que envie uma
requisição HTTP (um app de teste de API tipo Postman/Insomnia, um
comando `curl`, ou uma página simples que a gente pode montar depois).
Sempre mandando o cabeçalho (troque `<ADMIN_TOKEN>` pelo valor real,
que você tem guardado separadamente):
```
Authorization: Bearer <ADMIN_TOKEN>
```

**Gerar uma chave nova:**
```
POST https://api.leunamesoftware.com/admin/licencas/gerar
Body (JSON): {"app_id":"leuname-gestao","cliente_nome":"Bencell","cliente_contato":"whatsapp/email","origem":"manual"}
```
Resposta: `{"ok":true,"chave":"LEU-XXXX-XXXX-XXXX", ...}`

**Ver todas as chaves já geradas:**
```
GET https://api.leunamesoftware.com/admin/licencas?app_id=leuname-gestao
```

**Revogar uma chave** (marca como cancelada no nosso registro — não
desativa remotamente quem já ativou offline, mas impede reaproveitar
essa chave em relatórios/consultas futuras):
```
POST https://api.leunamesoftware.com/admin/licencas/revogar
Body (JSON): {"chave":"LEU-XXXX-XXXX-XXXX"}
```

**Cadastrar um app novo** (quando vocês lançarem outro software):
```
POST https://api.leunamesoftware.com/admin/apps
Body (JSON): {"id":"nome-curto-do-app","nome":"Nome Completo do App"}
```

## O que ainda NÃO está pronto

Isso aqui resolve "gerar e controlar chaves de um jeito centralizado,
sem precisar rodar script local toda vez". Ainda **não** faz:

- **Cobrar automaticamente dentro da Play Store** — isso exige integrar
  o Google Play Billing dentro do próprio app Android (mudança de
  código do app), e conectar o aviso de compra da Google a este
  servidor. É a próxima etapa, se/quando vocês quiserem.
- **Bloquear remotamente** uma licença já ativada num dispositivo — o
  app continua validando localmente/offline; "revogar" aqui só limpa o
  registro do nosso lado.
