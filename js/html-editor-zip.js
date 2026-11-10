/* ==========================================================
   html-editor-zip.js – ZIP-Dateien lesen und schreiben, ganz
   ohne Bibliothek (nutzt CompressionStream des Browsers).
   HEZip.write([{ path, data: Uint8Array, mtime }]) → Promise<Blob>
   HEZip.read(blob) → Promise<[{ path, dir, data: Uint8Array }]>
   Normalerweise nicht ändern.
   ========================================================== */

var HEZip = (function () {
  "use strict";

  var CRC = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(d) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < d.length; i++) c = CRC[(c ^ d[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function streamBytes(data, stream) {
    return new Response(new Blob([data]).stream().pipeThrough(stream)).arrayBuffer().then(function (b) { return new Uint8Array(b); });
  }
  function deflate(data) {
    if (typeof CompressionStream === "undefined") return Promise.resolve(null);
    try { return streamBytes(data, new CompressionStream("deflate-raw")).catch(function () { return null; }); } catch (e) { return Promise.resolve(null); }
  }
  function inflate(data) {
    if (typeof DecompressionStream === "undefined") return Promise.reject(new Error("Dieser Browser kann keine gepackten ZIP-Dateien entpacken."));
    return streamBytes(data, new DecompressionStream("deflate-raw"));
  }

  function dosTime(ms) {
    var d = new Date(ms || Date.now());
    return {
      time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
      date: ((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()
    };
  }

  var NO_PACK = /\.(png|jpe?g|gif|webp|avif|mp3|mp4|webm|ogg|zip|woff2?|pdf)$/i;

  function write(entries) {
    var enc = new TextEncoder();
    return Promise.all(entries.map(function (e) {
      var data = e.data || new Uint8Array(0);
      var packed = e.dir || NO_PACK.test(e.path) || data.length < 64 ? Promise.resolve(null) : deflate(data);
      return packed.then(function (p) {
        var use = p && p.length < data.length;
        return { name: enc.encode(e.path + (e.dir && !/\/$/.test(e.path) ? "/" : "")), raw: data, body: use ? p : data,
          method: use ? 8 : 0, crc: crc32(data), t: dosTime(e.mtime), dir: !!e.dir };
      });
    })).then(function (list) {
      var parts = [], central = [], offset = 0;
      list.forEach(function (f) {
        var h = new DataView(new ArrayBuffer(30));
        h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true);
        h.setUint16(8, f.method, true); h.setUint16(10, f.t.time, true); h.setUint16(12, f.t.date, true);
        h.setUint32(14, f.crc, true); h.setUint32(18, f.body.length, true); h.setUint32(22, f.raw.length, true);
        h.setUint16(26, f.name.length, true); h.setUint16(28, 0, true);
        parts.push(h.buffer, f.name, f.body);
        var c = new DataView(new ArrayBuffer(46));
        c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
        c.setUint16(10, f.method, true); c.setUint16(12, f.t.time, true); c.setUint16(14, f.t.date, true);
        c.setUint32(16, f.crc, true); c.setUint32(20, f.body.length, true); c.setUint32(24, f.raw.length, true);
        c.setUint16(28, f.name.length, true); c.setUint32(38, f.dir ? 0x10 : 0, true); c.setUint32(42, offset, true);
        central.push(c.buffer, f.name);
        offset += 30 + f.name.length + f.body.length;
      });
      var size = central.reduce(function (s, b) { return s + b.byteLength; }, 0);
      var end = new DataView(new ArrayBuffer(22));
      end.setUint32(0, 0x06054b50, true); end.setUint16(8, list.length, true); end.setUint16(10, list.length, true);
      end.setUint32(12, size, true); end.setUint32(16, offset, true);
      return new Blob(parts.concat(central, [end.buffer]), { type: "application/zip" });
    });
  }

  function read(blob) {
    return blob.arrayBuffer().then(function (buf) {
      var v = new DataView(buf), u8 = new Uint8Array(buf), eocd = -1;
      for (var i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) {
        if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
      }
      if (eocd < 0) throw new Error("Das ist keine gültige ZIP-Datei.");
      var count = v.getUint16(eocd + 10, true), p = v.getUint32(eocd + 16, true);
      if (p === 0xFFFFFFFF || count === 0xFFFF) throw new Error("Diese ZIP-Datei ist zu groß (ZIP64 wird nicht unterstützt).");
      var utf8 = new TextDecoder("utf-8"), cp437 = (function () { try { return new TextDecoder("ibm866"); } catch (e) { return utf8; } })();
      var jobs = [];
      for (var n = 0; n < count; n++) {
        if (v.getUint32(p, true) !== 0x02014b50) throw new Error("Die ZIP-Datei ist beschädigt.");
        var flags = v.getUint16(p + 8, true), method = v.getUint16(p + 10, true);
        var csize = v.getUint32(p + 20, true), nlen = v.getUint16(p + 28, true);
        var xlen = v.getUint16(p + 30, true), clen = v.getUint16(p + 32, true), lho = v.getUint32(p + 42, true);
        var nameBytes = u8.subarray(p + 46, p + 46 + nlen);
        var name = (flags & 0x0800 ? utf8 : (looksUtf8(nameBytes) ? utf8 : cp437)).decode(nameBytes);
        p += 46 + nlen + xlen + clen;
        if (flags & 1) throw new Error("Verschlüsselte ZIP-Dateien werden nicht unterstützt.");
        var start = lho + 30 + v.getUint16(lho + 26, true) + v.getUint16(lho + 28, true);
        var data = u8.subarray(start, start + csize);
        var dir = /\/$/.test(name);
        jobs.push((function (name, dir, method, data) {
          if (dir) return Promise.resolve({ path: name, dir: true, data: null });
          if (method === 0) return Promise.resolve({ path: name, dir: false, data: data.slice() });
          if (method === 8) return inflate(data).then(function (d) { return { path: name, dir: false, data: d }; });
          return Promise.reject(new Error("„" + name + "“ ist mit einem unbekannten Verfahren gepackt."));
        })(name.replace(/\\/g, "/"), dir, method, data));
      }
      return Promise.all(jobs);
    });
  }
  function looksUtf8(b) { try { new TextDecoder("utf-8", { fatal: true }).decode(b); return true; } catch (e) { return false; } }

  return { write: write, read: read };
})();
