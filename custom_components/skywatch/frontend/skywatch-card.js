/*
 * Skywatch -- a Lovelace card for the Flightradar24 integration
 * https://github.com/AlexandrErohin/home-assistant-flightradar24
 *
 * Radius is the wrong question. A 737 sitting on a Schiphol taxiway two
 * kilometres away is invisible behind the first row of houses, while the same
 * aircraft at eleven kilometres up and forty away is a clear white cross in
 * the sky. This card throws away the radius filter and asks the two questions
 * you actually care about when you step into the garden: can I see it, and
 * can I hear it.
 *
 * It answers them with geometry (elevation angle above your horizon, slant
 * range, earth curvature and refraction) and a sound propagation estimate,
 * then puts only what survives on the map, with the direction and the angle
 * to look up at written out next to it.
 *
 * No build step, no dependencies -- drop the file in /config/www/ and add it
 * as a module resource.
 */

const CARD_VERSION = "1.2.0";

/* ------------------------------------------------------------------ icons */

const ICONS = {
  eye: "M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17M12,4.5C7,4.5 2.73,7.61 1,12C2.73,16.39 7,19.5 12,19.5C17,19.5 21.27,16.39 23,12C21.27,7.61 17,4.5 12,4.5Z",
  sound:
    "M14,3.23V5.29C16.89,6.15 19,8.83 19,12C19,15.17 16.89,17.84 14,18.7V20.77C18,19.86 21,16.28 21,12C21,7.72 18,4.14 14,3.23M16.5,12C16.5,10.23 15.5,8.71 14,7.97V16C15.5,15.29 16.5,13.76 16.5,12M3,9V15H7L12,20V4L7,9H3Z",
  arrow: "M12,2L4.5,20.29L5.21,21L12,18L18.79,21L19.5,20.29L12,2Z",
  close:
    "M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z",
  up: "M13,20H11V8L5.5,13.5L4.08,12.08L12,4.16L19.92,12.08L18.5,13.5L13,8V20Z",
  down: "M11,4H13V16L18.5,10.5L19.92,11.92L12,19.84L4.08,11.92L5.5,10.5L11,16V4Z",
  plane:
    "M21,16V14L13,9V3.5A1.5,1.5 0 0,0 11.5,2A1.5,1.5 0 0,0 10,3.5V9L2,14V16L10,13.5V19L8,20.5V22L11.5,21L15,22V20.5L13,19V13.5L21,16Z",
  sun: "M12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,2L14.39,5.42C13.65,5.15 12.84,5 12,5C11.16,5 10.35,5.15 9.61,5.42L12,2M3.34,7L7.5,6.65C6.9,7.16 6.36,7.78 5.94,8.5C5.5,9.24 5.25,10 5.11,10.79L3.34,7M3.36,17L5.12,13.23C5.26,14 5.53,14.78 5.95,15.5C6.37,16.24 6.91,16.86 7.5,17.37L3.36,17M20.65,7L18.88,10.79C18.74,10 18.47,9.23 18.05,8.5C17.63,7.78 17.1,7.15 16.5,6.64L20.65,7M20.64,17L16.5,17.36C17.09,16.85 17.62,16.22 18.04,15.5C18.46,14.77 18.73,14 18.87,13.21L20.64,17M12,22L9.59,18.56C10.33,18.83 11.14,19 12,19C12.82,19 13.63,18.83 14.37,18.56L12,22Z",
  moon: "M17.75,4.09L15.22,6.03L16.13,9.09L13.5,7.28L10.87,9.09L11.78,6.03L9.25,4.09L12.44,4L13.5,1L14.56,4L17.75,4.09M21.25,11L19.61,12.25L20.2,14.23L18.5,13.06L16.8,14.23L17.39,12.25L15.75,11L17.81,10.95L18.5,9L19.19,10.95L21.25,11M18.97,15.95C19.8,15.87 20.69,17.05 20.16,17.8C19.84,18.25 19.5,18.67 19.08,19.07C15.17,23 8.84,23 4.94,19.07C1.03,15.17 1.03,8.83 4.94,4.93C5.34,4.53 5.76,4.17 6.21,3.85C6.96,3.32 8.14,4.21 8.06,5.04C7.79,7.9 8.75,10.87 10.95,13.06C13.14,15.26 16.1,16.22 18.97,15.95Z",
  cloud:
    "M6,19A5,5 0 0,1 1,14A5,5 0 0,1 6,9C7,6.65 9.3,5 12,5C15.43,5 18.24,7.66 18.5,11.03L19,11A4,4 0 0,1 23,15A4,4 0 0,1 19,19H6M19,13H17V12A5,5 0 0,0 12,7C9.5,7 7.45,8.82 7.06,11.19C6.73,11.07 6.37,11 6,11A3,3 0 0,0 3,14A3,3 0 0,0 6,17H19A2,2 0 0,0 21,15A2,2 0 0,0 19,13Z",
};

/* -------------------------------------------------------------- constants */

// Mean earth radius, and the refraction coefficient that standard atmosphere
// surveying uses: light bends downwards slightly, which is equivalent to a
// larger, flatter earth.
const EARTH_RADIUS_M = 6371008.8;
const REFRACTION_K = 1.13;
const EFFECTIVE_RADIUS_M = EARTH_RADIUS_M * REFRACTION_K;

const SPEED_OF_SOUND_MS = 343;

const FEET_TO_M = 0.3048;
const KNOTS_TO_MS = 0.514444;
const KMH_TO_MS = 1 / 3.6;
const MPH_TO_MS = 0.44704;

// Sound pressure level in dBA at 300 m slant range, per aircraft class, at a
// typical thrust setting. Numbers are the usual noise-certification ballpark,
// not a promise about your specific 320neo.
const SOURCE_DBA = {
  heavy: 96,
  medium: 92,
  light: 80,
  helicopter: 88,
  unknown: 90,
};

// Wingspan (or rotor diameter) in metres, used for the apparent-size estimate
// that decides how easy something is to actually pick out.
const SPAN_M = {
  heavy: 60,
  medium: 34,
  light: 12,
  helicopter: 13,
  unknown: 34,
};

// Atmospheric absorption on top of spherical spreading. Aircraft noise at
// distance is dominated by the low mid frequencies, where a couple of dB per
// kilometre is the right order of magnitude.
const AIR_ABSORPTION_DB_PER_KM = 2.0;

const COMPASS_16 = [
  "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
  "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
];

/* ------------------------------------------------------------------ i18n */

const STRINGS = {
  en: {
    compass: ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"],
    cardinals: ["N", "E", "S", "W"],
    in_sight: "in sight",
    one_in_sight: "in sight",
    nothing: "Nothing to see",
    nothing_sub: "No aircraft above your horizon",
    audible: "audible",
    visible: "visible",
    overhead: "overhead",
    look: "Look",
    above_horizon: "above the horizon",
    straight_up: "straight up",
    altitude: "Altitude",
    distance: "Distance",
    slant: "Slant range",
    speed: "Speed",
    heading: "Heading",
    climb: "Climb",
    descend: "Descent",
    level: "Level",
    loudness: "Loudness",
    sound_delay: "sound lags {n}",
    route: "Route",
    unknown: "Unknown",
    verdict_visible: "Visible",
    verdict_audible: "Audible, not visible",
    verdict_low: "Below your horizon",
    verdict_far: "Too far to make out",
    verdict_ground: "On the ground",
    verdict_cloud: "Behind cloud",
    verdict_none: "Out of sight and earshot",
    reason_low: "only {n}° up",
    reason_far: "{n} away",
    title: "Above your house",
    close: "Close",
    tap_hint: "Tap an aircraft for details",
    night: "Night -- lights only",
    day: "Day",
    cloudy: "Overcast at {n}",
    no_flights_source: "No Flightradar24 sensor with flight data",
    faint: "faint",
    clear: "clear",
    loud: "loud",
  },
  nl: {
    compass: ["N", "NNO", "NO", "ONO", "O", "OZO", "ZO", "ZZO", "Z", "ZZW", "ZW", "WZW", "W", "WNW", "NW", "NNW"],
    cardinals: ["N", "O", "Z", "W"],
    in_sight: "in zicht",
    one_in_sight: "in zicht",
    nothing: "Niets te zien",
    nothing_sub: "Geen vliegtuigen boven je horizon",
    audible: "hoorbaar",
    visible: "zichtbaar",
    overhead: "recht boven je",
    look: "Kijk",
    above_horizon: "boven de horizon",
    straight_up: "recht omhoog",
    altitude: "Hoogte",
    distance: "Afstand",
    slant: "Hemelsbreed",
    speed: "Snelheid",
    heading: "Koers",
    climb: "Stijgt",
    descend: "Daalt",
    level: "Vlak",
    loudness: "Geluid",
    sound_delay: "geluid loopt {n} achter",
    route: "Route",
    unknown: "Onbekend",
    verdict_visible: "Zichtbaar",
    verdict_audible: "Hoorbaar, niet zichtbaar",
    verdict_low: "Onder je horizon",
    verdict_far: "Te ver om te zien",
    verdict_ground: "Aan de grond",
    verdict_cloud: "Achter de bewolking",
    verdict_none: "Buiten zicht en gehoor",
    reason_low: "maar {n}° hoog",
    reason_far: "{n} ver",
    title: "Boven je huis",
    close: "Sluiten",
    tap_hint: "Tik een vliegtuig aan voor details",
    night: "Nacht -- alleen lichten",
    day: "Dag",
    cloudy: "Bewolkt op {n}",
    no_flights_source: "Geen Flightradar24-sensor met vluchtgegevens",
    faint: "zwak",
    clear: "duidelijk",
    loud: "luid",
  },
};

function pickLanguage(configured, hass) {
  let lang = configured;
  if (!lang || lang === "auto") {
    lang = (hass && (hass.language || (hass.locale && hass.locale.language))) || "en";
  }
  const base = String(lang).toLowerCase().split("-")[0];
  return STRINGS[base] ? base : "en";
}

function translator(lang) {
  const table = STRINGS[lang] || STRINGS.en;
  return function (key, vars) {
    let text = table[key];
    if (text === undefined) text = STRINGS.en[key];
    if (text === undefined) return key;
    if (!vars) return text;
    for (const name of Object.keys(vars)) {
      text = text.split(`{${name}}`).join(vars[name]);
    }
    return text;
  };
}

/* --------------------------------------------------------------- helpers */

function fireEvent(node, type, detail = {}) {
  const event = new Event(type, {
    bubbles: true,
    cancelable: false,
    composed: true,
  });
  event.detail = detail;
  node.dispatchEvent(event);
  return event;
}

/* Callsigns, aircraft models and city names come from an upstream feed and
 * end up inside markup, so they get escaped rather than trusted. */
function escapeHtml(value) {
  return String(value === null || value === undefined ? "" : value)
    .split("&").join("&amp;")
    .split("<").join("&lt;")
    .split(">").join("&gt;")
    .split('"').join("&quot;")
    .split("'").join("&#39;");
}

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

function toDeg(rad) {
  return (rad * 180) / Math.PI;
}

function clamp(value, low, high) {
  return Math.min(high, Math.max(low, value));
}

function num(value) {
  const parsed = typeof value === "number" ? value : parseFloat(value);
  return isFinite(parsed) ? parsed : null;
}

/* Spelled out rather than using `?.`: the card ships unbundled and has to
 * parse on the older Android WebViews that Home Assistant companion apps
 * still run on, where optional chaining is a syntax error. */
function attrsOf(stateObj) {
  return (stateObj && stateObj.attributes) || {};
}

/* --------------------------------------------------------------- geometry */

