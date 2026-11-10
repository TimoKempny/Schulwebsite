/* ==========================================================
   html-editor-db.js – Projektspeicher des HTML-Editors.
   Wird vom Editor (html-editor.html), der Vorschau und dem
   Service Worker (html-editor-sw.js) gemeinsam benutzt.
   Alles liegt in der IndexedDB des Browsers ("html-editor").

   Datensätze:
     projects: { id, name, created, modified }
     files:    { pid, path, kind: "text" | "blob" | "dir", text, blob, type, mtime }
               Ordner haben kind "dir" und einen Pfad mit "/" am Ende.
   Normalerweise nicht ändern.
   ========================================================== */

var HEDB = (function () {
  "use strict";
  var NAME = "html-editor", VERSION = 1, dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      var r;
      try { r = indexedDB.open(NAME, VERSION); } catch (e) { reject(e); return; }
      r.onupgradeneeded = function () {
        var db = r.result;
        if (!db.objectStoreNames.contains("projects")) db.createObjectStore("projects", { keyPath: "id" });
        if (!db.objectStoreNames.contains("files")) {
          var s = db.createObjectStore("files", { keyPath: ["pid", "path"] });
          s.createIndex("pid", "pid");
        }
      };
      r.onsuccess = function () {
        var db = r.result;
        db.onversionchange = function () { db.close(); dbPromise = null; };
        db.onclose = function () { dbPromise = null; };
        resolve(db);
      };
      r.onerror = function () { dbPromise = null; reject(r.error); };
    });
    return dbPromise;
  }

  // Führt fn(stores) in einer Transaktion aus; das Ergebnis kommt erst nach "complete".
  function run(names, mode, fn) {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var t = db.transaction(names, mode), result;
        var stores = {};
        [].concat(names).forEach(function (n) { stores[n] = t.objectStore(n); });
        fn(stores, function (v) { result = v; });
        t.oncomplete = function () { resolve(result); };
        t.onerror = function () { reject(t.error); };
        t.onabort = function () { reject(t.error || new Error("Transaktion abgebrochen")); };
      });
    });
  }

  function getAll(store, keyOrRange, set) {
    var r = store.getAll(keyOrRange);
    r.onsuccess = function () { set(r.result); };
  }

  return {
    open: open,
    listProjects: function () {
      return run("projects", "readonly", function (s, set) { getAll(s.projects, undefined, set); });
    },
    getProject: function (id) {
      return run("projects", "readonly", function (s, set) { var r = s.projects.get(id); r.onsuccess = function () { set(r.result); }; });
    },
    putProject: function (p) {
      return run("projects", "readwrite", function (s) { s.projects.put(p); });
    },
    deleteProject: function (id) {
      return run(["projects", "files"], "readwrite", function (s) {
        s.projects.delete(id);
        var c = s.files.index("pid").openKeyCursor(IDBKeyRange.only(id));
        c.onsuccess = function () { var cur = c.result; if (cur) { s.files.delete(cur.primaryKey); cur.continue(); } };
      });
    },
    listFiles: function (pid) {
      return run("files", "readonly", function (s, set) { getAll(s.files.index("pid"), IDBKeyRange.only(pid), set); });
    },
    getFile: function (pid, path) {
      return run("files", "readonly", function (s, set) { var r = s.files.get([pid, path]); r.onsuccess = function () { set(r.result); }; });
    },
    // Mehrere Änderungen auf einmal: puts = [Datensatz], dels = [Pfad]
    write: function (pid, puts, dels) {
      return run(["files", "projects"], "readwrite", function (s) {
        (dels || []).forEach(function (p) { s.files.delete([pid, p]); });
        (puts || []).forEach(function (f) { f.pid = pid; s.files.put(f); });
        var r = s.projects.get(pid);
        r.onsuccess = function () { if (r.result) { r.result.modified = Date.now(); s.projects.put(r.result); } };
      });
    }
  };
})();
