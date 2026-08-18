import extractedVectors from '../data/extractedVectors.json';
import { OverlayItem } from '../types';
import { execCommand, isKsuEnvironment } from './ksuBridge';

export interface SvgPathData {
  d: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  strokeLineCap?: 'round' | 'butt' | 'square';
  strokeLineJoin?: 'round' | 'bevel' | 'miter';
  fillOpacity?: number;
  strokeOpacity?: number;
}

export interface ExtractedVector {
  viewBox: string;
  paths: SvgPathData[];
}

const precompiledVectors = extractedVectors as Record<string, ExtractedVector>;

// Specific clean display name overrides
const EXACT_NAMES: Record<string, string> = {
  'wifi5.apk': 'WIFI 5 OneUI 7+',
  'wifi6.apk': 'WIFI 6 OneUI 7+',
  'wifi7.apk': 'WIFI 7 OneUI 7+',
  'wifi6e.apk': 'WIFI 6E OneUI 7+',
  'NothingUI7-wifi.apk': 'Nothing WIFI OneUI 7+',
  'signal8.5-5.apk': 'Signal 8.5 5 OneUI 7+',
  'InsanityNext-1-signal.apk': 'Signal 8.5 4 OneUI 7+',
  'satalite-4-signal.apk': 'Signal Satalite 4 OneUI 7+',
  'satalite-5-signal.apk': 'Signal Satalite 5 OneUI 7+',
  'signal-5.apk': 'Signal Orig 5 OneUI 7+',
  'InsanityNext-2-signal.apk': 'Nothing Signal OneUI 7+',
};

