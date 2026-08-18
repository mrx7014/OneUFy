import { execCommand, showSystemToast, isKsuEnvironment } from './ksuBridge';
import {
  OverlayCategory,
  SectionState,
  DeviceInfo,
  OverlayItem,
} from '../types';
import {
  SECTION_CONFIGS,
  getItemsForOneUiVersion,
  ALL_OVERLAYS,
} from '../data/overlayData';
import { formatApkDisplayName } from './dynamicVectorParser';

const MOD_DIR_SCRIPT = `
MODDIR="/data/adb/modules/OneUFy"
if [ ! -d "$MODDIR" ] && [ -d "/data/adb/modules_update/OneUFy" ]; then
  MODDIR="/data/adb/modules_update/OneUFy"
fi
`;

// Trigger device reboot
export async function rebootDevice(): Promise<void> {
  if (isKsuEnvironment()) {
    showSystemToast('Rebooting device...');
    await execCommand('/system/bin/svc power reboot || reboot');
  } else {
    showSystemToast('Simulating device reboot...');
    console.log('[OneUFy] Reboot triggered');
  }
}

// Helper to decode One UI version from property code or Samsung SEP
function decodeOneUiVersion(oneUiRaw: string, sepRaw: string): { display: string; numeric: number } {
  const oneUiNum = parseInt(oneUiRaw, 10);
  if (!isNaN(oneUiNum) && oneUiNum > 0) {
    if (oneUiNum >= 10000) {
      const major = Math.floor(oneUiNum / 10000);
      const rem = oneUiNum % 10000;
      const minor = rem >= 5000 || rem >= 500 ? 5 : rem > 0 ? (Math.floor(rem / 1000) || Math.floor(rem / 100) || 1) : 0;
      return { display: `One UI ${major}.${minor}`, numeric: major + minor / 10 };
    }
    const parsed = parseFloat(oneUiRaw);
    return { display: `One UI ${oneUiRaw}`, numeric: !isNaN(parsed) ? parsed : 7.0 };
  }

  const sep = parseInt(sepRaw, 10);
  if (!isNaN(sep) && sep > 90000) {
    const major = Math.floor((sep - 90000) / 10000);
    const rem = (sep - 90000) % 10000;
    const minor = rem >= 5000 || rem === 500 ? 5 : rem > 0 ? (Math.floor(rem / 1000) || 1) : 0;
    return { display: `One UI ${major}.${minor}`, numeric: major + minor / 10 };
  }

  return { display: 'One UI 7.0', numeric: 7.0 };
}

// Probe device specifications and One UI build version
export async function getDeviceInfo(): Promise<DeviceInfo> {
  const brandRes = await execCommand('getprop ro.product.brand; getprop ro.product.manufacturer');
  const modelRes = await execCommand('getprop ro.product.model; getprop ro.product.device; getprop ro.product.marketname');
  const androidRes = await execCommand('getprop ro.build.version.release');
  const sdkRes = await execCommand('getprop ro.build.version.sdk');
  const sepRes = await execCommand('getprop ro.build.version.sep');
  const oneUiRes = await execCommand('getprop ro.build.version.oneui');

  const brand = brandRes.stdout.split('\n')[0].trim() || 'Samsung';
  const modelLines = modelRes.stdout.split('\n').map((l) => l.trim()).filter(Boolean);
  const model = modelLines[0] || 'Galaxy S24 Ultra';
  const androidVer = androidRes.stdout.trim() || '15';
  const sdkVer = sdkRes.stdout.trim() || '35';

  const decoded = decodeOneUiVersion(oneUiRes.stdout.trim(), sepRes.stdout.trim());

  let rootBackend = 'KernelSU';
  if (isKsuEnvironment()) {
    const ksuVer = await execCommand('which su; getprop ksu.version 2>/dev/null; which apd 2>/dev/null');
    if (ksuVer.stdout.includes('apatch') || ksuVer.stdout.includes('apd')) {
      rootBackend = 'APatch';
    } else if (ksuVer.stdout.includes('magisk')) {
      rootBackend = 'Magisk';
    } else {
      rootBackend = 'KernelSU';
    }
  } else {
    rootBackend = 'Preview Environment';
  }

  // Dynamically fetch module version from module.prop
  const propRes = await execCommand(`${MOD_DIR_SCRIPT}\n[ -f "$MODDIR/module.prop" ] && grep '^version=' "$MODDIR/module.prop" | head -n 1 | cut -d= -f2`);
  const moduleVersion = propRes.stdout.trim() || 'v1.0.0';

  return {
    model,
    brand,
    androidVersion: `v${androidVer} (API ${sdkVer})`,
    oneUiVersion: decoded.display,
    oneUiNumeric: decoded.numeric,
    moduleVersion,
    isSamsung: brand.toLowerCase().includes('samsung') || model.toLowerCase().includes('sm-'),
    rootBackend,
  };
}

