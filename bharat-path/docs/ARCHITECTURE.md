# Bharat Path — System Architecture

> *Made for India's Roads. Powered by Intelligence.*

This document covers the system architecture, repository layout, database design,
API integration matrix and the phased development plan. Every part of it is
implemented in this repository; where something depends on a licence,
subscription or government authorisation, the adapter is implemented and the
credentials it needs are documented in [`API_INTEGRATIONS.md`](API_INTEGRATIONS.md).

---

## 1. Design principles

1. **Truthful data or no data.** The app never invents coordinates, signal
   readings, traffic or tower locations. Every value carries its *source*, its
   *timestamp* and, where relevant, a *confidence*. When data is missing the UI
   says so ("Live traffic data unavailable – showing normal route estimates.").
2. **Replaceable providers.** Routing, geocoding, traffic, imagery, coverage and
   the AI assistant sit behind interfaces with an ordered fallback chain that is
   set by configuration, not code.
3. **Works without our backend.** The debug APK runs in *Direct open-data mode*
   (OpenStreetMap search, Valhalla routing, M-Lab speed test) when no backend is
   configured. Features that need shared data (incidents, coverage observations,
   AI assistant, route connectivity) are clearly shown as needing the backend.
4. **Privacy by default.** No account, no name, no phone number. A random device
   token is the only identity. Network measurements are off until the user opts
   in, are snapped to a ~110 m grid and stored without any device identifier.
   Background location is never requested: navigation runs as a foreground
   service started by the user.
5. **Low connectivity is the normal case.** Room caches routes, places and
   pending uploads; WorkManager syncs when a validated internet connection
   returns.

---

## 2. High-level architecture

```
┌──────────────────────────── Android app (Kotlin, Compose, M3) ────────────────────────────┐
│ UI: Home map · Search · Route planner · Navigation · Network dashboard · Coverage map ·    │
│     Speed test · AI assistant · Offline maps · Reports · Settings/Privacy                   │
│                                                                                             │
│ Device layer                       Data layer                     Background                │
│  FusedLocationProvider             Room (places, routes,          NavigationService         │
│  GnssStatus (GPS/NavIC/…)          measurements, outbox)          (foreground, location)    │
│  TelephonyManager/CellInfo         DataStore (settings, consent)  SyncWorker (WorkManager)  │
│  ConnectivityManager               MapLibre OfflineManager                                  │
│  TextToSpeech / SpeechRecognizer                                                            │
│                                                                                             │
│ Providers (interfaces): Search · Routing · Incidents · Coverage · SpeedTest · Assistant    │
│   ├─ BackendProvider  (preferred, HTTPS + device token)                                     │
│   └─ DirectProvider   (Nominatim/Photon, Valhalla, M-Lab NDT7) — "Direct open-data mode"    │
└───────────────────────────────┬─────────────────────────────────────────────────────────────┘
                                │ HTTPS / WSS (TLS only in release builds)
┌───────────────────────────────▼──────────── Backend (FastAPI) ─────────────────────────────┐
│ /v1/devices  /v1/search  /v1/places  /v1/route  /v1/traffic  /v1/incidents (+ WebSocket)   │
│ /v1/reports  /v1/coverage  /v1/connectivity/route  /v1/network/observations  /v1/speedtest │
│ /v1/assistant/chat  /v1/layers  /v1/privacy  /admin (portal + API)                          │
│                                                                                             │
│ Provider adapters: Valhalla · OSRM · GraphHopper · Mappls (routing, traffic, search) ·      │
│   Nominatim · Photon · India Post PIN · Overpass · OpenCelliD · ISRO Bhuvan · EOX S2 ·      │
│   Claude (Anthropic API, server-side only)                                                  │
│ Services: route connectivity intelligence · incident dedupe/confidence/expiry ·            │
│   retention purge · provider health · rate limiting · audit log                             │
└──────────────┬───────────────────────────────┬──────────────────────────────────────────────┘
               │                               │
      PostgreSQL 16 + PostGIS 3          Redis 7 (rate limits, provider cache,
      (geography columns, GiST)          incident pub/sub for WebSockets)
```

### Data-flow examples

* **Route with connectivity intelligence** — app → `POST /v1/route` → provider
  chain (Mappls when licensed for traffic-aware ETA, else Valhalla, else OSRM) →
  optional `trace_attributes` road profile (highway class, unpaved, tolls,
  bridges/flyovers, tunnels/underpasses, service roads) → app shows alternatives
  → app → `POST /v1/connectivity/route` with the selected polyline + operator →
  PostGIS buffers each 2 km segment, aggregates observations + tower density →
  merged km-ranges with class, confidence and data age.
