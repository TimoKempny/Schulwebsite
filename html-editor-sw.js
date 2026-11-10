/* ==========================================================
   html-editor-sw.js – Service Worker NUR für die Vorschau des
   HTML-Editors. Wird mit scope "./html-vorschau/" registriert.
   Er liefert Anfragen wie html-vorschau/<projekt>/seite.html
   direkt aus dem Projektspeicher im Browser (IndexedDB) aus –
   so funktionieren Links zwischen Seiten, CSS-Dateien und
   Bilder genau wie auf einem echten Webserver.
   Er sammelt und überträgt keine Daten. Normalerweise nicht ändern.
   ========================================================== */

importScripts("js/html-editor-db.js");

var SCOPE = new URL("./html-vorschau/", self.location).href;
var KONSOLE = "__ide__/konsole.js";

var MIME = {
  html: "text/html", htm: "text/html", css: "text/css", js: "text/javascript", mjs: "text/javascript",
  json: "application/json", txt: "text/plain", md: "text/plain", csv: "text/csv", xml: "application/xml",
  svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif",
  webp: "image/webp", avif: "image/avif", ico: "image/x-icon", bmp: "image/bmp",
  mp3: "audio/mpeg", ogg: "audio/ogg", wav: "audio/wav", mp4: "video/mp4", webm: "video/webm",
  woff: "font/woff", woff2: "font/woff2", ttf: "font/ttf", otf: "font/otf", pdf: "application/pdf"
};
function mimeOf(path) {
  var ext = (/\.([a-z0-9]+)$/i.exec(path) || [])[1];
  return MIME[(ext || "").toLowerCase()] || "application/octet-stream";
}

self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (e) { e.waitUntil(self.clients.claim()); });

self.addEventListener("fetch", function (e) {
  if (e.request.url.indexOf(SCOPE) !== 0) return;
  if (e.request.method !== "GET" && e.request.method !== "HEAD") {
    e.respondWith(seite(405, "Formular abgeschickt",
      "<p>Die Vorschau hat keinen Webserver, der Formulardaten (method=\"" + esc(e.request.method.toLowerCase()) +
      "\") verarbeiten kann. Mit <code>method=\"get\"</code> landen die Daten wenigstens sichtbar in der Adresse.</p>"));
    return;
  }
  e.respondWith(ausliefern(e.request));
});

function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

function antwort(body, type, status) {
  var h = { "Content-Type": type, "Cache-Control": "no-store" };
  return new Response(body, { status: status || 200, headers: h });
}

function seite(status, titel, inhalt) {
  var html = "<!doctype html><html lang=\"de\"><head><meta charset=\"utf-8\"><title>" + esc(titel) + "</title>" +
    "<style>body{font:16px/1.5 system-ui,sans-serif;max-width:640px;margin:40px auto;padding:0 16px;color:#142120;background:#f5f8f7}" +
    "h1{font-size:1.3rem}code{font-family:ui-monospace,monospace;background:#eaf1ef;padding:1px 5px;border-radius:4px}" +
    "@media(prefers-color-scheme:dark){body{background:#0d1413;color:#e4eeec}code{background:#1b2624}a{color:#2dd4bf}}</style></head>" +
    "<body><h1>" + esc(titel) + "</h1>" + inhalt + "</body></html>";
  return antwort(html, "text/html; charset=utf-8", status);
}