/* Great-circle distance in metres. */
function haversine(lat1, lon1, lat2, lon2) {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* Initial bearing from the observer to the aircraft, 0 = north, clockwise. */
function bearingTo(lat1, lon1, lat2, lon2) {
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/* Move a point `metres` along `heading`, for dead reckoning between updates. */
function project(lat, lon, headingDeg, metres) {
  const delta = metres / EARTH_RADIUS_M;
  const theta = toRad(headingDeg);
  const phi1 = toRad(lat);
  const lambda1 = toRad(lon);
  const phi2 = Math.asin(
    Math.sin(phi1) * Math.cos(delta) +
      Math.cos(phi1) * Math.sin(delta) * Math.cos(theta),
  );
  const lambda2 =
    lambda1 +
    Math.atan2(
      Math.sin(theta) * Math.sin(delta) * Math.cos(phi1),
      Math.cos(delta) - Math.sin(phi1) * Math.sin(phi2),
    );
  return [toDeg(phi2), ((toDeg(lambda2) + 540) % 360) - 180];
}

/*
 * The whole point of the card. Ground distance alone says nothing about
 * whether an aircraft is in your sky; the elevation angle does.
 *
 * Over tens of kilometres the earth's curvature drops the target below the
 * flat-earth line by d^2 / 2R, which is what puts everything happening at
 * the airport below your horizon while cruise traffic twice as far away sits
 * comfortably in view. Refraction bends the sightline back down a little, so
 * the effective radius is a bit larger than the real one.
 */
function skyGeometry(groundM, heightM) {
  const drop = (groundM * groundM) / (2 * EFFECTIVE_RADIUS_M);
  const apparent = heightM - drop;
  const elevation = groundM <= 0 ? 90 : toDeg(Math.atan2(apparent, groundM));
  const slant = Math.sqrt(groundM * groundM + heightM * heightM);
  return { elevation, slant, drop };
}

/* --------------------------------------------------------- aircraft class */

// Widebodies, by the first three characters of the ICAO type code. A310 is a
// widebody and shares its prefix with the A318-321 family, so it is listed in
// full and checked first.
const HEAVY_CODES = ["A310"];
const HEAVY_PREFIXES = ["A33", "A34", "A35", "A38", "B74", "B76", "B77", "B78", "A30", "MD1", "IL9", "AN1", "C5M", "B52"];
const MEDIUM_PREFIXES = ["A19", "A20", "A21", "A31", "A32", "B71", "B72", "B73", "B75", "E17", "E19", "E29", "E75", "E90", "CRJ", "BCS", "AT4", "AT7", "DH8", "SU9", "MD8", "MD9", "F70", "F10", "C56", "GLF", "CL6"];
const HELI_PREFIXES = ["EC1", "EC3", "EC6", "A13", "A16", "A18", "AS3", "AS5", "S76", "S92", "R22", "R44", "R66", "B06", "B47", "H60", "AW1", "H2"];

/* FR24 gives an ICAO type code (`aircraft_code`) but no size class, and the
 * difference between a helicopter at 400 m and a 777 at 11 km is the whole
 * story for both loudness and how big it looks. Prefix matching on the type
 * code gets it right for nearly everything that passes over a house; anything
 * unrecognised is treated as small, which errs towards "you will not hear
 * it" rather than towards a false alarm. */
function classifyAircraft(flight) {
  const category = String(flight.aircraft_category || "").toUpperCase();
  if (category.indexOf("HELI") >= 0 || category.indexOf("ROTOR") >= 0) {
    return "helicopter";
  }

  const code = String(flight.aircraft_code || "").toUpperCase();
  const model = String(flight.aircraft_model || "").toUpperCase();
  if (model.indexOf("HELICOPTER") >= 0 || model.indexOf("EUROCOPTER") >= 0) {
    return "helicopter";
  }

  const prefix = code.substring(0, 3);
  if (HELI_PREFIXES.indexOf(prefix) >= 0) return "helicopter";
  if (HEAVY_CODES.indexOf(code) >= 0) return "heavy";
  if (HEAVY_PREFIXES.indexOf(prefix) >= 0) return "heavy";
  if (MEDIUM_PREFIXES.indexOf(prefix) >= 0) return "medium";
  if (code) return "light";
  return "unknown";
}

/* ------------------------------------------------------------- acoustics */

/*
 * Spherical spreading plus atmospheric absorption, referenced to a measured
 * level at 300 m. Cruising aircraft get a penalty because they are at a
 * fraction of takeoff thrust and their noise is beamed backwards and
 * downwards, not at you; anything on the ground gets one because the first
 * row of buildings is in the way.
 *
 * The result is a rough dBA at your ear, which is the number worth comparing
 * against how quiet your street is.
 */
function estimateLoudness(slantM, altitudeM, aircraftClass, onGround, elevation) {
  const source = SOURCE_DBA[aircraftClass] || SOURCE_DBA.unknown;
  const distance = Math.max(50, slantM);
  let level =
    source -
    20 * Math.log10(distance / 300) -
    (AIR_ABSORPTION_DB_PER_KM * (distance - 300)) / 1000;

  if (altitudeM > 7500) level -= 6;
  else if (altitudeM > 5000) level -= 3;

  // Anything on the ground is at taxi thrust rather than the takeoff setting
  // the reference level assumes, and every metre of the path is through the
  // hedges and houses in between. Both are worth about ten dB, which is the
  // difference between hearing the airport all day and not.
  if (onGround) level -= 20;
  else if (elevation < 1) level -= 8;

  return level;
}

/* ------------------------------------------------------- horizon profile */

/*
 * `min_elevation` is a single number for most people, but a garden with a
 * row of poplars to the south and open polder to the north has two very
 * different horizons. Accept a map of compass points too, and interpolate
 * between the ones that were given.
 */
function horizonAt(profile, bearing) {
  if (typeof profile === "number") return profile;
  if (!profile || typeof profile !== "object") return 10;

  const points = [];
  for (const key of Object.keys(profile)) {
    const value = num(profile[key]);
    if (value === null) continue;
    const index = COMPASS_16.indexOf(String(key).toUpperCase());
    if (index >= 0) points.push({ angle: index * 22.5, value });
    else {
      const asAngle = num(key);
      if (asAngle !== null) points.push({ angle: ((asAngle % 360) + 360) % 360, value });
    }
  }
  if (!points.length) return 10;
  if (points.length === 1) return points[0].value;

  points.sort((a, b) => a.angle - b.angle);
  const target = ((bearing % 360) + 360) % 360;

  let before = points[points.length - 1];
  let after = points[0];
  for (let i = 0; i < points.length; i++) {
    if (points[i].angle <= target) before = points[i];
  }
  for (let i = points.length - 1; i >= 0; i--) {
    if (points[i].angle >= target) after = points[i];
  }

  let span = (after.angle - before.angle + 360) % 360;
  if (span === 0) return before.value;
  const offset = (target - before.angle + 360) % 360;
  return before.value + ((after.value - before.value) * offset) / span;
}

/* ------------------------------------------------------------ formatting */

function compassName(bearing, t) {
  const names = t("compass");
  const index = Math.round((((bearing % 360) + 360) % 360) / 22.5) % 16;
  return names[index];
}

function formatDistance(metres, imperial) {
  if (metres === null || metres === undefined) return "–";
  if (imperial) {
    const miles = metres / 1609.344;
    return `${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi`;
  }
  const km = metres / 1000;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

function formatAltitude(metres, unit) {
  if (metres === null || metres === undefined) return "–";
  if (unit === "ft") {
    return `${Math.round(metres / FEET_TO_M / 100) * 100} ft`;
  }
  return `${Math.round(metres / 10) * 10} m`;
}

function formatSpeed(ms, imperial) {
  if (ms === null || ms === undefined) return "–";
  if (imperial) return `${Math.round(ms / MPH_TO_MS)} mph`;
  return `${Math.round(ms / KMH_TO_MS)} km/h`;
}

function formatSeconds(seconds) {
  const total = Math.round(seconds);
  if (total < 60) return `${total}s`;
  return `${Math.floor(total / 60)}m ${String(total % 60).padStart(2, "0")}s`;
}

/* ----------------------------------------------------------- default conf */

const DEFAULTS = {
  entities: [],
  title: null,
  layout: "compact", // compact | full
  language: "auto", // auto | en | nl
  units: "auto", // auto | metric | imperial
  altitude_display: "auto", // auto | m | ft
  source_altitude_unit: "ft", // what the integration reports
  source_speed_unit: "kt",

  latitude: null,
  longitude: null,
  elevation: null, // observer height in metres, defaults to the HA setting

  min_elevation: 10, // degrees, or a map of compass points
  max_range: 50, // km of slant range
  include_ground: false,

  audible: true,
  noise_threshold: 40, // dBA at your ear
  sound_ghost: true,

  weather_entity: null,
  cloud_cover_threshold: 90, // percent
  cloud_base: 1500, // metres, or an entity id that reports it
  sun_entity: "sun.sun",

  show_map: true,
  map_height: 300,
  map_tiles: "auto", // auto | none | a {z}/{x}/{y} url template
  map_theme: "auto", // auto | light | dark
  map_rings: true,
  show_trails: true,
  trail_minutes: 6,
  show_labels: true,
  show_list: true,
  max_list: 6,
  extrapolate: true,

  accent: "#7cc4ff",
  radius: 18,

  tap_action: { action: "popup" },
  auto_popup: "never", // never | visible | overhead
  auto_popup_elevation: 60,
  auto_popup_seconds: 30,
};

/* --------------------------------------------------------- reading flights */

/* The integration parks the list under `flights`, but a template sensor or a
 * future release might not, so fall back to the first attribute that looks
 * like a list of positions. */
function extractFlights(stateObj) {
  const attrs = attrsOf(stateObj);
  if (Array.isArray(attrs.flights)) return attrs.flights;
  for (const key of Object.keys(attrs)) {
    const value = attrs[key];
    if (
      Array.isArray(value) &&
      value.length &&
      value[0] &&
      typeof value[0] === "object" &&
      value[0].latitude !== undefined
    ) {
      return value;
    }
  }
  return [];
}

function flightKey(raw) {
  return String(
    raw.id ||
      raw.flight_id ||
      raw.aircraft_registration ||
      raw.callsign ||
      raw.flight_number ||
      `${raw.latitude},${raw.longitude}`,
  );
}

function toMetresAltitude(value, unit) {
  const parsed = num(value);
  if (parsed === null) return null;
  return unit === "m" ? parsed : parsed * FEET_TO_M;
}

function toMetresPerSecond(value, unit) {
  const parsed = num(value);
  if (parsed === null) return null;
  if (unit === "kmh") return parsed * KMH_TO_MS;
  if (unit === "mph") return parsed * MPH_TO_MS;
  if (unit === "ms") return parsed;
  return parsed * KNOTS_TO_MS;
}

/* ------------------------------------------------------------ evaluation */

/*
 * Turn one raw Flightradar24 flight into everything the card needs to decide
 * whether it belongs in your sky, and what to tell you about it if it does.
 */
function evaluateFlight(raw, ctx) {
  const config = ctx.config;
  const home = ctx.home;

  // A hole in the list is a row that is not there, not a reason to stop. Only
  // `null` actually matters -- a string or a number reads as a flight with no
  // position and falls out two lines down -- but a null reaches `raw.latitude`
  // as a TypeError, and the list is not always ours to trust.
  if (!raw || typeof raw !== "object") return null;

  let lat = num(raw.latitude);
  let lon = num(raw.longitude);
  if (lat === null || lon === null) return null;

  const altitudeRaw = toMetresAltitude(raw.altitude, config.source_altitude_unit);
  let altitudeM = altitudeRaw === null ? 0 : altitudeRaw;
  const groundSpeed = toMetresPerSecond(raw.ground_speed, config.source_speed_unit);
  // Vertical speed is feet per minute wherever altitude is feet.
  const verticalRaw = num(raw.vertical_speed);
  const verticalMs =
    verticalRaw === null
      ? null
      : config.source_altitude_unit === "m"
        ? verticalRaw / 60
        : (verticalRaw * FEET_TO_M) / 60;
  const heading = num(raw.heading);
  const onGround = raw.on_ground === true || raw.on_ground === 1;

  // Between two polls an airliner covers ten kilometres. Dead reckoning off
  // the last update keeps the map moving instead of teleporting.
  if (config.extrapolate && ctx.age > 2 && groundSpeed && heading !== null) {
    const seconds = Math.min(ctx.age, 180);
    const moved = project(lat, lon, heading, groundSpeed * seconds);
    lat = moved[0];
    lon = moved[1];
    if (verticalMs !== null) altitudeM = Math.max(0, altitudeM + verticalMs * seconds);
  }

  const groundM = haversine(home.lat, home.lon, lat, lon);
  const bearing = bearingTo(home.lat, home.lon, lat, lon);
  const heightM = altitudeM - home.elevation;
  const geo = skyGeometry(groundM, heightM);

  const aircraftClass = classifyAircraft(raw);
  const spanM = SPAN_M[aircraftClass] || SPAN_M.unknown;

  const horizon = horizonAt(config.min_elevation, bearing);
  const inRange = geo.slant <= config.max_range * 1000;
  const aboveHorizon = geo.elevation >= horizon;
  const obscured =
    ctx.env.overcast && altitudeM > ctx.env.cloudBase && geo.elevation < 89.5;

  const loudness = estimateLoudness(
    geo.slant,
    altitudeM,
    aircraftClass,
    onGround,
    geo.elevation,
  );
  const audible = config.audible && loudness >= config.noise_threshold;

  const visible =
    (!onGround || config.include_ground) && aboveHorizon && inRange && !obscured;

  let verdict = "verdict_visible";
  let reason = "";
  if (visible) {
    verdict = "verdict_visible";
  } else if (onGround) {
    verdict = "verdict_ground";
  } else if (!aboveHorizon) {
    verdict = "verdict_low";
    reason = "reason_low";
  } else if (!inRange) {
    verdict = "verdict_far";
    reason = "reason_far";
  } else if (obscured) {
    verdict = "verdict_cloud";
  }
  if (!visible && audible) verdict = "verdict_audible";
  if (!visible && !audible) verdict = verdict === "verdict_visible" ? "verdict_none" : verdict;

  // How hard it is to pick out: an airliner is about five arcminutes across
  // at forty kilometres, which is a dot you have to be looking for.
  const arcmin = geo.slant > 0 ? (spanM / geo.slant) * 3437.75 : 0;
  const sizeScore = clamp((arcmin - 1.5) / 8, 0, 1);
  const elevScore = clamp((geo.elevation - horizon) / 25, 0, 1);
  const spotScore = clamp(0.6 * sizeScore + 0.4 * elevScore, 0.05, 1);

  const soundDelay = geo.slant / SPEED_OF_SOUND_MS;
  let ghost = null;
  if (config.sound_ghost && audible && groundSpeed && heading !== null) {
    const back = project(lat, lon, (heading + 180) % 360, groundSpeed * soundDelay);
    const ghostAlt = verticalMs === null ? altitudeM : altitudeM - verticalMs * soundDelay;
    const ghostGround = haversine(home.lat, home.lon, back[0], back[1]);
    const ghostGeo = skyGeometry(ghostGround, ghostAlt - home.elevation);
    ghost = {
      lat: back[0],
      lon: back[1],
      bearing: bearingTo(home.lat, home.lon, back[0], back[1]),
      elevation: ghostGeo.elevation,
    };
  }

  return {
    key: flightKey(raw),
    raw,
    callsign: raw.callsign || raw.flight_number || raw.aircraft_registration || "",
    flightNumber: raw.flight_number || "",
    registration: raw.aircraft_registration || "",
    // Two names for one airline: the list has room for "KLM" and the popup
    // has room for "KLM Royal Dutch Airlines". The feed may send either.
    airline: raw.airline_short || raw.airline || "",
    airlineName: raw.airline || raw.airline_short || "",
    model: raw.aircraft_model || "",
    code: raw.aircraft_code || "",
    photo: raw.aircraft_photo_medium || raw.aircraft_photo_small || null,
    origin: {
      iata: raw.airport_origin_code_iata || "",
      city: raw.airport_origin_city || "",
      name: raw.airport_origin_name || "",
    },
    destination: {
      iata: raw.airport_destination_code_iata || "",
      city: raw.airport_destination_city || "",
      name: raw.airport_destination_name || "",
    },
    lat,
    lon,
    altitudeM,
    heightM,
    groundSpeed,
    verticalMs,
    heading: heading === null ? 0 : heading,
    hasHeading: heading !== null,
    onGround,
    groundM,
    slantM: geo.slant,
    elevation: geo.elevation,
    bearing,
    horizon,
    aircraftClass,
    arcmin,
    spotScore,
    loudness,
    audible,
    visible,
    obscured,
    verdict,
    reason,
    soundDelay,
    ghost,
  };
}

/* Sky conditions that change the answer: darkness, and a solid cloud deck. */
function readEnvironment(hass, config) {
  const env = { night: false, sunElevation: null, overcast: false, cloudBase: Infinity, cover: null };

  const sun = config.sun_entity ? hass.states[config.sun_entity] : null;
  if (sun) {
    const elevation = num(attrsOf(sun).elevation);
    if (elevation !== null) {
      env.sunElevation = elevation;
      env.night = elevation < -6;
    } else {
      env.night = sun.state === "below_horizon";
    }
  }

  if (config.weather_entity) {
    const weather = hass.states[config.weather_entity];
    if (weather) {
      let cover = num(attrsOf(weather).cloud_coverage);
      if (cover === null) cover = num(weather.state);
      if (cover !== null) {
        env.cover = cover;
        env.overcast = cover >= config.cloud_cover_threshold;
      }
    }
  }

  if (env.overcast) {
    let base = config.cloud_base;
    if (typeof base === "string") {
      const entity = hass.states[base];
      const value = entity ? num(entity.state) : null;
      const unit = entity ? attrsOf(entity).unit_of_measurement : "";
      base = value === null ? 1500 : unit === "ft" ? value * FEET_TO_M : value;
    }
    env.cloudBase = num(base) === null ? 1500 : num(base);
  }

  return env;
}

/* --------------------------------------------------------------- the map */

function svgEl(tag, attrs) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  if (attrs) {
    for (const key of Object.keys(attrs)) el.setAttribute(key, attrs[key]);
  }
  return el;
}

// The same raster basemaps Home Assistant's own map card uses, so a dashboard
// that already shows a map is not talking to anywhere new.
const TILE_LIGHT = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
const TILE_DARK = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const TILE_SUBDOMAINS = ["a", "b", "c", "d"];
const TILE_SIZE = 256;
const MAP_ATTRIBUTION = "© OpenStreetMap · © CARTO";

/* Warm at rooftop height, cold at cruise -- the same cue the sky gives you,
 * where the low stuff has detail and the high stuff is a pale cross. */
function altitudeColour(metres) {
  const scale = clamp(metres / 11000, 0, 1);
  const hue = 30 + scale * 175;
  const light = 55 + scale * 12;
  return `hsl(${Math.round(hue)},85%,${Math.round(light)}%)`;
}

/* ------------------------------------------------------ web mercator maths */

function lonToWorldX(lon, zoom) {
  return ((lon + 180) / 360) * TILE_SIZE * Math.pow(2, zoom);
}

function latToWorldY(lat, zoom) {
  const sin = Math.sin(toRad(clamp(lat, -85.05, 85.05)));
  const y = 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI);
  return y * TILE_SIZE * Math.pow(2, zoom);
}

function worldXToLon(x, zoom) {
  return (x / (TILE_SIZE * Math.pow(2, zoom))) * 360 - 180;
}

function worldYToLat(y, zoom) {
  const n = Math.PI - (2 * Math.PI * y) / (TILE_SIZE * Math.pow(2, zoom));
  return toDeg(Math.atan(Math.sinh(n)));
}

function metresPerPixel(lat, zoom) {
  return (156543.03392 * Math.cos(toRad(lat))) / Math.pow(2, zoom);
}

/*
 * A small raster-tile map: a grid of <img> for the basemap and one SVG on top
 * for the rings, the trails and the aircraft. Leaflet is not reachable from a
 * custom card without bundling it, and the map this card needs -- fixed on
 * your house, a handful of markers, no layers or popups -- is a few hundred
 * lines of Mercator arithmetic rather than a dependency.
 */
class MapView {
  constructor(options) {
    this.options = options || {};
    this._tiles = {};
    this._markers = {};
    this._trails = {};
    this._ghosts = {};
    this._zoom = 9;
    this._centre = { lat: 0, lon: 0 };
    this._size = { width: 0, height: 0 };
    this._pinned = false; // set once the user pans or zooms by hand
    this._fitted = false;
    this._build();
  }

  get element() {
    return this._root;
  }

  _build() {
    const root = document.createElement("div");
    root.className = "map";
    root.innerHTML = `
      <div class="tiles"></div>
      <div class="controls">
        <button class="zin" type="button" aria-label="+">+</button>
        <button class="zout" type="button" aria-label="−">−</button>
        <button class="home" type="button" aria-label="recenter">⌖</button>
      </div>
      <div class="attrib">${MAP_ATTRIBUTION}</div>
    `;

    this._tileLayer = root.querySelector(".tiles");
    this._overlay = svgEl("svg", { class: "overlay" });
    this._ringLayer = svgEl("g", { class: "layer-rings" });
    this._trailLayer = svgEl("g", { class: "layer-trails" });
    this._ghostLayer = svgEl("g", { class: "layer-ghosts" });
    this._homeLayer = svgEl("g", { class: "layer-home" });
    this._markerLayer = svgEl("g", { class: "layer-markers" });
    this._overlay.appendChild(this._ringLayer);
    this._overlay.appendChild(this._trailLayer);
    this._overlay.appendChild(this._ghostLayer);
    this._overlay.appendChild(this._homeLayer);
    this._overlay.appendChild(this._markerLayer);
    root.insertBefore(this._overlay, root.querySelector(".controls"));

    root.querySelector(".zin").addEventListener("click", (ev) => {
      ev.stopPropagation();
      this._nudgeZoom(1);
    });
    root.querySelector(".zout").addEventListener("click", (ev) => {
      ev.stopPropagation();
      this._nudgeZoom(-1);
    });
    root.querySelector(".home").addEventListener("click", (ev) => {
      ev.stopPropagation();
      this._pinned = false;
      this._refit();
    });

    this._bindPan(root);
    this._observeSize(root);
    this._root = root;
  }

  /* Dragging the map means you want it where you put it, so auto-fit stops
   * until the recentre button says otherwise. */
  _bindPan(root) {
    let dragging = false;
    let last = null;
    let moved = 0;

    root.addEventListener("pointerdown", (ev) => {
      if (ev.target && ev.target.closest && ev.target.closest(".controls")) return;
      dragging = true;
      moved = 0;
      last = { x: ev.clientX, y: ev.clientY };
      if (root.setPointerCapture) root.setPointerCapture(ev.pointerId);
    });
    root.addEventListener("pointermove", (ev) => {
      if (!dragging || !last) return;
      const dx = ev.clientX - last.x;
      const dy = ev.clientY - last.y;
      moved += Math.abs(dx) + Math.abs(dy);
      last = { x: ev.clientX, y: ev.clientY };
      if (moved < 3) return;
      this._pinned = true;
      const centreX = lonToWorldX(this._centre.lon, this._zoom) - dx;
      const centreY = latToWorldY(this._centre.lat, this._zoom) - dy;
      this._centre = {
        lat: worldYToLat(centreY, this._zoom),
        lon: worldXToLon(centreX, this._zoom),
      };
      this._draw();
    });
    const stop = () => {
      dragging = false;
      last = null;
    };
    root.addEventListener("pointerup", stop);
    root.addEventListener("pointercancel", stop);
    root.addEventListener("pointerleave", stop);

    root.addEventListener(
      "wheel",
      (ev) => {
        ev.preventDefault();
        this._nudgeZoom(ev.deltaY < 0 ? 1 : -1);
      },
      { passive: false },
    );
  }

  _observeSize(root) {
    const measure = () => {
      const width = root.clientWidth;
      const height = root.clientHeight;
      if (!width || !height) return;
      if (width === this._size.width && height === this._size.height) return;
      this._size = { width, height };
      this._overlay.setAttribute("viewBox", `0 0 ${width} ${height}`);
      if (!this._pinned) this._refit();
      else this._draw();
    };
    if (window.ResizeObserver) {
      this._resizeObserver = new ResizeObserver(measure);
      this._resizeObserver.observe(root);
    } else {
      window.addEventListener("resize", measure);
    }
    // The element is usually not laid out yet at construction time.
    window.setTimeout(measure, 0);
  }

  _nudgeZoom(delta) {
    const next = clamp(this._zoom + delta, 3, 15);
    if (next === this._zoom) return;
    this._pinned = true;
    this._zoom = next;
    this._draw();
  }

  destroy() {
    if (this._resizeObserver) this._resizeObserver.disconnect();
  }

  setDark(dark) {
    this._dark = !!dark;
    this._root.classList.toggle("dark", !!dark);
  }

  /* ------------------------------------------------------------ the view */

  /*
   * Frame the house and everything currently in the sky above it. Fitting to
   * the aircraft alone would swing the map around every time a flight leaves,
   * so the house is always in the box and the zoom only ever changes when the
   * set of flights does.
   */
  _refit() {
    const home = this.options.home;
    if (!home || !this._size.width) return;

    let north = home.lat;
    let south = home.lat;
    let east = home.lon;
    let west = home.lon;

    for (const flight of this._flights || []) {
      north = Math.max(north, flight.lat);
      south = Math.min(south, flight.lat);
      east = Math.max(east, flight.lon);
      west = Math.min(west, flight.lon);
    }

    // Never zoom in tighter than the innermost range ring, so an empty sky
    // still looks like your neighbourhood rather than your roof.
    const floorM = (this.options.minSpan || 20) * 1000;
    const latPad = floorM / 111320 / 2;
    const lonPad = latPad / Math.max(0.2, Math.cos(toRad(home.lat)));
    north = Math.max(north, home.lat + latPad);
    south = Math.min(south, home.lat - latPad);
    east = Math.max(east, home.lon + lonPad);
    west = Math.min(west, home.lon - lonPad);

    this._centre = { lat: (north + south) / 2, lon: (east + west) / 2 };

    const padding = 34;
    const usableW = Math.max(32, this._size.width - padding * 2);
    const usableH = Math.max(32, this._size.height - padding * 2);

    let zoom = 3;
    for (let candidate = 15; candidate >= 3; candidate--) {
      const width = Math.abs(
        lonToWorldX(east, candidate) - lonToWorldX(west, candidate),
      );
      const height = Math.abs(
        latToWorldY(north, candidate) - latToWorldY(south, candidate),
      );
      if (width <= usableW && height <= usableH) {
        zoom = candidate;
        break;
      }
    }
    this._zoom = zoom;
    this._fitted = true;
    this._draw();
  }

  _pixelOf(lat, lon) {
    const centreX = lonToWorldX(this._centre.lon, this._zoom);
    const centreY = latToWorldY(this._centre.lat, this._zoom);
    return [
      lonToWorldX(lon, this._zoom) - centreX + this._size.width / 2,
      latToWorldY(lat, this._zoom) - centreY + this._size.height / 2,
    ];
  }

  update(flights, selectedKey) {
    const previous = Object.keys(this._markers).sort().join(",");
    this._flights = flights;
    this._selected = selectedKey;
    const next = flights
      .map((f) => f.key)
      .sort()
      .join(",");
    // Refit when the cast changes, not on every dead-reckoning tick.
    if (!this._pinned && (previous !== next || !this._fitted)) this._refit();
    else this._draw();
  }

  _draw() {
    if (!this._size.width) return;
    this._drawTiles();
    this._drawRings();
    this._drawHome();
    this._drawFlights();
  }

  /* ---------------------------------------------------------------- tiles */

  _drawTiles() {
    const source = this.options.tiles;
    if (source === "none") {
      this._tileLayer.style.display = "none";
      return;
    }
    this._tileLayer.style.display = "";

    const zoom = this._zoom;
    const centreX = lonToWorldX(this._centre.lon, zoom);
    const centreY = latToWorldY(this._centre.lat, zoom);
    const left = centreX - this._size.width / 2;
    const top = centreY - this._size.height / 2;

    const firstX = Math.floor(left / TILE_SIZE);
    const lastX = Math.floor((left + this._size.width) / TILE_SIZE);
    const firstY = Math.floor(top / TILE_SIZE);
    const lastY = Math.floor((top + this._size.height) / TILE_SIZE);
    const count = Math.pow(2, zoom);

    const wanted = {};
    for (let x = firstX; x <= lastX; x++) {
      for (let y = firstY; y <= lastY; y++) {
        if (y < 0 || y >= count) continue;
        const wrapped = ((x % count) + count) % count;
        const key = `${zoom}/${wrapped}/${y}/${x}`;
        wanted[key] = true;
        let tile = this._tiles[key];
        if (!tile) {
          tile = document.createElement("img");
          tile.className = "tile";
          tile.alt = "";
          tile.decoding = "async";
          tile.loading = "eager";
          tile.src = this._tileUrl(zoom, wrapped, y);
          tile.addEventListener("error", () => tile.classList.add("failed"));
          this._tileLayer.appendChild(tile);
          this._tiles[key] = tile;
        }
        tile.style.transform = `translate(${x * TILE_SIZE - left}px, ${y * TILE_SIZE - top}px)`;
      }
    }

    for (const key of Object.keys(this._tiles)) {
      if (wanted[key]) continue;
      this._tileLayer.removeChild(this._tiles[key]);
      delete this._tiles[key];
    }
  }

  _tileUrl(zoom, x, y) {
    const custom = this.options.tiles;
    let template = custom && custom !== "auto" && custom !== "none" ? custom : null;
    if (!template) {
      template = this._dark
        ? this.options.tileUrlDark || TILE_DARK
        : this.options.tileUrl || TILE_LIGHT;
    }
    const retina = window.devicePixelRatio > 1.5 ? "@2x" : "";
    return template
      .split("{s}")
      .join(TILE_SUBDOMAINS[(x + y) % TILE_SUBDOMAINS.length])
      .split("{z}")
      .join(String(zoom))
      .split("{x}")
      .join(String(x))
      .split("{y}")
      .join(String(y))
      .split("{r}")
      .join(retina);
  }

  /* ---------------------------------------------------------- the overlay */

  /* Rings at a quarter, a half and all of the distance you can make something
   * out at. They double as a scale, and they keep the map readable when the
   * tiles cannot be reached. */
  _drawRings() {
    const home = this.options.home;
    this._ringLayer.innerHTML = "";
    if (!home || !this.options.rings) return;

    const centre = this._pixelOf(home.lat, home.lon);
    const perPixel = metresPerPixel(home.lat, this._zoom);

    for (const km of this.options.rings) {
      const radius = (km * 1000) / perPixel;
      if (radius < 12 || radius > Math.max(this._size.width, this._size.height)) continue;
      this._ringLayer.appendChild(
        svgEl("circle", {
          cx: centre[0].toFixed(1),
          cy: centre[1].toFixed(1),
          r: radius.toFixed(1),
          class: "ring",
        }),
      );
      const label = svgEl("text", {
        x: centre[0].toFixed(1),
        y: (centre[1] + radius - 4).toFixed(1),
        class: "ring-label",
      });
      label.textContent = this.options.format
        ? this.options.format(km * 1000)
        : `${km} km`;
      this._ringLayer.appendChild(label);
    }
  }

  _drawHome() {
    const home = this.options.home;
    this._homeLayer.innerHTML = "";
    if (!home) return;
    const centre = this._pixelOf(home.lat, home.lon);
    this._homeLayer.appendChild(
      svgEl("circle", { cx: centre[0].toFixed(1), cy: centre[1].toFixed(1), r: 5, class: "home-dot" }),
    );
  }

  _drawFlights() {
    const flights = this._flights || [];
    const seen = {};

    for (const flight of flights) {
      seen[flight.key] = true;
      const point = this._pixelOf(flight.lat, flight.lon);
      let marker = this._markers[flight.key];

      if (!marker) {
        const group = svgEl("g", { class: "marker" });
        const halo = svgEl("circle", { class: "halo", r: 13 });
        const glyph = svgEl("path", {
          class: "glyph",
          d: "M0,-9 L6,7.5 L0,4 L-6,7.5 Z",
        });
        const label = svgEl("text", { class: "tag", y: 22 });
        group.appendChild(halo);
        group.appendChild(glyph);
        group.appendChild(label);
        group.addEventListener("click", (ev) => {
          ev.stopPropagation();
          if (this.options.onSelect) this.options.onSelect(flight.key);
        });
        this._markerLayer.appendChild(group);
        marker = { group, halo, glyph, label };
        this._markers[flight.key] = marker;
      }

      const selected = flight.key === this._selected;
      marker.group.setAttribute(
        "class",
        `marker${flight.visible ? "" : " heard"}${selected ? " selected" : ""}`,
      );
      marker.glyph.setAttribute("fill", altitudeColour(flight.altitudeM));
      marker.glyph.setAttribute(
        "transform",
        `rotate(${(flight.hasHeading ? flight.heading : 0).toFixed(0)})`,
      );
      marker.group.setAttribute(
        "transform",
        `translate(${point[0].toFixed(1)},${point[1].toFixed(1)})`,
      );

      const tag = this.options.labels ? flight.callsign || "" : "";
      if (marker.label.textContent !== tag) marker.label.textContent = tag;

      this._drawTrail(flight);
      this._drawGhost(flight);
    }

    for (const key of Object.keys(this._markers)) {
      if (seen[key]) continue;
      this._markerLayer.removeChild(this._markers[key].group);
      delete this._markers[key];
      if (this._trails[key]) {
        this._trailLayer.removeChild(this._trails[key]);
        delete this._trails[key];
      }
      if (this._ghosts[key]) {
        this._ghostLayer.removeChild(this._ghosts[key]);
        delete this._ghosts[key];
      }
    }
  }

  _drawTrail(flight) {
    const history = this.options.history ? this.options.history(flight.key) : null;
    let trail = this._trails[flight.key];
    if (!history || history.length < 2) {
      if (trail) {
        this._trailLayer.removeChild(trail);
        delete this._trails[flight.key];
      }
      return;
    }
    if (!trail) {
      trail = svgEl("polyline", { class: "trail" });
      this._trailLayer.appendChild(trail);
      this._trails[flight.key] = trail;
    }
    const points = [];
    for (const sample of history) {
      const point = this._pixelOf(sample.lat, sample.lon);
      points.push(`${point[0].toFixed(1)},${point[1].toFixed(1)}`);
    }
    trail.setAttribute("points", points.join(" "));
    trail.setAttribute("stroke", altitudeColour(flight.altitudeM));
  }

  /* Sound is slow: what you hear right now left the aircraft up to a minute
   * ago, from a noticeably different place. Mark that place. */
  _drawGhost(flight) {
    let ghost = this._ghosts[flight.key];
    const wanted = flight.ghost && flight.audible && flight.soundDelay >= 8;
    if (!wanted) {
      if (ghost) {
        this._ghostLayer.removeChild(ghost);
        delete this._ghosts[flight.key];
      }
      return;
    }
    if (!ghost) {
      ghost = svgEl("circle", { class: "ghost", r: 6 });
      this._ghostLayer.appendChild(ghost);
      this._ghosts[flight.key] = ghost;
    }
    const point = this._pixelOf(flight.ghost.lat, flight.ghost.lon);
    ghost.setAttribute("cx", point[0].toFixed(1));
    ghost.setAttribute("cy", point[1].toFixed(1));
  }
}

/* -------------------------------------------------------- airport cities */

/* The feed row carries the two airport codes and nothing else. The city and
 * the written-out name come from the detail lookup, which is a second request
 * per flight, is capped per cycle, and is the first thing Flightradar24
 * refuses -- so a good share of flights reach the card as "NUE -> AMS" and
 * stay that way. That is not an answer to where it is going. It is a riddle,
 * and only for the airport you happen not to know.
 *
 * So the codes are resolved here too, from the airports with scheduled
 * passenger traffic. Strictly a fallback: a city the feed sends wins over this
 * one every time, because it is current and this table is a snapshot.
 *
 * Cities, not airports -- the code is already on the line above it, and
 * "Nuremberg" is the part that was missing. Written the way Flightradar24
 * writes them, in English and unaccented, so the two sources cannot disagree
 * in the same popup.
 *
 * It is ~900 airports and costs ~16 KB of the file, ~10 KB of them over the
 * wire, which is a real share of a card that is downloaded again on every
 * version bump. It buys the popup reading as a sentence without a second
 * request having to succeed first. The tail is the part worth having: nobody
 * needs a table to be told that AMS is Amsterdam, and the code you cannot
 * place is by definition not one of the famous ones. Trim from the bottom of
 * the rows, never from the middle, if it ever has to give. */
const AIRPORT_CITIES = (function () {
  const rows = [
    // Netherlands, Belgium, Luxembourg
    `
    AMS Amsterdam|RTM Rotterdam|EIN Eindhoven|GRQ Groningen|MST Maastricht
    ENS Enschede|BRU Brussels|CRL Charleroi|ANR Antwerp|LGG Liege|OST Ostend
    KJK Kortrijk|LUX Luxembourg
    `,
    // Germany, Austria, Switzerland
    `
    FRA Frankfurt|MUC Munich|DUS Dusseldorf|BER Berlin|HAM Hamburg
    CGN Cologne|STR Stuttgart|NUE Nuremberg|HAJ Hannover|LEJ Leipzig
    BRE Bremen|DTM Dortmund|FMO Munster|HHN Frankfurt Hahn|NRN Weeze
    PAD Paderborn|SCN Saarbrucken|FDH Friedrichshafen|FKB Karlsruhe
    ERF Erfurt|KSF Kassel|RLG Rostock|GWT Sylt|HDF Heringsdorf|VIE Vienna
    SZG Salzburg|INN Innsbruck|GRZ Graz|LNZ Linz|KLU Klagenfurt|ZRH Zurich
    GVA Geneva|BSL Basel|BRN Bern|LUG Lugano|SIR Sion|ACH St Gallen
    `,
    // United Kingdom and Ireland
    `
    LHR London|LGW London|STN London|LTN London|LCY London|SEN London
    MAN Manchester|BHX Birmingham|EDI Edinburgh|GLA Glasgow|BRS Bristol
    NCL Newcastle|LPL Liverpool|LBA Leeds|EMA Nottingham|ABZ Aberdeen
    BFS Belfast|BHD Belfast|CWL Cardiff|SOU Southampton|EXT Exeter
    NWI Norwich|INV Inverness|DND Dundee|PIK Glasgow|BOH Bournemouth
    MME Durham|HUY Humberside|JER Jersey|GCI Guernsey|IOM Isle of Man
    DUB Dublin|ORK Cork|SNN Shannon|NOC Knock|KIR Kerry
    `,
    // France
    `
    CDG Paris|ORY Paris|BVA Paris Beauvais|NCE Nice|LYS Lyon|MRS Marseille
    TLS Toulouse|BOD Bordeaux|NTE Nantes|LIL Lille|MPL Montpellier
    SXB Strasbourg|MLH Mulhouse|BIQ Biarritz|AJA Ajaccio|BIA Bastia
    FSC Figari|CLY Calvi|RNS Rennes|BES Brest|PGF Perpignan
    CFE Clermont-Ferrand|GNB Grenoble|CMF Chambery|LDE Tarbes|PUF Pau
    EGC Bergerac|LRH La Rochelle|TLN Toulon|NIM Nimes|BZR Beziers
    CCF Carcassonne|DNR Dinard|LIG Limoges|ETZ Metz|TUF Tours|AVN Avignon
    QXB Aix-en-Provence|CER Cherbourg|LEH Le Havre|FDF Fort-de-France
    PTP Pointe-a-Pitre|RUN Saint-Denis|CAY Cayenne
    `,
    // Iberia
    `
    MAD Madrid|BCN Barcelona|PMI Palma de Mallorca|AGP Malaga|ALC Alicante
    VLC Valencia|SVQ Seville|BIO Bilbao|IBZ Ibiza|MAH Menorca|LPA Las Palmas
    TFS Tenerife|TFN Tenerife|ACE Lanzarote|FUE Fuerteventura|SPC La Palma
    GMZ La Gomera|VDE El Hierro|SCQ Santiago de Compostela|OVD Oviedo
    SDR Santander|VGO Vigo|LCG A Coruna|ZAZ Zaragoza|GRX Granada|XRY Jerez
    MJV Murcia|RMU Murcia|REU Reus|GRO Girona|VIT Vitoria|PNA Pamplona
    EAS San Sebastian|ALM Almeria|MLN Melilla|BJZ Badajoz|VLL Valladolid
    LEN Leon|SLM Salamanca|LIS Lisbon|OPO Porto|FAO Faro|FNC Madeira
    PXO Porto Santo|PDL Ponta Delgada|TER Terceira|HOR Horta|GIB Gibraltar
    `,
    // Italy, Malta, Greece, Cyprus
    `
    FCO Rome|CIA Rome|MXP Milan|LIN Milan|BGY Milan Bergamo|VCE Venice
    TSF Treviso|NAP Naples|BLQ Bologna|FLR Florence|PSA Pisa|TRN Turin
    CTA Catania|PMO Palermo|CAG Cagliari|OLB Olbia|AHO Alghero|BRI Bari
    BDS Brindisi|SUF Lamezia Terme|REG Reggio Calabria|GOA Genoa|VRN Verona
    TRS Trieste|PEG Perugia|AOI Ancona|PSR Pescara|RMI Rimini|TPS Trapani
    CIY Comiso|PNL Pantelleria|CUF Cuneo|PMF Parma|BZO Bolzano|MLA Malta
    ATH Athens|SKG Thessaloniki|HER Heraklion|CHQ Chania|RHO Rhodes|KGS Kos
    JTR Santorini|JMK Mykonos|CFU Corfu|ZTH Zakynthos|PVK Preveza|KVA Kavala
    VOL Volos|EFL Kefalonia|SMI Samos|MJT Mytilene|JSI Skiathos|KLX Kalamata
    AXD Alexandroupolis|LCA Larnaca|PFO Paphos
    `,
    // Nordics and the Baltic
    `
    CPH Copenhagen|BLL Billund|AAL Aalborg|AAR Aarhus|RNN Bornholm
    ARN Stockholm|BMA Stockholm|NYO Stockholm|GOT Gothenburg|MMX Malmo
    LLA Lulea|UME Umea|OSD Ostersund|VBY Visby|KRN Kiruna|OSL Oslo
    TRF Sandefjord|BGO Bergen|SVG Stavanger|TRD Trondheim|TOS Tromso
    BOO Bodo|AES Alesund|KRS Kristiansand|EVE Harstad|LYR Svalbard
    HEL Helsinki|TMP Tampere|TKU Turku|OUL Oulu|RVN Rovaniemi|KTT Kittila
    IVL Ivalo|MHQ Mariehamn|KEF Reykjavik|RKV Reykjavik|AEY Akureyri
    FAE Faroe Islands|SFJ Kangerlussuaq|GOH Nuuk|RIX Riga|TLL Tallinn
    VNO Vilnius|KUN Kaunas|PLQ Palanga
    `,
    // Central and eastern Europe
    `
    WAW Warsaw|WMI Warsaw|KRK Krakow|GDN Gdansk|WRO Wroclaw|POZ Poznan
    KTW Katowice|RZE Rzeszow|LUZ Lublin|SZZ Szczecin|BZG Bydgoszcz|LCJ Lodz
    PRG Prague|BRQ Brno|OSR Ostrava|BTS Bratislava|KSC Kosice|BUD Budapest
    DEB Debrecen|OTP Bucharest|CLJ Cluj-Napoca|TSR Timisoara|IAS Iasi
    SBZ Sibiu|CND Constanta|CRA Craiova|SOF Sofia|VAR Varna|BOJ Burgas
    PDV Plovdiv|BEG Belgrade|INI Nis|ZAG Zagreb|SPU Split|DBV Dubrovnik
    ZAD Zadar|PUY Pula|RJK Rijeka|OSI Osijek|LJU Ljubljana|SJJ Sarajevo
    BNX Banja Luka|TZL Tuzla|TGD Podgorica|TIV Tivat|TIA Tirana|SKP Skopje
    OHD Ohrid|PRN Pristina|KIV Chisinau|KBP Kyiv|IEV Kyiv|LWO Lviv|ODS Odesa
    MSQ Minsk|SVO Moscow|DME Moscow|VKO Moscow|ZIA Moscow|LED St Petersburg
    AER Sochi|KZN Kazan|SVX Yekaterinburg|OVB Novosibirsk|KJA Krasnoyarsk
    VVO Vladivostok|KGD Kaliningrad|EVN Yerevan|TBS Tbilisi|BUS Batumi
    GYD Baku|TAS Tashkent|ALA Almaty|NQZ Astana|FRU Bishkek|DYU Dushanbe
    ASB Ashgabat
    `,
    // Turkey and the Middle East
    `
    IST Istanbul|SAW Istanbul|AYT Antalya|ADB Izmir|ESB Ankara|DLM Dalaman
    BJV Bodrum|ADA Adana|TZX Trabzon|GZT Gaziantep|KYA Konya|VAN Van
    DIY Diyarbakir|ASR Kayseri|DNZ Denizli|TLV Tel Aviv|VDA Eilat|AMM Amman
    AQJ Aqaba|BEY Beirut|DAM Damascus|BGW Baghdad|EBL Erbil|BSR Basra
    NJF Najaf|IKA Tehran|MHD Mashhad|DXB Dubai|DWC Dubai|AUH Abu Dhabi
    SHJ Sharjah|RKT Ras Al Khaimah|DOH Doha|KWI Kuwait City|BAH Bahrain
    MCT Muscat|SLL Salalah|RUH Riyadh|JED Jeddah|DMM Dammam|MED Medina
    AHB Abha|SAH Sanaa
    `,
    // Africa
    `
    CMN Casablanca|RAK Marrakesh|AGA Agadir|FEZ Fez|TNG Tangier|NDR Nador
    OUD Oujda|RBA Rabat|ESU Essaouira|OZZ Ouarzazate|TUN Tunis|MIR Monastir
    DJE Djerba|NBE Enfidha|SFA Sfax|ALG Algiers|ORN Oran|CZL Constantine
    AAE Annaba|TLM Tlemcen|TIP Tripoli|BEN Benghazi|CAI Cairo|SPX Cairo
    HRG Hurghada|SSH Sharm El Sheikh|LXR Luxor|ASW Aswan|RMF Marsa Alam
    HBE Alexandria|KRT Khartoum|ADD Addis Ababa|NBO Nairobi|MBA Mombasa
    EBB Entebbe|KGL Kigali|DAR Dar es Salaam|JRO Kilimanjaro|ZNZ Zanzibar
    MGQ Mogadishu|HGA Hargeisa|JIB Djibouti|ASM Asmara|LOS Lagos|ABV Abuja
    PHC Port Harcourt|KAN Kano|ACC Accra|ABJ Abidjan|DKR Dakar|LFW Lome
    COO Cotonou|OUA Ouagadougou|BKO Bamako|CKY Conakry|FNA Freetown
    ROB Monrovia|BJL Banjul|RAI Praia|SID Sal|DLA Douala|NSI Yaounde
    LBV Libreville|BZV Brazzaville|FIH Kinshasa|FBM Lubumbashi|LAD Luanda
    MPM Maputo|BEW Beira|HRE Harare|VFA Victoria Falls|LUN Lusaka
    LLW Lilongwe|BLZ Blantyre|GBE Gaborone|WDH Windhoek|MSU Maseru
    JNB Johannesburg|CPT Cape Town|DUR Durban|PLZ Gqeberha|GRJ George
    ELS East London|MQP Mbombela|MRU Mauritius|SEZ Seychelles
    TNR Antananarivo|NOS Nosy Be|RRG Rodrigues|HAH Moroni|TMS Sao Tome
    `,
    // North America
    `
    JFK New York|EWR Newark|LGA New York|HPN White Plains|ISP Islip
    SWF Newburgh|BOS Boston|PVD Providence|BDL Hartford|MHT Manchester
    PWM Portland|BGR Bangor|BTV Burlington|ALB Albany|SYR Syracuse
    ROC Rochester|BUF Buffalo|PHL Philadelphia|ABE Allentown|IAD Washington
    DCA Washington|BWI Baltimore|RIC Richmond|ORF Norfolk|RDU Raleigh
    GSO Greensboro|CLT Charlotte|GSP Greenville|CHS Charleston|CAE Columbia
    MYR Myrtle Beach|SAV Savannah|ATL Atlanta|BHM Birmingham|HSV Huntsville
    MGM Montgomery|JAN Jackson|MSY New Orleans|BTR Baton Rouge
    SHV Shreveport|LIT Little Rock|MEM Memphis|BNA Nashville|TYS Knoxville
    CHA Chattanooga|SDF Louisville|LEX Lexington|CVG Cincinnati|CMH Columbus
    CLE Cleveland|PIT Pittsburgh|DAY Dayton|IND Indianapolis|DTW Detroit
    GRR Grand Rapids|ORD Chicago|MDW Chicago|MKE Milwaukee|MSP Minneapolis
    DSM Des Moines|OMA Omaha|ICT Wichita|MCI Kansas City|STL St Louis
    OKC Oklahoma City|TUL Tulsa|DFW Dallas|DAL Dallas|IAH Houston
    HOU Houston|AUS Austin|SAT San Antonio|ELP El Paso|ABQ Albuquerque
    TUS Tucson|PHX Phoenix|LAS Las Vegas|SLC Salt Lake City|DEN Denver
    COS Colorado Springs|BOI Boise|GEG Spokane|SEA Seattle|PDX Portland
    RNO Reno|SMF Sacramento|SFO San Francisco|OAK Oakland|SJC San Jose
    FAT Fresno|LAX Los Angeles|BUR Burbank|SNA Santa Ana|ONT Ontario
    SAN San Diego|PSP Palm Springs|ANC Anchorage|FAI Fairbanks|HNL Honolulu
    OGG Maui|KOA Kona|LIH Kauai|MIA Miami|FLL Fort Lauderdale
    PBI West Palm Beach|MCO Orlando|TPA Tampa|RSW Fort Myers|SRQ Sarasota
    JAX Jacksonville|TLH Tallahassee|PNS Pensacola|VPS Destin|YYZ Toronto
    YTZ Toronto|YHM Hamilton|YUL Montreal|YOW Ottawa|YQB Quebec City
    YHZ Halifax|YYT St Johns|YWG Winnipeg|YQR Regina|YXE Saskatoon
    YYC Calgary|YEG Edmonton|YVR Vancouver|YYJ Victoria|YLW Kelowna
    YXY Whitehorse|YZF Yellowknife|YFB Iqaluit
    `,
    // Latin America and the Caribbean
    `
    MEX Mexico City|NLU Mexico City|GDL Guadalajara|MTY Monterrey|CUN Cancun
    SJD Los Cabos|PVR Puerto Vallarta|TIJ Tijuana|MID Merida|CZM Cozumel
    BJX Leon|QRO Queretaro|OAX Oaxaca|HUX Huatulco|ZIH Ixtapa|ACA Acapulco
    CUU Chihuahua|CJS Ciudad Juarez|GUA Guatemala City|SAL San Salvador
    TGU Tegucigalpa|SAP San Pedro Sula|RTB Roatan|MGA Managua|SJO San Jose
    LIR Liberia|PTY Panama City|BZE Belize City|HAV Havana|VRA Varadero
    HOG Holguin|SNU Santa Clara|SDQ Santo Domingo|PUJ Punta Cana
    POP Puerto Plata|STI Santiago|SJU San Juan|STT St Thomas|STX St Croix
    MBJ Montego Bay|KIN Kingston|NAS Nassau|FPO Freeport|GCM Grand Cayman
    PLS Providenciales|BGI Bridgetown|AUA Aruba|CUR Curacao|BON Bonaire
    SXM Sint Maarten|ANU Antigua|SKB St Kitts|SLU St Lucia|GND Grenada
    SVD St Vincent|DOM Dominica|POS Port of Spain|TAB Tobago
    PAP Port-au-Prince|BOG Bogota|MDE Medellin|CTG Cartagena|CLO Cali
    BAQ Barranquilla|SMR Santa Marta|ADZ San Andres|PEI Pereira
    BGA Bucaramanga|CCS Caracas|UIO Quito|GYE Guayaquil|GPS Galapagos
    LIM Lima|CUZ Cusco|AQP Arequipa|LPB La Paz|VVI Santa Cruz|ASU Asuncion
    MVD Montevideo|PDP Punta del Este|EZE Buenos Aires|AEP Buenos Aires
    COR Cordoba|MDZ Mendoza|BRC Bariloche|USH Ushuaia|IGR Iguazu|SLA Salta
    SCL Santiago|CJC Calama|PMC Puerto Montt|IPC Easter Island|GRU Sao Paulo
    CGH Sao Paulo|VCP Campinas|GIG Rio de Janeiro|SDU Rio de Janeiro
    BSB Brasilia|CNF Belo Horizonte|POA Porto Alegre|CWB Curitiba
    FLN Florianopolis|REC Recife|SSA Salvador|FOR Fortaleza|NAT Natal
    MCZ Maceio|BEL Belem|MAO Manaus|VIX Vitoria|GYN Goiania|CGB Cuiaba
    IGU Foz do Iguacu|GEO Georgetown|PBM Paramaribo
    `,
    // South and east Asia
    `
    DEL Delhi|BOM Mumbai|BLR Bengaluru|MAA Chennai|HYD Hyderabad|CCU Kolkata
    COK Kochi|AMD Ahmedabad|PNQ Pune|GOI Goa|GOX Goa|TRV Thiruvananthapuram
    JAI Jaipur|LKO Lucknow|IXC Chandigarh|ATQ Amritsar|SXR Srinagar
    GAU Guwahati|BBI Bhubaneswar|VNS Varanasi|IXB Bagdogra|NAG Nagpur
    IDR Indore|PAT Patna|CMB Colombo|MLE Male|KTM Kathmandu|DAC Dhaka
    CGP Chittagong|KHI Karachi|LHE Lahore|ISB Islamabad|PEW Peshawar
    MUX Multan|SKT Sialkot|KBL Kabul|ULN Ulaanbaatar|PEK Beijing|PKX Beijing
    PVG Shanghai|SHA Shanghai|CAN Guangzhou|SZX Shenzhen|CTU Chengdu
    TFU Chengdu|CKG Chongqing|XIY Xian|KMG Kunming|HGH Hangzhou|NKG Nanjing
    WUH Wuhan|TAO Qingdao|XMN Xiamen|CSX Changsha|TSN Tianjin|SYX Sanya
    HAK Haikou|DLC Dalian|SHE Shenyang|HRB Harbin|URC Urumqi|LHW Lanzhou
    HKG Hong Kong|MFM Macau|TPE Taipei|TSA Taipei|KHH Kaohsiung|ICN Seoul
    GMP Seoul|PUS Busan|CJU Jeju|TAE Daegu|NRT Tokyo|HND Tokyo|KIX Osaka
    ITM Osaka|UKB Kobe|NGO Nagoya|CTS Sapporo|FUK Fukuoka|OKA Okinawa
    SDJ Sendai|HIJ Hiroshima|KMJ Kumamoto|KOJ Kagoshima|TAK Takamatsu
    KMQ Komatsu
    `,
    // Southeast Asia and Oceania
    `
    SIN Singapore|KUL Kuala Lumpur|PEN Penang|LGK Langkawi|JHB Johor Bahru
    BKI Kota Kinabalu|KCH Kuching|MYY Miri|BWN Bandar Seri Begawan
    BKK Bangkok|DMK Bangkok|HKT Phuket|CNX Chiang Mai|USM Koh Samui
    KBV Krabi|UTP Pattaya|HDY Hat Yai|URT Surat Thani|CEI Chiang Rai
    SGN Ho Chi Minh City|HAN Hanoi|DAD Da Nang|CXR Nha Trang|PQC Phu Quoc
    HPH Hai Phong|VII Vinh|HUI Hue|PNH Phnom Penh|REP Siem Reap
    KOS Sihanoukville|VTE Vientiane|LPQ Luang Prabang|RGN Yangon
    MDL Mandalay|CGK Jakarta|HLP Jakarta|DPS Bali|SUB Surabaya
    JOG Yogyakarta|SRG Semarang|KNO Medan|PDG Padang|PLM Palembang
    BPN Balikpapan|UPG Makassar|MDC Manado|BTH Batam|LOP Lombok|DIL Dili
    MNL Manila|CEB Cebu|DVO Davao|CRK Clark|ILO Iloilo|PPS Puerto Princesa
    KLO Kalibo|MPH Boracay|SYD Sydney|MEL Melbourne|AVV Melbourne
    BNE Brisbane|OOL Gold Coast|PER Perth|ADL Adelaide|CBR Canberra
    HBA Hobart|LST Launceston|DRW Darwin|CNS Cairns|TSV Townsville
    MCY Sunshine Coast|NTL Newcastle|ASP Alice Springs|AYQ Uluru
    HTI Hamilton Island|AKL Auckland|CHC Christchurch|WLG Wellington
    ZQN Queenstown|DUD Dunedin|NSN Nelson|ROT Rotorua|NAN Nadi|SUV Suva
    PPT Papeete|NOU Noumea|VLI Port Vila|APW Apia|TBU Nukualofa
    RAR Rarotonga|POM Port Moresby|HIR Honiara|GUM Guam|SPN Saipan
    `,
    // A three-letter code, a space, and the city. Anything else is a typo in
    // the table above and is dropped rather than stored under a bad key.
  ];

  const table = Object.create(null);
  // Split on the separator and on the line breaks the rows are written with,
  // so a row can be laid out for reading without that changing what it means.
  const entries = rows.join("|").split(/[|\n]/);
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i].trim();
    // A three-letter code, a space, and the city. Anything else is a typo in
    // the table above and is dropped rather than stored under a bad key.
    if (entry.length > 4 && entry.charAt(3) === " ") {
      table[entry.slice(0, 3)] = entry.slice(4);
    }
  }
  return table;
})();

