# Skywatch

A Lovelace card for the [Flightradar24 integration][fr24] that filters on what
you can actually see and hear, instead of on distance.

Radius is the wrong question. A 737 sitting on a Schiphol taxiway six
kilometres away is invisible behind the first row of houses and inaudible over
the traffic, while the same aircraft eleven kilometres up and forty away is a
clear white cross in the sky. A helicopter is the other way round: too low to
see over the trees, and loud enough that you go and look anyway.

So the card throws the radius filter away and asks the two questions you have
when you step into the garden:

- **Can I see it?** Elevation angle above *your* horizon, slant range, the
  earth's curvature and atmospheric refraction, and optionally the cloud deck.
- **Can I hear it?** A sound-propagation estimate from the aircraft's size,
  altitude and thrust setting, against how quiet your street is.

Everything that fails both is dropped. What is left gets a count on the
dashboard, a map in the popup, and a line telling you which way to face and how
far up to look.

## What it looks like

On the dashboard: a number and one line of text. Tap it and you get the popup —
map, list, and the selected aircraft in detail with the direction, the angle
above the horizon, the route and the numbers.

## Installation

### Manual

1. Copy `skywatch-card.js` to `/config/www/`.
2. Settings → Dashboards → ⋮ → Resources → **Add resource**
   - URL: `/local/skywatch-card.js`
   - Type: **JavaScript module**
3. Reload the page (hard refresh if the card does not show up).

### HACS (custom repository)

HACS → ⋮ → Custom repositories → add this repository with category
**Dashboard**, then install it. HACS registers the dashboard resource for you
at `/hacsfiles/flightradar/skywatch-card.js`.

If HACS answers *"Repository structure for main is not compliant"*, it looked
at the ref it resolves to — the newest release, or the default branch when
there are no releases — and found no file matching `filename` in `hacs.json`.
Both `hacs.json` and `skywatch-card.js` have to be in the root of *that* ref,
not only on a working branch.

## Quick start

```yaml
type: custom:skywatch-card
```

That is the whole configuration. With no `entities` the card picks up every
Flightradar24 sensor that publishes a `flights` attribute, and it takes your
position and elevation from the Home Assistant settings. It shows up in the
card picker as *Skywatch* and has a GUI editor.

To be explicit about the sources:

```yaml
type: custom:skywatch-card
entities:
  - sensor.flightradar24_current_in_area
  - sensor.flightradar24_additional_tracked
```

The map and the list inline on the dashboard instead of only in the popup:

```yaml
type: custom:skywatch-card
layout: full
map_height: 320
```

## How it decides

### Seeing

The number that matters is the **elevation angle**: how far up from the horizon
you have to look. It follows from the ground distance and the altitude, minus
the amount the earth curves away underneath (`d² / 2R`, with the refraction
correction surveyors use). At fifty kilometres that drop is 174 m, which is why
everything happening at an airport twenty kilometres away is below your horizon
while cruise traffic twice as far away is a third of the way up the sky.

An aircraft counts as visible when it is

- at least `min_elevation` degrees above the horizon (default `10`),
- within `max_range` km of slant range (default `50`, roughly where an airliner
  stops being a dot you can pick out — about five arcminutes across),
- not on the ground, and
- not behind a solid cloud deck, if you have configured a weather entity.

`min_elevation` is the interesting one. Ten degrees is an open garden. Raise it
to 20–25 for a terraced street where the roofline eats the bottom of the sky.
It also takes a map, for a garden with poplars on one side and open polder on
the other:

```yaml
min_elevation:
  N: 8
  E: 12
  S: 35   # the neighbours' trees
  W: 12
```

Give it as many compass points as you like — `N`, `NNE`, `NE` … or plain
degrees — and the card interpolates between them.

### Hearing

Spherical spreading plus atmospheric absorption from a reference level at
300 m, by aircraft class. Cruising traffic is docked 6 dB because it is at a
fraction of takeoff thrust, and anything on the ground is docked 20 dB for the
same reason plus every hedge and house on the way over. If the result clears
`noise_threshold` (default 40 dBA, a quiet suburban street) the aircraft stays
on the card even when you cannot see it, marked with a speaker icon.