// Convert APK filename to human-friendly name dynamically
export function formatApkDisplayName(filename: string): string {
  if (EXACT_NAMES[filename]) {
    return EXACT_NAMES[filename];
  }

  let name = filename
    .replace(/\.apk$/i, '')
    .replace(/-(?:wifi|signal|pack)$/i, '')
    .replace(/[_\-]+/g, ' ')
    .trim();

  // Known brand acronym mappings
  const wordMap: Record<string, string> = {
    ios: 'iOS',
    emui: 'EMUI',
    dnd: 'DND',
    oxygenos: 'OxygenOS',
    oxygenosold: 'OxygenOS Old',
    inline: 'InLine',
    inline2: 'InLine 2',
    lineoutlinein: 'Line Outline In',
    linesup: 'Lines Up',
    counandlines: 'Count & Lines',
    dotandlines: 'Dot & Lines',
    underlineanddot: 'Underline & Dot',
    wallandlines: 'Wall & Lines',
    weavesoup: 'Weave Soup',
    weavesup: 'Weaves Up',
    wevawevo: 'Weva Wevo',
    lineslineslines: 'Triple Tier Lines',
  };

  const lower = name.toLowerCase().replace(/\s+/g, '');
  if (wordMap[lower]) {
    return wordMap[lower];
  }

  return name
    .split(' ')
    .map((w) => {
      const wLower = w.toLowerCase();
      if (wordMap[wLower]) return wordMap[wLower];
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(' ');
}

// Parse UTF-8 / UTF-16 strings from AXML pool
function parseAxmlStrings(buf: Uint8Array, poolOffset: number): string[] {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const stringCount = view.getUint32(poolOffset + 8, true);
  const flags = view.getUint32(poolOffset + 16, true);
  const isUtf8 = (flags & (1 << 8)) !== 0;
  const stringsStart = poolOffset + view.getUint32(poolOffset + 20, true);

  const offsets: number[] = [];
  for (let i = 0; i < stringCount; i++) {
    offsets.push(view.getUint32(poolOffset + 28 + i * 4, true));
  }

  const strings: string[] = [];
  const textDecoderUtf8 = new TextDecoder('utf-8');
  const textDecoderUtf16 = new TextDecoder('utf-16le');

  for (let i = 0; i < stringCount; i++) {
    const p = stringsStart + offsets[i];
    if (isUtf8) {
      let u16len = buf[p];
      let pCur = p + 1;
      if (u16len & 0x80) pCur++;
      let u8len = buf[pCur++];
      if (u8len & 0x80) {
        u8len = ((u8len & 0x7f) << 8) | buf[pCur++];
      }
      strings.push(textDecoderUtf8.decode(buf.subarray(pCur, pCur + u8len)));
    } else {
      let charLen = view.getUint16(p, true);
      let pCur = p + 2;
      if (charLen & 0x8000) {
        charLen = ((charLen & 0x7fff) << 16) | view.getUint16(pCur, true);
        pCur += 2;
      }
      strings.push(textDecoderUtf16.decode(buf.subarray(pCur, pCur + charLen * 2)));
    }
  }

  return strings;
}

// Parse Vector XML buffer to structured SVG data
export function parseVectorXml(buf: Uint8Array): ExtractedVector | null {
  try {
    if (buf.length < 12) return null;
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    const strings = parseAxmlStrings(buf, 8);
    let pos = 8 + view.getUint32(12, true);

    if (view.getUint16(pos, true) === 0x0180) {
      pos += view.getUint32(pos + 4, true);
    }

    let viewportWidth = 24;
    let viewportHeight = 24;
    const paths: SvgPathData[] = [];

    while (pos < buf.length) {
      const type = view.getUint16(pos, true);
      const size = view.getUint32(pos + 4, true);
      if (size <= 0) break;

      if (type === 0x0102) {
        const nameIdx = view.getUint32(pos + 20, true);
        const tagName = strings[nameIdx] || '';
        const attrCount = view.getUint16(pos + 28, true);
        const attrs: Record<string, unknown> = {};
        const aPos = pos + 36;

        for (let i = 0; i < attrCount; i++) {
          const curAttr = aPos + i * 20;
          const aNameIdx = view.getUint32(curAttr + 4, true);
          const aRawVal = view.getInt32(curAttr + 8, true);
          const aType = buf[curAttr + 15];
          const aData = view.getUint32(curAttr + 16, true);
          const aName = strings[aNameIdx];

          let val: unknown = null;
          if (aRawVal !== -1 && strings[aRawVal] !== undefined) {
            val = strings[aRawVal];
          } else if (aType === 3) {
            val = strings[aData];
          } else if (aType === 4) {
            val = view.getFloat32(curAttr + 16, true);
          } else if (aType === 16) {
            val = view.getInt32(curAttr + 16, true);
          } else if (aType === 28 || aType === 29) {
            val = '#' + aData.toString(16).padStart(8, '0');
          } else {
            val = aData;
          }

          if (aName) {
            attrs[aName] = val;
          }
        }

        if (tagName === 'vector') {
          if (typeof attrs.viewportWidth === 'number') viewportWidth = attrs.viewportWidth;
          else if (attrs.viewportWidth) viewportWidth = parseFloat(String(attrs.viewportWidth));
          if (typeof attrs.viewportHeight === 'number') viewportHeight = attrs.viewportHeight;
          else if (attrs.viewportHeight) viewportHeight = parseFloat(String(attrs.viewportHeight));
        } else if (tagName === 'path') {
          const d = attrs.pathData as string;
          if (d && typeof d === 'string' && /^[Mm]\s*[\d\.\-]/.test(d.trim())) {
            const fillColor = attrs.fillColor as string;
            const strokeColor = attrs.strokeColor as string;
            const strokeWidth = typeof attrs.strokeWidth === 'number' ? attrs.strokeWidth : parseFloat(String(attrs.strokeWidth || '0'));
            const fillAlpha = typeof attrs.fillAlpha === 'number' ? attrs.fillAlpha : (attrs.fillAlpha !== undefined ? parseFloat(String(attrs.fillAlpha)) : 1);
            const strokeAlpha = typeof attrs.strokeAlpha === 'number' ? attrs.strokeAlpha : (attrs.strokeAlpha !== undefined ? parseFloat(String(attrs.strokeAlpha)) : 1);

            const isTransparentFill = !fillColor || fillColor.startsWith('#00') || fillColor === '#00000000' || fillAlpha === 0;
            const hasStroke = (strokeColor && !strokeColor.startsWith('#00')) || strokeWidth > 0;

            const svgFill = isTransparentFill ? 'none' : 'currentColor';
            const svgStroke = hasStroke ? 'currentColor' : 'none';

            paths.push({
              d,
              fill: svgFill,
              stroke: svgStroke,
              strokeWidth: hasStroke ? Math.min(strokeWidth > 0 ? strokeWidth : 1.5, 2.2) : undefined,
              strokeLineCap: 'round',
              strokeLineJoin: 'round',
              fillOpacity: !isTransparentFill && fillAlpha < 1 ? fillAlpha : undefined,
              strokeOpacity: hasStroke && strokeAlpha < 1 ? strokeAlpha : undefined,
            });
          }
        }
      }

      pos += size;
    }

    if (paths.length === 0) return null;
    return { viewBox: `0 0 ${viewportWidth} ${viewportHeight}`, paths };
  } catch (err) {
    console.warn('Failed to parse vector XML buffer:', err);
    return null;
  }
}

// Retrieve or dynamically extract & cache vector SVG for an overlay item
export async function getVectorForOverlay(item: OverlayItem): Promise<ExtractedVector | null> {
  const cacheKey = `oneufy_svg_cache_${item.filename}`;

  // 1. Check browser localStorage cache
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached) as ExtractedVector;
      if (parsed && parsed.paths && parsed.paths.length > 0) {
        return parsed;
      }
    }
  } catch {
    // Ignore storage read errors
  }

  // 2. Check bundled precompiled vectors
  if (precompiledVectors[item.filename]) {
    const vector = precompiledVectors[item.filename];
    try {
      localStorage.setItem(cacheKey, JSON.stringify(vector));
    } catch {
      // Ignore storage write errors
    }
    return vector;
  }

  // 3. Dynamic on-device shell extraction if running in root environment
  if (isKsuEnvironment()) {
    try {
      const folder = item.category === 'wifi' ? 'Wifi-Icons' :
                     item.category === 'signal' ? 'Signal-Icons' :
                     item.category === 'icons' ? 'Icon-Packs' : 'OneUI-7';

      const script = `
MODDIR="/data/adb/modules/OneUFy"
[ ! -d "$MODDIR" ] && MODDIR="/data/adb/modules_update/OneUFy"
APK="$MODDIR/assets/${folder}/${item.filename}"

if [ -f "$APK" ]; then
  DRAWABLE=$(unzip -l "$APK" "res/drawable/*.xml" 2>/dev/null | grep -E 'stat_sys_wifi_signal_4|stat_sys_signal_5|stat_sys_signal_4|sec_stat_sys_alarm|stat_sys_alarm|Icon.xml' | awk '{print $4}' | head -n 1)
  [ -z "$DRAWABLE" ] && DRAWABLE=$(unzip -l "$APK" "res/drawable/*.xml" 2>/dev/null | awk '{print $4}' | grep '\\.xml$' | head -n 1)
  if [ -n "$DRAWABLE" ]; then
    unzip -p "$APK" "$DRAWABLE" | base64 | tr -d '\\r\\n'
  fi
fi
`;
      const res = await execCommand(script);
      const b64 = res.stdout.trim();
      if (b64) {
        const binStr = atob(b64);
        const bytes = new Uint8Array(binStr.length);
        for (let i = 0; i < binStr.length; i++) {
          bytes[i] = binStr.charCodeAt(i);
        }
        const parsed = parseVectorXml(bytes);
        if (parsed) {
          try {
            localStorage.setItem(cacheKey, JSON.stringify(parsed));
          } catch {
            // Ignore
          }
          return parsed;
        }
      }
    } catch (err) {
      console.warn('[OneUFy] On-device dynamic vector extraction failed:', err);
    }
  }

  return null;
}