/* The city an IATA code stands for, or "" for one the table does not have --
 * a private strip, a code that has moved, a feed sending something that is not
 * a code at all. Never an error: the popup simply goes back to showing the
 * code on its own, which is where it started. */
function airportCity(iata) {
  if (iata === null || iata === undefined) return "";
  const code = String(iata).toUpperCase();
  return AIRPORT_CITIES[code] || "";
}

/* ------------------------------------------------------- shared rendering */

function svgIcon(path, size) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}"><path d="${path}"/></svg>`;
}

/* An airport written out: its name, and the city in front of it when the name
 * does not already say it. When the feed gave us neither -- every flight whose
 * detail lookup has not come back, or was refused -- the code is looked up in
 * the table above, so the line under it says a place rather than nothing.
 *
 * The feed always wins where it has an answer; the table only fills a hole.
 *
 * Both fields are coerced rather than trusted: this card reads whatever
 * publishes a `flights` attribute, including the other Flightradar24
 * integration and hand-written template sensors, and `toLowerCase` on a number
 * is a TypeError rather than a missing line in the popup. */
function placeName(port) {
  const name = port.name === null || port.name === undefined ? "" : String(port.name);
  const city = port.city === null || port.city === undefined ? "" : String(port.city);
  if (!name && !city) return airportCity(port.iata);
  if (!name) return city;
  if (!city || name.toLowerCase().indexOf(city.toLowerCase()) !== -1) return name;
  return `${city} ${name}`;
}

