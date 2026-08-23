/*
 * The seam between the integration and the card.
 *
 * The sensor publishes a `flights` attribute and the card reads it by field
 * name. Nothing in between validates that: a field renamed on one side simply
 * empties a line in the popup, or worse, silently reads as zero. Both sides
 * are pinned against test/fixtures/sensor.json -- the Python tests assert the
 * client still produces it, these assert the card still understands it.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

globalThis.HTMLElement = class {
  attachShadow() {
    this.shadowRoot = { innerHTML: "", appendChild() {}, querySelector: () => null };
    return this.shadowRoot;
  }
};
// Deliberately no `document`. Building the card is the first thing that
// reaches for one, so anything that builds throws here -- which is exactly the
// shape of the failure the card has to survive without calling it a
// configuration error.
// Keep what the card registers: setConfig is the other half of the seam, and
// the class itself is not exported.
const defined = {};
globalThis.customElements = {
  define(name, cls) {
    defined[name] = cls;
  },
  get: () => undefined,
};
globalThis.window = globalThis;

const {
  DEFAULTS,
  extractFlights,
  evaluateFlight,
  placeName,
  airportCity,
  AIRPORT_CITIES,
} = await import("../custom_components/skywatch/frontend/skywatch-card.js");

const sensor = JSON.parse(
  readFileSync(new URL("./fixtures/sensor.json", import.meta.url), "utf8"),
);

const home = {
  lat: sensor.attributes.station_latitude,
  lon: sensor.attributes.station_longitude,
  elevation: 0,
};

// No extrapolation: the fixture has no age, and dead reckoning would move the
// aircraft out from under the numbers asserted below.
const ctx = {
  config: { ...DEFAULTS, extrapolate: false },
  home,
  age: 0,
  env: { overcast: false, cloudBase: 1500, dark: false },
};

test("the card finds the list the sensor publishes", () => {
  const flights = extractFlights({ attributes: sensor.attributes });
  assert.equal(flights.length, sensor.state);
});

test("every field the integration sends arrives somewhere the card uses", () => {
  const [raw] = extractFlights({ attributes: sensor.attributes });
  const flight = evaluateFlight(raw, ctx);

  assert.equal(flight.key, "2f8a1c9");
  assert.equal(flight.callsign, "KLM1673");
  assert.equal(flight.flightNumber, "KL1673");
  assert.equal(flight.registration, "PH-BXA");
  assert.equal(flight.airline, "KLM");
  assert.equal(flight.airlineName, "KLM Royal Dutch Airlines");
  assert.equal(flight.model, "Boeing 737-8K2");
  assert.equal(flight.code, "B738");
  assert.equal(flight.photo, "https://img.example/medium.jpg");
  assert.equal(flight.origin.iata, "AMS");
  assert.equal(flight.origin.city, "Amsterdam");
  assert.equal(flight.origin.name, "Amsterdam Schiphol Airport");
  assert.equal(flight.destination.iata, "BCN");
  assert.equal(flight.destination.city, "Barcelona");
  assert.equal(flight.destination.name, "Barcelona El Prat Airport");
  assert.equal(flight.onGround, false);
  assert.equal(flight.heading, 184);
  assert.equal(flight.hasHeading, true);
});

/*
 * The popup writes the airports out, and the two fields it writes them from
 * are independently optional -- a detail lookup that has not come back yet
 * has neither, and the feed names some airports without their city.
 */
test("an airport is written out from whichever of the two fields arrived", () => {
  assert.equal(
    placeName({ name: "Amsterdam Schiphol Airport", city: "Amsterdam" }),
    "Amsterdam Schiphol Airport",
    "no city repeated in front of a name that already says it",
  );
  assert.equal(
    placeName({ name: "Heathrow Airport", city: "London" }),
    "London Heathrow Airport",
  );
  assert.equal(placeName({ name: "", city: "Faro" }), "Faro", "no name yet");
  assert.equal(placeName({ name: "Kastrup", city: "" }), "Kastrup", "no city");
  assert.equal(placeName({ name: "", city: "" }), "", "no detail at all");
  assert.equal(placeName({}), "", "neither field present");

  // With neither field the code itself is the last resort, which is the
  // ordinary case rather than the odd one: the detail lookup is a second
  // request per flight, capped per cycle, and the first thing to be refused.
  assert.equal(
    placeName({ name: "", city: "", iata: "NUE" }),
    "Nuremberg",
    "the code resolved when the feed sent no airport at all",
  );
  assert.equal(
    placeName({ name: "", city: "Nurnberg", iata: "NUE" }),
    "Nurnberg",
    "a city from the feed is never overruled by the table",
  );
  assert.equal(
    placeName({ name: "Albrecht Durer Airport", city: "", iata: "NUE" }),
    "Albrecht Durer Airport",
    "a name from the feed is never overruled by the table",
  );
  assert.equal(
    placeName({ name: "", city: "", iata: "ZZZ" }),
    "",
    "a code the table does not have leaves the line empty, as before",
  );

  // The card reads any sensor publishing `flights`, including the other
  // Flightradar24 integration and hand-written template sensors, so neither
  // field is guaranteed to be a string. `toLowerCase` on a number would take
  // the whole card down from inside the popup.
  assert.equal(placeName({ name: 4, city: "Amsterdam" }), "Amsterdam 4");
  assert.equal(placeName({ name: "Kastrup", city: 7 }), "7 Kastrup");
});

