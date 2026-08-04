"""Tests for the Flightradar24 client.

The feed answers with bare lists where position is the only thing that names a
field, so an index off by one does not raise anything -- it silently reports
the squawk code as an altitude. These tests pin the mapping, the circle filter
and the detail merge against payloads shaped like the real ones.

Run with: python3 -m unittest discover -s test -p 'test_*.py'
"""

from __future__ import annotations

import importlib.util
import json
import sys
import unittest
from pathlib import Path

_MODULE = (
    Path(__file__).resolve().parent.parent
    / "custom_components"
    / "skywatch"
    / "flightradar24.py"
)
_spec = importlib.util.spec_from_file_location("skywatch_flightradar24", _MODULE)
fr24 = importlib.util.module_from_spec(_spec)
sys.modules[_spec.name] = fr24
_spec.loader.exec_module(fr24)


# Amsterdam Schiphol, near enough.
HOME_LAT = 52.3105
HOME_LON = 4.7683


def feed_row(**overrides):
    """A row in the order the feed sends it, with sensible contents."""
    row = [
        "484BA1",  # icao 24 bit
        52.35,  # latitude
        4.80,  # longitude
        184,  # heading
        3200,  # altitude, feet
        212,  # ground speed, knots
        "1000",  # squawk
        "F-EHAM3",  # radar
        "B738",  # aircraft code
        "PH-BXA",  # registration
        1_755_000_000,  # timestamp
        "AMS",  # origin
        "BCN",  # destination
        "KL1673",  # flight number
        0,  # on ground
        -1088,  # vertical speed, feet per minute
        "KLM1673",  # callsign
        0,
        "KLM",  # airline icao
    ]
    for index, value in overrides.items():
        row[int(index)] = value
    return row


class TestParseFeed(unittest.TestCase):
    def test_positional_row_becomes_named_fields(self):
        (flight,) = fr24.parse_feed({"2f8a1c9": feed_row()})

        self.assertEqual(flight["id"], "2f8a1c9")
        self.assertEqual(flight["latitude"], 52.35)
        self.assertEqual(flight["longitude"], 4.80)
        self.assertEqual(flight["heading"], 184)
        self.assertEqual(flight["altitude"], 3200)
        self.assertEqual(flight["ground_speed"], 212)
        self.assertEqual(flight["vertical_speed"], -1088)
        self.assertEqual(flight["aircraft_code"], "B738")
        self.assertEqual(flight["aircraft_registration"], "PH-BXA")
        self.assertEqual(flight["callsign"], "KLM1673")
        self.assertEqual(flight["flight_number"], "KL1673")
        self.assertEqual(flight["airport_origin_code_iata"], "AMS")
        self.assertEqual(flight["airport_destination_code_iata"], "BCN")
        self.assertEqual(flight["airline_icao"], "KLM")
        self.assertEqual(flight["airline_iata"], "KL")
        self.assertIs(flight["on_ground"], False)

    def test_on_ground_is_a_boolean(self):
        """The card tests it as a boolean; the feed sends 0 and 1."""
        (flight,) = fr24.parse_feed({"a": feed_row(**{"14": 1})})
        self.assertIs(flight["on_ground"], True)

    def test_housekeeping_keys_are_not_aircraft(self):
        flights = fr24.parse_feed(
            {
                "2f8a1c9": feed_row(),
                "full_count": 14203,
                "version": 4,
                "stats": {"total": {"ads-b": 12000}},
            }
        )
        self.assertEqual([flight["id"] for flight in flights], ["2f8a1c9"])

    def test_short_rows_are_dropped(self):
        """A truncated row would map fields onto the wrong indices."""
        self.assertEqual(fr24.parse_feed({"a": ["484BA1", 52.35, 4.80]}), [])

    def test_a_row_without_a_position_is_useless(self):
        self.assertEqual(fr24.parse_feed({"a": feed_row(**{"1": None})}), [])

    def test_blanks_become_none_rather_than_empty_strings(self):
        """General aviation has no flight number, and '' would render as one."""
        (flight,) = fr24.parse_feed({"a": feed_row(**{"13": "", "12": "N/A"})})
        self.assertIsNone(flight["flight_number"])
        self.assertIsNone(flight["airline_iata"])
        self.assertIsNone(flight["airport_destination_code_iata"])


