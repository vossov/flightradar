"""A small async client for the public Flightradar24 feed.

Flightradar24 publishes no free documented API. What is used here is the pair
of endpoints the website itself calls: `feed.js`, which answers a bounding box
with one positional row per aircraft, and `clickhandler`, which answers a
flight id with the descriptive parts -- the model name, the airline, the
airport names and the photographs.

Neither is a contract. They can change shape or start refusing us without
notice, so everything below treats a missing field as absent rather than as an
error, and the caller gets an exception it can surface instead of a traceback.

The dictionaries this module returns use the field names the Skywatch card
reads, which are the ones the Flightradar24 custom integration established.
That is deliberate: a dashboard pointed at either source sees the same thing.
"""

from __future__ import annotations

import asyncio
import logging
import math
from typing import Any

import aiohttp

_LOGGER = logging.getLogger(__name__)

FEED_URL = "https://data-cloud.flightradar24.com/zones/fcgi/feed.js"
DETAIL_URL = "https://data-live.flightradar24.com/clickhandler/"

# The feed answers an unadorned request with an error page, so it is asked for
# the way the site asks for it.
HEADERS = {
    "accept": "application/json",
    "accept-language": "en-US,en;q=0.9",
    "cache-control": "no-cache",
    "origin": "https://www.flightradar24.com",
    "referer": "https://www.flightradar24.com/",
    "user-agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
    ),
}

REQUEST_TIMEOUT = aiohttp.ClientTimeout(total=20)

# A feed row is a bare list, and position is the only thing that names a field.
_IDX_ICAO_24BIT = 0
_IDX_LATITUDE = 1
_IDX_LONGITUDE = 2
_IDX_HEADING = 3
_IDX_ALTITUDE = 4
_IDX_GROUND_SPEED = 5
_IDX_SQUAWK = 6
_IDX_AIRCRAFT_CODE = 8
_IDX_REGISTRATION = 9
_IDX_TIMESTAMP = 10
_IDX_ORIGIN = 11
_IDX_DESTINATION = 12
_IDX_FLIGHT_NUMBER = 13
_IDX_ON_GROUND = 14
_IDX_VERTICAL_SPEED = 15
_IDX_CALLSIGN = 16
_IDX_AIRLINE_ICAO = 18

_ROW_LENGTH = 19

EARTH_RADIUS_KM = 6371.0088

# One cycle should not turn into fifty requests because a wave of new traffic
# came over at once. What is missed this time is picked up on the next poll.
MAX_DETAIL_FETCHES = 12
DETAIL_CONCURRENCY = 4


class Flightradar24Error(Exception):
    """The feed could not be read."""


class Flightradar24Blocked(Flightradar24Error):
    """The feed answered, and the answer was no.

    Rate limiting and outright blocking both land here. It is worth telling
    apart from a network blip because polling harder makes it worse.
    """


def bounds(latitude: float, longitude: float, radius_km: float) -> str:
    """The `north,south,west,east` box that contains the circle we care about.

    A degree of longitude shortens towards the poles, so the box is only
    square in kilometres at the equator. Flights outside the circle are dropped
    afterwards; this is just the coarse filter that keeps the request small.
    """
    lat_delta = radius_km / 111.32
    # cos() collapses at the poles, where a bounding box stops meaning much
    # anyway; the floor keeps the arithmetic finite.
    lon_delta = radius_km / max(0.01, 111.32 * math.cos(math.radians(latitude)))

    north = min(90.0, latitude + lat_delta)
    south = max(-90.0, latitude - lat_delta)
    west = max(-180.0, longitude - lon_delta)
    east = min(180.0, longitude + lon_delta)
    return f"{north:.6f},{south:.6f},{west:.6f},{east:.6f}"


def distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance over the ground, in kilometres."""
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)
    a = (
        math.sin(d_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    )
    return 2 * EARTH_RADIUS_KM * math.asin(min(1.0, math.sqrt(a)))


def _text(value: Any) -> str | None:
    """Feed rows use empty strings and the odd 'N/A' where they mean nothing."""
    if value is None:
        return None
    text = str(value).strip()
    if not text or text.upper() in ("N/A", "NONE"):
        return None
    return text


def _number(value: Any) -> float | int | None:
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, (int, float)):
        return value
    try:
        return float(str(value).strip())
    except (TypeError, ValueError):
        return None


def parse_feed(payload: dict[str, Any]) -> list[dict[str, Any]]:
    """Turn the feed's positional rows into named fields.

    The payload carries housekeeping keys next to the aircraft -- `full_count`,
    `version`, `stats` -- which are told apart by shape rather than by name, so
    a new one appearing does not break the parse.
    """
    flights: list[dict[str, Any]] = []
    for flight_id, row in payload.items():
        if not isinstance(row, list) or len(row) < _ROW_LENGTH:
            continue

        latitude = _number(row[_IDX_LATITUDE])
        longitude = _number(row[_IDX_LONGITUDE])
        if latitude is None or longitude is None:
            continue

        flight_number = _text(row[_IDX_FLIGHT_NUMBER])
        flights.append(
            {
                "id": str(flight_id),
                "icao_24bit": _text(row[_IDX_ICAO_24BIT]),
                "latitude": latitude,
                "longitude": longitude,
                "heading": _number(row[_IDX_HEADING]),
                "altitude": _number(row[_IDX_ALTITUDE]),
                "ground_speed": _number(row[_IDX_GROUND_SPEED]),
                "vertical_speed": _number(row[_IDX_VERTICAL_SPEED]),
                "squawk": _text(row[_IDX_SQUAWK]),
                "aircraft_code": _text(row[_IDX_AIRCRAFT_CODE]),
                "aircraft_registration": _text(row[_IDX_REGISTRATION]),
                "callsign": _text(row[_IDX_CALLSIGN]),
                "flight_number": flight_number,
                "airline_iata": flight_number[:2] if flight_number else None,
                "airline_icao": _text(row[_IDX_AIRLINE_ICAO]),
                "airport_origin_code_iata": _text(row[_IDX_ORIGIN]),
                "airport_destination_code_iata": _text(row[_IDX_DESTINATION]),
                "on_ground": bool(_number(row[_IDX_ON_GROUND])),
                "time": _number(row[_IDX_TIMESTAMP]),
            }
        )
    return flights


def _first_image(images: Any, *keys: str) -> str | None:
    if not isinstance(images, dict):
        return None
    for key in keys:
        entries = images.get(key)
        if isinstance(entries, list) and entries and isinstance(entries[0], dict):
            source = _text(entries[0].get("src"))
            if source:
                return source
    return None


def parse_detail(payload: dict[str, Any]) -> dict[str, Any]:
    """Pull the descriptive fields out of a clickhandler response.

    Everything here is optional. A general aviation flight has no airline and
    an unphotographed airframe has no thumbnail, and neither is a problem worth
    reporting -- the card simply leaves the line out.
    """
    detail: dict[str, Any] = {}

    aircraft = payload.get("aircraft")
    if isinstance(aircraft, dict):
        model = aircraft.get("model")
        if isinstance(model, dict):
            detail["aircraft_model"] = _text(model.get("text"))
            code = _text(model.get("code"))
            if code:
                detail["aircraft_code"] = code
        registration = _text(aircraft.get("registration"))
        if registration:
            detail["aircraft_registration"] = registration
        images = aircraft.get("images")
        detail["aircraft_photo_small"] = _first_image(images, "thumbnails", "medium")
        detail["aircraft_photo_medium"] = _first_image(images, "medium", "large")

    airline = payload.get("airline")
    if isinstance(airline, dict):
        detail["airline"] = _text(airline.get("name"))
        detail["airline_short"] = _text(airline.get("short"))

    airport = payload.get("airport")
    if isinstance(airport, dict):
        for side, prefix in (("origin", "airport_origin"), ("destination", "airport_destination")):
            end = airport.get(side)
            if not isinstance(end, dict):
                continue
            detail[f"{prefix}_name"] = _text(end.get("name"))
            code = end.get("code")
            if isinstance(code, dict):
                iata = _text(code.get("iata"))
                if iata:
                    detail[f"{prefix}_code_iata"] = iata
                icao = _text(code.get("icao"))
                if icao:
                    detail[f"{prefix}_code_icao"] = icao
            position = end.get("position")
            if isinstance(position, dict):
                region = position.get("region")
                if isinstance(region, dict):
                    detail[f"{prefix}_city"] = _text(region.get("city"))

    return {key: value for key, value in detail.items() if value is not None}


class Flightradar24:
    """Reads the feed around one position and describes what it finds."""

    def __init__(
        self,
        session: aiohttp.ClientSession,
        latitude: float,
        longitude: float,
        radius_km: float,
        *,
        details: bool = True,
        max_flights: int = 40,
    ) -> None:
        self._session = session
        self.latitude = latitude
        self.longitude = longitude
        self.radius_km = radius_km
        self.details = details
        self.max_flights = max_flights

        # Descriptive data does not change over a flight, so it is fetched once
        # and kept until the aircraft leaves. A None marks a lookup that failed,
        # so a flight with no detail page is not retried every thirty seconds.
        self._detail_cache: dict[str, dict[str, Any] | None] = {}

    async def async_get_flights(self) -> list[dict[str, Any]]:
        """Everything in the circle, nearest first, described where possible."""
        payload = await self._async_request(
            FEED_URL,
            {
                "bounds": bounds(self.latitude, self.longitude, self.radius_km),
                "faa": "1",
                "satellite": "1",
                "mlat": "1",
                "flarm": "1",
                "adsb": "1",
                "gnd": "1",
                "air": "1",
                # A pushback tug is neither visible from a garden nor worth a
                # line on the card.
                "vehicles": "0",
                "estimated": "1",
                "maxage": "14400",
                "gliders": "1",
                "stats": "0",
            },
        )

        flights = []
        for flight in parse_feed(payload):
            ground = distance_km(
                self.latitude, self.longitude, flight["latitude"], flight["longitude"]
            )
            if ground > self.radius_km:
                continue
            flight["distance"] = round(ground, 2)
            flights.append(flight)

        flights.sort(key=lambda flight: flight["distance"])
        del flights[self.max_flights :]

        if self.details:
            await self._async_add_details(flights)

        return flights

    async def _async_add_details(self, flights: list[dict[str, Any]]) -> None:
        """Fill in model, airline, airports and photographs.

        Only aircraft we have never looked up cost a request, and only a
        handful of those per cycle.
        """
        present = {flight["id"] for flight in flights}
        for cached in list(self._detail_cache):
            if cached not in present:
                del self._detail_cache[cached]

        wanted = [
            flight["id"] for flight in flights if flight["id"] not in self._detail_cache
        ][:MAX_DETAIL_FETCHES]

        if wanted:
            semaphore = asyncio.Semaphore(DETAIL_CONCURRENCY)

            async def fetch(flight_id: str) -> None:
                async with semaphore:
                    self._detail_cache[flight_id] = await self._async_get_detail(
                        flight_id
                    )

            await asyncio.gather(*(fetch(flight_id) for flight_id in wanted))

        for flight in flights:
            detail = self._detail_cache.get(flight["id"])
            if detail:
                flight.update(detail)

    async def _async_get_detail(self, flight_id: str) -> dict[str, Any] | None:
        """One flight's detail page, or None if it does not have a usable one.

        A failure here is not a failure of the update: the aircraft is still on
        the map, it just says B738 instead of Boeing 737-800.
        """
        try:
            payload = await self._async_request(
                DETAIL_URL, {"flight": flight_id, "version": "1.5"}
            )
        except Flightradar24Error as err:
            _LOGGER.debug("No detail for flight %s: %s", flight_id, err)
            return None

        try:
            return parse_detail(payload)
        except (AttributeError, TypeError, ValueError) as err:
            _LOGGER.debug("Unreadable detail for flight %s: %s", flight_id, err)
            return None

    async def _async_request(
        self, url: str, params: dict[str, str]
    ) -> dict[str, Any]:
        try:
            async with self._session.get(
                url, params=params, headers=HEADERS, timeout=REQUEST_TIMEOUT
            ) as response:
                if response.status in (401, 402, 403, 429):
                    raise Flightradar24Blocked(
                        f"Flightradar24 refused the request ({response.status})"
                    )
                if response.status != 200:
                    raise Flightradar24Error(
                        f"Flightradar24 answered {response.status}"
                    )
                # The feed is served as text/javascript, so the content type
                # check has to be off for aiohttp to parse it at all.
                payload = await response.json(content_type=None)
        except asyncio.TimeoutError as err:
            raise Flightradar24Error("Flightradar24 timed out") from err
        except aiohttp.ClientError as err:
            raise Flightradar24Error(f"Could not reach Flightradar24: {err}") from err
        except ValueError as err:
            raise Flightradar24Error("Flightradar24 sent something unreadable") from err

        if not isinstance(payload, dict):
            raise Flightradar24Error("Flightradar24 sent an unexpected shape")
        return payload
