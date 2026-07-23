// zip-writer.js — gerador de ZIP mínimo (formato "store", sem compressão), sem dependências.
// Uso: buildZip([{ name: "arquivo.png", data: Uint8Array }, ...]) => Blob "application/zip"
(function () {
  "use strict";

  const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
    return table;
  })();

  function crc32(data) {
    let crc = 0xffffffff;
    for (let i = 0; i < data.length; i += 1) crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  function dosDateTime(date) {
    const time = ((date.getHours() & 0x1f) << 11) | ((date.getMinutes() & 0x3f) << 5) | ((Math.floor(date.getSeconds() / 2)) & 0x1f);
    const day = (((date.getFullYear() - 1980) & 0x7f) << 9) | (((date.getMonth() + 1) & 0xf) << 5) | (date.getDate() & 0x1f);
    return { time, day };
  }

  function buildZip(files) {
    const encoder = new TextEncoder();
    const now = new Date();
    const { time, day } = dosDateTime(now);
    const localParts = [];
    const centralParts = [];
    let offset = 0;

    files.forEach((file) => {
      const data = file.data instanceof Uint8Array ? file.data : new Uint8Array(file.data);
      const nameBytes = encoder.encode(String(file.name));
      const crc = crc32(data);

      const local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true); // local file header signature
      local.setUint16(4, 20, true);         // version needed to extract
      local.setUint16(6, 0x0800, true);     // flags: UTF-8 names
      local.setUint16(8, 0, true);          // method: store
      local.setUint16(10, time, true);
      local.setUint16(12, day, true);
      local.setUint32(14, crc, true);
      local.setUint32(18, data.length, true); // compressed size
      local.setUint32(22, data.length, true); // uncompressed size
      local.setUint16(26, nameBytes.length, true);
      local.setUint16(28, 0, true);           // extra field length
      localParts.push(new Uint8Array(local.buffer), nameBytes, data);

      const central = new DataView(new ArrayBuffer(46));
      central.setUint32(0, 0x02014b50, true); // central directory header signature
      central.setUint16(4, 20, true);         // version made by
      central.setUint16(6, 20, true);         // version needed
      central.setUint16(8, 0x0800, true);     // flags: UTF-8 names
      central.setUint16(10, 0, true);         // method: store
      central.setUint16(12, time, true);
      central.setUint16(14, day, true);
      central.setUint32(16, crc, true);
      central.setUint32(20, data.length, true);
      central.setUint32(24, data.length, true);
      central.setUint16(28, nameBytes.length, true);
      central.setUint16(30, 0, true); // extra field length
      central.setUint16(32, 0, true); // comment length
      central.setUint16(34, 0, true); // disk number start
      central.setUint16(36, 0, true); // internal attrs
      central.setUint32(38, 0, true); // external attrs
      central.setUint32(42, offset, true); // local header offset
      centralParts.push(new Uint8Array(central.buffer), nameBytes);

      offset += 30 + nameBytes.length + data.length;
    });

    const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); // end of central directory signature
    end.setUint16(4, 0, true);          // disk number
    end.setUint16(6, 0, true);          // disk with central directory
    end.setUint16(8, files.length, true);
    end.setUint16(10, files.length, true);
    end.setUint32(12, centralSize, true);
    end.setUint32(16, offset, true);    // central directory offset
    end.setUint16(20, 0, true);         // comment length

    return new Blob([...localParts, ...centralParts, new Uint8Array(end.buffer)], { type: "application/zip" });
  }

  window.buildZip = buildZip;
})();