* **Incident report** — app → `POST /v1/incidents` → dedupe within 200 m / 2 h for
  same category (merges as a confirmation) → stored with expiry by category →
  published on Redis → WebSocket subscribers whose bbox contains it.
* **Assistant** — app → `POST /v1/assistant/chat` → Claude with tools
  (`search_place`, `plan_route`, `route_connectivity`, `nearby_places`,
  `incidents_near`) executed against the same backend services → reply in the
  user's language + structured actions (e.g. "start navigation to …").

---

## 3. Repository structure

```
bharat-path/
├── android/                          Android Studio project (Gradle KTS, version catalog)
│   └── app/src/main/java/in/bharatpath/app/
│       ├── BharatPathApp.kt          Application: MapLibre init, channels, WorkManager
│       ├── MainActivity.kt
│       ├── di/ServiceLocator.kt      Manual DI (no annotation processors beyond Room KSP)
│       ├── core/                     geo math, polyline, http, formatting, result types
│       ├── data/                     Room DB, DAOs, DataStore settings, backend API client
│       ├── location/                 Fused location, GNSS monitor, reverse geocoding
│       ├── network/                  Telephony, connectivity, operator resolver, speed test
│       ├── map/                      Layer catalog, style builder, offline regions
│       ├── search/  routing/         Providers + repositories
│       ├── navigation/               Foreground service, progress tracker, voice, i18n
│       ├── traffic/                  Incidents + WebSocket
│       ├── connectivity/             Route connectivity intelligence client
│       ├── assistant/                AI assistant + speech input
│       ├── contrib/                  Community reports
│       ├── sync/                     WorkManager sync
│       └── ui/                       Compose screens, theme, navigation graph
├── backend/
│   ├── app/                          FastAPI application
│   │   ├── providers/                routing, geocoding, places, traffic, coverage, imagery
│   │   ├── services/                 connectivity, incidents, assistant, retention
│   │   ├── routers/                  public API, admin API, websocket
│   │   └── admin_ui/                 Admin portal (static SPA served at /admin)
│   ├── migrations/                   Alembic migrations (PostGIS schema)
│   ├── scripts/                      OpenCelliD bulk import, admin bootstrap
│   ├── tests/                        pytest (unit + integration against PostGIS)
│   └── Dockerfile
├── deploy/                           docker-compose, nginx TLS proxy, .env template
├── docs/                             architecture, API integrations, privacy, testing, guides
└── .github/workflows/bharat-path-ci.yml  (at repository root)
```

---

## 4. Database design (PostgreSQL 16 + PostGIS)

All locations use `geography(Point, 4326)` with GiST indexes, so distances are in
metres without projection juggling. The migration is
`backend/migrations/versions/0001_initial.py`.

| Table | Purpose | Key columns | Privacy notes |
|---|---|---|---|
| `devices` | Anonymous app installs | `id uuid`, `token_hash` (SHA-256), `consent jsonb`, `contribution_score`, `banned`, `created_at`, `last_seen_at` | No PII. Token stored hashed. Deleted on account deletion. |
| `admin_users` | Portal operators | `email`, `password_hash` (PBKDF2-SHA256), `role` (`admin`/`moderator`) | |
| `incidents` | Live road incidents | `category`, `location geography`, `reported_at`, `expires_at`, `status` (`unverified`/`verified`/`rejected`/`expired`), `confidence`, `confirmations`, `rejections`, `source`, `photo_path`, `device_id` | Reporter id never returned by public API. |
| `incident_votes` | Confirm / dismiss | `(incident_id, device_id)` unique, `vote` ±1 | Deleted with device. |
| `map_reports` | Road corrections & community mapping | `category` (missing road, wrong direction, closure, pothole, accident, flooding, missing landmark, poor connectivity), `location`, `description`, `photo_path`, `status`, `duplicate_of`, `moderator_note`, `reviewed_by` | Photos re-encoded to strip EXIF/GPS. |
| `cell_towers` | Known cells (OpenCelliD etc.) | `radio`, `mcc`, `mnc`, `area`, `cell`, `operator`, `location`, `range_m`, `samples`, `source`, `updated_at` | Positions are *estimated* by the source. |
| `signal_observations` | Voluntary anonymous measurements | `location` (snapped ~110 m), `operator`, `technology`, `dbm`, `level 0-4`, `no_service`, `observed_at`, `source` | **No device id.** Opt-in only. |
| `speed_tests` | Voluntary speed results | `download_mbps`, `upload_mbps`, `ping_ms`, `jitter_ms`, `loss_pct`, `operator`, `technology`, `location` (≈1 km), `server` | Opt-in upload only. |
| `provider_calls` | API usage + health | `provider`, `operation`, `status`, `latency_ms`, `at` | |
| `error_logs` | Backend + app crash/error reports | `source`, `message`, `detail`, `app_version`, `at` | App sends no location in errors. |
| `map_updates` | Map/data refresh status | `dataset`, `region`, `version`, `status`, `updated_at`, `notes` | |
| `audit_log` | Admin actions | `admin_id`, `action`, `target`, `at`, `detail` | |