/*
 * The airport table is written by hand as runs of "XXX City" joined on "|",
 * and a missing separator or a two-letter code silently swallows its
 * neighbour -- "AM SAmsterdam" is not a parse error, it is a wrong answer in
 * the popup. Nothing else in the file would notice, so it is checked here.
 */
test("every row of the airport table is a code and a city", () => {
  assert.equal(airportCity("AMS"), "Amsterdam");
  assert.equal(airportCity("ams"), "Amsterdam", "case does not matter");
  assert.equal(airportCity("NUE"), "Nuremberg");
  assert.equal(airportCity("JFK"), "New York", "a city of more than one word");

  // Nothing to look up is not an error; the popup keeps the code on its own.
  assert.equal(airportCity(""), "");
  assert.equal(airportCity(undefined), "");
  assert.equal(airportCity(null), "");
  assert.equal(airportCity("ZZZ"), "");
  assert.equal(airportCity(7), "", "a feed that sent a number, not a code");

  // A row that lost its "|" does not fail to parse -- "AMS Amsterdam RTM
  // Rotterdam" is a valid-looking entry that stores one wrong city and loses
  // the other. Every entry is checked rather than sampled, because the ones
  // worth having in the table are exactly the ones nobody would think to
  // spot-check.
  const codes = Object.keys(AIRPORT_CITIES);
  assert.ok(codes.length > 500, `only ${codes.length} airports in the table`);
  for (const code of codes) {
    assert.ok(/^[A-Z]{3}$/.test(code), `${code} is not an IATA code`);
    const city = AIRPORT_CITIES[code];
    assert.ok(city.length > 1, `${code} has no city`);
    assert.equal(city, city.trim(), `${code} is padded: "${city}"`);
    assert.ok(
      !/ [A-Z]{3} /.test(` ${city} `),
      `${code} swallowed the next entry: "${city}"`,
    );
    // The line sits under a three-letter code in a column half the popup
    // wide. A city that long is a run-together, not a place.
    assert.ok(city.length <= 24, `${code} is too long for the line: "${city}"`);
  }
});

test("the units the integration sends are the units the card assumes", () => {
  const [raw] = extractFlights({ attributes: sensor.attributes });
  const flight = evaluateFlight(raw, ctx);

  // 3200 ft, and the card works in metres.
  assert.ok(Math.abs(flight.altitudeM - 975.4) < 1, `altitude ${flight.altitudeM}`);
  // 212 knots is 109 m/s; anything reading it as km/h lands near 59.
  assert.ok(Math.abs(flight.groundSpeed - 109.1) < 1, `speed ${flight.groundSpeed}`);
  // -1088 feet per minute is -5.5 m/s of descent.
  assert.ok(Math.abs(flight.verticalMs + 5.53) < 0.1, `vertical ${flight.verticalMs}`);
});

test("the fixture aircraft is one you would actually see", () => {
  const [raw] = extractFlights({ attributes: sensor.attributes });
  const flight = evaluateFlight(raw, ctx);

  // Five kilometres out at a thousand metres: high in the sky and loud.
  assert.ok(flight.elevation > 10, `elevation ${flight.elevation}`);
  assert.equal(flight.visible, true);
  assert.equal(flight.audible, true);
  assert.equal(flight.aircraftClass, "medium");

  // The distance the client computed and the one the card computes are the
  // same distance.
  assert.ok(
    Math.abs(flight.groundM / 1000 - raw.distance) < 0.05,
    `${flight.groundM / 1000} vs ${raw.distance}`,
  );
});

/*
 * Anything setConfig throws is shown by Home Assistant as a configuration
 * error in place of the card, which is both alarming and misleading when the
 * configuration is merely untidy. A single sensor written without a list is
 * the one people write by hand, and it used to be a TypeError.
 */
