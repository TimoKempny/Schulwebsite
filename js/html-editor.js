/* ==========================================================
   html-editor.js – Logik des HTML-Editors (html-editor.html).
   Projekte mit mehreren Dateien, Tabs, Live-Vorschau,
   lokale Prüfung und W3C-Prüfung. Normalerweise nicht ändern.
   ========================================================== */

(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var STORE = "html-editor";
  var TEXT_EXT = /\.(html?|css|js|mjs|json|txt|md|svg|xml|csv)$/i;
  var IMG_EXT = /\.(png|jpe?g|gif|webp|avif|svg|ico|bmp)$/i;
  var MIME = {
    html: "text/html", htm: "text/html", css: "text/css", js: "text/javascript", mjs: "text/javascript", json: "application/json",
    txt: "text/plain", md: "text/plain", csv: "text/csv", xml: "application/xml", svg: "image/svg+xml", png: "image/png",
    jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", avif: "image/avif", ico: "image/x-icon", bmp: "image/bmp",
    mp3: "audio/mpeg", ogg: "audio/ogg", wav: "audio/wav", mp4: "video/mp4", webm: "video/webm",
    woff: "font/woff", woff2: "font/woff2", ttf: "font/ttf", otf: "font/otf", pdf: "application/pdf"
  };
  var MAX_FILE = 15 * 1024 * 1024;

  var S = {
    inst: Math.random().toString(36).slice(2),
    pid: null, projects: [], files: new Map(), tabs: [], active: null, editors: new Map(),
    diags: new Map(), w3c: new Map(), selDir: "", collapsed: {}, lastHtml: null, viewerUrl: null
  };
  var edHost = $("edHost"), tree = $("tree"), ws = $("ws");
  var chan = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("html-editor") : null;

  /* ---------- Hilfen ---------- */
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  var toastT;
  function toast(msg, ms) { var t = $("toast"); t.textContent = msg; t.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove("on"); }, ms || 2600); }
  function load(key, def) { try { var v = localStorage.getItem(STORE + "." + key); return v === null ? def : v; } catch (e) { return def; } }
  function save(key, v) { try { localStorage.setItem(STORE + "." + key, v); } catch (e) {} }
  function ext(path) { return ((/\.([a-z0-9]+)$/i.exec(path || "") || [])[1] || "").toLowerCase(); }
  function mimeOf(path) { return MIME[ext(path)] || ""; }
  function baseName(p) { return p.replace(/\/$/, "").split("/").pop(); }
  function dirOf(p) { var i = p.replace(/\/$/, "").lastIndexOf("/"); return i < 0 ? "" : p.slice(0, i + 1); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function fmtSize(n) { return n < 1024 ? n + " B" : n < 1048576 ? (n / 1024).toFixed(1).replace(".", ",") + " KB" : (n / 1048576).toFixed(1).replace(".", ",") + " MB"; }
  function byName(a, b) { return a.localeCompare(b, "de", { numeric: true, sensitivity: "base" }); }
  function send(msg) { if (chan) { msg.from = S.inst; chan.postMessage(msg); } }
  function isFile(p) { var f = S.files.get(p); return !!f && f.kind !== "dir"; }
  function htmlFiles() { return Array.from(S.files.keys()).filter(function (p) { return isFile(p) && /\.html?$/i.test(p); }).sort(byName); }
  function cssFiles() { return Array.from(S.files.keys()).filter(function (p) { return isFile(p) && /\.css$/i.test(p); }).sort(byName); }

  // Pfad säubern; null = ungültig
  function cleanPath(p, isDir) {
    p = String(p || "").trim().replace(/\\/g, "/").replace(/^(\.\/|\/)+/, "").replace(/\/{2,}/g, "/");
    if (isDir) p = p.replace(/\/+$/, "");
    if (!p || /[<>:"|?*\u0000-\u001f]/.test(p)) return null;
    var segs = p.split("/");
    if (segs.some(function (s) { return !s.trim() || s === "." || s === ".."; })) return null;
    return isDir ? p + "/" : p;
  }
  function pathError(raw, isDir) {
    var p = String(raw || "").trim();
    if (!p) return "Bitte einen Namen eingeben.";
    if (/[<>:"|?*]/.test(p)) return "Diese Zeichen gehen nicht in Dateinamen: < > : \" | ? *";
    if (/(^|\/)\.\.(\/|$)/.test(p)) return "„..“ geht hier nicht.";
    if (!cleanPath(p, isDir)) return "Ungültiger Name.";
    return "";
  }

  /* ---------- Dialog ---------- */
  var dlg = $("dlg");
  function ask(o) {
    return new Promise(function (resolve) {
      $("dlgTitle").textContent = o.title || "";
      $("dlgText").innerHTML = o.html || esc(o.text || "");
      $("dlgText").hidden = !o.text && !o.html;
      var inp = $("dlgInput"), err = $("dlgErr"), ch = $("dlgChoices");
      inp.hidden = o.input === undefined; inp.value = o.input || ""; inp.placeholder = o.placeholder || "";
      err.textContent = ""; err.hidden = o.input === undefined;
      ch.innerHTML = "";
      (o.choices || []).forEach(function (c, i) {
        var l = document.createElement("label"); l.className = "choice";
        l.innerHTML = '<input type="radio" name="dlgc" value="' + esc(c.value) + '"' + ((o.choice ? o.choice === c.value : i === 0) ? " checked" : "") + '><div><b>' + esc(c.label) + "</b>" + (c.desc ? "<span>" + esc(c.desc) + "</span>" : "") + "</div>";
        ch.appendChild(l);
      });
      ch.hidden = !(o.choices && o.choices.length);
      $("dlgOk").textContent = o.ok || "OK";
      $("dlgOk").classList.toggle("danger", !!o.danger);
      $("dlgCancel").textContent = o.cancel || "Abbrechen";
      $("dlgCancel").hidden = o.cancel === false;
      var done = false;
      function finish(v) { if (done) return; done = true; cleanup(); if (dlg.open) dlg.close(); resolve(v); }
      function onSubmit(e) {
        e.preventDefault();
        var c = ch.querySelector("input:checked"), choice = c ? c.value : null;
        if (o.input !== undefined) {
          var msg = o.validate ? o.validate(inp.value, choice) : "";
          if (msg) { err.textContent = msg; inp.focus(); return; }
          finish({ value: inp.value, choice: choice });
        } else finish(o.choices ? choice : true);
      }
      function onCancel(e) { if (e) e.preventDefault(); finish(null); }
      function cleanup() {
        $("dlgForm").removeEventListener("submit", onSubmit);
        $("dlgCancel").removeEventListener("click", onCancel);
        dlg.removeEventListener("cancel", onCancel);
      }
      $("dlgForm").addEventListener("submit", onSubmit);
      $("dlgCancel").addEventListener("click", onCancel);
      dlg.addEventListener("cancel", onCancel);
      dlg.showModal();
      if (o.input !== undefined) {
        inp.focus();
        if (o.select) inp.setSelectionRange(o.select[0], o.select[1]); else inp.select();
      } else $("dlgOk").focus();
    });
  }

  /* ---------- Vorlagen ---------- */
  function skeleton(title, cssHref, body) {
    return "<!DOCTYPE html>\n<html lang=\"de\">\n<head>\n  <meta charset=\"utf-8\">\n" +
      "  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n  <title>" + title + "</title>\n" +
      (cssHref ? "  <link rel=\"stylesheet\" href=\"" + cssHref + "\">\n" : "") +
      "</head>\n<body>\n" + (body === undefined ? "  \n" : body) + "</body>\n</html>\n";
  }
  function textRec(path, text) { return { path: path, kind: "text", text: text, type: mimeOf(path), mtime: Date.now() }; }
  var STYLE_BASIS = "body {\n  font-family: Arial, sans-serif;\n  max-width: 800px;\n  margin: 0 auto;\n  padding: 20px;\n  line-height: 1.5;\n}\n\nh1 {\n  color: #0f766e;\n}\n";
  function template(kind) {
    if (kind === "leer") return [textRec("index.html", "")];
    if (kind === "mehr") {
      var nav = "  <nav>\n    <a href=\"index.html\">Start</a>\n    <a href=\"ueber-mich.html\">Über mich</a>\n    <a href=\"kontakt.html\">Kontakt</a>\n  </nav>\n";
      return [
        textRec("index.html", skeleton("Start", "css/style.css", "  <header>\n    <h1>Meine Webseite</h1>\n" + nav.replace(/^/gm, "  ").replace(/^  $/gm, "") + "  </header>\n\n  <main>\n    <h2>Willkommen</h2>\n    <p>Das ist die Startseite.</p>\n  </main>\n\n  <footer>\n    <p>&copy; 2026</p>\n  </footer>\n")),
        textRec("ueber-mich.html", skeleton("Über mich", "css/style.css", "  <header>\n    <h1>Über mich</h1>\n" + nav.replace(/^/gm, "  ").replace(/^  $/gm, "") + "  </header>\n\n  <main>\n    <p>Hier steht etwas über mich.</p>\n  </main>\n")),
        textRec("kontakt.html", skeleton("Kontakt", "css/style.css", "  <header>\n    <h1>Kontakt</h1>\n" + nav.replace(/^/gm, "  ").replace(/^  $/gm, "") + "  </header>\n\n  <main>\n    <p>So erreichst du mich.</p>\n  </main>\n")),
        textRec("css/style.css", STYLE_BASIS + "\nnav a {\n  margin-right: 12px;\n}\n"),
        { path: "bilder/", kind: "dir", mtime: Date.now() }
      ];
    }
    return [
      textRec("index.html", skeleton("Meine Webseite", "style.css", "  <h1>Hallo Welt!</h1>\n  <p>Hier entsteht meine Webseite.</p>\n")),
      textRec("style.css", STYLE_BASIS)
    ];
  }

  /* ==========================================================
     Editor (einer pro geöffneter Textdatei – so hat jede Datei
     ihr eigenes Rückgängig)
     ========================================================== */
  var charW = 0;
  function measureChar() {
    var s = document.createElement("span");
    s.style.cssText = "position:absolute;visibility:hidden;white-space:pre;font-family:var(--font-mono);font-size:" + getComputedStyle(edHost).getPropertyValue("--ed-fs");
    s.textContent = "0000000000";
    document.body.appendChild(s); charW = s.getBoundingClientRect().width / 10; s.remove();
  }
  function lineHeight() { return parseFloat(getComputedStyle(edHost).getPropertyValue("--ed-lh")) || 22; }
  function edPad() { return parseFloat(getComputedStyle(edHost).getPropertyValue("--ed-pad")) || 12; }

  function Editor(path) {
    var self = this;
    this.path = path; this.lang = HEPruef.langOf(path);
    var el = document.createElement("div");
    el.className = "ed-scroll"; el.hidden = true;
    el.innerHTML = '<div class="ed-inner"><div class="gutter" aria-hidden="true"></div><div class="code"><div class="marks" aria-hidden="true"></div>' +
      '<pre aria-hidden="true"></pre><textarea spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" wrap="off"></textarea></div></div>';
    this.el = el; this.gutter = el.querySelector(".gutter"); this.marksEl = el.querySelector(".marks");
    this.hl = el.querySelector("pre"); this.ta = el.querySelector("textarea");
    this.ta.setAttribute("aria-label", "Quelltext von " + path);
    this.lineCount = 0; this.marks = [];
    this.ta.value = (S.files.get(path) || {}).text || "";
    edHost.appendChild(el);
    this.render();
    this.ta.addEventListener("input", function () { self.onEdit(); });
    this.ta.addEventListener("keydown", function (e) { self.onKey(e); });
    this.ta.addEventListener("keyup", function (e) { if (/^(Arrow|Home|End|Page)/.test(e.key)) self.caret(); });
    this.ta.addEventListener("click", function () { self.caret(); });
    this.ta.addEventListener("focus", function () { self.caret(); });
  }
  Editor.prototype.setPath = function (p) {
    this.path = p; this.lang = HEPruef.langOf(p);
    this.ta.setAttribute("aria-label", "Quelltext von " + p);
    this.render();
  };
  Editor.prototype.setText = function (text) {
    if (this.ta.value === text) return;
    var s = this.ta.selectionStart;
    this.ta.value = text;
    this.ta.setSelectionRange(Math.min(s, text.length), Math.min(s, text.length));
    this.render();
  };
  Editor.prototype.render = function () {
    var code = this.ta.value;
    this.hl.innerHTML = HEPruef.highlight(this.lang, code) + "\n ";
    var n = code.split("\n").length;
    if (n !== this.lineCount) {
      var g = "";
      for (var i = 1; i <= n; i++) g += "<div>" + i + "</div>";
      this.gutter.innerHTML = g;
      this.lineCount = n;
      this.paintMarks();
    }
  };
  Editor.prototype.setMarks = function (list) { this.marks = list; this.paintMarks(); };
  Editor.prototype.paintMarks = function () {
    var lh = lineHeight(), p = edPad(), html = "", g = this.gutter, lc = this.lineCount;
    g.querySelectorAll(".e,.w").forEach(function (d) { d.className = ""; });
    this.marks.forEach(function (mk) {
      if (mk.line < 1 || mk.line > lc) return;
      html += '<div class="' + mk.cls + '" style="top:' + (p + (mk.line - 1) * lh) + 'px"></div>';
      var gd = g.children[mk.line - 1];
      if (gd && gd.className !== "e" && mk.cls !== "flash") gd.className = mk.cls;
    });
    this.marksEl.innerHTML = html;
  };
  Editor.prototype.onEdit = function () {
    this.render();
    var f = S.files.get(this.path);
    if (f) { f.text = this.ta.value; f.mtime = Date.now(); scheduleSave(this.path); scheduleLint(this.path); }
    this.caret();
  };
  Editor.prototype.caret = function () {
    if (S.active !== this.path) return;
    var pos = this.ta.selectionStart, before = this.ta.value.slice(0, pos);
    var line = before.split("\n").length, col = pos - before.lastIndexOf("\n");
    $("caretPos").textContent = "Z " + line + ", S " + col;
    this.ensureVisible(line, col);
  };
  Editor.prototype.ensureVisible = function (line, col) {
    var sc = this.el, lh = lineHeight(), p = edPad();
    var y = p + (line - 1) * lh, top = sc.scrollTop, h = sc.clientHeight;
    if (y < top) sc.scrollTop = y - 4;
    else if (y + lh > top + h) sc.scrollTop = y + lh - h + 4;
    if (!charW) measureChar();
    var gw = this.gutter.offsetWidth;
    var lineText = this.ta.value.split("\n")[line - 1] || "";
    var vis = lineText.slice(0, col - 1).replace(/\t/g, "  ").length;
    var x = gw + 14 + vis * charW, left = sc.scrollLeft, w = sc.clientWidth;
    if (x < left + gw + 10) sc.scrollLeft = Math.max(0, x - gw - 30);
    else if (x > left + w - 40) sc.scrollLeft = x - w + 80;
  };
  Editor.prototype.goTo = function (line, col) {
    var ta = this.ta, lines = ta.value.split("\n"), pos = 0;
    line = Math.max(1, Math.min(line || 1, lines.length));
    for (var i = 0; i < line - 1; i++) pos += lines[i].length + 1;
    pos += Math.max(0, Math.min((col || 1) - 1, lines[line - 1].length));
    ta.focus({ preventScroll: true });
    ta.setSelectionRange(pos, pos);
    this.caret();
    var self = this, keep = this.marks.slice();
    this.setMarks(keep.concat([{ line: line, cls: "flash" }]));
    setTimeout(function () { if (self.marks.some(function (m) { return m.cls === "flash"; })) self.setMarks(self.marks.filter(function (m) { return m.cls !== "flash"; })); }, 900);
  };
  // Einfügen über execCommand, damit Strg+Z funktioniert
  Editor.prototype.insert = function (text) {
    var ta = this.ta, ok = false;
    ta.focus();
    try { ok = document.execCommand("insertText", false, text); } catch (e) { ok = false; }
    if (!ok) { ta.setRangeText(text, ta.selectionStart, ta.selectionEnd, "end"); this.onEdit(); }
  };
  Editor.prototype.replace = function (start, end, text, selStart, selEnd) {
    this.ta.setSelectionRange(start, end);
    this.insert(text);
    if (selStart != null) this.ta.setSelectionRange(selStart, selEnd == null ? selStart : selEnd);
    this.caret();
  };

  var PAIRS = { "(": ")", "[": "]", "{": "}", "\"": "\"", "'": "'" };
  // In HTML-Dateien: Steht der Cursor in <style> oder <script>? Dann gelten die CSS- bzw. JS-Regeln.
  Editor.prototype.ctxLang = function (pos) {
    if (this.lang !== "html") return this.lang;
    var low = this.ta.value.slice(0, pos).toLowerCase();
    var so = low.lastIndexOf("<style"), sc = low.lastIndexOf("</style"), jo = low.lastIndexOf("<script"), jc = low.lastIndexOf("</script");
    if (so > sc && low.indexOf(">", so) >= 0) return "css";
    if (jo > jc && low.indexOf(">", jo) >= 0) return "js";
    return "html";
  };
  Editor.prototype.onKey = function (e) {
    var ta = this.ta, v = ta.value, s = ta.selectionStart, en = ta.selectionEnd, lang = this.ctxLang(s);
    var mod = e.ctrlKey || e.metaKey;
    if (e.isComposing) return;
    if (mod && !e.altKey && (e.key === "s" || e.key === "S")) { e.preventDefault(); saveNow(); return; }
    if (mod && e.key === "Enter") { e.preventDefault(); previewShortcut(); return; }
    if (mod && !e.altKey && (e.key === "/" || e.key === "#" || e.code === "NumpadDivide" || (e.code === "Digit7" && e.shiftKey))) { e.preventDefault(); this.toggleComment(); return; }
    if (e.key === "Tab" && !mod && !e.altKey) {
      e.preventDefault();
      if (!e.shiftKey && s === en && lang === "html" && this.emmet()) return;
      var ls = v.lastIndexOf("\n", s - 1) + 1;
      if (s === en && !e.shiftKey) { this.insert("  "); return; }
      var le = v.indexOf("\n", en - (en > s && v[en - 1] === "\n" ? 1 : 0)); if (le < 0) le = v.length;
      var block = v.slice(ls, le).split("\n").map(function (l) { return e.shiftKey ? l.replace(/^( {1,2}|\t)/, "") : "  " + l; }).join("\n");
      this.replace(ls, le, block, ls, ls + block.length);
      return;
    }
    if (e.key === "Enter" && !mod && !e.shiftKey && !e.altKey) { e.preventDefault(); this.newline(); return; }
    if (mod || e.altKey) return;
    if (lang === "html" && s === en) {
      if (e.key === ">" && this.autoClose()) { e.preventDefault(); return; }
      if (e.key === "/" && v[s - 1] === "<" && this.closeTag()) { e.preventDefault(); return; }
    }
    var next = v[en] || "";
    if ((e.key === "\"" || e.key === "'") && s === en && next === e.key && lang !== "text") { e.preventDefault(); ta.setSelectionRange(s + 1, s + 1); return; }
    if ((e.key === ")" || e.key === "]" || e.key === "}") && s === en && next === e.key && lang !== "html" && lang !== "text") { e.preventDefault(); ta.setSelectionRange(s + 1, s + 1); return; }
    if (PAIRS[e.key] !== undefined && lang !== "text") {
      var quote = e.key === "\"" || e.key === "'", allow;
      if (lang === "html") allow = quote && /<[a-zA-Z][^<>]*=\s*$/.test(v.slice(Math.max(0, s - 400), s));
      else allow = !(quote && /\w/.test(v[s - 1] || ""));
      if (allow && (s !== en || /^[\s)\]};,<>]?$/.test(next))) {
        e.preventDefault();
        var sel = v.slice(s, en);
        this.insert(e.key + sel + PAIRS[e.key]);
        ta.setSelectionRange(s + 1, s + 1 + sel.length);
        return;
      }
    }
    if (e.key === "}" && s === en && lang !== "html" && lang !== "text") {
      var ls3 = v.lastIndexOf("\n", s - 1) + 1, pre = v.slice(ls3, s);
      if (/^[ \t]+$/.test(pre) && pre.length >= 2) { e.preventDefault(); this.replace(ls3, s, pre.slice(0, pre.length - 2) + "}"); return; }
    }
    if (e.key === "Backspace" && s === en && s > 0) {
      var pair = v[s - 1] + (v[s] || "");
      if (/^(\{\}|\(\)|\[\]|""|'')$/.test(pair) && lang !== "text") { e.preventDefault(); this.replace(s - 1, s + 1, ""); }
    }
  };
  Editor.prototype.newline = function () {
    var v = this.ta.value, s = this.ta.selectionStart, en = this.ta.selectionEnd;
    var ls = v.lastIndexOf("\n", s - 1) + 1, line = v.slice(ls, s);
    var ind = (/^[ \t]*/.exec(line) || [""])[0];
    var le = v.indexOf("\n", en); if (le < 0) le = v.length;
    var after = v.slice(en, le);
    var expand = false;
    if (/[{(\[]\s*$/.test(line)) { if (/^\s*[}\])]/.test(after)) expand = true; else ind += "  "; }
    else if (this.lang === "html") {
      var m = /<([a-zA-Z][\w-]*)(?:\s[^<>]*)?>\s*$/.exec(line);
      if (m && !HEPruef.VOID[m[1].toLowerCase()] && !/\/>\s*$/.test(line) && !/^(html|head|body)$/i.test(m[1])) {
        if (new RegExp("^\\s*</" + m[1] + "\\s*>", "i").test(after)) expand = true; else ind += "  ";
      } else if (m && /^(html|head|body)$/i.test(m[1]) && new RegExp("^\\s*</" + m[1], "i").test(after)) expand = true;
    }
    if (expand) {
      var inner = "\n" + ind + "  ";
      this.insert(inner + "\n" + ind);
      var p = s + inner.length;
      this.ta.setSelectionRange(p, p); this.caret();
      return;
    }
    this.insert("\n" + ind);
  };
  Editor.prototype.autoClose = function () {
    var v = this.ta.value, s = this.ta.selectionStart;
    var before = v.slice(Math.max(0, s - 600), s), lt = before.lastIndexOf("<");
    if (lt < 0) return false;
    var seg = before.slice(lt), m = /^<([a-zA-Z][\w-]*)(\s[^<>]*)?$/.exec(seg);
    if (!m || /\/\s*$/.test(seg) || HEPruef.VOID[m[1].toLowerCase()]) return false;
    if (/["']/.test(seg.replace(/"[^"]*"|'[^']*'/g, ""))) return false;
    var head = v.slice(0, s), cm = head.lastIndexOf("<!--");
    if (cm >= 0 && head.indexOf("-->", cm) < 0) return false;
    var low = head.toLowerCase();
    if (low.lastIndexOf("<script") > low.lastIndexOf("</script") || low.lastIndexOf("<style") > low.lastIndexOf("</style")) {
      if (!/^<(script|style)\b/i.test(seg)) return false;
    }
    var closing = "</" + m[1] + ">";
    if (v.slice(s, s + closing.length).toLowerCase() === closing.toLowerCase()) return false;
    this.insert(">" + closing);
    this.ta.setSelectionRange(s + 1, s + 1); this.caret();
    return true;
  };
  Editor.prototype.closeTag = function () {
    var v = this.ta.value, s = this.ta.selectionStart;
    var st = HEPruef.openStack(v.slice(0, s - 1)), name = st[st.length - 1];
    if (!name) return false;
    var ls = v.lastIndexOf("\n", s - 2) + 1, pre = v.slice(ls, s - 1);
    this.insert("/" + name + ">");
    // Einrückung an das öffnende Tag anpassen, wenn das </ allein in der Zeile steht
    if (/^[ \t]+$/.test(pre)) {
      var re = new RegExp("<" + name + "[\\s>/]", "ig"), m, last = -1, head = v.slice(0, s - 1);
      while ((m = re.exec(head))) last = m.index;
      if (last >= 0) {
        var ols = head.lastIndexOf("\n", last - 1) + 1, oind = (/^[ \t]*/.exec(head.slice(ols)) || [""])[0];
        if (oind !== pre && oind.length < pre.length) {
          var end = s + name.length + 2;
          var lineNow = this.ta.value.slice(ls, end);
          this.replace(ls, end, oind + lineNow.trimStart(), ls + oind.length + lineNow.trimStart().length);
        }
      }
    }
    return true;
  };
  Editor.prototype.emmet = function () {
    var v = this.ta.value, s = this.ta.selectionStart;
    var ls = v.lastIndexOf("\n", s - 1) + 1, before = v.slice(ls, s);
    var m = /(^|[\s>])(![a-z]*|[a-zA-Z.#][\w.#:-]*)$/.exec(before);
    if (!m) return false;
    var abbr = m[2], start = s - abbr.length, rest = before.slice(0, before.length - abbr.length);
    if (/<[^>]*$/.test(rest)) return false;
    var head = v.slice(0, start).toLowerCase();
    if (head.lastIndexOf("<style") > head.lastIndexOf("</style") || head.lastIndexOf("<script") > head.lastIndexOf("</script")) return false;
    var ind = (/^[ \t]*/.exec(before) || [""])[0];
    var css = cssFiles()[0], cssRel = css ? HEPruef.relPath(this.path, css) : "style.css";
    var out = null, caret = 0;
    if (abbr === "!") {
      out = skeleton(titleFor(this.path), css ? cssRel : null).replace(/\n$/, "");
      caret = out.indexOf("<body>\n") + 9;
      if (ind) out = out.split("\n").map(function (l, i) { return i ? ind + l : l; }).join("\n"), caret = out.indexOf("<body>\n") + 7 + ind.length + 2;
      this.replace(start, s, out, start + caret);
      return true;
    }
    var sp = { "link": ['<link rel="stylesheet" href="' + cssRel + '">', -1], "link:css": ['<link rel="stylesheet" href="' + cssRel + '">', -1],
      "img": ['<img src="" alt="">', 10], "a": ['<a href=""></a>', 9], "script:src": ['<script src=""></script>', 13],
      "input": ['<input type="text">', -1], "meta": ['<meta charset="utf-8">', -1], "meta:vp": ['<meta name="viewport" content="width=device-width, initial-scale=1">', -1] };
    if (sp[abbr]) { out = sp[abbr][0]; caret = sp[abbr][1] < 0 ? out.length : sp[abbr][1]; }
    else {
      var pm = /^([a-zA-Z][\w-]*)?((?:[.#][\w-]+)*)$/.exec(abbr);
      if (!pm) return false;
      var tag = (pm[1] || "div").toLowerCase();
      if (!HEPruef.ELEMENTS[tag] || (!pm[1] && !pm[2])) return false;
      var cls = [], id = "";
      (pm[2].match(/[.#][\w-]+/g) || []).forEach(function (t) { if (t[0] === ".") cls.push(t.slice(1)); else id = t.slice(1); });
      var attrs = (id ? ' id="' + id + '"' : "") + (cls.length ? ' class="' + cls.join(" ") + '"' : "");
      if (HEPruef.VOID[tag]) { out = "<" + tag + attrs + ">"; caret = out.length; }
      else { out = "<" + tag + attrs + "></" + tag + ">"; caret = tag.length + attrs.length + 2; }
    }
    this.replace(start, s, out, start + caret);
    return true;
  };
  Editor.prototype.toggleComment = function () {
    var ta = this.ta, v = ta.value, s = ta.selectionStart, en = ta.selectionEnd;
    var ls = v.lastIndexOf("\n", s - 1) + 1, le = v.indexOf("\n", Math.max(en - 1, s)); if (le < 0) le = v.length;
    var lines = v.slice(ls, le).split("\n"), res, lang = this.ctxLang(ls);
    var filled = lines.filter(function (l) { return l.trim(); });
    if (lang === "js") {
      var allC = filled.every(function (l) { return /^\s*\/\//.test(l); });
      res = lines.map(function (l) { if (!l.trim()) return l; return allC ? l.replace(/^(\s*)\/\/ ?/, "$1") : l.replace(/^(\s*)/, "$1// "); }).join("\n");
    } else {
      var o = lang === "css" ? "/*" : "<!--", c = lang === "css" ? "*/" : "-->";
      var reO = lang === "css" ? /^(\s*)\/\* ?/ : /^(\s*)<!-- ?/, reC = lang === "css" ? / ?\*\/\s*$/ : / ?-->\s*$/;
      var all = filled.length && filled.every(function (l) { return reO.test(l) && reC.test(l); });
      res = lines.map(function (l) { if (!l.trim()) return l; return all ? l.replace(reO, "$1").replace(reC, "") : l.replace(/^(\s*)(.*)$/, "$1" + o + " $2 " + c); }).join("\n");
    }
    this.replace(ls, le, res, ls, ls + res.length);
  };
  Editor.prototype.destroy = function () { this.el.remove(); };

  function titleFor(path) {
    var n = baseName(path).replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
    return n === "index" ? "Startseite" : n.charAt(0).toUpperCase() + n.slice(1);
  }

  /* ==========================================================
     Speichern
     ========================================================== */
  var saveTimers = {}, pending = {};
  function setSaveState(t, ok) { var el = $("saveState"); el.innerHTML = ok ? "<b>✓</b> " + esc(t) : esc(t); }
  function scheduleSave(path) {
    pending[path] = true;
    clearTimeout(saveTimers[path]);
    saveTimers[path] = setTimeout(function () { flush(path); }, 250);
    setSaveState("speichert …");
  }
  function flush(path) {
    clearTimeout(saveTimers[path]);
    var f = S.files.get(path), pid = S.pid;
    if (!f || !pending[path]) return Promise.resolve();
    delete pending[path];
    return HEDB.write(pid, [f]).then(function () {
      send({ t: "changed", pid: pid, path: path });
      if (!Object.keys(pending).length) setSaveState("Im Browser gespeichert.", true);
    }).catch(function (err) {
      setSaveState("Speichern fehlgeschlagen!");
      toast("Speichern fehlgeschlagen: " + (err && err.message || err), 6000);
    });
  }
  function flushAll() { return Promise.all(Object.keys(pending).map(flush)); }
  function saveNow() {
    flushAll().then(function () { toast("Gespeichert (im Browser). Zum Abgeben oder Mitnehmen: „ZIP speichern“."); });
  }
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden") flushAll(); });
  window.addEventListener("pagehide", flushAll);

  /* ==========================================================
     Prüfen
     ========================================================== */
  function ctxFor(path) {
    return {
      path: path,
      exists: isFile,
      findCase: function (p) { var l = p.toLowerCase(), r = null; S.files.forEach(function (f, k) { if (f.kind !== "dir" && k.toLowerCase() === l) r = k; }); return r; },
      findName: function (n) { var r = null; S.files.forEach(function (f, k) { if (!r && f.kind !== "dir" && baseName(k) === n) r = k; }); return r; }
    };
  }
  function lintFile(path) {
    var f = S.files.get(path), lang = HEPruef.langOf(path);
    if (!f || f.kind !== "text" || (lang !== "html" && lang !== "css") || /\.(svg|xml)$/i.test(path)) { S.diags.delete(path); return; }
    S.diags.set(path, HEPruef.lint(lang, f.text || "", ctxFor(path)));
  }
  function lintAll() { S.files.forEach(function (f, p) { lintFile(p); }); afterLint(); }
  var lintT;
  function scheduleLint() {
    clearTimeout(lintT);
    // Links zwischen Dateien: alle HTML/CSS-Dateien neu prüfen ist schnell genug
    lintT = setTimeout(function () { if (S.active) lintFile(S.active); afterLint(); }, 350);
  }
  function worst(path) {
    var all = (S.diags.get(path) || []).concat(w3cFresh(path));
    if (all.some(function (d) { return d.sev === "error"; })) return "e";
    if (all.some(function (d) { return d.sev === "warning"; })) return "w";
    return "";
  }
  function w3cFresh(path) {
    var w = S.w3c.get(path), f = S.files.get(path);
    return w && f && w.text === f.text ? w.diags : [];
  }
  function afterLint() {
    renderTree(); renderTabs(); renderProblems();
    S.editors.forEach(function (ed, p) {
      var all = (S.diags.get(p) || []).concat(w3cFresh(p));
      ed.setMarks(all.filter(function (d) { return d.sev !== "hint" && d.line; }).map(function (d) { return { line: d.line, cls: d.sev === "error" ? "e" : "w" }; }));
    });
  }
  function renderProblems() {
    var list = $("plist"), cnt = $("probCount"), p = S.active, f = p && S.files.get(p);
    list.innerHTML = "";
    var lang = p ? HEPruef.langOf(p) : "";
    var checkable = f && f.kind === "text" && (lang === "html" || lang === "css") && !/\.(svg|xml)$/i.test(p);
    $("w3cBtn").disabled = !checkable;
    if (!checkable) {
      cnt.innerHTML = "";
      list.innerHTML = '<li class="note">' + (p ? "Für diese Datei gibt es keine Prüfung – geprüft werden HTML- und CSS-Dateien." : "Keine Datei geöffnet.") + "</li>";
      return;
    }
    var local = S.diags.get(p) || [], w = S.w3c.get(p), stale = w && w.text !== f.text;
    var w3 = w && !stale ? w.diags : [];
    var all = local.map(function (d) { return Object.assign({ src: "" }, d); }).concat(w3.map(function (d) { return Object.assign({ src: "W3C" }, d); }))
      .sort(function (a, b) { return (a.line || 0) - (b.line || 0); });
    var ne = all.filter(function (d) { return d.sev === "error"; }).length, nw = all.filter(function (d) { return d.sev === "warning"; }).length;
    cnt.innerHTML = ne || nw
      ? (ne ? '<span class="cnt e">' + ne + " Fehler</span>" : "") + (nw ? '<span class="cnt w">' + nw + (nw === 1 ? " Warnung" : " Warnungen") + "</span>" : "")
      : '<span class="cnt ok">✓ ok</span>';
    if (w && stale) list.insertAdjacentHTML("beforeend", '<li class="note">Das W3C-Ergebnis passt nicht mehr zum geänderten Code – bei Bedarf erneut prüfen.</li>');
    if (w && !stale && !w.diags.length) list.insertAdjacentHTML("beforeend", '<li class="note">✓ W3C: keine Fehler und Warnungen.</li>');
    all.forEach(function (d) {
      var li = document.createElement("li");
      li.className = d.sev; li.tabIndex = 0;
      var sev = d.sev === "error" ? "Fehler" : d.sev === "warning" ? "Warnung" : "Hinweis";
      li.innerHTML = '<span class="pos">' + (d.line ? "Z " + d.line : "") + "</span><span><span class=\"sev\">" + sev + ":</span> " + esc(d.msg) +
        (d.src ? '<span class="src">' + d.src + "</span>" : "") + (d.hint ? '<span class="tip">' + esc(d.hint) + "</span>" : "") + "</span>";
      var go = function () { var ed = S.editors.get(p); if (ed && d.line) ed.goTo(d.line, d.col); };
      li.addEventListener("click", go);
      li.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
      list.appendChild(li);
    });
    if (!all.length && !(w && !stale)) list.insertAdjacentHTML("beforeend", '<li class="note">✓ Keine Fehler gefunden. Für die offizielle, strengere Prüfung: „W3C-Prüfung“.</li>');
  }
  $("probsToggle").addEventListener("click", function () { setProbs($("probs").classList.contains("zu")); });
  function setProbs(open) {
    $("probs").classList.toggle("zu", !open);
    $("probsToggle").textContent = open ? "▾" : "▸";
    $("probsToggle").setAttribute("aria-expanded", String(open));
    save("pruefen", open ? "1" : "0");
  }

  /* ---------- W3C ---------- */
  function w3cCheck() {
    var p = S.active, f = p && S.files.get(p);
    if (!f || f.kind !== "text") return;
    var go = function () {
      var btn = $("w3cBtn"), text = f.text || "", lang = HEPruef.langOf(p);
      btn.setAttribute("aria-busy", "true"); btn.disabled = true; btn.textContent = "prüft …";
      var job = lang === "css" ? w3cCss(text) : w3cHtml(text);
      job.then(function (diags) {
        S.w3c.set(p, { text: text, diags: diags });
        var ne = diags.filter(function (d) { return d.sev === "error"; }).length;
        toast(ne ? "W3C: " + ne + " Fehler in " + baseName(p) : "W3C: " + baseName(p) + " ist gültig ✓");
        setProbs(true);
      }).catch(function () {
        toast("Der W3C-Validator ist gerade nicht erreichbar. Besteht eine Internetverbindung?", 5000);
      }).then(function () {
        btn.removeAttribute("aria-busy"); btn.textContent = "W3C-Prüfung";
        afterLint();
      });
    };
    if (load("w3cOk", "") === "1") { go(); return; }
    ask({
      title: "W3C-Prüfung",
      html: "Dafür wird der Inhalt von <b>" + esc(baseName(p)) + "</b> an den Validator des W3C (validator.w3.org bzw. jigsaw.w3.org) geschickt. " +
        "Schreibe deshalb keine persönlichen Daten in den Code.<br><br>Die normale Prüfung unten läuft dagegen nur in deinem Browser.",
      choices: [{ value: "immer", label: "Verstanden – nicht mehr fragen" }, { value: "einmal", label: "Nur dieses Mal" }],
      ok: "Jetzt prüfen"
    }).then(function (c) {
      if (!c) return;
      if (c === "immer") save("w3cOk", "1");
      go();
    });
  }
  function w3cHtml(text) {
    return fetch("https://validator.w3.org/nu/?out=json", {
      method: "POST", headers: { "Content-Type": "text/html; charset=utf-8" }, body: text, credentials: "omit", referrerPolicy: "no-referrer"
    }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (j) {
      return (j.messages || []).filter(function (m) { return m.type !== "info" || m.subType === "warning"; }).map(function (m) {
        return {
          sev: m.type === "error" || m.type === "non-document-error" ? "error" : "warning",
          line: m.firstLine || m.lastLine || 0, col: m.firstColumn || m.lastColumn || 1,
          msg: (m.message || "").replace(/\u201c|\u201d/g, "\""), hint: m.extract ? "… " + m.extract.replace(/\s+/g, " ").trim() + " …" : ""
        };
      });
    });
  }
  function w3cCss(text) {
    // Der CSS-Validator nimmt per POST nur multipart/form-data an
    var body = new FormData();
    [["text", text], ["profile", "css3svg"], ["output", "json"], ["lang", "de"], ["warning", "1"], ["usermedium", "all"]].forEach(function (kv) { body.append(kv[0], kv[1]); });
    return fetch("https://jigsaw.w3.org/css-validator/validator", { method: "POST", body: body, credentials: "omit", referrerPolicy: "no-referrer" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (j) {
        var v = j.cssvalidation || {}, out = [];
        (v.errors || []).forEach(function (e) { out.push({ sev: "error", line: e.line || 0, col: 1, msg: clean(e.message) + (e.context ? " (bei „" + e.context.trim() + "“)" : ""), hint: "" }); });
        (v.warnings || []).forEach(function (e) { out.push({ sev: "warning", line: e.line || 0, col: 1, msg: clean(e.message), hint: "" }); });
        return out;
      });
    function clean(s) { return String(s || "").replace(/\s*:\s*$/, "").replace(/\s+/g, " ").trim(); }
  }
  $("w3cBtn").addEventListener("click", w3cCheck);

  /* ==========================================================
     Dateibaum
     ========================================================== */
  function buildTree() {
    var root = { dirs: {}, files: [], path: "" };
    S.files.forEach(function (f, p) {
      var parts = p.replace(/\/$/, "").split("/"), node = root;
      var upto = f.kind === "dir" ? parts.length : parts.length - 1;
      for (var i = 0; i < upto; i++) {
        var key = parts[i];
        if (!node.dirs[key]) node.dirs[key] = { dirs: {}, files: [], path: parts.slice(0, i + 1).join("/") + "/" };
        node = node.dirs[key];
      }
      if (f.kind !== "dir") node.files.push(p);
    });
    return root;
  }
  function icon(p) {
    var e = ext(p);
    if (/^html?$/.test(e)) return ['<>', "html"];
    if (e === "css") return ["#", "css"];
    if (e === "js" || e === "mjs" || e === "json") return ["js", "js"];
    if (IMG_EXT.test(p)) return ["▣", "img"];
    return ["·", ""];
  }
  function renderTree() {
    var root = buildTree(), html = "";
    function dirErr(node) {
      var w = "";
      node.files.forEach(function (p) { var x = worst(p); if (x === "e" || (x === "w" && !w)) w = x === "e" ? "e" : w || x; });
      Object.keys(node.dirs).forEach(function (k) { var x = dirErr(node.dirs[k]); if (x === "e") w = "e"; else if (x === "w" && !w) w = "w"; });
      return w;
    }
    function walk(node, depth) {
      Object.keys(node.dirs).sort(byName).forEach(function (k) {
        var d = node.dirs[k], zu = !!S.collapsed[d.path], dot = zu ? dirErr(d) : "";
        html += '<div class="row' + (S.selDir === d.path ? " dirsel" : "") + '" role="treeitem" aria-expanded="' + !zu + '" tabindex="0" draggable="true" data-dir="' + esc(d.path) + '" style="--d:' + depth + '">' +
          '<span class="ico dir">' + (zu ? "▸" : "▾") + '</span><span class="nm">' + esc(k) + "/</span>" + (dot ? '<span class="dot ' + dot + '"></span>' : "") +
          '<span class="acts"><button type="button" data-a="new" title="Neue Datei in ' + esc(k) + '" aria-label="Neue Datei in ' + esc(k) + '">+</button>' +
          '<button type="button" data-a="ren" title="Umbenennen / verschieben (F2)" aria-label="Umbenennen">✎</button>' +
          '<button type="button" data-a="del" class="del" title="Löschen (Entf)" aria-label="Löschen">✕</button></span></div>';
        if (!zu) walk(d, depth + 1);
      });
      node.files.sort(byName).forEach(function (p) {
        var ic = icon(p), dot = worst(p);
        html += '<div class="row' + (S.active === p ? " active" : "") + '" role="treeitem" tabindex="0" draggable="true" data-file="' + esc(p) + '" style="--d:' + depth + '" title="' + esc(p) + '">' +
          '<span class="ico ' + ic[1] + '">' + esc(ic[0]) + '</span><span class="nm">' + esc(baseName(p)) + "</span>" + (dot ? '<span class="dot ' + dot + '"></span>' : "") +
          '<span class="acts"><button type="button" data-a="ren" title="Umbenennen / verschieben (F2)" aria-label="Umbenennen">✎</button>' +
          '<button type="button" data-a="del" class="del" title="Löschen (Entf)" aria-label="Löschen">✕</button></span></div>';
      });
    }
    walk(root, 0);
    var focused = document.activeElement && tree.contains(document.activeElement) ? (document.activeElement.closest(".row") || {}).dataset : null;
    tree.innerHTML = html || '<div class="tree-empty">Noch keine Dateien. Lege oben mit „+datei“ eine an oder ziehe Dateien hierher.</div>';
    if (focused) {
      var sel = focused.file ? '[data-file="' + cssEsc(focused.file) + '"]' : focused.dir ? '[data-dir="' + cssEsc(focused.dir) + '"]' : null;
      var el = sel && tree.querySelector(sel); if (el) el.focus();
    }
  }
  function cssEsc(s) { return window.CSS && CSS.escape ? CSS.escape(s) : s.replace(/["\\]/g, "\\$&"); }
  function rowAction(row, act) {
    var file = row.dataset.file, dir = row.dataset.dir;
    if (act === "del") return removePath(file || dir);
    if (act === "ren") return renamePath(file || dir);
    if (act === "new") return newFile(dir);
    if (dir) {
      S.collapsed[dir] = !S.collapsed[dir];
      S.selDir = S.collapsed[dir] && S.selDir === dir ? "" : dir;
      save("zu." + S.pid, JSON.stringify(S.collapsed));
      renderTree();
    } else if (file) { S.selDir = dirOf(file); openFile(file, true); }
  }
  tree.addEventListener("click", function (e) {
    var row = e.target.closest(".row"); if (!row) { S.selDir = ""; renderTree(); return; }
    var b = e.target.closest("button[data-a]");
    rowAction(row, b ? b.dataset.a : null);
  });
  tree.addEventListener("keydown", function (e) {
    var row = e.target.closest(".row"); if (!row || e.target.tagName === "BUTTON") return;
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); rowAction(row, null); }
    else if (e.key === "F2") { e.preventDefault(); rowAction(row, "ren"); }
    else if (e.key === "Delete") { e.preventDefault(); rowAction(row, "del"); }
    else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      var rows = Array.from(tree.querySelectorAll(".row")), i = rows.indexOf(row) + (e.key === "ArrowDown" ? 1 : -1);
      if (rows[i]) rows[i].focus();
    }
  });

  /* ---------- Ziehen & Ablegen ---------- */
  var dragPath = null;
  tree.addEventListener("dragstart", function (e) {
    var row = e.target.closest && e.target.closest(".row"); if (!row) return;
    dragPath = row.dataset.file || row.dataset.dir;
    e.dataTransfer.effectAllowed = "move";
    try { e.dataTransfer.setData("text/plain", dragPath); } catch (err) {}
  });
  tree.addEventListener("dragend", function () { dragPath = null; clearDrop(); });
  function clearDrop() { tree.classList.remove("drop"); tree.querySelectorAll(".row.drop").forEach(function (r) { r.classList.remove("drop"); }); }
  function dropTarget(e) {
    var row = e.target.closest && e.target.closest(".row");
    if (row && row.dataset.dir) return { dir: row.dataset.dir, row: row };
    if (row && row.dataset.file) return { dir: dirOf(row.dataset.file), row: dirOf(row.dataset.file) ? tree.querySelector('[data-dir="' + cssEsc(dirOf(row.dataset.file)) + '"]') : null };
    return { dir: "", row: null };
  }
  tree.addEventListener("dragover", function (e) {
    var hasFiles = e.dataTransfer && Array.from(e.dataTransfer.types || []).indexOf("Files") >= 0;
    if (!hasFiles && !dragPath) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = hasFiles ? "copy" : "move";
    clearDrop();
    var t = dropTarget(e);
    if (t.row) t.row.classList.add("drop"); else tree.classList.add("drop");
  });
  tree.addEventListener("dragleave", function (e) { if (!tree.contains(e.relatedTarget)) clearDrop(); });
  tree.addEventListener("drop", function (e) {
    e.preventDefault();
    clearDrop();
    var t = dropTarget(e);
    if (dragPath) {
      var from = dragPath; dragPath = null;
      var target = t.dir + baseName(from) + (/\/$/.test(from) ? "/" : "");
      if (target === from || (from.slice(-1) === "/" && t.dir.indexOf(from) === 0)) return;
      movePath(from, target);
      return;
    }
    readDropped(e.dataTransfer).then(function (list) { addFiles(list, t.dir); });
  });
  // Auch aufs Editorfenster gezogene Dateien annehmen
  [edHost].forEach(function (zone) {
    zone.addEventListener("dragover", function (e) { if (Array.from(e.dataTransfer.types || []).indexOf("Files") >= 0) { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; } });
    zone.addEventListener("drop", function (e) {
      if (!e.dataTransfer.files.length) return;
      e.preventDefault();
      readDropped(e.dataTransfer).then(function (list) { addFiles(list, S.selDir); });
    });
  });
  function readDropped(dt) {
    var items = dt.items ? Array.from(dt.items).filter(function (i) { return i.kind === "file"; }) : [];
    var entries = items.map(function (i) { return i.webkitGetAsEntry ? i.webkitGetAsEntry() : null; }).filter(Boolean);
    if (!entries.length) return Promise.resolve(Array.from(dt.files || []).map(function (f) { return { path: f.name, file: f }; }));
    var out = [];
    function walk(entry, prefix) {
      if (entry.isFile) return new Promise(function (res) { entry.file(function (f) { out.push({ path: prefix + f.name, file: f }); res(); }, function () { res(); }); });
      if (entry.isDirectory) {
        var reader = entry.createReader(), all = [];
        return new Promise(function (res) {
          (function more() {
            reader.readEntries(function (batch) {
              if (!batch.length) Promise.all(all.map(function (x) { return walk(x, prefix + entry.name + "/"); })).then(res);
              else { all = all.concat(Array.from(batch)); more(); }
            }, function () { res(); });
          })();
        });
      }
      return Promise.resolve();
    }
    return Promise.all(entries.map(function (en) { return walk(en, ""); })).then(function () { return out; });
  }

  /* ==========================================================
     Dateien anlegen, hochladen, umbenennen, löschen
     ========================================================== */
  function decodeText(bytes) {
    var t;
    try { t = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
    catch (e) { t = new TextDecoder("windows-1252").decode(bytes); }
    return t.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  }
  function toRecord(path, blob) {
    if (TEXT_EXT.test(path)) {
      return blob.arrayBuffer().then(function (b) { return textRec(path, decodeText(new Uint8Array(b))); });
    }
    var type = mimeOf(path) || blob.type || "application/octet-stream";
    return Promise.resolve({ path: path, kind: "blob", blob: new Blob([blob], { type: type }), type: type, size: blob.size, mtime: Date.now() });
  }
  var SKIP = /(^|\/)(__MACOSX|\.git|\.DS_Store|Thumbs\.db|desktop\.ini|node_modules)(\/|$)/i;

  function addFiles(list, targetDir) {
    targetDir = targetDir || "";
    var items = [], big = [], bad = [];
    list.forEach(function (x) {
      if (SKIP.test(x.path)) return;
      var p = cleanPath(targetDir + x.path);
      if (!p) { bad.push(x.path); return; }
      if (x.file.size > MAX_FILE) { big.push(x.path); return; }
      items.push({ path: p, file: x.file });
    });
    if (big.length) toast(big.length + " Datei(en) über " + fmtSize(MAX_FILE) + " übersprungen: " + big.slice(0, 3).join(", "), 5000);
    if (bad.length) toast("Ungültiger Dateiname: " + bad.slice(0, 3).join(", "), 5000);
    if (!items.length) return Promise.resolve();
    var conflicts = items.filter(function (x) { return S.files.has(x.path); });
    var step = conflicts.length ? ask({
      title: "Ersetzen?",
      text: conflicts.length === 1 ? "„" + conflicts[0].path + "“ gibt es schon. Soll die Datei ersetzt werden?"
        : conflicts.length + " Dateien gibt es schon (" + conflicts.slice(0, 4).map(function (c) { return c.path; }).join(", ") + (conflicts.length > 4 ? ", …" : "") + "). Ersetzen?",
      ok: "Ersetzen", cancel: "Nur neue Dateien"
    }) : Promise.resolve(true);
    return step.then(function (ok) {
      if (!ok) items = items.filter(function (x) { return !S.files.has(x.path); });
      if (!items.length) return;
      return Promise.all(items.map(function (x) { return toRecord(x.path, x.file); })).then(function (recs) {
        return HEDB.write(S.pid, recs).then(function () {
          recs.forEach(function (r) {
            r.pid = S.pid; S.files.set(r.path, r);
            var ed = S.editors.get(r.path);
            if (ed) ed.setText(r.text || "");
            if (r.path === S.active && r.kind === "blob") showViewer(r.path);
          });
          if (targetDir) delete S.collapsed[targetDir];
          lintAll();
          send({ t: "changed", pid: S.pid, path: "*" });
          toast(recs.length === 1 ? recs[0].path + " hinzugefügt" : recs.length + " Dateien hinzugefügt");
          if (recs.length === 1) openFile(recs[0].path, false);
        });
      });
    }).catch(function (err) { toast("Hochladen fehlgeschlagen: " + (err && err.message || err), 6000); });
  }
  $("upBtn").addEventListener("click", function () { $("upIn").click(); });
  $("upIn").addEventListener("change", function (e) {
    var files = Array.from(e.target.files || []);
    e.target.value = "";
    addFiles(files.map(function (f) { return { path: f.name, file: f }; }), S.selDir);
  });

  function newFile(dir) {
    dir = dir === undefined ? S.selDir : dir;
    var hasIndex = isFile("index.html");
    ask({
      title: "Neue Datei",
      text: "Name mit Endung, z. B. kontakt.html, style.css oder script.js. Mit Ordner davor landet die Datei im Ordner: css/style.css. Ohne Endung wird es eine .html-Datei.",
      input: dir + (hasIndex || dir ? "" : "index.html"), placeholder: "seite.html",
      select: [dir.length, dir.length + (hasIndex || dir ? 0 : 5)],
      ok: "Anlegen",
      validate: function (v) {
        var err = pathError(v); if (err) return err;
        var p = withExt(cleanPath(v));
        if (S.files.has(p)) return "„" + p + "“ gibt es schon.";
        if (S.files.has(p + "/")) return "So heißt schon ein Ordner.";
        return "";
      }
    }).then(function (r) {
      if (!r) return;
      var p = withExt(cleanPath(r.value)), text = "";
      if (/\.html?$/i.test(p)) { var css = cssFiles()[0]; text = skeleton(titleFor(p), css ? HEPruef.relPath(p, css) : null); }
      var rec = textRec(p, text);
      return HEDB.write(S.pid, [rec]).then(function () {
        rec.pid = S.pid; S.files.set(p, rec);
        delete S.collapsed[dirOf(p)];
        lintAll(); openFile(p, true);
        send({ t: "changed", pid: S.pid, path: "*" });
        if (/\.html?$/i.test(p)) { var ed = S.editors.get(p); if (ed) { var i = text.indexOf("<body>\n") + 9; ed.ta.setSelectionRange(i, i); ed.caret(); } }
      });
    });
  }
  function withExt(p) { return /\.[a-z0-9]+$/i.test(baseName(p)) ? p : p + ".html"; }
  $("newFileBtn").addEventListener("click", function () { newFile(); });

  $("newDirBtn").addEventListener("click", function () {
    ask({
      title: "Neuer Ordner", text: "Zum Beispiel bilder, css oder js.", input: S.selDir, placeholder: "bilder", ok: "Anlegen",
      validate: function (v) {
        var err = pathError(v, true); if (err) return err;
        var p = cleanPath(v, true);
        if (Array.from(S.files.keys()).some(function (k) { return k === p || k.indexOf(p) === 0; })) return "Den Ordner gibt es schon.";
        if (S.files.has(p.slice(0, -1))) return "So heißt schon eine Datei.";
        return "";
      }
    }).then(function (r) {
      if (!r) return;
      var p = cleanPath(r.value, true), rec = { path: p, kind: "dir", mtime: Date.now() };
      return HEDB.write(S.pid, [rec]).then(function () {
        rec.pid = S.pid; S.files.set(p, rec); S.selDir = p; delete S.collapsed[p]; renderTree();
      });
    });
  });

  function pathsUnder(p) {
    if (!/\/$/.test(p)) return [p];
    return Array.from(S.files.keys()).filter(function (k) { return k.indexOf(p) === 0; });
  }
  function renamePath(p) {
    var isDir = /\/$/.test(p), shown = isDir ? p.slice(0, -1) : p;
    var b = baseName(p), dot = isDir ? -1 : b.lastIndexOf(".");
    var selStart = shown.length - b.length, selEnd = dot > 0 ? selStart + dot : shown.length;
    ask({
      title: isDir ? "Ordner umbenennen" : "Umbenennen",
      text: "Du kannst auch den Ordner ändern, um " + (isDir ? "ihn" : "die Datei") + " zu verschieben, z. B. bilder/" + (isDir ? "neu" : b) + ".",
      input: shown, select: [selStart, selEnd], ok: "Umbenennen",
      validate: function (v) {
        var err = pathError(v, isDir); if (err) return err;
        var np = cleanPath(v, isDir);
        if (np === p) return "";
        if (isDir && np.indexOf(p) === 0) return "Ein Ordner kann nicht in sich selbst verschoben werden.";
        if (S.files.has(np) || (isDir ? S.files.has(np.slice(0, -1)) : S.files.has(np + "/"))) return "Den Namen gibt es schon.";
        if (isDir && Array.from(S.files.keys()).some(function (k) { return k.indexOf(np) === 0; })) return "Den Ordner gibt es schon.";
        return "";
      }
    }).then(function (r) {
      if (!r) return;
      var np = cleanPath(r.value, isDir);
      if (np !== p) movePath(p, np);
    });
  }
  function movePath(from, to) {
    var isDir = /\/$/.test(from);
    if (S.files.has(to) || (!isDir && S.files.has(to + "/"))) { toast("„" + to + "“ gibt es schon."); return; }
    var olds = pathsUnder(from), puts = [], map = {};
    olds.forEach(function (o) {
      var n = to + o.slice(from.length);
      var rec = Object.assign({}, S.files.get(o), { path: n, mtime: Date.now() });
      if (rec.kind === "text") rec.type = mimeOf(n);
      puts.push(rec); map[o] = n;
    });
    return flushAll().then(function () { return HEDB.write(S.pid, puts, olds); }).then(function () {
      olds.forEach(function (o) { S.files.delete(o); });
      puts.forEach(function (r) { S.files.set(r.path, r); });
      S.tabs = S.tabs.map(function (t) { return map[t] || t; });
      Object.keys(map).forEach(function (o) {
        var ed = S.editors.get(o); if (ed) { S.editors.delete(o); S.editors.set(map[o], ed); ed.setPath(map[o]); }
        if (S.w3c.has(o)) { S.w3c.set(map[o], S.w3c.get(o)); S.w3c.delete(o); }
      });
      if (map[S.active]) S.active = map[S.active];
      if (map[S.lastHtml]) S.lastHtml = map[S.lastHtml];
      if (S.selDir && S.selDir.indexOf(from) === 0 && isDir) S.selDir = to + S.selDir.slice(from.length);
      saveTabs(); lintAll(); renderTabs();
      if (S.active) activate(S.active, false);
      send({ t: "changed", pid: S.pid, path: "*" });
      var broken = Array.from(S.diags.values()).some(function (l) { return l.some(function (d) { return /gibt es im Projekt nicht|Die Datei heißt/.test(d.msg); }); });
      toast(baseName(to) + (isDir ? "/" : "") + " umbenannt" + (broken ? " – Links darauf in anderen Dateien anpassen (siehe Dateien mit rotem Punkt)" : ""), broken ? 5000 : 2400);
    }).catch(function (err) { toast("Umbenennen fehlgeschlagen: " + (err && err.message || err), 5000); });
  }
  function removePath(p) {
    var isDir = /\/$/.test(p), list = pathsUnder(p), n = list.filter(function (k) { return !/\/$/.test(k); }).length;
    ask({
      title: isDir ? "Ordner löschen" : "Datei löschen",
      text: isDir ? "Den Ordner „" + p + "“" + (n ? " mit " + n + (n === 1 ? " Datei" : " Dateien") : "") + " wirklich löschen?" : "„" + p + "“ wirklich löschen?",
      ok: "Löschen", danger: true
    }).then(function (ok) {
      if (!ok) return;
      list.forEach(function (k) { delete pending[k]; clearTimeout(saveTimers[k]); });
      return HEDB.write(S.pid, [], list).then(function () {
        list.forEach(function (k) {
          S.files.delete(k); S.diags.delete(k); S.w3c.delete(k);
          var ed = S.editors.get(k); if (ed) { ed.destroy(); S.editors.delete(k); }
        });
        var wasActive = list.indexOf(S.active) >= 0, idx = S.tabs.indexOf(S.active);
        S.tabs = S.tabs.filter(function (t) { return list.indexOf(t) < 0; });
        if (S.selDir && S.selDir.indexOf(p) === 0) S.selDir = "";
        if (wasActive) { S.active = null; activate(S.tabs[Math.max(0, Math.min(idx, S.tabs.length - 1))] || null, false); }
        saveTabs(); lintAll(); renderTabs();
        send({ t: "changed", pid: S.pid, path: "*" });
        toast(baseName(p) + " gelöscht");
      });
    });
  }

  /* ==========================================================
     Tabs und Anzeige
     ========================================================== */
  function saveTabs() { if (S.pid) save("tabs." + S.pid, JSON.stringify({ tabs: S.tabs, active: S.active })); }
  function renderTabs() {
    var bar = $("tabs");
    bar.innerHTML = "";
    S.tabs.forEach(function (p) {
      var t = document.createElement("div");
      t.className = "tab" + (p === S.active ? " active" : "");
      t.setAttribute("role", "tab"); t.setAttribute("aria-selected", String(p === S.active)); t.tabIndex = p === S.active ? 0 : -1;
      t.title = p;
      var dot = worst(p);
      t.innerHTML = '<span>' + esc(baseName(p)) + "</span>" + (dot ? '<span class="dot ' + dot + '"></span>' : "") +
        '<button class="x" type="button" aria-label="' + esc(baseName(p)) + ' schließen" title="Schließen">×</button>';
      t.addEventListener("click", function (e) { if (e.target.closest(".x")) closeTab(p); else openFile(p, true); });
      t.addEventListener("auxclick", function (e) { if (e.button === 1) { e.preventDefault(); closeTab(p); } });
      t.addEventListener("keydown", function (e) { if (e.key === "Enter") openFile(p, true); });
      bar.appendChild(t);
    });
    var act = bar.querySelector(".tab.active");
    if (act && act.scrollIntoView) act.scrollIntoView({ block: "nearest", inline: "nearest" });
  }
  function openFile(p, focus) {
    if (!isFile(p)) return;
    if (S.tabs.indexOf(p) < 0) {
      var i = S.tabs.indexOf(S.active);
      S.tabs.splice(i < 0 ? S.tabs.length : i + 1, 0, p);
    }
    activate(p, focus);
  }
  function closeTab(p) {
    var i = S.tabs.indexOf(p); if (i < 0) return;
    if (pending[p]) flush(p);
    S.tabs.splice(i, 1);
    var ed = S.editors.get(p); if (ed) { ed.destroy(); S.editors.delete(p); }
    if (S.active === p) { S.active = null; activate(S.tabs[Math.min(i, S.tabs.length - 1)] || null, false); }
    else { renderTabs(); saveTabs(); }
  }
  function clearView() {
    edHost.querySelectorAll(".viewer,.empty-ed").forEach(function (el) { el.remove(); });
    S.editors.forEach(function (ed) { ed.el.hidden = true; });
    if (S.viewerUrl) { URL.revokeObjectURL(S.viewerUrl); S.viewerUrl = null; }
  }
  function activate(p, focus) {
    clearView();
    S.active = p && isFile(p) ? p : null;
    if (!S.active) {
      var em = document.createElement("div"); em.className = "empty-ed";
      em.innerHTML = "<p>Keine Datei geöffnet.</p><p>Wähle links eine Datei aus oder lege eine neue an.</p>";
      var b = document.createElement("button"); b.className = "btn"; b.type = "button"; b.textContent = "+ Neue Datei";
      b.addEventListener("click", function () { newFile(); });
      em.appendChild(b); edHost.appendChild(em);
      $("caretPos").textContent = "–"; $("langInfo").textContent = "";
    } else {
      var f = S.files.get(S.active);
      if (f.kind === "text") {
        var ed = S.editors.get(S.active);
        if (!ed) { ed = new Editor(S.active); S.editors.set(S.active, ed); }
        ed.el.hidden = false;
        if (focus) ed.ta.focus({ preventScroll: true });
        ed.caret();
        $("langInfo").textContent = { html: "HTML", css: "CSS", js: "JavaScript", text: "Text" }[ed.lang];
      } else showViewer(S.active);
      if (/\.html?$/i.test(S.active)) { S.lastHtml = S.active; send({ t: "show", pid: S.pid, path: S.active }); }
    }
    saveTabs(); renderTabs(); renderTree(); renderProblems(); afterLintMarksOnly();
  }
  function afterLintMarksOnly() {
    var ed = S.active && S.editors.get(S.active); if (!ed) return;
    var all = (S.diags.get(S.active) || []).concat(w3cFresh(S.active));
    ed.setMarks(all.filter(function (d) { return d.sev !== "hint" && d.line; }).map(function (d) { return { line: d.line, cls: d.sev === "error" ? "e" : "w" }; }));
  }
  function showViewer(p) {
    clearView();
    var f = S.files.get(p), v = document.createElement("div");
    v.className = "viewer";
    var size = f.blob ? f.blob.size : 0;
    $("caretPos").textContent = fmtSize(size); $("langInfo").textContent = f.type || "";
    if (IMG_EXT.test(p) && f.blob) {
      S.viewerUrl = URL.createObjectURL(f.blob);
      var refHtml = S.lastHtml && isFile(S.lastHtml) ? S.lastHtml : htmlFiles()[0] || "index.html";
      var refCss = cssFiles()[0];
      var relH = HEPruef.relPath(refHtml, p);
      var snips = [["In HTML (von " + refHtml + " aus):", '<img src="' + relH + '" alt="' + esc(titleFor(p)) + '">']];
      if (refCss) snips.push(["Als Hintergrund in CSS (von " + refCss + " aus):", 'background-image: url("' + HEPruef.relPath(refCss, p) + '");']);
      v.innerHTML = '<div class="imgbox"><img alt="Vorschau von ' + esc(baseName(p)) + '" src="' + S.viewerUrl + '"></div><div class="info" id="imgInfo">' + esc(p) + " · " + fmtSize(size) + "</div>" +
        snips.map(function (s, i) { return '<div class="snip"><div class="lbl">' + esc(s[0]) + '</div><div class="codeline"><code>' + esc(s[1]) + '</code><button class="ib" type="button" data-i="' + i + '">kopieren</button></div></div>'; }).join("");
      var img = v.querySelector("img");
      img.addEventListener("load", function () { var i = v.querySelector("#imgInfo"); if (i) i.textContent = p + " · " + img.naturalWidth + " × " + img.naturalHeight + " px · " + fmtSize(size); });
      v.querySelectorAll("button[data-i]").forEach(function (b) {
        b.addEventListener("click", function () {
          var txt = snips[+b.dataset.i][1];
          (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(function () { toast("In die Zwischenablage kopiert"); }, function () { toast(txt); });
        });
      });
    } else {
      v.innerHTML = '<div class="info">' + esc(p) + " · " + fmtSize(size) + "</div><p>Diese Datei kann hier nicht bearbeitet werden. Sie ist aber Teil des Projekts und wird in der Vorschau und im ZIP mitgeliefert.</p>";
      var b = document.createElement("button"); b.className = "btn btn-ghost"; b.type = "button"; b.textContent = "Herunterladen";
      b.addEventListener("click", function () { download(f.blob, baseName(p)); });
      v.appendChild(b);
    }
    edHost.appendChild(v);
  }
  function download(blob, name) {
    var url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  /* ==========================================================
     Projekte
     ========================================================== */
  function renderProjects() {
    var sel = $("projSel");
    sel.innerHTML = "";
    S.projects.slice().sort(function (a, b) { return byName(a.name, b.name); }).forEach(function (p) {
      var o = document.createElement("option"); o.value = p.id; o.textContent = p.name; sel.appendChild(o);
    });
    sel.value = S.pid || "";
  }
  function loadProjects() { return HEDB.listProjects().then(function (l) { S.projects = l || []; renderProjects(); }); }
  function project() { return S.projects.filter(function (p) { return p.id === S.pid; })[0]; }
  function uniqueName(name) {
    name = (name || "Projekt").trim() || "Projekt";
    var names = S.projects.map(function (p) { return p.name.toLowerCase(); }), n = name, i = 2;
    while (names.indexOf(n.toLowerCase()) >= 0) n = name + " (" + i++ + ")";
    return n;
  }
  function openProject(pid) {
    return flushAll().then(function () {
      S.editors.forEach(function (ed) { ed.destroy(); });
      S.editors.clear(); S.diags.clear(); S.w3c.clear();
      S.pid = pid; save("current", pid);
      S.selDir = ""; S.lastHtml = null;
      try { S.collapsed = JSON.parse(load("zu." + pid, "{}")) || {}; } catch (e) { S.collapsed = {}; }
      return HEDB.listFiles(pid);
    }).then(function (files) {
      S.files = new Map((files || []).map(function (f) { return [f.path, f]; }));
      var st = {}; try { st = JSON.parse(load("tabs." + pid, "{}")) || {}; } catch (e) {}
      S.tabs = (st.tabs || []).filter(isFile);
      var act = isFile(st.active) ? st.active : null;
      if (!S.tabs.length) {
        var first = isFile("index.html") ? "index.html" : htmlFiles()[0];
        if (first) { S.tabs = [first]; var c = cssFiles()[0]; if (c) S.tabs.push(c); act = first; }
      }
      S.active = null;
      renderProjects();
      lintAll();
      activate(act || S.tabs[0] || null, false);
      var page = S.lastHtml || (isFile("index.html") ? "index.html" : htmlFiles()[0] || "index.html");
      send({ t: "show", pid: pid, path: page });
      setSaveState("Alles wird automatisch im Browser gespeichert.");
    });
  }
  function createProject(name, recs) {
    var p = { id: uid(), name: uniqueName(name), created: Date.now(), modified: Date.now() };
    return HEDB.putProject(p).then(function () { return HEDB.write(p.id, recs); })
      .then(loadProjects).then(function () { return openProject(p.id); }).then(function () { return p; });
  }
  $("projSel").addEventListener("change", function (e) { if (e.target.value !== S.pid) openProject(e.target.value); });

  function newProject() {
    ask({
      title: "Neues Projekt", input: uniqueName("Meine Webseite"), ok: "Anlegen",
      choices: [
        { value: "grund", label: "Grundgerüst", desc: "index.html und style.css – schon verknüpft" },
        { value: "mehr", label: "Mehrere Seiten", desc: "drei Seiten mit Navigation, css/style.css und Ordner bilder/" },
        { value: "leer", label: "Leer", desc: "nur eine leere index.html (Tipp: ! und Tab tippen)" }
      ],
      validate: function (v) { return v.trim() ? "" : "Bitte einen Namen eingeben."; }
    }).then(function (r) {
      if (!r) return;
      return createProject(r.value, template(r.choice)).then(function () { toast("Projekt „" + r.value.trim() + "“ angelegt"); });
    });
  }
  function renameProject() {
    var p = project(); if (!p) return;
    ask({ title: "Projekt umbenennen", input: p.name, ok: "Umbenennen", validate: function (v) {
      if (!v.trim()) return "Bitte einen Namen eingeben.";
      if (S.projects.some(function (x) { return x.id !== p.id && x.name.toLowerCase() === v.trim().toLowerCase(); })) return "Ein Projekt mit diesem Namen gibt es schon.";
      return "";
    } }).then(function (r) {
      if (!r) return;
      p.name = r.value.trim(); p.modified = Date.now();
      return HEDB.putProject(p).then(loadProjects);
    });
  }
  function copyProject() {
    var p = project(); if (!p) return;
    flushAll().then(function () {
      var recs = Array.from(S.files.values()).map(function (f) { var r = Object.assign({}, f); delete r.pid; return r; });
      return createProject(p.name + " (Kopie)", recs);
    }).then(function (np) { toast("Kopie „" + np.name + "“ angelegt"); });
  }
  function deleteProject() {
    var p = project(); if (!p) return;
    ask({
      title: "Projekt löschen",
      html: "Das Projekt <b>" + esc(p.name) + "</b> mit allen Dateien wird endgültig aus diesem Browser gelöscht. Vorher sichern? → „ZIP speichern“.",
      ok: "Endgültig löschen", danger: true
    }).then(function (ok) {
      if (!ok) return;
      pending = {};
      return HEDB.deleteProject(p.id).then(function () {
        send({ t: "gone", pid: p.id });
        try { localStorage.removeItem(STORE + ".tabs." + p.id); localStorage.removeItem(STORE + ".zu." + p.id); } catch (e) {}
        return loadProjects();
      }).then(function () {
        toast("„" + p.name + "“ gelöscht");
        if (S.projects.length) return openProject(newest().id);
        return createProject("Meine Webseite", template("grund"));
      });
    });
  }
  function newest() { return S.projects.slice().sort(function (a, b) { return (b.modified || 0) - (a.modified || 0); })[0]; }

  /* ---------- Import / Export ---------- */
  function stripTop(entries) {
    for (;;) {
      var files = entries.filter(function (e) { return !e.dir; });
      if (!files.length) return entries;
      var first = files[0].path.split("/")[0];
      if (files[0].path.indexOf("/") < 0) return entries;
      var all = entries.every(function (e) { return e.path === first + "/" || e.path.indexOf(first + "/") === 0; });
      if (!all) return entries;
      entries = entries.filter(function (e) { return e.path !== first + "/"; }).map(function (e) { return Object.assign({}, e, { path: e.path.slice(first.length + 1) }); });
    }
  }
  function importEntries(name, entries) {
    entries = stripTop(entries.filter(function (e) { return !SKIP.test(e.path) && e.path; }));
    var recs = [], skipped = 0;
    return Promise.all(entries.map(function (e) {
      if (e.dir) { var d = cleanPath(e.path, true); if (d) recs.push({ path: d, kind: "dir", mtime: Date.now() }); return null; }
      var p = cleanPath(e.path);
      if (!p || (e.size || (e.data && e.data.length) || 0) > MAX_FILE) { skipped++; return null; }
      var blob = e.blob || new Blob([e.data]);
      return toRecord(p, blob).then(function (r) { recs.push(r); });
    })).then(function () {
      if (!recs.some(function (r) { return r.kind !== "dir"; })) throw new Error("Darin sind keine Dateien.");
      return createProject(name, recs);
    }).then(function (p) {
      toast("Projekt „" + p.name + "“ geöffnet" + (skipped ? " – " + skipped + " Datei(en) übersprungen" : ""), 4000);
    });
  }
  $("zipIn").addEventListener("change", function (e) {
    var f = e.target.files && e.target.files[0]; e.target.value = "";
    if (!f) return;
    HEZip.read(f).then(function (entries) { return importEntries(f.name.replace(/\.zip$/i, ""), entries); })
      .catch(function (err) { toast("ZIP konnte nicht geöffnet werden: " + (err && err.message || err), 6000); });
  });
  $("dirIn").addEventListener("change", function (e) {
    var files = Array.from(e.target.files || []); e.target.value = "";
    if (!files.length) return;
    var top = (files[0].webkitRelativePath || "").split("/")[0] || "Ordner";
    var entries = files.map(function (f) { return { path: f.webkitRelativePath || f.name, blob: f, size: f.size }; });
    importEntries(top, entries).catch(function (err) { toast("Ordner konnte nicht geöffnet werden: " + (err && err.message || err), 6000); });
  });
  function exportZip() {
    var p = project(); if (!p) return;
    var enc = new TextEncoder();
    flushAll().then(function () {
      var list = Array.from(S.files.values()).sort(function (a, b) { return byName(a.path, b.path); });
      return Promise.all(list.map(function (f) {
        if (f.kind === "dir") return { path: f.path, dir: true, mtime: f.mtime };
        if (f.kind === "text") return { path: f.path, data: enc.encode(f.text || ""), mtime: f.mtime };
        return f.blob.arrayBuffer().then(function (b) { return { path: f.path, data: new Uint8Array(b), mtime: f.mtime }; });
      }));
    }).then(HEZip.write).then(function (blob) {
      var name = p.name.replace(/[\\/:*?"<>|]+/g, "-").trim() || "projekt";
      download(blob, name + ".zip");
      toast(name + ".zip wird gespeichert");
    }).catch(function (err) { toast("ZIP konnte nicht erstellt werden: " + (err && err.message || err), 6000); });
  }
  $("zipBtn").addEventListener("click", exportZip);

  $("projMenu").addEventListener("click", function (e) {
    var b = e.target.closest("button[data-act]"); if (!b) return;
    $("projMenu").open = false;
    var a = b.dataset.act;
    if (a === "neu") newProject();
    else if (a === "zip-oeffnen") $("zipIn").click();
    else if (a === "ordner-oeffnen") $("dirIn").click();
    else if (a === "umbenennen") renameProject();
    else if (a === "kopie") copyProject();
    else if (a === "loeschen") deleteProject();
  });
  document.addEventListener("click", function (e) { if (!$("projMenu").contains(e.target)) $("projMenu").open = false; });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && $("projMenu").open) { $("projMenu").open = false; } });

  /* ==========================================================
     Vorschau
     ========================================================== */
  var pvOpen = false, pvWin = null;
  function currentPage() {
    if (S.active && /\.html?$/i.test(S.active)) return S.active;
    if (S.lastHtml && isFile(S.lastHtml)) return S.lastHtml;
    return isFile("index.html") ? "index.html" : htmlFiles()[0] || "index.html";
  }
  function pvUrl(mode) {
    return "html-editor-vorschau.html?p=" + encodeURIComponent(S.pid) + "&f=" + encodeURIComponent(currentPage()) + "&mode=" + mode;
  }
  function setPreview(on) {
    pvOpen = on;
    $("pvPane").hidden = !on;
    ws.classList.toggle("pv", on);
    $("pvBtn").setAttribute("aria-pressed", String(on));
    $("pvBtn").textContent = on ? "■ Vorschau" : "▶ Vorschau";
    save("pv", on ? "1" : "0");
    var fr = $("pvFrame");
    if (on) { if (!fr.dataset.on) { fr.src = pvUrl("panel"); fr.dataset.on = "1"; } }
    else { fr.src = "about:blank"; delete fr.dataset.on; }
    S.editors.forEach(function (ed) { ed.paintMarks(); });
    charW = 0;
  }
  function openWindow() {
    flushAll();
    pvWin = window.open(pvUrl("window"), "html-editor-vorschau", "popup=yes,width=1100,height=800");
    if (!pvWin) { toast("Das Fenster wurde blockiert. Bitte Pop-ups für diese Seite erlauben.", 5000); return; }
    try { pvWin.focus(); } catch (e) {}
    if (pvOpen) setPreview(false);
  }
  function previewShortcut() {
    if (!pvOpen && !(pvWin && !pvWin.closed)) { setPreview(true); return; }
    flushAll().then(function () { send({ t: "reload", pid: S.pid }); });
  }
  $("pvBtn").addEventListener("click", function () { if (!pvOpen) flushAll(); setPreview(!pvOpen); });
  $("pvClose").addEventListener("click", function () { setPreview(false); });
  $("winBtn").addEventListener("click", openWindow);
  $("pvWin").addEventListener("click", openWindow);

  if (chan) chan.addEventListener("message", function (e) {
    var d = e.data || {};
    if (d.t === "goto" && d.pid === S.pid && isFile(d.path)) {
      openFile(d.path, true);
      var ed = S.editors.get(d.path); if (ed) ed.goTo(d.line, 1);
      try { window.focus(); } catch (err) {}
    }
    // Derselbe Editor in einem zweiten Tab hat etwas geändert
    if (d.t === "changed" && d.from && d.from !== S.inst && d.pid === S.pid) syncFromOther(d.path);
  });
  var syncT;
  function syncFromOther() {
    clearTimeout(syncT);
    syncT = setTimeout(function () {
      HEDB.listFiles(S.pid).then(function (files) {
        var seen = {};
        files.forEach(function (f) {
          seen[f.path] = true;
          if (pending[f.path]) return;
          S.files.set(f.path, f);
          var ed = S.editors.get(f.path); if (ed && f.kind === "text") ed.setText(f.text || "");
        });
        Array.from(S.files.keys()).forEach(function (k) { if (!seen[k] && !pending[k]) S.files.delete(k); });
        S.tabs = S.tabs.filter(isFile);
        if (S.active && !isFile(S.active)) activate(S.tabs[0] || null, false);
        lintAll();
      });
    }, 300);
  }

  /* ---------- Trenner Editor | Vorschau ---------- */
  var splitter = $("splitter");
  function setSplit(pct) {
    pct = Math.min(70, Math.max(20, Math.round(pct)));
    ws.style.setProperty("--pv", pct + "%");
    splitter.setAttribute("aria-valuenow", pct);
    save("split", String(pct));
    charW = 0;
  }
  splitter.addEventListener("pointerdown", function (e) {
    e.preventDefault(); splitter.setPointerCapture(e.pointerId);
    splitter.classList.add("drag"); document.body.classList.add("splitting");
  });
  splitter.addEventListener("pointermove", function (e) {
    if (!splitter.hasPointerCapture(e.pointerId)) return;
    var r = ws.getBoundingClientRect();
    setSplit((r.right - e.clientX) / r.width * 100);
  });
  function endDrag() { splitter.classList.remove("drag"); document.body.classList.remove("splitting"); }
  splitter.addEventListener("pointerup", endDrag);
  splitter.addEventListener("pointercancel", endDrag);
  splitter.addEventListener("dblclick", function () { setSplit(42); });
  splitter.addEventListener("keydown", function (e) {
    var v = parseFloat(load("split", "42"));
    if (e.key === "ArrowLeft") { e.preventDefault(); setSplit(v + 2); }
    if (e.key === "ArrowRight") { e.preventDefault(); setSplit(v - 2); }
  });

  /* ---------- Schriftgröße ---------- */
  var fs = parseInt(load("fs", "14"), 10) || 14;
  function applyFs() {
    fs = Math.max(11, Math.min(26, fs));
    edHost.style.setProperty("--ed-fs", fs + "px");
    edHost.style.setProperty("--ed-lh", Math.round(fs * 1.57) + "px");
    $("fsVal").textContent = fs;
    charW = 0; save("fs", String(fs));
    S.editors.forEach(function (ed) { ed.paintMarks(); });
  }
  $("fsDown").addEventListener("click", function () { fs--; applyFs(); });
  $("fsUp").addEventListener("click", function () { fs++; applyFs(); });

  document.addEventListener("keydown", function (e) {
    var mod = e.ctrlKey || e.metaKey;
    if (mod && !e.altKey && (e.key === "s" || e.key === "S") && !e.defaultPrevented) { e.preventDefault(); saveNow(); }
    if (mod && e.key === "Enter" && !e.defaultPrevented) { e.preventDefault(); previewShortcut(); }
  });
  window.addEventListener("resize", function () { charW = 0; });

  /* ==========================================================
     Start
     ========================================================== */
  function fatal(msg) {
    edHost.innerHTML = '<div class="empty-ed"><p><b>Der Editor kann hier nicht starten.</b></p><p>' + msg + "</p></div>";
  }
  applyFs();
  setSplit(parseFloat(load("split", "42")));
  setProbs(load("pruefen", "1") === "1");
  HEDB.open().then(loadProjects).then(function () {
    if (!S.projects.length) return createProject("Meine Webseite", template("grund"));
    var cur = load("current", "");
    var p = S.projects.filter(function (x) { return x.id === cur; })[0] || newest();
    return openProject(p.id);
  }).then(function () {
    if (load("pv", "0") === "1") setPreview(true);
  }).catch(function (err) {
    fatal("Der Browser erlaubt dieser Seite keinen Speicher (" + esc(err && err.message || err) + "). " +
      "In privaten Fenstern oder wenn Websitedaten blockiert sind, funktioniert der Editor nicht. Öffne ihn in einem normalen Fenster.");
  });
})();
