/* ==========================================================
   html-editor-pruefen.js – Syntax-Hervorhebung und lokale
   Prüfung (HTML und CSS) für den HTML-Editor.
   Läuft komplett im Browser, nichts wird verschickt.

   HEPruef.highlight(sprache, code)  → HTML mit <span class="t-…">
   HEPruef.lint(sprache, code, ctx)  → [{ sev, line, col, msg, hint }]
       sev: "error" | "warning" | "hint"
       ctx: { path, exists(pfad), findCase(pfad) }
   HEPruef.openStack(code)           → offene Elemente vor dem Cursor
   ========================================================== */

var HEPruef = (function () {
  "use strict";

  function set(str) { var o = Object.create(null); str.split(/\s+/).forEach(function (w) { if (w) o[w] = true; }); return o; }
  function esc(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  /* ---------- Wissen über HTML ---------- */
  var ELEMENTS = set("a abbr address area article aside audio b base bdi bdo blockquote body br button canvas caption cite code col colgroup " +
    "data datalist dd del details dfn dialog div dl dt em embed fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 head header hgroup " +
    "hr html i iframe img input ins kbd label legend li link main map mark menu meta meter nav noscript object ol optgroup option output p " +
    "picture pre progress q rp rt ruby s samp script search section select slot small source span strong style sub summary sup table tbody " +
    "td template textarea tfoot th thead time title tr track u ul var video wbr svg math");
  var OBSOLETE = set("acronym applet basefont bgsound big blink center dir font frame frameset image isindex keygen listing marquee menuitem " +
    "multicol nextid nobr noembed noframes param plaintext rb rtc spacer strike tt xmp");
  var VOID = set("area base br col embed hr img input link meta source track wbr param keygen");
  var OPTIONAL_END = set("html head body p li dt dd rt rp optgroup option colgroup caption thead tbody tfoot tr td th");
  var P_CLOSERS = set("address article aside blockquote details dialog div dl fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 " +
    "header hgroup hr main menu nav ol p pre search section table ul");
  var RAW = set("script style textarea title");
  var OBSOLETE_TIPP = {
    center: "Zentrieren geht mit CSS, z. B. text-align: center;",
    font: "Schriftart, -größe und -farbe gehören ins CSS (font-family, font-size, color).",
    big: "Größere Schrift mit CSS: font-size.",
    strike: "Durchgestrichen: <s> oder <del>, oder CSS text-decoration: line-through;",
    tt: "Für Code <code>, sonst CSS font-family: monospace;",
    marquee: "Laufschrift geht nur noch mit CSS-Animationen.",
    acronym: "Benutze <abbr>.",
    frame: "Benutze <iframe>.", frameset: "Benutze <iframe> oder ein normales Layout mit CSS."
  };

  /* ---------- Wissen über CSS ---------- */
  var PROPS = set(
    "accent-color align-content align-items align-self all animation animation-composition animation-delay animation-direction animation-duration " +
    "animation-fill-mode animation-iteration-count animation-name animation-play-state animation-timing-function animation-timeline appearance " +
    "aspect-ratio backdrop-filter backface-visibility background background-attachment background-blend-mode background-clip background-color " +
    "background-image background-origin background-position background-position-x background-position-y background-repeat background-size " +
    "block-size border border-block border-block-color border-block-end border-block-start border-block-style border-block-width border-bottom " +
    "border-bottom-color border-bottom-left-radius border-bottom-right-radius border-bottom-style border-bottom-width border-collapse border-color " +
    "border-end-end-radius border-end-start-radius border-image border-image-outset border-image-repeat border-image-slice border-image-source " +
    "border-image-width border-inline border-inline-color border-inline-end border-inline-start border-inline-style border-inline-width border-left " +
    "border-left-color border-left-style border-left-width border-radius border-right border-right-color border-right-style border-right-width " +
    "border-spacing border-start-end-radius border-start-start-radius border-style border-top border-top-color border-top-left-radius " +
    "border-top-right-radius border-top-style border-top-width border-width bottom box-decoration-break box-shadow box-sizing break-after " +
    "break-before break-inside caption-side caret-color clear clip clip-path color color-scheme column-count column-fill column-gap column-rule " +
    "column-rule-color column-rule-style column-rule-width column-span column-width columns contain container container-name container-type " +
    "content content-visibility counter-increment counter-reset counter-set cursor direction display empty-cells field-sizing filter flex flex-basis " +
    "flex-direction flex-flow flex-grow flex-shrink flex-wrap float font font-display font-family font-feature-settings font-kerning font-optical-sizing " +
    "font-size font-size-adjust font-stretch font-style font-synthesis font-variant font-variant-caps font-variant-ligatures font-variant-numeric " +
    "font-variation-settings font-weight forced-color-adjust gap grid grid-area grid-auto-columns grid-auto-flow grid-auto-rows grid-column " +
    "grid-column-end grid-column-gap grid-column-start grid-gap grid-row grid-row-end grid-row-gap grid-row-start grid-template grid-template-areas " +
    "grid-template-columns grid-template-rows hanging-punctuation height hyphens hyphenate-character image-orientation image-rendering inline-size " +
    "inset inset-block inset-block-end inset-block-start inset-inline inset-inline-end inset-inline-start isolation justify-content justify-items " +
    "justify-self left letter-spacing line-break line-clamp line-height list-style list-style-image list-style-position list-style-type margin " +
    "margin-block margin-block-end margin-block-start margin-bottom margin-inline margin-inline-end margin-inline-start margin-left margin-right " +
    "margin-top mask mask-clip mask-composite mask-image mask-mode mask-origin mask-position mask-repeat mask-size mask-type max-block-size " +
    "max-height max-inline-size max-width min-block-size min-height min-inline-size min-width mix-blend-mode object-fit object-position offset " +
    "offset-anchor offset-distance offset-path offset-rotate opacity order orphans outline outline-color outline-offset outline-style outline-width " +
    "overflow overflow-anchor overflow-block overflow-clip-margin overflow-inline overflow-wrap overflow-x overflow-y overscroll-behavior " +
    "overscroll-behavior-block overscroll-behavior-inline overscroll-behavior-x overscroll-behavior-y padding padding-block padding-block-end " +
    "padding-block-start padding-bottom padding-inline padding-inline-end padding-inline-start padding-left padding-right padding-top page " +
    "page-break-after page-break-before page-break-inside paint-order perspective perspective-origin place-content place-items place-self " +
    "pointer-events position print-color-adjust quotes resize right rotate row-gap ruby-align ruby-position scale scroll-behavior scroll-margin " +
    "scroll-margin-block scroll-margin-bottom scroll-margin-inline scroll-margin-left scroll-margin-right scroll-margin-top scroll-padding " +
    "scroll-padding-block scroll-padding-bottom scroll-padding-inline scroll-padding-left scroll-padding-right scroll-padding-top scroll-snap-align " +
    "scroll-snap-stop scroll-snap-type scrollbar-color scrollbar-gutter scrollbar-width shape-image-threshold shape-margin shape-outside tab-size " +
    "table-layout text-align text-align-last text-combine-upright text-decoration text-decoration-color text-decoration-line text-decoration-skip-ink " +
    "text-decoration-style text-decoration-thickness text-emphasis text-emphasis-color text-emphasis-position text-emphasis-style text-indent " +
    "text-justify text-orientation text-overflow text-rendering text-shadow text-size-adjust text-transform text-underline-offset " +
    "text-underline-position text-wrap text-wrap-mode text-wrap-style top touch-action transform transform-box transform-origin transform-style " +
    "transition transition-behavior transition-delay transition-duration transition-property transition-timing-function translate unicode-bidi " +
    "user-select vertical-align view-transition-name visibility white-space white-space-collapse widows width will-change word-break word-spacing " +
    "word-wrap writing-mode z-index zoom " +
    // SVG-Eigenschaften und Deskriptoren aus @font-face / @page / @property
    "fill fill-opacity fill-rule stroke stroke-width stroke-opacity stroke-dasharray stroke-dashoffset stroke-linecap stroke-linejoin " +
    "stop-color stop-opacity src unicode-range size syntax inherits initial-value ascent-override descent-override line-gap-override size-adjust");
  var COLORS = set(
    "aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse " +
    "chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta " +
    "darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet " +
    "deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green " +
    "greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan " +
    "lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey " +
    "lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen " +
    "mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive " +
    "olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple " +
    "rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow " +
    "springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen " +
    "transparent currentcolor inherit initial unset revert revert-layer none auto canvas canvastext linktext visitedtext activetext buttonface " +
    "buttontext buttonborder field fieldtext highlight highlighttext graytext mark marktext accentcolor accentcolortext");
  var COLOR_PROPS = set("color background-color border-color border-top-color border-right-color border-bottom-color border-left-color " +
    "outline-color text-decoration-color caret-color accent-color column-rule-color fill stroke stop-color");
  var LENGTH_PROPS = set("width height min-width min-height max-width max-height margin margin-top margin-right margin-bottom margin-left " +
    "padding padding-top padding-right padding-bottom padding-left top right bottom left inset font-size letter-spacing word-spacing " +
    "border-width border-top-width border-right-width border-bottom-width border-left-width border-radius outline-width outline-offset " +
    "gap row-gap column-gap text-indent flex-basis border-spacing");
  var NESTING_AT = set("media supports container layer document scope starting-style");
  var DECL_AT = set("font-face page property counter-style font-feature-values view-transition");
  var STATEMENT_AT = set("import charset namespace layer");

  /* ---------- Hilfen ---------- */
  function lineTable(src) {
    var starts = [0];
    for (var i = 0; i < src.length; i++) if (src.charCodeAt(i) === 10) starts.push(i + 1);
    return function (pos) {
      var lo = 0, hi = starts.length - 1;
      while (lo < hi) { var mid = (lo + hi + 1) >> 1; if (starts[mid] <= pos) lo = mid; else hi = mid - 1; }
      return { line: lo + 1, col: pos - starts[lo] + 1 };
    };
  }
  function dist(a, b) {
    if (Math.abs(a.length - b.length) > 3) return 99;
    var d = [], i, j;
    for (i = 0; i <= a.length; i++) { d[i] = [i]; }
    for (j = 1; j <= b.length; j++) d[0][j] = j;
    for (i = 1; i <= a.length; i++) for (j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
    return d[a.length][b.length];
  }
  function closest(word, dict) {
    var best = null, bd = word.length > 4 ? 3 : 2;
    for (var k in dict) { var dd = dist(word, k); if (dd < bd || (dd === bd && best === null && dd <= 1)) { bd = dd; best = k; } }
    return best;
  }
  function dirOf(path) { var i = path.lastIndexOf("/"); return i < 0 ? "" : path.slice(0, i + 1); }
  function normPath(p) {
    var out = [];
    p.split("/").forEach(function (seg, i, arr) {
      if (seg === "..") { if (out.length) out.pop(); else out.up = true; }
      else if (seg !== "." && (seg !== "" || i === arr.length - 1)) out.push(seg);
    });
    var r = out.join("/");
    return out.up ? null : r;
  }

  // Prüft einen Verweis (href/src/url()) auf eine Datei im Projekt.
  function checkRef(value, basePath, ctx, add, pos, opts) {
    opts = opts || {};
    var v = value.trim();
    if (!v || !ctx || !ctx.exists) return;
    if (/^(#|\?|[a-z][a-z0-9+.-]*:|\/\/|\{\{)/i.test(v)) return;
    if (v.indexOf("\\") >= 0) {
      add("error", pos, "Im Pfad „" + v + "“ steht ein Backslash \\.", "Im Web werden Ordner immer mit / getrennt, z. B. bilder/hund.jpg.");
      return;
    }
    if (v[0] === "/") {
      add("warning", pos, "Der Pfad „" + v + "“ beginnt mit /.", "Pfade mit / am Anfang zeigen auf die oberste Ebene des Servers und gehen z. B. auf GitHub Pages ins Leere. Gib den Pfad relativ an, z. B. „" + v.replace(/^\/+/, "") + "“.");
      return;
    }
    if (opts.link && /^(www\.|[\w-]+\.(de|com|org|net|eu|info|io)(\/|$))/i.test(v)) {
      add("warning", pos, "„" + v + "“ wird als Datei im Projekt gesucht.", "Für Links auf andere Webseiten gehört https:// davor, z. B. https://" + v);
      return;
    }
    var clean = v.split(/[?#]/)[0];
    try { clean = decodeURI(clean); } catch (e) {}
    var target = normPath(dirOf(basePath) + clean);
    if (target === null) {
      add("error", pos, "Der Pfad „" + v + "“ geht mit ../ aus dem Projekt hinaus.", "Von „" + basePath + "“ aus gibt es so viele Ordnerebenen nach oben nicht.");
      return;
    }
    if (target === "" || /\/$/.test(target)) target += "index.html";
    if (ctx.exists(target) || ctx.exists(target + "/index.html")) {
      if (/\s/.test(clean)) add("hint", pos, "Der Dateiname „" + clean + "“ enthält Leerzeichen.", "Das klappt, ist im Web aber unpraktisch. Besser: Bindestrich statt Leerzeichen.");
      return;
    }
    var cs = ctx.findCase && ctx.findCase(target);
    if (cs) {
      add("error", pos, "Die Datei heißt „" + cs + "“, nicht „" + target + "“.", "Groß- und Kleinschreibung zählt: auf echten Webservern ist Bild.JPG nicht dasselbe wie bild.jpg.");
      return;
    }
    var base = clean.split("/").pop(), other = ctx.findName && ctx.findName(base);
    var tipp = other
      ? "Eine Datei „" + base + "“ gibt es unter „" + other + "“. Von „" + basePath + "“ aus lautet der Pfad dann: " + relPath(basePath, other)
      : (opts.cssFile && dirOf(basePath) ? "Pfade in einer CSS-Datei gelten von der CSS-Datei aus – aus dem Ordner „" + dirOf(basePath) + "“ geht es mit ../ eine Ebene nach oben." : "Prüfe Dateiname, Endung und Ordner.");
    add(opts.sev || "error", pos, "Die Datei „" + target + "“ gibt es im Projekt nicht.", tipp);
  }
  function relPath(from, to) {
    var a = dirOf(from).split("/").filter(Boolean), b = to.split("/");
    var file = b.pop(), i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) i++;
    var up = a.slice(i).map(function () { return ".."; });
    return up.concat(b.slice(i)).concat([file]).join("/");
  }

  /* ---------- HTML zerlegen ---------- */
  function tokenizeHtml(src) {
    var toks = [], i = 0, n = src.length;
    while (i < n) {
      var lt = src.indexOf("<", i);
      if (lt < 0) { toks.push({ t: "text", s: i, e: n }); break; }
      if (lt > i) toks.push({ t: "text", s: i, e: lt });
      i = lt;
      if (src.startsWith("<!--", i)) {
        var ce = src.indexOf("-->", i + 4);
        if (ce < 0) { toks.push({ t: "comment", s: i, e: n, open: true }); break; }
        toks.push({ t: "comment", s: i, e: ce + 3 }); i = ce + 3; continue;
      }
      if (/^<[!?][a-zA-Z]/.test(src.substr(i, 3))) {
        var de = src.indexOf(">", i); if (de < 0) de = n - 1;
        toks.push({ t: "doctype", s: i, e: de + 1 }); i = de + 1; continue;
      }
      var m = /^<(\/?)([a-zA-Z][a-zA-Z0-9:._-]*)/.exec(src.slice(i, i + 100));
      if (!m) { toks.push({ t: "text", s: i, e: i + 1, lt: true }); i++; continue; }
      var tok = { t: "tag", close: m[1] === "/", name: m[2], lname: m[2].toLowerCase(), s: i, ns: i + 1 + m[1].length, attrs: [], selfClose: false, unterminated: false };
      var j = i + m[0].length;
      for (;;) {
        while (j < n && /\s/.test(src[j])) j++;
        if (j >= n) { tok.unterminated = true; break; }
        var c = src[j];
        if (c === ">") { j++; break; }
        if (c === "/" && src[j + 1] === ">") { tok.selfClose = true; j += 2; break; }
        if (c === "<") { tok.unterminated = true; break; }
        if (c === "/") { j++; continue; }
        var as = j;
        while (j < n && !/[\s=>\/<]/.test(src[j])) j++;
        if (j === as) { j++; continue; }
        var a = { name: src.slice(as, j), s: as, value: null, vs: -1, q: "" };
        a.lname = a.name.toLowerCase();
        var k = j;
        while (k < n && /\s/.test(src[k])) k++;
        if (src[k] === "=") {
          k++;
          while (k < n && /\s/.test(src[k])) k++;
          var q = src[k];
          if (q === "\"" || q === "'") {
            var qe = src.indexOf(q, k + 1);
            if (qe < 0) { a.value = src.slice(k + 1); a.vs = k + 1; a.q = q; a.unclosed = true; tok.attrs.push(a); j = n; tok.unterminated = true; break; }
            a.value = src.slice(k + 1, qe); a.vs = k + 1; a.q = q; j = qe + 1;
          } else {
            var vs = k;
            while (k < n && !/[\s>]/.test(src[k])) k++;
            a.value = src.slice(vs, k); a.vs = vs; j = k;
          }
        }
        tok.attrs.push(a);
      }
      tok.e = j;
      toks.push(tok);
      i = j;
      if (!tok.close && RAW[tok.lname] && !tok.selfClose && !tok.unterminated) {
        var re = new RegExp("</" + tok.lname + "[\\s>/]", "ig");
        re.lastIndex = i;
        var rm = re.exec(src);
        var end = rm ? rm.index : n;
        if (end > i) toks.push({ t: "raw", name: tok.lname, s: i, e: end, attrs: tok.attrs });
        i = end;
      }
    }
    return toks;
  }

  /* ---------- HTML prüfen ---------- */
  function lintHtml(src, ctx) {
    var diags = [], toks = tokenizeHtml(src), path = (ctx && ctx.path) || "index.html", lc = lineTable(src);
    function lineOf(pos) { return lc(pos).line; }
    function cssCtx() { return { path: path, exists: ctx && ctx.exists, findCase: ctx && ctx.findCase, findName: ctx && ctx.findName }; }
    function add(sev, pos, msg, hint) { diags.push({ sev: sev, pos: pos, msg: msg, hint: hint || "" }); }
    var stack = [], ids = Object.create(null), anchors = [], seen = { doctype: false, html: null, charset: false, title: false, docLike: false, firstContent: null };
    var lastImplicitP = -1;
    function top() { return stack[stack.length - 1]; }
    function inForeign() { for (var i = stack.length - 1; i >= 0; i--) if (stack[i].lname === "svg" || stack[i].lname === "math") return true; return false; }
    function popTo(idx, closer, pos) {
      while (stack.length > idx + 1) {
        var el = stack.pop();
        if (!OPTIONAL_END[el.lname]) add("error", el.s, "<" + el.name + "> wurde nicht geschlossen.", closer ? "Vor </" + closer + "> fehlt noch </" + el.name + ">." : "");
      }
      stack.pop();
    }

    toks.forEach(function (tok) {
      if (tok.t === "comment") {
        if (tok.open) add("error", tok.s, "Kommentar <!-- wird nicht mit --> geschlossen.", "Alles danach ist bis zum Ende der Datei auskommentiert.");
        return;
      }
      if (tok.t === "text") {
        if (seen.firstContent === null && src.slice(tok.s, tok.e).trim()) seen.firstContent = tok.s;
        return;
      }
      if (tok.t === "doctype") {
        if (/^<!doctype/i.test(src.slice(tok.s, tok.s + 9))) {
          seen.doctype = true; seen.docLike = true;
          if (seen.firstContent !== null) add("error", tok.s, "<!DOCTYPE html> muss ganz am Anfang der Datei stehen.");
          else if (!/^<!doctype\s+html\s*>$/i.test(src.slice(tok.s, tok.e))) add("hint", tok.s, "Für HTML5 genügt <!DOCTYPE html>.");
        }
        return;
      }
      if (tok.t === "raw") {
        if (tok.name === "style") lintCss(src.slice(tok.s, tok.e), cssCtx(), tok.s, diags, { lineOf: lineOf });
        if (tok.name === "title" && src.slice(tok.s, tok.e).trim()) seen.title = true;
        return;
      }
      if (seen.firstContent === null) seen.firstContent = tok.s;
      var name = tok.lname, foreign = inForeign();
      if (tok.unterminated) add("error", tok.s, "Beim Tag <" + tok.name + " fehlt das schließende >.", tok.attrs.some(function (a) { return a.unclosed; }) ? "Ein Anführungszeichen wird nicht geschlossen." : "");

      if (tok.close) {
        if (VOID[name] && !foreign) { add("error", tok.s, "</" + tok.name + "> gibt es nicht.", "<" + name + "> ist ein leeres Element und hat kein End-Tag."); return; }
        var idx = -1;
        for (var i = stack.length - 1; i >= 0; i--) {
          if (foreign ? stack[i].name === tok.name || stack[i].lname === name : stack[i].lname === name) { idx = i; break; }
        }
        if (idx < 0) {
          if (name === "p" && lastImplicitP >= 0) add("error", tok.s, "</p> hat kein offenes <p> mehr.", "Ein <p> darf keine Blockelemente wie <div>, <ul> oder <h1> enthalten. Der Browser beendet den Absatz davor automatisch – nimm <div> statt <p> oder schließe den Absatz vorher.");
          else add("error", tok.s, "</" + tok.name + "> schließt nichts – es gibt kein offenes <" + tok.name + ">.", "Ist es ein Tippfehler, oder wurde das Element schon geschlossen?");
          return;
        }
        popTo(idx, tok.name, tok.s);
        return;
      }

      // Start-Tag
      if (name === "html" || name === "head" || name === "body") seen.docLike = true;
      if (!foreign) {
        if (OBSOLETE[name]) add("error", tok.s, "<" + tok.name + "> ist veraltet und gehört nicht mehr zu HTML.", OBSOLETE_TIPP[name] || "Für das Aussehen ist CSS zuständig.");
        else if (!ELEMENTS[name] && name.indexOf("-") < 0) {
          var sug = closest(name, ELEMENTS);
          add("error", tok.s, "Unbekanntes Element <" + tok.name + ">.", sug ? "Meintest du <" + sug + ">?" : "");
        }
        if (tok.name !== name && ELEMENTS[name]) add("hint", tok.s, "Elementnamen schreibt man klein: <" + name + ">.");
        // Elemente, die ein offenes Element automatisch beenden
        var t = top();
        if (t && t.lname === "p" && P_CLOSERS[name]) { stack.pop(); lastImplicitP = tok.s; }
        else if (t) {
          if (name === "li" && t.lname === "li") stack.pop();
          else if ((name === "dt" || name === "dd") && (t.lname === "dt" || t.lname === "dd")) stack.pop();
          else if (name === "option" && t.lname === "option") stack.pop();
          else if ((name === "td" || name === "th") && (t.lname === "td" || t.lname === "th")) stack.pop();
          else if (name === "tr") { while (top() && /^(td|th|tr)$/.test(top().lname)) stack.pop(); }
          else if (/^(thead|tbody|tfoot)$/.test(name)) { while (top() && /^(td|th|tr|thead|tbody|tfoot)$/.test(top().lname)) stack.pop(); }
        }
      }

      // Attribute
      var have = Object.create(null);
      tok.attrs.forEach(function (a) {
        if (have[a.lname]) add("error", a.s, "Das Attribut " + a.name + " steht doppelt in <" + tok.name + ">.");
        have[a.lname] = a;
        if (a.value !== null && a.q && a.value.indexOf("\n") >= 0 && /<\/?[a-z]/i.test(a.value)) add("error", a.s, "Beim Attribut " + a.name + " fehlt vermutlich das schließende Anführungszeichen.");
        if (a.value !== null && !a.q && /["']/.test(a.value)) add("warning", a.vs, "Merkwürdiger Wert bei " + a.name + ": " + a.value, "Prüfe die Anführungszeichen.");
        if (/^on[a-z]+$/.test(a.lname) || a.lname === "style") {
          if (a.lname === "style" && a.value) lintCss(a.value, cssCtx(), a.vs, diags, { inline: true, lineOf: lineOf });
        }
      });
      if (have.id) {
        var idv = have.id.value || "";
        if (!idv) add("error", have.id.s, "Das Attribut id ist leer.");
        else if (/\s/.test(idv)) add("error", have.id.vs, "Eine id darf keine Leerzeichen enthalten: „" + idv + "“.", "Für mehrere Namen gibt es class=\"…\".");
        else if (ids[idv] !== undefined) add("error", have.id.vs, "Die id „" + idv + "“ gibt es schon (Zeile " + lineOf(ids[idv]) + ").", "Eine id darf auf einer Seite nur einmal vorkommen. Für mehrere Elemente: class.");
        else ids[idv] = have.id.vs;
      }
      if (!foreign) {
        if (name === "html") seen.html = tok;
        if (name === "meta" && (have.charset || (have["http-equiv"] && /content-type/i.test(have["http-equiv"].value || "")))) seen.charset = true;
        if (name === "img") {
          if (!have.alt) add("error", tok.s, "Bei <img> fehlt das Attribut alt.", "alt beschreibt das Bild für Screenreader und wenn es nicht lädt, z. B. alt=\"Hund im Park\". Für reine Deko-Bilder: alt=\"\".");
          if (!have.src) add("error", tok.s, "Bei <img> fehlt das Attribut src.");
        }
        if (name === "a" && have.href && (have.href.value || "").trim() === "") add("hint", have.href.s, "Der Link hat ein leeres href.");
        var refs = { href: /^(a|link|area)$/, src: /^(img|script|iframe|source|audio|video|embed|track|input)$/, poster: /^video$/, data: /^object$/ };
        Object.keys(refs).forEach(function (an) {
          if (!have[an] || have[an].value === null || !refs[an].test(name)) return;
          var val = have[an].value;
          if (an === "href" && val.trim()[0] === "#") { if (val.trim().length > 1) anchors.push({ id: decodeSafe(val.trim().slice(1)), pos: have[an].vs }); return; }
          checkRef(val, path, ctx, add, have[an].vs, { link: name === "a", sev: name === "a" || name === "area" ? "warning" : "error" });
        });
        if (name === "link" && have.rel && /stylesheet/i.test(have.rel.value || "") && !have.href) add("error", tok.s, "Bei <link rel=\"stylesheet\"> fehlt href mit dem Pfad zur CSS-Datei.");
        if (name === "script" && have.src && tok.selfClose) add("error", tok.s, "<script … /> funktioniert in HTML nicht.", "Schreibe <script src=\"…\"></script>.");
      }

      if (tok.selfClose && !VOID[name] && !foreign) {
        add("warning", tok.s, "<" + tok.name + " /> ist in HTML kein leeres Element.", "Der Browser ignoriert den Schrägstrich und erwartet später </" + tok.name + ">.");
      }
      if ((VOID[name] && !foreign) || (tok.selfClose && foreign)) return;
      if (tok.unterminated) return;
      stack.push({ name: tok.name, lname: name, s: tok.s });
    });

    stack.forEach(function (el) {
      if (!OPTIONAL_END[el.lname]) add("error", el.s, "<" + el.name + "> wird bis zum Dateiende nicht geschlossen.", "Es fehlt </" + el.name + ">.");
    });
    anchors.forEach(function (a) {
      if (ids[a.id] === undefined) add("warning", a.pos, "Auf dieser Seite gibt es kein Element mit id=\"" + a.id + "\".", "Der Link #" + a.id + " springt deshalb nirgendwohin.");
    });

    if (seen.docLike || seen.doctype) {
      if (!seen.doctype) add("error", 0, "<!DOCTYPE html> fehlt in der ersten Zeile.", "Ohne Doctype stellt der Browser die Seite im veralteten „Quirks-Modus“ dar.");
      if (!seen.html || !seen.html.attrs.some(function (a) { return a.lname === "lang" && a.value; })) add("warning", seen.html ? seen.html.s : 0, "Die Sprache der Seite fehlt.", "Schreibe <html lang=\"de\">.");
      if (!seen.charset) add("warning", 0, "<meta charset=\"utf-8\"> fehlt im <head>.", "Sonst können Umlaute falsch angezeigt werden.");
      if (!seen.title) add("error", 0, "Die Seite hat keinen <title> im <head>.", "Der Titel steht im Browser-Tab und in Suchergebnissen.");
    }
    return finish(src, diags);
  }
  function decodeSafe(s) { try { return decodeURIComponent(s); } catch (e) { return s; } }

  /* ---------- CSS prüfen ---------- */
  function maskCss(src, add, off) {
    // Kommentare (in beiden Fassungen) und Inhalte von Zeichenketten (nur in "s") ausblenden; Längen bleiben gleich.
    var raw = "", s = "", i = 0, n = src.length;
    function blank(t) { return t.replace(/[^\n]/g, " "); }
    while (i < n) {
      var c = src[i];
      if (c === "/" && src[i + 1] === "*") {
        var e = src.indexOf("*/", i + 2);
        if (e < 0) { add("error", off + i, "Der Kommentar /* wird nicht mit */ geschlossen.", "Alles danach zählt bis zum Ende als Kommentar."); e = n; } else e += 2;
        var b = blank(src.slice(i, e)); raw += b; s += b; i = e; continue;
      }
      if (c === "\"" || c === "'") {
        var j = i + 1;
        while (j < n && src[j] !== c && src[j] !== "\n") { if (src[j] === "\\") j++; j++; }
        if (j >= n || src[j] === "\n") add("error", off + i, "Die Zeichenkette mit " + c + " wird nicht geschlossen.");
        var end = Math.min(j + 1, n), str = src.slice(i, end);
        raw += str; s += c + "x".repeat(Math.max(0, str.length - 2)) + (str.length > 1 ? str[str.length - 1] : "");
        i = end; continue;
      }
      raw += c; s += c; i++;
    }
    return { raw: raw, s: s };
  }

  function lintCss(src, ctx, off, diags, opts) {
    off = off || 0; opts = opts || {};
    var own = !diags; diags = diags || [];
    var path = (ctx && ctx.path) || "style.css", cssFile = /\.css$/i.test(path);
    function add(sev, pos, msg, hint) { diags.push({ sev: sev, pos: pos, msg: msg, hint: hint || "" }); }
    var mk = maskCss(src, add, off), s = mk.s, raw = mk.raw;
    var lineOf = opts.lineOf || (function () { var t = lineTable(src); return function (p) { return t(p - off).line; }; })();
    var stack = [opts.inline ? { type: "decls", props: {}, n: 0, s: 0, inline: true } : { type: "top" }];
    var bs = 0;
    function cur() { return stack[stack.length - 1]; }
    function lead(a) { while (a < s.length && /\s/.test(s[a])) a++; return a; }

    function checkSelector(sel, pos) {
      if (/,\s*$/.test(sel)) add("error", off + pos, "Der Selektor „" + sel.trim() + "“ endet mit einem Komma.");
      if (/^\s*,/.test(sel)) add("error", off + pos, "Der Selektor beginnt mit einem Komma.");
      var plain = sel.replace(/\[[^\]]*\]/g, " ").replace(/x+/g, "x");
      var re = /(^|[\s>+~,(])([a-zA-Z][a-zA-Z0-9-]*)(?=$|[\s>+~,.#:\[)])/g, m;
      while ((m = re.exec(plain))) {
        var el = m[2].toLowerCase();
        if (ELEMENTS[el] || el.indexOf("-") >= 0 || /^(from|to|svg|g|path|circle|rect|line|polygon|polyline|ellipse|text|tspan|use|defs|symbol|mask|marker|stop)$/.test(el)) continue;
        // Ist das Wort direkt nach ":" (Pseudo-Klasse)? Dann ignorieren.
        var before = plain.slice(0, m.index + m[1].length);
        if (/[:]$/.test(before) || /:[\w-]*\($/.test(before) && /^(nth|lang|dir)/.test((before.match(/:([\w-]*)\($/) || [])[1] || "")) continue;
        var sug = closest(el, ELEMENTS);
        add("warning", off + pos + m.index + m[1].length, "Es gibt kein HTML-Element <" + m[2] + ">.",
          (sug ? "Meintest du " + sug + "? " : "") + "Für Klassen schreibt man einen Punkt davor (." + m[2] + "), für IDs eine Raute (#" + m[2] + ").");
      }
    }

    function checkDecl(a, b) {
      var text = raw.slice(a, b), ts = lead(a);
      if (!text.trim()) return;
      var c = cur();
      var colon = text.indexOf(":");
      if (colon < 0) {
        var w = text.trim();
        if (/^[a-z-]+\s+[a-z#0-9]/i.test(w)) add("error", off + ts, "Bei „" + w.split("\n")[0] + "“ fehlt der Doppelpunkt.", "Schreibweise: eigenschaft: wert;");
        else add("error", off + ts, "„" + w.split("\n")[0] + "“ ist keine gültige Angabe.", "Schreibweise: eigenschaft: wert;");
        return;
      }
      var propRaw = text.slice(0, colon), prop = propRaw.trim(), lp = prop.toLowerCase();
      var vStart = a + colon + 1, value = text.slice(colon + 1), v = value.trim();
      if (!prop) { add("error", off + ts, "Vor dem Doppelpunkt fehlt die Eigenschaft."); return; }
      if (/\s/.test(prop)) {
        if (/\n/.test(prop)) add("error", off + ts, "Vermutlich fehlt ein Semikolon ; am Ende der Zeile.", "Jede Angabe endet mit ;");
        else add("error", off + ts, "„" + prop + "“: Eigenschaften enthalten keine Leerzeichen.", "Meintest du " + prop.replace(/\s+/g, "-").toLowerCase() + "?");
        return;
      }
      if (/^--/.test(prop)) { c.n++; return; }
      c.n++;
      var known = PROPS[lp] || /^-(webkit|moz|ms|o)-/.test(lp);
      if (!known) {
        var sug = closest(lp, PROPS);
        add("error", off + ts, "Die Eigenschaft „" + prop + "“ gibt es nicht.", sug ? "Meintest du " + sug + "?" : "");
      }
      var nl = /\n[ \t]*[a-zA-Z-]+[ \t]*:(?!:)/.exec(value.replace(/url\([^)]*\)/g, function (u) { return u.replace(/[^\n]/g, " "); }));
      if (nl && !/^(grid-template|grid-template-areas|grid)$/.test(lp)) {
        var lineEnd = vStart + value.indexOf("\n");
        add("error", off + lineEnd, "Am Ende dieser Zeile fehlt das Semikolon ;", "Ohne ; wird die nächste Zeile als Teil des Werts von „" + prop + "“ gelesen und beide Angaben gelten nicht.");
        return;
      }
      if (!v) { add("error", off + ts, "Bei „" + prop + "“ fehlt der Wert."); return; }
      if (c.props[lp] && !c.inline && known) add("hint", off + ts, "„" + prop + "“ steht in dieser Regel doppelt.", "Die erste steht in Zeile " + lineOf(c.props[lp]) + ". Es gilt nur die letzte Angabe.");
      if (!c.props[lp]) c.props[lp] = off + ts;
      var vs = vStart + (value.length - value.replace(/^\s+/, "").length);
      var lv = v.replace(/!\s*important\s*$/i, "").trim().toLowerCase();
      // Farben
      var hm, hre = /#([^\s,;)\/]*)/g;
      while ((hm = hre.exec(v))) {
        if (!/^[0-9a-f]+$/i.test(hm[1]) || [3, 4, 6, 8].indexOf(hm[1].length) < 0)
          add("error", off + vs + hm.index, "„#" + hm[1] + "“ ist keine gültige Farbe.", "Hex-Farben haben 3 oder 6 Stellen aus 0–9 und a–f, z. B. #ff8800.");
      }
      if (COLOR_PROPS[lp] && /^[a-z]+$/.test(lv) && !COLORS[lv]) {
        var cs = closest(lv, COLORS);
        add("error", off + vs, "„" + v + "“ ist keine Farbe.", cs ? "Meintest du " + cs + "?" : "Farben z. B. als Name (red), Hex (#ff0000) oder rgb(255, 0, 0).");
      }
      // Einheiten
      var su = /(^|[\s(,])(-?\d*\.?\d+)\s+(px|em|rem|%|vh|vw|vmin|vmax|pt|cm|mm|ch|fr|s|ms|deg)\b/i.exec(lv);
      if (su) add("error", off + vs, "Zwischen Zahl und Einheit darf kein Leerzeichen stehen: „" + su[2] + su[3] + "“.");
      else if (LENGTH_PROPS[lp] && !/\(/.test(lv)) {
        var parts = lv.split(/\s+/);
        for (var k = 0; k < parts.length; k++) {
          if (/^-?\d*\.?\d+$/.test(parts[k]) && parseFloat(parts[k]) !== 0) {
            add("error", off + vs, "Bei „" + parts[k] + "“ fehlt die Einheit.", "Z. B. " + parts[k] + "px. Nur bei 0 darf die Einheit fehlen.");
            break;
          }
        }
      }
      // Dateien in url()
      var um, ure = /url\(\s*(["']?)([^"')]*)\1\s*\)/gi;
      while ((um = ure.exec(value))) checkRef(um[2], path, ctx, add, off + vStart + um.index, { cssFile: cssFile });
    }

    for (var i = 0; i < s.length; i++) {
      var ch = s[i];
      if (ch === "{") {
        var pre = s.slice(bs, i), prePos = lead(bs), p = pre.trim(), c = cur();
        if (c.type === "decls" && c.inline) { add("error", off + i, "Im style-Attribut sind keine { } erlaubt."); bs = i + 1; continue; }
        if (p[0] === "@") {
          var an = (/^@([\w-]+)/.exec(p) || [])[1] || "";
          an = an.toLowerCase();
          if (NESTING_AT[an]) stack.push({ type: "rules", s: i });
          else if (/keyframes$/.test(an)) stack.push({ type: "keyframes", s: i });
          else { if (!DECL_AT[an]) add("warning", off + prePos, "Unbekannte @-Regel „@" + an + "“."); stack.push({ type: "decls", props: {}, n: 0, s: i }); }
        } else {
          if (!p) add("error", off + i, "Vor { fehlt der Selektor.", "Z. B. p { … } oder .klasse { … }");
          else if (c.type !== "keyframes") checkSelector(pre.replace(/^\s+/, ""), prePos);
          stack.push({ type: "decls", props: {}, n: 0, s: i, sel: p });
        }
        bs = i + 1;
      } else if (ch === ";") {
        var c2 = cur();
        if (c2.type === "decls") checkDecl(bs, i);
        else {
          var st = s.slice(bs, i).trim(), sp = lead(bs);
          if (st[0] === "@") {
            var sn = ((/^@([\w-]+)/.exec(st) || [])[1] || "").toLowerCase();
            if (!STATEMENT_AT[sn]) add("warning", off + sp, "Unbekannte @-Regel „@" + sn + "“.");
            if (sn === "import") {
              var im = /^@import\s+(?:url\(\s*)?(["']?)([^"')\s]+)\1/i.exec(raw.slice(bs, i).trim());
              if (im) checkRef(im[2], path, ctx, add, off + sp, { cssFile: cssFile });
            }
          } else if (st) add("error", off + sp, "„" + st.split("\n")[0] + "“ steht außerhalb einer Regel.", "Angaben gehören in geschweifte Klammern: selektor { eigenschaft: wert; }");
        }
        bs = i + 1;
      } else if (ch === "}") {
        var c3 = cur();
        if (c3.type === "top" || c3.inline) { add("error", off + i, "Diese } schließt nichts.", "Zu jeder { gehört genau eine }."); bs = i + 1; continue; }
        if (c3.type === "decls") {
          checkDecl(bs, i);
          if (!c3.n && c3.sel) add("hint", off + c3.s, "Die Regel für „" + c3.sel.replace(/\s+/g, " ") + "“ ist leer.");
        } else {
          var left = s.slice(bs, i).trim();
          if (left) add("error", off + lead(bs), "„" + left.split("\n")[0] + "“: hier fehlt eine {.");
        }
        stack.pop();
        bs = i + 1;
      }
    }
    var rest = s.slice(bs).trim(), last = cur();
    if (last.type === "decls" && last.inline) checkDecl(bs, s.length);
    else if (rest) {
      if (last.type === "decls") checkDecl(bs, s.length);
      else add("error", off + lead(bs), "„" + rest.split("\n")[0] + "“: die Regel ist unvollständig.", "Es fehlt { … }.");
    }
    for (var d = stack.length - 1; d > 0; d--) {
      if (stack[d].inline) continue;
      add("error", off + stack[d].s, "Diese { wird nicht mit } geschlossen.", "Zu jeder { gehört genau eine }.");
    }
    return own ? finish(src, diags) : diags;
  }

  function finish(src, diags) {
    var lc = lineTable(src), order = { error: 0, warning: 1, hint: 2 };
    var seen = {};
    return diags.map(function (d) {
      var p = lc(Math.max(0, Math.min(d.pos, src.length)));
      return { sev: d.sev, line: p.line, col: p.col, msg: d.msg, hint: d.hint };
    }).filter(function (d) {
      var k = d.line + "|" + d.msg; if (seen[k]) return false; seen[k] = true; return true;
    }).sort(function (a, b) { return a.line - b.line || order[a.sev] - order[b.sev] || a.col - b.col; });
  }

  /* ---------- Hervorhebung ---------- */
  function span(cls, text) { return text ? (cls ? '<span class="' + cls + '">' + esc(text) + "</span>" : esc(text)) : ""; }

  function hlHtml(code) {
    var out = "", toks = tokenizeHtml(code), last = 0;
    toks.forEach(function (tok) {
      if (tok.s > last) out += esc(code.slice(last, tok.s));
      var t = code.slice(tok.s, tok.e);
      if (tok.t === "comment") out += span("t-com", t);
      else if (tok.t === "doctype") out += span("t-doc", t);
      else if (tok.t === "text") out += tok.lt ? esc(t) : esc(t).replace(/&amp;(#?\w+;)/g, '<span class="t-ent">&amp;$1</span>');
      else if (tok.t === "raw") {
        if (tok.name === "style") out += hlCss(t);
        else if (tok.name === "script") {
          var typ = (tok.attrs.filter(function (a) { return a.lname === "type"; })[0] || {}).value || "";
          out += /json|template|html/i.test(typ) ? esc(t) : hlJs(t);
        } else out += esc(t);
      } else if (tok.t === "tag") {
        var ranges = [{ s: tok.s, e: tok.ns, c: "t-punc" }, { s: tok.ns, e: tok.ns + tok.name.length, c: "t-tag" }];
        tok.attrs.forEach(function (a) {
          ranges.push({ s: a.s, e: a.s + a.name.length, c: "t-attr" });
          if (a.vs >= 0) ranges.push({ s: a.q ? a.vs - 1 : a.vs, e: Math.min(tok.e, a.vs + a.value.length + (a.q && !a.unclosed ? 1 : 0)), c: "t-str" });
        });
        var p = tok.s;
        ranges.forEach(function (r) {
          if (r.s > p) out += span("t-punc", code.slice(p, r.s));
          out += span(r.c, code.slice(r.s, r.e));
          p = r.e;
        });
        if (tok.e > p) out += span("t-punc", code.slice(p, tok.e));
      }
      last = tok.e;
    });
    if (last < code.length) out += esc(code.slice(last));
    return out;
  }

  var CSSTOK = /(\/\*[\s\S]*?(?:\*\/|$))|("(?:[^"\\\n]|\\.)*"?|'(?:[^'\\\n]|\\.)*'?)|(@[\w-]+)|([{}:;,()])|(#[\w-]+)|(\.-?[a-zA-Z_][\w-]*)|((?:\d+\.?\d*|\.\d+)(?:[a-zA-Z%]+)?)|(!\s*important)|(--[\w-]+|-?[a-zA-Z_][\w-]*)/g;
  function hlCss(code) {
    var out = "", last = 0, m, stack = ["sel"], mode = "sel", afterColon = false, preludeAt = "";
    CSSTOK.lastIndex = 0;
    while ((m = CSSTOK.exec(code))) {
      out += esc(code.slice(last, m.index));
      var t = m[0], cls = "";
      if (m[1]) cls = "t-com";
      else if (m[2]) cls = "t-str";
      else if (m[3]) { cls = "t-at"; if (mode === "sel") preludeAt = t.slice(1).toLowerCase(); }
      else if (m[4]) {
        if (t === "{") {
          var inner = preludeAt && (NESTING_AT[preludeAt] || /keyframes$/.test(preludeAt)) ? "sel" : "prop";
          if (mode !== "sel" && !preludeAt) inner = "prop";
          stack.push(inner); mode = inner; preludeAt = ""; afterColon = false;
        } else if (t === "}") { stack.pop(); if (!stack.length) stack = ["sel"]; mode = stack[stack.length - 1]; preludeAt = ""; afterColon = false; }
        else if (t === ";") { if (mode === "val") mode = "prop"; preludeAt = ""; }
        else if (t === ":") { if (mode === "prop") mode = "val"; else if (mode === "sel" && !preludeAt) afterColon = true; }
        else if (t === "," && mode === "sel") afterColon = false;
        cls = "t-punc";
      }
      else if (m[5]) cls = mode === "val" ? "t-num" : (mode === "sel" ? "t-id" : "");
      else if (m[6]) cls = mode === "sel" ? "t-cls" : "";
      else if (m[7]) cls = "t-num";
      else if (m[8]) cls = "t-kw";
      else if (m[9]) {
        if (mode === "prop") {
          // In Verschachtelungen steht hier evtl. ein Selektor – dann bleibt es "prop"-Farbe, das ist ok.
          cls = "t-prop";
        } else if (mode === "val") cls = code[CSSTOK.lastIndex] === "(" ? "t-fn" : "t-val";
        else {
          if (afterColon) { cls = "t-pseudo"; afterColon = false; }
          else if (preludeAt) cls = code[CSSTOK.lastIndex] === "(" ? "t-fn" : "t-val";
          else cls = "t-sel";
        }
      }
      if (m[4] && t === ":" && mode === "sel" && !preludeAt) cls = "t-pseudo";
      out += span(cls, t);
      last = CSSTOK.lastIndex;
    }
    out += esc(code.slice(last));
    return out;
  }

  var JS_KW = set("break case catch class const continue debugger default delete do else export extends finally for function if import in " +
    "instanceof let new of return static super switch this throw try typeof var void while with yield async await");
  var JS_LIT = set("true false null undefined NaN Infinity");
  var JSTOK = /(\/\/[^\n]*)|(\/\*[\s\S]*?(?:\*\/|$))|("(?:[^"\\\n]|\\.)*"?|'(?:[^'\\\n]|\\.)*'?|`(?:[^`\\]|\\[\s\S])*`?)|(\b(?:0[xXbBoO][0-9a-fA-F_]+|\d[\d_]*\.?\d*(?:[eE][+-]?\d+)?|\.\d+)n?\b)|([A-Za-z_$][\w$]*)/g;
  function hlJs(code) {
    var out = "", last = 0, m;
    JSTOK.lastIndex = 0;
    while ((m = JSTOK.exec(code))) {
      out += esc(code.slice(last, m.index));
      var t = m[0], cls = "";
      if (m[1] || m[2]) cls = "t-com";
      else if (m[3]) cls = "t-str";
      else if (m[4]) cls = "t-num";
      else if (m[5]) {
        if (JS_KW[t]) cls = "t-kw";
        else if (JS_LIT[t]) cls = "t-num";
        else if (/^\s*\(/.test(code.slice(JSTOK.lastIndex, JSTOK.lastIndex + 10))) cls = "t-fn";
        else if (/^[A-Z]/.test(t)) cls = "t-ty";
      }
      out += span(cls, t);
      last = JSTOK.lastIndex;
    }
    return out + esc(code.slice(last));
  }

  function langOf(path) {
    var ext = ((/\.([a-z0-9]+)$/i.exec(path || "") || [])[1] || "").toLowerCase();
    if (ext === "html" || ext === "htm" || ext === "svg" || ext === "xml") return "html";
    if (ext === "css") return "css";
    if (ext === "js" || ext === "mjs" || ext === "json") return "js";
    return "text";
  }

  // Offene Elemente am Ende von code (für die automatische Ergänzung von </…>)
  function openStack(code) {
    var stack = [];
    tokenizeHtml(code).forEach(function (tok) {
      if (tok.t !== "tag" || tok.unterminated) return;
      if (tok.close) {
        for (var i = stack.length - 1; i >= 0; i--) if (stack[i] === tok.lname) { stack.length = i; break; }
        return;
      }
      if (VOID[tok.lname] || tok.selfClose) return;
      var t = stack[stack.length - 1];
      if (t === "p" && P_CLOSERS[tok.lname]) stack.pop();
      else if (t === tok.lname && /^(li|option|td|th|tr|dt|dd)$/.test(t)) stack.pop();
      stack.push(tok.lname);
    });
    return stack;
  }

  return {
    highlight: function (lang, code) {
      if (lang === "html") return hlHtml(code);
      if (lang === "css") return hlCss(code);
      if (lang === "js") return hlJs(code);
      return esc(code);
    },
    lint: function (lang, code, ctx) {
      try {
        if (lang === "html" && !/\.(svg|xml)$/i.test(ctx && ctx.path || "")) return lintHtml(code, ctx);
        if (lang === "css") return lintCss(code, ctx, 0, null, {});
      } catch (e) {
        if (typeof console !== "undefined") console.error(e);
      }
      return [];
    },
    langOf: langOf,
    openStack: openStack,
    relPath: relPath,
    dirOf: dirOf,
    ELEMENTS: ELEMENTS,
    VOID: VOID
  };
})();