// Auto-detect and scan all APK files dynamically from module asset folders
export async function loadCategoryItems(isOneUi7Plus: boolean): Promise<Record<OverlayCategory, OverlayItem[]>> {
  const baseItems = getItemsForOneUiVersion(isOneUi7Plus);
  const result: Record<OverlayCategory, OverlayItem[]> = {
    wifi: [...baseItems.wifi],
    signal: [...baseItems.signal],
    icons: [...baseItems.icons],
  };

  const script = `
${MOD_DIR_SCRIPT}
echo "---WIFI_FILES---"
ls -1 "$MODDIR/assets/Wifi-Icons" 2>/dev/null | grep '\\.apk$'
echo "---SIGNAL_FILES---"
ls -1 "$MODDIR/assets/Signal-Icons" 2>/dev/null | grep '\\.apk$'
echo "---ICON_FILES---"
ls -1 "$MODDIR/assets/Icon-Packs" 2>/dev/null | grep '\\.apk$'
echo "---ONEUI7_FILES---"
ls -1 "$MODDIR/assets/OneUI-7" 2>/dev/null | grep '\\.apk$'
`;

  try {
    const res = await execCommand(script);
    const lines = res.stdout.split('\n').map((l) => l.trim()).filter(Boolean);

    let curSection: string | null = null;
    const dynamicLists: Record<string, string[]> = {
      wifi: [],
      signal: [],
      icons: [],
      oneui7: [],
    };

    for (const line of lines) {
      if (line === '---WIFI_FILES---') { curSection = 'wifi'; continue; }
      if (line === '---SIGNAL_FILES---') { curSection = 'signal'; continue; }
      if (line === '---ICON_FILES---') { curSection = 'icons'; continue; }
      if (line === '---ONEUI7_FILES---') { curSection = 'oneui7'; continue; }
      if (curSection && line.endsWith('.apk')) {
        dynamicLists[curSection].push(line);
      }
    }

    if (isOneUi7Plus) {
      if (dynamicLists.oneui7.length > 0) {
        const wifiApks = dynamicLists.oneui7.filter((f) => f.toLowerCase().includes('wifi'));
        const signalApks = dynamicLists.oneui7.filter((f) => !f.toLowerCase().includes('wifi'));

        if (wifiApks.length > 0) {
          result.wifi = wifiApks.map((filename) => ({
            id: filename.replace(/\.apk$/i, ''),
            name: formatApkDisplayName(filename),
            category: 'wifi',
            filename,
            folderName: 'OneUI-7',
            previewVariant: filename.replace(/\.apk$/i, ''),
            isOneUi7Only: true,
          }));
        }

        if (signalApks.length > 0) {
          result.signal = signalApks.map((filename) => ({
            id: filename.replace(/\.apk$/i, ''),
            name: formatApkDisplayName(filename),
            category: 'signal',
            filename,
            folderName: 'OneUI-7',
            previewVariant: filename.replace(/\.apk$/i, ''),
            isOneUi7Only: true,
          }));
        }
      }
    } else {
      if (dynamicLists.wifi.length > 0) {
        result.wifi = dynamicLists.wifi.map((filename) => ({
          id: filename.replace(/\.apk$/i, ''),
          name: formatApkDisplayName(filename),
          category: 'wifi',
          filename,
          folderName: 'Wifi-Icons',
          previewVariant: filename.replace(/\.apk$/i, ''),
        }));
      }
      if (dynamicLists.signal.length > 0) {
        result.signal = dynamicLists.signal.map((filename) => ({
          id: filename.replace(/\.apk$/i, ''),
          name: formatApkDisplayName(filename),
          category: 'signal',
          filename,
          folderName: 'Signal-Icons',
          previewVariant: filename.replace(/\.apk$/i, ''),
        }));
      }
      if (dynamicLists.icons.length > 0) {
        result.icons = dynamicLists.icons.map((filename) => ({
          id: filename.replace(/\.apk$/i, ''),
          name: formatApkDisplayName(filename),
          category: 'icons',
          filename,
          folderName: 'Icon-Packs',
          previewVariant: filename.replace(/\.apk$/i, ''),
        }));
      }
    }
  } catch (e) {
    console.warn('[OneUFy] Dynamic scan fallback to standard items:', e);
  }

  return result;
}

