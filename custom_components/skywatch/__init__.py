"""Skywatch: the Flightradar24 feed and the card that reads it, in one piece.

The integration polls Flightradar24 for the traffic around your house and
publishes it as a sensor, and it serves and registers the Lovelace card itself.
There is nothing to add under Resources and no second integration to install.
"""

from __future__ import annotations

import logging
from pathlib import Path

from homeassistant.components import frontend
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import CONF_LATITUDE, CONF_LONGITUDE, CONF_SCAN_INTERVAL, Platform
from homeassistant.core import HomeAssistant
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.typing import ConfigType

from .const import (
    CONF_DETAILS,
    CONF_MAX_FLIGHTS,
    CONF_RADIUS_KM,
    DEFAULT_DETAILS,
    DEFAULT_MAX_FLIGHTS,
    DEFAULT_RADIUS_KM,
    DEFAULT_SCAN_INTERVAL,
    DOMAIN,
    VERSION,
)
from .coordinator import SkywatchCoordinator
from .flightradar24 import Flightradar24

_LOGGER = logging.getLogger(__name__)

PLATFORMS: list[Platform] = [Platform.SENSOR]

CARD_FILENAME = "skywatch-card.js"
CARD_URL = f"/{DOMAIN}/{CARD_FILENAME}"
FRONTEND_REGISTERED = "frontend_registered"

SkywatchConfigEntry = ConfigEntry[SkywatchCoordinator]


def option(entry: ConfigEntry, key: str, default):
    """Options win where they exist, otherwise whatever setup was told."""
    if key in entry.options:
        return entry.options[key]
    return entry.data.get(key, default)


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Serve the card once, whether or not anything is configured yet."""
    await _async_register_card(hass)
    return True


async def _async_register_card(hass: HomeAssistant) -> None:
    """Put the card on a URL and tell the frontend to load it.

    This is what replaces the manual Resources entry. The version in the query
    string is what makes an upgrade actually reach the browser instead of
    sitting in its cache.
    """
    domain_data = hass.data.setdefault(DOMAIN, {})
    if domain_data.get(FRONTEND_REGISTERED):
        return

    card = Path(__file__).parent / "frontend" / CARD_FILENAME
    if not card.is_file():
        _LOGGER.error(
            "The Skywatch card is missing from the integration at %s; "
            "the sensor will work but the card will not load",
            card,
        )
        return

    await hass.http.async_register_static_paths(
        [StaticPathConfig(CARD_URL, str(card), cache_headers=True)]
    )
    frontend.add_extra_js_url(hass, f"{CARD_URL}?v={VERSION}")
    domain_data[FRONTEND_REGISTERED] = True


async def async_setup_entry(hass: HomeAssistant, entry: SkywatchConfigEntry) -> bool:
    """Set up one watched patch of sky."""
    await _async_register_card(hass)

    client = Flightradar24(
        async_get_clientsession(hass),
        latitude=option(entry, CONF_LATITUDE, hass.config.latitude),
        longitude=option(entry, CONF_LONGITUDE, hass.config.longitude),
        radius_km=option(entry, CONF_RADIUS_KM, DEFAULT_RADIUS_KM),
        details=option(entry, CONF_DETAILS, DEFAULT_DETAILS),
        max_flights=option(entry, CONF_MAX_FLIGHTS, DEFAULT_MAX_FLIGHTS),
    )

    coordinator = SkywatchCoordinator(
        hass,
        entry,
        client,
        option(entry, CONF_SCAN_INTERVAL, DEFAULT_SCAN_INTERVAL),
    )
    await coordinator.async_config_entry_first_refresh()

    entry.runtime_data = coordinator
    entry.async_on_unload(entry.add_update_listener(_async_reload))
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: SkywatchConfigEntry) -> bool:
    """Unload one watched patch of sky.

    The card stays registered: it is the frontend's, not this entry's, and
    removing the last entry is not a reason to break a dashboard.
    """
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)


async def _async_reload(hass: HomeAssistant, entry: SkywatchConfigEntry) -> None:
    await hass.config_entries.async_reload(entry.entry_id)
