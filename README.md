# Quantum Oracle

Bomboniera di laurea di **Dott. Umberto Casaburi** — Computer Science and Engineering.
Tesi: *"Noise-based side-channel attacks: inferring the coupling map of NISQ Quantum Computers"*.

Una Magic 8 Ball quantistica: il tag NFC apre il sito, agitando il telefono il qubit entra in
sovrapposizione sulla sfera di Bloch, fermandosi la funzione d'onda collassa e compare una frase.

## Struttura

| File | Contenuto |
|------|-----------|
| `index.html` | Markup delle tre schermate (intro, misura, risultato) |
| `style.css` | Stile |
| `app.js` | Shake detection, simulazione del qubit, canvas, audio, condivisione |
| `phrases.js` | Frasi IT/EN per categoria (`life`, `uni`, `ai`, `quantum`, `thesis`) |
| `i18n.js` | Testi dell'interfaccia IT/EN |

Sito statico, nessuna build. Per aggiungere frasi basta aggiungere voci in `phrases.js`.

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
