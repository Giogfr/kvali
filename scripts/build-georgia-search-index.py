#!/usr/bin/env python3
"""Build Kvali's offline Georgia place, POI, street and address index.

The source OpenStreetMap extract is intentionally not stored in the repository.
The output is a gzipped JSON document that is downloaded alongside the offline
basemap and searched entirely on the device.

Requires the ``osmium`` Python package (https://github.com/osmcode/pyosmium).
Example:

    python scripts/build-georgia-search-index.py \
      --pbf georgia-latest.osm.pbf \
      --output artifacts/georgia-search-v1.json.gz
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import sys
import unicodedata
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

try:
    import osmium
except ImportError as error:  # pragma: no cover - exercised by the CLI
    raise SystemExit(
        "Missing dependency: install it with `python -m pip install osmium`."
    ) from error


INDEX_VERSION = 1
MAGIC = "KVALI-SEARCH"
MIN_LAT = 39.9
MIN_LON = 41.0
MAX_LAT = 46.8
MAX_LON = 46.8

PLACE_IMPORTANCE = {
    "city": 100,
    "town": 82,
    "village": 62,
    "hamlet": 50,
    "suburb": 46,
    "quarter": 44,
    "neighbourhood": 42,
    "city_block": 38,
    "locality": 30,
    "isolated_dwelling": 28,
    "farm": 24,
    "square": 36,
    "region": 70,
    "state": 72,
}

POI_IMPORTANCE = {
    "fuel": 34,
    "charging_station": 34,
    "hospital": 32,
    "clinic": 30,
    "pharmacy": 28,
    "police": 28,
    "fire_station": 26,
    "bank": 26,
    "atm": 24,
    "bus_station": 30,
    "railway_station": 32,
    "station": 30,
    "airport": 40,
    "ferry_terminal": 28,
    "parking": 22,
    "supermarket": 26,
    "marketplace": 26,
    "hotel": 26,
    "guest_house": 24,
    "hostel": 22,
    "restaurant": 24,
    "cafe": 22,
    "fast_food": 20,
    "bar": 18,
    "pub": 18,
    "school": 24,
    "university": 30,
    "kindergarten": 20,
    "museum": 30,
    "attraction": 28,
    "viewpoint": 26,
    "monument": 24,
    "memorial": 20,
    "place_of_worship": 22,
    "tourist_information": 22,
    "aerodrome": 40,
    "terminal": 30,
    "helipad": 30,
    "station": 32,
    "halt": 24,
    "tram_stop": 20,
    "peak": 28,
    "volcano": 28,
    "waterfall": 26,
    "cave_entrance": 24,
    "spring": 22,
    "beach": 24,
    "bay": 20,
    "glacier": 20,
}

POI_KEYS = (
    "amenity",
    "shop",
    "tourism",
    "leisure",
    "healthcare",
    "historic",
    "office",
    "public_transport",
    "aeroway",
    "railway",
    "natural",
    "craft",
    "emergency",
)

STREET_IMPORTANCE = {
    "motorway": 30,
    "trunk": 28,
    "primary": 26,
    "secondary": 24,
    "tertiary": 22,
    "unclassified": 18,
    "residential": 18,
    "living_street": 16,
    "service": 12,
    "track": 8,
    "footway": 10,
    "path": 8,
    "pedestrian": 16,
    "cycleway": 10,
}


def clean_text(value: str) -> str:
    return " ".join(unicodedata.normalize("NFC", value).split())


def normalized(value: str) -> str:
    return clean_text(value).casefold()


def in_georgia(lat: float, lon: float) -> bool:
    return MIN_LAT <= lat <= MAX_LAT and MIN_LON <= lon <= MAX_LON


def place_kind(tags: dict[str, str]) -> str | None:
    place = tags.get("place")
    if place:
        return place
    return None


def poi_kind(tags: dict[str, str]) -> str | None:
    for key in POI_KEYS:
        value = tags.get(key)
        if value:
            return value
    return None


def importance(kind: str, category: str | None = None) -> int:
    if category == "place":
        return PLACE_IMPORTANCE.get(kind, 34)
    if category == "street":
        return STREET_IMPORTANCE.get(kind, 12)
    if category == "address":
        return 8
    return POI_IMPORTANCE.get(kind, 14)


class GeorgiaSearchHandler(osmium.SimpleHandler):
    """Collect searchable named features without retaining OSM objects."""

    def __init__(self) -> None:
        super().__init__()
        self.entries: dict[tuple[object, ...], list[object]] = {}
        self.kinds: Counter[str] = Counter()
        self.skipped = 0

    def _add(
        self,
        name: str,
        name_en: str,
        kind: str,
        category: str,
        lat: float,
        lon: float,
        weight: int,
    ) -> None:
        name = clean_text(name)
        if len(name) < 2 or not in_georgia(lat, lon):
            self.skipped += 1
            return
        name_en = clean_text(name_en) if name_en and normalized(name_en) != normalized(name) else ""
        if category == "place":
            key: tuple[object, ...] = (category, normalized(name), kind, round(lat, 1), round(lon, 1))
        elif category == "street":
            key = (category, normalized(name), round(lat / 0.02), round(lon / 0.02))
        else:
            key = (category, normalized(name), kind, round(lat, 4), round(lon, 4))
        entry = [name, name_en, kind, round(lat, 5), round(lon, 5), weight]
        previous = self.entries.get(key)
        if previous is None or weight > int(previous[5]):
            self.entries[key] = entry
        self.kinds[kind] += 1

    def _add_node(self, tags: dict[str, str], lat: float, lon: float) -> None:
        name = tags.get("name") or tags.get("name:en") or ""
        name_en = tags.get("name:en") or ""
        place = place_kind(tags)
        if place and name:
            self._add(name, name_en, place, "place", lat, lon, importance(place, "place"))
        poi = poi_kind(tags)
        if poi and name:
            self._add(name, name_en, poi, "poi", lat, lon, importance(poi, "poi"))
        street = tags.get("addr:street") or ""
        house = tags.get("addr:housenumber") or ""
        if street and house:
            self._add(f"{street} {house}", "", "address", "address", lat, lon, 8)

    def node(self, node: object) -> None:
        tags = {str(tag.k): str(tag.v) for tag in node.tags}
        if not tags:
            return
        if not node.location.valid():
            return
        self._add_node(tags, node.location.lat, node.location.lon)

    def way(self, way: object) -> None:
        tags = {str(tag.k): str(tag.v) for tag in way.tags}
        if not tags:
            return
        name = tags.get("name") or tags.get("name:en") or ""
        name_en = tags.get("name:en") or ""
        highway = tags.get("highway") or ""
        poi = poi_kind(tags)
        street = tags.get("addr:street") or ""
        house = tags.get("addr:housenumber") or ""
        if not name and not poi and not (street and house):
            return
        if highway in {"construction", "proposed", "raceway", "bus_stop"}:
            highway = ""

        references = list(way.nodes)
        closed_shape = len(references) > 2 and references[0].ref == references[-1].ref
        latitudes: list[float] = []
        longitudes: list[float] = []
        for node in references:
            if not node.location.valid():
                continue
            latitudes.append(node.location.lat)
            longitudes.append(node.location.lon)
        if not latitudes:
            self.skipped += 1
            return
        lat = sum(latitudes) / len(latitudes)
        lon = sum(longitudes) / len(longitudes)
        if not in_georgia(lat, lon):
            self.skipped += 1
            return

        # Closed shapes are delivered through the area callback, including
        # multipolygon relations that have no way-level representation.
        if poi and name and not closed_shape:
            self._add(name, name_en, poi, "poi", lat, lon, importance(poi, "poi"))
        if highway and name:
            self._add(name, name_en, highway, "street", lat, lon, importance(highway, "street"))
        if street and house:
            self._add(f"{street} {house}", "", "address", "address", lat, lon, 8)

    def area(self, area: object) -> None:
        tags = {str(tag.k): str(tag.v) for tag in area.tags}
        if not tags:
            return
        name = tags.get("name") or tags.get("name:en") or ""
        name_en = tags.get("name:en") or ""
        place = place_kind(tags)
        poi = poi_kind(tags)
        if not name or not (place or poi):
            return

        latitudes: list[float] = []
        longitudes: list[float] = []
        for ring in area.outer_rings():
            for node in ring:
                if not node.location.valid():
                    continue
                latitudes.append(node.location.lat)
                longitudes.append(node.location.lon)
        if not latitudes:
            self.skipped += 1
            return
        lat = sum(latitudes) / len(latitudes)
        lon = sum(longitudes) / len(longitudes)
        if not in_georgia(lat, lon):
            self.skipped += 1
            return
        if place:
            self._add(name, name_en, place, "place", lat, lon, importance(place, "place"))
        if poi:
            self._add(name, name_en, poi, "poi", lat, lon, importance(poi, "poi"))


def write_output(output: Path, payload: bytes) -> str:
    output.parent.mkdir(parents=True, exist_ok=True)
    if output.suffix == ".gz":
        with gzip.open(output, "wb", compresslevel=9) as stream:
            stream.write(payload)
    else:
        output.write_bytes(payload)
    digest = hashlib.sha256(output.read_bytes()).hexdigest()
    manifest = output.with_suffix(output.suffix + ".sha256")
    manifest.write_text(f"{digest}  {output.name}\n", encoding="utf-8")
    return digest


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pbf", required=True, type=Path, help="Geofabrik Georgia .osm.pbf input")
    parser.add_argument("--output", required=True, type=Path, help=".json or .json.gz output path")
    args = parser.parse_args()
    if not args.pbf.is_file():
        parser.error(f"PBF not found: {args.pbf}")

    handler = GeorgiaSearchHandler()
    handler.apply_file(str(args.pbf), locations=True)
    rows = sorted(handler.entries.values(), key=lambda row: (row[2], normalized(str(row[0])), row[3], row[4]))
    document = {
        "magic": MAGIC,
        "version": INDEX_VERSION,
        "generated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "bbox": [MIN_LON, MIN_LAT, MAX_LON, MAX_LAT],
        "entries": rows,
    }
    payload = json.dumps(document, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    digest = write_output(args.output, payload)
    stats = {
        "output": str(args.output),
        "sha256": digest,
        "entries": len(rows),
        "uncompressedBytes": len(payload),
        "compressedBytes": args.output.stat().st_size,
        "skipped": handler.skipped,
        "kinds": dict(handler.kinds.most_common()),
    }
    print(json.dumps(stats, ensure_ascii=False, indent=2), file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