test("the card accepts every shape an entity list gets written in", () => {
  const card = new defined["skywatch-card"]();
  const entitiesFor = (entities) => {
    card.setConfig({ type: "custom:skywatch-card", entities });
    return card._config.entities;
  };

  assert.deepEqual(entitiesFor(["sensor.a", "sensor.b"]), ["sensor.a", "sensor.b"]);
  assert.deepEqual(entitiesFor("sensor.a"), ["sensor.a"], "a bare entity id");
  assert.deepEqual(entitiesFor({ entity: "sensor.a" }), ["sensor.a"], "a bare row");
  assert.deepEqual(entitiesFor([{ entity_id: "sensor.a" }]), ["sensor.a"]);
  assert.deepEqual(entitiesFor(null), [], "cleared by the editor");
  assert.deepEqual(entitiesFor([null, "", "sensor.a"]), ["sensor.a"], "holes");
  assert.deepEqual(entitiesFor(undefined), [], "never set: every sensor is used");
});

/*
 * The one that matters, and the one the first attempt at this missed.
 *
 * Home Assistant sets the config before it sets `hass`, so `setConfig` runs
 * with no state and never builds anything -- the try/catch it carries is not
 * on the path a real card takes. The build happens on the first `hass`
 * assignment, and Home Assistant wraps that: anything escaping it swaps the
 * card for the grey "Configuration error" tile, which has no `hass` property
 * of its own, so the dashboard stays broken until the page is reloaded.
 *
 * There is no `document` in this file, so building throws. That stands in for
 * every real reason it might -- a feed row shaped wrongly, a browser missing
 * something the code assumed -- none of which is a configuration problem.
 */
test("a card that cannot render is not a configuration error", () => {
  const card = new defined["skywatch-card"]();
  card.setConfig({ type: "custom:skywatch-card", entities: ["sensor.a"] });

  const hass = { states: {}, config: { latitude: 52.3, longitude: 4.7 }, language: "en" };
  assert.doesNotThrow(() => {
    card.hass = hass;
  }, "the first state update, which is where the card is really built");
  assert.doesNotThrow(() => {
    card.hass = hass;
  }, "and every one after it");

  // Left unbuilt on purpose, so the next update starts over rather than
  // drawing into half a card.
  assert.equal(card._built, false);
  // The state is kept even though the render failed: a failed frame must not
  // also cost the card the newest thing it was given.
  assert.equal(card._hass, hass);

  // And it says so. An empty shadow root looks exactly like Home Assistant's
  // own grey tile on a normal view -- the frontend writes the message under
  // that one only in preview -- so a card that fails silently gets reported
  // as a configuration error, which is the one thing it is not.
  const html = card.shadowRoot.innerHTML;
  assert.match(html, /Skywatch could not draw this card/);
  assert.match(html, /not a configuration error/);
  // The version is in there because it is the first question asked of any
  // report, and the reporter is holding a phone with no console.
  assert.match(html, /v\d+\.\d+\.\d+/);
  // The thrown message itself, which is the part that says what to fix.
  assert.match(html, /document is not defined/);
});

/*
 * Tearing the previous card down is not the configuration's fault, and
 * `setConfig` runs again on every dashboard save and every config pushed from
 * another browser -- so a throw from the teardown would turn an ordinary save
 * into the grey tile, permanently, on a card whose YAML never changed.
 */
test("a card that cannot be torn down is not a configuration error either", () => {
  const card = new defined["skywatch-card"]();
  card.setConfig({ type: "custom:skywatch-card", entities: ["sensor.a"] });

  card._map = {
    destroy() {
      throw new Error("ResizeObserver went away");
    },
  };

  assert.doesNotThrow(() => {
    card.setConfig({ type: "custom:skywatch-card", entities: ["sensor.b"] });
  }, "the save that re-pushes the config");
  // Dropped before it was asked to go, so a second save does not find the
  // same broken map still attached and throw all over again.
  assert.equal(card._map, null);
});

/*
 * `flights` is a list from an upstream feed by way of an attribute this repo
 * does not always own. A hole in it is a row that is not there, not a reason
 * to take the card down -- and reaching `raw.latitude` through a null does
 * exactly that, from inside the `hass` setter.
 */
test("a hole in the flight list is skipped, not fatal", () => {
  const [good] = extractFlights({ attributes: sensor.attributes });

  for (const hole of [null, undefined, "PH-BXA", 42, true]) {
    assert.equal(evaluateFlight(hole, ctx), null, `${JSON.stringify(hole)} is not a flight`);
  }
  assert.ok(evaluateFlight(good, ctx), "and a real row still evaluates");
});
