#!/usr/bin/env bash
#
# يبني نوفا كتطبيق أندرويد مكتفٍ بذاته.
#
#   ./mobile/make-apk.sh
#
# المتطلبات: JDK 17+، Gradle، و Android SDK (platform 34 + build-tools 34).
# اضبط ANDROID_HOME إن لم يكن مضبوطًا.
#
# مفتاح التوقيع لا يُودَع في المستودع أبدًا: يُولَّد هنا إن غاب. وهو مفتاح
# تجريبي للتثبيت اليدوي فقط — النشر في متجر يحتاج مفتاحًا تحفظه أنت.

set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

: "${ANDROID_HOME:=/opt/android-sdk}"
export ANDROID_HOME
export ANDROID_SDK_ROOT="$ANDROID_HOME"

keystore="mobile/android/app/nova-debug.keystore"
if [ ! -f "$keystore" ]; then
  echo "▸ توليد مفتاح توقيع تجريبي (لا يُودَع في المستودع)…"
  keytool -genkeypair -v -keystore "$keystore" -alias nova \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass novaos123 -keypass novaos123 \
    -dname "CN=NOVA OS, OU=Nova, O=Nova, L=Riyadh, C=SA" >/dev/null
fi

echo "▸ حزم نوفا الساكنة (esbuild)…"
node mobile/build.mjs

echo "▸ ترجمة APK…"
cd mobile/android
gradle assembleRelease --no-daemon -q

apk="app/build/outputs/apk/release/app-release.apk"
echo "▸ تم: $root/mobile/android/$apk"
ls -la "$apk"
