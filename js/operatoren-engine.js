/* ==========================================================
   operatoren-engine.js – Parser, Auswertung (auch Schritt für Schritt)
   und Aufgabengeneratoren für operatoren.html.
   Sprachen: "py" (Python) und "c" (C).
   ========================================================== */

(function (global) {
  "use strict";

  /* ---------- Knoten-Bausteine ---------- */
  var V = function (n) { return { t: "var", n: n }; };
  var N = function (v) { return { t: "val", v: v }; };
  var C = function (op, l, r) { return { t: "bin", op: op, l: l, r: r }; };
  var AND = function (l, r) { return { t: "bin", op: "and", l: l, r: r }; };
  var OR = function (l, r) { return { t: "bin", op: "or", l: l, r: r }; };
  var NOT = function (e) { return { t: "un", op: "not", e: e }; };
  var P = function (e) { return { t: "paren", e: e }; };

  var CMP = ["==", "!=", "<", "<=", ">", ">="];
  var ARITH = ["+", "-", "*", "%"];
  var isCmp = function (op) { return CMP.indexOf(op) >= 0; };

  function EngineError(msg) { this.message = msg; }

  /* ---------- Werte ---------- */
  function num(v) { return typeof v === "boolean" ? (v ? 1 : 0) : v; }
  function truthy(v, L) {
    if (L === "py") return v === true || (typeof v === "number" && v !== 0);
    return num(v) !== 0;
  }
  function boolOut(b, L) { return L === "py" ? !!b : (b ? 1 : 0); }
  function fmt(v, L) {
    if (typeof v === "boolean") return L === "py" ? (v ? "True" : "False") : (v ? "1" : "0");
    return String(v);
  }
  function wahr(v, L) { return truthy(v, L) ? "wahr" : "falsch"; }

  function applyOp(op, a, b, L) {
    var x = num(a), y = num(b);
    switch (op) {
      case "+": return x + y;
      case "-": return x - y;
      case "*": return x * y;
      case "%":
        if (y === 0) throw new EngineError(L === "py"
          ? "ZeroDivisionError: Rest bei Division durch 0 (x % 0) ist nicht erlaubt."
          : "Division durch 0 (x % 0): Das Programm stürzt ab (undefiniertes Verhalten).");
        // Python: Vorzeichen folgt dem Divisor, C: Vorzeichen folgt dem Dividenden
        return L === "py" ? x - y * Math.floor(x / y) : x % y;
      case "==": return boolOut(x === y, L);
      case "!=": return boolOut(x !== y, L);
      case "<": return boolOut(x < y, L);
      case "<=": return boolOut(x <= y, L);
      case ">": return boolOut(x > y, L);
      case ">=": return boolOut(x >= y, L);
    }
    throw new EngineError("Unbekannter Operator " + op);
  }

  /* ---------- Direkte Auswertung ---------- */
  function ev(n, env, L) {
    switch (n.t) {
      case "val": return n.v;
      case "var":
        if (!(n.n in env)) throw new EngineError("Unbekannte Variable: " + n.n);
        return env[n.n];
      case "paren": return ev(n.e, env, L);
      case "un":
        var v = ev(n.e, env, L);
        if (n.op === "not") return boolOut(!truthy(v, L), L);
        return -num(v);
      case "bin":
        if (n.op === "and" || n.op === "or") {
          var a = ev(n.l, env, L), at = truthy(a, L);
          if (n.op === "and" ? !at : at) return L === "py" ? a : boolOut(at, L);
          var b = ev(n.r, env, L);
          return L === "py" ? b : boolOut(truthy(b, L), L);
        }
        return applyOp(n.op, ev(n.l, env, L), ev(n.r, env, L), L);
      case "chain":
        var left = ev(n.es[0], env, L);
        for (var i = 0; i < n.ops.length; i++) {
          var right = ev(n.es[i + 1], env, L);
          if (!applyOp(n.ops[i], left, right, L)) return false;
          left = right;
        }
        return true;
    }
    throw new EngineError("Unbekannter Knoten");
  }

  /* ---------- Darstellung ---------- */
  var BIN_PREC = {
    py: { or: 1, and: 2, "==": 4, "!=": 4, "<": 4, "<=": 4, ">": 4, ">=": 4, "+": 5, "-": 5, "*": 6, "%": 6 },
    c: { or: 1, and: 2, "==": 3, "!=": 3, "<": 4, "<=": 4, ">": 4, ">=": 4, "+": 5, "-": 5, "*": 6, "%": 6 }
  };
  function prec(n, L) {
    if (n.t === "bin") return BIN_PREC[L][n.op];
    if (n.t === "chain") return 4;
    if (n.t === "un") return n.op === "not" && L === "py" ? 3 : 7;
    if (n.t === "val" && typeof n.v === "number" && n.v < 0) return 7; // wie unäres Minus
    return 9;
  }
  function opText(op, L) {
    if (op === "and") return L === "py" ? "and" : "&&";
    if (op === "or") return L === "py" ? "or" : "||";
    return op;
  }
  function esc(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  // html=true: escapen und markierte (hl) Teile in <mark> setzen
  function render(n, L, html) {
    function wrap(child, need) {
      var s = go(child);
      return prec(child, L) < need ? "(" + s + ")" : s;
    }
    function go(n) {
      var s;
      switch (n.t) {
        case "val": s = n.txt && L === n.txtLang ? n.txt : fmt(n.v, L); if (html) s = esc(s); break;
        case "var": s = n.n; break;
        case "paren": s = "(" + go(n.e) + ")"; break;
        case "raw": s = go(n.e); break; // Klammern bewusst weggelassen (Distraktor)
        case "un":
          var p = prec(n, L);
          var inner = wrap(n.e, p);
          if (n.op === "not") s = L === "py" ? "not " + inner : "!" + inner;
          else s = "-" + (inner.charAt(0) === "-" ? "(" + inner + ")" : inner);
          break;
        case "bin":
          var bp = prec(n, L);
          var pyCmp = L === "py" && isCmp(n.op);
          var l = wrap(n.l, pyCmp ? bp + 1 : bp);
          var r = wrap(n.r, bp + 1);
          var o = opText(n.op, L);
          s = l + " " + (html ? esc(o) : o) + " " + r;
          break;
        case "chain":
          s = wrap(n.es[0], 5);
          for (var i = 0; i < n.ops.length; i++) s += " " + (html ? esc(n.ops[i]) : n.ops[i]) + " " + wrap(n.es[i + 1], 5);
          break;
      }
      if (html && n.hl) s = "<mark>" + s + "</mark>";
      return s;
    }
    return go(n);
  }

  /* ---------- Tokenizer ---------- */
  function tokenize(src, L, vars) {
    var toks = [], i = 0;
    function err(msg) { throw new EngineError(msg); }
    while (i < src.length) {
      var ch = src[i], two = src.substr(i, 2);
      if (/\s/.test(ch)) { i++; continue; }
      if (/[0-9]/.test(ch)) {
        var j = i;
        while (j < src.length && /[0-9]/.test(src[j])) j++;
        if (src[j] === "." || src[j] === ",") err("Bitte nur ganze Zahlen verwenden (keine Kommazahlen).");
        toks.push({ k: "num", v: parseInt(src.slice(i, j), 10) });
        i = j; continue;
      }
      if (/[A-Za-z_äöüÄÖÜß]/.test(ch)) {
        var k = i;
        while (k < src.length && /[A-Za-z0-9_äöüÄÖÜß]/.test(src[k])) k++;
        var w = src.slice(i, k);
        i = k;
        if (L === "py") {
          if (w === "and" || w === "or" || w === "not") { toks.push({ k: "op", v: w }); continue; }
          if (w === "True" || w === "False") { toks.push({ k: "bool", v: w === "True", txt: w }); continue; }
          if (/^(AND|And|OR|Or|NOT|Not)$/.test(w)) err("Python unterscheidet Groß- und Kleinschreibung: schreib " + w.toLowerCase() + ".");
          if (/^(true|false|TRUE|FALSE)$/.test(w)) err("In Python heißen die Wahrheitswerte True und False – mit großem Anfangsbuchstaben.");
        } else {
          if (w === "true" || w === "false") { toks.push({ k: "bool", v: w === "true" ? 1 : 0, txt: w }); continue; }
          if (/^(and|AND|And)$/.test(w)) err("In C schreibt man && statt " + w + ".");
          if (/^(or|OR|Or)$/.test(w)) err("In C schreibt man || statt " + w + ".");
          if (/^(not|NOT|Not)$/.test(w)) err("In C schreibt man ! statt " + w + ".");
          if (w === "True" || w === "False") err("In C gibt es kein " + w + ". Wahr ist 1 (oder true mit #include <stdbool.h>).");
        }
        if (vars && vars.indexOf(w) < 0) err("Unbekannter Name „" + w + "“. Erlaubt sind die Variablen " + vars.join(", ") + ".");
        toks.push({ k: "id", v: w });
        continue;
      }
      if (two === "=<") err("„=<“ gibt es nicht – das Gleichheitszeichen kommt nach hinten: <=");
      if (two === "=>") err("„=>“ gibt es nicht – das Gleichheitszeichen kommt nach hinten: >=");
      if (two === "<>") err("„<>“ gibt es nicht – ungleich schreibt man !=");
      if (src.substr(i, 3) === "===") err("„===“ gibt es nur in JavaScript – hier heißt gleich: ==");
      if (two === "==" || two === "!=" || two === "<=" || two === ">=") { toks.push({ k: "op", v: two }); i += 2; continue; }
      if (two === "&&" || two === "||") {
        if (L === "py") err("In Python schreibt man " + (two === "&&" ? "and" : "or") + " statt " + two + ".");
        toks.push({ k: "op", v: two === "&&" ? "and" : "or" }); i += 2; continue;
      }
      if (ch === "!") {
        if (L === "py") err("In Python schreibt man not statt ! (nur != gibt es auch in Python).");
        toks.push({ k: "op", v: "not" }); i++; continue;
      }
      if (ch === "=") err("Ein einzelnes = ist eine Zuweisung. Zum Vergleichen braucht man ==");
      if (ch === "&") err("& ist das bitweise UND. Gemeint ist " + (L === "py" ? "and" : "&&") + ".");
      if (ch === "|") err("| ist das bitweise ODER. Gemeint ist " + (L === "py" ? "or" : "||") + ".");
      if (ch === "/") err("Division ist hier nicht eingebaut – nutze %, *, + oder -.");
      if ("<>()+-*%".indexOf(ch) >= 0) { toks.push({ k: "op", v: ch }); i++; continue; }
      err("Unbekanntes Zeichen „" + ch + "“.");
    }
    return toks;
  }

  /* ---------- Parser ---------- */
  function parse(src, L, vars) {
    if (!src.trim()) throw new EngineError("Gib einen Ausdruck ein.");
    var toks = tokenize(src, L, vars), pos = 0;
    var peek = function () { return toks[pos]; };
    var isOp = function (v) { var t = toks[pos]; return t && t.k === "op" && t.v === v; };
    var next = function () { return toks[pos++]; };
    function err(msg) { throw new EngineError(msg); }

    function binLevel(ops, sub) {
      return function () {
        var l = sub();
        while (peek() && peek().k === "op" && ops.indexOf(peek().v) >= 0) {
          var op = next().v;
          l = C(op, l, sub());
        }
        return l;
      };
    }
    function unary() {
      if (isOp("-")) { next(); var e = unary(); return e.t === "val" && typeof e.v === "number" && !e.txt ? N(-e.v) : { t: "un", op: "neg", e: e }; }
      if (L === "c" && isOp("not")) { next(); return NOT(unary()); }
      return atom();
    }
    function atom() {
      var t = next();
      if (!t) err("Der Ausdruck ist unvollständig – da fehlt noch etwas am Ende.");
      if (t.k === "num") return N(t.v);
      if (t.k === "bool") return { t: "val", v: t.v, txt: t.txt, txtLang: L };
      if (t.k === "id") return V(t.v);
      if (t.k === "op" && t.v === "(") {
        var e = top();
        if (!isOp(")")) err("Es fehlt eine schließende Klammer ).");
        next();
        return P(e);
      }
      if (t.k === "op" && t.v === ")") err("Hier steht eine Klammer ) zu viel oder an der falschen Stelle.");
      err("Hier fehlt ein Wert vor „" + opText(t.v, L) + "“.");
    }
    var term = binLevel(["*", "%"], unary);
    var sum = binLevel(["+", "-"], term);
    var top;

    if (L === "py") {
      var comparison = function () {
        var first = sum(), es = [first], ops = [];
        while (peek() && peek().k === "op" && isCmp(peek().v)) { ops.push(next().v); es.push(sum()); }
        if (!ops.length) return first;
        if (ops.length === 1) return C(ops[0], es[0], es[1]);
        return { t: "chain", ops: ops, es: es };
      };
      var notExpr = function () { if (isOp("not")) { next(); return NOT(notExpr()); } return comparison(); };
      var andExpr = binLevel(["and"], notExpr);
      top = binLevel(["or"], andExpr);
    } else {
      var rel = binLevel(["<", "<=", ">", ">="], sum);
      var eq = binLevel(["==", "!="], rel);
      var land = binLevel(["and"], eq);
      top = binLevel(["or"], land);
    }
    var tree = top();
    if (pos < toks.length) {
      var t = toks[pos];
      if (t.k === "op" && t.v === ")") err("Hier steht eine Klammer ) zu viel.");
      err("Nach dem Ausdruck kommt noch etwas Unerwartetes: „" + (t.k === "op" ? opText(t.v, L) : (t.txt || t.v)) + "“. Fehlt ein Operator?");
    }
    return tree;
  }

  /* ---------- Schritt-für-Schritt-Auswertung ---------- */
  function clone(n) {
    var c = {};
    for (var k in n) if (k !== "hl") c[k] = n[k];
    if (n.l) c.l = clone(n.l);
    if (n.r) c.r = clone(n.r);
    if (n.e) c.e = clone(n.e);
    if (n.es) c.es = n.es.map(clone);
    return c;
  }
  function mk(v) { return { t: "val", v: v, hl: true }; }
  function code(n, L) { return "<code>" + render(n, L, true) + "</code>"; }
  function codeV(v, L) { return "<code>" + esc(fmt(v, L)) + "</code>"; }

  function substitute(n, env, L) {
    switch (n.t) {
      case "var": return mk(env[n.n]);
      case "paren": var e = substitute(n.e, env, L); return e.t === "val" ? e : P(e);
      case "un": return { t: "un", op: n.op, e: substitute(n.e, env, L) };
      case "bin": return C(n.op, substitute(n.l, env, L), substitute(n.r, env, L));
      case "chain": return { t: "chain", ops: n.ops.slice(), es: n.es.map(function (e) { return substitute(e, env, L); }) };
    }
    return clone(n);
  }

  var NAME = {
    "==": "gleich", "!=": "ungleich", "<": "kleiner als", "<=": "kleiner oder gleich",
    ">": "größer als", ">=": "größer oder gleich"
  };

  function step(n, L) {
    var r;
    switch (n.t) {
      case "paren":
        r = step(n.e, L);
        return r.n.t === "val" ? r : { n: P(r.n), note: r.note };
      case "un":
        if (n.e.t !== "val") { r = step(n.e, L); return { n: { t: "un", op: n.op, e: r.n }, note: r.note }; }
        var uv = ev(n, {}, L);
        if (n.op === "neg") return { n: mk(uv), note: "Vorzeichen: " + code(n, L) + " ergibt " + codeV(uv, L) + "." };
        return {
          n: mk(uv),
          note: code(n, L) + " → " + codeV(uv, L) + ": " + (L === "py" ? "not" : "!") + " dreht den Wahrheitswert um" +
            (L === "c" && n.e.v !== 0 && n.e.v !== 1 ? " (jeder Wert ≠ 0 zählt als wahr)" : "") + "."
        };
      case "bin":
        if (n.op === "and" || n.op === "or") {
          var isAnd = n.op === "and";
          if (n.l.t !== "val") { r = step(n.l, L); return { n: C(n.op, r.n, n.r), note: r.note }; }
          var lt = truthy(n.l.v, L);
          if (isAnd ? !lt : lt) {
            var sv = L === "py" ? n.l.v : boolOut(lt, L);
            var skipped = n.r.t === "val" ? "" : " Die rechte Seite " + code(n.r, L) + " wird gar nicht mehr ausgewertet.";
            return {
              n: mk(sv),
              note: "<b>Kurzschluss:</b> Links steht " + codeV(n.l.v, L) + " (" + wahr(n.l.v, L) + "). Damit ist " +
                "<code>" + esc(opText(n.op, L)) + "</code> schon sicher " + (isAnd ? "falsch" : "wahr") + "." + skipped
            };
          }
          if (n.r.t !== "val") { r = step(n.r, L); return { n: C(n.op, n.l, r.n), note: r.note }; }
          var res = L === "py" ? n.r.v : boolOut(truthy(n.r.v, L), L);
          var extra = "";
          if (L === "py" && typeof res !== "boolean") extra = " Python gibt dabei den Wert der rechten Seite zurück, nicht nur True/False.";
          if (L === "c" && [0, 1].indexOf(n.l.v) < 0 || L === "c" && [0, 1].indexOf(n.r.v) < 0) extra = " In C zählt jeder Wert ≠ 0 als wahr.";
          return {
            n: mk(res),
            note: code(n, L) + " → " + codeV(res, L) + ": " +
              (isAnd ? "<code>" + esc(opText("and", L)) + "</code> ist nur wahr, wenn <b>beide</b> Seiten wahr sind."
                     : "<code>" + esc(opText("or", L)) + "</code> ist wahr, sobald <b>mindestens eine</b> Seite wahr ist.") + extra
          };
        }
        if (n.l.t !== "val") { r = step(n.l, L); return { n: C(n.op, r.n, n.r), note: r.note }; }
        if (n.r.t !== "val") { r = step(n.r, L); return { n: C(n.op, n.l, r.n), note: r.note }; }
        var bv = applyOp(n.op, n.l.v, n.r.v, L);
        if (isCmp(n.op)) {
          return { n: mk(bv), note: "Vergleich: Ist " + codeV(n.l.v, L) + " " + NAME[n.op] + " " + codeV(n.r.v, L) + "? " +
            (truthy(bv, L) ? "Ja" : "Nein") + " → " + codeV(bv, L) + "." };
        }
        return { n: mk(bv), note: "Rechnen: " + code(n, L) + " = " + codeV(bv, L) + (n.op === "%" ? " (Rest der Division)" : "") + ". Rechnen kommt vor Vergleichen." };
      case "chain":
        var parts = [];
        for (var i = 0; i < n.ops.length; i++) parts.push(C(n.ops[i], clone(n.es[i]), clone(n.es[i + 1])));
        var joined = parts.reduce(function (a, b) { return AND(a, b); });
        var out = P(joined);
        out.hl = true;
        return { n: out, note: "Vergleichskette: Python liest " + code(n, L) + " wie zwei Vergleiche, die mit <code>and</code> verbunden sind." };
    }
    throw new EngineError("Nichts mehr zu tun");
  }

  function usedVars(n, acc) {
    acc = acc || [];
    if (n.t === "var" && acc.indexOf(n.n) < 0) acc.push(n.n);
    ["l", "r", "e"].forEach(function (k) { if (n[k]) usedVars(n[k], acc); });
    if (n.es) n.es.forEach(function (e) { usedVars(e, acc); });
    return acc;
  }

  function trace(tree, env, L) {
    var steps = [{ html: render(tree, L, true), note: null }];
    var cur = tree;
    var vs = usedVars(tree);
    if (vs.length) {
      cur = substitute(tree, env, L);
      steps.push({
        html: render(cur, L, true),
        note: "Variablen durch ihre Werte ersetzen: " + vs.map(function (v) { return "<code>" + v + " = " + esc(fmt(env[v], L)) + "</code>"; }).join(", ") + "."
      });
    }
    var guard = 0;
    while (cur.t !== "val" && guard++ < 200) {
      var r = step(clone(cur), L);
      cur = r.n;
      steps.push({ html: render(cur, L, true), note: r.note });
    }
    return { steps: steps, value: cur.v };
  }

  // Für die Übersetzung zwischen den Sprachen: Python-Ketten in and-Form bringen
  function unchain(n) {
    if (n.t === "chain") {
      var parts = [];
      for (var i = 0; i < n.ops.length; i++) parts.push(C(n.ops[i], unchain(n.es[i]), unchain(n.es[i + 1])));
      return P(parts.reduce(function (a, b) { return AND(a, b); }));
    }
    var c = clone(n);
    if (c.t === "val" && c.txt) { delete c.txt; delete c.txtLang; }
    if (c.l) c.l = unchain(c.l);
    if (c.r) c.r = unchain(c.r);
    if (c.e) c.e = unchain(c.e);
    return c;
  }
  function translate(src, from, to, vars) {
    var tree = parse(src, from, vars);
    return render(unchain(tree), to, false);
  }

  /* ==========================================================
     Aufgaben
     ========================================================== */
  var rnd = Math.random;
  function ri(a, b) { return a + Math.floor(rnd() * (b - a + 1)); }
  function pick(a) { return a[Math.floor(rnd() * a.length)]; }
  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  /* ---------- 1) Ausdruck auswerten ---------- */
  function genEval(level) {
    var max = level === 1 ? 12 : 20;
    var target = rnd() < 0.5;
    var best = null;
    for (var tries = 0; tries < 60; tries++) {
      var env = { x: ri(0, max), y: ri(0, max), z: ri(0, max) };
      var cmp = function (vars, allowVarVar) {
        var a = pick(vars), op = pick(CMP), r;
        var others = vars.filter(function (v) { return v !== a; });
        if (allowVarVar && others.length && rnd() < 0.3) r = V(pick(others));
        else r = N(rnd() < 0.3 ? env[a] : Math.max(0, env[a] + ri(-3, 3)));
        return C(op, V(a), r);
      };
      var modCmp = function (v) { return C(pick(["==", "!="]), C("%", V(v), N(pick([2, 3, 5]))), N(0)); };
      var ast;
      if (level === 1) {
        ast = pick([
          function () { return cmp(["x"], false); },
          function () { return cmp(["x", "y"], true); },
          function () { return cmp(["x", "y"], true); },
          function () { return NOT(cmp(["x"], false)); },
          function () { return modCmp("x"); }
        ])();
      } else if (level === 2) {
        ast = pick([
          function () { return AND(cmp(["x"], false), cmp(["y"], false)); },
          function () { return OR(cmp(["x"], false), cmp(["y"], false)); },
          function () { return AND(cmp(["x"], false), cmp(["x"], false)); },
          function () { return OR(cmp(["x", "y"], true), NOT(cmp(["y"], false))); },
          function () { return NOT(AND(cmp(["x"], false), cmp(["y"], false))); },
          function () { return NOT(OR(cmp(["x"], false), cmp(["y"], false))); },
          function () { return C(pick([">", ">=", "<", "=="]), C("+", V("x"), V("y")), N(env.x + env.y + ri(-3, 3))); },
          function () { return AND(modCmp("x"), cmp(["y"], false)); }
        ])();
      } else {
        ast = pick([
          function () { return OR(cmp(["x"], false), AND(cmp(["y"], false), cmp(["z"], false))); },
          function () { return AND(OR(cmp(["x"], false), cmp(["y"], false)), cmp(["z"], false)); },
          function () { return OR(AND(cmp(["x"], false), cmp(["y"], false)), NOT(cmp(["z"], false))); },
          function () { return AND(NOT(OR(cmp(["x"], false), cmp(["y"], false))), cmp(["z"], true)); },
          function () { return OR(NOT(cmp(["x", "y"], true)), AND(modCmp("y"), cmp(["z"], false))); },
          function () { return AND(P(OR(modCmp("x"), modCmp("y"))), NOT(cmp(["z"], false))); },
          function () { return OR(AND(cmp(["x"], false), cmp(["y"], false)), AND(cmp(["y", "z"], true), cmp(["z"], false))); },
          function () { return C(pick(["==", "!="]), C("%", C("+", V("x"), V("y")), N(2)), N(0)); }
        ])();
      }
      var vs = usedVars(ast), e2 = {};
      vs.forEach(function (v) { e2[v] = env[v]; });
      var res = truthy(ev(ast, e2, "py"), "py");
      best = { kind: "eval", level: level, ast: ast, env: e2, answer: res };
      if (res === target) break;
    }
    return best;
  }

  /* ---------- 2) Wahrheitstabelle ---------- */
  var a = V("a"), b = V("b"), c = V("c");
  var TABLES = {
    1: [AND(a, b), OR(a, b), AND(a, NOT(b)), OR(NOT(a), b), AND(NOT(a), b), OR(a, NOT(b))],
    2: [NOT(AND(a, b)), NOT(OR(a, b)), AND(NOT(a), NOT(b)), OR(NOT(a), NOT(b)), C("!=", a, b), C("==", a, b),
        OR(AND(a, NOT(b)), AND(NOT(a), b)), AND(OR(a, b), NOT(AND(a, b)))],
    3: [OR(a, AND(b, c)), AND(OR(a, b), c), OR(AND(a, b), NOT(c)), OR(NOT(a), AND(b, NOT(c))),
        AND(NOT(OR(a, b)), c), AND(C("!=", a, b), c), OR(AND(a, NOT(b)), AND(b, c)), NOT(AND(a, OR(b, c)))]
  };
  function genTable(level, avoid) {
    var pool = TABLES[level].filter(function (t) { return t !== avoid; });
    var ast = pick(pool);
    var vars = usedVars(ast).sort();
    var rows = [];
    var n = vars.length;
    for (var m = 0; m < (1 << n); m++) {
      var bits = vars.map(function (_, i) { return (m >> (n - 1 - i)) & 1; });
      rows.push(bits);
    }
    return { kind: "table", level: level, ast: ast, vars: vars, rows: rows };
  }
  function envFromBits(vars, bits, L) {
    var e = {};
    vars.forEach(function (v, i) { e[v] = L === "py" ? !!bits[i] : bits[i]; });
    return e;
  }

  /* ---------- 3) Passende Bedingung finden ---------- */
  function range(a, b, s) { var r = []; for (var i = a; i <= b; i += (s || 1)) r.push(i); return r; }
  var FORM = [
    // Stufe 1
    { lv: 1, f: function () { var n = ri(3, 20); return { text: "<code>x</code> ist größer als " + n + ".", ast: C(">", V("x"), N(n)) }; } },
    { lv: 1, f: function () { var n = ri(3, 20); return { text: "<code>x</code> ist mindestens " + n + ".", ast: C(">=", V("x"), N(n)) }; } },
    { lv: 1, f: function () { var n = ri(3, 20); return { text: "<code>x</code> ist höchstens " + n + ".", ast: C("<=", V("x"), N(n)) }; } },
    { lv: 1, f: function () { var n = ri(3, 20); return { text: "<code>x</code> ist kleiner als " + n + ".", ast: C("<", V("x"), N(n)) }; } },
    { lv: 1, f: function () { var n = ri(3, 20); return { text: "<code>x</code> hat nicht den Wert " + n + ".", ast: C("!=", V("x"), N(n)) }; } },
    { lv: 1, f: function () { return { text: "<code>x</code> ist eine gerade Zahl.", ast: C("==", C("%", V("x"), N(2)), N(0)) }; } },
    { lv: 1, f: function () { return { text: "<code>x</code> ist eine ungerade Zahl.", ast: C("!=", C("%", V("x"), N(2)), N(0)) }; } },
    { lv: 1, f: function () { var k = pick([3, 4, 5, 7]); return { text: "<code>x</code> ist durch " + k + " teilbar.", ast: C("==", C("%", V("x"), N(k)), N(0)) }; } },
    // Stufe 2
    { lv: 2, f: function () { var n = ri(1, 20), m = n + ri(5, 30); return { text: "<code>x</code> liegt zwischen " + n + " und " + m + " – beide Grenzen gehören dazu.", ast: AND(C(">=", V("x"), N(n)), C("<=", V("x"), N(m))) }; } },
    { lv: 2, f: function () { var n = ri(1, 20), m = n + ri(5, 30); return { text: "<code>x</code> liegt zwischen " + n + " und " + m + " – die Grenzen selbst gehören <b>nicht</b> dazu.", ast: AND(C(">", V("x"), N(n)), C("<", V("x"), N(m))) }; } },
    { lv: 2, f: function () { var n = ri(1, 20), m = n + ri(5, 30); return { text: "<code>x</code> liegt außerhalb des Bereichs von " + n + " bis " + m + ".", ast: OR(C("<", V("x"), N(n)), C(">", V("x"), N(m))) }; } },
    { lv: 2, f: function () { return { text: "<code>x</code> und <code>y</code> sind beide positiv (größer als 0).", ast: AND(C(">", V("x"), N(0)), C(">", V("y"), N(0))), dom: { x: range(-10, 30), y: range(-10, 30) } }; } },
    { lv: 2, f: function () { return { text: "Mindestens eine der Zahlen <code>x</code> und <code>y</code> ist 0.", ast: OR(C("==", V("x"), N(0)), C("==", V("y"), N(0))), dom: { x: range(-10, 30), y: range(-10, 30) } }; } },
    { lv: 2, f: function () { var n = ri(5, 30); return { text: "<code>x</code> ist gerade und größer als " + n + ".", ast: AND(C("==", C("%", V("x"), N(2)), N(0)), C(">", V("x"), N(n))) }; } },
    { lv: 2, f: function () { return { text: "Ins Kino (ab 16) darf, wer mindestens 16 Jahre alt ist <b>oder</b> in Begleitung kommt.", ast: OR(C(">=", V("alter"), N(16)), V("begleitung")), dom: { alter: range(0, 99), begleitung: "bool" } }; } },
    { lv: 2, f: function () { var p = pick([40, 50, 60]), f = pick([3, 5, 8]); return { text: "Bestanden hat, wer mindestens " + p + " Punkte <b>und</b> höchstens " + f + " Fehlstunden hat.", ast: AND(C(">=", V("punkte"), N(p)), C("<=", V("fehlstunden"), N(f))), dom: { punkte: range(0, 100), fehlstunden: range(0, 20) } }; } },
    // Stufe 3
    { lv: 3, f: function () { return { text: "<code>jahr</code> ist ein Schaltjahr: durch 4 teilbar, aber nicht durch 100 – außer es ist durch 400 teilbar.", ast: OR(P(AND(C("==", C("%", V("jahr"), N(4)), N(0)), C("!=", C("%", V("jahr"), N(100)), N(0)))), C("==", C("%", V("jahr"), N(400)), N(0))), dom: { jahr: range(1, 2400) } }; } },
    { lv: 3, f: function () { var n = ri(1, 20), m = n + ri(5, 30); return { text: "<code>x</code> liegt <b>nicht</b> zwischen " + n + " und " + m + " (Grenzen eingeschlossen). Verwende dabei " + "<span class=\"only-py\"><code>not</code></span><span class=\"only-c\"><code>!</code></span>.", ast: NOT(AND(C(">=", V("x"), N(n)), C("<=", V("x"), N(m)))), notForm: true }; } },
    { lv: 3, f: function () { return { text: "<code>x</code> ist durch 3 oder durch 5 teilbar, aber nicht durch 15.", ast: AND(OR(C("==", C("%", V("x"), N(3)), N(0)), C("==", C("%", V("x"), N(5)), N(0))), C("!=", C("%", V("x"), N(15)), N(0))) }; } },
    { lv: 3, f: function () { return { text: "Genau eine der beiden Zahlen <code>x</code> und <code>y</code> ist negativ.", ast: C("!=", P(C("<", V("x"), N(0))), P(C("<", V("y"), N(0)))), dom: { x: range(-10, 10), y: range(-10, 10) } }; } },
    { lv: 3, f: function () { return { text: "Rabatt bekommen Mitglieder (<code>mitglied</code>) ab 50 € Einkaufswert (<code>betrag</code>) – und alle anderen ab 100 €.", ast: OR(AND(V("mitglied"), C(">=", V("betrag"), N(50))), C(">=", V("betrag"), N(100))), dom: { mitglied: "bool", betrag: range(0, 200) } }; } },
    { lv: 3, f: function () { return { text: "Login klappt, wenn der Name stimmt (<code>name_ok</code>) und außerdem entweder das Passwort (<code>pw_ok</code>) oder der Einmalcode (<code>code_ok</code>) stimmt.", ast: AND(V("name_ok"), P(OR(V("pw_ok"), V("code_ok")))), dom: { name_ok: "bool", pw_ok: "bool", code_ok: "bool" } }; } },
    { lv: 3, f: function () { var n = ri(10, 30); return { text: "<code>x</code> ist ungerade oder größer als " + n + ", aber in jedem Fall nicht negativ.", ast: AND(P(OR(C("!=", C("%", V("x"), N(2)), N(0)), C(">", V("x"), N(n)))), C(">=", V("x"), N(0))) }; } }
  ];

  // Alle Belegungen des Wertebereichs (beide Sprachen gleich: bool als 0/1)
  function envs(dom) {
    var keys = Object.keys(dom), out = [{}];
    keys.forEach(function (k) {
      var vals = dom[k] === "bool" ? [0, 1] : dom[k];
      var next = [];
      out.forEach(function (e) { vals.forEach(function (v) { var n = Object.assign({}, e); n[k] = v; next.push(n); }); });
      out = next;
    });
    return out;
  }
  function signature(ast, list, L) {
    var s = "";
    for (var i = 0; i < list.length; i++) {
      try { s += truthy(ev(ast, list[i], L), L) ? "1" : "0"; } catch (e) { s += "E"; }
    }
    return s;
  }

  var FLIP = { "<": ["<=", ">", ">="], "<=": ["<", ">=", ">"], ">": [">=", "<", "<="], ">=": [">", "<=", "<"], "==": ["!="], "!=": ["=="] };
  function mutations(n, num) {
    var out = [];
    if (n.t === "bin") {
      if (FLIP[n.op]) FLIP[n.op].forEach(function (op) { out.push(C(op, clone(n.l), clone(n.r))); });
      if (n.op === "and") out.push(OR(clone(n.l), clone(n.r)));
      if (n.op === "or") out.push(AND(clone(n.l), clone(n.r)));
      mutations(n.l, num).forEach(function (m) { out.push(C(n.op, m, clone(n.r))); });
      mutations(n.r, num).forEach(function (m) { out.push(C(n.op, clone(n.l), m)); });
    } else if (n.t === "un") {
      if (n.op === "not") out.push(clone(n.e));
      mutations(n.e, num).forEach(function (m) { out.push({ t: "un", op: n.op, e: m }); });
    } else if (n.t === "paren") {
      out.push({ t: "raw", e: clone(n.e) }); // Klammern vergessen
      mutations(n.e, num).forEach(function (m) { out.push(P(m)); });
    } else if (num && n.t === "val" && typeof n.v === "number") {
      out.push(N(n.v + 1));
      if (n.v > 1) out.push(N(n.v - 1));
    }
    return out;
  }
  // Klammern weglassen hat nur Wirkung, wenn sie für die Vorrangregeln nötig sind –
  // für die Darstellung zählt der Baum, daher hier Klammer weglassen = Baum neu nach Vorrang aufbauen
  function reparse(ast) {
    try { return parse(render(ast, "c", false), "c", null); } catch (e) { return ast; }
  }

  function genForm(level) {
    var pool = FORM.filter(function (t) { return t.lv === level; });
    var tpl = pick(pool).f();
    var dom = tpl.dom || { x: range(-30, 150) };
    var list = envs(dom);
    var right = tpl.ast;
    // Distraktoren müssen sich in BEIDEN Sprachen von der Lösung und voneinander unterscheiden
    var sigs = { py: {}, c: {} };
    sigs.py[signature(right, list, "py")] = true;
    sigs.c[signature(right, list, "c")] = true;
    var seen = {};
    seen[render(right, "c", false)] = true;
    var cands = [];
    var frontier = [right];
    // erst strukturelle Fehler (Operator, and/or, not, Klammern), Zahlen ±1 nur als Reserve
    var passes = [[false, 1], [false, 2], [true, 1], [true, 2]];
    for (var pi = 0; pi < passes.length && cands.length < 3; pi++) {
      var useNum = passes[pi][0];
      if (passes[pi][1] === 1) frontier = [right];
      var muts = [];
      frontier.forEach(function (f) { muts = muts.concat(mutations(f, useNum)); });
      muts = shuffle(muts);
      var nextF = [];
      muts.forEach(function (m) {
        // "Klammer vergessen" muss wirklich nach Vorrang neu gelesen werden
        var real = reparse(m);
        var key = render(real, "c", false);
        if (seen[key]) return;
        seen[key] = true;
        nextF.push(real);
        if (cands.length >= 3) return;
        var sp = signature(real, list, "py"), sc = signature(real, list, "c");
        if (sigs.py[sp] || sigs.c[sc] || /E/.test(sp + sc)) return;
        sigs.py[sp] = true; sigs.c[sc] = true;
        cands.push(real);
      });
      frontier = nextF.slice(0, 12);
    }
    var opts = shuffle([right].concat(cands));
    return { kind: "form", level: level, text: tpl.text, opts: opts, answer: opts.indexOf(right), right: right, dom: dom };
  }

  /* ---------- 4) Stolperfallen ---------- */
  var TRAPS = {
    py: [
      { lv: 1, q: "Welche Bedingung prüft, ob <code>x</code> gleich 5 ist?", opts: ["x == 5", "x = 5", "x === 5", "x := 5"], a: 0,
        ex: "Ein einzelnes <code>=</code> ist eine <b>Zuweisung</b> – <code>if x = 5:</code> ergibt in Python einen SyntaxError. <code>===</code> gibt es nur in JavaScript, <code>:=</code> ist der „Walross“-Operator und weist ebenfalls zu." },
      { lv: 1, q: "Wie schreibt man „kleiner oder gleich“?", opts: ["x <= 10", "x =< 10", "x ≤ 10", "x < = 10"], a: 0,
        ex: "Das Gleichheitszeichen steht immer <b>hinten</b>: <code>&lt;=</code>, <code>&gt;=</code>, <code>!=</code>. Zwischen den beiden Zeichen darf kein Leerzeichen stehen, und das Mathe-Zeichen ≤ kennt Python nicht." },
      { lv: 1, q: "Welche Zeile ist gültiges Python?", opts: ["if x > 0 and y > 0:", "if x > 0 && y > 0:", "if x > 0 AND y > 0:", "if x > 0 And y > 0:"], a: 0,
        ex: "Python verwendet die Wörter <code>and</code>, <code>or</code>, <code>not</code> – klein geschrieben. <code>&amp;&amp;</code> und <code>||</code> gibt es in C, Java und JavaScript." },
      { lv: 1, q: "Wie heißt der Wahrheitswert „wahr“ in Python?", opts: ["True", "true", "TRUE", "wahr"], a: 0,
        ex: "<code>True</code> und <code>False</code> werden mit großem Anfangsbuchstaben geschrieben. <code>true</code> hält Python für einen (unbekannten) Variablennamen → NameError." },
      { lv: 1, q: "<code>x = 4</code>. Was ergibt <code>x != 4</code>?", opts: ["False", "True", "4", "Fehler"], a: 0,
        ex: "<code>!=</code> heißt „ungleich“. <code>x</code> ist aber gleich 4 – also ist „x ist ungleich 4“ falsch." },
      { lv: 2, q: "<code>x = 5</code>. Was passiert hier?", code: "if x == 1 or 2:\n    print(\"Treffer\")", opts: ["Es wird „Treffer“ ausgegeben – die Bedingung ist immer wahr", "Nichts, weil x weder 1 noch 2 ist", "SyntaxError", "Python prüft automatisch auch x == 2"], a: 0,
        ex: "Python liest <code>(x == 1) or 2</code>. Rechts steht einfach die Zahl <code>2</code> – und jede Zahl ungleich 0 gilt als wahr. Richtig wäre <code>x == 1 or x == 2</code> (oder <code>x in (1, 2)</code>)." },
      { lv: 2, q: "Welcher Ausdruck bedeutet dasselbe wie <code>not (a and b)</code>?", opts: ["not a or not b", "not a and not b", "a or b", "not a and b"], a: 0,
        ex: "Regel von De Morgan: Wenn man <code>not</code> in die Klammer zieht, wird aus <code>and</code> ein <code>or</code> (und umgekehrt). „Nicht beide“ heißt: „mindestens einer nicht“." },
      { lv: 2, q: "<code>x = 3</code>. Was ergibt <code>not x &gt; 5</code>?", opts: ["True", "False", "TypeError", "-4"], a: 0,
        ex: "In Python hat <code>not</code> einen niedrigeren Vorrang als Vergleiche. Es wird also <code>not (3 &gt; 5)</code> = <code>not False</code> = <code>True</code> gerechnet." },
      { lv: 2, q: "Welcher Ausdruck ist gleichwertig zu <code>not (x &lt; 10)</code>?", opts: ["x >= 10", "x > 10", "x <= 10", "x < -10"], a: 0,
        ex: "Das Gegenteil von „kleiner als 10“ ist „10 oder größer“ – also <code>x &gt;= 10</code>. Bei <code>x &gt; 10</code> fehlt der Fall <code>x == 10</code>." },
      { lv: 3, q: "<code>x = 8</code>, <code>y = 0</code>. Welche Bedingung bricht mit einem Fehler ab?", opts: ["x % y == 0 and y != 0", "y != 0 and x % y == 0", "y == 0 or x % y == 0", "y != 0"], a: 0,
        ex: "<b>Kurzschluss-Auswertung:</b> Python wertet von links nach rechts aus und hört auf, sobald das Ergebnis feststeht. Steht <code>y != 0</code> vorne und ist falsch, wird <code>x % y</code> nie berechnet. Steht die Division vorne, kracht es: ZeroDivisionError." },
      { lv: 3, q: "<code>x = 20</code>. Was ergibt <code>1 &lt; x &lt; 10</code> in Python?", opts: ["False", "True", "SyntaxError", "1"], a: 0,
        ex: "Python kann Vergleiche verketten: <code>1 &lt; x &lt; 10</code> bedeutet <code>1 &lt; x and x &lt; 10</code>. 20 &lt; 10 ist falsch → <code>False</code>. (Achtung: In C funktioniert das <b>nicht</b> so!)" },
      { lv: 3, q: "Was ergibt <code>True or False and False</code>?", opts: ["True", "False", "None", "SyntaxError"], a: 0,
        ex: "<code>and</code> bindet stärker als <code>or</code>: <code>True or (False and False)</code> = <code>True or False</code> = <code>True</code>." },
      { lv: 3, q: "Wie prüft man sinnvoll, ob <code>0.1 + 0.2</code> gleich <code>0.3</code> ist?", opts: ["abs((0.1 + 0.2) - 0.3) < 1e-9", "0.1 + 0.2 == 0.3", "0.1 + 0.2 is 0.3", "round(0.1 + 0.2) == 0.3"], a: 0,
        ex: "Kommazahlen werden binär nur ungefähr gespeichert: <code>0.1 + 0.2</code> ist <code>0.30000000000000004</code>. Daher vergleicht man mit einer kleinen Toleranz (oder <code>math.isclose()</code>). <code>round(0.3)</code> ergibt übrigens 0." },
      { lv: 3, q: "<code>name = \"\"</code> (leerer Text). Was gibt <code>print(name or \"Gast\")</code> aus?", opts: ["Gast", "False", "(eine leere Zeile)", "True"], a: 0,
        ex: "<code>or</code> liefert in Python den ersten „wahren“ Wert zurück – nicht unbedingt True/False. Ein leerer Text gilt als falsch, also kommt <code>\"Gast\"</code> heraus. Beliebter Trick für Standardwerte." }
    ],
    c: [
      { lv: 1, q: "Welche Bedingung prüft, ob <code>x</code> gleich 5 ist?", opts: ["x == 5", "x = 5", "x === 5", "x := 5"], a: 0,
        ex: "Ein einzelnes <code>=</code> ist eine <b>Zuweisung</b>. Gemein: <code>if (x = 5)</code> wird in C sogar kompiliert – macht aber etwas ganz anderes (siehe Stufe mittel). <code>===</code> gibt es nur in JavaScript." },
      { lv: 1, q: "Wie schreibt man „kleiner oder gleich“?", opts: ["x <= 10", "x =< 10", "x ≤ 10", "x < = 10"], a: 0,
        ex: "Das Gleichheitszeichen steht immer <b>hinten</b>: <code>&lt;=</code>, <code>&gt;=</code>, <code>!=</code>. Zwischen den beiden Zeichen darf kein Leerzeichen stehen." },
      { lv: 1, q: "Welche Zeile ist gültiges C?", opts: ["if (x > 0 && y > 0)", "if (x > 0 AND y > 0)", "if x > 0 && y > 0", "if (x > 0 &&& y > 0)"], a: 0,
        ex: "C verwendet <code>&amp;&amp;</code>, <code>||</code> und <code>!</code>. Außerdem muss die Bedingung bei <code>if</code> in runden Klammern stehen." },
      { lv: 1, q: "Was gibt diese Zeile aus?", code: "printf(\"%d\", 7 > 3);", opts: ["1", "true", "7", "0"], a: 0,
        ex: "Ein Vergleich liefert in C eine ganze Zahl: <code>1</code> für wahr, <code>0</code> für falsch." },
      { lv: 1, q: "<code>x = 4</code>. Was ergibt <code>x != 4</code>?", opts: ["0", "1", "4", "-4"], a: 0,
        ex: "<code>!=</code> heißt „ungleich“. <code>x</code> ist aber gleich 4 – also ist der Vergleich falsch → <code>0</code>." },
      { lv: 2, q: "<code>int x = 0;</code> Was passiert hier?", code: "if (x = 5) {\n    printf(\"fuenf\");\n}", opts: ["„fuenf“ wird ausgegeben und x ist danach 5", "Nichts, weil x gleich 0 ist", "Der Compiler bricht mit einem Fehler ab", "x wird mit 5 verglichen und bleibt 0"], a: 0,
        ex: "<code>x = 5</code> <b>weist</b> 5 zu. Der Wert dieses Ausdrucks ist 5 – und alles ≠ 0 gilt als wahr. Mit <code>gcc -Wall</code> gibt es zumindest eine Warnung." },
      { lv: 2, q: "<code>x = 5</code>. Was passiert hier?", code: "if (x == 1 || 2) {\n    printf(\"Treffer\");\n}", opts: ["„Treffer“ wird ausgegeben – die Bedingung ist immer wahr", "Nichts, weil x weder 1 noch 2 ist", "Compilerfehler", "C prüft automatisch auch x == 2"], a: 0,
        ex: "C liest <code>(x == 1) || 2</code>. Rechts steht nur die Zahl <code>2</code> – und jeder Wert ≠ 0 ist wahr. Richtig: <code>x == 1 || x == 2</code>." },
      { lv: 2, q: "Welcher Ausdruck bedeutet dasselbe wie <code>!(a &amp;&amp; b)</code>?", opts: ["!a || !b", "!a && !b", "a || b", "!a && b"], a: 0,
        ex: "Regel von De Morgan: Wenn man <code>!</code> in die Klammer zieht, wird aus <code>&amp;&amp;</code> ein <code>||</code> (und umgekehrt). „Nicht beide“ heißt: „mindestens einer nicht“." },
      { lv: 2, q: "<code>x = 3</code>. Was ergibt <code>!x &gt; 5</code>?", opts: ["0", "1", "3", "Compilerfehler"], a: 0,
        ex: "<code>!</code> bindet in C stärker als <code>&gt;</code>: gerechnet wird <code>(!3) &gt; 5</code> → <code>0 &gt; 5</code> → <code>0</code>. Gemeint war vermutlich <code>!(x &gt; 5)</code> – das ergäbe 1. Merke: Bei <code>!</code> lieber Klammern setzen." },
      { lv: 3, q: "<code>x = 20</code>. Was ergibt <code>1 &lt; x &lt; 10</code> in C?", opts: ["1", "0", "Compilerfehler", "20"], a: 0,
        ex: "C rechnet von links: <code>(1 &lt; 20)</code> → <code>1</code>, dann <code>1 &lt; 10</code> → <code>1</code>. Die Bedingung ist also fast immer wahr! Richtig: <code>x &gt; 1 &amp;&amp; x &lt; 10</code>." },
      { lv: 3, q: "<code>x = 8</code>, <code>y = 0</code>. Welche Bedingung führt zu einer Division durch 0?", opts: ["x % y == 0 && y != 0", "y != 0 && x % y == 0", "y == 0 || x % y == 0", "y != 0"], a: 0,
        ex: "<b>Kurzschluss-Auswertung:</b> C wertet von links nach rechts aus und hört auf, sobald das Ergebnis feststeht. Steht <code>y != 0</code> vorne und ist falsch, wird <code>x % y</code> nie berechnet." },
      { lv: 3, q: "<code>a = 1</code>, <code>b = 0</code>, <code>c = 0</code>. Was ergibt <code>a || b &amp;&amp; c</code>?", opts: ["1", "0", "Compilerfehler", "2"], a: 0,
        ex: "<code>&amp;&amp;</code> bindet stärker als <code>||</code>: <code>a || (b &amp;&amp; c)</code> = <code>1 || 0</code> = <code>1</code>. Mit <code>(a || b) &amp;&amp; c</code> käme 0 heraus." },
      { lv: 3, q: "<code>char name[] = \"Max\";</code> Wie vergleicht man den Text richtig?", opts: ["strcmp(name, \"Max\") == 0", "name == \"Max\"", "strcmp(name, \"Max\")", "name = \"Max\""], a: 0,
        ex: "<code>==</code> vergleicht bei Arrays nur die <b>Adressen</b>. <code>strcmp</code> (aus <code>&lt;string.h&gt;</code>) liefert <code>0</code>, wenn beide Texte gleich sind – <code>if (strcmp(...))</code> allein wäre also genau falsch herum." },
      { lv: 3, q: "Was ergibt <code>5 &amp;&amp; 3</code> in C?", opts: ["1", "3", "5", "15"], a: 0,
        ex: "Beide Seiten sind ≠ 0, also wahr. <code>&amp;&amp;</code> liefert in C immer <code>0</code> oder <code>1</code>. (Python würde bei <code>5 and 3</code> übrigens <code>3</code> zurückgeben.)" },
      { lv: 3, q: "<code>double s = 0.1 + 0.2;</code> Welcher Vergleich mit 0.3 ist sinnvoll?", opts: ["fabs(s - 0.3) < 1e-9", "s == 0.3", "s = 0.3", "(int)s == 0.3"], a: 0,
        ex: "Kommazahlen werden binär nur ungefähr gespeichert – <code>s</code> ist <code>0.30000000000000004</code>. Daher mit einer kleinen Toleranz vergleichen (<code>fabs</code> aus <code>&lt;math.h&gt;</code>)." }
    ]
  };
  function genTrap(level, L, recent) {
    var pool = TRAPS[L].filter(function (t) { return t.lv === level; });
    var fresh = pool.filter(function (t) { return (recent || []).indexOf(t) < 0; });
    var t = pick(fresh.length ? fresh : pool);
    var order = shuffle(t.opts.map(function (_, i) { return i; }));
    return { kind: "trap", level: level, lang: L, item: t, order: order, answer: order.indexOf(t.a) };
  }

  var API = {
    V: V, N: N, C: C, AND: AND, OR: OR, NOT: NOT, P: P,
    EngineError: EngineError, parse: parse, ev: ev, render: render, trace: trace, translate: translate,
    truthy: truthy, fmt: fmt, esc: esc, usedVars: usedVars, envFromBits: envFromBits,
    genEval: genEval, genTable: genTable, genForm: genForm, genTrap: genTrap,
    _FORM: FORM, _TRAPS: TRAPS, _envs: envs, _signature: signature
  };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else global.OpEngine = API;
})(this);
