"use client";

import { useState } from "react";
import { ThermalGunner } from "./ThermalGunner";

const ASSET_BASE = import.meta.env.BASE_URL || "/";

type Mission = {
  code: string;
  district: string;
  title: string;
  intel: string;
  x: number;
  y: number;
};

const missions: Mission[] = [
  { code: "TRACE 01", district: "Cypress Flats", title: "Frequency Lock", intel: "A stolen CB radio is bleeding a repeating carrier signal.", x: 58, y: 73 },
  { code: "TRACE 02", district: "La Mesa", title: "Manifest Cipher", intel: "A freight clerk left three numbers hidden in the yard report.", x: 50, y: 67 },
  { code: "TRACE 03", district: "Mirror Park", title: "Plate Reconstruction", intel: "Traffic cameras caught four broken fragments of the hauler's plate.", x: 57, y: 58 },
  { code: "TRACE 04", district: "Vinewood Hills", title: "Thermal Sweep", intel: "A police drone recorded an impossible heat source inside the refrigerated cargo.", x: 47, y: 51 },
  { code: "TRACE 05", district: "Del Perro", title: "Dispatch Timeline", intel: "Put the intercepted radio calls in order to expose the driver's next turn.", x: 37, y: 66 },
  { code: "TRACE 06", district: "LSIA", title: "Axle Load Analysis", intel: "Airport scales logged the truck, but the container weight was scrubbed.", x: 38, y: 83 },
  { code: "TRACE 07", district: "Maze Bank Arena", title: "Bio-Sample Match", intel: "Match residue from the loading latch to the stolen lab inventory.", x: 46, y: 77 },
  { code: "TRACE 08", district: "Elysian Island", title: "Route Forecast", intel: "Use the final driver chatter to predict the container's last stop.", x: 56, y: 85 },
];

const feed = [
  ["02:17", "Port alarm disabled", "Security reports teeth marks on the control box."],
  ["02:31", "Reefer unit online", "LS-09 is drawing power, but transmitting no temperature."],
  ["02:46", "Camera loop detected", "The same truck appears twice, eleven minutes apart."],
  ["03:02", "Drone feed corrupted", "A human heat cluster is moving inside the steel box."],
  ["03:19", "Civilian call intercepted", "Screaming heard beneath the Del Perro overpass."],
  ["03:34", "Runway gate breached", "The hauler crossed LSIA service road without clearance."],
  ["03:48", "Lab tag recovered", "Biohazard seal Z9-G-03 found near the arena tunnel."],
  ["04:01", "Dock route confirmed", "Truck is southbound toward the terminal cranes."],
];

const thermalCells = [
  ["A1", "03C"], ["A2", "04C"], ["A3", "02C"],
  ["B1", "05C"], ["B2", "31C"], ["B3", "03C"],
  ["C1", "02C"], ["C2", "04C"], ["C3", "03C"],
];

const timelineEvents = [
  { id: "blackout", time: "03:16", text: "Del Perro substation drops offline" },
  { id: "pickup", time: "02:58", text: "Hauler exits the Mirror Park service lot" },
  { id: "breakin", time: "03:09", text: "Vinewood patrol loses drone contact" },
];

