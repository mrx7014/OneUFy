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

function parseAxml(buf) {
  if (!buf || buf.length < 12) return null;
  let pos = 0;
  let headerSize = buf.readUInt16LE(pos + 2);
  pos += headerSize;

  let stringPool = [];
  let elements = [];
  let currentElement = null;
  let stack = [];

  while (pos < buf.length) {
    let chunkType = buf.readUInt16LE(pos);
    let chunkSize = buf.readUInt32LE(pos + 4);
    if (chunkSize <= 0) break;

    if (chunkType === 0x0001) {
      // String pool
      let stringCount = buf.readUInt32LE(pos + 8);
      let flags = buf.readUInt32LE(pos + 16);
      let stringsStart = pos + buf.readUInt32LE(pos + 20);
      let isUtf8 = (flags & (1 << 8)) !== 0;
      let offsets = [];
      for (let i = 0; i < stringCount; i++) {
        offsets.push(buf.readUInt32LE(pos + 28 + i * 4));
      }
      for (let i = 0; i < stringCount; i++) {
        let strOffset = stringsStart + offsets[i];
        if (isUtf8) {
          let p = strOffset;
          let len1 = buf[p++];
          if (len1 & 0x80) p++;
          let len2 = buf[p++];
          if (len2 & 0x80) len2 = ((len2 & 0x7f) << 8) | buf[p++];
          stringPool.push(buf.toString('utf8', p, p + len2));
        } else {
          let p = strOffset;
          let charLen = buf.readUInt16LE(p);
          p += 2;
          if (charLen & 0x8000) {
            charLen = ((charLen & 0x7fff) << 16) | buf.readUInt16LE(p);
            p += 2;
          }
          stringPool.push(buf.toString('utf16le', p, p + charLen * 2));
        }
      }
    } else if (chunkType === 0x0102) {
      // START_ELEMENT
      let nameIdx = buf.readUInt32LE(pos + 20);
      let attrCount = buf.readUInt16LE(pos + 28);
      let tagName = stringPool[nameIdx] || 'tag';

      let attrs = {};
      let attrOffset = pos + buf.readUInt16LE(pos + 24);
      for (let i = 0; i < attrCount; i++) {
        let attrNameIdx = buf.readUInt32LE(attrOffset + 4);
        let rawValIdx = buf.readInt32LE(attrOffset + 8);
        let dataType = buf[attrOffset + 14];
        let dataVal = buf.readUInt32LE(attrOffset + 16);

        let attrName = stringPool[attrNameIdx] || `attr_${attrNameIdx}`;
        let attrVal = rawValIdx !== -1 && stringPool[rawValIdx] !== undefined ? stringPool[rawValIdx] : null;

        if (attrVal === null) {
          if (dataType === 3) {
            attrVal = stringPool[dataVal] || '';
          } else if (dataType === 4) {
            attrVal = buf.readFloatLE(attrOffset + 16).toString();
          } else if (dataType === 16) {
            attrVal = buf.readInt32LE(attrOffset + 16).toString();
          } else if (dataType === 17) {
            attrVal = '0x' + dataVal.toString(16);
          } else if (dataType === 18) {
            attrVal = dataVal !== 0 ? 'true' : 'false';
          } else if (dataType === 28 || dataType === 29) {
            attrVal = '#' + dataVal.toString(16).padStart(8, '0');
          } else {
            attrVal = dataVal.toString();
          }
        }

        attrs[attrName] = attrVal;
        attrOffset += 20;
      }

      let elem = { tag: tagName, attrs, children: [] };
      if (currentElement) {
        currentElement.children.push(elem);
        stack.push(currentElement);
      } else {
        elements.push(elem);
      }
      currentElement = elem;
    } else if (chunkType === 0x0103) {
      if (stack.length > 0) {
        currentElement = stack.pop();
      } else {
        currentElement = null;
      }
    }

    pos += chunkSize;
  }

  return elements[0];
}

module.exports = { readZipEntries, parseAxml };