// Fetch current state for all sections
export async function getSectionsState(
  loadedItems: Record<OverlayCategory, OverlayItem[]>
): Promise<Record<OverlayCategory, SectionState>> {
  const result: Record<OverlayCategory, SectionState> = {
    wifi: {
      category: 'wifi',
      enabled: false,
      selectedId: loadedItems.wifi[0]?.id || 'wifi5',
      selectedName: loadedItems.wifi[0]?.name || 'Wi-Fi Status Bar',
      selectedFilename: loadedItems.wifi[0]?.filename || 'wifi5.apk',
      itemCount: loadedItems.wifi.length,
    },
    signal: {
      category: 'signal',
      enabled: false,
      selectedId: loadedItems.signal[0]?.id || 'signal8-5-5',
      selectedName: loadedItems.signal[0]?.name || 'Signal Status Bar',
      selectedFilename: loadedItems.signal[0]?.filename || 'signal8.5-5.apk',
      itemCount: loadedItems.signal.length,
    },
    icons: {
      category: 'icons',
      enabled: false,
      selectedId: loadedItems.icons[0]?.id || 'inline-pack',
      selectedName: loadedItems.icons[0]?.name || 'System Icon Pack',
      selectedFilename: loadedItems.icons[0]?.filename || 'InLine-pack.apk',
      itemCount: loadedItems.icons.length,
    },
  };

  const script = `
${MOD_DIR_SCRIPT}
[ -f "$MODDIR/assets/Wifi-Icons/.on" ] || [ -f "$MODDIR/assets/OneUI-7/.on_wifi" ] && echo "WIFI_ON=1" || echo "WIFI_ON=0"
[ -f "$MODDIR/assets/Signal-Icons/.on" ] || [ -f "$MODDIR/assets/OneUI-7/.on_signal" ] && echo "SIGNAL_ON=1" || echo "SIGNAL_ON=0"
[ -f "$MODDIR/assets/Icon-Packs/.on" ] && echo "ICONS_ON=1" || echo "ICONS_ON=0"

[ -f "$MODDIR/assets/Wifi-Icons/.selected" ] && echo "WIFI_SEL=$(cat "$MODDIR/assets/Wifi-Icons/.selected")"
[ -f "$MODDIR/assets/OneUI-7/.selected_wifi" ] && echo "WIFI_SEL=$(cat "$MODDIR/assets/OneUI-7/.selected_wifi")"
[ -f "$MODDIR/assets/Signal-Icons/.selected" ] && echo "SIGNAL_SEL=$(cat "$MODDIR/assets/Signal-Icons/.selected")"
[ -f "$MODDIR/assets/OneUI-7/.selected_signal" ] && echo "SIGNAL_SEL=$(cat "$MODDIR/assets/OneUI-7/.selected_signal")"
[ -f "$MODDIR/assets/Icon-Packs/.selected" ] && echo "ICONS_SEL=$(cat "$MODDIR/assets/Icon-Packs/.selected")"

echo "OVERLAYS_START"
ls "$MODDIR/system/product/overlay" 2>/dev/null
echo "OVERLAYS_END"
`;

  const res = await execCommand(script);
  const lines = res.stdout.split('\n');

  let inOverlays = false;
  const overlayFiles: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === 'OVERLAYS_START') { inOverlays = true; continue; }
    if (line === 'OVERLAYS_END') { inOverlays = false; continue; }
    if (inOverlays && line) {
      overlayFiles.push(line);
      continue;
    }

    if (line === 'WIFI_ON=1') result.wifi.enabled = true;
    if (line === 'SIGNAL_ON=1') result.signal.enabled = true;
    if (line === 'ICONS_ON=1') result.icons.enabled = true;

    if (line.startsWith('WIFI_SEL=')) {
      const file = line.replace('WIFI_SEL=', '').trim();
      const found = loadedItems.wifi.find((i) => i.filename.toLowerCase() === file.toLowerCase());
      if (found) {
        result.wifi.selectedId = found.id;
        result.wifi.selectedName = found.name;
        result.wifi.selectedFilename = found.filename;
      }
    }
    if (line.startsWith('SIGNAL_SEL=')) {
      const file = line.replace('SIGNAL_SEL=', '').trim();
      const found = loadedItems.signal.find((i) => i.filename.toLowerCase() === file.toLowerCase());
      if (found) {
        result.signal.selectedId = found.id;
        result.signal.selectedName = found.name;
        result.signal.selectedFilename = found.filename;
      }
    }
    if (line.startsWith('ICONS_SEL=')) {
      const file = line.replace('ICONS_SEL=', '').trim();
      const found = loadedItems.icons.find((i) => i.filename.toLowerCase() === file.toLowerCase());
      if (found) {
        result.icons.selectedId = found.id;
        result.icons.selectedName = found.name;
        result.icons.selectedFilename = found.filename;
      }
    }
  }

  // Cross-reference active overlay files
  for (const ofile of overlayFiles) {
    for (const cat of ['wifi', 'signal', 'icons'] as OverlayCategory[]) {
      const found = loadedItems[cat].find((i) => i.filename.toLowerCase() === ofile.toLowerCase());
      if (found) {
        result[cat].enabled = true;
        result[cat].selectedId = found.id;
        result[cat].selectedName = found.name;
        result[cat].selectedFilename = found.filename;
      }
    }
  }

  return result;
}

