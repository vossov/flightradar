"""The sensor the card reads."""

from __future__ import annotations

from typing import Any

from homeassistant.components.sensor import SensorEntity, SensorStateClass
from homeassistant.const import ATTR_ATTRIBUTION
from homeassistant.core import HomeAssistant
from homeassistant.helpers.device_registry import DeviceEntryType, DeviceInfo
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from . import SkywatchConfigEntry
from .const import ATTRIBUTION, DOMAIN
from .coordinator import SkywatchCoordinator


async def async_setup_entry(
    hass: HomeAssistant,
    entry: SkywatchConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up the flight sensor for one entry."""
    async_add_entities([SkywatchFlightsSensor(entry.runtime_data, entry)])


class SkywatchFlightsSensor(CoordinatorEntity[SkywatchCoordinator], SensorEntity):
    """Every aircraft in the circle, with the list parked in an attribute.

    The state is a count because a state has to be short. The card is after the
    `flights` attribute, which is the same shape the Flightradar24 custom
    integration publishes, so a dashboard does not care which one it is reading.
    """

    _attr_has_entity_name = True
    _attr_translation_key = "flights"
    _attr_icon = "mdi:airplane"
    _attr_state_class = SensorStateClass.MEASUREMENT
    _attr_native_unit_of_measurement = "flights"

    # The list is kilobytes and changes every poll. Recording it would fill the
    # database with the position of aeroplanes that have long since landed.
    _unrecorded_attributes = frozenset({"flights"})

    def __init__(
        self, coordinator: SkywatchCoordinator, entry: SkywatchConfigEntry
    ) -> None:
        super().__init__(coordinator)
        self._attr_unique_id = f"{entry.entry_id}_flights"
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, entry.entry_id)},
            name=entry.title,
            manufacturer="Flightradar24",
            model="Feed",
            entry_type=DeviceEntryType.SERVICE,
        )

    @property
    def native_value(self) -> int:
        return len(self.coordinator.data or [])

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        client = self.coordinator.client
        # Deliberately not `latitude`/`longitude`: those two names on an entity
        # are what puts a marker on the map card, and this is a count, not a
        # thing that moves.
        return {
            ATTR_ATTRIBUTION: ATTRIBUTION,
            "station_latitude": client.latitude,
            "station_longitude": client.longitude,
            "radius_km": client.radius_km,
            "flights": self.coordinator.data or [],
        }
