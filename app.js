(() => {
  "use strict";

  const CONFIG = {
    // Optional quantum RNG proxy (see README). Must answer GET with JSON { "value": <uint32> }.
    qrngEndpoint: "",
    qrngTimeoutMs: 1500,
    chargeRate: 0.6,        // superposition gained per second at full shake
    decoherenceRate: 0.22,  // superposition lost per second when still
    stopDelayMs: 650,       // stillness required before measuring
    measureMs: 1100,        // spin-down before the collapse
    revealMs: 420           // collapse flash -> result card
  };

  const TAU = Math.PI * 2;
  const PITCH = 0.38;

  const $ = (id) => document.getElementById(id);
  const body = document.body;
  const els = {
    canvas: $("scene"), flash: $("flash"), ket: $("ket"),
    p0: $("p0"), p1: $("p1"), p0v: $("p0v"), p1v: $("p1v"),
    energy: $("energy"), energyv: $("energyv"), status: $("status"), log: $("log"),
    orb: $("orb"), phrase: $("phrase"), cat: $("cat"), meta: $("meta"),
    toast: $("toast"), soundBtn: $("soundBtn")
  };
  const ctx = els.canvas.getContext("2d");

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } }
  };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a); // visuals only
  const randInt = (n) => Math.floor(Math.random() * n);
  const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) * 1.4;

  // ---------------------------------------------------------------- i18n

  function detectLang() {
    const saved = store.get("qo.lang");
    if (saved === "it" || saved === "en") return saved;
    const prefs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || "en"];
    const first = prefs.find((l) => /^(it|en)\b/i.test(l));
    return first && /^it/i.test(first) ? "it" : "en";
  }

  let lang = detectLang();
  const t = (key) => window.I18N[lang][key];

  function applyLang() {
    document.documentElement.lang = lang;
    document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll("[data-i18n-aria]").forEach((el) => el.setAttribute("aria-label", t(el.dataset.i18nAria)));
    document.querySelectorAll("[data-lang]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lang === lang)));
    $("infoBody").innerHTML = t("infoHtml");
    updateSoundBtn();
    statusKey = null;
    if (current) renderResult(false);
  }

  document.querySelectorAll("[data-lang]").forEach((b) => b.addEventListener("click", () => {
    lang = b.dataset.lang;
    store.set("qo.lang", lang);
    applyLang();
  }));

  // ---------------------------------------------------------------- info dialog

  const info = $("info");
  let infoOpen = false;

  document.querySelectorAll("[data-open-info]").forEach((b) => b.addEventListener("click", () => {
    if (info.open) return;
    info.showModal();
    info.scrollTop = 0;
    infoOpen = true;
    holding = false;
  }));
  $("infoClose").addEventListener("click", () => info.close());
  info.addEventListener("close", () => { infoOpen = false; });

  // ---------------------------------------------------------------- audio

  let soundOn = store.get("qo.sound") !== "off";
  const audio = { ctx: null };

  function initAudio() {
    if (audio.ctx) {
      if (audio.ctx.state === "suspended") audio.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ac = new AC();
    const master = ac.createGain();
    master.gain.value = soundOn ? 1 : 0;
    master.connect(ac.destination);

    // Soft echo shared by pad and chime.
    const send = ac.createGain();
    const delay = ac.createDelay(1);
    delay.delayTime.value = 0.32;
    const feedback = ac.createGain();
    feedback.gain.value = 0.35;
    const damp = ac.createBiquadFilter();
    damp.type = "lowpass";
    damp.frequency.value = 1800;
    const wet = ac.createGain();
    wet.gain.value = 0.4;
    send.connect(delay);
    delay.connect(damp);
    damp.connect(feedback);
    feedback.connect(delay);
    damp.connect(wet);
    wet.connect(master);

    // Pad: an airy A–E–A chord of pure sines, silent until the phone is shaken.
    const padGain = ac.createGain();
    padGain.gain.value = 0;
    const filter = ac.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 700;
    filter.Q.value = 0.7;
    filter.connect(padGain);
    padGain.connect(master);
    padGain.connect(send);
    const voices = [220, 329.63, 440.8].map((f, i) => {
      const o = ac.createOscillator();
      o.type = i === 0 ? "triangle" : "sine";
      o.frequency.value = f;
      const g = ac.createGain();
      g.gain.value = [0.5, 0.35, 0.2][i];
      o.connect(g);
      g.connect(filter);
      o.start();
      return o;
    });
    // Shimmer that fades in as superposition grows.
    const shimmer = ac.createOscillator();
    shimmer.type = "sine";
    shimmer.frequency.value = 659.25;
    const shimmerGain = ac.createGain();
    shimmerGain.gain.value = 0;
    shimmer.connect(shimmerGain);
    shimmerGain.connect(filter);
    shimmer.start();

    Object.assign(audio, { ctx: ac, master, send, padGain, filter, voices, shimmerGain });
  }

  function updateHum(intensity) {
    if (!audio.ctx) return;
    const now = audio.ctx.currentTime;
    const active = (mode === "hud" || mode === "measuring") && !infoOpen;
    const swell = mode === "measuring" ? 0.6 : intensity;
    audio.padGain.gain.setTargetAtTime(active ? swell * 0.05 + energy * 0.012 : 0, now, 0.25);
    audio.shimmerGain.gain.setTargetAtTime(active ? energy * 0.35 : 0, now, 0.3);
    audio.filter.frequency.setTargetAtTime(600 + energy * 1100 + intensity * 500, now, 0.3);
    // Gentle vibrato that grows with the shake.
    const wobble = 1 + Math.sin(now * 5) * 0.004 * intensity;
    audio.voices.forEach((o, i) => o.frequency.setTargetAtTime([220, 329.63, 440.8][i] * wobble, now, 0.1));
  }

  // Collapse: a soft rising C-major arpeggio, like a glass chime.
  function chime() {
    if (!audio.ctx) return;
    const ac = audio.ctx;
    const t0 = ac.currentTime + 0.01;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      const start = t0 + i * 0.075;
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = "sine";
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(0.07, start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 2.2);
      o.connect(g);
      g.connect(audio.master);
      g.connect(audio.send);
      o.start(start);
      o.stop(start + 2.3);
    });
  }

  function updateSoundBtn() {
    els.soundBtn.textContent = soundOn ? t("soundOn") : t("soundOff");
    els.soundBtn.setAttribute("aria-pressed", String(soundOn));
  }

  els.soundBtn.addEventListener("click", () => {
    soundOn = !soundOn;
    store.set("qo.sound", soundOn ? "on" : "off");
    if (audio.ctx) audio.master.gain.setTargetAtTime(soundOn ? 1 : 0, audio.ctx.currentTime, 0.02);
    updateSoundBtn();
  });

  document.addEventListener("visibilitychange", () => {
    if (!audio.ctx) return;
    if (document.hidden) audio.ctx.suspend();
    else audio.ctx.resume();
  });

  // ---------------------------------------------------------------- haptics

  // Android: Vibration API. iOS Safari has none, but toggling a hidden
  // <input type="checkbox" switch> (iOS 18+) fires a system haptic tick.
  const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  let hapticLabel = null;

  function iosTick() {
    if (!hapticLabel) {
      hapticLabel = document.createElement("label");
      hapticLabel.className = "haptic";
      hapticLabel.setAttribute("aria-hidden", "true");
      const input = document.createElement("input");
      input.type = "checkbox";
      input.setAttribute("switch", "");
      input.tabIndex = -1;
      hapticLabel.appendChild(input);
      document.body.appendChild(hapticLabel);
    }
    hapticLabel.click();
  }

  // pattern: ms on/off list, like navigator.vibrate. On iOS each "on" segment
  // becomes a tick, plus one every 60 ms for long segments.
  function vibrate(pattern) {
    if (navigator.vibrate) {
      navigator.vibrate(pattern);
      return;
    }
    if (!isIOS) return;
    const p = Array.isArray(pattern) ? pattern : [pattern];
    let at = 0;
    p.forEach((d, i) => {
      if (i % 2 === 0) {
        for (let k = 0; k < d; k += 60) setTimeout(iosTick, at + k);
      }
      at += d;
    });
  }

  // ---------------------------------------------------------------- input

  const motion = { seen: false, prev: null, intensity: 0, lastShakeAt: 0, gx: 0, gy: 0 };

  function onMotion(e) {
    const g = e.accelerationIncludingGravity;
    const lin = e.acceleration;
    if ((!g || g.x == null) && (!lin || lin.x == null)) return;
    motion.seen = true;
    const now = performance.now();

    let raw = 0;
    if (lin && lin.x != null) {
      const m = Math.hypot(lin.x, lin.y, lin.z);
      raw = clamp((m - 4) / 14, 0, 1);
    }
    if (g && g.x != null) {
      if (motion.prev) {
        const d = Math.abs(g.x - motion.prev.x) + Math.abs(g.y - motion.prev.y) + Math.abs(g.z - motion.prev.z);
        raw = Math.max(raw, clamp((d - 3) / 10, 0, 1));
      }
      motion.prev = { x: g.x, y: g.y, z: g.z };
      motion.gx = lerp(motion.gx, clamp(g.x / 9.8, -1, 1), 0.08);
      motion.gy = lerp(motion.gy, clamp(g.y / 9.8, -1, 1), 0.08);
    }
    if (raw > motion.intensity) motion.intensity = raw;
    if (raw > 0.1) motion.lastShakeAt = now;
  }

  let holding = false;
  const release = () => {
    if (!holding) return;
    holding = false;
    motion.lastShakeAt = performance.now();
  };
  els.orb.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    initAudio();
    holding = true;
    if (els.orb.setPointerCapture) els.orb.setPointerCapture(e.pointerId);
  });
  ["pointerup", "pointercancel", "lostpointercapture"].forEach((ev) => els.orb.addEventListener(ev, release));
  els.orb.addEventListener("contextmenu", (e) => e.preventDefault());
  els.orb.addEventListener("keydown", (e) => {
    if (e.key === " " || e.key === "Enter") { e.preventDefault(); holding = true; }
  });
  els.orb.addEventListener("keyup", (e) => {
    if (e.key === " " || e.key === "Enter") release();
  });

  // ---------------------------------------------------------------- state

  let mode = "intro"; // intro | hud | measuring | result
  let energy = 0;
  let hudAt = 0;
  let statusKey = null;
  let measureStart = 0, thetaStart = 0, outcomeBit = 0;
  let collapsed = false, collapseAt = 0;
  let pickResult = null;
  let current = null;
  let resultAt = 0;
  let typer = null;

  const q = { theta: 0.6, phi: 0, vTheta: 0, yaw: 0, trail: [] };

  function setScreen(s) {
    body.dataset.state = s;
    layout();
  }

  function enterHud() {
    mode = "hud";
    energy = 0;
    hudAt = performance.now();
    statusKey = null;
    logLines.length = 0;
    els.log.textContent = "";
    current = null;
    setScreen("hud");
  }

  $("startBtn").addEventListener("click", () => {
    initAudio();
    const DME = window.DeviceMotionEvent;
    const enable = () => window.addEventListener("devicemotion", onMotion);
    // iOS: the permission request must run synchronously inside the tap handler.
    if (DME && typeof DME.requestPermission === "function") {
      DME.requestPermission().then((r) => { if (r === "granted") enable(); }).catch(() => {});
    } else if (DME) {
      enable();
    }
    q.theta = 0;
    q.vTheta = 0;
    enterHud();
  });

  $("againBtn").addEventListener("click", () => { initAudio(); enterHud(); });
  $("shareBtn").addEventListener("click", share);

  function startMeasure(now) {
    mode = "measuring";
    measureStart = now;
    thetaStart = q.theta;
    outcomeBit = Math.random() < Math.sin(q.theta / 2) ** 2 ? 1 : 0;
    collapsed = false;
    pickResult = null;
    pickPhrase().then((r) => { pickResult = r; });
  }

  function collapse(now) {
    collapsed = true;
    collapseAt = now;
    els.flash.classList.remove("on");
    void els.flash.offsetWidth;
    els.flash.classList.add("on");
    rings.push({ r: P.R * 0.6, a: 1, w: 3 }, { r: P.R * 0.3, a: 0.8, w: 2 }, { r: P.R * 0.1, a: 0.6, w: 1.5 });
    burst(P.cx, P.cy, reducedMotion ? 30 : 160);
    view.pop = 1.3;
    chime();
    vibrate([30, 60, 140]);
  }

  function showResult(now) {
    mode = "result";
    resultAt = now;
    current = {
      index: pickResult.index,
      source: pickResult.source,
      bit: outcomeBit,
      qubit: randInt(27),
      fidelity: rand(96.5, 99.8)
    };
    setScreen("result");
    renderResult(true);
  }

  function renderResult(animate) {
    const p = window.PHRASES[current.index];
    const L = window.I18N[lang];
    els.cat.textContent = L.cats[p.c];
    const fid = current.fidelity.toLocaleString(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    els.meta.innerHTML =
      `<span class="q">|${current.bit}⟩</span><span>q[${current.qubit}]</span>` +
      `<span>${L.shots}: 1</span><span>${L.fidelity}: ${fid}%</span><span>${L.source[current.source]}</span>`;

    clearInterval(typer);
    const chars = Array.from(p[lang]);
    const text = document.createTextNode("");
    const caret = document.createElement("span");
    caret.className = "caret";
    caret.textContent = " ";
    els.phrase.replaceChildren(text, caret);
    if (!animate || reducedMotion) {
      text.data = p[lang];
      return;
    }
    let i = 0;
    typer = setInterval(() => {
      text.data += chars[i];
      if (++i >= chars.length) clearInterval(typer);
    }, 28);
  }

  // ---------------------------------------------------------------- randomness

  function cryptoRandom() {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0];
  }

  async function quantumRandom() {
    if (!CONFIG.qrngEndpoint) return null;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), CONFIG.qrngTimeoutMs);
    try {
      const r = await fetch(CONFIG.qrngEndpoint, { signal: ctrl.signal, cache: "no-store" });
      if (!r.ok) return null;
      const j = await r.json();
      return Number.isInteger(j.value) && j.value >= 0 ? j.value : null;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  // URL bias: ?bias=love:5,work-03:20,*:0 (or ?b=<base64url of the same>).
  // Keys: "*" (every phrase), a category, or a phrase id; the most specific wins.
  // A missing weight means 3, weight 0 excludes the phrase.
  function parseBias() {
    const list = window.PHRASES;
    const params = new URLSearchParams(location.search);
    let raw = params.get("bias") || "";
    if (!raw && params.get("b")) {
      try { raw = atob(params.get("b").replace(/-/g, "+").replace(/_/g, "/")); } catch { raw = ""; }
    }
    const cats = new Set(list.map((p) => p.c));
    const ids = new Set(list.map((p) => p.id));
    const rule = { all: null, cat: {}, id: {} };
    raw.split(",").forEach((part) => {
      const [k, v] = part.split(":").map((x) => (x || "").trim());
      if (!k) return;
      const w = v === "" ? 3 : Number(v);
      if (!Number.isFinite(w) || w < 0) return;
      const weight = Math.min(w, 1000);
      if (k === "*") rule.all = weight;
      else if (ids.has(k)) rule.id[k] = weight;
      else if (cats.has(k)) rule.cat[k] = weight;
    });
    const pick = (...vals) => vals.find((x) => x != null);
    const weights = list.map((p) => pick(rule.id[p.id], rule.cat[p.c], rule.all, 1));
    if (weights.every((w) => w === 0)) return list.map(() => 1);
    if (raw) {
      console.info("[quantum-oracle] bias", raw);
      console.table(list.map((p, i) => ({ id: p.id, weight: weights[i] })).filter((r) => r.weight !== 1));
    }
    return weights;
  }
  const weights = parseBias();

  // Weighted pick. The previous outcome is excluded and other recent ones are
  // damped, so results feel varied without cancelling out the URL bias.
  const RECENT_MAX = 12;
  const RECENT_DAMPING = 0.1;
  async function pickPhrase() {
    const list = window.PHRASES;
    let recent;
    try { recent = JSON.parse(store.get("qo.recent") || "[]"); } catch { recent = []; }
    if (!Array.isArray(recent)) recent = [];

    const eligible = list.map((_, i) => i).filter((i) => weights[i] > 0);
    const lastId = recent[recent.length - 1];
    let pool = eligible.filter((i) => list[i].id !== lastId);
    if (!pool.length) pool = eligible;
    const w = (i) => weights[i] * (recent.includes(list[i].id) ? RECENT_DAMPING : 1);

    const qv = await quantumRandom();
    const value = qv == null ? cryptoRandom() : qv;
    const total = pool.reduce((sum, i) => sum + w(i), 0);
    let x = (value / 4294967296) * total;
    let index = pool[pool.length - 1];
    for (const i of pool) {
      x -= w(i);
      if (x < 0) { index = i; break; }
    }

    recent.push(list[index].id);
    store.set("qo.recent", JSON.stringify(recent.slice(-RECENT_MAX)));
    return { index, source: qv == null ? "crypto" : "qrng" };
  }

  // ---------------------------------------------------------------- share / toast

  async function share() {
    if (!current) return;
    const L = window.I18N[lang];
    const text = L.shareText(window.PHRASES[current.index][lang]);
    const url = location.origin + location.pathname;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Quantum Oracle", text, url });
        return;
      } catch (e) {
        if (e && e.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      toast(L.copied);
    } catch {
      toast(url);
    }
  }

  let toastTimer = null;
  function toast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove("show"), 2200);
  }

  // ---------------------------------------------------------------- HUD text

  const logLines = [];
  let logTimer = 0;
  function addLog() {
    const tpl = window.I18N[lang].log[randInt(window.I18N[lang].log.length)];
    const a = randInt(27);
    let b = randInt(27);
    if (b === a) b = (b + 1) % 27;
    const line = tpl
      .replace("{q}", a).replace("{q2}", b)
      .replace("{t}", randInt(120) + 60).replace("{t2}", randInt(90) + 30)
      .replace("{n}", (rand(0.5, 9)).toFixed(1)).replace("{e}", rand(0.5, 4).toFixed(2))
      .replace("{d}", [2, 4, 8][randInt(3)]);
    logLines.push("> " + line);
    if (logLines.length > 3) logLines.shift();
    els.log.textContent = logLines.join("\n");
  }

  function setStatus(key) {
    if (key === statusKey) return;
    statusKey = key;
    els.status.textContent = t(key);
  }

  let hudTimer = 0;
  function updateHud(dt, now, intensity) {
    if (mode === "measuring") setStatus("measuring");
    else if (energy >= 1) setStatus("ready");
    else if (intensity > 0.1) setStatus("charging");
    else if (energy > 0.02) setStatus("decoherence");
    else setStatus(!motion.seen && now - hudAt > 1500 ? "idleNoMotion" : "idle");

    logTimer -= dt;
    if ((intensity > 0.15 || mode === "measuring") && logTimer <= 0) {
      addLog();
      logTimer = mode === "measuring" ? 0.18 : 0.3;
    }

    hudTimer -= dt;
    if (hudTimer > 0) return;
    hudTimer = 1 / 20;
    const a = Math.cos(q.theta / 2);
    const b = Math.abs(Math.sin(q.theta / 2));
    const ph = ((q.phi % TAU) + TAU) % TAU;
    els.ket.innerHTML = `|ψ⟩ = ${Math.abs(a).toFixed(2)}|0⟩ + ${b.toFixed(2)}·e<sup>i·${ph.toFixed(2)}</sup>|1⟩`;
    const p0 = Math.round(a * a * 100);
    els.p0.style.width = p0 + "%";
    els.p1.style.width = 100 - p0 + "%";
    els.p0v.textContent = p0 + "%";
    els.p1v.textContent = 100 - p0 + "%";
    const e = Math.round(energy * 100);
    els.energy.style.width = e + "%";
    els.energyv.textContent = e + "%";
  }

  // ---------------------------------------------------------------- simulation

  function updateQubit(dt, now, intensity) {
    if (mode === "measuring") {
      const p = clamp((now - measureStart) / CONFIG.measureMs, 0, 1);
      const ease = p * p * p;
      const target = outcomeBit ? Math.PI : 0;
      q.theta = lerp(thetaStart, target, ease) + (reducedMotion ? 0 : gauss() * 0.12 * (1 - p));
      q.phi += dt * (6 * (1 - ease) + 0.3);
      q.yaw += dt * (4 * (1 - ease) + 0.2);
      return;
    }
    if (mode === "result") {
      q.theta = lerp(q.theta, outcomeBit ? Math.PI : 0, dt * 4);
      q.phi += dt * 0.4;
      q.yaw += dt * 0.15;
      return;
    }
    const idleTarget = mode === "intro" ? 0.75 : 0;
    const target = idleTarget + energy * (Math.PI / 2 - idleTarget) + 0.1 * Math.sin(now / 900);
    q.vTheta += (target - q.theta) * dt * 6 + gauss() * intensity * dt * 45;
    q.vTheta *= Math.exp(-dt * 4);
    q.theta += q.vTheta * dt;
    if (q.theta < 0) { q.theta = -q.theta; q.vTheta = -q.vTheta; }
    if (q.theta > Math.PI) { q.theta = TAU - q.theta; q.vTheta = -q.vTheta; }
    q.phi += dt * (0.6 + energy * 4 + intensity * 8) + gauss() * intensity * dt * 6;
    q.yaw += dt * (0.25 + energy * 2 + intensity * 3.5);
  }

  function update(dt, now, intensity) {
    if (mode === "hud") {
      if (intensity > 0.1) {
        energy = Math.min(1, energy + intensity * dt * CONFIG.chargeRate);
      } else if (now - motion.lastShakeAt > CONFIG.stopDelayMs) {
        if (energy >= 1) startMeasure(now);
        else energy = Math.max(0, energy - CONFIG.decoherenceRate * dt);
      }
    } else if (mode === "measuring") {
      if (!collapsed && now - measureStart >= CONFIG.measureMs) collapse(now);
      if (collapsed && pickResult && now - collapseAt >= CONFIG.revealMs) showResult(now);
    } else if (mode === "result") {
      if (intensity > 0.45 && now - resultAt > 1200) enterHud();
    }

    updateQubit(dt, now, intensity);
    if (mode === "hud" || mode === "measuring") updateHud(dt, now, intensity);
    updateHum(intensity);

    const glitch = mode === "hud" && !reducedMotion && intensity > 0.25 ? (Math.random() * 2 - 1) * intensity : 0;
    body.style.setProperty("--glitch", glitch.toFixed(3));

    if (mode === "hud" && intensity > 0.3) {
      vibeTimer -= dt;
      if (vibeTimer <= 0) { vibrate(12); vibeTimer = 0.22; }
    }
  }
  let vibeTimer = 0;

  // ---------------------------------------------------------------- rendering

  let W = 0, H = 0, dpr = 1;
  const view = { cx: 0, cy: 0, R: 100, alpha: 0.3, pop: 1 };
  const P = { cx: 0, cy: 0, R: 100 };
  let orbRect = null;
  let nodes = [], edges = [], pulses = [];
  const particles = [];
  const rings = [];

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    els.canvas.width = Math.round(W * dpr);
    els.canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildMap();
    layout();
  }

  function layout() {
    orbRect = body.dataset.state === "hud" ? els.orb.getBoundingClientRect() : null;
  }

  function targetView() {
    const m = Math.min(W, H);
    if (mode === "intro") return { cx: W / 2, cy: H * 0.4, R: m * 0.36, alpha: 0.28 };
    if (mode === "result") return { cx: W / 2, cy: H * 0.38, R: m * 0.42, alpha: 0.16 };
    if (orbRect && orbRect.width > 0) {
      return {
        cx: orbRect.left + orbRect.width / 2,
        cy: orbRect.top + orbRect.height / 2,
        R: Math.min(orbRect.width, orbRect.height) * 0.4,
        alpha: 1
      };
    }
    return { cx: W / 2, cy: H * 0.45, R: m * 0.3, alpha: 1 };
  }

  // Heavy-hex lattice, like IBM coupling maps.
  function buildMap() {
    nodes = [];
    edges = [];
    pulses = [];
    const s = clamp(Math.min(W, H) / 7, 44, 80);
    const cols = Math.ceil(W / s) + 3;
    const rows = Math.ceil(H / (s * 2)) + 2;
    const grid = [];
    const ox = -s * 1.2 + rand(0, s);
    const oy = -s * 0.6;
    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < cols; c++) {
        row.push(nodes.length);
        nodes.push({ x: ox + c * s, y: oy + r * s * 2, flash: 0, adj: [] });
        if (c > 0) addEdge(row[c - 1], row[c]);
      }
      grid.push(row);
    }
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols; c++) {
        if ((c + (r % 2) * 2) % 4 !== 0) continue;
        const a = grid[r][c];
        const id = nodes.length;
        nodes.push({ x: nodes[a].x, y: nodes[a].y + s, flash: 0, adj: [] });
        addEdge(a, id);
        addEdge(id, grid[r + 1][c]);
      }
    }
  }

  function addEdge(a, b) {
    const id = edges.length;
    edges.push({ a, b, flash: 0 });
    nodes[a].adj.push(id);
    nodes[b].adj.push(id);
  }

  function project(x, y, z) {
    const cyw = Math.cos(q.yaw), syw = Math.sin(q.yaw);
    const x1 = x * cyw - y * syw;
    const y1 = x * syw + y * cyw;
    const cp = Math.cos(PITCH), sp = Math.sin(PITCH);
    const up = z * cp + y1 * sp;
    const depth = -y1 * cp + z * sp;
    return [P.cx + x1 * P.R, P.cy - up * P.R, depth];
  }

  const cyan = (a) => `rgba(103,232,249,${a})`;
  const violet = (a) => `rgba(167,139,250,${a})`;
  const magenta = (a) => `rgba(240,171,252,${a})`;

  function drawMap(dt, intensity, now) {
    const rate = (mode === "intro" ? 0.8 : 0.6) + intensity * 16 + energy * 3;
    let spawn = rate * dt;
    while (spawn > 0) {
      if (Math.random() < spawn && edges.length) {
        const e = randInt(edges.length);
        pulses.push({ e, t: 0, dir: Math.random() < 0.5 ? 1 : -1, speed: rand(1.2, 2.8) * (1 + intensity) });
      }
      spawn -= 1;
    }

    const jitter = reducedMotion ? 0 : intensity * 3;
    const px = motion.gx * 10 + Math.sin(now / 4000) * 6;
    const py = motion.gy * 10 + Math.cos(now / 5000) * 6;
    const mapAlpha = mode === "result" ? 0.55 : mode === "intro" ? 0.75 : 1;

    ctx.save();
    ctx.translate(px + rand(-jitter, jitter), py + rand(-jitter, jitter));
    ctx.globalAlpha = mapAlpha;

    ctx.lineWidth = 1;
    ctx.strokeStyle = violet(0.1);
    ctx.beginPath();
    for (const e of edges) {
      const a = nodes[e.a], b = nodes[e.b];
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();

    const decay = Math.exp(-dt * 3);
    ctx.lineWidth = 1.5;
    for (const e of edges) {
      if (e.flash < 0.02) { e.flash = 0; continue; }
      const a = nodes[e.a], b = nodes[e.b];
      ctx.strokeStyle = magenta(e.flash * 0.7);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      e.flash *= decay;
    }

    ctx.fillStyle = violet(0.35);
    ctx.beginPath();
    for (const n of nodes) {
      ctx.moveTo(n.x + 2.2, n.y);
      ctx.arc(n.x, n.y, 2.2, 0, TAU);
    }
    ctx.fill();

    for (const n of nodes) {
      if (n.flash < 0.02) { n.flash = 0; continue; }
      ctx.fillStyle = cyan(n.flash * 0.8);
      ctx.beginPath();
      ctx.arc(n.x, n.y, 2.5 + n.flash * 4, 0, TAU);
      ctx.fill();
      n.flash *= decay;
    }

    ctx.globalCompositeOperation = "lighter";
    for (let i = pulses.length - 1; i >= 0; i--) {
      const p = pulses[i];
      p.t += dt * p.speed;
      const e = edges[p.e];
      const from = nodes[p.dir > 0 ? e.a : e.b];
      const to = nodes[p.dir > 0 ? e.b : e.a];
      if (p.t >= 1) {
        e.flash = Math.min(1, e.flash + 0.6);
        to.flash = 1;
        // Crosstalk: noise leaks onto a neighbouring coupler.
        if (Math.random() < 0.15 + intensity * 0.5 && to.adj.length) {
          const ne = to.adj[randInt(to.adj.length)];
          if (ne !== p.e) edges[ne].flash = Math.min(1, edges[ne].flash + 0.5);
        }
        pulses.splice(i, 1);
        continue;
      }
      const x = lerp(from.x, to.x, p.t), y = lerp(from.y, to.y, p.t);
      const g = ctx.createRadialGradient(x, y, 0, x, y, 7);
      g.addColorStop(0, cyan(0.9));
      g.addColorStop(1, cyan(0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function ring(fn, color, frontA, backA, width) {
    const N = 72;
    const front = new Path2D(), back = new Path2D();
    let prev = null;
    for (let i = 0; i <= N; i++) {
      const s = fn((i / N) * TAU);
      const p = project(s[0], s[1], s[2]);
      if (prev) {
        const path = prev[2] + p[2] >= 0 ? front : back;
        path.moveTo(prev[0], prev[1]);
        path.lineTo(p[0], p[1]);
      }
      prev = p;
    }
    ctx.lineWidth = width;
    ctx.strokeStyle = color(backA);
    ctx.stroke(back);
    ctx.strokeStyle = color(frontA);
    ctx.stroke(front);
  }

  function label(text, x, y, z, color) {
    const p = project(x, y, z);
    ctx.fillStyle = color(p[2] >= -0.2 ? 0.9 : 0.35);
    ctx.fillText(text, p[0], p[1]);
  }

  function drawSphere(dt, intensity) {
    const tv = targetView();
    const k = 1 - Math.exp(-dt * 6);
    view.cx = lerp(view.cx || tv.cx, tv.cx, k);
    view.cy = lerp(view.cy || tv.cy, tv.cy, k);
    view.R = lerp(view.R, tv.R, k);
    view.alpha = lerp(view.alpha, tv.alpha, k);
    view.pop = lerp(view.pop, 1, 1 - Math.exp(-dt * 5));

    const j = reducedMotion ? 0 : intensity * 4;
    P.cx = view.cx + rand(-j, j);
    P.cy = view.cy + rand(-j, j);
    P.R = view.R * view.pop;

    ctx.save();
    ctx.globalAlpha = view.alpha;

    const bg = ctx.createRadialGradient(P.cx - P.R * 0.35, P.cy - P.R * 0.4, P.R * 0.1, P.cx, P.cy, P.R);
    bg.addColorStop(0, "rgba(40,48,110,0.55)");
    bg.addColorStop(1, "rgba(8,10,28,0.92)");
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(P.cx, P.cy, P.R, 0, TAU);
    ctx.fill();

    ctx.shadowColor = cyan(0.6);
    ctx.shadowBlur = 18 + intensity * 30 + energy * 20;
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = cyan(0.5 + energy * 0.3);
    ctx.stroke();
    ctx.shadowBlur = 0;

    ring((t) => [Math.cos(t) * 0.866, Math.sin(t) * 0.866, 0.5], violet, 0.18, 0.06, 1);
    ring((t) => [Math.cos(t) * 0.866, Math.sin(t) * 0.866, -0.5], violet, 0.18, 0.06, 1);
    ring((t) => [Math.cos(t), 0, Math.sin(t)], violet, 0.45, 0.12, 1.2);
    ring((t) => [0, Math.cos(t), Math.sin(t)], violet, 0.45, 0.12, 1.2);
    ring((t) => [Math.cos(t), Math.sin(t), 0], cyan, 0.6, 0.15, 1.4);

    ctx.setLineDash([3, 5]);
    ctx.lineWidth = 1;
    for (const [a, b] of [[[0, 0, -1.12], [0, 0, 1.12]], [[-1.08, 0, 0], [1.08, 0, 0]], [[0, -1.08, 0], [0, 1.08, 0]]]) {
      const p1 = project(...a), p2 = project(...b);
      ctx.strokeStyle = "rgba(230,232,255,0.22)";
      ctx.beginPath();
      ctx.moveTo(p1[0], p1[1]);
      ctx.lineTo(p2[0], p2[1]);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    const fs = clamp(Math.round(P.R * 0.11), 11, 16);
    ctx.font = `600 ${fs}px "JetBrains Mono", ui-monospace, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    label("|0⟩", 0, 0, 1.26, cyan);
    label("|1⟩", 0, 0, -1.26, magenta);
    ctx.font = `500 ${fs - 2}px "JetBrains Mono", ui-monospace, monospace`;
    label("|+⟩", 1.25, 0, 0, violet);
    label("|+i⟩", 0, 1.27, 0, violet);

    // State vector
    const v = [Math.sin(q.theta) * Math.cos(q.phi), Math.sin(q.theta) * Math.sin(q.phi), Math.cos(q.theta)];
    if (intensity > 0.05 || mode === "measuring") q.trail.push(v);
    else if (q.trail.length) q.trail.shift();
    while (q.trail.length > 40) q.trail.shift();

    ctx.globalCompositeOperation = "lighter";
    if (q.trail.length > 1) {
      ctx.lineCap = "round";
      let prev = project(...q.trail[0]);
      for (let i = 1; i < q.trail.length; i++) {
        const p = project(...q.trail[i]);
        ctx.strokeStyle = magenta((i / q.trail.length) * 0.6);
        ctx.lineWidth = 1 + (i / q.trail.length) * 2.5;
        ctx.beginPath();
        ctx.moveTo(prev[0], prev[1]);
        ctx.lineTo(p[0], p[1]);
        ctx.stroke();
        prev = p;
      }
    }

    const tip = project(...v);
    const grad = ctx.createLinearGradient(P.cx, P.cy, tip[0], tip[1]);
    grad.addColorStop(0, cyan(0.3));
    grad.addColorStop(1, magenta(1));
    ctx.strokeStyle = grad;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.shadowColor = magenta(0.9);
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.moveTo(P.cx, P.cy);
    ctx.lineTo(tip[0], tip[1]);
    ctx.stroke();
    ctx.shadowBlur = 0;

    const tr = 6 + intensity * 4 + energy * 2;
    const tg = ctx.createRadialGradient(tip[0], tip[1], 0, tip[0], tip[1], tr * 3);
    tg.addColorStop(0, "rgba(255,255,255,1)");
    tg.addColorStop(0.25, magenta(0.9));
    tg.addColorStop(1, magenta(0));
    ctx.fillStyle = tg;
    ctx.beginPath();
    ctx.arc(tip[0], tip[1], tr * 3, 0, TAU);
    ctx.fill();

    ctx.fillStyle = cyan(0.9);
    ctx.beginPath();
    ctx.arc(P.cx, P.cy, 2.5, 0, TAU);
    ctx.fill();
    ctx.restore();

    if (mode === "hud" && intensity > 0.1 && !reducedMotion) {
      let n = intensity * 90 * dt;
      while (n > 0) {
        if (Math.random() < n) emit(tip[0], tip[1], rand(40, 180), Math.random() < 0.5 ? cyan : magenta);
        n -= 1;
      }
    }
  }

  function emit(x, y, speed, color) {
    if (particles.length > 320) return;
    const a = rand(0, TAU);
    particles.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: 0, max: rand(0.6, 1.4), size: rand(1, 2.6), color });
  }

  function burst(x, y, n) {
    for (let i = 0; i < n; i++) emit(x, y, rand(80, 520), i % 3 ? cyan : magenta);
  }

  function drawFx(dt) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const drag = Math.exp(-dt * 1.8);
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life += dt;
      if (p.life >= p.max) { particles.splice(i, 1); continue; }
      p.vx *= drag;
      p.vy *= drag;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      ctx.fillStyle = p.color(1 - p.life / p.max);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, TAU);
      ctx.fill();
    }
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i];
      r.r += dt * Math.max(W, H) * 0.9;
      r.a -= dt * 0.9;
      if (r.a <= 0) { rings.splice(i, 1); continue; }
      ctx.strokeStyle = cyan(r.a);
      ctx.lineWidth = r.w;
      ctx.beginPath();
      ctx.arc(P.cx, P.cy, r.r, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------- loop

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    motion.intensity *= Math.exp(-dt * 5);
    if (infoOpen) {
      motion.intensity = 0;
      motion.lastShakeAt = now;
    }
    if (holding) motion.lastShakeAt = now;
    const hold = holding ? 0.8 + 0.2 * Math.sin(now / 40) : 0;
    const intensity = Math.max(motion.intensity, hold);

    update(dt, now, intensity);

    ctx.clearRect(0, 0, W, H);
    drawMap(dt, intensity, now);
    drawSphere(dt, intensity);
    drawFx(dt);

    requestAnimationFrame(frame);
  }

  window.addEventListener("resize", resize);
  resize();
  applyLang();
  requestAnimationFrame(frame);
})();
