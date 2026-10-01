#!/usr/bin/env bash
# Teste em Android real (emulador): instala, abre, toca como um usuário e guarda fotos + erros.
set -u
FALHAS=""
APK="$1"; OUT="$2"; PKG=com.leunamesoftwares.facturo.previa
mkdir -p "$OUT"
exec > >(tee "$OUT/saida.txt") 2>&1
# Toque por posição (fração da tela): a árvore de acessibilidade do WebView às vezes fica desatualizada.
TAM=""
pos() { [ -z "$TAM" ] && TAM=$(adb shell wm size | grep -o "[0-9]*x[0-9]*" | tail -1); echo "toque em $1,$2"; adb shell input tap $(echo "$TAM" | awk -Fx -v a="$1" -v b="$2" '{print int($1*a), int($2*b)}'); sleep 2; }
foto() { adb exec-out screencap -p > "$OUT/$1.png"; echo "foto: $1"; }
arvore() { adb shell uiautomator dump /sdcard/t.xml >/dev/null 2>&1; adb shell cat /sdcard/t.xml > "$OUT/tela.xml"; }
# Toca no centro do elemento cujo texto contém $1 (lido da árvore de acessibilidade).
tocar() {
  for tentativa in 1 2 3; do
  # Clientes → novo cliente com teclado aberto (o caso do print do dono)
adb shell input keyevent 4; sleep 2
pos 0.62 0.94; foto 07-clientes
pos 0.75 0.855; sleep 1; foto 08-novo-cliente
adb shell input text "Maria%sSouza"; sleep 1; foto 09-digitando
pos 0.5 0.33; sleep 1; foto 10-telefone

# Tema escuro
adb shell cmd uimode night yes; adb shell am force-stop $PKG; sleep 1
adb shell monkey -p $PKG -c android.intent.category.LAUNCHER 1 >/dev/null; sleep 6; foto 11-escuro-inicio
pos 0.87 0.94; foto 12-escuro-mais
pos 0.37 0.94; foto 13-escuro-documentos
pos 0.75 0.855; sleep 1; foto 14-escuro-editor
arvore
  P=$(python3 - "$1" "$OUT/tela.xml" <<'PY'
import re, sys
alvo, arq = sys.argv[1], sys.argv[2]
x = open(arq, encoding="utf-8", errors="ignore").read()
achados = []
for m in re.finditer(r'<node [^>]*>', x):
    n = m.group(0)
    t = (re.search(r' text="([^"]*)"', n).group(1) + re.search(r' content-desc="([^"]*)"', n).group(1)).strip()
    if alvo.lower() in t.lower():
        a = list(map(int, re.findall(r'\d+', re.search(r'bounds="([^"]*)"', n).group(1))))
        achados.append((len(t), (a[0]+a[2])//2, (a[1]+a[3])//2))
if achados:  # o texto mais curto que contém o alvo = o botão, não um parágrafo que cita o nome dele
    _, cx, cy = min(achados); print(cx, cy)
PY
)
  [ -n "$P" ] && break; sleep 2; done
  if [ -z "$P" ]; then echo "NÃO ACHEI: $1"; FALHAS="$FALHAS $1"; return 1; fi
  echo "tocar '$1' em $P"; adb shell input tap $P; sleep 2
}

adb root >/dev/null 2>&1; sleep 2
adb shell "setprop persist.sys.locale pt-BR; setprop ctl.restart zygote" ; sleep 25
adb wait-for-device; until [ "$(adb shell getprop sys.boot_completed | tr -d '\r')" = "1" ]; do sleep 2; done
adb shell settings put global window_animation_scale 0; adb shell settings put global transition_animation_scale 0
echo "idioma do aparelho: $(adb shell getprop persist.sys.locale)"

adb install -r "$APK"
adb shell cmd uimode night no
adb logcat -c
adb shell monkey -p $PKG -c android.intent.category.LAUNCHER 1 >/dev/null
sleep 3; foto 00-3s
sleep 7; foto 01-abriu
# Posições medidas no Pixel 6 (1080x2400); fração da tela para valer em outros tamanhos.
pos 0.67 0.44; foto 02-profissao            # Pintor
pos 0.5 0.473                               # campo nome
adb shell input text "Pintura"; sleep 2; foto 03-nome
pos 0.5 0.548; sleep 3; foto 04-inicio      # Começar
pos 0.75 0.855; sleep 2; foto 05-novo-orcamento
adb shell input swipe 540 1700 540 700 300; sleep 1; foto 06-rolou
adb shell input keyevent 4; sleep 2

# Clientes → novo cliente com teclado aberto (o caso do print do dono)
pos 0.62 0.94; foto 07-clientes
pos 0.75 0.855; sleep 2; foto 08-novo-cliente
adb shell input text "Maria"; sleep 1; foto 09-digitando
adb shell input keyevent 61; sleep 1; foto 10-proximo-campo   # Tab = próximo campo
adb shell input keyevent 4; sleep 1; adb shell input keyevent 4; sleep 1

# Tema escuro
adb shell cmd uimode night yes; sleep 3
adb shell am force-stop $PKG; sleep 1
adb shell monkey -p $PKG -c android.intent.category.LAUNCHER 1 >/dev/null; sleep 7; foto 11-escuro-inicio
pos 0.87 0.94; foto 12-escuro-mais
pos 0.37 0.94; foto 13-escuro-documentos
pos 0.75 0.855; sleep 2; foto 14-escuro-editor
pos 0.5 0.19; sleep 2; foto 15-escuro-escolher-cliente
adb logcat -d > "$OUT/log-completo.txt"
grep -iE "facturo|Capacitor|Console|FATAL|AndroidRuntime: (FATAL|java)|ActivityTaskManager|ActivityManager.*(Kill|died|crash)|cr_AwContents" "$OUT/log-completo.txt" | grep -v nativeloader | tail -250 > "$OUT/log.txt"
echo "===== LOG ====="; cat "$OUT/log.txt"
echo "===== TEXTOS NA TELA ====="; grep -o ' text="[^"]\+"' "$OUT/tela.xml" | head -60
echo "===== FALHAS: ${FALHAS:-nenhuma} ====="
