"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Target = {
  id: number;
  x: number;
  y: number;
  speed: number;
  size: number;
  wobble: number;
  phase: number;
  sprite: number;
  drift: number;
};

type Impact = { x: number; y: number; life: number };
type Phase = "briefing" | "active" | "won" | "lost";

const TOTAL_TARGETS = 20;
const MAX_ESCAPES = 4;
const MISSION_SECONDS = 55;

export function ThermalGunner({ onExit }: { onExit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const targetsRef = useRef<Target[]>([]);
  const impactsRef = useRef<Impact[]>([]);
  const aimRef = useRef({ x: 640, y: 360 });
  const killsRef = useRef(0);
  const escapedRef = useRef(0);
  const ammoRef = useRef(120);
  const spawnedRef = useRef(0);
  const flashRef = useRef(0);
  const startRef = useRef(0);
  const backgroundRef = useRef<HTMLImageElement | null>(null);
  const spriteRef = useRef<HTMLImageElement | null>(null);
  const [assetsReady, setAssetsReady] = useState(false);
  const [phase, setPhase] = useState<Phase>("briefing");
  const [hud, setHud] = useState({ kills: 0, escaped: 0, ammo: 120, time: MISSION_SECONDS });

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
    background.src = "/flir-port-bg.png";
    sprites.src = "/flir-zombie-sheet.png";
    backgroundRef.current = background;
    spriteRef.current = sprites;
  }, []);

  const startMission = useCallback(() => {
    if (!assetsReady) return;
    targetsRef.current = [];
    impactsRef.current = [];
    killsRef.current = 0;
    escapedRef.current = 0;
    ammoRef.current = 120;
    spawnedRef.current = 0;
    flashRef.current = 0;
    startRef.current = performance.now();
    aimRef.current = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    setHud({ kills: 0, escaped: 0, ammo: 120, time: MISSION_SECONDS });
    setPhase("active");
  }, [assetsReady]);

  const fire = useCallback(() => {
    if (phase !== "active" || ammoRef.current <= 0) return;
    ammoRef.current -= 1;
    flashRef.current = 1;
    const aim = aimRef.current;
    let hitIndex = -1;
    let nearest = Infinity;

    targetsRef.current.forEach((target, index) => {
      const distance = Math.hypot((target.x - aim.x) / 1.25, (target.y - aim.y) / 1.8);
      if (distance < target.size * 1.65 && distance < nearest) {
        nearest = distance;
        hitIndex = index;
      }
    });

    if (hitIndex >= 0) {
      const [target] = targetsRef.current.splice(hitIndex, 1);
      impactsRef.current.push({ x: target.x, y: target.y, life: 1 });
      killsRef.current += 1;
    }
    setHud((old) => ({ ...old, kills: killsRef.current, ammo: ammoRef.current }));
  }, [phase]);

  useEffect(() => {
    if (phase !== "active") return;
    const onKeyDown = (event: KeyboardEvent) => {
      const step = event.shiftKey ? 36 : 18;
      if (event.key === "ArrowLeft") aimRef.current.x -= step;
      if (event.key === "ArrowRight") aimRef.current.x += step;
      if (event.key === "ArrowUp") aimRef.current.y -= step;
      if (event.key === "ArrowDown") aimRef.current.y += step;
      if (event.code === "Space") {
        event.preventDefault();
        fire();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [fire, phase]);

  useEffect(() => {
    if (phase !== "active") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    let frame = 0;
    let last = performance.now();
    let lastHud = 0;

    function resize() {
      if (!canvas) return;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(window.innerWidth * ratio);
      canvas.height = Math.floor(window.innerHeight * ratio);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      context?.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    function drawPort(width: number, height: number, elapsed: number) {
      if (!context) return;
      const background = backgroundRef.current;
      context.fillStyle = "#080908";
      context.fillRect(0, 0, width, height);
      if (background?.complete && background.naturalWidth) {
        const scale = Math.max(width / background.naturalWidth, height / background.naturalHeight) * 1.02;
        const sourceWidth = width / scale;
        const sourceHeight = height / scale;
        const swayX = Math.sin(elapsed * .17) * background.naturalWidth * .002;
        const swayY = Math.cos(elapsed * .12) * background.naturalHeight * .002;
        const sourceX = (background.naturalWidth - sourceWidth) / 2 + swayX;
        const sourceY = (background.naturalHeight - sourceHeight) / 2 + swayY;
        context.filter = "grayscale(1) contrast(1.24) brightness(.76)";
        context.drawImage(background, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height);
        context.filter = "none";
      }

      const vignette = context.createRadialGradient(width * .5, height * .5, height * .18, width * .5, height * .5, height * .78);
      vignette.addColorStop(0, "rgba(0,0,0,0)");
      vignette.addColorStop(1, "rgba(0,0,0,.46)");
      context.fillStyle = vignette;
      context.fillRect(0, 0, width, height);

      context.fillStyle = "rgba(240,245,240,.08)";
      for (let i = 0; i < 145; i += 1) {
        const x = (i * 173 + frame * 7) % width;
        const y = (i * 97 + frame * 3) % height;
        context.fillRect(x, y, 1 + (i % 3), 1);
      }
    }

    function drawTarget(target: Target, elapsed: number) {
      if (!context) return;
      const sprites = spriteRef.current;
      if (!sprites?.complete || !sprites.naturalWidth) return;
      const stride = Math.sin(elapsed * 4.5 + target.phase);
      const x = target.x;
      const y = target.y + Math.sin(elapsed * 2 + target.wobble) * 5;
      const size = target.size;
      const tileWidth = sprites.naturalWidth / 4;
      const tileHeight = sprites.naturalHeight / 2;
      const column = target.sprite % 4;
      const row = Math.floor(target.sprite / 4);
      const drawWidth = size * 2.6;
      const drawHeight = size * 4.2;
      context.save();
      context.translate(x, y);
      context.rotate(stride * .012);
      context.globalCompositeOperation = "screen";
      context.globalAlpha = .94;
      context.filter = "contrast(1.38) brightness(1.15)";
      context.drawImage(sprites, column * tileWidth, row * tileHeight, tileWidth, tileHeight, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
      context.filter = "none";
      context.globalAlpha = .2;
      context.scale(1, -.2);
      context.drawImage(sprites, column * tileWidth, row * tileHeight, tileWidth, tileHeight, -drawWidth / 2, -drawHeight * 3.02, drawWidth, drawHeight);
      context.restore();
    }

    function drawImpact(impact: Impact) {
      if (!context) return;
      context.save();
      context.strokeStyle = `rgba(255,255,255,${impact.life})`;
      context.lineWidth = 3;
      context.shadowColor = "white";
      context.shadowBlur = 20;
      context.beginPath();
      context.arc(impact.x, impact.y, (1 - impact.life) * 40 + 5, 0, Math.PI * 2);
      context.stroke();
      context.restore();
    }

    function drawCrosshair(width: number, height: number) {
      if (!context) return;
      const aim = aimRef.current;
      aim.x = Math.max(40, Math.min(width - 40, aim.x));
      aim.y = Math.max(70, Math.min(height - 50, aim.y));
      context.save();
      context.strokeStyle = flashRef.current > 0 ? "#111" : "#f7f7f7";
      context.lineWidth = 2;
      context.shadowColor = "#000";
      context.shadowBlur = 3;
      context.beginPath();
      context.moveTo(aim.x - 78, aim.y);
      context.lineTo(aim.x - 16, aim.y);
      context.moveTo(aim.x + 16, aim.y);
      context.lineTo(aim.x + 78, aim.y);
      context.moveTo(aim.x, aim.y - 70);
      context.lineTo(aim.x, aim.y - 14);
      context.moveTo(aim.x, aim.y + 14);
      context.lineTo(aim.x, aim.y + 70);
      context.stroke();
      context.strokeRect(aim.x - 5, aim.y - 5, 10, 10);
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
      frame += 1;

      while (spawnedRef.current < TOTAL_TARGETS && elapsed > .7 + spawnedRef.current * 1.55) {
        const number = spawnedRef.current;
        targetsRef.current.push({
          id: number,
          x: width * .82 + 20 + Math.random() * 35,
          y: height * (.51 + Math.random() * .27),
          speed: width * (.032 + Math.random() * .025),
          size: 28 + Math.random() * 14,
          wobble: Math.random() * 8,
          phase: Math.random() * 8,
          sprite: number % 8,
          drift: (Math.random() - .5) * height * .018,
        });
        spawnedRef.current += 1;
      }

      targetsRef.current.forEach((target) => {
        target.x -= target.speed * dt;
        target.y += target.drift * dt;
      });
      const escapedNow = targetsRef.current.filter((target) => target.x < -35).length;
      if (escapedNow) {
        escapedRef.current += escapedNow;
        targetsRef.current = targetsRef.current.filter((target) => target.x >= -35);
      }
      impactsRef.current.forEach((impact) => { impact.life -= dt * 1.8; });
      impactsRef.current = impactsRef.current.filter((impact) => impact.life > 0);

      drawPort(width, height, elapsed);
      targetsRef.current.forEach((target) => drawTarget(target, elapsed));
      impactsRef.current.forEach(drawImpact);
      drawCrosshair(width, height);

      if (flashRef.current > 0) {
        context.fillStyle = `rgba(255,255,255,${flashRef.current * .18})`;
        context.fillRect(0, 0, width, height);
        flashRef.current -= .28;
      }

      if (now - lastHud > 140) {
        setHud({ kills: killsRef.current, escaped: escapedRef.current, ammo: ammoRef.current, time });
        lastHud = now;
      }

      const resolved = killsRef.current + escapedRef.current;
      if (resolved >= TOTAL_TARGETS && spawnedRef.current >= TOTAL_TARGETS && targetsRef.current.length === 0) {
        setPhase(escapedRef.current <= MAX_ESCAPES ? "won" : "lost");
        return;
      }
      if (time <= 0 || ammoRef.current <= 0) {
        setPhase("lost");
        return;
      }
      frame = requestAnimationFrame(loop);
    }

    resize();
    window.addEventListener("resize", resize);
    frame = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(frame);
    };
  }, [phase]);

  function updateAim(event: React.PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    aimRef.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  return (
    <section className="gunner-shell" aria-label="Apache thermal gunner final mission">
      <canvas
        ref={canvasRef}
        className="flir-canvas"
        onPointerMove={updateAim}
        onPointerDown={(event) => { updateAim(event); fire(); }}
        aria-label="Thermal targeting screen. Move pointer to aim and click to fire."
      />
      <div className="flir-scanlines" aria-hidden="true" />
      <div className="flir-corners" aria-hidden="true"><i /><i /><i /><i /></div>

      <header className="gunner-hud top">
        <div><b>TADS</b><span>04:18:26 Z</span></div>
        <div className="compass"><span>3</span><span>6</span><span>E</span><b>12</b><span>S</span><span>21</span></div>
        <div className="gunship-id"><b>GUNSHIP 2-1</b><span>ALT 1240</span></div>
      </header>

      <div className="gunner-hud left"><b>FLIR</b><span>WHOT</span><span>FOV 3.0</span></div>
      <div className="gunner-hud right"><b>30MM</b><span>ARMED</span><span>RNG 0900</span></div>
      <footer className="gunner-hud bottom">
        <div><span>ELIMINATED</span><b>{hud.kills}/{TOTAL_TARGETS}</b></div>
        <div className={hud.escaped > MAX_ESCAPES ? "danger" : ""}><span>ESCAPED</span><b>{hud.escaped}/{MAX_ESCAPES}</b></div>
        <div><span>ROUNDS</span><b>{hud.ammo}</b></div>
        <div className={hud.time <= 10 ? "danger" : ""}><span>TIME</span><b>00:{`${hud.time}`.padStart(2, "0")}</b></div>
      </footer>

      {phase === "briefing" && (
        <div className="gunner-overlay">
          <div className="gunner-card">
            <p>FINAL MISSION // PIER 400</p>
            <h2>CONTAINMENT BREACH</h2>
            <strong>THE CONTAINER IS OPEN.</strong>
            <p className="brief-copy">You are the thermal gunner aboard Apache Gunship 2-1. Eliminate the infected before they leave the terminal. No more than four can escape.</p>
            <div className="gunner-controls"><span>MOUSE / TOUCH</span><b>AIM + FIRE</b><span>ARROWS + SPACE</span><b>KEYBOARD</b></div>
            <button onClick={startMission} disabled={!assetsReady}>{assetsReady ? "ARM 30MM CANNON" : "CALIBRATING FLIR..."}</button>
            <button className="ghost-action" onClick={onExit}>RETURN TO MAP</button>
          </div>
        </div>
      )}

      {(phase === "won" || phase === "lost") && (
        <div className="gunner-overlay">
          <div className={`gunner-card outcome ${phase}`}>
            <p>GUNSHIP 2-1 // AFTER ACTION</p>
            <h2>{phase === "won" ? "CONTAINMENT SECURED" : "TERMINAL OVERRUN"}</h2>
            <strong>{hud.kills} INFECTED ELIMINATED // {hud.escaped} ESCAPED</strong>
            <p className="brief-copy">{phase === "won" ? "Pier 400 is locked down. Recovery teams are moving on the container now." : "Too many infected crossed the terminal perimeter. Reacquire the breach and try again."}</p>
            <button onClick={startMission}>{phase === "won" ? "RUN GUNSHIP AGAIN" : "RETRY INTERCEPT"}</button>
            <button className="ghost-action" onClick={onExit}>RETURN TO CASE MAP</button>
          </div>
        </div>
      )}
    </section>
  );
}
