"""Configuration for Skywatch."""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant.config_entries import (
    ConfigEntry,
    ConfigFlow,
    ConfigFlowResult,
    OptionsFlow,
)
from homeassistant.const import (
    CONF_LATITUDE,
    CONF_LOCATION,
    CONF_LONGITUDE,
    CONF_RADIUS,
    CONF_SCAN_INTERVAL,
)
from homeassistant.core import callback
from homeassistant.helpers import selector

from .const import (
    CONF_DETAILS,
    CONF_MAX_FLIGHTS,
    CONF_RADIUS_KM,
    DEFAULT_DETAILS,
    DEFAULT_MAX_FLIGHTS,
    DEFAULT_RADIUS_KM,
    DEFAULT_SCAN_INTERVAL,
    DOMAIN,
    MAX_SCAN_INTERVAL,
    MIN_SCAN_INTERVAL,
)

# Far enough to cover the traffic that is high enough to see from a long way
# off, and not so far that the feed is asked for half a continent.
MIN_RADIUS_KM = 1
MAX_RADIUS_KM = 250


def _location_selector() -> selector.LocationSelector:
    return selector.LocationSelector(selector.LocationSelectorConfig(radius=True))


def _radius_km(location: dict[str, Any], fallback: float) -> float:
    """The map hands back metres; the rest of the integration works in km."""
    metres = location.get(CONF_RADIUS)
    if metres is None:
        return fallback
    return round(min(MAX_RADIUS_KM, max(MIN_RADIUS_KM, metres / 1000)), 1)


def _tuning_schema(
    scan_interval: int, max_flights: int, details: bool
) -> dict[Any, Any]:
    """The three knobs that decide how hard the feed gets asked."""
    return {
        vol.Required(CONF_SCAN_INTERVAL, default=scan_interval): selector.NumberSelector(
            selector.NumberSelectorConfig(
                min=MIN_SCAN_INTERVAL,
                max=MAX_SCAN_INTERVAL,
                step=5,
                unit_of_measurement="s",
                mode=selector.NumberSelectorMode.BOX,
            )
        ),
        vol.Required(CONF_MAX_FLIGHTS, default=max_flights): selector.NumberSelector(
            selector.NumberSelectorConfig(
                min=5, max=200, step=5, mode=selector.NumberSelectorMode.BOX
            )
        ),
        vol.Required(CONF_DETAILS, default=details): selector.BooleanSelector(),
    }


class SkywatchConfigFlow(ConfigFlow, domain=DOMAIN):
    """Ask where you are standing and how far you care about."""

    VERSION = 1

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        if user_input is not None:
            location = user_input[CONF_LOCATION]
            latitude = location[CONF_LATITUDE]
            longitude = location[CONF_LONGITUDE]

            await self.async_set_unique_id(f"{latitude:.4f},{longitude:.4f}")
            self._abort_if_unique_id_configured()

            return self.async_create_entry(
                title="Skywatch",
                data={
                    CONF_LATITUDE: latitude,
                    CONF_LONGITUDE: longitude,
                    CONF_RADIUS_KM: _radius_km(location, DEFAULT_RADIUS_KM),
                    CONF_SCAN_INTERVAL: int(user_input[CONF_SCAN_INTERVAL]),
                    CONF_MAX_FLIGHTS: int(user_input[CONF_MAX_FLIGHTS]),
                    CONF_DETAILS: user_input[CONF_DETAILS],
                },
            )

        schema = vol.Schema(
            {
                vol.Required(
                    CONF_LOCATION,
                    default={
                        CONF_LATITUDE: self.hass.config.latitude,
                        CONF_LONGITUDE: self.hass.config.longitude,
                        CONF_RADIUS: DEFAULT_RADIUS_KM * 1000,
                    },
                ): _location_selector(),
                **_tuning_schema(
                    DEFAULT_SCAN_INTERVAL, DEFAULT_MAX_FLIGHTS, DEFAULT_DETAILS
                ),
            }
        )
        return self.async_show_form(step_id="user", data_schema=schema)

    @staticmethod
    @callback
    def async_get_options_flow(entry: ConfigEntry) -> SkywatchOptionsFlow:
        return SkywatchOptionsFlow()


class SkywatchOptionsFlow(OptionsFlow):
    """Everything set at install can be changed afterwards, position included."""

    async def async_step_init(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        entry = self.config_entry
        current = {**entry.data, **entry.options}

        if user_input is not None:
            location = user_input[CONF_LOCATION]
            return self.async_create_entry(
                data={
                    CONF_LATITUDE: location[CONF_LATITUDE],
                    CONF_LONGITUDE: location[CONF_LONGITUDE],
                    CONF_RADIUS_KM: _radius_km(
                        location, current.get(CONF_RADIUS_KM, DEFAULT_RADIUS_KM)
                    ),
                    CONF_SCAN_INTERVAL: int(user_input[CONF_SCAN_INTERVAL]),
                    CONF_MAX_FLIGHTS: int(user_input[CONF_MAX_FLIGHTS]),
                    CONF_DETAILS: user_input[CONF_DETAILS],
                }
            )

        schema = vol.Schema(
            {
                vol.Required(
                    CONF_LOCATION,
                    default={
                        CONF_LATITUDE: current.get(
                            CONF_LATITUDE, self.hass.config.latitude
                        ),
                        CONF_LONGITUDE: current.get(
                            CONF_LONGITUDE, self.hass.config.longitude
                        ),
                        CONF_RADIUS: current.get(CONF_RADIUS_KM, DEFAULT_RADIUS_KM)
                        * 1000,
                    },
                ): _location_selector(),
                **_tuning_schema(
                    int(current.get(CONF_SCAN_INTERVAL, DEFAULT_SCAN_INTERVAL)),
                    int(current.get(CONF_MAX_FLIGHTS, DEFAULT_MAX_FLIGHTS)),
                    bool(current.get(CONF_DETAILS, DEFAULT_DETAILS)),
                ),
            }
        )
        return self.async_show_form(step_id="init", data_schema=schema)
