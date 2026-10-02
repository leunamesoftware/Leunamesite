# Rodar localmente

Requisitos: Node 22+.

```bash
cd HAZLUNO/backend && npm install && npm run dev      # API em http://localhost:8788 (banco SQLite em ./data)
cd HAZLUNO/frontend && npm install && npm run dev     # app em http://localhost:5174 (repassa /api para a API)
```

Variáveis da API: veja `backend/.env.example`. Em desenvolvimento nada é obrigatório.

| Variável | Para quê | Obrigatória em produção |
|---|---|---|
| `PASSWORD_PEPPER` | segredo extra no hash das senhas | sim (16+ caracteres) |
| `IP_HASH_SECRET` | o IP nunca é guardado puro, só um hash com este segredo | sim (16+ caracteres) |
| `ALLOWED_ORIGINS` | endereços que podem chamar a API | sim |
| `PUBLIC_URL` | endereço público (links de e-mail e certificado) | sim |
| `SESSION_DAYS` | duração do login | não (30) |
| `EMAIL_PROVIDER` | liga a recuperação de senha quando houver adaptador | não |
| `FILES_DIR` | pasta das imagens no desenvolvimento local (padrão `./data/files`) | não (em produção é o R2) |

## Primeiro administrador
Depois de criar sua conta normalmente no app, dê o papel de administrador pelo banco (uma vez):

```bash
# local
sqlite3 data/hazluno.db "INSERT INTO user_roles (user_id, role, granted_at) SELECT id, 'admin', datetime('now') FROM users WHERE email = 'seu@email';"
# produção (Cloudflare D1)
wrangler d1 execute hazluno --remote --command "INSERT INTO user_roles (user_id, role, granted_at) SELECT id, 'admin', datetime('now') FROM users WHERE email = 'seu@email';"
```
O admin aprova professores em Perfil → Administrador.
