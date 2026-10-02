// UI strings. Phrases live in phrases.js.

// Party favor: Bloch sphere with two spinning rings (before) and flattened rings (after measurement).
const FAVOR_SVG = `
<svg class="favor" viewBox="0 0 340 150" role="img" aria-hidden="true">
  <g transform="translate(78 75)">
    <circle r="58" class="f-shell"/>
    <g transform="rotate(-24)"><circle r="58" class="f-ring f-ring-a f-flip"/></g>
    <g transform="rotate(62)"><circle r="47" class="f-ring f-ring-b f-flip f-flip-b"/></g>
    <circle r="17" class="f-core"/>
    <text class="f-nfc" y="4">NFC</text>
  </g>
  <g class="f-arrow" transform="translate(170 75)">
    <path d="M-22 0 H18 M10 -7 L19 0 L10 7"/>
    <text y="-14">|ψ⟩ → |x⟩</text>
  </g>
  <g transform="translate(262 75)">
    <circle r="58" class="f-ring f-ring-a"/>
    <circle r="47" class="f-ring f-ring-b"/>
    <circle r="17" class="f-core f-core-on"/>
    <text class="f-nfc" y="4">NFC</text>
  </g>
</svg>`;

window.I18N = {
  it: {
    introSub: "Fai una domanda all'universo. Agita il telefono per mettere il qubit in sovrapposizione, poi fermati: la misura svelerà il tuo futuro.",
    start: "Inizializza il qubit |0⟩",
    introHint: "Su iPhone ti verrà chiesto l'accesso ai sensori di movimento.",
    howItWorks: "Come funziona?",
    holdAria: "Tieni premuto per agitare il qubit",
    superposition: "Sovrapposizione",
    idle: "Agita il telefono\no tieni premuto il qubit",
    idleNoMotion: "Tieni premuto il qubit\nper metterlo in sovrapposizione",
    charging: "Sovrapposizione in corso…",
    ready: "Ora fermati.\nLascia che il sistema venga misurato…",
    decoherence: "Decoerenza! Continua ad agitare",
    measuring: "Misurazione: collasso della funzione d'onda…",
    outcome: "La tua predizione",
    again: "Misura di nuovo",
    share: "Condividi",
    shakeAgain: "…oppure agita di nuovo il telefono",
    degree: "Laurea in Computer Science and Engineering",
    soundOn: "♪ ON",
    soundOff: "♪ OFF",
    infoBtn: "Cos'è?",
    infoClose: "Chiudi",
    copied: "Copiato negli appunti",
    shareText: (p) => `«${p}»\n— la mia predizione dal Quantum Oracle ⚛`,
    shots: "shots",
    fidelity: "fedeltà",
    source: { crypto: "rng: classico", qrng: "rng: quantistico ⚛" },
    cats: {
      love: "|amore⟩", work: "|lavoro⟩", study: "|studio⟩", travel: "|viaggi⟩",
      luck: "|fortuna⟩", friends: "|amicizia⟩", tech: "|tech⟩", life: "|vita⟩"
    },
    infoTitle: "Cos'è il Quantum Oracle?",
    infoHtml: `
      <p class="lead">È la bomboniera di laurea di <strong>Umberto Casaburi</strong>: un piccolo oracolo ispirato ai computer quantistici, l'argomento della sua tesi. Ecco come funziona, senza formule.</p>

      <h3>Bit e qubit</h3>
      <p>Un computer normale ragiona con i <strong>bit</strong>: ognuno vale 0 oppure 1, come una moneta appoggiata sul tavolo, testa o croce.</p>
      <p>Un computer quantistico usa i <strong>qubit</strong>. Un qubit somiglia a una moneta che gira su sé stessa: finché gira non è né testa né croce, ma un po' entrambe. Questa condizione si chiama <strong>sovrapposizione</strong>.</p>

      <h3>La misura</h3>
      <p>Quando fermi la moneta con la mano, lei deve "scegliere": testa o croce. Con i qubit succede lo stesso: per leggerli bisogna <strong>misurarli</strong>, e in quel momento la sovrapposizione svanisce e il qubit <strong>collassa</strong> su 0 oppure su 1. Prima della misura si possono conoscere solo le probabilità dei due risultati.</p>

      <h3>La sfera di Bloch</h3>
      <p>I fisici disegnano lo stato di un qubit come un punto su una sfera, la <strong>sfera di Bloch</strong>: il polo nord è 0, il polo sud è 1, e tutti gli altri punti sono sovrapposizioni. La freccia luminosa che vedi nel sito è proprio il qubit su questa sfera.</p>

      <h3>La tua bomboniera</h3>
      ${FAVOR_SVG}
      <p class="caption">A sinistra: anelli liberi, il qubit è in sovrapposizione. A destra: anelli appiattiti, lo stato è misurato.</p>
      <p>La bomboniera è una piccola sfera di Bloch. I <strong>due anelli che ruotano</strong> rappresentano il qubit in sovrapposizione: finché girano, tutto è ancora possibile. Il <strong>cerchio al centro</strong> custodisce il contenuto e il chip NFC che ti ha portato qui.</p>
      <p>Per leggerlo bisogna <strong>appiattire gli anelli</strong>: è proprio ciò che fa la misura alla fine di un circuito quantistico, che "schiaccia" tutte le possibilità in un unico risultato.</p>

      <h3>Come si usa il sito</h3>
      <ol>
        <li>Avvicina il telefono al centro della bomboniera.</li>
        <li>Tocca <em>Inizializza il qubit</em>: il qubit parte dallo stato 0.</li>
        <li>Agita il telefono: il qubit entra in sovrapposizione e la barra si riempie.</li>
        <li>Fermati: il sistema viene misurato, la funzione d'onda collassa e compare la tua predizione.</li>
      </ol>
      <p>Ogni misura dà un risultato diverso: puoi riprovare quante volte vuoi.</p>

      <h3>La tesi di Umberto</h3>
      <p>I computer quantistici di oggi si chiamano <strong>NISQ</strong>: funzionano, ma sono ancora piccoli e disturbati da molto <strong>rumore</strong>.</p>
      <p>All'interno di un chip quantistico, ogni qubit è collegato solo ad alcuni vicini; lo schema di questi collegamenti si chiama <strong>coupling map</strong>. La tesi studia come il rumore possa diventare un <strong>side-channel</strong>, un "canale laterale": osservandolo, si riesce a dedurre la coupling map. Un po' come capire la disposizione delle stanze di una casa ascoltando i rumori attraverso le pareti.</p>
      <p>La rete di puntini luminosi sullo sfondo del sito è proprio una coupling map.</p>

      <p class="fine">Le predizioni sono scelte a caso e sono solo un gioco. Nessun qubit è stato maltrattato. 🎓</p>
    `,
    log: [
      "Inizializzazione qubit q[{q}]…",
      "Applico gate H su q[{q}]",
      "CNOT q[{q}] → q[{q2}]",
      "Crosstalk rilevato su q[{q}]–q[{q2}]",
      "Mappando la coupling map…",
      "T1 = {t} µs, T2 = {t2} µs",
      "Rumore NISQ: {n}%",
      "Readout error q[{q}]: {e}%",
      "Side-channel: ampiezza anomala su q[{q2}]",
      "Calibrazione in corso…",
      "Entanglement q[{q}] ⊗ q[{q2}]",
      "Rotazione Rz(π/{d}) su q[{q}]"
    ]
  },
  en: {
    introSub: "Ask the universe a question. Shake your phone to put the qubit in superposition, then stop: the measurement will reveal your future.",
    start: "Initialize the qubit |0⟩",
    introHint: "On iPhone you'll be asked for motion sensor access.",
    howItWorks: "How does it work?",
    holdAria: "Press and hold to shake the qubit",
    superposition: "Superposition",
    idle: "Shake your phone\nor press and hold the qubit",
    idleNoMotion: "Press and hold the qubit\nto put it in superposition",
    charging: "Entering superposition…",
    ready: "Now stop.\nLet the system be measured…",
    decoherence: "Decoherence! Keep shaking",
    measuring: "Measuring: wave function collapse…",
    outcome: "Your prediction",
    again: "Measure again",
    share: "Share",
    shakeAgain: "…or shake your phone again",
    degree: "Degree in Computer Science and Engineering",
    soundOn: "♪ ON",
    soundOff: "♪ OFF",
    infoBtn: "What is it?",
    infoClose: "Close",
    copied: "Copied to clipboard",
    shareText: (p) => `“${p}”\n— my prediction from the Quantum Oracle ⚛`,
    shots: "shots",
    fidelity: "fidelity",
    source: { crypto: "rng: classical", qrng: "rng: quantum ⚛" },
    cats: {
      love: "|love⟩", work: "|work⟩", study: "|study⟩", travel: "|travel⟩",
      luck: "|luck⟩", friends: "|friends⟩", tech: "|tech⟩", life: "|life⟩"
    },
    infoTitle: "What is the Quantum Oracle?",
    infoHtml: `
      <p class="lead">It's <strong>Umberto Casaburi</strong>'s graduation party favor: a small oracle inspired by quantum computers, the topic of Umberto's thesis. Here's how it works, no equations involved.</p>

      <h3>Bits and qubits</h3>
      <p>A regular computer thinks in <strong>bits</strong>: each one is either 0 or 1, like a coin lying on a table, heads or tails.</p>
      <p>A quantum computer uses <strong>qubits</strong>. A qubit is like a spinning coin: while it spins it's neither heads nor tails, but a bit of both. This is called <strong>superposition</strong>.</p>

      <h3>Measurement</h3>
      <p>When you stop the coin with your hand, it has to "choose": heads or tails. Qubits work the same way: to read them you have to <strong>measure</strong> them, and at that moment the superposition vanishes and the qubit <strong>collapses</strong> to 0 or 1. Before measuring, you can only know the probabilities of the two outcomes.</p>

      <h3>The Bloch sphere</h3>
      <p>Physicists draw the state of a qubit as a point on a sphere, the <strong>Bloch sphere</strong>: the north pole is 0, the south pole is 1, and every other point is a superposition. The glowing arrow on this site is exactly that qubit on its sphere.</p>

      <h3>Your party favor</h3>
      ${FAVOR_SVG}
      <p class="caption">Left: free rings, the qubit is in superposition. Right: flattened rings, the state has been measured.</p>
      <p>The favor is a small Bloch sphere. The <strong>two spinning rings</strong> represent the qubit in superposition: while they spin, everything is still possible. The <strong>circle in the middle</strong> holds the content and the NFC chip that brought you here.</p>
      <p>To read it, you have to <strong>flatten the rings</strong>: exactly what a measurement does at the end of a quantum circuit, squeezing every possibility into a single outcome.</p>

      <h3>How to use the site</h3>
      <ol>
        <li>Hold your phone near the center of the favor.</li>
        <li>Tap <em>Initialize the qubit</em>: the qubit starts in state 0.</li>
        <li>Shake your phone: the qubit enters superposition and the bar fills up.</li>
        <li>Stop: the system is measured, the wave function collapses and your prediction appears.</li>
      </ol>
      <p>Every measurement gives a different result: try as many times as you like.</p>

      <h3>Umberto's thesis</h3>
      <p>Today's quantum computers are called <strong>NISQ</strong>: they work, but they're still small and disturbed by a lot of <strong>noise</strong>.</p>
      <p>Inside a quantum chip, each qubit is connected only to a few neighbors; the layout of these connections is called the <strong>coupling map</strong>. The thesis studies how noise can become a <strong>side channel</strong>: by observing it, you can infer the coupling map. A bit like figuring out the layout of a house by listening to the sounds through its walls.</p>
      <p>The network of glowing dots in the background of this site is a coupling map.</p>

      <p class="fine">Predictions are picked at random and are just for fun. No qubits were harmed. 🎓</p>
    `,
    log: [
      "Initializing qubit q[{q}]…",
      "Applying H gate on q[{q}]",
      "CNOT q[{q}] → q[{q2}]",
      "Crosstalk detected on q[{q}]–q[{q2}]",
      "Mapping the coupling map…",
      "T1 = {t} µs, T2 = {t2} µs",
      "NISQ noise: {n}%",
      "Readout error q[{q}]: {e}%",
      "Side-channel: anomalous amplitude on q[{q2}]",
      "Calibrating…",
      "Entangling q[{q}] ⊗ q[{q2}]",
      "Rotation Rz(π/{d}) on q[{q}]"
    ]
  }
};