Retention (configurable, enforced hourly by the backend): signal observations
365 days, speed tests 180 days, expired incidents 30 days after expiry, provider
calls 30 days, error logs 30 days.

---

## 5. API integration matrix

| Capability | Primary | Fallbacks | Credentials | Status in this build |
|---|---|---|---|---|
| Base street map | OpenFreeMap vector tiles (OSM, OpenMapTiles schema) | Self-hosted tiles (`TILE_STYLE_URL`) | none | Working |
| Satellite imagery | EOX Sentinel-2 cloudless 2016 (CC BY 4.0) | EOX S2 2024 (CC BY-NC-SA, non-commercial), ISRO Bhuvan WMS, licensed custom XYZ | Bhuvan: written authorisation; custom: provider key | EOX working; Bhuvan adapter gated by `BHUVAN_AUTHORIZED` |
| Terrain | OpenTopoMap (CC BY-SA) | custom XYZ | none | Working (online only) |
| Boundaries / roads / water / landmarks overlays | OpenMapTiles layers from the vector source | Bhuvan/SoI boundary layer for official boundaries | Bhuvan authorisation | Working (see boundary note in `API_INTEGRATIONS.md`) |
| Geocoding / search | Nominatim (India-restricted) | Photon, Mappls Autosuggest, India Post PIN directory, on-device cache | Mappls: client id/secret + REST key | Nominatim + Photon + PIN working; Mappls adapter needs keys |
| Category places (hospital, school, petrol pump, station, bus stand, toll, tourist) | Overpass API | Mappls Nearby | Mappls keys | Overpass working |
| Reverse geocode (village/town/district/state) | Nominatim reverse | Android `Geocoder` on device | none | Working |
| Routing (car/bike/bicycle/walk, alternatives, avoid tolls/highways, shortest) | Valhalla | OSRM (car only), GraphHopper, Mappls `route_eta` | GraphHopper key; Mappls keys | Valhalla + OSRM working |
| Road profile (NH/SH, unpaved, toll, flyover/bridge, underpass/tunnel, service road, one-way) | Valhalla `trace_attributes` | — | none | Working |
| Live traffic | Mappls traffic-aware ETA | none — shows "Live traffic data unavailable" | Mappls licence | Adapter implemented, needs keys |
| Incidents | Bharat Path community reports | Mappls/official feeds via `source` field | none | Working |
| Cell towers | OpenCelliD (`getInArea`, bulk CSV import) | Operator/TRAI data via import script | OpenCelliD API token | Adapter + importer implemented, needs token |
| Signal observations | Voluntary anonymous app measurements | — | none | Working |
| Speed test | M-Lab NDT7 (open measurement platform) | Bharat Path backend endpoints | none | Working |
| AI assistant | Claude (Anthropic API) via backend only | Rule-based intent parser ("basic mode") | `ANTHROPIC_API_KEY` (server env only) | Implemented, needs key |
| Voice | Android TextToSpeech (offline voices where installed) | — | none | Working |
| Speech input | Android SpeechRecognizer | text input | none | Working where device supports |

---

## 6. Development plan (phases) and status

| Phase | Scope | Status |
|---|---|---|
| 1 | Android foundation, Compose M3 shell, interactive India map | Built, compiles, unit tested |
| 2 | Fused location + GNSS (incl. NavIC) live location intelligence | Built; needs on-device validation |
| 3 | Search, routing, alternatives, turn-by-turn, foreground nav service | Built; routing/search verified against live providers from backend tests |
| 4 | Satellite & geospatial layers, attribution, imagery dates | Built |
| 5 | Mobile network intelligence, coverage map, speed test, route connectivity | Built; telephony needs real SIM testing |
| 6 | Traffic + incident reporting, WebSocket updates, moderation | Built, backend integration-tested |
| 7 | AI multilingual assistant + voice guidance in 10 languages | Built; Claude path needs API key |
| 8 | Offline maps, cached routes, offline search, sync | Built |
| 9 | Backend, admin portal, security, Docker, CI | Built, tested |
| 10 | Real-device testing and Play release | **Pending** — checklist in `TESTING_REPORT.md` / `PLAY_STORE_CHECKLIST.md` |

"Built" means the code exists and compiles and its automated tests pass in CI.
It does **not** mean field-validated; see [`TESTING_REPORT.md`](TESTING_REPORT.md)
for exactly what was and was not verified.