function ausliefern(req) {
  var url = new URL(req.url);
  var rest = url.href.slice(SCOPE.length).split(/[?#]/)[0];
  var teile = rest.split("/");
  var pid = decodeURIComponent(teile.shift() || "");
  var path;
  try { path = teile.map(decodeURIComponent).join("/"); } catch (e) { path = teile.join("/"); }

  if (path === KONSOLE) return Promise.resolve(antwort(KONSOLE_JS, "text/javascript; charset=utf-8"));
  if (!pid) return Promise.resolve(seite(404, "Kein Projekt", "<p>In der Adresse fehlt das Projekt.</p>"));

  var versuch = path === "" || /\/$/.test(path) ? path + "index.html" : path;
  return HEDB.getFile(pid, versuch).then(function (f) {
    if (f && f.kind !== "dir") return datei(f, pid, req);
    // "ordner" ohne Schrägstrich → "ordner/" (wie ein echter Webserver)
    return HEDB.getFile(pid, path + "/index.html").then(function (f2) {
      if (f2 && path !== "") return Response.redirect(url.href.split(/[?#]/)[0] + "/", 302);
      return fehlt(pid, versuch);
    });
  }).catch(function (err) {
    return seite(500, "Vorschau-Fehler", "<p>Der Projektspeicher konnte nicht gelesen werden: " + esc(err && err.message || err) + "</p>");
  });
}

function datei(f, pid, req) {
  var type = f.type || mimeOf(f.path);
  if (f.kind === "blob") return antwort(req.method === "HEAD" ? null : f.blob, type);
  var text = f.text || "";
  if (/^text\/html/.test(type)) text = einbauen(text, SCOPE + encodeURIComponent(pid) + "/" + KONSOLE);
  if (/^(text\/|application\/(json|xml)|image\/svg)/.test(type)) type += "; charset=utf-8";
  return antwort(req.method === "HEAD" ? null : text, type);
}

// Kleines Skript für die Konsole der Vorschau einbauen – ohne Zeilenumbruch,
// damit Zeilennummern in Fehlermeldungen stimmen.
function einbauen(html, src) {
  var tag = "<script src=\"" + src + "\"></script>";
  var m = /<head(\s[^>]*)?>/i.exec(html) || /<html(\s[^>]*)?>/i.exec(html) || /<!doctype[^>]*>/i.exec(html);
  if (m) { var i = m.index + m[0].length; return html.slice(0, i) + tag + html.slice(i); }
  return tag + html;
}

function fehlt(pid, path) {
  return HEDB.listFiles(pid).then(function (files) {
    var lower = path.toLowerCase(), aehnlich = null;
    files.forEach(function (f) { if (f.kind !== "dir" && f.path.toLowerCase() === lower) aehnlich = f.path; });
    var tipp = aehnlich
      ? "<p><strong>Tipp:</strong> Es gibt die Datei <code>" + esc(aehnlich) + "</code>. Achte auf Groß- und Kleinschreibung – " +
        "auf echten Webservern ist <code>Bild.JPG</code> nicht dasselbe wie <code>bild.jpg</code>.</p>"
      : "<p>Prüfe den Dateinamen und den Pfad im Link. Liegt die Datei in einem Ordner, gehört der Ordner mit in den Pfad, " +
        "z. B. <code>bilder/hund.jpg</code>. Aus einem Unterordner heraus geht es mit <code>../</code> eine Ebene nach oben.</p>";
    return seite(404, "Datei nicht gefunden (404)",
      "<p>Im Projekt gibt es keine Datei <code>" + esc(path) + "</code>.</p>" + tipp);
  });
}

// Wird in jede HTML-Seite der Vorschau geladen und leitet Konsolenausgaben
// und Fehler an das Vorschaufenster weiter.
var KONSOLE_JS = "(" + function () {
  if (window.__ideKonsole) return;
  window.__ideKonsole = true;
  var ziel = window.parent !== window ? window.parent : null;
  if (!ziel) return;
  function kurz(v, tiefe) {
    try {
      if (v === null) return "null";
      if (v === undefined) return "undefined";
      if (typeof v === "string") return tiefe ? JSON.stringify(v) : v;
      if (typeof v === "number" || typeof v === "boolean" || typeof v === "bigint") return String(v);
      if (typeof v === "function") return "ƒ " + (v.name || "anonym") + "()";
      if (typeof v === "symbol") return v.toString();
      if (v instanceof Error) return v.name + ": " + v.message;
      if (typeof Element !== "undefined" && v instanceof Element) {
        return "<" + v.tagName.toLowerCase() + (v.id ? "#" + v.id : "") +
          (typeof v.className === "string" && v.className.trim() ? "." + v.className.trim().split(/\s+/).join(".") : "") + ">";
      }
      if ((tiefe || 0) > 2) return Array.isArray(v) ? "[…]" : "{…}";
      if (Array.isArray(v)) return "[" + v.slice(0, 50).map(function (x) { return kurz(x, (tiefe || 0) + 1); }).join(", ") + (v.length > 50 ? ", …" : "") + "]";
      var keys = Object.keys(v);
      return "{" + keys.slice(0, 30).map(function (k) { return k + ": " + kurz(v[k], (tiefe || 0) + 1); }).join(", ") + (keys.length > 30 ? ", …" : "") + "}";
    } catch (e) { return String(v); }
  }
  function senden(level, args, ort) {
    try {
      ziel.postMessage({ __ideKonsole: true, level: level, text: [].map.call(args, function (a) { return kurz(a, 0); }).join(" "),
        datei: ort && ort.datei || "", zeile: ort && ort.zeile || 0 }, location.origin);
    } catch (e) {}
  }
  ["log", "info", "warn", "error", "debug"].forEach(function (lvl) {
    var orig = console[lvl];
    console[lvl] = function () { senden(lvl, arguments); return orig.apply(console, arguments); };
  });
  var origClear = console.clear;
  console.clear = function () { senden("clear", []); return origClear.apply(console, arguments); };
  window.addEventListener("error", function (e) {
    if (e.message) senden("fehler", [e.message], { datei: e.filename, zeile: e.lineno });
    else if (e.target && e.target !== window && (e.target.src || e.target.href)) senden("warn", ["Konnte nicht geladen werden: " + (e.target.src || e.target.href)]);
  }, true);
  window.addEventListener("unhandledrejection", function (e) { senden("fehler", ["Unbehandelter Promise-Fehler: " + kurz(e.reason, 0)]); });
} + ")();";