// Update module.prop with human-readable active overlay summary
export async function updateModuleProp(states: Record<OverlayCategory, SectionState>): Promise<void> {
  const activeParts: string[] = [];

  if (states.wifi?.enabled && states.wifi.selectedName) {
    activeParts.push(`Wifi (${states.wifi.selectedName})`);
  }
  if (states.signal?.enabled && states.signal.selectedName) {
    activeParts.push(`Signal (${states.signal.selectedName})`);
  }
  if (states.icons?.enabled && states.icons.selectedName) {
    activeParts.push(`IconPack (${states.icons.selectedName})`);
  }

  let formattedStatus: string;
  if (activeParts.length > 0) {
    formattedStatus = `(${activeParts.length} overlays applied : ${activeParts.join(', ')})`;
  } else {
    formattedStatus = '[No overlays applied]';
  }

  const baseDescription = 'Take OneUI to another level ;)';
  const fullDescription = `${baseDescription} • ${formattedStatus}`;

  const script = `
${MOD_DIR_SCRIPT}
PROP="$MODDIR/module.prop"
if [ -f "$PROP" ]; then
  sed -i "s|^description=.*|description=${fullDescription.replace(/[&/\\#+]/g, '\\$&')}|" "$PROP"
fi
`;

  await execCommand(script);
}

