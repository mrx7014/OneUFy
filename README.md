# OneUFy — Samsung OneUI Customization Suite

<img src="assets/banner.jpg">

<p align="center">
  <strong>Custom Fonts & Next-Generation Status Bar / System UI Customizer for Samsung One UI</strong><br>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/OneUI-5.0%20to%207.0%2B-005AC1?style=flat-square&logo=samsung" alt="OneUI Version" />
  <img src="https://img.shields.io/badge/Root-KernelSU%20%7C%20APatch%20%7C%20Magisk%20%7C%20LSPosed-3B82F6?style=flat-square" alt="Root Backend" />
  <img src="https://img.shields.io/badge/Design-Material%203-22C55E?style=flat-square" alt="Material 3" />
  <img src="https://img.shields.io/badge/License-GPL--3.0-blue?style=flat-square" alt="License" />
</p>

---

## 📖 Overview

**OneUFy** is a two-part customization suite for Samsung Galaxy devices running **One UI 5.x, 6.x, and 7.0+**. It ships as two independent, complementary modules under the same project:

1. **OneUFy Fonts** — an LSPosed/Xposed module that bypasses OneUI's font validation restriction, letting any custom font (including merged Arabic/English typefaces) be applied through the stock font picker.
2. **OneUFy Customizer** — a KernelSU / APatch / Magisk root module with an interactive WebUI for real-time status bar overlay selection (Wi-Fi, cellular/signal, satellite, and full icon packs).

Each module can be installed independently depending on which customization you need.

---

## 🅰️ OneUFy Fonts (LSPosed Module)

**Custom Fonts as you like (For OneUI)**

Removes the system-level font validation restriction, allowing any custom font — including merged Arabic/English typefaces — to be applied through OneUI's built-in font picker.

> ⚠️ **Requires a rooted device with LSPosed (or a compatible Xposed framework) installed.** This is **not** a regular standalone app — it only works when loaded as a module and scoped to `com.android.settings`.

### ⚙️ How it works

Samsung's Settings app (`com.android.settings`) validates fonts through `SecDisplayUtils.isInvalidFont()` before allowing them to be applied system-wide. OneUFy Fonts hooks this method via Xposed and forces it to always return `false`, bypassing the restriction so unofficial/custom fonts are accepted like official ones.

It also ships a set of ready-to-use, pre-merged Arabic + English fonts under `Fonts/app/src/main/assets/fonts/`, each paired with a FlipFont-style XML descriptor under `Fonts/app/src/main/assets/xml/`:

- SanFrancisco (AR/EN)
- Minecraft Regular (AR/EN)
- Minecraft Bold (AR/EN)
- RoundedA16 (AR/EN)

### 📦 Project Structure

