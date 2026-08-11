"use client";

import { useMemo, useState } from "react";

type Mission = {
  id: number;
  code: string;
  district: string;
  title: string;
  intel: string;
  x: number;
  y: number;
};

const missions: Mission[] = [
  {
    id: 0,
    code: "TRACE 01",
    district: "Cypress Flats",
    title: "Frequency Lock",
    intel: "A stolen CB radio is bleeding a repeating carrier signal.",
    x: 58,
    y: 73,
  },
  {
    id: 1,
    code: "TRACE 02",
    district: "La Mesa",
    title: "Manifest Cipher",
    intel: "A freight clerk left three numbers hidden in the yard report.",
    x: 52,
    y: 67,
  },
  {
    id: 2,
    code: "TRACE 03",
    district: "Elysian Island",
    title: "Route Forecast",
    intel: "Use the driver chatter to predict the container's last stop.",
    x: 55,
    y: 82,
  },
];

export default function Home() {
  const [cleared, setCleared] = useState<boolean[]>([false, false, false]);
  const [active, setActive] = useState<number | null>(null);
  const [notice, setNotice] = useState("Select the first trace on the map.");
  const [frequency, setFrequency] = useState(0);
  const [manifest, setManifest] = useState("");
  const [route, setRoute] = useState("");

  const progress = cleared.filter(Boolean).length;
  const threat = 38 + progress * 19;
  const current = active === null ? null : missions[active];
  const feed = useMemo(
    () => [
      {
        time: "02:17",
        title: "Port alarm disabled",
        text: "Private security reports teeth marks on the control box.",
      },
      {
        time: "02:31",
        title: "Reefer unit online",
        text: "Container LS-09 is drawing power, but transmitting no temperature.",
      },
      {
        time: "02:46",
        title: "Driver stopped responding",
        text: "Last ping places the truck east of Downtown Los Santos.",
      },
    ],
    [],
  );

  function unlock(index: number) {
    setCleared((old) => old.map((value, i) => (i === index ? true : value)));
    setActive(null);
    setNotice(
      index === 2
        ? "All traces confirmed. Final containment point exposed."
        : `Trace ${index + 1} confirmed. A new signal has surfaced.`,
    );
  }

  function openMission(index: number) {
    const unlocked = index === 0 || cleared[index - 1];
    if (!unlocked) {
      setNotice("That trace is cold. Clear the previous lead first.");
      return;
    }
    if (cleared[index]) {
      setNotice(`Trace ${index + 1} is already secured.`);
      return;
    }
    setActive(index);
    setFrequency(0);
    setManifest("");
    setRoute("");
  }

  function resetCase() {
    setCleared([false, false, false]);
    setActive(null);
    setNotice("Case reset. Select the first trace on the map.");
  }

  return (
    <main className="app-shell">
      <div className="noise" aria-hidden="true" />

      <header className="topbar">
        <div className="brand-block">
          <div className="hazard-mark" aria-hidden="true">☣</div>
          <div>
            <p className="eyebrow">LOS SANTOS // BIOHAZARD RESPONSE</p>
            <h1 data-text="DEAD FREIGHT">DEAD FREIGHT</h1>
          </div>
        </div>
        <div className="status-cluster">
          <span className="live-dot" aria-hidden="true" />
          <div>
            <span className="status-label">LIVE OPERATION</span>
            <strong>CONTAINER LS-09</strong>
          </div>
          <div className="case-number">CASE 0066-B</div>
        </div>
      </header>

      <section className="mission-strip" aria-label="Mission status">
        <div>
          <span>OBJECTIVE</span>
          <strong>TRACK THE INFECTED CARGO</strong>
        </div>
        <p>{notice}</p>
        <div className="progress-dots" aria-label={`${progress} of 3 traces completed`}>
          {missions.map((mission, index) => (
            <span key={mission.code} className={cleared[index] ? "done" : index === progress ? "current" : ""} />
          ))}
          <b>{progress}/3</b>
        </div>
      </section>

      <div className="workspace">
        <section className="map-card" aria-label="Los Santos tracking map">
          <div className="panel-heading">
            <div>
              <span>TACTICAL OVERLAY</span>
              <h2>LOS SANTOS / BLAINE COUNTY</h2>
            </div>
            <div className="map-key"><i /> ACTIVE TRACE <i /> CONFIRMED</div>
          </div>

          <div className="map-stage">
            <img src="/los-santos-map.jpg" alt="Grand Theft Auto V map of Los Santos and Blaine County" />
            <div className="map-vignette" aria-hidden="true" />
            <div className="scanline" aria-hidden="true" />
            <div className="route-line line-one" aria-hidden="true" />
            <div className="route-line line-two" aria-hidden="true" />

            {missions.map((mission, index) => {
              const isLocked = index > 0 && !cleared[index - 1];
              return (
                <button
                  key={mission.code}
                  className={`map-marker ${cleared[index] ? "cleared" : ""} ${isLocked ? "locked" : ""}`}
                  style={{ left: `${mission.x}%`, top: `${mission.y}%` }}
                  onClick={() => openMission(index)}
                  aria-label={`${mission.code}, ${mission.district}${isLocked ? ", locked" : ""}`}
                >
                  <span className="pulse-ring" />
                  <span className="marker-core">{cleared[index] ? "✓" : isLocked ? "×" : index + 1}</span>
                  <span className="marker-label"><b>{mission.code}</b>{mission.district}</span>
                </button>
              );
            })}

            {progress === 3 && (
              <div className="final-target" style={{ left: "61%", top: "88%" }}>
                <span className="target-rings" />
                <div><b>CONTAINER FOUND</b>PIER 400 // TERMINAL</div>
              </div>
            )}

            <div className="coordinates">34°00&apos;N&nbsp;&nbsp;118°15&apos;W<br />SAT FEED / NIGHT FILTER</div>
          </div>
        </section>

        <aside className="intel-rail">
          <section className="threat-card">
            <div className="panel-heading compact">
              <div><span>THREAT ASSESSMENT</span><h2>CONTAGION RISK</h2></div>
              <strong>{threat}%</strong>
            </div>
            <div className="threat-meter"><span style={{ width: `${threat}%` }} /></div>
            <p>Estimated <b>23 infected</b> inside a refrigerated shipping container. Do not breach the doors.</p>
          </section>

          <section className="evidence-card">
            <div className="panel-heading compact">
              <div><span>INTERCEPTED</span><h2>INCIDENT FEED</h2></div>
              <small>LIVE</small>
            </div>
            <div className="feed-list">
              {feed.map((item, index) => (
                <article key={item.time} className={index < progress ? "verified" : ""}>
                  <time>{item.time}</time>
                  <div><h3>{item.title}</h3><p>{item.text}</p></div>
                </article>
              ))}
            </div>
          </section>

          <section className={`containment-card ${progress === 3 ? "revealed" : ""}`}>
            <span>FINAL DIRECTIVE</span>
            {progress === 3 ? (
              <>
                <h2>INTERCEPT AT PIER 400</h2>
                <p>The truck is entering the terminal from Chupacabra Street. Lock the east gate. Keep the container sealed.</p>
                <button onClick={resetCase}>RUN CASE AGAIN</button>
              </>
            ) : (
              <>
                <h2>LOCATION REDACTED</h2>
                <p>Complete all three field traces before the truck reaches a populated district.</p>
                <div className="redactions"><i /><i /><i /></div>
              </>
            )}
          </section>
        </aside>
      </div>

      <footer>
        <span>UNAUTHORIZED SIGNAL // STAY OFF OPEN CHANNELS</span>
        <span>Fan-made concept. Grand Theft Auto V map imagery belongs to Rockstar Games.</span>
      </footer>

      {current && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setActive(null)}>
          <section className="game-modal" role="dialog" aria-modal="true" aria-labelledby="game-title">
            <button className="modal-close" onClick={() => setActive(null)} aria-label="Close mini-game">×</button>
            <p className="eyebrow">{current.code} // {current.district}</p>
            <h2 id="game-title">{current.title}</h2>
            <p className="game-intro">{current.intel}</p>

            {active === 0 && (
              <div className="frequency-game">
                <div className="radio-display">
                  <span>CARRIER SEARCH</span>
                  <strong>{frequency ? `${frequency.toFixed(1)} MHz` : "---.- MHz"}</strong>
                  <div className={`waveform ${frequency === 106.7 ? "locked-wave" : ""}`}>
                    {Array.from({ length: 26 }).map((_, i) => <i key={i} style={{ height: `${18 + ((i * 17) % 58)}%` }} />)}
                  </div>
                </div>
                <p className="game-clue">Find the channel with a clean repeating pulse: <b>short / short / long.</b></p>
                <div className="choice-grid three">
                  {[98.3, 106.7, 114.9].map((value) => (
                    <button key={value} className={frequency === value ? "selected" : ""} onClick={() => setFrequency(value)}>{value}<small>MHz</small></button>
                  ))}
                </div>
                <button className="primary-action" disabled={!frequency} onClick={() => frequency === 106.7 ? unlock(0) : setNotice("Static only. Try the repeating carrier.")}>LOCK SIGNAL</button>
              </div>
            )}

            {active === 1 && (
              <div className="manifest-game">
                <div className="clue-row">
                  <div><span>VESSEL</span><b>BERTH 7</b></div>
                  <div><span>PALLET</span><b>ROW 4</b></div>
                  <div><span>GATE</span><b>CAM 2</b></div>
                </div>
                <p className="game-clue">The clerk writes access codes in <b>arrival order.</b> Enter the three-digit yard code.</p>
                <div className="code-display">{manifest.padEnd(3, "—").split("").join(" ")}</div>
                <div className="keypad">
                  {[1,2,3,4,5,6,7,8,9].map((n) => <button key={n} onClick={() => manifest.length < 3 && setManifest(`${manifest}${n}`)}>{n}</button>)}
                  <button onClick={() => setManifest("")}>CLR</button><button onClick={() => manifest.length < 3 && setManifest(`${manifest}0`)}>0</button><button onClick={() => setManifest(manifest.slice(0, -1))}>⌫</button>
                </div>
                <button className="primary-action" disabled={manifest.length !== 3} onClick={() => manifest === "742" ? unlock(1) : setManifest("")}>DECODE MANIFEST</button>
              </div>
            )}

            {active === 2 && (
              <div className="route-game">
                <blockquote>“South past the scrapyard. Stay under the bridge cameras. Cold storage by the water. Blue cranes. East gate.”</blockquote>
                <p className="game-clue">Cross-reference the route chatter. Where is the container headed?</p>
                <div className="choice-grid routes">
                  {["LSIA Freight Depot", "Terminal / Pier 400", "Del Perro Pier"].map((value) => (
                    <button key={value} className={route === value ? "selected" : ""} onClick={() => setRoute(value)}>{value}<small>{value.includes("Terminal") ? "Industrial port" : value.includes("LSIA") ? "Airport cargo" : "Tourist district"}</small></button>
                  ))}
                </div>
                <button className="primary-action" disabled={!route} onClick={() => route === "Terminal / Pier 400" ? unlock(2) : setNotice("Route prediction failed. Re-read the driver chatter.")}>COMMIT INTERCEPT</button>
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