class TestGeometry(unittest.TestCase):
    def test_bounds_are_north_south_west_east(self):
        north, south, west, east = (
            float(part) for part in fr24.bounds(52.0, 5.0, 111.32).split(",")
        )
        self.assertAlmostEqual(north, 53.0, places=3)
        self.assertAlmostEqual(south, 51.0, places=3)
        self.assertGreater(north, south)
        self.assertGreater(east, west)

    def test_longitude_spreads_wider_than_latitude_away_from_the_equator(self):
        """A degree of longitude is shorter at 52N, so the box is wider in them."""
        north, south, west, east = (
            float(part) for part in fr24.bounds(52.0, 5.0, 50).split(",")
        )
        self.assertGreater(east - west, north - south)

    def test_bounds_stay_on_the_planet(self):
        north, south, west, east = (
            float(part) for part in fr24.bounds(89.5, 179.5, 200).split(",")
        )
        self.assertLessEqual(north, 90.0)
        self.assertLessEqual(east, 180.0)
        self.assertGreaterEqual(south, -90.0)

    def test_distance_over_the_ground(self):
        # A tenth of a degree of latitude is 11.1 km anywhere.
        self.assertAlmostEqual(
            fr24.distance_km(52.0, 5.0, 52.1, 5.0), 11.12, places=1
        )
        self.assertEqual(fr24.distance_km(52.0, 5.0, 52.0, 5.0), 0.0)


DETAIL = {
    "identification": {"id": "2f8a1c9", "number": {"default": "KL1673"}},
    "aircraft": {
        "model": {"code": "B738", "text": "Boeing 737-8K2"},
        "registration": "PH-BXA",
        "images": {
            "thumbnails": [{"src": "https://img.example/small.jpg"}],
            "medium": [{"src": "https://img.example/medium.jpg"}],
        },
    },
    "airline": {"name": "KLM Royal Dutch Airlines", "short": "KLM"},
    "airport": {
        "origin": {
            "name": "Amsterdam Schiphol Airport",
            "code": {"iata": "AMS", "icao": "EHAM"},
            "position": {"region": {"city": "Amsterdam"}},
        },
        "destination": {
            "name": "Barcelona El Prat Airport",
            "code": {"iata": "BCN", "icao": "LEBL"},
            "position": {"region": {"city": "Barcelona"}},
        },
    },
}


class TestParseDetail(unittest.TestCase):
    def test_the_descriptive_fields(self):
        detail = fr24.parse_detail(DETAIL)
        self.assertEqual(detail["aircraft_model"], "Boeing 737-8K2")
        self.assertEqual(detail["airline"], "KLM Royal Dutch Airlines")
        self.assertEqual(detail["airline_short"], "KLM")
        self.assertEqual(detail["airport_origin_name"], "Amsterdam Schiphol Airport")
        self.assertEqual(detail["airport_origin_city"], "Amsterdam")
        self.assertEqual(detail["airport_destination_city"], "Barcelona")
        self.assertEqual(detail["aircraft_photo_small"], "https://img.example/small.jpg")
        self.assertEqual(
            detail["aircraft_photo_medium"], "https://img.example/medium.jpg"
        )

    def test_a_private_flight_has_none_of_it(self):
        """No airline, no route, no photograph, and none of that is an error."""
        detail = fr24.parse_detail(
            {"aircraft": {"model": {"code": "C172", "text": "Cessna 172"}}}
        )
        self.assertEqual(detail["aircraft_model"], "Cessna 172")
        self.assertNotIn("airline", detail)
        self.assertNotIn("aircraft_photo_small", detail)

    def test_nonsense_does_not_raise(self):
        self.assertEqual(fr24.parse_detail({"aircraft": "nope", "airport": 3}), {})


class FakeResponse:
    def __init__(self, payload, status=200):
        self._payload = payload
        self.status = status

    async def json(self, content_type=None):
        return self._payload

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False


class FakeSession:
    """Answers the feed URL and the detail URL, and remembers what was asked."""

    def __init__(self, feed, details=None, status=200):
        self.feed = feed
        self.details = details or {}
        self.status = status
        self.calls = []

    def get(self, url, params=None, headers=None, timeout=None):
        self.calls.append((url, params))
        if url == fr24.FEED_URL:
            return FakeResponse(self.feed, self.status)
        return FakeResponse(self.details.get(params["flight"], {}), self.status)