```text
OneUFyFonts/
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

### 🛠️ Building

**Requirements:** JDK 17, Android SDK (with matching `platforms` and `build-tools`)

```bash
git clone https://github.com/mrx7014/OneUFy.git
cd OneUFy/Fonts
chmod +x gradlew
./gradlew assembleDebug
```

Output APK: `Fonts/app/build/outputs/apk/debug/app-debug.apk`

This repo includes a GitHub Actions workflow that automatically builds a debug APK on every push — check the **Actions** tab for build artifacts.

### 📲 Installation & Usage

1. Make sure your device is **rooted** and has **LSPosed** (or a compatible Xposed implementation) installed.
2. Build or download the OneUFy Fonts APK and install it normally.
3. Open **LSPosed Manager**, enable the **OneUFy** module, and make sure its scope includes **Settings** (`com.android.settings`).
4. Reboot (or force-stop/restart Settings, depending on your LSPosed setup).
5. Go to **Settings → Display → Font size and style → Font style** and pick any of the bundled fonts (or your own, once the restriction is bypassed).

### 🔧 Customizing / Adding Fonts

1. Drop the `.ttf`/`.otf` file into `Fonts/app/src/main/assets/fonts/`.
2. Add a matching XML descriptor in `Fonts/app/src/main/assets/xml/` following the existing files' format (`<font>` → `<sans>` → `<file>` with `filename` and `droidname`).
3. Rebuild the module.

---

## 🅱️ OneUFy Customizer (Magisk / KernelSU / APatch Module)

**Next-Generation Status Bar & System UI Customizer for Samsung One UI**

A modular root module + interactive WebUI designed to customize Samsung Galaxy devices running **One UI 5.x, 6.x, and 7.0+**, providing seamless, real-time overlay selection for status bar Wi-Fi signal arcs, cellular meters, satellite connectivity badges, and complete system icon packs — all managed through a fluid, touch-optimized interface following Samsung's One UI aesthetic and Material 3 standards.

### ✨ Features

- **One UI 7.0+ Smart Compatibility Mode**:
  - Automatically isolates and displays **exclusive One UI 7+ overlay APKs** (Wi-Fi 5/6/6E/7, Nothing Wi-Fi, Signal 8.5, and direct Satellite indicators).
  - Automatically hides legacy One UI 5/6 packs to prevent system instabilities on newer One UI builds.
  - Includes a persistent, dismissable compatibility toast banner with `localStorage` memory.
- **Legacy One UI Mode (One UI 5.x & 6.x)**:
  - 14 Wi-Fi status bar indicator styles.
  - 32 handcrafted cellular signal and satellite meter styles.
  - 9 comprehensive system status icon packs replacing alarm, vibrate, DND, and sound glyphs.
- **Interactive Reboot Workflow**:
  - Displays instantaneous feedback toasts on switching overlays with a 1-tap **[Reboot Now]** action.
  - Dedicated hardware power / reboot action in the top app bar header.
- **AXML Vector Extraction Engine**:
  - Decodes Android Binary XML (`AXML`) directly from APK resources without requiring apktool or Java on device.
  - Compiles high-precision SVG vector datasets into `extractedVectors.json` for pixel-perfect previews.
- **Zero-Dependency Module Packager**:
  - Bundles the module into a flashable `.zip` with SHA-256 validation via native Node.js streams.

### 🗂️ Project Structure

```text
OneUFyCustomizer/
├── .github/                       # GitHub workflows and repository configurations
├── META-INF/                      # Magisk / KernelSU installer scripts
│   └── com/google/android/
│       ├── update-binary          # Standard installer wrapper
│       └── updater-script         # Flashable dummy script
├── assets/                        # Categorized overlay APK collections
│   ├── Icon-Packs/                # 9 System & status icon pack overlays (Legacy)
│   ├── OneUI-7/                   # 11 One UI 7.0+ exclusive overlay APKs
│   ├── Signal-Icons/              # 32 Cellular signal meter overlays (Legacy)
│   └── Wifi-Icons/                # 14 Wi-Fi status bar overlays (Legacy)
├── system/                        # Target overlay mount folder for SystemUI
│   └── product/
│       └── overlay/               # Active overlays copied here at runtime
├── webroot/                       # Compiled production WebUI (served to KernelSU)
│   ├── index.html                 # Minified entrypoint
│   └── assets/                    # Compiled JS and CSS bundles
├── webui/                         # Full React 19 + TypeScript source code
│   ├── src/
│   │   ├── components/            # React UI components
│   │   ├── data/                  # Category configs & extracted vector dataset
│   │   ├── services/               # KSU/APatch/Magisk bridge, overlay manager, AXML parser
│   │   ├── styles/                 # Layout + Material 3 Expressive tokens
│   │   ├── types.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── customize.sh                   # Magisk / KernelSU / APatch module installer
├── extractAllVectors.cjs          # Automated tool to extract SVGs from all APKs
├── module.prop                    # Module metadata & dynamic active overlays text
└── packageModule.cjs              # Zero-dependency flashable zip creator
```

### 🛠️ Scripts & Tooling

**`packageModule.cjs`** — collects all necessary module files (`assets`, `system`, `webroot`, `customize.sh`, `module.prop`, `META-INF`), builds `OneUFy-v1.0.0.zip`, and generates a SHA-256 checksum file.
```bash
node packageModule.cjs
```

**`extractAllVectors.cjs`** — unpacks every `.apk` across all 4 asset folders, parses the AXML StringPool and vector chunk definitions, and extracts SVG path data into `webui/src/data/extractedVectors.json`.
```bash
node extractAllVectors.cjs
```

**`customize.sh`** — device-side installation script executed when flashing via KernelSU, APatch, or Magisk Manager. Prepares directory permissions (`0755`), creates overlay storage directories, and initializes module properties.

### 💻 Development & Building

**Requirements:** Node.js (v18.0.0+), npm

```bash
npm --prefix webui install       # Install dependencies
npm --prefix webui run dev       # Start dev server (browser simulation)
npm --prefix webui run build     # Build production WebUI bundle → webroot/
node packageModule.cjs           # Create flashable module ZIP
```

> **Tip**: In Browser Preview mode, clicking the **One UI Version Badge** in the Header Card toggles between **One UI 7.0+** and **One UI 6.1** mode to test dynamic overlay filtering and compatibility notices.

### 📱 How Overlays Work

1. **Activation**: When a user selects a style and toggles a category switch ON, the WebUI invokes root shell commands to copy the selected APK from `assets/<Folder>/<filename>.apk` to `/data/adb/modules/OneUFy/system/product/overlay/<filename>.apk`.
2. **Persistence**: The active selection is saved in `.selected` and `.on` flags within the asset directory, and reflected dynamically in the module description inside `module.prop`.
3. **Application**: On device reboot, the Android overlay subsystem automatically prioritizes and overlays the SystemUI drawable resources with the chosen custom status icons.

---

## ❤️ Credits

- [MonoPatch](https://github.com/Xposed-Modules-Repo/com.htetz.monopatch)
- [HeheJuice](https://github.com/HeheJuice)

## 📄 License

Both modules are open-source and licensed under the **GNU General Public License v3.0 (GPL-3.0)**. See [LICENSE](LICENSE) for the full text.

## 👤 Author

Developed by [MRX7014](https://github.com/mrx7014), [ZG089](https://github.com/ZGX089)