// Toggle master section switch
export async function toggleSection(
  category: OverlayCategory,
  enabled: boolean,
  currentStates: Record<OverlayCategory, SectionState>,
  loadedItems: Record<OverlayCategory, OverlayItem[]>
): Promise<{ success: boolean; updatedStates: Record<OverlayCategory, SectionState> }> {
  const state = currentStates[category];
  const items = loadedItems[category];
  const selectedItem =
    (state.selectedId ? items.find((i) => i.id === state.selectedId) : null) ||
    items[0];

  const folderName = selectedItem.folderName || 'Wifi-Icons';
  const filename = selectedItem.filename;

  let script = `${MOD_DIR_SCRIPT}\n`;
  script += `mkdir -p "$MODDIR/system/product/overlay"\n`;

  const onFlag = folderName === 'OneUI-7'
    ? `$MODDIR/assets/OneUI-7/.on_${category}`
    : `$MODDIR/assets/${folderName}/.on`;

  const selFlag = folderName === 'OneUI-7'
    ? `$MODDIR/assets/OneUI-7/.selected_${category}`
    : `$MODDIR/assets/${folderName}/.selected`;

  if (enabled) {
    script += `touch "${onFlag}"\n`;
    script += `echo "${filename}" > "${selFlag}"\n`;
    for (const item of items) {
      script += `rm -f "$MODDIR/system/product/overlay/${item.filename}"\n`;
    }
    script += `cp -f "$MODDIR/assets/${folderName}/${filename}" "$MODDIR/system/product/overlay/${filename}"\n`;
    script += `chmod 644 "$MODDIR/system/product/overlay/${filename}"\n`;
  } else {
    script += `rm -f "${onFlag}"\n`;
    for (const item of items) {
      script += `rm -f "$MODDIR/system/product/overlay/${item.filename}"\n`;
    }
  }

  const res = await execCommand(script);

  const updatedStates: Record<OverlayCategory, SectionState> = {
    ...currentStates,
    [category]: {
      ...state,
      enabled,
      selectedId: selectedItem.id,
      selectedName: selectedItem.name,
      selectedFilename: selectedItem.filename,
    },
  };

  await updateModuleProp(updatedStates);

  return { success: res.errno === 0, updatedStates };
}

// Select an overlay item inside a section
export async function selectOverlayItem(
  item: OverlayItem,
  currentStates: Record<OverlayCategory, SectionState>,
  loadedItems: Record<OverlayCategory, OverlayItem[]>
): Promise<{ success: boolean; updatedStates: Record<OverlayCategory, SectionState> }> {
  const category = item.category;
  const isEnabled = currentStates[category].enabled;
  const folderName = item.folderName || 'Wifi-Icons';
  const items = loadedItems[category];

  let script = `${MOD_DIR_SCRIPT}\n`;
  script += `mkdir -p "$MODDIR/system/product/overlay"\n`;

  const selFlag = folderName === 'OneUI-7'
    ? `$MODDIR/assets/OneUI-7/.selected_${category}`
    : `$MODDIR/assets/${folderName}/.selected`;

  script += `echo "${item.filename}" > "${selFlag}"\n`;

  if (isEnabled) {
    for (const other of items) {
      script += `rm -f "$MODDIR/system/product/overlay/${other.filename}"\n`;
    }
    script += `cp -f "$MODDIR/assets/${folderName}/${item.filename}" "$MODDIR/system/product/overlay/${item.filename}"\n`;
    script += `chmod 644 "$MODDIR/system/product/overlay/${item.filename}"\n`;
  }

  const res = await execCommand(script);

  const updatedStates: Record<OverlayCategory, SectionState> = {
    ...currentStates,
    [category]: {
      ...currentStates[category],
      selectedId: item.id,
      selectedName: item.name,
      selectedFilename: item.filename,
    },
  };

  if (isEnabled) {
    await updateModuleProp(updatedStates);
  }

  return { success: res.errno === 0, updatedStates };
}
