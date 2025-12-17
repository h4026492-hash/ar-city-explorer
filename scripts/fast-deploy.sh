#!/usr/bin/env bash
set -euo pipefail

# Fast deploy helper
# Usage: ./scripts/fast-deploy.sh <device-id>
# Falls back to env IOS_DEVICE_ID if arg not provided

DEVICE_ID=${1:-${IOS_DEVICE_ID:-}}
if [ -z "$DEVICE_ID" ]; then
  echo "Usage: $0 <device-id>  (or set IOS_DEVICE_ID env var)"
  exit 2
fi

echo "[fast-deploy] building web (development)..."
ng build --configuration development

echo "[fast-deploy] copying web assets into native projects..."
npx cap copy ios

DERIVED="/tmp/AppDerived"
echo "[fast-deploy] building iOS app (derived: $DERIVED)"
xcodebuild -project ios/App/App.xcodeproj -scheme App -destination "id=$DEVICE_ID" -derivedDataPath "$DERIVED" build

echo "[fast-deploy] locating built .app..."
APP_PATH=$(find "$DERIVED" -type d -name "App.app" | head -n 1 || true)
if [ -z "$APP_PATH" ]; then
  echo "App.app not found in derived data ($DERIVED). You can run a full install with: npm run ios:install"
  exit 1
fi

echo "[fast-deploy] launching app on device $DEVICE_ID (just launch; avoids reinstall if already present)"
if command -v ios-deploy >/dev/null 2>&1; then
  ios-deploy --id "$DEVICE_ID" --justlaunch --bundle "$APP_PATH"
else
  echo "ios-deploy not found; try: brew install ios-deploy or run: npm run ios:install"
  exit 1
fi

echo "[fast-deploy] done"
