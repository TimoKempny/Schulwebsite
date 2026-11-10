/* ==========================================================
   html-editor-hilfe.js – Bausteine für die Menüs im HTML-Editor.
   HIER können neue Tags und CSS-Eigenschaften ergänzt werden.

   Aufbau: Gruppen (g = Name im Menü) mit Einträgen:
     n  Name, wie er im Menü steht
     k  Kurzbeschreibung (eine Zeile)
     t  Erklärung (optional)
     a  Attribute bzw. Werte: [["name", "Erklärung"], …] (optional)
     ah Überschrift über a (optional, sonst "Attribute" bzw. "Werte")
     s  Baustein, der eingefügt wird. Platzhalter darin:
          {{sel:Text}}  markierter Text – oder "Text", wenn nichts markiert ist
          «Text»        wird nach dem Einfügen markiert (zum Überschreiben)
          ¦             hier steht danach der Cursor
     r  nur CSS: true = ganze Regel/Selektor statt einer Eigenschaft
   ========================================================== */

var HEHilfe = {
  html: [
    { g: "Grundgerüst", items: [
      { n: "Grundgerüst", k: "Leere HTML-Seite mit allem, was dazugehört",
        t: "Jede HTML-Seite beginnt so. Im <head> stehen Infos für den Browser, im <body> der sichtbare Inhalt. Schneller geht es mit ! und Tab.",
        a: [["<!DOCTYPE html>", "sagt dem Browser: das ist HTML5"], ["lang=\"de\"", "Sprache der Seite"], ["<head>", "unsichtbare Infos: Titel, Zeichensatz, CSS"], ["<body>", "alles, was man auf der Seite sieht"]],
        ah: "Bestandteile",
        s: '<!DOCTYPE html>\n<html lang="de">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>«Titel der Seite»</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  \n</body>\n</html>' },
      { n: "<title>", k: "Titel im Browser-Tab", t: "Steht im <head>. Der Titel erscheint im Tab, in Lesezeichen und in Suchergebnissen. Pflicht auf jeder Seite.",
        s: "<title>{{sel:«Titel der Seite»}}</title>" },
      { n: "<meta charset>", k: "Zeichensatz – damit Umlaute richtig erscheinen", t: "Steht ganz oben im <head>. Fast immer utf-8.",
        a: [["charset", "Zeichenkodierung, z. B. utf-8"]], s: '<meta charset="utf-8">' },
      { n: "<meta viewport>", k: "Damit die Seite auf dem Handy nicht winzig ist", t: "Steht im <head>. Sagt dem Handy-Browser, dass die Seite so breit wie der Bildschirm sein soll.",
        a: [["width=device-width", "Breite = Bildschirmbreite"], ["initial-scale=1", "kein Hineinzoomen am Anfang"]],
        s: '<meta name="viewport" content="width=device-width, initial-scale=1">' },
      { n: "<link> CSS", k: "Externe CSS-Datei einbinden", t: "Steht im <head>. Der Pfad gilt von der HTML-Datei aus, z. B. css/style.css, wenn die Datei im Ordner css liegt.",
        a: [["rel=\"stylesheet\"", "die Datei ist ein Stylesheet"], ["href", "Pfad zur CSS-Datei"]],
        s: '<link rel="stylesheet" href="«style.css»">' },
      { n: "<style>", k: "CSS direkt in der HTML-Seite", t: "Steht im <head>. Praktisch zum Ausprobieren – für mehrere Seiten ist eine eigene CSS-Datei besser.",
        s: "<style>\n  ¦\n</style>" },
      { n: "<script>", k: "JavaScript einbinden", t: "Meist am Ende des <body>, damit die Seite schon geladen ist, wenn das Skript läuft.",
        a: [["src", "Pfad zur .js-Datei (dann bleibt der Inhalt leer)"], ["defer", "erst ausführen, wenn die Seite geladen ist (bei src im <head>)"]],
        s: '<script src="«script.js»"></script>' },
      { n: "<!-- Kommentar -->", k: "Notiz im Code, die man auf der Seite nicht sieht", t: "Auch mit Strg + # möglich.",
        s: "<!-- {{sel:«Kommentar»}} -->" }
    ] },
    { g: "Text", items: [
      { n: "<h1>", k: "Hauptüberschrift", t: "Pro Seite nur eine <h1>. Danach folgen <h2>, <h3> … in der richtigen Reihenfolge – nicht nach Schriftgröße auswählen, die macht man mit CSS.",
        s: "<h1>{{sel:«Überschrift»}}</h1>" },
      { n: "<h2>", k: "Überschrift 2. Ebene", t: "Für Abschnitte unter der <h1>.", s: "<h2>{{sel:«Überschrift»}}</h2>" },
      { n: "<h3>", k: "Überschrift 3. Ebene", t: "Für Unterabschnitte. Es gibt <h1> bis <h6>.", s: "<h3>{{sel:«Überschrift»}}</h3>" },
      { n: "<p>", k: "Absatz", t: "Normaler Fließtext. Ein <p> darf keine Blockelemente wie <div>, <ul> oder <h1> enthalten.",
        s: "<p>{{sel:«Text»}}</p>" },
      { n: "<br>", k: "Zeilenumbruch", t: "Leeres Element ohne End-Tag. Nur für Umbrüche innerhalb eines Textes (Adresse, Gedicht) – nicht für Abstände, dafür gibt es CSS.",
        s: "<br>" },
      { n: "<strong>", k: "Wichtig (fett)", t: "Markiert wichtigen Text. Der Browser zeigt ihn fett an.", s: "<strong>{{sel:«Text»}}</strong>" },
      { n: "<em>", k: "Betont (kursiv)", t: "Betont ein Wort, wie beim Sprechen. Der Browser zeigt es kursiv.", s: "<em>{{sel:«Text»}}</em>" },
      { n: "<mark>", k: "Hervorgehoben (Textmarker)", s: "<mark>{{sel:«Text»}}</mark>" },
      { n: "<small>", k: "Kleingedrucktes", t: "Für Hinweise, Copyright usw.", s: "<small>{{sel:«Text»}}</small>" },
      { n: "<sub> / <sup>", k: "Tief- und hochgestellt", t: "Z. B. H<sub>2</sub>O oder m<sup>2</sup>.", s: "<sup>{{sel:«2»}}</sup>" },
      { n: "<span>", k: "Neutraler Rahmen für ein Stück Text", t: "Hat keine eigene Bedeutung. Wird mit class versehen, um ein Wort per CSS zu gestalten.",
        a: [["class", "Name für CSS, z. B. class=\"rot\""]], s: '<span class="«name»">{{sel:Text}}</span>' },
      { n: "<code>", k: "Code im Text", t: "Wird in einer Schrift mit fester Zeichenbreite gezeigt.", s: "<code>{{sel:«Code»}}</code>" },
      { n: "<pre>", k: "Vorformatierter Text", t: "Leerzeichen und Zeilenumbrüche bleiben genau so erhalten. Oft mit <code> für Programmcode.",
        s: "<pre>{{sel:¦}}</pre>" },
      { n: "<blockquote>", k: "Zitat als eigener Block", a: [["cite", "Adresse der Quelle (optional)"]], s: "<blockquote>\n  <p>{{sel:«Zitat»}}</p>\n</blockquote>" },
      { n: "<hr>", k: "Trennlinie zwischen Abschnitten", t: "Leeres Element ohne End-Tag.", s: "<hr>" },
      { n: "&nbsp; &amp; …", k: "Sonderzeichen (Entities)", t: "Zeichen, die in HTML eine Bedeutung haben, schreibt man so: &lt; für <, &gt; für >, &amp; für &. &nbsp; ist ein Leerzeichen, an dem nicht umgebrochen wird.",
        a: [["&lt;  &gt;", "< und >"], ["&amp;", "&"], ["&nbsp;", "geschütztes Leerzeichen"], ["&copy;", "©"], ["&euro;", "€"]], ah: "Zeichen",
        s: "&«nbsp»;" }
    ] },
    { g: "Listen", items: [
      { n: "<ul>", k: "Aufzählung mit Punkten", t: "Ungeordnete Liste. Jeder Punkt ist ein <li>. Das Aussehen der Punkte ändert man mit CSS (list-style-type).",
        s: "<ul>\n  <li>{{sel:«Punkt»}}</li>\n  <li></li>\n</ul>" },
      { n: "<ol>", k: "Nummerierte Liste", a: [["start", "Startnummer, z. B. start=\"5\""], ["type", "1, a, A, i oder I"], ["reversed", "rückwärts zählen"]],
        s: "<ol>\n  <li>{{sel:«Schritt»}}</li>\n  <li></li>\n</ol>" },
      { n: "<li>", k: "Ein Listenpunkt", t: "Steht immer direkt in einem <ul> oder <ol>.", s: "<li>{{sel:«Punkt»}}</li>" },
      { n: "<dl>", k: "Begriffsliste (Begriff + Erklärung)", t: "<dt> ist der Begriff, <dd> die Erklärung dazu.",
        s: "<dl>\n  <dt>«Begriff»</dt>\n  <dd>Erklärung</dd>\n</dl>" }
    ] },
    { g: "Links & Medien", items: [
      { n: "<a> Link", k: "Link auf eine andere Seite", t: "Für eigene Seiten den Pfad angeben (kontakt.html), für fremde die ganze Adresse mit https://.",
        a: [["href", "Ziel des Links"], ["target=\"_blank\"", "in neuem Tab öffnen"], ["title", "Text, der beim Überfahren erscheint"], ["download", "Datei herunterladen statt öffnen"]],
        s: '<a href="«seite.html»">{{sel:Linktext}}</a>' },
      { n: "<a> extern", k: "Link auf eine fremde Webseite im neuen Tab", a: [["href", "ganze Adresse mit https://"], ["target=\"_blank\"", "neuer Tab"]],
        s: '<a href="«https://www.example.com»" target="_blank">{{sel:Linktext}}</a>' },
      { n: "<a> Sprungmarke", k: "Link zu einer Stelle auf derselben Seite", t: "Das Ziel braucht eine passende id, z. B. <h2 id=\"kontakt\">.",
        a: [["href=\"#id\"", "springt zum Element mit dieser id"]], s: '<a href="#«id»">{{sel:Linktext}}</a>' },
      { n: "<a> E-Mail", k: "Link, der das E-Mail-Programm öffnet", s: '<a href="mailto:«name@example.com»">{{sel:E-Mail schreiben}}</a>' },
      { n: "<img>", k: "Bild einbinden", t: "Leeres Element ohne End-Tag. Den Pfad zeigt der Editor an, wenn du links auf das Bild klickst.",
        a: [["src", "Pfad zum Bild, z. B. bilder/hund.jpg"], ["alt", "Beschreibung des Bildes (Pflicht) – für Screenreader und wenn es nicht lädt"], ["width / height", "Größe in Pixeln (ohne px)"], ["loading=\"lazy\"", "erst laden, wenn man hinscrollt"]],
        s: '<img src="«bilder/bild.jpg»" alt="Beschreibung">' },
      { n: "<figure>", k: "Bild mit Bildunterschrift", t: "<figcaption> ist die Bildunterschrift.",
        s: '<figure>\n  <img src="«bilder/bild.jpg»" alt="Beschreibung">\n  <figcaption>Bildunterschrift</figcaption>\n</figure>' },
      { n: "<video>", k: "Video abspielen", a: [["src", "Pfad zur Videodatei (.mp4, .webm)"], ["controls", "Bedienelemente anzeigen"], ["autoplay", "automatisch starten (geht meist nur mit muted)"], ["muted", "ohne Ton"], ["loop", "endlos wiederholen"], ["poster", "Vorschaubild"]],
        s: '<video src="«video.mp4»" controls></video>' },
      { n: "<audio>", k: "Ton abspielen", a: [["src", "Pfad zur Audiodatei (.mp3, .ogg)"], ["controls", "Bedienelemente anzeigen"], ["loop", "wiederholen"]],
        s: '<audio src="«ton.mp3»" controls></audio>' },
      { n: "<iframe>", k: "Andere Webseite einbetten (z. B. Karte, Video)", t: "Viele Seiten erlauben das Einbetten nicht. Video-Plattformen bieten dafür einen eigenen Einbetten-Code an.",
        a: [["src", "Adresse der Seite"], ["title", "Beschreibung (für Screenreader)"], ["width / height", "Größe"]],
        s: '<iframe src="«https://»" title="Beschreibung" width="560" height="315"></iframe>' }
    ] },
    { g: "Tabellen", items: [
      { n: "<table>", k: "Komplette Tabelle mit Kopfzeile", t: "<tr> ist eine Zeile, <th> eine Kopfzelle, <td> eine normale Zelle. Linien kommen per CSS: border und border-collapse.",
        a: [["<caption>", "Überschrift der Tabelle"], ["<thead>", "Kopfbereich"], ["<tbody>", "Inhalt"], ["<tr>", "Zeile"], ["<th>", "Kopfzelle"], ["<td>", "Zelle"]], ah: "Bestandteile",
        s: "<table>\n  <thead>\n    <tr>\n      <th>«Spalte 1»</th>\n      <th>Spalte 2</th>\n    </tr>\n  </thead>\n  <tbody>\n    <tr>\n      <td></td>\n      <td></td>\n    </tr>\n  </tbody>\n</table>" },
      { n: "<tr>", k: "Tabellenzeile", s: "<tr>\n  <td>¦</td>\n  <td></td>\n</tr>" },
      { n: "<th>", k: "Kopfzelle (fett, zentriert)", a: [["scope", "col = Kopf einer Spalte, row = Kopf einer Zeile"], ["colspan", "über mehrere Spalten"], ["rowspan", "über mehrere Zeilen"]],
        s: "<th>{{sel:«Kopf»}}</th>" },
      { n: "<td>", k: "Tabellenzelle", a: [["colspan", "Zelle über mehrere Spalten, z. B. colspan=\"2\""], ["rowspan", "Zelle über mehrere Zeilen"]],
        s: "<td>{{sel:¦}}</td>" },
      { n: "<td colspan>", k: "Zelle über mehrere Spalten", s: '<td colspan="«2»">{{sel:}}</td>' }
    ] },
    { g: "Formulare", items: [
      { n: "<form>", k: "Formular", t: "Umfasst alle Eingabefelder. Ohne Server werden die Daten nicht verarbeitet – in der Vorschau sieht man sie bei method=\"get\" in der Adresse.",
        a: [["action", "Adresse, an die die Daten gehen"], ["method", "get (Daten in der Adresse) oder post"]],
        s: '<form action="«#»" method="get">\n  \n  <button type="submit">Absenden</button>\n</form>' },
      { n: "<label> + <input>", k: "Textfeld mit Beschriftung", t: "Das for des Labels und die id des Feldes müssen gleich sein – dann setzt ein Klick auf die Beschriftung den Cursor ins Feld.",
        a: [["type", "Art des Feldes (text, email, password, number, date …)"], ["id", "verbindet Feld und Label"], ["name", "Name, unter dem der Wert verschickt wird"], ["placeholder", "grauer Beispieltext"], ["required", "Pflichtfeld"], ["value", "vorausgefüllter Wert"]],
        s: '<label for="«name»">Name:</label>\n<input type="text" id="name" name="name">' },
      { n: "<input type=email>", k: "Feld für E-Mail-Adressen", t: "Der Browser prüft beim Absenden, ob ein @ enthalten ist.",
        s: '<label for="«email»">E-Mail:</label>\n<input type="email" id="email" name="email" required>' },
      { n: "<input type=password>", k: "Passwortfeld (Punkte statt Zeichen)", s: '<label for="«passwort»">Passwort:</label>\n<input type="password" id="passwort" name="passwort">' },
      { n: "<input type=number>", k: "Zahlenfeld", a: [["min / max", "kleinster und größter Wert"], ["step", "Schrittweite"]],
        s: '<label for="«anzahl»">Anzahl:</label>\n<input type="number" id="anzahl" name="anzahl" min="1" max="10">' },
      { n: "<input type=checkbox>", k: "Ankreuzfeld (ja/nein)", a: [["checked", "schon angekreuzt"]],
        s: '<input type="checkbox" id="«agb»" name="agb">\n<label for="agb">Ich stimme zu</label>' },
      { n: "<input type=radio>", k: "Auswahl – nur eine von mehreren", t: "Alle Knöpfe einer Gruppe haben denselben name, aber verschiedene value.",
        s: '<input type="radio" id="«ja»" name="antwort" value="ja">\n<label for="ja">Ja</label>\n<input type="radio" id="nein" name="antwort" value="nein">\n<label for="nein">Nein</label>' },
      { n: "<textarea>", k: "Mehrzeiliges Textfeld", a: [["rows", "Höhe in Zeilen"], ["cols", "Breite in Zeichen"]],
        s: '<label for="«nachricht»">Nachricht:</label>\n<textarea id="nachricht" name="nachricht" rows="5"></textarea>' },
      { n: "<select>", k: "Auswahlliste (Drop-down)", a: [["<option>", "ein Eintrag"], ["value", "Wert, der verschickt wird"], ["selected", "vorausgewählt"]],
        s: '<label for="«auswahl»">Auswahl:</label>\n<select id="auswahl" name="auswahl">\n  <option value="1">Eins</option>\n  <option value="2">Zwei</option>\n</select>' },
      { n: "<button>", k: "Schaltfläche", a: [["type=\"submit\"", "schickt das Formular ab"], ["type=\"reset\"", "leert das Formular"], ["type=\"button\"", "macht nichts (für JavaScript)"]],
        s: '<button type="«submit»">{{sel:Absenden}}</button>' },
      { n: "<fieldset>", k: "Gruppe von Feldern mit Rahmen", t: "<legend> ist die Überschrift der Gruppe.",
        s: "<fieldset>\n  <legend>«Gruppe»</legend>\n  \n</fieldset>" }
    ] },
    { g: "Bereiche", items: [
      { n: "<header>", k: "Kopfbereich (Logo, Titel, Navigation)", t: "Semantische Bereiche sagen, welche Rolle ein Teil der Seite hat. Aussehen bekommen sie erst durch CSS.",
        s: "<header>\n  ¦\n</header>" },
      { n: "<nav>", k: "Navigation mit Links", s: '<nav>\n  <ul>\n    <li><a href="«index.html»">Start</a></li>\n    <li><a href="kontakt.html">Kontakt</a></li>\n  </ul>\n</nav>' },
      { n: "<main>", k: "Hauptinhalt der Seite", t: "Pro Seite genau ein <main>.", s: "<main>\n  ¦\n</main>" },
      { n: "<section>", k: "Thematischer Abschnitt", t: "Hat normalerweise eine eigene Überschrift.", s: "<section>\n  <h2>«Abschnitt»</h2>\n  \n</section>" },
      { n: "<article>", k: "Eigenständiger Beitrag", t: "Ein Teil, der auch allein Sinn ergibt: Blogeintrag, Nachricht, Produkt.", s: "<article>\n  <h2>«Titel»</h2>\n  <p></p>\n</article>" },
      { n: "<aside>", k: "Randbereich (Seitenleiste, Zusatzinfo)", s: "<aside>\n  ¦\n</aside>" },
      { n: "<footer>", k: "Fußbereich (Impressum, Kontakt, ©)", s: "<footer>\n  <p>&copy; «2026»</p>\n</footer>" },
      { n: "<div>", k: "Neutraler Block-Container", t: "Ohne eigene Bedeutung – zum Gruppieren für das Layout mit CSS. Wenn ein semantischer Bereich passt (header, nav, main …), ist der besser.",
        a: [["class", "Name für CSS (mehrfach verwendbar)"], ["id", "eindeutiger Name (nur einmal pro Seite)"]],
        s: '<div class="«name»">\n  {{sel:}}\n</div>' },
      { n: "<details>", k: "Aufklappbarer Bereich", t: "<summary> ist die Zeile, die man anklickt.", a: [["open", "am Anfang aufgeklappt"]],
        s: "<details>\n  <summary>«Mehr anzeigen»</summary>\n  <p></p>\n</details>" }
    ] },
    { g: "Attribute", items: [
      { n: "class", k: "Name für CSS – mehrfach verwendbar", t: "In CSS mit Punkt: .name { … }. Ein Element kann mehrere Klassen haben, getrennt durch Leerzeichen.",
        s: ' class="«name»"' },
      { n: "id", k: "Eindeutiger Name – nur einmal pro Seite", t: "In CSS mit Raute: #name { … }. Auch Ziel für Sprungmarken (href=\"#name\"). Keine Leerzeichen.",
        s: ' id="«name»"' },
      { n: "style", k: "CSS direkt am Element", t: "Gilt nur für dieses eine Element. Besser ist eine Regel im CSS – dann lässt sie sich wiederverwenden.",
        s: ' style="«color: red;»"' },
      { n: "title", k: "Text, der beim Überfahren mit der Maus erscheint", s: ' title="«Hinweis»"' },
      { n: "lang", k: "Sprache des Inhalts", t: "Auf <html> für die ganze Seite, an einzelnen Elementen für fremdsprachige Stellen.", s: ' lang="«en»"' },
      { n: "hidden", k: "Element ausblenden", s: " hidden" }
    ] }
  ],

  css: [
    { g: "Selektoren", items: [
      { r: true, n: "element", k: "Alle Elemente eines Typs", t: "Trifft z. B. alle <p> der Seite.", s: "«p» {\n  ¦\n}" },
      { r: true, n: ".klasse", k: "Alle Elemente mit class=\"…\"", t: "Im HTML: class=\"hinweis\". Im CSS mit Punkt davor.", s: ".«klasse» {\n  ¦\n}" },
      { r: true, n: "#id", k: "Das eine Element mit id=\"…\"", t: "Im HTML: id=\"kopf\". Im CSS mit Raute davor. Wiegt stärker als Klassen.", s: "#«id» {\n  ¦\n}" },
      { r: true, n: "a b", k: "Nachfahre: b irgendwo innerhalb von a", t: "nav a trifft alle Links, die in einem <nav> stehen – egal wie tief.", s: "«nav a» {\n  ¦\n}" },
      { r: true, n: "a > b", k: "Kind: b direkt in a", t: "ul > li trifft nur die Listenpunkte, die direkt im <ul> stehen.", s: "«ul > li» {\n  ¦\n}" },
      { r: true, n: "a, b", k: "Gruppe: gleiche Regeln für mehrere Selektoren", s: "«h1, h2, h3» {\n  ¦\n}" },
      { r: true, n: ":hover", k: "Wenn die Maus darüber ist", t: "Auch :active (beim Klicken) und :focus (wenn ausgewählt, z. B. Eingabefeld).", s: "«a»:hover {\n  ¦\n}" },
      { r: true, n: ":focus", k: "Wenn das Element ausgewählt ist", t: "Z. B. das Eingabefeld, in dem der Cursor steht.", s: "«input»:focus {\n  ¦\n}" },
      { r: true, n: ":nth-child()", k: "Das n-te Kind", a: [["2", "das zweite"], ["odd / even", "jedes ungerade / gerade (z. B. Tabellenzeilen)"], ["3n", "jedes dritte"]],
        s: "«tr»:nth-child(even) {\n  ¦\n}" },
      { r: true, n: ":first-child", k: "Das erste Kind", t: "Auch :last-child.", s: "«li»:first-child {\n  ¦\n}" },
      { r: true, n: "::before / ::after", k: "Inhalt vor oder nach dem Element einfügen", t: "Braucht immer die Eigenschaft content.", s: "«.hinweis»::before {\n  content: \"→ \";\n}" },
      { r: true, n: "[attribut]", k: "Elemente mit einem bestimmten Attribut", s: "«input[type=\"text\"]» {\n  ¦\n}" },
      { r: true, n: "*", k: "Alle Elemente", t: "Oft für * { box-sizing: border-box; }.", s: "* {\n  «box-sizing: border-box;»\n}" }
    ] },
    { g: "Schrift & Text", items: [
      { n: "color", k: "Textfarbe", a: [["red", "Farbname"], ["#ff0000", "Hex-Wert (rot, grün, blau)"], ["rgb(255, 0, 0)", "RGB-Werte 0–255"], ["rgba(0, 0, 0, 0.5)", "mit Deckkraft 0–1"]], s: "color: «#333333»;" },
      { n: "font-family", k: "Schriftart", t: "Mehrere Schriften mit Komma: Gibt es die erste nicht, nimmt der Browser die nächste. Am Ende eine allgemeine Familie.",
        a: [["Arial, sans-serif", "ohne Serifen"], ["Georgia, serif", "mit Serifen"], ["monospace", "feste Zeichenbreite"]], s: "font-family: «Arial, sans-serif»;" },
      { n: "font-size", k: "Schriftgröße", a: [["16px", "feste Größe in Pixeln"], ["1.5em", "relativ zur Schrift des Elternelements"], ["2rem", "relativ zur Grundschrift (meist 16px)"], ["120%", "in Prozent"]], s: "font-size: «16px»;" },
      { n: "font-weight", k: "Schriftstärke", a: [["normal", "normal (400)"], ["bold", "fett (700)"], ["100 … 900", "fein abgestuft"]], s: "font-weight: «bold»;" },
      { n: "font-style", k: "Kursiv", a: [["italic", "kursiv"], ["normal", "nicht kursiv"]], s: "font-style: «italic»;" },
      { n: "line-height", k: "Zeilenabstand", a: [["1.5", "1,5-fache Schriftgröße (ohne Einheit empfohlen)"], ["24px", "fester Abstand"]], s: "line-height: «1.5»;" },
      { n: "text-align", k: "Ausrichtung des Textes", a: [["left", "links"], ["center", "zentriert"], ["right", "rechts"], ["justify", "Blocksatz"]], s: "text-align: «center»;" },
      { n: "text-decoration", k: "Unterstreichen, durchstreichen", t: "Oft genutzt, um bei Links die Unterstreichung zu entfernen.",
        a: [["none", "keine"], ["underline", "unterstrichen"], ["line-through", "durchgestrichen"]], s: "text-decoration: «none»;" },
      { n: "text-transform", k: "Groß- und Kleinbuchstaben", a: [["uppercase", "ALLES GROSS"], ["lowercase", "alles klein"], ["capitalize", "Erster Buchstabe Groß"]], s: "text-transform: «uppercase»;" },
      { n: "letter-spacing", k: "Abstand zwischen Buchstaben", s: "letter-spacing: «2px»;" },
      { n: "text-shadow", k: "Schatten hinter dem Text", a: [["2px 2px 4px #000", "x-Versatz, y-Versatz, Unschärfe, Farbe"]], s: "text-shadow: «2px 2px 4px rgba(0, 0, 0, 0.4)»;" },
      { n: "list-style-type", k: "Art der Aufzählungszeichen", a: [["disc / circle / square", "Punkt, Kreis, Quadrat"], ["decimal", "1, 2, 3"], ["none", "keine (z. B. für Navigationen)"]], s: "list-style-type: «none»;" }
    ] },
    { g: "Farben & Hintergrund", items: [
      { n: "background-color", k: "Hintergrundfarbe", a: [["#f0f0f0", "Hex-Wert"], ["lightblue", "Farbname"], ["transparent", "durchsichtig"]], s: "background-color: «#f0f0f0»;" },
      { n: "background-image", k: "Hintergrundbild", t: "Der Pfad gilt von der CSS-Datei aus! Liegt sie im Ordner css, geht es mit ../ eine Ebene hoch: url(\"../bilder/bild.jpg\").",
        s: "background-image: url(\"«bilder/bild.jpg»\");" },
      { n: "background-size", k: "Größe des Hintergrundbildes", a: [["cover", "füllt die Fläche ganz aus (schneidet ab)"], ["contain", "ganzes Bild sichtbar"], ["100px auto", "feste Breite"]], s: "background-size: «cover»;" },
      { n: "background-position", k: "Lage des Hintergrundbildes", a: [["center", "mittig"], ["top right", "oben rechts"]], s: "background-position: «center»;" },
      { n: "background-repeat", k: "Hintergrundbild wiederholen", a: [["no-repeat", "nur einmal"], ["repeat", "kacheln"], ["repeat-x", "nur waagrecht"]], s: "background-repeat: «no-repeat»;" },
      { n: "linear-gradient", k: "Farbverlauf als Hintergrund", a: [["to right", "Richtung (to bottom ist Standard)"], ["45deg", "Richtung als Winkel"], ["Farben", "beliebig viele, mit Komma getrennt"]],
        s: "background: linear-gradient(«to right», #0f766e, #2dd4bf);" },
      { n: "opacity", k: "Deckkraft des ganzen Elements", a: [["1", "voll sichtbar"], ["0.5", "halb durchsichtig"], ["0", "unsichtbar (nimmt aber Platz ein)"]], s: "opacity: «0.5»;" }
    ] },
    { g: "Box-Modell", items: [
      { n: "width / height", k: "Breite und Höhe", t: "Gilt standardmäßig nur für den Inhalt – padding und border kommen dazu (außer mit box-sizing: border-box).",
        a: [["300px", "fest"], ["50%", "Anteil vom Elternelement"], ["100vw / 100vh", "ganze Fensterbreite / -höhe"], ["auto", "automatisch"]], s: "width: «300px»;" },
      { n: "max-width", k: "Höchstbreite", t: "Mit max-width wird ein Element auf großen Bildschirmen nicht zu breit, auf kleinen aber schmaler. Auch min-width, max-height, min-height.", s: "max-width: «800px»;" },
      { n: "margin", k: "Außenabstand", t: "Abstand nach außen zu anderen Elementen.",
        a: [["10px", "alle vier Seiten"], ["10px 20px", "oben/unten, links/rechts"], ["10px 20px 5px 0", "oben, rechts, unten, links (im Uhrzeigersinn)"], ["0 auto", "Block waagrecht zentrieren (braucht eine Breite)"], ["margin-top …", "einzelne Seiten"]],
        s: "margin: «10px»;" },
      { n: "padding", k: "Innenabstand", t: "Abstand zwischen Rand und Inhalt. Die Hintergrundfarbe reicht bis in den Innenabstand.",
        a: [["10px", "alle vier Seiten"], ["10px 20px", "oben/unten, links/rechts"], ["padding-left …", "einzelne Seiten"]], s: "padding: «10px»;" },
      { n: "margin: 0 auto", k: "Block in der Mitte zentrieren", t: "Funktioniert nur, wenn das Element eine Breite (width oder max-width) hat.", s: "max-width: «800px»;\nmargin: 0 auto;" },
      { n: "box-sizing", k: "Was zur Breite zählt", a: [["border-box", "width enthält padding und border – rechnet sich viel leichter"], ["content-box", "Standard: nur der Inhalt"]], s: "box-sizing: «border-box»;" },
      { n: "overflow", k: "Was passiert, wenn der Inhalt nicht passt", a: [["visible", "ragt heraus (Standard)"], ["hidden", "wird abgeschnitten"], ["auto", "Scrollbalken bei Bedarf"]], s: "overflow: «auto»;" }
    ] },
    { g: "Rahmen & Schatten", items: [
      { n: "border", k: "Rahmen", a: [["1px solid black", "Dicke, Linienart, Farbe"], ["solid / dashed / dotted / double", "Linienarten"], ["border-bottom …", "nur eine Seite"], ["none", "kein Rahmen"]], s: "border: «1px solid #cccccc»;" },
      { n: "border-radius", k: "Abgerundete Ecken", a: [["8px", "leicht abgerundet"], ["50%", "Kreis (bei quadratischen Elementen)"]], s: "border-radius: «8px»;" },
      { n: "box-shadow", k: "Schatten um das Element", a: [["0 4px 8px rgba(0,0,0,.2)", "x-Versatz, y-Versatz, Unschärfe, Farbe"], ["inset …", "Schatten nach innen"]], s: "box-shadow: «0 4px 8px rgba(0, 0, 0, 0.2)»;" },
      { n: "outline", k: "Umriss (verändert die Größe nicht)", t: "Wird z. B. bei :focus angezeigt. Nicht ersatzlos entfernen – Tastaturnutzer brauchen ihn.", s: "outline: «2px solid #0f766e»;" },
      { n: "border-collapse", k: "Tabellenlinien zusammenfassen", t: "Ohne diese Angabe hat jede Zelle einen eigenen Rahmen mit Lücke dazwischen.", a: [["collapse", "einfache Linien"], ["separate", "getrennte Rahmen (Standard)"]],
        s: "border-collapse: «collapse»;" }
    ] },
    { g: "Layout", items: [
      { n: "display", k: "Wie sich ein Element anordnet", a: [["block", "neue Zeile, ganze Breite (z. B. div, p)"], ["inline", "im Textfluss, ohne Breite/Höhe (z. B. span, a)"], ["inline-block", "im Textfluss, aber mit Breite/Höhe"], ["none", "ausgeblendet, nimmt keinen Platz ein"], ["flex / grid", "Container für Flexbox oder Grid"]],
        s: "display: «block»;" },
      { n: "Flexbox", k: "Elemente in einer Reihe anordnen", t: "Kommt auf den Container (das Elternelement). Die Kinder werden dann nebeneinander angeordnet.",
        a: [["flex-direction", "row (nebeneinander) oder column (untereinander)"], ["justify-content", "Verteilung in Hauptrichtung: flex-start, center, space-between, space-around"], ["align-items", "Ausrichtung quer dazu: stretch, center, flex-start"], ["gap", "Abstand zwischen den Kindern"], ["flex-wrap: wrap", "in die nächste Zeile umbrechen"]],
        s: "display: flex;\njustify-content: «space-between»;\nalign-items: center;\ngap: 10px;" },
      { n: "justify-content", k: "Flexbox: Verteilung in Hauptrichtung", a: [["flex-start", "am Anfang"], ["center", "mittig"], ["flex-end", "am Ende"], ["space-between", "erstes und letztes außen, Rest gleichmäßig"], ["space-around", "gleich viel Platz um jedes"]], s: "justify-content: «center»;" },
      { n: "align-items", k: "Flexbox: Ausrichtung quer zur Hauptrichtung", a: [["stretch", "auf ganze Höhe ziehen (Standard)"], ["center", "mittig"], ["flex-start / flex-end", "oben / unten"]], s: "align-items: «center»;" },
      { n: "flex", k: "Flexbox-Kind: wie viel Platz es bekommt", a: [["1", "teilt sich den freien Platz gleichmäßig"], ["2", "bekommt doppelt so viel wie flex: 1"], ["0 0 200px", "fest 200px breit"]], s: "flex: «1»;" },
      { n: "Grid", k: "Raster mit Spalten (und Zeilen)", t: "Kommt auf den Container. fr ist ein Anteil des freien Platzes.",
        a: [["grid-template-columns", "Spalten, z. B. 1fr 1fr 1fr (drei gleich breite) oder 200px 1fr"], ["repeat(3, 1fr)", "Kurzform für drei gleiche Spalten"], ["gap", "Abstand zwischen den Zellen"]],
        s: "display: grid;\ngrid-template-columns: «repeat(3, 1fr)»;\ngap: 20px;" },
      { n: "grid-column", k: "Grid-Kind über mehrere Spalten", a: [["span 2", "über zwei Spalten"], ["1 / 3", "von Linie 1 bis Linie 3"], ["1 / -1", "über die ganze Breite"]], s: "grid-column: «span 2»;" },
      { n: "gap", k: "Abstand zwischen Flex- oder Grid-Kindern", s: "gap: «20px»;" }
    ] },
    { g: "Position", items: [
      { n: "position", k: "Art der Positionierung", t: "Mit top, right, bottom, left wird das Element dann verschoben.",
        a: [["static", "normal im Fluss (Standard)"], ["relative", "verschoben gegenüber der normalen Lage; Bezugspunkt für absolute Kinder"], ["absolute", "frei platziert im nächsten positionierten Elternelement"], ["fixed", "fest am Bildschirm, scrollt nicht mit"], ["sticky", "scrollt mit, bleibt dann oben kleben"]],
        s: "position: «relative»;" },
      { n: "top / left …", k: "Verschiebung bei position", a: [["top: 0", "Abstand von oben"], ["left: 20px", "Abstand von links"], ["right / bottom", "von rechts / unten"]], s: "top: «0»;\nleft: 0;" },
      { n: "sticky Kopfzeile", k: "Leiste, die beim Scrollen oben bleibt", s: "position: sticky;\ntop: «0»;\nbackground-color: white;" },
      { n: "z-index", k: "Was liegt oben, wenn sich Elemente überlappen", t: "Höhere Zahl = weiter vorne. Wirkt nur bei positionierten Elementen.", s: "z-index: «10»;" },
      { n: "float", k: "Bild umfließen lassen", t: "Text fließt um das Element herum. Für Layouts heute besser Flexbox oder Grid.", a: [["left / right", "Element links / rechts, Text daneben"], ["none", "kein Umfließen"]], s: "float: «left»;" }
    ] },
    { g: "Effekte", items: [
      { n: "transition", k: "Weicher Übergang bei Änderungen (z. B. :hover)", a: [["all 0.3s", "alle Eigenschaften in 0,3 Sekunden"], ["background-color 1s", "nur diese Eigenschaft"], ["ease / linear", "Verlauf der Geschwindigkeit"]], s: "transition: «all 0.3s ease»;" },
      { n: "transform", k: "Drehen, verschieben, vergrößern", a: [["rotate(45deg)", "drehen"], ["scale(1.2)", "vergrößern"], ["translate(10px, 20px)", "verschieben"]], s: "transform: «scale(1.1)»;" },
      { n: "cursor", k: "Aussehen des Mauszeigers", a: [["pointer", "Hand (wie bei Links)"], ["default", "Pfeil"], ["not-allowed", "verboten"]], s: "cursor: «pointer»;" },
      { n: "filter", k: "Bildeffekte", a: [["grayscale(100%)", "schwarz-weiß"], ["blur(4px)", "unscharf"], ["brightness(120%)", "heller"]], s: "filter: «grayscale(100%)»;" },
      { r: true, n: "@keyframes", k: "Eigene Animation", t: "Mit @keyframes beschreibt man die Animation, mit animation wendet man sie auf ein Element an.",
        a: [["animation", "Name Dauer Wiederholung, z. B. blinken 1s infinite"]],
        s: "@keyframes «blinken» {\n  from { opacity: 1; }\n  to { opacity: 0; }\n}" },
      { n: "animation", k: "Animation auf ein Element anwenden", a: [["Name", "Name aus @keyframes"], ["1s", "Dauer"], ["infinite", "endlos"], ["alternate", "hin und zurück"]], s: "animation: «blinken» 1s infinite alternate;" }
    ] },
    { g: "@-Regeln", items: [
      { r: true, n: "@media", k: "Regeln nur für bestimmte Bildschirmbreiten", t: "So passt sich die Seite an Handys an (responsive Design). Steht am besten am Ende der CSS-Datei.",
        a: [["max-width: 600px", "bis 600px breit (Handy)"], ["min-width: 900px", "ab 900px (größere Bildschirme)"], ["print", "beim Drucken"]],
        s: "@media (max-width: «600px») {\n  ¦\n}" },
      { r: true, n: ":root Variablen", k: "Farben und Werte einmal festlegen, überall benutzen", t: "Variablen beginnen mit --. Benutzt werden sie mit var(--name).",
        s: ":root {\n  --«hauptfarbe»: #0f766e;\n}" },
      { n: "var()", k: "Variable benutzen", s: "color: var(--«hauptfarbe»);" },
      { r: true, n: "@import", k: "Andere CSS-Datei einbinden", t: "Muss ganz oben in der CSS-Datei stehen.", s: "@import url(\"«andere.css»\");" },
      { r: true, n: "@font-face", k: "Eigene Schriftdatei verwenden", t: "Die Schriftdatei (.woff2) muss im Projekt liegen. Danach mit font-family: \"MeineSchrift\" benutzen.",
        s: "@font-face {\n  font-family: \"«MeineSchrift»\";\n  src: url(\"schriften/meine-schrift.woff2\");\n}" }
    ] }
  ]
};
