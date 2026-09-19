# LeuName License Server

Serviço mínimo (Node.js + Express + SQLite) para ativação e validação de
licenças do LeuName Gestão, conforme §12 do briefing: impedir que o
instalador de uma loja seja simplesmente copiado e usado por outra, sem
travar o cliente legítimo que troca de dispositivo.

## Por que isso existe fora do app.html

O app principal (`leuname-gestao.html`) roda inteiramente no navegador do
cliente (offline-first). Validação de licença **real** (que realmente
impede cópia) precisa, por definição, de uma verificação do lado de fora
do dispositivo do cliente — senão bastaria editar o próprio código do app
para sempre responder "licença válida". Por isso este é um serviço
separado, pequeno e de baixo custo (roda em qualquer VPS simples ou
serviço serverless compatível com Node).

Hoje, dentro do `leuname-gestao.html`, a tela **Configurações > Licença**
faz apenas uma validação de **formato** local (`LEU-XXXX-XXXX-XXXX`) e
deixa claro na interface que a validação real de ativação/dispositivo
requer este servidor — não finge validar de verdade sem ele.

## Como rodar

```bash
cd license-server
npm install
cp .env.example .env   # edite e defina LICENSE_SECRET e ADMIN_SECRET reais
npm start
```

O servidor cria automaticamente `licenses.db` (SQLite) na primeira execução.

## Emitir uma licença para uma loja nova

```bash
node cli.js emitir "Loja Bencel" contato@bencel.com.br 4
```

Isso imprime a chave, por exemplo `LEU-9F3A-22B1-77CD`, que você entrega
ao cliente após a compra.

## Endpoints

| Método | Rota                              | Uso                                              |
|--------|------------------------------------|---------------------------------------------------|
| POST   | `/activate`                        | App cliente ativa um dispositivo na licença       |
| POST   | `/validate`                        | App cliente revalida/renova o token periodicamente|
| POST   | `/deactivate-device`               | Admin da loja libera vaga de um dispositivo antigo|
| POST   | `/admin/licenses`                  | (LeuName) emitir licença via HTTP                 |
| GET    | `/admin/licenses/:key/devices`     | (LeuName) consultar dispositivos de uma licença   |
| POST   | `/admin/licenses/:key/revoke`      | (LeuName) revogar uma licença                     |
| GET    | `/health`                          | Checagem de saúde do serviço                      |

Rotas `/admin/*` exigem o header `x-admin-secret: <ADMIN_SECRET>`.

## Integração com o app.html

O `app.html` **ainda não chama este servidor pela rede** — dentro do
sandbox de artefato do Claude, chamadas de rede a um domínio arbitrário
(seu futuro `licencas.leunamesoftwares.com.br`) não são possíveis. A tela
de Licença já está pronta para receber essa integração: assim que este
serviço estiver hospedado, adicione ali uma chamada `fetch` para
`/activate` e `/validate` (guardando o token retornado em
`localStorage`) — a estrutura de UI e o texto explicativo já preparam o
usuário para isso. Isto segue exatamente o §40 do briefing: arquitetura e
interface prontas, integração final documentada e não simulada.

## Segurança

- Tokens são assinados com HMAC-SHA256 (`hmac.js`), verificação com
  `crypto.timingSafeEqual` (evita timing attack).
- `helmet` + `express-rate-limit` habilitados por padrão.
- Nunca guarda senha alguma de serviço externo — apenas chaves de
  licença e fingerprints de dispositivo.
- Antes de produção: rodar atrás de HTTPS (ex.: proxy reverso com Caddy
  ou Nginx + Let's Encrypt), e trocar `LICENSE_SECRET`/`ADMIN_SECRET`
  pelos valores gerados com `openssl rand`.
