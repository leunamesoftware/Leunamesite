#!/usr/bin/env bash
# Teste em Android real (emulador): instala, abre, toca como um usuário e guarda fotos + erros.
set -u
APK="$1"; OUT="$2"; PKG=com.leunamesoftwares.facturo.previa
mkdir -p "$OUT"
foto() { adb exec-out screencap -p > "$OUT/$1.png"; echo "foto: $1"; }
arvore() { adb shell uiautomator dump /sdcard/t.xml >/dev/null 2>&1; adb shell cat /sdcard/t.xml > "$OUT/tela.xml"; }
# Toca no centro do elemento cujo texto contém $1 (lido da árvore de acessibilidade).
tocar() {
  arvore
  P=$(python3 - "$1" "$OUT/tela.xml" <<'PY'
import re, sys
alvo, arq = sys.argv[1], sys.argv[2]
x = open(arq, encoding="utf-8", errors="ignore").read()
for m in re.finditer(r'<node [^>]*>', x):
    n = m.group(0)
    t = re.search(r' text="([^"]*)"', n).group(1) + re.search(r' content-desc="([^"]*)"', n).group(1)
    if alvo.lower() in t.lower():
        a = list(map(int, re.findall(r'\d+', re.search(r'bounds="([^"]*)"', n).group(1))))
        print((a[0]+a[2])//2, (a[1]+a[3])//2); break
PY
)
  if [ -z "$P" ]; then echo "NÃO ACHEI: $1"; return 1; fi
  echo "tocar '$1' em $P"; adb shell input tap $P; sleep 2
}

adb root >/dev/null 2>&1; sleep 2
adb shell "setprop persist.sys.locale pt-BR; setprop ctl.restart zygote" ; sleep 25
adb wait-for-device; until [ "$(adb shell getprop sys.boot_completed | tr -d '\r')" = "1" ]; do sleep 2; done
adb shell settings put global window_animation_scale 0; adb shell settings put global transition_animation_scale 0
echo "idioma do aparelho: $(adb shell getprop persist.sys.locale)"

adb install -r "$APK"
adb logcat -c
adb shell monkey -p $PKG -c android.intent.category.LAUNCHER 1 >/dev/null
sleep 3; foto 00-3s
sleep 4; foto 00-7s
sleep 5; foto 01-abriu
adb shell dumpsys activity activities | grep -iE "facturo|mResumed|topResumed" | head -20
tocar "Pintor" && foto 02-profissao
tocar "Nome do seu" && adb shell input text "Pintura%sSilva" && sleep 2 && foto 03-nome
tocar "Começar" ; sleep 3; foto 04-inicio
adb shell input swipe 500 1500 500 600 300; sleep 1; foto 05-rolou
arvore
adb logcat -d > "$OUT/log-completo.txt"
grep -iE "facturo|Capacitor|Console|FATAL|AndroidRuntime: (FATAL|java)|ActivityTaskManager|ActivityManager.*(Kill|died|crash)|cr_AwContents" "$OUT/log-completo.txt" | grep -v nativeloader | tail -250 > "$OUT/log.txt"
echo "===== LOG ====="; cat "$OUT/log.txt"
echo "===== TEXTOS NA TELA ====="; grep -o ' text="[^"]\+"' "$OUT/tela.xml" | head -60
