const fs = require('fs');
const { readZipEntries } = require('./parseVectors.cjs');

function parseStrings(buf, poolOffset) {
  let stringCount = buf.readUInt32LE(poolOffset + 8);
  let flags = buf.readUInt32LE(poolOffset + 16);
  let isUtf8 = (flags & (1 << 8)) !== 0;
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

const ANDROID_ATTRS = {
  0x01010155: 'viewportWidth',
  0x01010156: 'viewportHeight',
  0x01010136: 'width',
  0x01010137: 'height',
  0x010104dc: 'pathData',
  0x010104dd: 'fillColor',
  0x010104de: 'strokeColor',
  0x010104df: 'strokeWidth',
  0x010104e0: 'strokeAlpha',
  0x010104e1: 'fillAlpha',
  0x010104e2: 'fillType',
  0x0101053b: 'strokeLineCap',
  0x0101053c: 'strokeLineJoin'
};

const entries = readZipEntries(fs.readFileSync('assets/Wifi-Icons/linesup-wifi.apk'));
const d = entries.find(e => e.name === 'res/drawable/stat_sys_wifi_signal_4.xml');
const buf = d.data;
const strings = parseStrings(buf, 8);

let pos = 8 + buf.readUInt32LE(12); // skip string pool
let resMap = [];
if (buf.readUInt16LE(pos) === 0x0180) {
  let count = (buf.readUInt32LE(pos + 4) - 8) / 4;
  for (let i = 0; i < count; i++) resMap.push(buf.readUInt32LE(pos + 8 + i * 4));
  pos += buf.readUInt32LE(pos + 4);
}

while (pos < buf.length) {
  let type = buf.readUInt16LE(pos);
  let size = buf.readUInt32LE(pos + 4);
  if (type === 0x0102) {
    let name = strings[buf.readUInt32LE(pos + 20)];
    let attrStart = buf.readUInt16LE(pos + 24);
    let attrSize = buf.readUInt16LE(pos + 26);
    let attrCount = buf.readUInt16LE(pos + 28);
    console.log('=== Node:', name, '===');
    let aPos = pos + 8 + attrStart;
    for (let i = 0; i < attrCount; i++) {
      let nameIdx = buf.readUInt32LE(aPos + 4);
      let resId = resMap[nameIdx];
      let aName = ANDROID_ATTRS[resId] || strings[nameIdx] || ('res_0x' + (resId ? resId.toString(16) : 'none'));
      let aRaw = buf.readInt32LE(aPos + 8);
      let aType = buf[aPos + 15];
      let aData = buf.readUInt32LE(aPos + 16);
      let val = aRaw !== -1 ? strings[aRaw] : (aType === 3 ? strings[aData] : (aType === 28 || aType === 29 ? '#' + aData.toString(16).padStart(8, '0') : (aType === 4 ? buf.readFloatLE(aPos + 16) : aData)));
      console.log('   ', aName, '->', typeof val === 'string' && val.length > 50 ? val.substring(0, 50) + '...' : val);
      aPos += attrSize;
    }
  }
  pos += size;
}
