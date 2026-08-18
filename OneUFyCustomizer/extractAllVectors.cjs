const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function parseAxmlStrings(buf, poolOffset) {
  const stringCount = buf.readUInt32LE(poolOffset + 8);
  const flags = buf.readUInt32LE(poolOffset + 16);
  const isUtf8 = (flags & (1 << 8)) !== 0;
  const stringsStart = poolOffset + buf.readUInt32LE(poolOffset + 20);

  const offsets = [];
  for (let i = 0; i < stringCount; i++) {
    offsets.push(buf.readUInt32LE(poolOffset + 28 + i * 4));
  }

  const strings = [];
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
      strings.push(buf.toString('utf8', pCur, pCur + u8len));
    } else {
      let charLen = buf.readUInt16LE(p);
      let pCur = p + 2;
      if (charLen & 0x8000) {
        charLen = ((charLen & 0x7fff) << 16) | buf.readUInt16LE(pCur);
        pCur += 2;
      }
      strings.push(buf.toString('utf16le', pCur, pCur + charLen * 2));
    }
  }
  return strings;
}

function parseVectorXml(buf) {
  try {
    if (buf.length < 12) return null;
    const strings = parseAxmlStrings(buf, 8);
    let pos = 8 + buf.readUInt32LE(12);

    if (buf.readUInt16LE(pos) === 0x0180) {
      pos += buf.readUInt32LE(pos + 4);
    }

    let viewportWidth = 24;
    let viewportHeight = 24;
    const paths = [];

    while (pos < buf.length) {
      const type = buf.readUInt16LE(pos);
      const size = buf.readUInt32LE(pos + 4);
      if (size <= 0) break;

      if (type === 0x0102) {
        const nameIdx = buf.readUInt32LE(pos + 20);
        const tagName = strings[nameIdx] || '';
        const attrCount = buf.readUInt16LE(pos + 28);
        const attrs = {};
        const aPos = pos + 36;

        for (let i = 0; i < attrCount; i++) {
          const curAttr = aPos + i * 20;
          const aNameIdx = buf.readUInt32LE(curAttr + 4);
          const aRawVal = buf.readInt32LE(curAttr + 8);
          const aType = buf[curAttr + 15];
          const aData = buf.readUInt32LE(curAttr + 16);
          const aName = strings[aNameIdx];

          let val = null;
          if (aRawVal !== -1 && strings[aRawVal] !== undefined) {
            val = strings[aRawVal];
          } else if (aType === 3) {
            val = strings[aData];
          } else if (aType === 4) {
            val = buf.readFloatLE(curAttr + 16);
          } else if (aType === 16) {
            val = buf.readInt32LE(curAttr + 16);
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
          const d = attrs.pathData;
          if (d && typeof d === 'string' && /^[Mm]\s*[\d\.\-]/.test(d.trim())) {
            const fillColor = attrs.fillColor;
            const strokeColor = attrs.strokeColor;
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
              strokeWidth: hasStroke ? (strokeWidth > 0 ? strokeWidth : 1.5) : undefined,
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
    return null;
  }
}

function processAllApks() {
  const folders = ['Wifi-Icons', 'Signal-Icons', 'Icon-Packs', 'OneUI-7'];
  const results = {};

  for (const folder of folders) {
    const dir = path.join(__dirname, 'assets', folder);
    if (!fs.existsSync(dir)) continue;

    const files = fs.readdirSync(dir).filter(f => f.endsWith('.apk'));
    for (const file of files) {
      const apkPath = path.join(dir, file);
      try {
        const list = execSync(`tar -tf "${apkPath}"`, { encoding: 'utf8' }).split(/\r?\n/).filter(Boolean);

        // Find primary representative drawable
        let target = null;
        if (folder === 'Wifi-Icons' || file.toLowerCase().includes('wifi')) {
          target = list.find(e => e.includes('stat_sys_wifi_signal_4.xml')) ||
                   list.find(e => e.includes('stat_sys_wifi_signal_3.xml')) ||
                   list.find(e => e.includes('stat_sys_wifi_signal_') && e.endsWith('.xml'));
        } else if (folder === 'Signal-Icons' || file.toLowerCase().includes('signal') || file.toLowerCase().includes('satalite')) {
          target = list.find(e => e.includes('stat_sys_signal_5.xml')) ||
                   list.find(e => e.includes('stat_sys_signal_4.xml')) ||
                   list.find(e => e.includes('stat_sys_signal_3.xml')) ||
                   list.find(e => e.includes('stat_sys_signal_') && e.endsWith('.xml')) ||
                   list.find(e => e.includes('stat_sys_data_connected_4g.xml')) ||
                   list.find(e => e.includes('stat_sys_data_4g.xml'));
        } else if (folder === 'Icon-Packs') {
          target = list.find(e => e.includes('sec_stat_sys_alarm.xml')) ||
                   list.find(e => e.includes('stat_sys_alarm.xml')) ||
                   list.find(e => e.includes('stat_sys_vibrate.xml')) ||
                   list.find(e => e.includes('stat_sys_dnd.xml')) ||
                   list.find(e => e.startsWith('res/drawable') && e.endsWith('.xml'));
        }

        if (!target) {
          target = list.find(e => e.startsWith('res/drawable') && e.endsWith('.xml') && !e.includes('Icon.xml'));
        }

        if (target) {
          const buf = execSync(`tar -xf "${apkPath}" -O "${target}"`);
          const parsed = parseVectorXml(buf);
          if (parsed) {
            results[file] = {
              drawableName: target,
              viewBox: parsed.viewBox,
              paths: parsed.paths,
            };
            console.log(`[OK] ${file} -> ${target} (${parsed.paths.length} paths, ${parsed.viewBox})`);
          } else {
            console.log(`[WARN] ${file} -> ${target} failed to parse vector paths`);
          }
        } else {
          console.log(`[WARN] ${file} -> No suitable drawable XML found`);
        }
      } catch (err) {
        console.log(`[ERR] ${file} -> ${err.message}`);
      }
    }
  }

  const outPath = path.join(__dirname, 'webui', 'src', 'data', 'extractedVectors.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8');
  console.log(`\nSuccessfully saved ${Object.keys(results).length} extracted vectors to: ${outPath}`);
}

processAllApks();
