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

const { DEFAULTS, extractFlights, evaluateFlight } = await import(
  "../custom_components/skywatch/frontend/skywatch-card.js"
);

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
  assert.equal(flight.model, "Boeing 737-8K2");
  assert.equal(flight.code, "B738");
  assert.equal(flight.photo, "https://img.example/medium.jpg");
  assert.equal(flight.origin.iata, "AMS");
  assert.equal(flight.origin.city, "Amsterdam");
  assert.equal(flight.destination.iata, "BCN");
  assert.equal(flight.destination.city, "Barcelona");
  assert.equal(flight.onGround, false);
  assert.equal(flight.heading, 184);
  assert.equal(flight.hasHeading, true);
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
