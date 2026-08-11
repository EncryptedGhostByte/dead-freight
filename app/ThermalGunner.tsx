"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Weapon = "alpha" | "bravo" | "ltm";
type Phase = "briefing" | "connecting" | "active" | "waveComplete" | "won" | "lost";

type Target = {
  id: number;
  x: number;
  y: number;
  speed: number;
  size: number;
  sprite: number;
  hp: number;
  heavy: boolean;
  sway: number;
};

type Blast = {
  x: number;
  y: number;
  radius: number;
  life: number;
  duration: number;
  type: Weapon | "support";
};

type Hud = {
  team: number;
  kills: number;
  breached: number;
  time: number;
  alpha: number;
  bravo: number;
  ltm: number;
};

const ASSET_BASE = import.meta.env.BASE_URL || "/";

const LOCATIONS = [
  {
    name: "PIER 400",
    sector: "PORT OF LOS SANTOS",
    objective: "Container breach",
    image: `${ASSET_BASE}flir-port-topdown.png`,
    targets: 18,
    duration: 46,
    team: { x: .25, y: .74 },
    breaches: [{ x: .83, y: .18 }, { x: .91, y: .42 }, { x: .67, y: .08 }],
    pan: { x: 0, y: 0 },
  },
  {
    name: "CYPRESS RAIL YARD",
    sector: "EAST LOS SANTOS",
    objective: "Freight transfer intercepted",
    image: `${ASSET_BASE}flir-rail-yard.png`,
    targets: 22,
    duration: 50,
    team: { x: .72, y: .72 },
    breaches: [{ x: .08, y: .16 }, { x: .18, y: .48 }, { x: .48, y: .08 }, { x: .92, y: .24 }],
    pan: { x: 0, y: 0 },
  },
  {
    name: "LSIA CARGO APRON",
    sector: "LOS SANTOS INTERNATIONAL",
    objective: "Final containment",
    image: `${ASSET_BASE}flir-airport-apron.png`,
    targets: 27,
    duration: 56,
    team: { x: .5, y: .76 },
    breaches: [{ x: .06, y: .22 }, { x: .32, y: .06 }, { x: .7, y: .07 }, { x: .94, y: .28 }, { x: .87, y: .58 }],
    pan: { x: 0, y: 0 },
  },
] as const;

const TOTAL_TARGETS = LOCATIONS.reduce((sum, location) => sum + location.targets, 0);
const AMMO = { alpha: 220, bravo: 30, ltm: 5 };

const WEAPONS = {
  alpha: { label: "ALPHA", caliber: "25MM", radius: 30, damage: 1, cooldown: 105 },
  bravo: { label: "BRAVO", caliber: "40MM", radius: 88, damage: 2, cooldown: 850 },
  ltm: { label: "LTM", caliber: "AGM-114", radius: 158, damage: 9, cooldown: 3000 },
} as const;

function toScreen(x: number, y: number, width: number, height: number, zoom: number) {
  return {
    x: width / 2 + (x * width - width / 2) * zoom,
    y: height / 2 + (y * height - height / 2) * zoom,
  };
}

