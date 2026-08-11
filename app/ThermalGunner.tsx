"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Weapon = "alpha" | "bravo" | "ltm";
type Phase = "briefing" | "active" | "won" | "lost";

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

const TOTAL_TARGETS = 30;
const MISSION_SECONDS = 65;
const TEAM_POINT = { x: .26, y: .73 };

const WEAPONS = {
  alpha: { label: "ALPHA", caliber: "25MM", radius: 28, damage: 1, cooldown: 105 },
  bravo: { label: "BRAVO", caliber: "40MM", radius: 86, damage: 2, cooldown: 900 },
  ltm: { label: "LTM", caliber: "AGM-114", radius: 155, damage: 9, cooldown: 3300 },
} as const;

function toScreen(x: number, y: number, width: number, height: number, zoom: number) {
  return {
    x: width / 2 + (x * width - width / 2) * zoom,
    y: height / 2 + (y * height - height / 2) * zoom,
  };
}

export function ThermalGunner({ onExit }: { onExit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const backgroundRef = useRef<HTMLImageElement | null>(null);
  const spriteRef = useRef<HTMLImageElement | null>(null);
  const targetsRef = useRef<Target[]>([]);
  const blastsRef = useRef<Blast[]>([]);
  const aimRef = useRef({ x: 640, y: 360 });
  const ammoRef = useRef({ alpha: 180, bravo: 24, ltm: 4 });
  const weaponRef = useRef<Weapon>("alpha");
  const zoomRef = useRef(1);
  const killsRef = useRef(0);
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
  const [supportReady, setSupportReady] = useState(true);
  const [hud, setHud] = useState<Hud>({ team: 100, kills: 0, breached: 0, time: MISSION_SECONDS, alpha: 180, bravo: 24, ltm: 4 });

  useEffect(() => {
    let loaded = 0;
    const ready = () => {
      loaded += 1;
      if (loaded === 2) setAssetsReady(true);
    };
    const background = new window.Image();
    const sprites = new window.Image();
    background.onload = ready;
    sprites.onload = ready;
    background.src = "/flir-port-topdown.png";
    sprites.src = "/flir-zombies-topdown.png";
    backgroundRef.current = background;
    spriteRef.current = sprites;
  }, []);

  function chooseWeapon(next: Weapon) {
    weaponRef.current = next;
    setWeapon(next);
  }

  function chooseZoom(next: number) {
    zoomRef.current = next;
    setZoom(next);
  }

  const startMission = useCallback(() => {
    if (!assetsReady) return;
    targetsRef.current = [];
    blastsRef.current = [];
    ammoRef.current = { alpha: 180, bravo: 24, ltm: 4 };
    killsRef.current = 0;
    breachedRef.current = 0;
    teamRef.current = 100;
    spawnedRef.current = 0;
    supportRef.current = true;
    lastShotRef.current = 0;
    shakeRef.current = 0;
    weaponRef.current = "alpha";
    zoomRef.current = 1;
    setWeapon("alpha");
    setZoom(1);
    setSupportReady(true);
    setHud({ team: 100, kills: 0, breached: 0, time: MISSION_SECONDS, alpha: 180, bravo: 24, ltm: 4 });
    aimRef.current = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    startRef.current = performance.now();
    setPhase("active");
  }, [assetsReady]);

  const fire = useCallback(() => {
    if (phase !== "active") return;
    const selected = weaponRef.current;
    const config = WEAPONS[selected];
    const now = performance.now();
    if (now - lastShotRef.current < config.cooldown || ammoRef.current[selected] <= 0) return;
    lastShotRef.current = now;
    ammoRef.current[selected] -= 1;

    const width = window.innerWidth;
    const height = window.innerHeight;
    const zoomLevel = zoomRef.current;
    const aim = aimRef.current;
    let candidates = targetsRef.current.map((target, index) => {
      const point = toScreen(target.x, target.y, width, height, zoomLevel);
      return { target, index, distance: Math.hypot(point.x - aim.x, point.y - aim.y) };
    });

    if (selected === "alpha") {
      candidates = candidates.filter((entry) => entry.distance < config.radius + entry.target.size).sort((a, b) => a.distance - b.distance).slice(0, 1);
    } else {
      candidates = candidates.filter((entry) => entry.distance < config.radius);
    }
    candidates.forEach(({ target }) => { target.hp -= config.damage; });
    const before = targetsRef.current.length;
    targetsRef.current = targetsRef.current.filter((target) => target.hp > 0);
    killsRef.current += before - targetsRef.current.length;

    blastsRef.current.push({
      x: aim.x,
      y: aim.y,
      radius: config.radius,
      life: 0,
      duration: selected === "alpha" ? .22 : selected === "bravo" ? .75 : 1.25,
      type: selected,
    });
    if (selected === "ltm") {
      [[-58, 26], [48, -34], [35, 52]].forEach(([dx, dy]) => blastsRef.current.push({ x: aim.x + dx, y: aim.y + dy, radius: 72, life: -.12, duration: .9, type: "ltm" }));
    }
    shakeRef.current = selected === "alpha" ? .12 : selected === "bravo" ? .65 : 1.3;
    setHud((old) => ({ ...old, kills: killsRef.current, ...ammoRef.current }));
  }, [phase]);

  const callSupport = useCallback(() => {
    if (phase !== "active" || !supportRef.current) return;
    supportRef.current = false;
    setSupportReady(false);
    const width = window.innerWidth;
    const height = window.innerHeight;
    for (let i = 0; i < 9; i += 1) {
      blastsRef.current.push({ x: width * (.18 + i * .08), y: height * (.28 + i * .045), radius: 58, life: -i * .07, duration: .7, type: "support" });
    }
    const before = targetsRef.current.length;
    targetsRef.current = targetsRef.current.filter((target) => target.x < .42 || target.y > .75);
    killsRef.current += before - targetsRef.current.length;
    shakeRef.current = 1.1;
    setHud((old) => ({ ...old, kills: killsRef.current }));
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

    function resize() {
      if (!canvas || !context) return;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(window.innerWidth * ratio);
      canvas.height = Math.floor(window.innerHeight * ratio);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    function drawBackground(width: number, height: number) {
      if (!context) return;
      const image = backgroundRef.current;
      context.fillStyle = "#111";
      context.fillRect(0, 0, width, height);
      if (image?.complete && image.naturalWidth) {
        const aspect = width / height;
        const imageAspect = image.naturalWidth / image.naturalHeight;
        let sourceWidth = image.naturalWidth / zoomRef.current;
        let sourceHeight = image.naturalHeight / zoomRef.current;
        if (imageAspect > aspect) sourceWidth = sourceHeight * aspect;
        else sourceHeight = sourceWidth / aspect;
        const shake = shakeRef.current * 7;
        const sourceX = (image.naturalWidth - sourceWidth) / 2 + (Math.random() - .5) * shake;
        const sourceY = (image.naturalHeight - sourceHeight) / 2 + (Math.random() - .5) * shake;
        context.filter = "grayscale(1) contrast(1.28) brightness(.72)";
        context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height);
        context.filter = "none";
      }
      const vignette = context.createRadialGradient(width / 2, height / 2, height * .18, width / 2, height / 2, height * .82);
      vignette.addColorStop(0, "rgba(0,0,0,0)");
      vignette.addColorStop(1, "rgba(0,0,0,.48)");
      context.fillStyle = vignette;
      context.fillRect(0, 0, width, height);
      context.fillStyle = "rgba(255,255,255,.08)";
      for (let i = 0; i < 90; i += 1) {
        context.fillRect((i * 191 + noiseFrame * 11) % width, (i * 83 + noiseFrame * 5) % height, i % 4 === 0 ? 2 : 1, 1);
      }
    }

    function drawTeam(width: number, height: number) {
      if (!context) return;
      const point = toScreen(TEAM_POINT.x, TEAM_POINT.y, width, height, zoomRef.current);
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
      const sprites = spriteRef.current;
      if (!sprites?.complete || !sprites.naturalWidth) return;
      const point = toScreen(target.x, target.y, width, height, zoomRef.current);
      const tileWidth = sprites.naturalWidth / 4;
      const tileHeight = sprites.naturalHeight / 2;
      const column = target.sprite % 4;
      const row = Math.floor(target.sprite / 4);
      const scale = target.size * zoomRef.current;
      const drawWidth = scale * (target.heavy ? 5.5 : 4.3);
      const drawHeight = scale * (target.heavy ? 5.7 : 4.6);
      context.save();
      context.translate(point.x, point.y);
      context.rotate(Math.sin(elapsed * 3 + target.sway) * .035);
      context.globalCompositeOperation = "screen";
      context.globalAlpha = .96;
      context.filter = target.heavy ? "contrast(1.55) brightness(1.3)" : "contrast(1.38) brightness(1.12)";
      context.drawImage(sprites, column * tileWidth, row * tileHeight, tileWidth, tileHeight, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
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
      const time = Math.max(0, Math.ceil(MISSION_SECONDS - elapsed));
      last = now;
      noiseFrame += 1;

      while (spawnedRef.current < TOTAL_TARGETS && elapsed > .8 + spawnedRef.current * .82) {
        const id = spawnedRef.current;
        const heavy = id > 6 && id % 7 === 0;
        const startX = .72 + Math.random() * .2;
        const startY = .12 + Math.random() * .32;
        targetsRef.current.push({
          id,
          x: startX,
          y: startY,
          speed: heavy ? .014 : .025 + Math.random() * .012,
          size: heavy ? 13 : 9 + Math.random() * 2,
          sprite: heavy ? 6 + (id % 2) : id % 6,
          hp: heavy ? 2 : 1,
          heavy,
          sway: Math.random() * 8,
        });
        spawnedRef.current += 1;
      }

      targetsRef.current.forEach((target) => {
        const dx = TEAM_POINT.x - target.x;
        const dy = TEAM_POINT.y - target.y;
        const distance = Math.hypot(dx, dy) || 1;
        target.x += (dx / distance) * target.speed * dt;
        target.y += (dy / distance) * target.speed * dt;
        target.x += Math.sin(elapsed * 1.7 + target.sway) * .0015 * dt;
      });

      const breached = targetsRef.current.filter((target) => Math.hypot(target.x - TEAM_POINT.x, target.y - TEAM_POINT.y) < .026);
      if (breached.length) {
        breached.forEach((target) => { teamRef.current -= target.heavy ? 24 : 9; });
        breachedRef.current += breached.length;
        const breachedIds = new Set(breached.map((target) => target.id));
        targetsRef.current = targetsRef.current.filter((target) => !breachedIds.has(target.id));
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
        setPhase("lost");
        return;
      }
      if (resolved >= TOTAL_TARGETS && spawnedRef.current >= TOTAL_TARGETS && targetsRef.current.length === 0) {
        setPhase("won");
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
  }, [phase]);

  function updateAim(event: React.PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    aimRef.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  const progress = Math.min(100, Math.round(((hud.kills + hud.breached) / TOTAL_TARGETS) * 100));

  return (
    <section className="gunner-shell goliath-mode" aria-label="AC-130 thermal gunner final mission">
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
        <div className="mission-clock"><span>PORT CONTAINMENT</span><b>00:{`${hud.time}`.padStart(2, "0")}</b></div>
        <div className="hud-meter"><div><span>PROGRESS</span><b>{progress}%</b></div><i><em style={{ width: `${progress}%` }} /></i></div>
        <button className="hud-abort" onClick={onExit}>ABORT</button>
      </header>

      <div className="goliath-hud ammo-readout"><span>{WEAPONS[weapon].caliber}</span><b>{hud[weapon]}</b><small>WHOT // ARMED</small></div>
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
            <p>DEAD FREIGHT // FINAL SORTIE</p>
            <h2>PROVIDE CLOSE AIR SUPPORT</h2>
            <strong>TEAM ECHO IS PINNED AT PIER 400</strong>
            <p className="brief-copy">Thirty infected are moving from the breached container toward the recovery team. Switch between rapid 25MM fire, 40MM area rounds, and four AGM strikes. Keep Team Echo alive.</p>
            <div className="gunner-controls"><span>AIM / FIRE</span><b>MOUSE OR TOUCH</b><span>WEAPONS</span><b>1 / 2 / 3</b><span>MAGNIFY</span><b>Z OR MOUSE WHEEL</b><span>SUPPORT STRAFE</span><b>Q</b></div>
            <button onClick={startMission} disabled={!assetsReady}>{assetsReady ? "BEGIN CLOSE AIR SUPPORT" : "CALIBRATING SENSOR..."}</button>
            <button className="ghost-action" onClick={onExit}>RETURN TO CASE MAP</button>
          </div>
        </div>
      )}

      {(phase === "won" || phase === "lost") && (
        <div className="gunner-overlay">
          <div className={`gunner-card outcome ${phase}`}>
            <p>GUNSHIP 2-1 // AFTER ACTION</p>
            <h2>{phase === "won" ? "TEAM ECHO EXTRACTED" : "GROUND TEAM LOST"}</h2>
            <strong>{hud.kills} ELIMINATED // TEAM HEALTH {hud.team}%</strong>
            <p className="brief-copy">{phase === "won" ? "The recovery team has secured the breached container and cleared Pier 400." : "The infected reached the recovery position. Reset the sortie and vary your weapons."}</p>
            <button onClick={startMission}>{phase === "won" ? "FLY SORTIE AGAIN" : "RETRY CLOSE AIR SUPPORT"}</button>
            <button className="ghost-action" onClick={onExit}>RETURN TO CASE MAP</button>
          </div>
        </div>
      )}
    </section>
  );
}
