"""Atualiza a página da loja (textos, ícone, imagem de destaque e prints) de um app
na Google Play a partir de um loja.json. Uso: python play_loja.py caminho/loja.json
Precisa da variável PLAY_JSON (conteúdo da chave da conta de serviço)."""
import json, os, sys
from google.oauth2 import service_account
from google.auth.transport.requests import AuthorizedSession

cfg_path = sys.argv[1]
base = os.path.dirname(os.path.abspath(cfg_path))
cfg = json.load(open(cfg_path, encoding="utf-8"))
creds = service_account.Credentials.from_service_account_info(
    json.loads(os.environ["PLAY_JSON"]),
    scopes=["https://www.googleapis.com/auth/androidpublisher"])
s = AuthorizedSession(creds)

pkg, lang = cfg["package"], cfg.get("language", "pt-BR")
api = f"https://androidpublisher.googleapis.com/androidpublisher/v3/applications/{pkg}"
up = f"https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/{pkg}"

def ok(r):
    if r.status_code >= 300:
        print("ERRO", r.status_code, r.text)
        sys.exit(1)
    return r.json() if r.text.strip() else {}

edit = ok(s.post(f"{api}/edits"))["id"]

details = {k: cfg[k] for k in ("contactEmail", "contactWebsite", "defaultLanguage") if k in cfg}
if details:
    ok(s.patch(f"{api}/edits/{edit}/details", json=details))

ok(s.put(f"{api}/edits/{edit}/listings/{lang}", json={
    "language": lang, "title": cfg["title"],
    "shortDescription": cfg["shortDescription"], "fullDescription": cfg["fullDescription"]}))
print("textos enviados")

for kind in ("icon", "featureGraphic", "phoneScreenshots"):
    files = cfg.get(kind)
    if not files:
        continue
    files = files if isinstance(files, list) else [files]
    ok(s.delete(f"{api}/edits/{edit}/listings/{lang}/{kind}"))
    for f in files:
        with open(os.path.join(base, f), "rb") as fh:
            ok(s.post(f"{up}/edits/{edit}/listings/{lang}/{kind}?uploadType=media",
                      data=fh.read(), headers={"Content-Type": "image/png"}))
        print("imagem enviada:", kind, f)

r = s.post(f"{api}/edits/{edit}:commit")
if r.status_code >= 300 and "changesNotSentForReview" in r.text:
    r = s.post(f"{api}/edits/{edit}:commit?changesNotSentForReview=true")
ok(r)
print("Página da loja atualizada:", pkg)
