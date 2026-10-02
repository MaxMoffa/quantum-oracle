# Quantum Oracle

Bomboniera di laurea di **Dott. Umberto Casaburi** — Computer Science and Engineering.
Tesi: *"Noise-based side-channel attacks: inferring the coupling map of NISQ Quantum Computers"*.

Una Magic 8 Ball quantistica: il tag NFC apre il sito, agitando il telefono il qubit entra in
sovrapposizione sulla sfera di Bloch, fermandosi la funzione d'onda collassa e compare una
predizione sul futuro. Il pulsante "Cos'è?" apre una spiegazione per chi non è del settore.

## Struttura

| File | Contenuto |
|------|-----------|
| `index.html` | Markup delle tre schermate (intro, misura, risultato) |
| `style.css` | Stile |
| `app.js` | Shake detection, simulazione del qubit, canvas, audio, condivisione |
| `phrases.js` | Predizioni IT/EN con `id` e categoria |
| `i18n.js` | Testi dell'interfaccia IT/EN e contenuto del dialog informativo |

Sito statico, nessuna build. Per aggiungere predizioni basta aggiungere voci in `phrases.js`
in fondo alla categoria, con un `id` nuovo (gli `id` esistenti non vanno rinumerati: il bias li usa).

## Bias sulle predizioni (URL)

Il parametro `bias` cambia il peso di categorie o singole predizioni:

```
?bias=chiave:peso,chiave:peso,...
```

- **chiave**: `*` (tutte), una categoria oppure l'`id` di una predizione. Vince la più specifica
  (`id` > categoria > `*`).
- **peso**: numero ≥ 0, default 1. Peso 0 esclude, peso 10 rende dieci volte più probabile.
  Se ometti il numero (`?bias=love`) vale 3.
- La predizione appena uscita non si ripete subito e quelle recenti hanno peso ridotto,
  quindi anche una predizione con peso altissimo non esce a ogni misura (a meno che sia l'unica ammessa).

Categorie: `love`, `work`, `study`, `travel`, `luck`, `friends`, `tech`, `life`
(id da `love-01` a `love-12`, `work-01`…`work-12`, ecc.; elenco completo in `phrases.js`).

Esempi:

| URL | Effetto |
|-----|---------|
| `?bias=love:5` | amore 5× più probabile |
| `?bias=*:0,travel:1,luck:1` | solo viaggi e fortuna |
| `?bias=friends-02:20` | spinge "brinderai alla salute del Dott. Casaburi" |
| `?bias=*:0,love-04:1` | esce sempre e solo `love-04` |

Per non rendere leggibile il bias nell'URL del tag NFC si può usare `?b=` con la stessa stringa
in base64url:

```sh
node -e "console.log(Buffer.from('*:0,love:1,friends-02:50').toString('base64url'))"
# → ?b=KjowLGxvdmU6MSxmcmllbmRzLTAyOjUw
```

Con un bias attivo, la console del browser mostra la tabella dei pesi applicati.

## Feedback

- **Vibrazione**: su Android usa la Vibration API. Su iPhone (iOS 18+) usa un `<input switch>`
  nascosto che genera un tick aptico di sistema: è un comportamento non ufficiale di Safari,
  quindi può non funzionare su tutte le versioni.
- **Suono**: pad morbido che compare solo mentre si agita e un arpeggio leggero al collasso.
  Si spegne dal footer.

## Sviluppo locale

```sh
python -m http.server 5180
```

Su desktop si "agita" tenendo premuto il qubit. L'accelerometro funziona solo in HTTPS,
quindi su telefono va provato dopo il deploy (o con un tunnel HTTPS).

## Deploy su GitHub Pages

1. Crea il repo `quantum-oracle` su GitHub e fai push del branch `main`.
2. Settings → Pages → Source: *Deploy from a branch* → `main` / `/ (root)`.
3. Il sito sarà su `https://<utente>.github.io/quantum-oracle/`.

## Tag NFC

Con l'app **NFC Tools** → Scrivi → Aggiungi record → URL → incolla l'URL del sito.
Un NTAG213 basta. Il blocco in sola lettura del tag è **irreversibile**: farlo solo
quando l'URL è definitivo.

## RNG quantistico (opzionale)

`CONFIG.qrngEndpoint` in `app.js` accetta un endpoint che risponda a GET con
`{ "value": <uint32> }` (es. un Cloudflare Worker che fa da proxy all'API ANU QRNG
tenendo la chiave segreta). Se è vuoto o non risponde entro 1,5 s si usa
`crypto.getRandomValues`; la card del risultato indica quale sorgente è stata usata.
