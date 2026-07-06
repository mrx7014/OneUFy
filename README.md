# OneUFy

**Custom Fonts as you like (For OneUI)**

OneUFy is an **LSPosed/Xposed module** for Samsung OneUI devices that removes the system-level font validation restriction, allowing any custom font — including merged Arabic/English typefaces — to be applied through OneUI's built-in font picker.

> ⚠️ **Requires a rooted device with LSPosed (or a compatible Xposed framework) installed.** This is **not** a regular standalone app — it only works when loaded as a module and scoped to `com.android.settings`.

## ⚙️ How it works

Samsung's Settings app (`com.android.settings`) validates fonts through `SecDisplayUtils.isInvalidFont()` before allowing them to be applied system-wide. OneUFy hooks this method via Xposed and forces it to always return `false`, bypassing the restriction so unofficial/custom fonts are accepted like official ones.

It also ships a set of ready-to-use, pre-merged Arabic + English fonts under `app/src/main/assets/fonts/`, each paired with a FlipFont-style XML descriptor under `app/src/main/assets/xml/`:

- SanFrancisco (AR/EN)
- Minecraft Regular (AR/EN)
- Minecraft Bold (AR/EN)
- RoundedA16 (AR/EN)

## 📦 Project Structure

```
OneUFy/
├── app/
│   ├── src/main/
│   │   ├── java/com/monotype/android/font/oneufy/
│   │   │   └── OneUFy.java          # Xposed hook: bypasses isInvalidFont()
│   │   ├── assets/
│   │   │   ├── xposed_init          # Registers the module entry class
│   │   │   ├── fonts/                # Bundled merged AR/EN .ttf fonts
│   │   │   └── xml/                  # FlipFont-style font descriptors
│   │   └── AndroidManifest.xml       # Xposed module metadata (scope: com.android.settings)
│   └── build.gradle
├── gradle/
├── build.gradle
├── settings.gradle
└── gradlew / gradlew.bat
```

- **Package name:** `com.monotype.android.font.oneufy`
- **Min SDK:** 16 · **Target/Compile SDK:** 34

## 🛠️ Building

### Requirements
- JDK 17
- Android SDK (with matching `platforms` and `build-tools`)

### Build locally

```bash
git clone https://github.com/mrx7014/OneUFy.git
cd OneUFy
chmod +x gradlew
./gradlew assembleDebug
```

The output APK will be located at:
```
app/build/outputs/apk/debug/app-debug.apk
```

### Build via GitHub Actions
This repo includes a workflow under `.github/workflows/` that automatically builds a debug APK on every push. Check the **Actions** tab for build artifacts.

## 📲 Installation & Usage

1. Make sure your device is **rooted** and has **LSPosed** (or a compatible Xposed implementation) installed.
2. Build or download the OneUFy APK and install it normally.
3. Open **LSPosed Manager**, enable the **OneUFy** module, and make sure its scope includes **Settings** (`com.android.settings`).
4. Reboot (or force-stop/restart Settings, depending on your LSPosed setup).
5. Go to **Settings → Display → Font size and style → Font style** and pick any of the bundled fonts (or your own, once the restriction is bypassed).

## 🔧 Customizing / Adding Fonts

To add your own font:
1. Drop the `.ttf`/`.otf` file into `app/src/main/assets/fonts/`.
2. Add a matching XML descriptor in `app/src/main/assets/xml/` following the existing files' format (`<font>` → `<sans>` → `<file>` with `filename` and `droidname`).
3. Rebuild the module.

## ❤️ Credits

- [MonoPatch](https://github.com/Xposed-Modules-Repo/com.htetz.monopatch)
- [HeheJuice](https://github.com/HeheJuice)

## 📄 License

Licensed under the **GNU General Public License v3.0 (GPL-3.0)**. See [LICENSE](LICENSE) for the full text.

## 👤 Author

Developed by [MRX7014](https://github.com/mrx7014)