function routeLine(flight) {
  const from = flight.origin.iata || flight.origin.city;
  const to = flight.destination.iata || flight.destination.city;
  if (!from && !to) return "";
  return `${escapeHtml(from || "?")} → ${escapeHtml(to || "?")}`;
}

function loudnessWord(flight, t) {
  if (flight.loudness >= 60) return t("loud");
  if (flight.loudness >= 48) return t("clear");
  return t("faint");
}

function positionLabel(flight, t) {
  if (flight.elevation >= 80) return t("overhead");
  return `${compassName(flight.bearing, t)} ${Math.round(flight.elevation)}°`;
}

/* The fixed layout the popup always shows: what it is, where to point your
 * face, where it came from and where it is going, and the numbers. */
function detailMarkup(flight, ctx) {
  const t = ctx.t;
  const imperial = ctx.imperial;
  const altUnit = ctx.altitudeUnit;

  const vertical = flight.verticalMs;
  let climbLabel = t("level");
  let climbIcon = "";
  let climbValue = "—";
  if (vertical !== null && Math.abs(vertical) > 0.5) {
    const climbing = vertical > 0;
    climbLabel = t(climbing ? "climb" : "descend");
    climbIcon = svgIcon(climbing ? ICONS.up : ICONS.down, 13);
    climbValue =
      altUnit === "ft"
        ? `${Math.round((Math.abs(vertical) * 60) / FEET_TO_M / 100) * 100} ft/min`
        : `${Math.round((Math.abs(vertical) * 60) / 10) * 10} m/min`;
  }

  const verdictClass = flight.visible ? "ok" : flight.audible ? "heard" : "no";
  let verdictText = t(flight.verdict);
  if (flight.visible) {
    verdictText = `${t("verdict_visible")} · ${flight.spotScore > 0.55 ? t("clear") : t("faint")}`;
  } else if (flight.reason === "reason_low") {
    verdictText = `${t("verdict_low")} · ${t("reason_low", { n: Math.round(flight.elevation) })}`;
  } else if (flight.reason === "reason_far") {
    verdictText = `${t("verdict_far")} · ${t("reason_far", { n: formatDistance(flight.slantM, imperial) })}`;
  }

  const soundRow = flight.audible
    ? `<div class="sound">${svgIcon(ICONS.sound, 14)}<span>${Math.round(flight.loudness)} dB, ${loudnessWord(flight, t)} · ${t("sound_delay", { n: formatSeconds(flight.soundDelay) })}</span></div>`
    : "";

  // Only http(s) images, so a hostile feed cannot smuggle a javascript: or
  // data: URL into a style attribute.
  const photoUrl = /^https?:\/\/[^"')\s]+$/.test(String(flight.photo || ""))
    ? flight.photo
    : null;
  const photo = photoUrl
    ? `<div class="photo" style="background-image:url('${escapeHtml(photoUrl)}')"></div>`
    : "";

  // The list is where the three-letter codes belong; here there is room to
  // say which airport that is. The city is a fallback for a feed that named
  // one and not the other, and an addition when the name does not carry it --
  // "Heathrow" reads better as London's than on its own.
  const originPlace = escapeHtml(placeName(flight.origin));
  const destPlace = escapeHtml(placeName(flight.destination));

  const arrowAngle = flight.bearing;

  return `
    ${photo}
    <div class="dhead">
      <div class="dtitle">${escapeHtml(flight.callsign || t("unknown"))}</div>
      <div class="dsub">${[flight.airlineName, flight.model || flight.code, flight.registration]
        .filter(Boolean)
        .map(escapeHtml)
        .join(" · ")}</div>
    </div>

    <div class="look">
      <svg class="compass" viewBox="-50 -50 100 100">
        <circle r="42" class="c-ring"></circle>
        <text y="-32" class="c-card">${t("cardinals")[0]}</text>
        <g transform="rotate(${arrowAngle.toFixed(0)})">
          <path class="c-arrow" d="M0,-40 L9,10 L0,2 L-9,10 Z"></path>
        </g>
      </svg>
      <div class="looktext">
        <div class="lbig">${compassName(flight.bearing, t)} · ${Math.round(flight.elevation)}°</div>
        <div class="lsmall">${
          flight.elevation >= 80
            ? t("straight_up")
            : `${t("look")} ${Math.round(flight.elevation)}° ${t("above_horizon")}`
        }</div>
      </div>
    </div>

    <div class="route">
      <div class="port"><b>${escapeHtml(flight.origin.iata || "–")}</b><span>${originPlace}</span></div>
      <div class="leg">${svgIcon(ICONS.plane, 16)}</div>
      <div class="port right"><b>${escapeHtml(flight.destination.iata || "–")}</b><span>${destPlace}</span></div>
    </div>

    <div class="stats">
      <div class="stat"><span>${t("altitude")}</span><b>${formatAltitude(flight.altitudeM, altUnit)}</b></div>
      <div class="stat"><span>${t("distance")}</span><b>${formatDistance(flight.groundM, imperial)}</b></div>
      <div class="stat"><span>${t("slant")}</span><b>${formatDistance(flight.slantM, imperial)}</b></div>
      <div class="stat"><span>${t("speed")}</span><b>${formatSpeed(flight.groundSpeed, imperial)}</b></div>
      <div class="stat"><span>${t("heading")}</span><b>${Math.round(flight.heading)}°</b></div>
      <div class="stat"><span>${climbLabel}</span><b>${climbIcon}${climbValue}</b></div>
    </div>

    <div class="verdict ${verdictClass}">${verdictText}</div>
    ${soundRow}
  `;
}

function listMarkup(flights, ctx) {
  const t = ctx.t;
  let html = "";
  for (const flight of flights) {
    const flags =
      (flight.visible ? `<i class="f-eye">${svgIcon(ICONS.eye, 13)}</i>` : "") +
      (flight.audible ? `<i class="f-ear">${svgIcon(ICONS.sound, 13)}</i>` : "");
    html += `
      <button class="row${flight.visible ? "" : " heard"}" data-key="${escapeHtml(flight.key)}" type="button">
        <span class="dot" style="background:${altitudeColour(flight.altitudeM)}"></span>
        <span class="main">
          <span class="cs">${escapeHtml(flight.callsign || "—")}</span>
          <span class="rt">${routeLine(flight)}</span>
        </span>
        <span class="pos">${positionLabel(flight, t)}</span>
        <span class="alt">${formatAltitude(flight.altitudeM, ctx.altitudeUnit)}</span>
        <span class="flags">${flags}</span>
      </button>`;
  }
  return html;
}

/* --------------------------------------------------------------- the card */

class SkywatchCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = null;
    this._hass = null;
    this._built = false;
    this._flights = [];
    this._history = {};
    this._selected = null;
    this._dialog = null;
    this._ticker = null;
    this._lastAutoPopup = 0;
    this._previouslyVisible = {};
    this._els = {};
  }

  static getStubConfig(hass) {
    const entities = [];
    const states = (hass && hass.states) || {};
    for (const id of Object.keys(states)) {
      if (id.indexOf("sensor.") !== 0) continue;
      if (Array.isArray(attrsOf(states[id]).flights)) entities.push(id);
    }
    return { entities: entities.slice(0, 2) };
  }

  static getConfigElement() {
    return document.createElement("skywatch-card-editor");
  }

  /* Anything thrown from here is what Home Assistant turns into the grey
   * "Configuration error" tile in place of the card, so this has to cope with
   * whatever is in the YAML rather than trust it. A single entity written
   * without a list, or a `null` left behind by the editor, is a mistake worth
   * surviving; only a config that names no usable sensor at all is worth
   * refusing over. */
  setConfig(config) {
    const given = config.entities;
    const listed = given === undefined || given === null ? [] : [].concat(given);
    const entities = listed
      .map((item) => (typeof item === "string" ? item : item && (item.entity || item.entity_id)))
      .filter((id) => typeof id === "string" && id.length > 0);

    this._config = { ...DEFAULTS, ...config, entities };
    this._built = false;
    this._history = {};
    // Emptying the shadow root detaches everything `_els` names and the map's
    // own root, so drop the references with the nodes. The map has to be told:
    // it is holding a ResizeObserver, or a window resize listener on the older
    // WebViews, that nothing else will take back.
    if (this._map) {
      this._map.destroy();
      this._map = null;
    }
    this._els = {};
    this.shadowRoot.innerHTML = "";
    /* Building reads the live state, so it can fail for reasons that have
     * nothing to do with the configuration. Reporting that as a configuration
     * error sends people to edit YAML that was never wrong; leave the card
     * unbuilt instead and let the next state update try again.
     *
     * Home Assistant sets the config before it sets `hass`, so on a fresh card
     * this branch is skipped and the first build happens in the setter below.
     * That is the one that has to hold. */
    if (this._hass) {
      try {
        this._build();
      } catch (err) {
        console.error("skywatch-card: could not build the card", err);
        this._built = false;
      }
    }
  }

  /*
   * The card's real entry point, and the one that has to survive anything.
   *
   * Home Assistant calls this for every state change in the system, and it
   * wraps the call: whatever escapes is caught in `hui-card`, which throws the
   * card away and puts its grey "Configuration error" tile there instead. That
   * tile is worse than it looks. The replacement has no `hass` property, so
   * every later state update lands on nothing, and the card stays gone until
   * the page is reloaded -- one unlucky update, and the dashboard is dead for
   * the rest of the session.
   *
   * Almost nothing that can fail in here is a configuration problem: it is a
   * feed that sent a shape we did not expect, or a browser missing something
   * the code assumed. Log it, throw the half-built DOM away, and let the next
   * update -- two seconds later at worst -- try again.
   */
  set hass(hass) {
    // Outside the try: a failed render must not also cost us the newest state.
    this._hass = hass;
    if (!this._config) return;
    try {
      if (!this._built) this._build();
      this._refresh(true);
    } catch (err) {
      console.error("skywatch-card: could not update the card", err);
      // `_build` starts by emptying the shadow root, so a rebuild discards a
      // half-built card rather than adding to it.
      this._built = false;
    }
  }

  getCardSize() {
    if (this._config && this._config.layout === "full") return 6;
    return 2;
  }

  connectedCallback() {
    this._startTicker();
  }

  disconnectedCallback() {
    this._stopTicker();
    if (this._map) this._map.destroy();
    if (this._dialog) this._dialog.close();
  }

  _startTicker() {
    if (this._ticker || !this._config) return;
    // Dead reckoning only needs a couple of frames a second at walking pace;
    // two seconds keeps the map alive without waking the tab constantly.
    // Nothing catches a throw from a timer, so it would repeat every two
    // seconds forever with only the console to show for it.
    this._ticker = window.setInterval(() => {
      try {
        this._refresh(false);
      } catch (err) {
        console.error("skywatch-card: could not move the aircraft on", err);
        this._built = false;
      }
    }, 2000);
  }

  _stopTicker() {
    if (this._ticker) {
      clearInterval(this._ticker);
      this._ticker = null;
    }
  }

  /* ------------------------------------------------------------- context */

  _sources() {
    const configured = this._config.entities;
    if (configured.length) return configured;
    // Nothing configured: take whatever Flightradar24 sensor is publishing a
    // list of flights, which is the common case of one integration entry.
    const found = [];
    const states = this._hass.states;
    for (const id of Object.keys(states)) {
      if (id.indexOf("sensor.") !== 0) continue;
      if (Array.isArray(attrsOf(states[id]).flights)) found.push(id);
    }
    return found;
  }

  _home() {
    const config = this._config;
    const hassConfig = (this._hass && this._hass.config) || {};
    return {
      lat: config.latitude === null ? hassConfig.latitude : config.latitude,
      lon: config.longitude === null ? hassConfig.longitude : config.longitude,
      elevation:
        config.elevation === null
          ? num(hassConfig.elevation) || 0
          : num(config.elevation) || 0,
    };
  }

  _imperial() {
    const config = this._config;
    if (config.units === "imperial") return true;
    if (config.units === "metric") return false;
    const system = (this._hass.config && this._hass.config.unit_system) || {};
    return system.length === "mi";
  }

  /* Rings a quarter, a half and all of the way out to the furthest you can
   * make anything out: a scale in the units the card thinks in. */
  _rings() {
    if (!this._config.map_rings) return null;
    const max = this._config.max_range;
    const values = [Math.round(max / 4), Math.round(max / 2), Math.round(max)];
    return values.filter((km, index) => km > 0 && values.indexOf(km) === index);
  }

  _darkMode() {
    const mode = this._config.map_theme;
    if (mode === "dark") return true;
    if (mode === "light") return false;
    return !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
  }

  _makeMap(onSelect) {
    const config = this._config;
    const ctx = this._context();
    const map = new MapView({
      home: this._home(),
      format: (metres) => formatDistance(metres, ctx.imperial),
      rings: this._rings(),
      minSpan: Math.max(6, config.max_range / 2),
      tiles: config.map_tiles,
      labels: config.show_labels,
      history: (key) => (config.show_trails ? this._history[key] : null),
      onSelect,
    });
    map.setDark(this._darkMode());
    return map;
  }

  _context() {
    const lang = pickLanguage(this._config.language, this._hass);
    const imperial = this._imperial();
    let altitudeUnit = this._config.altitude_display;
    if (altitudeUnit === "auto") altitudeUnit = imperial ? "ft" : "m";
    return {
      t: translator(lang),
      imperial,
      altitudeUnit,
      config: this._config,
    };
  }

  /* ------------------------------------------------------------ the maths */

  _collect() {
    const config = this._config;
    const home = this._home();
    if (home.lat === undefined || home.lat === null) return [];

    const env = readEnvironment(this._hass, config);
    this._env = env;

    const now = Date.now();
    const results = [];
    const seenKeys = {};

    for (const entityId of this._sources()) {
      const stateObj = this._hass.states[entityId];
      if (!stateObj) continue;
      const attrs = attrsOf(stateObj);
      const stamp = attrs.last_updated || stateObj.last_updated;
      const parsed = stamp ? Date.parse(stamp) : NaN;
      const age = isFinite(parsed) ? Math.max(0, (now - parsed) / 1000) : 0;

      for (const raw of extractFlights(stateObj)) {
        const flight = evaluateFlight(raw, { config, home, env, age });
        if (!flight) continue;
        // The same aircraft can sit in both the in-area and tracked sensors.
        if (seenKeys[flight.key]) continue;
        seenKeys[flight.key] = true;
        results.push(flight);
      }
    }

    const keep = results.filter((f) => f.visible || (config.audible && f.audible));

    // Overhead and easy to spot first; that is the order you want to read
    // when you are standing in the garden with the tablet.
    keep.sort((a, b) => {
      if (a.visible !== b.visible) return a.visible ? -1 : 1;
      return b.spotScore - a.spotScore || a.slantM - b.slantM;
    });

    this._recordHistory(keep, now);
    return keep;
  }

  _recordHistory(flights, now) {
    if (!this._config.show_trails) return;
    const window_ms = this._config.trail_minutes * 60000;
    const live = {};

    for (const flight of flights) {
      live[flight.key] = true;
      let samples = this._history[flight.key];
      if (!samples) {
        samples = [];
        this._history[flight.key] = samples;
      }
      const last = samples.length ? samples[samples.length - 1] : null;
      if (!last || now - last.time > 4000) {
        samples.push({ time: now, lat: flight.lat, lon: flight.lon });
      } else {
        // Refresh the head so the trail follows the extrapolated position.
        last.lat = flight.lat;
        last.lon = flight.lon;
      }
      while (samples.length && now - samples[0].time > window_ms) samples.shift();
      if (samples.length > 120) samples.splice(0, samples.length - 120);
    }

    for (const key of Object.keys(this._history)) {
      if (!live[key]) delete this._history[key];
    }
  }

  /* --------------------------------------------------------------- build */

  _build() {
    const config = this._config;
    const root = this.shadowRoot;
    if (this._map) {
      this._map.destroy();
      this._map = null;
    }
    root.innerHTML = "";

    const style = document.createElement("style");
    style.textContent = this._css();
    root.appendChild(style);

    const card = document.createElement("ha-card");
    card.className = `card${config.layout === "full" ? " full" : ""}`;
    card.innerHTML = `
      <div class="summary">
        <div class="count"><span class="n">0</span></div>
        <div class="meta">
          <div class="headline"></div>
          <div class="sub"></div>
        </div>
      </div>
      <div class="expanded">
        <div class="mapwrap"></div>
        <div class="list"></div>
      </div>
    `;
    root.appendChild(card);

    this._els = {
      card,
      summary: card.querySelector(".summary"),
      count: card.querySelector(".n"),
      headline: card.querySelector(".headline"),
      sub: card.querySelector(".sub"),
      expanded: card.querySelector(".expanded"),
      mapwrap: card.querySelector(".mapwrap"),
      list: card.querySelector(".list"),
    };

    if (config.layout === "full" && config.show_map) {
      this._map = this._makeMap((key) => this._openPopup(key));
      this._els.mapwrap.appendChild(this._map.element);
      this._els.mapwrap.style.height = `${config.map_height}px`;
    } else {
      this._els.mapwrap.style.display = "none";
    }

    if (config.layout !== "full" || !config.show_list) {
      this._els.list.style.display = "none";
    }

    this._els.summary.addEventListener("click", () => this._handleTap());
    this._els.list.addEventListener("click", (ev) => {
      const row = ev.target && ev.target.closest ? ev.target.closest(".row") : null;
      if (row) this._openPopup(row.getAttribute("data-key"));
    });

    this._built = true;
    this._startTicker();
  }

  /* -------------------------------------------------------------- refresh */

  _refresh(fromState) {
    if (!this._built || !this._hass) return;
    this._flights = this._collect();
    this._render();
    if (this._dialog && this._dialog.isOpen) this._pushDialog();
    if (fromState) this._maybeAutoPopup();
  }

  _render() {
    // The popup's close and select handlers come straight here, and one of
    // them fires from `disconnectedCallback`, by which point there is no card
    // left to draw into. `_refresh` guards; these have to as well.
    if (!this._built || !this._hass) return;
    const config = this._config;
    const ctx = this._context();
    const t = ctx.t;
    const visible = this._flights.filter((f) => f.visible);
    const audibleOnly = this._flights.filter((f) => !f.visible && f.audible);

    const count = visible.length;
    this._els.count.textContent = String(count);
    this._els.card.classList.toggle("empty", this._flights.length === 0);

    if (count === 0 && audibleOnly.length === 0) {
      this._els.headline.textContent = config.title || t("nothing");
      this._els.sub.textContent = t("nothing_sub");
    } else {
      this._els.headline.textContent = config.title || t("in_sight");
      const parts = [];
      if (visible.length) {
        const lead = visible[0];
        parts.push(`${lead.callsign || ""} ${positionLabel(lead, t)}`.trim());
      }
      if (audibleOnly.length) parts.push(`${audibleOnly.length} ${t("audible")}`);
      if (this._env && this._env.night) parts.push(t("night"));
      this._els.sub.textContent = parts.join(" · ");
    }

    if (this._map) this._map.update(this._flights, this._selected);

    if (config.layout === "full" && config.show_list) {
      const shown = this._flights.slice(0, config.max_list);
      this._els.list.innerHTML = listMarkup(shown, ctx);
    }
  }

  /* ---------------------------------------------------------------- popup */

  _handleTap() {
    const action = this._config.tap_action || { action: "popup" };
    switch (action.action) {
      case "popup":
        this._openPopup(this._flights.length ? this._flights[0].key : null);
        break;
      case "navigate":
        if (action.navigation_path) {
          history.pushState(null, "", action.navigation_path);
          fireEvent(window, "location-changed", { replace: false });
        }
        break;
      case "url":
        if (action.url_path) window.open(action.url_path);
        break;
      case "more-info":
        fireEvent(this, "hass-more-info", {
          entityId: action.entity || this._sources()[0],
        });
        break;
      case "none":
      default:
        break;
    }
  }

  _ensureDialog() {
    if (!this._dialog) {
      this._dialog = document.createElement("skywatch-dialog");
      document.body.appendChild(this._dialog);
      this._dialog.addEventListener("skywatch-closed", () => {
        this._selected = null;
        this._render();
      });
      this._dialog.addEventListener("skywatch-selected", (ev) => {
        this._selected = ev.detail.key;
        this._render();
      });
    }
    return this._dialog;
  }

  _openPopup(key, automatic) {
    const dialog = this._ensureDialog();
    this._selected = key;
    this._pushDialog();
    dialog.open(!!automatic);
  }

  _pushDialog() {
    if (!this._dialog) return;
    this._dialog.data = {
      flights: this._flights,
      ctx: this._context(),
      selected: this._selected,
      night: this._env && this._env.night,
      env: this._env,
      makeMap: (onSelect) => this._makeMap(onSelect),
      config: this._config,
    };
  }

  /* A wall tablet in the hallway should be able to raise the popup by itself
   * when something worth walking outside for turns up. */
  _maybeAutoPopup() {
    const config = this._config;
    if (config.auto_popup === "never") return;
    if (document.hidden) return;
    if (this._dialog && this._dialog.isOpen) return;

    const now = Date.now();
    if (now - this._lastAutoPopup < 120000) return;

    let trigger = null;
    const nowVisible = {};
    for (const flight of this._flights) {
      if (!flight.visible) continue;
      nowVisible[flight.key] = true;
      if (config.auto_popup === "visible" && !this._previouslyVisible[flight.key]) {
        trigger = flight;
      }
      if (config.auto_popup === "overhead" && flight.elevation >= config.auto_popup_elevation) {
        if (!trigger || flight.elevation > trigger.elevation) trigger = flight;
      }
    }
    this._previouslyVisible = nowVisible;

    if (!trigger) return;
    this._lastAutoPopup = now;
    this._openPopup(trigger.key, true);
    if (config.auto_popup_seconds > 0) {
      // Only close what opened by itself: if you took over in the meantime,
      // the dialog is yours and stays put.
      window.setTimeout(() => {
        if (this._dialog && this._dialog.isOpen && this._dialog.wasAutomatic) {
          this._dialog.close();
        }
      }, config.auto_popup_seconds * 1000);
    }
  }

  /* ------------------------------------------------------------------ css */

  _css() {
    const c = this._config;
    return `
      :host { display: block; }
      .card {
        position: relative;
        overflow: hidden;
        border-radius: ${c.radius}px;
        --accent: ${c.accent};
      }

      .summary {
        display: flex;
        align-items: center;
        padding: 14px 16px;
        cursor: ${c.tap_action && c.tap_action.action === "none" ? "default" : "pointer"};
      }
      .count {
        font-size: 34px;
        font-weight: 600;
        line-height: 1;
        letter-spacing: -0.02em;
        min-width: 40px;
        color: var(--accent);
      }
      .card.empty .count { color: var(--secondary-text-color); opacity: 0.5; }
      .meta { flex: 1 1 auto; min-width: 0; margin-left: 14px; }
      .headline {
        font-size: 15px;
        font-weight: 500;
        line-height: 1.2;
      }
      .sub {
        margin-top: 3px;
        font-size: 12px;
        line-height: 1.3;
        color: var(--secondary-text-color);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .expanded { display: ${c.layout === "full" ? "block" : "none"}; }
      .mapwrap {
        position: relative;
        margin: 0 12px 8px 12px;
        border-radius: 14px;
        overflow: hidden;
        box-sizing: border-box;
      }

      ${MAP_CSS}
      ${LIST_CSS}
    `;
  }
}

