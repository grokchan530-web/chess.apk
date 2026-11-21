#!/usr/bin/env bash
# Local build (needs JDK 17 and the Android SDK; ANDROID_HOME must point to it).
set -euo pipefail
cd "$(dirname "$0")"
node tests/perft.js | tail -1
node build.js
cd android
[ -f local.properties ] || { [ -n "${ANDROID_HOME:-}" ] && echo "sdk.dir=$ANDROID_HOME" > local.properties; }
chmod +x gradlew
./gradlew --no-daemon assembleRelease
cp "$(find app/build/outputs/apk -name '*.apk' | head -n 1)" ../chess.apk
echo "Done -> $(cd .. && pwd)/chess.apk"