Lower the threshold to 30 if you live somewhere genuinely quiet and want to
catch high traffic; raise it to 50 if you only care about what makes you look
up.

Because sound is slow, the popup also tells you how far behind the aircraft the
noise is running, and the map marks the spot the sound you are hearing right
now was actually emitted from — for a low airliner that is a couple of
kilometres back down the flight path.

### What the card does not know

It has no terrain model, no building heights, and no idea whether you are
looking through a window. `min_elevation` is the knob that stands in for all of
it. The loudness figure is an estimate from published noise-certification
ballparks and an aircraft-type lookup, not a measurement: treat it as "loud
enough to notice" versus "not", not as a dB reading.

## Options

### Sources and position

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `entities` | list | *(auto)* | Flightradar24 sensors to read. Empty means every sensor that publishes `flights`. |
| `latitude` / `longitude` | number | *(HA settings)* | Where you are standing, if not the home zone. |
| `elevation` | number | *(HA settings)* | Your height above sea level in metres. A rooftop terrace is worth setting. |
| `source_altitude_unit` | `ft` \| `m` | `ft` | The unit the integration reports altitude in. |
| `source_speed_unit` | `kt` \| `kmh` \| `mph` \| `ms` | `kt` | Same for ground speed. |

### What counts as visible

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `min_elevation` | number \| map | `10` | Degrees above the horizon. A map of compass points for an uneven skyline. |
| `max_range` | number | `50` | Furthest you can make something out, in km of slant range. |
| `include_ground` | boolean | `false` | Keep aircraft on the ground. |
| `weather_entity` | entity | – | Weather entity with `cloud_coverage`, to hide what is above the cloud deck. |
| `cloud_cover_threshold` | number | `90` | Percent cover that counts as overcast. |
| `cloud_base` | number \| entity | `1500` | Cloud base in metres, or a sensor that reports it. |
| `sun_entity` | entity | `sun.sun` | Used to know it is dark. |

### What counts as audible

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `audible` | boolean | `true` | Include what you can hear but not see. |
| `noise_threshold` | number | `40` | dBA at your ear that counts as audible. |
| `sound_ghost` | boolean | `true` | Mark where the sound you hear now came from. |

### Layout

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `layout` | `compact` \| `full` | `compact` | `compact` is the count and one line; `full` puts the map and list on the dashboard too. |
| `title` | string | – | Replaces the headline. |
| `map_height` | number | `300` | Map height in pixels. |
| `show_map` | boolean | `true` | The map in the `full` layout. |
| `show_list` | boolean | `true` | The flight list. |
| `max_list` | number | `6` | Rows in the inline list. The popup shows everything. |
| `show_labels` | boolean | `true` | Callsigns next to the markers. |
| `show_trails` | boolean | `true` | Where each aircraft came from. |
| `trail_minutes` | number | `6` | How much trail to keep. |
| `map_rings` | boolean | `true` | Range rings at a quarter, a half and all of `max_range`. |
| `accent` | string | `#7cc4ff` | Colour of the count, the home marker and the compass needle. |
| `radius` | number | `18` | Card corner radius. |

### Units and language

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `language` | `auto` \| `en` \| `nl` | `auto` | Follows Home Assistant when `auto`. |
| `units` | `auto` \| `metric` \| `imperial` | `auto` | Distances and speeds. |
| `altitude_display` | `auto` \| `m` \| `ft` | `auto` | Altitudes specifically — aviation people usually want `ft`. |

### Behaviour

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `tap_action` | action | `popup` | `popup`, `more-info`, `navigate`, `url` or `none`. |
| `auto_popup` | `never` \| `visible` \| `overhead` | `never` | Let the popup open by itself. |
| `auto_popup_elevation` | number | `60` | What `overhead` means, in degrees. |
| `auto_popup_seconds` | number | `30` | How long before it closes itself again. |
| `extrapolate` | boolean | `true` | Move aircraft along their heading between polls. |