/* Shared by the card and the popup: both draw the same map. */
const MAP_CSS = `
  .map {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: #e8eaed;
    touch-action: none;
    cursor: grab;
  }
  .map.dark { background: #1a1d21; }
  .map:active { cursor: grabbing; }

  .tiles {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
  }
  .tile {
    position: absolute;
    top: 0;
    left: 0;
    width: 256px;
    height: 256px;
    -webkit-user-select: none;
    user-select: none;
    -webkit-user-drag: none;
    pointer-events: none;
  }
  .tile.failed { display: none; }

  .overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
  }

  .map .ring {
    fill: none;
    stroke: rgba(20, 40, 70, 0.22);
    stroke-width: 1;
    stroke-dasharray: 4 4;
  }
  .map.dark .ring { stroke: rgba(255, 255, 255, 0.22); }
  .map .ring-label {
    font-size: 9px;
    font-family: inherit;
    text-anchor: middle;
    fill: rgba(20, 40, 70, 0.55);
    paint-order: stroke;
    stroke: rgba(255, 255, 255, 0.8);
    stroke-width: 2.5;
  }
  .map.dark .ring-label {
    fill: rgba(255, 255, 255, 0.5);
    stroke: rgba(0, 0, 0, 0.6);
  }

  .home-dot {
    fill: var(--sw-accent, #7cc4ff);
    stroke: #fff;
    stroke-width: 2;
  }
  .map.dark .home-dot { stroke: #1a1d21; }

  .marker { cursor: pointer; }
  .marker .glyph {
    stroke: rgba(0, 0, 0, 0.5);
    stroke-width: 1;
    stroke-linejoin: round;
  }
  .marker .halo { fill: none; stroke: none; }
  .marker.heard .halo {
    stroke: rgba(120, 120, 120, 0.8);
    stroke-width: 1;
    stroke-dasharray: 3 3;
  }
  .marker.heard .glyph { opacity: 0.55; }
  .marker.selected .halo {
    fill: rgba(124, 196, 255, 0.22);
    stroke: var(--sw-accent, #7cc4ff);
    stroke-width: 2;
    stroke-dasharray: none;
  }
  .marker .tag {
    font-size: 10px;
    font-weight: 600;
    font-family: inherit;
    text-anchor: middle;
    fill: #16283f;
    paint-order: stroke;
    stroke: rgba(255, 255, 255, 0.85);
    stroke-width: 3;
  }
  .map.dark .marker .tag { fill: #eaf1f8; stroke: rgba(0, 0, 0, 0.7); }

  .trail {
    fill: none;
    stroke-width: 2;
    opacity: 0.5;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .ghost {
    fill: none;
    stroke: rgba(90, 90, 90, 0.8);
    stroke-width: 1.4;
    stroke-dasharray: 2 3;
    animation: sw-pulse 2.4s ease-in-out infinite;
  }
  .map.dark .ghost { stroke: rgba(255, 255, 255, 0.7); }
  @keyframes sw-pulse {
    0%, 100% { opacity: 0.25; }
    50% { opacity: 0.85; }
  }
  @media (prefers-reduced-motion: reduce) {
    .ghost { animation: none; opacity: 0.5; }
  }

  .controls {
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 2;
  }
  .controls button {
    display: block;
    width: 28px;
    height: 28px;
    margin-bottom: 4px;
    padding: 0;
    border: 0;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.92);
    color: #26323f;
    font-size: 16px;
    line-height: 28px;
    cursor: pointer;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
  }
  .map.dark .controls button { background: rgba(30, 35, 42, 0.92); color: #e6edf3; }
  .controls button:hover { filter: brightness(0.94); }

  .attrib {
    position: absolute;
    right: 4px;
    bottom: 2px;
    z-index: 2;
    font-size: 9px;
    color: rgba(20, 30, 45, 0.6);
    background: rgba(255, 255, 255, 0.6);
    border-radius: 4px;
    padding: 0 4px;
    pointer-events: none;
  }
  .map.dark .attrib { color: rgba(255, 255, 255, 0.55); background: rgba(0, 0, 0, 0.4); }
`;

