/*
 * The card is a view, but the decision it makes -- is this aircraft in my sky,
 * can I hear it -- is arithmetic, and arithmetic that fails silently: get the
 * curvature term wrong and the card simply shows you the wrong aeroplanes,
 * confidently. These tests pin the numbers against cases anyone living near
 * an airport can check by walking outside.
 */

import test from "node:test";
import assert from "node:assert/strict";

// The module registers custom elements when it loads. Stub just enough of the
// browser for it to get through that; nothing here touches the DOM otherwise.
globalThis.HTMLElement = class {
  attachShadow() {
    return { innerHTML: "", appendChild() {}, querySelector: () => null };
  }
};
globalThis.customElements = { define() {} };
globalThis.window = globalThis;

const model = await import("../skywatch-card.js");
const {
  DEFAULTS,
  haversine,
  bearingTo,
  project,
  skyGeometry,
  estimateLoudness,
  classifyAircraft,
  horizonAt,
  evaluateFlight,
  extractFlights,
  compassName,
  translator,
  formatAltitude,
  escapeHtml,
} = model;

/* A house between Hoofddorp and Amsterdam, and the middle of Schiphol. */
const HOME = { lat: 52.3, lon: 4.68, elevation: 0 };
const SCHIPHOL = { lat: 52.3105, lon: 4.7683 };

function context(overrides) {
  return {
    config: { ...DEFAULTS, ...(overrides || {}) },
    home: HOME,
    env: { overcast: false, cloudBase: Infinity, night: false },
    age: 0,
  };
}

/* ------------------------------------------------------------- distances */

test("haversine matches a known separation", () => {
  // Amsterdam to Paris is about 430 km.
  const metres = haversine(52.3676, 4.9041, 48.8566, 2.3522);
  assert.ok(Math.abs(metres / 1000 - 430) < 5, `${metres / 1000} km`);
});

test("bearing points the right way", () => {
  assert.ok(Math.abs(bearingTo(52, 5, 53, 5) - 0) < 0.5);
  assert.ok(Math.abs(bearingTo(52, 5, 52, 6) - 90) < 0.5);
  assert.ok(Math.abs(bearingTo(52, 5, 51, 5) - 180) < 0.5);
  assert.ok(Math.abs(bearingTo(52, 5, 52, 4) - 270) < 0.5);
});

test("dead reckoning moves the right distance in the right direction", () => {
  const moved = project(52, 5, 90, 10000);
  assert.ok(Math.abs(haversine(52, 5, moved[0], moved[1]) - 10000) < 5);
  assert.ok(Math.abs(bearingTo(52, 5, moved[0], moved[1]) - 90) < 0.5);
});

/* -------------------------------------------------------------- geometry */

test("curvature drops a distant target by the surveyor's amount", () => {
  // d^2 / 2R with the refraction-corrected radius: 174 m at 50 km.
  const geo = skyGeometry(50000, 0);
  assert.ok(Math.abs(geo.drop - 174) < 3, `drop ${geo.drop}`);
  assert.ok(geo.elevation < 0, "a target at ground level 50 km away is below the horizon");
});

test("elevation angle, not distance, is what puts something in your sky", () => {
  // Taxiing at the airport, six kilometres away: technically close, visually
  // behind the first row of houses.
  const low = skyGeometry(6000, 150);
  assert.ok(low.elevation < 2, `${low.elevation}°`);

  // Cruising, six times further away: a third of the way up the sky.
  const high = skyGeometry(35000, 11000);
  assert.ok(high.elevation > 15 && high.elevation < 20, `${high.elevation}°`);

  // Straight overhead.
  assert.ok(skyGeometry(200, 11000).elevation > 88);
});

test("slant range exceeds ground distance for anything up high", () => {
  const geo = skyGeometry(10000, 10000);
  assert.ok(Math.abs(geo.slant - Math.SQRT2 * 10000) < 1);
});

/* ------------------------------------------------------------- acoustics */