export function ThermalGunner({ onExit }: { onExit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const backgroundRefs = useRef<HTMLImageElement[]>([]);
  const spriteTilesRef = useRef<HTMLCanvasElement[]>([]);
  const audioRef = useRef<AudioContext | null>(null);
  const audioOnRef = useRef(true);
  const targetsRef = useRef<Target[]>([]);
  const blastsRef = useRef<Blast[]>([]);
  const aimRef = useRef({ x: 640, y: 360 });
  const ammoRef = useRef({ ...AMMO });
  const weaponRef = useRef<Weapon>("alpha");
  const zoomRef = useRef(1);
  const killsRef = useRef(0);
  const totalKillsRef = useRef(0);
  const breachedRef = useRef(0);
  const teamRef = useRef(100);
  const spawnedRef = useRef(0);
  const supportRef = useRef(true);
  const lastShotRef = useRef(0);
  const startRef = useRef(0);
  const shakeRef = useRef(0);
  const [assetsReady, setAssetsReady] = useState(false);
  const [phase, setPhase] = useState<Phase>("briefing");
  const [weapon, setWeapon] = useState<Weapon>("alpha");
  const [zoom, setZoom] = useState(1);
  const [wave, setWave] = useState(0);
  const [connectionStage, setConnectionStage] = useState(0);
  const [supportReady, setSupportReady] = useState(true);
  const [audioOn, setAudioOn] = useState(true);
  const [hud, setHud] = useState<Hud>({ team: 100, kills: 0, breached: 0, time: LOCATIONS[0].duration, ...AMMO });
  const location = LOCATIONS[wave];

  useEffect(() => {
    let loaded = 0;
    const ready = () => {
      loaded += 1;
      if (loaded === LOCATIONS.length + 1) setAssetsReady(true);
    };
    const sprites = new window.Image();
    const backgrounds = LOCATIONS.map((entry) => {
      const image = new window.Image();
      image.onload = ready;
      image.src = entry.image;
      return image;
    });
    sprites.onload = () => {
      const tiles: HTMLCanvasElement[] = [];
      const sourceWidth = sprites.naturalWidth / 4;
      const sourceHeight = sprites.naturalHeight / 2;
      for (let variant = 0; variant < 2; variant += 1) {
        for (let index = 0; index < 8; index += 1) {
          const tile = document.createElement("canvas");
          tile.width = 96;
          tile.height = 128;
          const tileContext = tile.getContext("2d");
          if (tileContext) {
            tileContext.filter = variant === 1 ? "contrast(1.55) brightness(1.3)" : "contrast(1.38) brightness(1.12)";
            tileContext.drawImage(sprites, (index % 4) * sourceWidth, Math.floor(index / 4) * sourceHeight, sourceWidth, sourceHeight, 0, 0, tile.width, tile.height);
          }
          tiles.push(tile);
        }
      }
      spriteTilesRef.current = tiles;
      ready();
    };
    sprites.src = `${ASSET_BASE}flir-zombies-topdown.png`;
    backgroundRefs.current = backgrounds;
    return () => audioRef.current?.close();
  }, []);

  function getAudio() {
    if (!audioOnRef.current) return null;
    if (!audioRef.current || audioRef.current.state === "closed") audioRef.current = new AudioContext();
    if (audioRef.current.state === "suspended") void audioRef.current.resume();
    return audioRef.current;
  }

  function tone(frequency: number, duration: number, gain = .08, type: OscillatorType = "sine", delay = 0) {
    const audio = getAudio();
    if (!audio) return;
    const oscillator = audio.createOscillator();
    const volume = audio.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, audio.currentTime + delay);
    volume.gain.setValueAtTime(gain, audio.currentTime + delay);
    volume.gain.exponentialRampToValueAtTime(.0001, audio.currentTime + delay + duration);
    oscillator.connect(volume).connect(audio.destination);
    oscillator.start(audio.currentTime + delay);
    oscillator.stop(audio.currentTime + delay + duration);
  }

  function noise(duration: number, gain = .1, frequency = 900, delay = 0) {
    const audio = getAudio();
    if (!audio) return;
    const buffer = audio.createBuffer(1, Math.ceil(audio.sampleRate * duration), audio.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    const source = audio.createBufferSource();
    const filter = audio.createBiquadFilter();
    const volume = audio.createGain();
    source.buffer = buffer;
    filter.type = "bandpass";
    filter.frequency.value = frequency;
    filter.Q.value = .8;
    volume.gain.setValueAtTime(gain, audio.currentTime + delay);
    volume.gain.exponentialRampToValueAtTime(.0001, audio.currentTime + delay + duration);
    source.connect(filter).connect(volume).connect(audio.destination);
    source.start(audio.currentTime + delay);
  }

  function playConnectionSound() {
    noise(.7, .035, 1450);
    [410, 520, 680, 840].forEach((frequency, index) => tone(frequency, .1, .055, "square", .24 + index * .48));
    tone(1040, .45, .04, "sine", 2.25);
    noise(.32, .04, 2400, 2.15);
  }

  function playWeaponSound(selected: Weapon) {
    if (selected === "alpha") {
      noise(.07, .13, 1250);
      tone(92, .1, .09, "sawtooth");
      tone(58, .16, .045, "square", .045);
    } else if (selected === "bravo") {
      noise(.34, .18, 320);
      tone(66, .48, .16, "sine");
      tone(38, .55, .1, "sawtooth", .05);
    } else {
      noise(.42, .11, 1800);
      tone(210, .42, .08, "sawtooth");
      tone(42, .9, .2, "sine", .24);
      noise(.8, .2, 190, .24);
    }
  }

  function playUiSound(high = false) {
    tone(high ? 910 : 620, .07, .035, "square");
  }

  function chooseWeapon(next: Weapon) {
    weaponRef.current = next;
    setWeapon(next);
    playUiSound(next === "ltm");
  }

  function chooseZoom(next: number) {
    zoomRef.current = next;
    setZoom(next);
    tone(next > 1 ? 760 : 520, .09, .025, "sine");
  }

  const prepareWave = useCallback((index: number, freshCampaign = false) => {
    const nextLocation = LOCATIONS[index];
    if (freshCampaign) {
      teamRef.current = 100;
      totalKillsRef.current = 0;
    } else {
      teamRef.current = Math.min(100, teamRef.current + 12);
    }
    targetsRef.current = [];
    blastsRef.current = [];
    ammoRef.current = { ...AMMO };
    killsRef.current = 0;
    breachedRef.current = 0;
    spawnedRef.current = 0;
    supportRef.current = true;
    lastShotRef.current = 0;
    shakeRef.current = 0;
    weaponRef.current = "alpha";
    zoomRef.current = 1;
    setWeapon("alpha");
    setZoom(1);
    setSupportReady(true);
    setWave(index);
    setHud({ team: teamRef.current, kills: 0, breached: 0, time: nextLocation.duration, ...AMMO });
    aimRef.current = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    getAudio();
    setPhase("connecting");
  }, []);

  useEffect(() => {
    if (phase !== "connecting") return;
    setConnectionStage(0);
    playConnectionSound();
    const stages = [
      window.setTimeout(() => setConnectionStage(1), 580),
      window.setTimeout(() => setConnectionStage(2), 1280),
      window.setTimeout(() => setConnectionStage(3), 2050),
      window.setTimeout(() => {
        startRef.current = performance.now();
        setConnectionStage(4);
        tone(1180, .22, .055, "square");
        setPhase("active");
      }, 2900),
    ];
    return () => stages.forEach(window.clearTimeout);
  }, [phase, wave]);

  const fire = useCallback(() => {
    if (phase !== "active") return;
    const selected = weaponRef.current;
    const config = WEAPONS[selected];
    const now = performance.now();
    if (now - lastShotRef.current < config.cooldown || ammoRef.current[selected] <= 0) {
      if (ammoRef.current[selected] <= 0) tone(180, .06, .025, "square");
      return;
    }
    lastShotRef.current = now;
    ammoRef.current[selected] -= 1;
    playWeaponSound(selected);

    const width = window.innerWidth;
    const height = window.innerHeight;
    const aim = aimRef.current;
    let candidates = targetsRef.current.map((target) => {
      const point = toScreen(target.x, target.y, width, height, zoomRef.current);
      return { target, distance: Math.hypot(point.x - aim.x, point.y - aim.y) };
    });
    if (selected === "alpha") candidates = candidates.filter((entry) => entry.distance < config.radius + entry.target.size).sort((a, b) => a.distance - b.distance).slice(0, 1);
    else candidates = candidates.filter((entry) => entry.distance < config.radius);
    candidates.forEach(({ target }) => { target.hp -= config.damage; });
    const before = targetsRef.current.length;
    targetsRef.current = targetsRef.current.filter((target) => target.hp > 0);
    const eliminated = before - targetsRef.current.length;
    killsRef.current += eliminated;
    totalKillsRef.current += eliminated;

    blastsRef.current.push({ x: aim.x, y: aim.y, radius: config.radius, life: 0, duration: selected === "alpha" ? .22 : selected === "bravo" ? .75 : 1.25, type: selected });
    if (selected === "ltm") [[-58, 26], [48, -34], [35, 52]].forEach(([dx, dy]) => blastsRef.current.push({ x: aim.x + dx, y: aim.y + dy, radius: 72, life: -.12, duration: .9, type: "ltm" }));
    shakeRef.current = selected === "alpha" ? .14 : selected === "bravo" ? .72 : 1.4;
    if (eliminated) tone(1320, .055, .018, "square", selected === "ltm" ? .26 : .02);
    setHud((old) => ({ ...old, kills: killsRef.current, ...ammoRef.current }));
  }, [phase]);

  const callSupport = useCallback(() => {
    if (phase !== "active" || !supportRef.current) return;
    supportRef.current = false;
    setSupportReady(false);
    noise(.55, .055, 2100);
    tone(740, .1, .045, "square");
    tone(940, .1, .045, "square", .18);
    const width = window.innerWidth;
    const height = window.innerHeight;
    for (let i = 0; i < 10; i += 1) blastsRef.current.push({ x: width * (.12 + i * .085), y: height * (.2 + i * .055), radius: 60, life: -.45 - i * .075, duration: .72, type: "support" });
    window.setTimeout(() => {
      const before = targetsRef.current.length;
      targetsRef.current = targetsRef.current.filter((target, index) => index % 3 === 0);
      const eliminated = before - targetsRef.current.length;
      killsRef.current += eliminated;
      totalKillsRef.current += eliminated;
      shakeRef.current = 1.15;
      noise(.65, .18, 260);
      tone(48, .7, .15, "sine");
      setHud((old) => ({ ...old, kills: killsRef.current }));
    }, 460);
  }, [phase]);

  useEffect(() => {
    if (phase !== "active") return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "1") chooseWeapon("alpha");
      if (event.key === "2") chooseWeapon("bravo");
      if (event.key === "3") chooseWeapon("ltm");
      if (event.key.toLowerCase() === "z") chooseZoom(zoomRef.current === 1 ? 1.45 : 1);
      if (event.key.toLowerCase() === "q") callSupport();
      if (event.code === "Space") { event.preventDefault(); fire(); }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [callSupport, fire, phase]);

  useEffect(() => {
    if (phase !== "active") return;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    let animation = 0;
    let last = performance.now();
    let lastHud = 0;
    let noiseFrame = 0;
    let backgroundCache: HTMLCanvasElement | null = null;
    let backgroundCacheKey = "";
    const currentLocation = LOCATIONS[wave];

    function resize() {
      if (!canvas || !context) return;
      const ratio = window.innerWidth < 900 ? 1 : Math.min(window.devicePixelRatio || 1, 1.35);
      canvas.width = Math.floor(window.innerWidth * ratio);
      canvas.height = Math.floor(window.innerHeight * ratio);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.imageSmoothingEnabled = true;
      backgroundCacheKey = "";
    }

    function drawBackground(width: number, height: number) {
      if (!context) return;
      const image = backgroundRefs.current[wave];
      context.fillStyle = "#111";
      context.fillRect(0, 0, width, height);
      if (image?.complete && image.naturalWidth) {
        const key = `${Math.round(width)}:${Math.round(height)}:${zoomRef.current}`;
        if (!backgroundCache || backgroundCacheKey !== key) {
          backgroundCache = document.createElement("canvas");
          backgroundCache.width = Math.max(1, Math.round(width));
          backgroundCache.height = Math.max(1, Math.round(height));
          const cacheContext = backgroundCache.getContext("2d");
          if (cacheContext) {
            const aspect = width / height;
            const imageAspect = image.naturalWidth / image.naturalHeight;
            let sourceWidth = image.naturalWidth / zoomRef.current;
            let sourceHeight = image.naturalHeight / zoomRef.current;
            if (imageAspect > aspect) sourceWidth = sourceHeight * aspect;
            else sourceHeight = sourceWidth / aspect;
            const baseX = (image.naturalWidth - sourceWidth) / 2 + currentLocation.pan.x * sourceWidth;
            const baseY = (image.naturalHeight - sourceHeight) / 2 + currentLocation.pan.y * sourceHeight;
            const sourceX = Math.max(0, Math.min(image.naturalWidth - sourceWidth, baseX));
            const sourceY = Math.max(0, Math.min(image.naturalHeight - sourceHeight, baseY));
            cacheContext.filter = `grayscale(1) contrast(${wave === 2 ? 1.48 : 1.28}) brightness(${wave === 1 ? .62 : .72})`;
            cacheContext.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, backgroundCache.width, backgroundCache.height);
            cacheContext.filter = "none";
          }
          backgroundCacheKey = key;
        }
        const shake = shakeRef.current * 4;
        context.drawImage(backgroundCache, (Math.random() - .5) * shake - 2, (Math.random() - .5) * shake - 2, width + 4, height + 4);
      }

      context.save();
      context.strokeStyle = "rgba(255,255,255,.13)";
      context.lineWidth = 2;
      if (wave === 1) {
        for (let i = -2; i < 7; i += 1) {
          context.beginPath();
          context.moveTo(0, height * (.12 + i * .15));
          context.lineTo(width, height * (.42 + i * .15));
          context.stroke();
        }
      } else if (wave === 2) {
        context.lineWidth = 5;
        context.setLineDash([34, 26]);
        context.beginPath();
        context.moveTo(width * .08, height * .52);
        context.lineTo(width * .92, height * .22);
        context.stroke();
        context.setLineDash([]);
      }
      context.restore();

      currentLocation.breaches.forEach((breach, index) => {
        const point = toScreen(breach.x, breach.y, width, height, zoomRef.current);
        const pulse = 18 + Math.sin(performance.now() / 220 + index) * 5;
        context.strokeStyle = "rgba(255,255,255,.48)";
        context.setLineDash([4, 5]);
        context.beginPath();
        context.arc(point.x, point.y, pulse, 0, Math.PI * 2);
        context.stroke();
        context.setLineDash([]);
        context.font = "700 8px monospace";
        context.fillStyle = "rgba(255,255,255,.7)";
        context.fillText(`BREACH ${index + 1}`, point.x + 21, point.y - 4);
      });

      const vignette = context.createRadialGradient(width / 2, height / 2, height * .18, width / 2, height / 2, height * .82);
      vignette.addColorStop(0, "rgba(0,0,0,0)");
      vignette.addColorStop(1, "rgba(0,0,0,.48)");
      context.fillStyle = vignette;
      context.fillRect(0, 0, width, height);
      context.fillStyle = "rgba(255,255,255,.08)";
      for (let i = 0; i < 24; i += 1) context.fillRect((i * 191 + noiseFrame * 11) % width, (i * 83 + noiseFrame * 5) % height, i % 4 === 0 ? 2 : 1, 1);
    }

    function drawTeam(width: number, height: number) {
      if (!context) return;
      const point = toScreen(currentLocation.team.x, currentLocation.team.y, width, height, zoomRef.current);
      context.save();
      context.strokeStyle = "rgba(255,255,255,.9)";
      context.fillStyle = "#fff";
      context.lineWidth = 1.5;
      context.setLineDash([5, 6]);
      context.beginPath();
      context.arc(point.x, point.y, 34, 0, Math.PI * 2);
      context.stroke();
      context.setLineDash([]);
      [[-9, 5], [8, 8], [0, -8]].forEach(([dx, dy]) => {
        context.beginPath();
        context.arc(point.x + dx, point.y + dy, 4.5, 0, Math.PI * 2);
        context.fill();
      });
      context.font = "700 10px monospace";
      context.fillText("TEAM ECHO", point.x - 30, point.y + 52);
      context.restore();
    }

    function drawTarget(target: Target, width: number, height: number, elapsed: number) {
      if (!context) return;
      const point = toScreen(target.x, target.y, width, height, zoomRef.current);
      if (point.x < -90 || point.x > width + 90 || point.y < -120 || point.y > height + 120) return;
      const tile = spriteTilesRef.current[target.sprite + (target.heavy ? 8 : 0)];
      if (!tile) return;
      const scale = target.size * zoomRef.current;
      const drawWidth = scale * (target.heavy ? 5.5 : 4.3);
      const drawHeight = scale * (target.heavy ? 5.7 : 4.6);
      context.save();
      context.translate(point.x, point.y);
      context.rotate(Math.sin(elapsed * 3 + target.sway) * .035);
      context.globalCompositeOperation = "screen";
      context.globalAlpha = .96;
      context.drawImage(tile, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
      context.restore();
    }

    function drawBlast(blast: Blast) {
      if (!context || blast.life < 0) return;
      const progress = Math.min(blast.life / blast.duration, 1);
      const radius = blast.radius * (.18 + progress * .82);
      context.save();
      context.globalCompositeOperation = "screen";
      const gradient = context.createRadialGradient(blast.x, blast.y, 0, blast.x, blast.y, radius);
      const alpha = Math.max(0, 1 - progress);
      gradient.addColorStop(0, `rgba(255,255,255,${alpha})`);
      gradient.addColorStop(.18, `rgba(235,235,235,${alpha * .85})`);
      gradient.addColorStop(.58, `rgba(145,145,145,${alpha * .36})`);
      gradient.addColorStop(1, "rgba(0,0,0,0)");
      context.fillStyle = gradient;
      context.beginPath();
      context.arc(blast.x, blast.y, radius, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = `rgba(255,255,255,${alpha * .75})`;
      context.lineWidth = 2;
      context.beginPath();
      context.arc(blast.x, blast.y, radius * 1.12, 0, Math.PI * 2);
      context.stroke();
      context.restore();
    }

    function drawReticle() {
      if (!context) return;
      const { x, y } = aimRef.current;
      context.save();
      context.strokeStyle = "rgba(255,255,255,.94)";
      context.fillStyle = "white";
      context.lineWidth = 1.6;
      context.shadowColor = "black";
      context.shadowBlur = 3;
      context.beginPath();
      context.moveTo(x - 105, y); context.lineTo(x - 24, y);
      context.moveTo(x + 24, y); context.lineTo(x + 105, y);
      context.moveTo(x, y - 96); context.lineTo(x, y - 20);
      context.moveTo(x, y + 20); context.lineTo(x, y + 96);
      context.stroke();
      context.fillRect(x - 2, y - 2, 4, 4);
      context.strokeRect(x - 10, y - 10, 20, 20);
      for (let i = -2; i <= 2; i += 1) {
        if (i === 0) continue;
        context.beginPath();
        context.moveTo(x + i * 32, y - 5); context.lineTo(x + i * 32, y + 5);
        context.moveTo(x - 5, y + i * 32); context.lineTo(x + 5, y + i * 32);
        context.stroke();
      }
      context.restore();
    }

    function loop(now: number) {
      if (!context || !canvas) return;
      const width = window.innerWidth;
      const height = window.innerHeight;
      const dt = Math.min((now - last) / 1000, .05);
      const elapsed = (now - startRef.current) / 1000;
      const time = Math.max(0, Math.ceil(currentLocation.duration - elapsed));
      last = now;
      noiseFrame += 1;

      while (spawnedRef.current < currentLocation.targets && elapsed > .7 + spawnedRef.current * (wave === 2 ? .62 : .76)) {
        const id = spawnedRef.current;
        const heavy = id > 5 && id % (wave === 2 ? 5 : 7) === 0;
        const breach = currentLocation.breaches[id % currentLocation.breaches.length];
        targetsRef.current.push({
          id: wave * 100 + id,
          x: breach.x + (Math.random() - .5) * .045,
          y: breach.y + (Math.random() - .5) * .04,
          speed: heavy ? .014 : .026 + Math.random() * .013 + wave * .002,
          size: heavy ? 13 : 9 + Math.random() * 2,
          sprite: heavy ? 6 + (id % 2) : id % 6,
          hp: heavy ? 2 : 1,
          heavy,
          sway: Math.random() * 8,
        });
        spawnedRef.current += 1;
      }

      targetsRef.current.forEach((target) => {
        const dx = currentLocation.team.x - target.x;
        const dy = currentLocation.team.y - target.y;
        const distance = Math.hypot(dx, dy) || 1;
        target.x += (dx / distance) * target.speed * dt;
        target.y += (dy / distance) * target.speed * dt;
        target.x += Math.sin(elapsed * 1.7 + target.sway) * .0015 * dt;
      });

      const breached = targetsRef.current.filter((target) => Math.hypot(target.x - currentLocation.team.x, target.y - currentLocation.team.y) < .026);
      if (breached.length) {
        breached.forEach((target) => { teamRef.current -= target.heavy ? 22 : 8; });
        breachedRef.current += breached.length;
        const breachedIds = new Set(breached.map((target) => target.id));
        targetsRef.current = targetsRef.current.filter((target) => !breachedIds.has(target.id));
        noise(.18, .045, 780);
        tone(230, .22, .05, "sawtooth");
      }

      blastsRef.current.forEach((blast) => { blast.life += dt; });
      blastsRef.current = blastsRef.current.filter((blast) => blast.life < blast.duration);
      shakeRef.current = Math.max(0, shakeRef.current - dt * 1.9);

      drawBackground(width, height);
      drawTeam(width, height);
      targetsRef.current.forEach((target) => drawTarget(target, width, height, elapsed));
      blastsRef.current.forEach(drawBlast);
      drawReticle();

      if (now - lastHud > 130) {
        setHud({ team: Math.max(0, teamRef.current), kills: killsRef.current, breached: breachedRef.current, time, ...ammoRef.current });
        lastHud = now;
      }

      const resolved = killsRef.current + breachedRef.current;
      if (teamRef.current <= 0 || time <= 0) {
        noise(.8, .045, 480);
        tone(190, 1.2, .07, "sawtooth");
        setPhase("lost");
        return;
      }
      if (resolved >= currentLocation.targets && spawnedRef.current >= currentLocation.targets && targetsRef.current.length === 0) {
        tone(680, .12, .05, "square");
        tone(920, .22, .05, "square", .14);
        setHud({ team: Math.max(0, teamRef.current), kills: killsRef.current, breached: breachedRef.current, time, ...ammoRef.current });
        setPhase(wave === LOCATIONS.length - 1 ? "won" : "waveComplete");
        return;
      }
      animation = requestAnimationFrame(loop);
    }

    resize();
    window.addEventListener("resize", resize);
    animation = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animation);
    };
  }, [phase, wave]);

  function updateAim(event: React.PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    aimRef.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function toggleAudio() {
    const next = !audioOnRef.current;
    audioOnRef.current = next;
    setAudioOn(next);
    if (next) playUiSound(true);
  }

  const progress = Math.min(100, Math.round(((hud.kills + hud.breached) / location.targets) * 100));
  const connectionLabels = ["OPENING ENCRYPTED RADIO LINK", "AUTHENTICATING GUNSHIP 2-1", "SYNCING THERMAL SENSOR", "LOADING WEAPON PROFILES", "AIR SUPPORT ONLINE"];

  return (
    <section className={`gunner-shell goliath-mode location-${wave + 1}`} aria-label="AC-130 thermal gunner final mission">
      <canvas
        ref={canvasRef}
        className="flir-canvas"
        onPointerMove={updateAim}
        onPointerDown={(event) => { updateAim(event); fire(); }}
        onWheel={(event) => { event.preventDefault(); chooseZoom(zoomRef.current === 1 ? 1.45 : 1); }}
        aria-label="Thermal targeting screen. Move to aim and click or tap to fire."
      />
      <div className="flir-scanlines" aria-hidden="true" />

      <header className="goliath-hud hud-top">
        <div className="hud-meter"><div><span>TEAM</span><b>{hud.team}</b></div><i><em style={{ width: `${hud.team}%` }} /></i></div>
        <div className="mission-clock"><span>WAVE {wave + 1}/3 // {location.name}</span><b>00:{`${hud.time}`.padStart(2, "0")}</b></div>
        <div className="hud-meter"><div><span>PROGRESS</span><b>{progress}%</b></div><i><em style={{ width: `${progress}%` }} /></i></div>
        <div className="hud-actions"><button onClick={toggleAudio}>{audioOn ? "SOUND ON" : "SOUND OFF"}</button><button className="hud-abort" onClick={onExit}>ABORT</button></div>
      </header>

      <div className="goliath-hud ammo-readout"><span>{WEAPONS[weapon].caliber}</span><b>{hud[weapon]}</b><small>WHOT // ARMED // {location.sector}</small></div>
      <button className="magnification-control" onClick={() => chooseZoom(zoom === 1 ? 1.45 : 1)}><span>MAGNIFICATION</span><b>{zoom === 1 ? "5X" : "10X"}</b></button>
      <button className={`support-control ${supportReady ? "ready" : "spent"}`} onClick={callSupport} disabled={!supportReady}><span>SUPPORT</span><b>{supportReady ? "STRAFE READY" : "DEPLOYED"}</b><small>Q</small></button>

      <div className="weapon-deck" aria-label="Weapon selection">
        {(Object.keys(WEAPONS) as Weapon[]).map((id, index) => (
          <button key={id} className={weapon === id ? "selected" : ""} onClick={() => chooseWeapon(id)}>
            <span>{WEAPONS[id].label}</span><b>{WEAPONS[id].caliber}</b><em>{hud[id]}</em><small>{index + 1}</small>
          </button>
        ))}
      </div>

      {phase === "briefing" && (
        <div className="gunner-overlay">
          <div className="gunner-card goliath-brief">
            <p>DEAD FREIGHT // THREE-SECTOR SORTIE</p>
            <h2>CONNECT TO AIR SUPPORT</h2>
            <strong>THE CONTAINER HAS BEEN MOVED AGAIN</strong>
            <p className="brief-copy">Track the outbreak through Pier 400, the Cypress rail yard, and the LSIA cargo apron. Every sector has several breach points and a larger infected wave. Protect Team Echo through all three contacts.</p>
            <div className="gunner-controls"><span>AIM / FIRE</span><b>MOUSE OR TOUCH</b><span>WEAPONS</span><b>1 / 2 / 3</b><span>MAGNIFY</span><b>Z OR MOUSE WHEEL</b><span>SUPPORT STRAFE</span><b>Q</b></div>
            <button onClick={() => prepareWave(0, true)} disabled={!assetsReady}>{assetsReady ? "CONNECT TO GUNSHIP 2-1" : "CALIBRATING SENSOR..."}</button>
            <button className="ghost-action" onClick={onExit}>RETURN TO CASE MAP</button>
          </div>
        </div>
      )}

      {phase === "connecting" && (
        <div className="connection-screen" aria-live="polite">
          <div className="connection-noise" />
          <div className="connection-orbit"><i /><i /><i /><b>2-1</b></div>
          <p>DEAD FREIGHT // SECURE AIR NET</p>
          <h2>CONNECTING TO AIR SUPPORT</h2>
          <strong>{location.name} // {location.sector}</strong>
          <div className="connection-progress"><i style={{ width: `${Math.min(100, 12 + connectionStage * 24)}%` }} /></div>
          <div className="connection-log">
            {connectionLabels.slice(0, connectionStage + 1).map((label, index) => <span key={label} className={index < connectionStage ? "complete" : "current"}>{index < connectionStage ? "✓" : "›"} {label}</span>)}
          </div>
          <small>UPLINK {Math.min(100, 12 + connectionStage * 24)}% // STANDBY</small>
        </div>
      )}

      {phase === "waveComplete" && (
        <div className="gunner-overlay">
          <div className="gunner-card outcome won sector-clear">
            <p>GUNSHIP 2-1 // CONTACT REPORT</p>
            <h2>{location.name} CONTAINED</h2>
            <strong>{hud.kills} ELIMINATED // TEAM HEALTH {hud.team}%</strong>
            <p className="brief-copy">Ground units report the container has already left the sector. Its transponder just appeared at {LOCATIONS[wave + 1].name}. Reconnect before the next breach spreads.</p>
            <button onClick={() => prepareWave(wave + 1)}>CONNECT TO {LOCATIONS[wave + 1].name}</button>
          </div>
        </div>
      )}

      {(phase === "won" || phase === "lost") && (
        <div className="gunner-overlay">
          <div className={`gunner-card outcome ${phase}`}>
            <p>GUNSHIP 2-1 // AFTER ACTION</p>
            <h2>{phase === "won" ? "ALL SECTORS CONTAINED" : "GROUND TEAM LOST"}</h2>
            <strong>{totalKillsRef.current} ELIMINATED // TEAM HEALTH {hud.team}% // WAVE {wave + 1}/3</strong>
            <p className="brief-copy">{phase === "won" ? `Team Echo stopped the last infected at ${location.name}. The zombie container is secured for recovery.` : `The infected overwhelmed Team Echo at ${location.name}. Reconnect and fly the three-sector sortie again.`}</p>
            <button onClick={() => prepareWave(0, true)}>{phase === "won" ? "FLY FULL SORTIE AGAIN" : "RESTART FROM PIER 400"}</button>
            <button className="ghost-action" onClick={onExit}>RETURN TO CASE MAP</button>
          </div>
        </div>
      )}
    </section>
  );
}