const LIST_CSS = `
  .list { padding: 0 8px 8px 8px; }
  .row {
    display: flex;
    align-items: center;
    width: 100%;
    box-sizing: border-box;
    padding: 8px 8px;
    border: 0;
    border-radius: 10px;
    background: none;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .row:hover { background: rgba(127, 127, 127, 0.12); }
  .row.heard { opacity: 0.62; }
  .row .dot {
    flex: 0 0 auto;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    margin-right: 10px;
  }
  .row .main { flex: 1 1 auto; min-width: 0; }
  .row .cs { font-size: 13px; font-weight: 600; display: block; }
  .row .rt {
    font-size: 11px;
    color: var(--secondary-text-color);
    display: block;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .row .pos {
    flex: 0 0 auto;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    margin-left: 8px;
    white-space: nowrap;
  }
  .row .alt {
    flex: 0 0 auto;
    font-size: 11px;
    color: var(--secondary-text-color);
    font-variant-numeric: tabular-nums;
    margin-left: 10px;
    white-space: nowrap;
  }
  .row .flags { flex: 0 0 auto; margin-left: 8px; white-space: nowrap; }
  .row .flags i { display: inline-block; vertical-align: middle; margin-left: 2px; }
  .row .flags svg { fill: currentColor; display: block; }
  .row .f-eye { color: var(--accent, #7cc4ff); }
  .row .f-ear { color: var(--secondary-text-color); }
`;

