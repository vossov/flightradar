"""Constants for Skywatch."""

DOMAIN = "skywatch"

# Kept in step with CARD_VERSION in frontend/skywatch-card.js and with the
# version in manifest.json; the release workflow refuses a tag where the three
# disagree.
VERSION = "1.1.0"

CONF_RADIUS_KM = "radius_km"
CONF_MAX_FLIGHTS = "max_flights"
CONF_DETAILS = "details"

DEFAULT_RADIUS_KM = 60
DEFAULT_SCAN_INTERVAL = 30
DEFAULT_MAX_FLIGHTS = 40
DEFAULT_DETAILS = True

MIN_SCAN_INTERVAL = 10
MAX_SCAN_INTERVAL = 600

ATTRIBUTION = "Data provided by Flightradar24"
