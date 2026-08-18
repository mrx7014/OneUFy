const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Lightweight zero-dependency Zip builder
function createZip(outputPath, filesToAdd) {
  const localHeaders = [];
  const centralHeaders = [];
  let offset = 0;

  const outFd = fs.openSync(outputPath, 'w');

  for (const item of filesToAdd) {
    const relPath = item.relPath.replace(/\\/g, '/');
    const isDir = item.isDir;
    const filePath = item.fullPath;

    let fileData = Buffer.alloc(0);
    let crc = 0;
    let uncompSize = 0;
    let compSize = 0;

    if (!isDir && filePath) {
      fileData = fs.readFileSync(filePath);
      uncompSize = fileData.length;
      crc = crc32(fileData);
    }

    const utf8Name = Buffer.from(relPath, 'utf8');

    // Local file header (30 bytes)
    const localHeader = Buffer.alloc(30 + utf8Name.length);
    localHeader.writeUInt32LE(0x04034b50, 0); // Signature
    localHeader.writeUInt16LE(20, 4);         // Version needed (2.0)
    localHeader.writeUInt16LE(0x0800, 6);     // Flags (UTF-8)
    localHeader.writeUInt16LE(0, 8);          // Compression method (0 = stored)
    localHeader.writeUInt16LE(0, 10);         // Mod time
    localHeader.writeUInt16LE(0, 12);         // Mod date
    localHeader.writeUInt32LE(crc, 14);       // CRC32
    localHeader.writeUInt32LE(uncompSize, 18);// Compressed size
    localHeader.writeUInt32LE(uncompSize, 22);// Uncompressed size
    localHeader.writeUInt16LE(utf8Name.length, 26); // Name length
    localHeader.writeUInt16LE(0, 28);         // Extra field length
    utf8Name.copy(localHeader, 30);

    const currentOffset = offset;
    fs.writeSync(outFd, localHeader);
    offset += localHeader.length;

    if (!isDir && fileData.length > 0) {
      fs.writeSync(outFd, fileData);
      offset += fileData.length;
    }

    // Central directory header (46 bytes)
    const centralHeader = Buffer.alloc(46 + utf8Name.length);
    centralHeader.writeUInt32LE(0x02014b50, 0); // Signature
    centralHeader.writeUInt16LE(20, 4);          // Version made by
    centralHeader.writeUInt16LE(20, 6);          // Version needed
    centralHeader.writeUInt16LE(0x0800, 8);      // Flags (UTF-8)
    centralHeader.writeUInt16LE(0, 10);          // Compression (stored)
    centralHeader.writeUInt16LE(0, 12);          // Mod time
    centralHeader.writeUInt16LE(0, 14);          // Mod date
    centralHeader.writeUInt32LE(crc, 16);        // CRC32
    centralHeader.writeUInt32LE(uncompSize, 20); // Compressed size
    centralHeader.writeUInt32LE(uncompSize, 24); // Uncompressed size
    centralHeader.writeUInt16LE(utf8Name.length, 28); // Name length
    centralHeader.writeUInt16LE(0, 30);          // Extra length
    centralHeader.writeUInt16LE(0, 32);          // Comment length
    centralHeader.writeUInt16LE(0, 34);          // Disk start
    centralHeader.writeUInt16LE(0, 36);          // Internal attr
    // External attr: 0755 for dirs and sh scripts, 0644 for files
    const isExec = relPath.endsWith('.sh') || isDir;
    const unixAttr = isDir ? 0o040755 : (isExec ? 0o100755 : 0o100644);
    centralHeader.writeUInt32LE((unixAttr << 16) >>> 0, 38);
    centralHeader.writeUInt32LE(currentOffset, 42); // Offset of local header
    utf8Name.copy(centralHeader, 46);

    centralHeaders.push(centralHeader);
  }

  const centralDirOffset = offset;
  let centralDirSize = 0;
  for (const ch of centralHeaders) {
    fs.writeSync(outFd, ch);
    centralDirSize += ch.length;
    offset += ch.length;
  }

  // End of central directory record (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4); // Disk number
  eocd.writeUInt16LE(0, 6); // Disk with central dir
  eocd.writeUInt16LE(centralHeaders.length, 8);  // Entries on disk
  eocd.writeUInt16LE(centralHeaders.length, 10); // Total entries
  eocd.writeUInt32LE(centralDirSize, 12);        // Central dir size
  eocd.writeUInt32LE(centralDirOffset, 16);      // Central dir offset
  eocd.writeUInt16LE(0, 20);                    // Comment length

  fs.writeSync(outFd, eocd);
  fs.closeSync(outFd);
}

// CRC32 table & calculator
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[i] = c;
}

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

const IGNORE_PATTERNS = [
  'node_modules',
  '.git',
  '.DS_Store',
  'Thumbs.db',
  'OneUFy.png',
  'logo.png'
];

function shouldIgnore(relPath) {
  const norm = relPath.replace(/\\/g, '/');
  // Ignore logo/images in assets/ root
  if (/^assets\/[^\/]+\.(png|jpg|jpeg|svg|webp)$/i.test(norm)) return true;
  if (norm.endsWith('.zip') || norm.endsWith('.sha256')) return true;
  for (const pat of IGNORE_PATTERNS) {
    if (norm === pat || norm.endsWith('/' + pat)) return true;
  }
  return false;
}

function collectFiles(baseDir, currentRel = '', list = []) {
  const full = path.join(baseDir, currentRel);
  if (!fs.existsSync(full)) return list;
  if (currentRel && shouldIgnore(currentRel)) return list;

  const stat = fs.statSync(full);

  if (stat.isDirectory()) {
    if (currentRel) {
      list.push({ relPath: currentRel + '/', isDir: true, fullPath: null });
    }
    const children = fs.readdirSync(full);
    for (const child of children) {
      collectFiles(baseDir, currentRel ? `${currentRel}/${child}` : child, list);
    }
  } else {
    list.push({ relPath: currentRel, isDir: false, fullPath: full });
  }
  return list;
}

// Read version from module.prop
const moduleProp = fs.readFileSync('module.prop', 'utf8');
const verMatch = moduleProp.match(/^version=(.+)$/m);
const modVer = verMatch ? verMatch[1].trim() : 'v1.0.0';
const zipName = `OneUFy-${modVer}.zip`;

console.log(`Building flashable zip: ${zipName}...`);

const itemsToZip = [];

// Explicitly include required module files and folders
const entriesToInclude = [
  'META-INF',
  'assets',
  'customize.sh',
  'module.prop',
  'system',
  'webroot'
];

for (const entry of entriesToInclude) {
  if (fs.existsSync(entry)) {
    const stat = fs.statSync(entry);
    if (stat.isDirectory()) {
      collectFiles('.', entry, itemsToZip);
    } else {
      itemsToZip.push({ relPath: entry, isDir: false, fullPath: path.resolve(entry) });
    }
  }
}

// Sort items cleanly
itemsToZip.sort((a, b) => a.relPath.localeCompare(b.relPath));

createZip(zipName, itemsToZip);

const zipStat = fs.statSync(zipName);
console.log(`Successfully created ${zipName} (${(zipStat.size / 1024 / 1024).toFixed(2)} MB, ${itemsToZip.length} files/dirs).`);

// Compute SHA256
const crypto = require('crypto');
const zipBuffer = fs.readFileSync(zipName);
const sha256 = crypto.createHash('sha256').update(zipBuffer).digest('hex');
fs.writeFileSync(`${zipName}.sha256`, `${sha256}  ${zipName}\n`);
console.log(`SHA-256: ${sha256}`);
