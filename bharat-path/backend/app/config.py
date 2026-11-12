"""Runtime configuration, loaded from environment variables (see deploy/.env.example)."""
from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: str = "development"  # development | production | test
    database_url: str = "postgresql+asyncpg://postgres@localhost:5432/bharatpath"
    redis_url: str | None = None
    public_base_url: str = "http://localhost:8000"
    cors_origins: str = ""  # comma separated; mobile app does not need CORS

    # Security
    jwt_secret: str = Field(default="dev-only-change-me", min_length=8)
    admin_email: str | None = None
    admin_password: str | None = None
    admin_token_ttl_minutes: int = 120

    # Identification sent to open-data providers (their usage policies require a UA)
    http_user_agent: str = "BharatPath/1.0 (+https://github.com/bharat-path)"
    provider_timeout_s: float = 20.0

    # Routing
    routing_providers: str = "valhalla,osrm"  # ordered fallback chain; add mappls,graphhopper
    valhalla_url: str = "https://valhalla1.openstreetmap.de"
    osrm_url: str = "https://router.project-osrm.org"
    graphhopper_url: str = "https://graphhopper.com/api/1"
    graphhopper_key: str | None = None

    # Geocoding / places
    geocoding_providers: str = "nominatim,photon"
    nominatim_url: str = "https://nominatim.openstreetmap.org"
    photon_url: str = "https://photon.komoot.io"
    pincode_url: str = "https://api.postalpincode.in"
    overpass_url: str = "https://overpass-api.de/api/interpreter"

    # Mappls (MapmyIndia) — optional, licensed
    mappls_client_id: str | None = None
    mappls_client_secret: str | None = None
    mappls_rest_key: str | None = None

    # Coverage
    opencellid_key: str | None = None
    opencellid_url: str = "https://opencellid.org"

    # Imagery
    bhuvan_authorized: bool = False
    bhuvan_wms_url: str = "https://bhuvan-vec1.nrsc.gov.in/bhuvan/wms"
    bhuvan_wms_layer: str = "india3"
    custom_imagery_url: str | None = None
    custom_imagery_attribution: str | None = None
    custom_imagery_date: str | None = None
    tile_style_url: str = "https://tiles.openfreemap.org/styles/liberty"

    # AI assistant (server-side only — never shipped in the APK)
    anthropic_api_key: str | None = None
    assistant_model: str = "claude-opus-5-5"
    assistant_effort: str = "low"
    assistant_max_turns: int = 6

    # Media
    media_dir: str = "./media"
    max_upload_bytes: int = 5 * 1024 * 1024

    # Rate limits (requests per minute per device or IP)
    rate_limit_default: int = 120
    rate_limit_search: int = 60
    rate_limit_route: int = 30
    rate_limit_assistant: int = 10
    rate_limit_reports: int = 10
    rate_limit_speedtest: int = 6

    # Retention (days)
    retention_observations_days: int = 365
    retention_speedtests_days: int = 180
    retention_expired_incidents_days: int = 30
    retention_logs_days: int = 30

    # Speed test
    speedtest_max_bytes: int = 50 * 1024 * 1024

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    def chain(self, value: str) -> list[str]:
        return [p.strip().lower() for p in value.split(",") if p.strip()]

    @property
    def mappls_configured(self) -> bool:
        return bool(self.mappls_client_id and self.mappls_client_secret and self.mappls_rest_key)


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    if s.is_production and s.jwt_secret == "dev-only-change-me":
        raise RuntimeError("JWT_SECRET must be set in production")
    return s