/* ------------------------------------------------------------- the popup */

/*
 * Lives on document.body rather than inside the card, so it is not clipped by
 * a dashboard column and does not inherit a transform that would break
 * position: fixed. The layout is deliberately the same every time: map and
 * list on top, one aircraft in detail underneath. You learn where everything
 * sits once, and after that you only glance at it.
 */
class SkywatchDialog extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._data = null;
    this._map = null;
    this.isOpen = false;
    this.wasAutomatic = false;
    this._onKey = (ev) => {
      if (ev.key === "Escape" || ev.key === "Esc") this.close();
    };
    this._render();
  }

  set data(value) {
    this._data = value;
    this._update();
  }

  open(automatic) {
    this.wasAutomatic = !!automatic;
    if (this.isOpen) return;
    this.isOpen = true;
    this.classList.add("open");
    document.addEventListener("keydown", this._onKey);
    this._update();
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.wasAutomatic = false;
    this.classList.remove("open");
    document.removeEventListener("keydown", this._onKey);
    fireEvent(this, "skywatch-closed");
  }

  _render() {
    this.shadowRoot.innerHTML = `
      <style>${DIALOG_CSS}${MAP_CSS}${LIST_CSS}</style>
      <div class="backdrop"></div>
      <div class="sheet" role="dialog" aria-modal="true">
        <div class="head">
          <div class="htext">
            <div class="htitle"></div>
            <div class="hsub"></div>
          </div>
          <button class="close" type="button" aria-label="close">
            ${svgIcon(ICONS.close, 22)}
          </button>
        </div>
        <div class="body">
          <div class="mapwrap"></div>
          <div class="listwrap"><div class="list"></div></div>
        </div>
        <div class="detail"></div>
      </div>
    `;

    this._els = {
      backdrop: this.shadowRoot.querySelector(".backdrop"),
      sheet: this.shadowRoot.querySelector(".sheet"),
      title: this.shadowRoot.querySelector(".htitle"),
      sub: this.shadowRoot.querySelector(".hsub"),
      mapwrap: this.shadowRoot.querySelector(".mapwrap"),
      list: this.shadowRoot.querySelector(".list"),
      detail: this.shadowRoot.querySelector(".detail"),
    };

    this._els.backdrop.addEventListener("click", () => this.close());
    this.shadowRoot
      .querySelector(".close")
      .addEventListener("click", () => this.close());
    this._els.list.addEventListener("click", (ev) => {
      const row = ev.target && ev.target.closest ? ev.target.closest(".row") : null;
      if (row) this._select(row.getAttribute("data-key"));
    });
  }

  _select(key) {
    // Taking over by hand means the auto-close timer no longer applies.
    this.wasAutomatic = false;
    if (this._data) this._data.selected = key;
    fireEvent(this, "skywatch-selected", { key });
    this._update();
  }

  _update() {
    if (!this.isOpen || !this._data) return;
    const data = this._data;
    const ctx = data.ctx;
    const t = ctx.t;
    const flights = data.flights;
    const config = data.config;

    if (!this._map) {
      this._map = data.makeMap((key) => this._select(key));
      this._els.mapwrap.appendChild(this._map.element);
    }

    const visible = flights.filter((f) => f.visible);
    const audibleOnly = flights.filter((f) => !f.visible && f.audible);

    this._els.sheet.style.setProperty("--sw-accent", config.accent || DEFAULTS.accent);
    this._els.title.textContent = config.title || t("title");
    const bits = [`${visible.length} ${t("visible")}`];
    if (audibleOnly.length) bits.push(`${audibleOnly.length} ${t("audible")}`);
    if (data.night) bits.push(t("night"));
    if (data.env && data.env.overcast) {
      bits.push(t("cloudy", { n: formatAltitude(data.env.cloudBase, ctx.altitudeUnit) }));
    }
    this._els.sub.textContent = bits.join(" · ");

    this._map.update(flights, data.selected);

    this._els.list.innerHTML = listMarkup(flights, ctx);

    let selected = null;
    for (const flight of flights) {
      if (flight.key === data.selected) selected = flight;
    }
    if (!selected && flights.length) selected = flights[0];

    if (selected) {
      this._els.detail.innerHTML = detailMarkup(selected, ctx);
      this._els.detail.style.display = "";
    } else {
      this._els.detail.innerHTML = `<div class="none">${t("nothing_sub")}</div>`;
      this._els.detail.style.display = "";
    }
  }
}