test("cruise traffic overhead is not audible, a departure is", () => {
  const cruise = estimateLoudness(11000, 11000, "heavy", false, 89);
  assert.ok(cruise < DEFAULTS.noise_threshold, `${cruise} dBA`);

  const departure = estimateLoudness(3400, 1500, "heavy", false, 26);
  assert.ok(departure > 60, `${departure} dBA`);
});

test("a helicopter is heard far beyond where it can be seen", () => {
  const heli = estimateLoudness(8000, 400, "helicopter", false, 3);
  assert.ok(heli > DEFAULTS.noise_threshold, `${heli} dBA`);
});

test("loudness falls off with range", () => {
  const near = estimateLoudness(2000, 1000, "medium", false, 30);
  const far = estimateLoudness(20000, 1000, "medium", false, 3);
  assert.ok(near - far > 20);
});

/* -------------------------------------------------------- classification */

test("aircraft types land in the right size class", () => {
  const cases = {
    B738: "medium",
    A320: "medium",
    A321: "medium",
    A310: "heavy",
    A333: "heavy",
    B77W: "heavy",
    A388: "heavy",
    E190: "medium",
    C172: "light",
    EC35: "helicopter",
    R44: "helicopter",
  };
  for (const code of Object.keys(cases)) {
    assert.equal(classifyAircraft({ aircraft_code: code }), cases[code], code);
  }
  assert.equal(classifyAircraft({ aircraft_category: "HELICOPTER" }), "helicopter");
  assert.equal(classifyAircraft({}), "unknown");
});

/* ------------------------------------------------------ horizon profiles */

test("a plain number is the horizon in every direction", () => {
  assert.equal(horizonAt(12, 0), 12);
  assert.equal(horizonAt(12, 217), 12);
});

test("a horizon given per compass point interpolates between them", () => {
  const profile = { N: 20, S: 4 };
  assert.equal(horizonAt(profile, 0), 20);
  assert.equal(horizonAt(profile, 180), 4);
  assert.ok(Math.abs(horizonAt(profile, 90) - 12) < 0.01, "halfway round is halfway between");
  assert.ok(Math.abs(horizonAt(profile, 270) - 12) < 0.01);
});

test("trees in one direction only hide aircraft in that direction", () => {
  const raw = {
    latitude: 52.4,
    longitude: 4.68,
    altitude: 12000, // feet, roughly 3.6 km up
    heading: 180,
    ground_speed: 300,
  };
  const northOfHouse = evaluateFlight(raw, context({ min_elevation: { N: 45, S: 5 } }));
  const southOfHouse = evaluateFlight(
    { ...raw, latitude: 52.2 },
    context({ min_elevation: { N: 45, S: 5 } }),
  );
  assert.equal(northOfHouse.visible, false, "hidden behind the tall side");
  assert.equal(southOfHouse.visible, true, "in the open over the low side");
});

/* --------------------------------------------------- the whole judgement */

test("a departure off Schiphol is heard but not seen", () => {
  const flight = evaluateFlight(
    {
      id: "abc",
      callsign: "KLM1234",
      aircraft_code: "B738",
      latitude: SCHIPHOL.lat,
      longitude: SCHIPHOL.lon,
      altitude: 600, // feet
      heading: 240,
      ground_speed: 180,
      vertical_speed: 2200,
    },
    context(),
  );

  assert.ok(flight.elevation < 3, `elevation ${flight.elevation}`);
  assert.equal(flight.visible, false);
  assert.equal(flight.audible, true);
  assert.equal(flight.verdict, "verdict_audible");
});

test("the same aircraft high above is seen but not heard", () => {
  const flight = evaluateFlight(
    {
      id: "def",
      callsign: "KLM890",
      aircraft_code: "A333",
      latitude: 52.55,
      longitude: 4.68,
      altitude: 36000, // feet, about 11 km
      heading: 180,
      ground_speed: 450,
      vertical_speed: 0,
    },
    context(),
  );

  assert.ok(flight.elevation > 15, `elevation ${flight.elevation}`);
  assert.equal(flight.visible, true);
  assert.equal(flight.audible, false);
  assert.equal(flight.verdict, "verdict_visible");
  assert.ok(Math.abs(flight.bearing) < 1, "due north of the house");
});