class TestClient(unittest.IsolatedAsyncioTestCase):
    def client(self, session, **kwargs):
        kwargs.setdefault("radius_km", 30)
        return fr24.Flightradar24(session, HOME_LAT, HOME_LON, **kwargs)

    async def test_the_circle_is_tighter_than_the_box(self):
        """The feed answers a rectangle; the corners are outside the radius."""
        session = FakeSession(
            {
                "near": feed_row(**{"1": 52.35, "2": 4.80}),
                "corner": feed_row(**{"1": 52.55, "2": 5.20}),
            }
        )
        flights = await self.client(session, details=False).async_get_flights()
        self.assertEqual([flight["id"] for flight in flights], ["near"])

    async def test_nearest_first_and_capped(self):
        session = FakeSession(
            {
                "far": feed_row(**{"1": 52.45, "2": 4.90}),
                "near": feed_row(**{"1": 52.32, "2": 4.77}),
                "middle": feed_row(**{"1": 52.38, "2": 4.83}),
            }
        )
        flights = await self.client(
            session, details=False, max_flights=2
        ).async_get_flights()
        self.assertEqual([flight["id"] for flight in flights], ["near", "middle"])
        self.assertLess(flights[0]["distance"], flights[1]["distance"])

    async def test_details_are_merged_in(self):
        session = FakeSession({"2f8a1c9": feed_row()}, {"2f8a1c9": DETAIL})
        (flight,) = await self.client(session).async_get_flights()
        self.assertEqual(flight["aircraft_model"], "Boeing 737-8K2")
        self.assertEqual(flight["airport_origin_city"], "Amsterdam")
        # Still the feed's own fields.
        self.assertEqual(flight["altitude"], 3200)

    async def test_details_are_fetched_once_per_flight(self):
        """They do not change over a flight, and the feed is somebody else's."""
        session = FakeSession({"2f8a1c9": feed_row()}, {"2f8a1c9": DETAIL})
        client = self.client(session)
        await client.async_get_flights()
        await client.async_get_flights()

        detail_calls = [url for url, _ in session.calls if url == fr24.DETAIL_URL]
        self.assertEqual(len(detail_calls), 1)

    async def test_a_flight_that_leaves_is_forgotten(self):
        session = FakeSession({"2f8a1c9": feed_row()}, {"2f8a1c9": DETAIL})
        client = self.client(session)
        await client.async_get_flights()

        session.feed = {}
        await client.async_get_flights()
        self.assertEqual(client._detail_cache, {})

    async def test_a_missing_detail_page_is_not_a_failed_update(self):
        session = FakeSession({"2f8a1c9": feed_row()}, {})
        (flight,) = await self.client(session).async_get_flights()
        self.assertEqual(flight["aircraft_code"], "B738")
        self.assertNotIn("aircraft_model", flight)

    async def test_being_refused_is_told_apart_from_being_broken(self):
        session = FakeSession({}, status=429)
        with self.assertRaises(fr24.Flightradar24Blocked):
            await self.client(session).async_get_flights()

        session = FakeSession({}, status=503)
        with self.assertRaises(fr24.Flightradar24Error) as caught:
            await self.client(session).async_get_flights()
        self.assertNotIsInstance(caught.exception, fr24.Flightradar24Blocked)

    async def test_a_page_of_html_is_an_error_not_a_crash(self):
        session = FakeSession(["not", "a", "mapping"])
        with self.assertRaises(fr24.Flightradar24Error):
            await self.client(session).async_get_flights()


class TestContract(unittest.IsolatedAsyncioTestCase):
    """The half of the contract that lives on this side of the wire.

    `test/fixtures/sensor.json` is what the sensor puts in front of the card,
    and `test/contract.test.mjs` reads the same file from the card's side. A
    field renamed here without renaming it there breaks that test rather than
    quietly emptying a line in the popup.
    """

    async def test_the_client_still_produces_the_fixture(self):
        session = FakeSession({"2f8a1c9": feed_row()}, {"2f8a1c9": DETAIL})
        client = fr24.Flightradar24(session, HOME_LAT, HOME_LON, radius_km=30)
        flights = await client.async_get_flights()

        fixture = json.loads(
            (Path(__file__).resolve().parent / "fixtures" / "sensor.json").read_text()
        )
        self.assertEqual(flights, fixture["attributes"]["flights"])
        self.assertEqual(len(flights), fixture["state"])


if __name__ == "__main__":
    unittest.main()
