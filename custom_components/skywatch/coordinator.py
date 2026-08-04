"""Polling for Skywatch."""

from __future__ import annotations

from datetime import timedelta
import logging
from typing import Any

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

from .const import DOMAIN
from .flightradar24 import Flightradar24, Flightradar24Blocked, Flightradar24Error

_LOGGER = logging.getLogger(__name__)

# Being refused is the one failure that polling harder makes worse, so the
# interval is stretched until it is not being refused any more.
BACKOFF_FACTOR = 3
MAX_BACKOFF_SECONDS = 900


class SkywatchCoordinator(DataUpdateCoordinator[list[dict[str, Any]]]):
    """Keeps the current picture of the sky around one position."""

    def __init__(
        self,
        hass: HomeAssistant,
        entry: ConfigEntry,
        client: Flightradar24,
        scan_interval: int,
    ) -> None:
        self.client = client
        self._interval = timedelta(seconds=scan_interval)
        super().__init__(
            hass,
            _LOGGER,
            name=DOMAIN,
            update_interval=self._interval,
            config_entry=entry,
        )

    async def _async_update_data(self) -> list[dict[str, Any]]:
        try:
            flights = await self.client.async_get_flights()
        except Flightradar24Blocked as err:
            self._back_off()
            raise UpdateFailed(str(err)) from err
        except Flightradar24Error as err:
            raise UpdateFailed(str(err)) from err

        if self.update_interval != self._interval:
            _LOGGER.info("Flightradar24 is answering again; back to the normal interval")
            self.update_interval = self._interval
        return flights

    def _back_off(self) -> None:
        current = (self.update_interval or self._interval).total_seconds()
        stretched = min(MAX_BACKOFF_SECONDS, max(current * BACKOFF_FACTOR, BACKOFF_FACTOR))
        if stretched != current:
            _LOGGER.warning(
                "Flightradar24 is refusing requests; polling every %d seconds until it stops",
                stretched,
            )
            self.update_interval = timedelta(seconds=stretched)
