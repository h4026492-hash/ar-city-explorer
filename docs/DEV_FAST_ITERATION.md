## Fast iteration: build & deploy tips 🚀

These notes and helper scripts speed up local iteration when developing the AR view and native bridge.

Quick commands
- Start an incremental web build (rebuilds on file change):
  - npm run dev:web
- Auto-copy web assets into native iOS on changes (requires `chokidar-cli`):
  - npm run dev:watch-copy
- Stream device logs to a file (useful during AR testing):
  - npm run dev:logs
- Fast deploy (build web, copy to iOS, build iOS, launch on device):
  - IOS_DEVICE_ID=<your-device-id> npm run fast:deploy
  - or: npm run fast:deploy <your-device-id>

Notes & tips
- Use `npm run dev:web` while working on UI; it runs `ng build --watch` and produces fast incremental builds.
- `npm run dev:watch-copy` watches the `dist` folder and runs `npx cap copy ios` whenever web assets change so you don't need to run a full `cap sync` each time.
- `npm run fast:deploy` builds the app using an explicit `derivedDataPath` (`/tmp/AppDerived`) so subsequent builds are incremental and faster; it then launches the app using `ios-deploy --justlaunch` (no reinstall when the app is already installed).
- If you need a fresh install or provisioning update use `npm run ios:install` (this is slower).
- Make sure `ios-deploy` and `idevicesyslog` are installed (brew install ios-deploy libimobiledevice).

Example fast workflow
1. Start logging: `npm run dev:logs`
2. Start incremental web builds: `npm run dev:web`
3. Start watcher to copy web assets to native: `npm run dev:watch-copy` (optional)
4. When ready to test on device: `IOS_DEVICE_ID=<id> npm run fast:deploy`

That's it — these steps should cut iteration time significantly compared to full cleans and reinstalls.