export default function Home() {
  const [cleared, setCleared] = useState<boolean[]>(Array(missions.length).fill(false));
  const [active, setActive] = useState<number | null>(null);
  const [notice, setNotice] = useState("Select the first trace on the map.");
  const [gameError, setGameError] = useState("");
  const [frequency, setFrequency] = useState(0);
  const [manifest, setManifest] = useState("");
  const [choice, setChoice] = useState("");
  const [timeline, setTimeline] = useState<string[]>([]);
  const [gunner, setGunner] = useState(false);

  const progress = cleared.filter(Boolean).length;
  const complete = progress === missions.length;
  const threat = Math.min(96, 32 + progress * 8);
  const current = active === null ? null : missions[active];

  function clearInputs() {
    setGameError("");
    setFrequency(0);
    setManifest("");
    setChoice("");
    setTimeline([]);
  }

  function unlock(index: number) {
    setCleared((old) => old.map((value, i) => (i === index ? true : value)));
    setActive(null);
    setNotice(index === missions.length - 1 ? "All traces confirmed. Final containment point exposed." : `Trace ${index + 1} confirmed. A new location is active.`);
  }

  function verify(ok: boolean, message: string) {
    if (active === null) return;
    if (ok) unlock(active);
    else setGameError(message);
  }

  function openMission(index: number) {
    if (index > 0 && !cleared[index - 1]) {
      setNotice("That trace is cold. Clear the previous lead first.");
      return;
    }
    if (cleared[index]) {
      setNotice(`Trace ${index + 1} is already secured.`);
      return;
    }
    clearInputs();
    setActive(index);
  }

  function addTimelineEvent(id: string) {
    const correctOrder = ["pickup", "breakin", "blackout"];
    if (id === correctOrder[timeline.length]) {
      setTimeline((old) => [...old, id]);
      setGameError("");
    } else {
      setTimeline([]);
      setGameError("Timeline corrupted. Start with the earliest call.");
    }
  }

  function resetCase() {
    setCleared(Array(missions.length).fill(false));
    setActive(null);
    setNotice("Case reset. Select the first trace on the map.");
    setGunner(false);
    clearInputs();
  }

  return (
    <main className="app-shell">
      <div className="noise" aria-hidden="true" />

      <header className="topbar">
        <div className="brand-block">
          <div className="hazard-mark" aria-hidden="true">{"\u2623"}</div>
          <div>
            <p className="eyebrow">LOS SANTOS // BIOHAZARD RESPONSE</p>
            <h1>DEAD FREIGHT</h1>
          </div>
        </div>
        <div className="status-cluster">
          <span className="live-dot" aria-hidden="true" />
          <div><span className="status-label">LIVE OPERATION</span><strong>CONTAINER LS-09</strong></div>
          <div className="case-number">CASE 0066-B</div>
        </div>
      </header>

      <section className="mission-strip" aria-label="Mission status">
        <div><span>OBJECTIVE</span><strong>TRACK THE INFECTED CARGO</strong></div>
        <p>{notice}</p>
        <div className="progress-dots" aria-label={`${progress} of ${missions.length} traces completed`}>
          {missions.map((mission, index) => <span key={mission.code} className={cleared[index] ? "done" : index === progress ? "current" : ""} />)}
          <b>{progress}/{missions.length}</b>
        </div>
      </section>

      <div className="workspace">
        <section className="map-card" aria-label="Los Santos tracking map">
          <div className="panel-heading">
            <div><span>TACTICAL OVERLAY</span><h2>LOS SANTOS / BLAINE COUNTY</h2></div>
            <div className="map-key"><i /> ACTIVE TRACE <i /> CONFIRMED</div>
          </div>

          <div className="map-stage">
            <img src={`${ASSET_BASE}los-santos-map.jpg`} alt="Grand Theft Auto V map of Los Santos and Blaine County" />
            <div className="map-vignette" aria-hidden="true" />
            <div className="scanline" aria-hidden="true" />

            {missions.slice(0, -1).map((mission, index) => {
              const next = missions[index + 1];
              const dx = next.x - mission.x;
              const dy = next.y - mission.y;
              const width = Math.sqrt(dx * dx + dy * dy);
              const angle = Math.atan2(dy, dx) * 180 / Math.PI;
              return <div key={`line-${mission.code}`} className={`route-line ${cleared[index] ? "route-live" : ""}`} style={{ left: `${mission.x}%`, top: `${mission.y}%`, width: `${width}%`, transform: `rotate(${angle}deg)` }} />;
            })}

            {missions.map((mission, index) => {
              const isLocked = index > 0 && !cleared[index - 1];
              const labelLeft = mission.x > 52 || index === 3 || index === 6;
              return (
                <button
                  key={mission.code}
                  className={`map-marker ${cleared[index] ? "cleared" : ""} ${isLocked ? "locked" : ""} ${labelLeft ? "label-left" : ""}`}
                  style={{ left: `${mission.x}%`, top: `${mission.y}%` }}
                  onClick={() => openMission(index)}
                  aria-label={`${mission.code}, ${mission.district}${isLocked ? ", locked" : ""}`}
                >
                  <span className="pulse-ring" />
                  <span className="marker-core">{cleared[index] ? "OK" : isLocked ? "X" : index + 1}</span>
                  <span className="marker-label"><b>{mission.code}</b>{mission.district}</span>
                </button>
              );
            })}

            {complete && (
              <div className="final-target" style={{ left: "64%", top: "90%" }}>
                <span className="target-rings" />
                <div><b>CONTAINER FOUND</b>PIER 400 // TERMINAL</div>
              </div>
            )}

            <div className="coordinates">34{"\u00B0"}00&apos;N&nbsp;&nbsp;118{"\u00B0"}15&apos;W<br />SAT FEED / NIGHT FILTER</div>
          </div>
        </section>

        <aside className="intel-rail">
          <section className="threat-card">
            <div className="panel-heading compact"><div><span>THREAT ASSESSMENT</span><h2>CONTAGION RISK</h2></div><strong>{threat}%</strong></div>
            <div className="threat-meter"><span style={{ width: `${threat}%` }} /></div>
            <p>Estimated <b>23 infected</b> inside a refrigerated shipping container. Do not breach the doors.</p>
          </section>

          <section className="evidence-card">
            <div className="panel-heading compact"><div><span>INTERCEPTED</span><h2>INCIDENT FEED</h2></div><small>LIVE</small></div>
            <div className="feed-list">
              {feed.map((item, index) => (
                <article key={item[0]} className={index < progress ? "verified" : ""}>
                  <time>{item[0]}</time><div><h3>{item[1]}</h3><p>{item[2]}</p></div>
                </article>
              ))}
            </div>
          </section>

          <section className={`containment-card ${complete ? "revealed" : ""}`}>
            <span>FINAL DIRECTIVE</span>
            {complete ? (
              <><h2>CONTAINMENT BREACH</h2><p>The truck reached Pier 400, but the container doors failed. Gunship 2-1 is overhead and waiting for a thermal gunner.</p><button onClick={() => setGunner(true)}>BEGIN GUNSHIP INTERCEPT</button><button className="secondary-case-action" onClick={resetCase}>RUN CASE AGAIN</button></>
            ) : (
              <><h2>LOCATION REDACTED</h2><p>Complete all eight field traces before the truck reaches a populated district.</p><div className="redactions"><i /><i /><i /></div></>
            )}
          </section>
        </aside>
      </div>

      <footer><span>UNAUTHORIZED SIGNAL // STAY OFF OPEN CHANNELS</span><span>Fan-made concept. Grand Theft Auto V map imagery belongs to Rockstar Games.</span></footer>

      {current && active !== null && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setActive(null)}>
          <section className="game-modal" role="dialog" aria-modal="true" aria-labelledby="game-title">
            <button className="modal-close" onClick={() => setActive(null)} aria-label="Close mini-game">X</button>
            <p className="eyebrow">{current.code} // {current.district}</p>
            <h2 id="game-title">{current.title}</h2>
            <p className="game-intro">{current.intel}</p>

            {active === 0 && (
              <div>
                <div className="radio-display"><span>CARRIER SEARCH</span><strong>{frequency ? `${frequency.toFixed(1)} MHz` : "---.- MHz"}</strong><div className={`waveform ${frequency === 106.7 ? "locked-wave" : ""}`}>{Array.from({ length: 26 }).map((_, i) => <i key={i} style={{ height: `${18 + ((i * 17) % 58)}%` }} />)}</div></div>
                <p className="game-clue">Find the channel with a clean repeating pulse: <b>short / short / long.</b></p>
                <div className="choice-grid three">{[98.3, 106.7, 114.9].map((value) => <button key={value} className={frequency === value ? "selected" : ""} onClick={() => setFrequency(value)}>{value}<small>MHz</small></button>)}</div>
                <button className="primary-action" disabled={!frequency} onClick={() => verify(frequency === 106.7, "Static only. Try the repeating carrier.")}>LOCK SIGNAL</button>
              </div>
            )}

            {active === 1 && (
              <div>
                <div className="clue-row"><div><span>VESSEL</span><b>BERTH 7</b></div><div><span>PALLET</span><b>ROW 4</b></div><div><span>GATE</span><b>CAM 2</b></div></div>
                <p className="game-clue">The clerk writes access codes in <b>arrival order.</b> Enter the three-digit yard code.</p>
                <div className="code-display">{manifest.padEnd(3, "-").split("").join(" ")}</div>
                <div className="keypad">{[1,2,3,4,5,6,7,8,9].map((n) => <button key={n} onClick={() => manifest.length < 3 && setManifest(`${manifest}${n}`)}>{n}</button>)}<button onClick={() => setManifest("")}>CLR</button><button onClick={() => manifest.length < 3 && setManifest(`${manifest}0`)}>0</button><button onClick={() => setManifest(manifest.slice(0, -1))}>DEL</button></div>
                <button className="primary-action" disabled={manifest.length !== 3} onClick={() => verify(manifest === "742", "Code rejected. Read the report in arrival order.")}>DECODE MANIFEST</button>
              </div>
            )}

            {active === 2 && (
              <div>
                <div className="camera-fragments"><span>LS</span><span>09</span><span>X</span><span>4</span></div>
                <p className="game-clue">Camera 3 reads left to right. Rebuild the plate from the four surviving frames.</p>
                <div className="choice-grid plates">{["L5O9X4", "LS09X4", "LS90K4", "L509XH"].map((value) => <button key={value} className={choice === value ? "selected" : ""} onClick={() => setChoice(value)}>{value}<small>suspect plate</small></button>)}</div>
                <button className="primary-action" disabled={!choice} onClick={() => verify(choice === "LS09X4", "Plate mismatch. One fragment uses a letter, not a number.")}>RUN PLATE</button>
              </div>
            )}

            {active === 3 && (
              <div>
                <div className="thermal-grid">{thermalCells.map(([cell, temp]) => <button key={cell} className={`${temp === "31C" ? "thermal-hot" : ""} ${choice === cell ? "selected" : ""}`} onClick={() => setChoice(cell)}><span>{cell}</span><b>{temp}</b></button>)}</div>
                <p className="game-clue">A working reefer should remain below 5C. Mark the impossible thermal reading.</p>
                <button className="primary-action" disabled={!choice} onClick={() => verify(choice === "B2", "Normal refrigeration noise. Find the human-temperature cluster.")}>MARK HEAT SOURCE</button>
              </div>
            )}

            {active === 4 && (
              <div>
                <p className="game-clue">Select the three calls from earliest to latest. A wrong selection resets the timeline.</p>
                <div className="timeline-list">{timelineEvents.map((event) => <button key={event.id} className={timeline.includes(event.id) ? "selected" : ""} disabled={timeline.includes(event.id)} onClick={() => addTimelineEvent(event.id)}><span>{event.time}</span><b>{event.text}</b><i>{timeline.indexOf(event.id) + 1 || ""}</i></button>)}</div>
                <button className="primary-action" disabled={timeline.length !== 3} onClick={() => verify(true, "")}>CONFIRM TIMELINE</button>
              </div>
            )}

            {active === 5 && (
              <div>
                <div className="weight-equation"><div><span>TRACTOR</span><b>8t</b></div><em>+</em><div><span>TRAILER</span><b>6t</b></div><em>+</em><div className="unknown"><span>CONTAINER</span><b>?</b></div><em>=</em><div><span>TOTAL</span><b>34t</b></div></div>
                <p className="game-clue">Subtract the known vehicle weight to recover the container load.</p>
                <div className="choice-grid three">{[14, 20, 26].map((value) => <button key={value} className={choice === `${value}` ? "selected" : ""} onClick={() => setChoice(`${value}`)}>{value}<small>metric tons</small></button>)}</div>
                <button className="primary-action" disabled={!choice} onClick={() => verify(choice === "20", "Scale math does not balance. Subtract both vehicle weights.")}>VERIFY AXLE LOAD</button>
              </div>
            )}

            {active === 6 && (
              <div>
                <div className="sample-readout"><span>RECOVERED RESIDUE</span><b>STRAIN Z-9</b><small>UV: GREEN // STORAGE: 03C</small></div>
                <p className="game-clue">Choose the stolen canister matching all three lab markers.</p>
                <div className="choice-grid samples">{[["A", "Z7-R-03"], ["B", "Z9-G-03"], ["C", "Z9-G-08"]].map(([id, code]) => <button key={id} className={choice === id ? "selected" : ""} onClick={() => setChoice(id)}><b>CANISTER {id}</b><small>{code}</small></button>)}</div>
                <button className="primary-action" disabled={!choice} onClick={() => verify(choice === "B", "Sample rejected. Match strain, UV reaction, and storage temperature.")}>MATCH SAMPLE</button>
              </div>
            )}

            {active === 7 && (
              <div>
                <blockquote>"South past the arena. Stay under the bridge cameras. Cold storage by the water. Blue cranes. East gate."</blockquote>
                <p className="game-clue">Cross-reference the route chatter. Where is the container headed?</p>
                <div className="choice-grid routes">{["LSIA Freight Depot", "Terminal / Pier 400", "Del Perro Pier"].map((value) => <button key={value} className={choice === value ? "selected" : ""} onClick={() => setChoice(value)}>{value}<small>{value.includes("Terminal") ? "Industrial port" : value.includes("LSIA") ? "Airport cargo" : "Tourist district"}</small></button>)}</div>
                <button className="primary-action" disabled={!choice} onClick={() => verify(choice === "Terminal / Pier 400", "Route prediction failed. Re-read the driver chatter.")}>COMMIT INTERCEPT</button>
              </div>
            )}

            {gameError && <p className="game-error" role="alert">{gameError}</p>}
          </section>
        </div>
      )}
      {gunner && <ThermalGunner onExit={() => setGunner(false)} />}
    </main>
  );
}
