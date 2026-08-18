const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function readZipEntries(buffer) {
  let entries = [];
  let eocdOffset = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocdOffset === -1) return entries;
  let cdOffset = buffer.readUInt32LE(eocdOffset + 16);
  let cdEntries = buffer.readUInt16LE(eocdOffset + 10);
  let pos = cdOffset;
  for (let i = 0; i < cdEntries; i++) {
    if (buffer.readUInt32LE(pos) !== 0x02014b50) break;
    let method = buffer.readUInt16LE(pos + 10);
    let compSize = buffer.readUInt32LE(pos + 20);
    let nameLen = buffer.readUInt16LE(pos + 28);
    let extraLen = buffer.readUInt16LE(pos + 30);
    let commentLen = buffer.readUInt16LE(pos + 32);
    let localHeaderOffset = buffer.readUInt32LE(pos + 42);
    let name = buffer.toString('utf8', pos + 46, pos + 46 + nameLen);
    
    let localNameLen = buffer.readUInt16LE(localHeaderOffset + 26);
    let localExtraLen = buffer.readUInt16LE(localHeaderOffset + 28);
    let dataOffset = localHeaderOffset + 30 + localNameLen + localExtraLen;
    let compData = buffer.subarray(dataOffset, dataOffset + compSize);
    let data = method === 0 ? compData : zlib.inflateRawSync(compData);
    entries.push({ name, data });
    pos += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function parseStrings(buf, poolOffset) {
  let stringCount = buf.readUInt32LE(poolOffset + 8);
  let isUtf8 = (buf.readUInt32LE(poolOffset + 16) & (1 << 8)) !== 0;
  let stringsStart = poolOffset + buf.readUInt32LE(poolOffset + 20);
  let offsets = [];
  for (let i = 0; i < stringCount; i++) offsets.push(buf.readUInt32LE(poolOffset + 28 + i * 4));
  let strings = [];
  for (let i = 0; i < stringCount; i++) {
    let p = stringsStart + offsets[i];
    if (isUtf8) {
      let u16len = buf[p++]; if (u16len & 0x80) p++;
      let u8len = buf[p++]; if (u8len & 0x80) u8len = ((u8len & 0x7f) << 8) | buf[p++];
      strings.push(buf.toString('utf8', p, p + u8len));
    } else {
      let charLen = buf.readUInt16LE(p); p += 2;
      if (charLen & 0x8000) { charLen = ((charLen & 0x7fff) << 16) | buf.readUInt16LE(p); p += 2; }
      strings.push(buf.toString('utf16le', p, p + charLen * 2));
    }
  }
  return strings;
}

function parseVectorXml(buf) {
  if (!buf || buf.length < 12) return null;
  const strings = parseStrings(buf, 8);
  let pos = 8 + buf.readUInt32LE(12);

  if (buf.readUInt16LE(pos) === 0x0180) {
    pos += buf.readUInt32LE(pos + 4);
  }

  let root = null;
  let current = null;
  const stack = [];

  while (pos < buf.length) {
    let type = buf.readUInt16LE(pos);
    let size = buf.readUInt32LE(pos + 4);
    if (size <= 0) break;

    if (type === 0x0102) {
      let nameIdx = buf.readUInt32LE(pos + 20);
      let tagName = strings[nameIdx] || 'tag';
      let attrCount = buf.readUInt16LE(pos + 28);
      let attrs = {};
      let aPos = pos + 36;

      for (let i = 0; i < attrCount; i++) {
        let aNameIdx = buf.readUInt32LE(aPos + 4);
        let aRawVal = buf.readInt32LE(aPos + 8);
        let aType = buf[aPos + 15];
        let aData = buf.readUInt32LE(aPos + 16);
        let aName = strings[aNameIdx];

        let val = null;
        if (aRawVal !== -1 && strings[aRawVal] !== undefined) {
          val = strings[aRawVal];
        } else if (aType === 3) {
          val = strings[aData];
        } else if (aType === 4) {
          val = buf.readFloatLE(aPos + 16);
        } else if (aType === 16) {
          val = buf.readInt32LE(aPos + 16);
        } else if (aType === 17) {
          val = '0x' + aData.toString(16);
        } else if (aType === 18) {
          val = aData !== 0;
        } else if (aType === 28 || aType === 29) {
          val = '#' + aData.toString(16).padStart(8, '0');
        } else {
          val = aData;
        }

        if (aName) {
          attrs[aName] = val;
        }
        aPos += 20;
      }

      let elem = { tag: tagName, attrs, children: [] };
      if (!root) root = elem;
      if (current) {
        current.children.push(elem);
        stack.push(current);
      }
      current = elem;
    } else if (type === 0x0103) {
      if (stack.length > 0) {
        current = stack.pop();
      } else {
        current = null;
      }
    }

    pos += size;
  }

  return root;
}

function isColorTransparent(colorVal) {
  if (!colorVal || colorVal === '0x0') return true;
  if (typeof colorVal === 'string' && colorVal.startsWith('#')) {
    if (colorVal.length === 9 && colorVal.startsWith('#00')) return true;
    if (colorVal === '#00000000') return true;
  }
  return false;
}

function processApk(apkPath, category) {
  const buf = fs.readFileSync(apkPath);
  const entries = readZipEntries(buf);
  const drawables = entries.filter(e => e.name.startsWith('res/drawable') && e.name.endsWith('.xml'));

  let chosenEntry = null;
  if (category === 'wifi') {
    chosenEntry = drawables.find(d => d.name.includes('wifi_signal_4')) ||
                  drawables.find(d => d.name.includes('signal_4')) ||
                  drawables[0];
  } else if (category === 'signal') {
    chosenEntry = drawables.find(d => d.name.includes('signal_5') && !d.name.includes('wifi')) ||
                  drawables.find(d => d.name.includes('signal_4') && !d.name.includes('wifi')) ||
                  drawables.find(d => d.name.includes('signal_3')) ||
                  drawables[0];
  } else if (category === 'icons') {
    chosenEntry = drawables.find(d => d.name.includes('sec_stat_sys_alarm')) ||
                  drawables.find(d => d.name.includes('stat_sys_alarm')) ||
                  drawables.find(d => d.name.includes('alarm')) ||
                  drawables.find(d => d.name.includes('location')) ||
                  drawables[0];
  } else {
    // OneUI 7+ items (Wi-Fi, Signal, Satellite, Insanity Data)
    chosenEntry = drawables.find(d => d.name.includes('wifi_signal_4')) ||
                  drawables.find(d => d.name.includes('wifi_signal_3')) ||
                  drawables.find(d => d.name.includes('signal_5')) ||
                  drawables.find(d => d.name.includes('signal_4')) ||
                  drawables.find(d => d.name.includes('connected_4g')) ||
                  drawables.find(d => d.name.includes('Icon')) ||
                  drawables[0];
  }

  if (!chosenEntry) return null;

  const root = parseVectorXml(chosenEntry.data);
  if (!root) return null;

  let viewportWidth = typeof root.attrs.viewportWidth === 'number' ? root.attrs.viewportWidth : parseFloat(root.attrs.viewportWidth || '24');
  let viewportHeight = typeof root.attrs.viewportHeight === 'number' ? root.attrs.viewportHeight : parseFloat(root.attrs.viewportHeight || '24');

  if (isNaN(viewportWidth) || viewportWidth <= 0) viewportWidth = 24;
  if (isNaN(viewportHeight) || viewportHeight <= 0) viewportHeight = 24;

  const paths = [];

  function walk(node) {
    if (!node) return;
    if (node.tag === 'path') {
      let d = node.attrs.pathData;
      if (d && typeof d === 'string' && /^[Mm]\s*[\d\.\-]/.test(d.trim())) {
        let fillColor = node.attrs.fillColor;
        let strokeColor = node.attrs.strokeColor;
        let strokeWidth = typeof node.attrs.strokeWidth === 'number' ? node.attrs.strokeWidth : parseFloat(node.attrs.strokeWidth || '0');
        let fillAlpha = typeof node.attrs.fillAlpha === 'number' ? node.attrs.fillAlpha : (node.attrs.fillAlpha !== undefined ? parseFloat(node.attrs.fillAlpha) : 1);
        let strokeAlpha = typeof node.attrs.strokeAlpha === 'number' ? node.attrs.strokeAlpha : (node.attrs.strokeAlpha !== undefined ? parseFloat(node.attrs.strokeAlpha) : 1);
        let strokeLineCap = node.attrs.strokeLineCap;
        let strokeLineJoin = node.attrs.strokeLineJoin;

        let cap = 'round';
        if (strokeLineCap === 0 || strokeLineCap === '0' || strokeLineCap === 'butt') cap = 'butt';
        else if (strokeLineCap === 2 || strokeLineCap === '2' || strokeLineCap === 'square') cap = 'square';

        let join = 'round';
        if (strokeLineJoin === 0 || strokeLineJoin === '0' || strokeLineJoin === 'miter') join = 'miter';
        else if (strokeLineJoin === 2 || strokeLineJoin === '2' || strokeLineJoin === 'bevel') join = 'bevel';

        let isTransparentFill = isColorTransparent(fillColor) || fillAlpha === 0;
        let hasStroke = (!isColorTransparent(strokeColor) && strokeColor !== undefined) || strokeWidth > 0;

        let svgFill = isTransparentFill ? 'none' : 'currentColor';
        let svgStroke = hasStroke ? 'currentColor' : 'none';

        let normalizedStroke = strokeWidth > 0 ? Math.min(strokeWidth, 2.2) : (hasStroke ? 1.5 : undefined);

        if (svgFill === 'none' && svgStroke === 'none') {
          svgFill = 'currentColor';
        }

        paths.push({
          d,
          fill: svgFill,
          stroke: svgStroke,
          strokeWidth: normalizedStroke,
          strokeLineCap: svgStroke !== 'none' ? cap : undefined,
          strokeLineJoin: svgStroke !== 'none' ? join : undefined,
          fillOpacity: !isTransparentFill && fillAlpha < 1 ? fillAlpha : undefined,
          strokeOpacity: hasStroke && strokeAlpha < 1 ? strokeAlpha : undefined,
        });
      }
    }
    if (node.children) {
      node.children.forEach(walk);
    }
  }

  walk(root);

  return {
    drawableName: chosenEntry.name,
    viewBox: `0 0 ${viewportWidth} ${viewportHeight}`,
    paths,
  };
}

const result = {};

const categories = [
  { folder: 'Wifi-Icons', category: 'wifi' },
  { folder: 'Signal-Icons', category: 'signal' },
  { folder: 'Icon-Packs', category: 'icons' },
  { folder: 'OneUI-7', category: 'oneui7' },
];

for (const cat of categories) {
  const dir = path.join('assets', cat.folder);
  if (!fs.existsSync(dir)) continue;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.apk'));
  for (const file of files) {
    const apkPath = path.join(dir, file);
    try {
      const res = processApk(apkPath, cat.category);
      if (res) {
        result[file] = res;
      }
    } catch (e) {
      console.error(`Error processing ${file}:`, e);
    }
  }
}

// Clean custom replacements for Windows & Huawei
result['huawei-signal.apk'] = {
  drawableName: 'res/drawable/stat_sys_signal_4.xml',
  viewBox: '0 0 24 24',
  paths: [
    { d: 'M3 18h2.5v3H3z', fill: 'currentColor' },
    { d: 'M7.5 14h2.5v7H7.5z', fill: 'currentColor' },
    { d: 'M12 10h2.5v11H12z', fill: 'currentColor' },
    { d: 'M16.5 6h2.5v15h-2.5z', fill: 'currentColor' },
    { d: 'M21 2h2.5v19H21z', fill: 'currentColor' },
  ]
};

result['windows-signal.apk'] = {
  drawableName: 'res/drawable/stat_sys_signal_4.xml',
  viewBox: '0 0 24 24',
  paths: [
    { d: 'M2 19h3v3H2z', fill: 'currentColor' },
    { d: 'M6.5 15h3v7h-3z', fill: 'currentColor' },
    { d: 'M11 11h3v11h-3z', fill: 'currentColor' },
    { d: 'M15.5 7h3v15h-3z', fill: 'currentColor' },
    { d: 'M20 3h3v19h-3z', fill: 'currentColor' },
  ]
};

console.log('Successfully processed', Object.keys(result).length, 'APKs.');
fs.writeFileSync('webui/src/data/extractedVectors.json', JSON.stringify(result, null, 2));
console.log('Saved to webui/src/data/extractedVectors.json');