const DIALOG_CSS = `
  :host {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    z-index: 9000;
    display: none;
    font-family: var(--paper-font-body1_-_font-family, Roboto, sans-serif);
  }
  :host(.open) { display: block; }

  .backdrop {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    background: rgba(0, 0, 0, 0.55);
    -webkit-backdrop-filter: blur(3px);
    backdrop-filter: blur(3px);
  }

  .sheet {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 92vw;
    max-width: 780px;
    max-height: 90vh;
    overflow-y: auto;
    box-sizing: border-box;
    background: var(--ha-card-background, var(--card-background-color, #fff));
    color: var(--primary-text-color, #212121);
    border-radius: 22px;
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
    animation: sw-rise 220ms ease;
  }
  @keyframes sw-rise {
    from { opacity: 0; transform: translate(-50%, -46%); }
    to { opacity: 1; transform: translate(-50%, -50%); }
  }
  @media (prefers-reduced-motion: reduce) {
    .sheet { animation: none; }
  }

  .head {
    display: flex;
    align-items: flex-start;
    padding: 18px 18px 6px 18px;
  }
  .htext { flex: 1 1 auto; min-width: 0; }
  .htitle { font-size: 18px; font-weight: 600; }
  .hsub {
    margin-top: 2px;
    font-size: 12px;
    color: var(--secondary-text-color);
  }
  .close {
    flex: 0 0 auto;
    border: 0;
    background: none;
    padding: 4px;
    margin-left: 8px;
    cursor: pointer;
    color: var(--secondary-text-color);
    border-radius: 50%;
  }
  .close:hover { background: rgba(127, 127, 127, 0.15); }
  .close svg { fill: currentColor; display: block; }

  /* The map is the picture and the list is the reading, so they stack rather
     than compete for width. */
  .body { padding: 4px 10px 0 10px; }
  .listwrap { max-height: 232px; overflow-y: auto; }
  .mapwrap {
    position: relative;
    height: 300px;
    margin: 6px 8px 10px 8px;
    border-radius: 14px;
    overflow: hidden;
  }
  .listwrap { min-width: 0; }

  .detail {
    border-top: 1px solid rgba(127, 127, 127, 0.22);
    margin-top: 6px;
    padding: 14px 18px 18px 18px;
  }
  .detail .none {
    font-size: 13px;
    color: var(--secondary-text-color);
    text-align: center;
    padding: 12px 0;
  }

  .photo {
    height: 132px;
    border-radius: 14px;
    background-size: cover;
    background-position: center 45%;
    margin-bottom: 12px;
  }

  .dhead { margin-bottom: 12px; }
  .dtitle { font-size: 20px; font-weight: 650; letter-spacing: -0.01em; }
  .dsub { font-size: 12px; color: var(--secondary-text-color); margin-top: 2px; }

  .look { display: flex; align-items: center; margin-bottom: 14px; }
  .compass { width: 68px; height: 68px; flex: 0 0 auto; }
  .compass .c-ring {
    fill: rgba(127, 127, 127, 0.1);
    stroke: rgba(127, 127, 127, 0.35);
    stroke-width: 1.5;
  }
  .compass .c-card {
    font-size: 11px;
    text-anchor: middle;
    fill: var(--secondary-text-color);
  }
  .compass .c-arrow { fill: var(--sw-accent, #7cc4ff); }
  .looktext { margin-left: 14px; min-width: 0; }
  .lbig { font-size: 22px; font-weight: 600; line-height: 1.1; }
  .lsmall { font-size: 12px; color: var(--secondary-text-color); margin-top: 2px; }

  .route {
    display: flex;
    align-items: center;
    padding: 10px 12px;
    border-radius: 12px;
    background: rgba(127, 127, 127, 0.1);
    margin-bottom: 12px;
  }
  .route .port { flex: 1 1 0; min-width: 0; }
  .route .port.right { text-align: right; }
  .route .port b { display: block; font-size: 15px; }
  /* Written-out airport names are long, so they wrap rather than ellipse; a
   * name cut off after "Amsterdam Sch" is no better than the code above it. */
  .route .port span {
    display: block;
    font-size: 11px;
    line-height: 1.3;
    color: var(--secondary-text-color);
    overflow-wrap: break-word;
    word-wrap: break-word;
  }
  .route .leg { flex: 0 0 auto; padding: 0 12px; color: var(--secondary-text-color); }
  .route .leg svg { fill: currentColor; display: block; transform: rotate(90deg); }

  .stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    grid-gap: 10px;
    margin-bottom: 12px;
  }
  .stat {
    padding: 8px 10px;
    border-radius: 10px;
    background: rgba(127, 127, 127, 0.1);
  }
  .stat span {
    display: block;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--secondary-text-color);
  }
  .stat b {
    display: block;
    font-size: 15px;
    font-weight: 600;
    margin-top: 2px;
    font-variant-numeric: tabular-nums;
  }
  .stat b svg { fill: currentColor; vertical-align: -1px; margin-right: 2px; }

  /* The lettering is the theme's own, never --success-color or
   * --warning-color. Those are meant for an icon sitting on the card
   * background, and Home Assistant's default warning is #ffa726: amber
   * letters on an amber tint, which is how "Audible, not visible" came to be
   * a line you could see was there and could not read. A theme is free to set
   * them to anything, so no fallback rescues it either.
   *
   * The colour moves to the bar down the left, where nothing has to be read
   * through it, and both halves then hold up in a dark theme as well -- which
   * cannot be branched on here, @media (prefers-color-scheme) being Chrome 76
   * and Home Assistant's own switch not reaching it in any case. */
  .verdict {
    font-size: 13px;
    font-weight: 600;
    padding: 9px 12px;
    border-radius: 10px;
    border-left: 4px solid transparent;
    padding-left: 10px;
    color: var(--primary-text-color, #212121);
  }
  .verdict.ok { background: rgba(76, 175, 80, 0.16); border-left-color: #4caf50; }
  .verdict.heard { background: rgba(255, 167, 38, 0.18); border-left-color: #ffa726; }
  .verdict.no { background: rgba(127, 127, 127, 0.14); border-left-color: rgba(127, 127, 127, 0.55); }

  .sound {
    display: flex;
    align-items: center;
    margin-top: 8px;
    font-size: 12px;
    color: var(--secondary-text-color);
  }
  .sound svg { fill: currentColor; margin-right: 6px; flex: 0 0 auto; }

  .list { padding: 0; }

  @media (max-width: 620px) {
    .mapwrap { height: 240px; }
    .listwrap { max-height: 180px; }
    .stats { grid-template-columns: repeat(2, 1fr); }
    .photo { height: 104px; }
  }
`;

if (!customElements.get("skywatch-dialog")) {
  customElements.define("skywatch-dialog", SkywatchDialog);
}

/* ------------------------------------------------------------ gui editor */

const EDITOR_SCHEMA = [
  {
    name: "entities",
    selector: { entity: { multiple: true, filter: { domain: "sensor" } } },
  },
  {
    type: "grid",
    name: "",
    schema: [
      {
        name: "layout",
        selector: { select: { mode: "dropdown", options: ["compact", "full"] } },
      },
      {
        name: "language",
        selector: { select: { mode: "dropdown", options: ["auto", "en", "nl"] } },
      },
      {
        name: "min_elevation",
        selector: { number: { min: 0, max: 60, step: 1, mode: "box" } },
      },
      {
        name: "max_range",
        selector: { number: { min: 5, max: 250, step: 5, mode: "box" } },
      },
      {
        name: "noise_threshold",
        selector: { number: { min: 20, max: 70, step: 1, mode: "box" } },
      },
      {
        name: "map_height",
        selector: { number: { min: 140, max: 600, step: 10, mode: "box" } },
      },
    ],
  },
  {
    type: "grid",
    name: "",
    schema: [
      { name: "audible", selector: { boolean: {} } },
      { name: "show_map", selector: { boolean: {} } },
      { name: "show_list", selector: { boolean: {} } },
      { name: "show_trails", selector: { boolean: {} } },
      { name: "show_labels", selector: { boolean: {} } },
      { name: "map_rings", selector: { boolean: {} } },
      { name: "sound_ghost", selector: { boolean: {} } },
      { name: "include_ground", selector: { boolean: {} } },
    ],
  },
  {
    type: "grid",
    name: "",
    schema: [
      {
        name: "auto_popup",
        selector: {
          select: { mode: "dropdown", options: ["never", "visible", "overhead"] },
        },
      },
      {
        name: "auto_popup_elevation",
        selector: { number: { min: 10, max: 89, step: 1, mode: "box" } },
      },
      {
        name: "units",
        selector: { select: { mode: "dropdown", options: ["auto", "metric", "imperial"] } },
      },
      {
        name: "altitude_display",
        selector: { select: { mode: "dropdown", options: ["auto", "m", "ft"] } },
      },
      { name: "weather_entity", selector: { entity: {} } },
      { name: "accent", selector: { text: {} } },
    ],
  },
];

const EDITOR_LABELS = {
  entities: "Flightradar24 sensors",
  layout: "Layout",
  language: "Language",
  min_elevation: "Horizon (degrees up)",
  max_range: "Furthest you can make out (km)",
  noise_threshold: "Hearing threshold (dBA)",
  map_height: "Map height",
  audible: "Include what you can hear",
  show_map: "Map",
  show_list: "Flight list",
  show_trails: "Trails",
  show_labels: "Callsigns on the map",
  map_rings: "Range rings",
  sound_ghost: "Mark where the sound came from",
  include_ground: "Include aircraft on the ground",
  auto_popup: "Open the popup by itself",
  auto_popup_elevation: "Overhead means (degrees)",
  units: "Units",
  altitude_display: "Altitude in",
  weather_entity: "Weather entity (cloud cover)",
  accent: "Accent colour",
};

class SkywatchCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
    this._form = null;
  }

  setConfig(config) {
    this._config = config || {};
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._form) this._form.hass = hass;
  }

  _data() {
    const data = { ...DEFAULTS, ...this._config };
    // The form cannot edit a per-direction horizon; show the average so the
    // number is not misleading, and leave the map itself to YAML.
    if (typeof data.min_elevation === "object" && data.min_elevation) {
      const values = Object.keys(data.min_elevation)
        .map((key) => num(data.min_elevation[key]))
        .filter((value) => value !== null);
      data.min_elevation = values.length
        ? Math.round(values.reduce((a, b) => a + b, 0) / values.length)
        : 10;
    }
    return data;
  }

  _render() {
    if (!this._form) {
      this.shadowRoot.innerHTML = `
        <style>
          .hint {
            margin-top: 12px;
            font-size: 12px;
            line-height: 1.5;
            color: var(--secondary-text-color);
          }
          code { font-size: 11px; }
        </style>
      `;
      this._form = document.createElement("ha-form");
      this._form.schema = EDITOR_SCHEMA;
      this._form.computeLabel = (schema) => EDITOR_LABELS[schema.name] || schema.name;
      this._form.addEventListener("value-changed", (ev) => this._valueChanged(ev));
      this.shadowRoot.appendChild(this._form);

      const hint = document.createElement("div");
      hint.className = "hint";
      hint.innerHTML =
        "Leave the sensors empty to use every Flightradar24 sensor that publishes flights. " +
        "A horizon that differs per direction (<code>min_elevation</code> as a map of compass " +
        "points), <code>tap_action</code> and the observer position are YAML-only.";
      this.shadowRoot.appendChild(hint);
    }
    if (this._hass) this._form.hass = this._hass;
    this._form.data = this._data();
  }

  _valueChanged(ev) {
    ev.stopPropagation();
    const value = { ...ev.detail.value };

    const config = { type: this._config.type || "custom:skywatch-card" };
    for (const key of Object.keys(value)) {
      const item = value[key];
      if (item === undefined || item === null || item === "") continue;
      if (JSON.stringify(item) === JSON.stringify(DEFAULTS[key])) continue;
      config[key] = item;
    }
    // Keep what the form never showed.
    for (const key of ["tap_action", "latitude", "longitude", "elevation", "title", "cloud_base", "source_altitude_unit", "source_speed_unit"]) {
      if (this._config[key] !== undefined) config[key] = this._config[key];
    }
    if (typeof this._config.min_elevation === "object" && this._config.min_elevation) {
      const edited = value.min_elevation;
      const original = this._data().min_elevation;
      // Only overwrite the per-direction map if the number was actually moved.
      if (edited === original) config.min_elevation = this._config.min_elevation;
    }

    this._config = config;
    fireEvent(this, "config-changed", { config });
  }
}

if (!customElements.get("skywatch-card-editor")) {
  customElements.define("skywatch-card-editor", SkywatchCardEditor);
}

/* The card is registered last, after the popup and the editor it reaches for.
 * Registering it is what makes Home Assistant start using it, and a module
 * that stops halfway -- a truncated response on a flaky mobile connection is
 * the realistic way -- would otherwise leave a card whose popup does not
 * exist. Nothing here is constructible until all of its parts are.
 *
 * The integration loads this module for you, and someone upgrading from the
 * card-only days will still have a Lovelace resource pointing at their own
 * copy. Defining a name twice throws and takes the rest of the module down
 * with it, so whoever gets there first wins and the second load is a no-op. */
if (!customElements.get("skywatch-card")) {
  customElements.define("skywatch-card", SkywatchCard);
}

/* ------------------------------------------------------------ card picker */

window.customCards = window.customCards || [];
if (!window.customCards.some((card) => card.type === "skywatch-card")) {
  window.customCards.push({
    type: "skywatch-card",
    name: "Skywatch",
    preview: true,
    documentationURL: "https://github.com/vossov/flightradar",
    description:
      "Flightradar24, filtered by what you can actually see and hear from your garden, on a sky dome.",
  });
}

/* Outside the guard above, deliberately. A leftover Lovelace resource from the
 * card-only days loads a second copy of this file, and whichever copy is
 * parsed first is the one that registers -- so the version the integration
 * ships can be sitting in the browser doing nothing while an old one draws the
 * dashboard. Every copy saying its version is the only way to see that. */
console.info(
  `%c SKYWATCH-CARD %c ${CARD_VERSION} %c${customElements.get("skywatch-card") === SkywatchCard ? "" : " (not in use: another copy registered first)"}`,
  "background:#101014;color:#fff;border-radius:3px 0 0 3px;padding:1px 4px",
  "background:#7cc4ff;color:#101014;border-radius:0 3px 3px 0;padding:1px 4px",
  "color:#d08770",
);

/* --------------------------------------------------------------- exports */

/* Whether an aircraft is in your sky is decided by the handful of functions
 * below, and none of it can be checked by looking at the card -- a wrong
 * curvature term just quietly hides the wrong aeroplanes. They are exported
 * for the test suite; a browser loading this as a module resource ignores
 * exports entirely. */
export {
  CARD_VERSION,
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
  altitudeColour,
  formatDistance,
  formatAltitude,
  formatSeconds,
  compassName,
  placeName,
  airportCity,
  AIRPORT_CITIES,
  translator,
  pickLanguage,
  escapeHtml,
};