`auto_popup` is for a wall tablet: `overhead` raises the popup when something
climbs past 60° — the aircraft you would actually walk outside for. It closes
itself again unless you touch it, and it will not fire more than once every two
minutes.

## The map

The basemap is the same CARTO raster tile set Home Assistant's own map card
uses, so a dashboard that already shows a map is not talking to anywhere new.
It is still a third party that sees roughly where you live, and it needs the
browser to reach the internet.

```yaml
map_tiles: none                                        # rings and markers only
map_tiles: "https://tiles.example.lan/{z}/{x}/{y}.png" # your own tile server
map_theme: dark                                        # auto | light | dark
```

With `map_tiles: none` the range rings carry the scale and the card works
offline. Drag to pan, scroll to zoom, and the ⌖ button goes back to framing
your house and everything above it.

## Recipes

A quiet village, an open garden, and an interest in high traffic:

```yaml
type: custom:skywatch-card
min_elevation: 6
max_range: 70
noise_threshold: 32
```

A terraced street where only what is nearly overhead is worth the trip
outside, on a hallway tablet:

```yaml
type: custom:skywatch-card
min_elevation: 25
auto_popup: overhead
auto_popup_elevation: 55
```

Helicopters and low traffic only — drop anything at cruise:

```yaml
type: custom:skywatch-card
max_range: 25
min_elevation: 5
noise_threshold: 45
```

## Browser support

The card is loaded as an ES module and is not bundled or transpiled, so the
source is what the browser parses. It targets **Chrome 61 and up**, which is
where ES modules land, to stay usable in the older Android WebViews that the
Home Assistant companion app runs on.

That rules out a few things that are otherwise ordinary: optional chaining and
`??` (Chrome 80) are a *parse* error, which kills the whole module and stops
the custom element from ever registering; flexbox `gap` (Chrome 84) and the
`inset` shorthand (Chrome 87) are silently dropped and wreck the layout. CI
parses the file at ES2018 and greps for those properties on every push, because
a rendering test in a current headless Chrome cannot catch any of it.

`ResizeObserver` (Chrome 64) is used where available and falls back to a window
resize listener.

## Development

```
node --test test/model.test.mjs
```

The geometry and the sound model are the part that cannot be eyeballed — a
wrong curvature term just quietly hides the wrong aeroplanes — so they are
covered by tests against cases you can check by walking outside.

`test/preview.html` renders the card against a fixed set of flights without a
Home Assistant: one cruising overhead, one climbing out of Schiphol that you
can only hear, a helicopter low to the east, and an aircraft on a taxiway that
should be filtered out.

```
python3 -m http.server 8080   ->   localhost:8080/test/preview.html
```

### Releasing

Bump `CARD_VERSION` in `skywatch-card.js`, then push a matching tag:

```
git tag v1.0.0 && git push origin v1.0.0
```

CI refuses to publish a tag whose number disagrees with `CARD_VERSION`, then
attaches `skywatch-card.js` to the release. HACS matches the `filename` from
`hacs.json` against the release assets before it falls back to the file tree,
so an install pulls exactly the asset of the version it claims to be
installing.

The `HACS` workflow runs the real HACS validation. It only runs on `main` and
on demand, because it inspects the repository as GitHub serves it — default
branch, description, topics — rather than the checkout, so on a branch it would
report the state of `main`. Two of the things it checks are GitHub repository
settings rather than files: the repository needs a **description** and at least
one **topic**.

## Notes

- Positions are extrapolated along the heading between polls, so the map moves
  smoothly instead of jumping once a minute.
- The same aircraft appearing in two sensors is shown once.
- Animations are disabled when the system asks for reduced motion.

## License

MIT — see [LICENSE](LICENSE). Use, modify and redistribute it, commercially
too; the licence text travels along and there is no warranty.

[fr24]: https://github.com/AlexandrErohin/home-assistant-flightradar24