test("aircraft on the ground are dropped unless asked for", () => {
  const raw = {
    latitude: SCHIPHOL.lat,
    longitude: SCHIPHOL.lon,
    altitude: 0,
    on_ground: true,
    aircraft_code: "B738",
  };
  assert.equal(evaluateFlight(raw, context()).visible, false);
  assert.equal(evaluateFlight(raw, context()).verdict, "verdict_ground");
});

test("a solid overcast hides everything above the cloud base", () => {
  const raw = {
    latitude: 52.45,
    longitude: 4.68,
    altitude: 30000,
    aircraft_code: "A333",
    heading: 180,
    ground_speed: 440,
  };
  const clear = evaluateFlight(raw, context());
  assert.equal(clear.visible, true);

  const ctx = context();
  ctx.env = { overcast: true, cloudBase: 1200, night: false };
  const grey = evaluateFlight(raw, ctx);
  assert.equal(grey.visible, false);
  assert.equal(grey.verdict, "verdict_cloud");
});

test("sound lag is the slant range divided by the speed of sound", () => {
  const flight = evaluateFlight(
    {
      latitude: 52.34,
      longitude: 4.68,
      altitude: 3000,
      aircraft_code: "B738",
      heading: 90,
      ground_speed: 250,
    },
    context(),
  );
  assert.ok(Math.abs(flight.soundDelay - flight.slantM / 343) < 0.01);
  assert.ok(flight.soundDelay > 10, "several seconds of lag at this range");
});

test("what you hear now came from behind where the aircraft is", () => {
  const flight = evaluateFlight(
    {
      latitude: 52.33,
      longitude: 4.68,
      altitude: 2000,
      aircraft_code: "B738",
      heading: 0, // flying north, away from the house
      ground_speed: 300,
    },
    context(),
  );
  assert.ok(flight.audible, "close and low enough to hear");
  assert.ok(flight.ghost, "an emission point was worked out");
  // Flying north away from us, so the sound came from lower in the sky.
  assert.ok(flight.ghost.elevation > flight.elevation);
});

test("extrapolation moves an aircraft along its heading between polls", () => {
  const raw = {
    latitude: 52.4,
    longitude: 4.68,
    altitude: 20000,
    aircraft_code: "B738",
    heading: 180,
    ground_speed: 400, // knots, about 206 m/s
  };
  const fresh = evaluateFlight(raw, { ...context(), age: 0 });
  const stale = evaluateFlight(raw, { ...context(), age: 30 });
  // Thirty seconds southbound is six kilometres closer to a house to the south.
  assert.ok(fresh.groundM - stale.groundM > 5000, `${fresh.groundM - stale.groundM} m`);
});

test("a flight without a position is skipped rather than guessed at", () => {
  assert.equal(evaluateFlight({ callsign: "NOPOS" }, context()), null);
});

/* ---------------------------------------------------------- housekeeping */

test("flights are read from the integration's attribute", () => {
  const flights = [{ latitude: 1, longitude: 2 }];
  assert.deepEqual(extractFlights({ attributes: { flights } }), flights);
  assert.deepEqual(extractFlights({ attributes: { other: flights } }), flights);
  assert.deepEqual(extractFlights({ attributes: {} }), []);
  assert.deepEqual(extractFlights(undefined), []);
});

test("compass names come out in the configured language", () => {
  assert.equal(compassName(225, translator("en")), "SW");
  assert.equal(compassName(225, translator("nl")), "ZW");
  assert.equal(compassName(0, translator("nl")), "N");
  assert.equal(compassName(90, translator("nl")), "O");
});

test("altitude is rounded to something worth reading", () => {
  assert.equal(formatAltitude(11278, "m"), "11280 m");
  assert.equal(formatAltitude(11278, "ft"), "37000 ft");
});

test("feed text is escaped before it reaches markup", () => {
  assert.equal(escapeHtml('<img src=x onerror="a">'), "&lt;img src=x onerror=&quot;a&quot;&gt;");
});
