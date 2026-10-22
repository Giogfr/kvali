#!/usr/bin/env python3
"""Build Kvali's compact nationwide Georgia car-routing graph from an OSM PBF.

The PBF is deliberately an input, not a checked-in repository asset.  The
output is a versioned JSON document with integer coordinates, adjacency
offsets, and compact edge tuples.  It is suitable for gzip compression and
delivery to the Android app's private storage.

Requires the ``osmium`` Python package (https://github.com/osmcode/pyosmium).
Example:

    python scripts/build-georgia-routing-graph.py \
      --pbf georgia-latest.osm.pbf \
      --output artifacts/georgia-routing-graph-v2.json.gz
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import math
import os
import sys
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

try:
    import osmium
except ImportError as error:  # pragma: no cover - exercised by the CLI
    raise SystemExit(
        "Missing dependency: install it with `python -m pip install osmium`."
    ) from error


ROAD_SPEED_KMH = {
    "motorway": 100,
    "motorway_link": 60,
    "trunk": 90,
    "trunk_link": 55,
    "primary": 70,
    "primary_link": 45,
    "secondary": 60,
    "secondary_link": 40,
    "tertiary": 45,
    "tertiary_link": 35,
    "unclassified": 35,
    "residential": 30,
    "living_street": 15,
    "service": 15,
    "road": 30,
    "track": 12,
}
CAR_ROAD_TYPES = set(ROAD_SPEED_KMH)
UNPAVED_SURFACES = {"unpaved", "gravel", "dirt", "ground", "sand", "mud", "fine_gravel"}

# Flags are intentionally stable: the app interprets these without needing
# to retain the verbose OSM tags in every edge.
EDGE_HIGHWAY = 1
EDGE_UNPAVED = 2
EDGE_TOLL = 4


@dataclass(frozen=True)
class Point:
    lat: float
    lon: float


@dataclass(frozen=True)
class Edge:
    target: int
    distance_m: int
    duration_s: int
    flags: int
    name: str


def distance_meters(a: Point, b: Point) -> float:
    radius = 6_371_000.0
    lat1 = math.radians(a.lat)
    lat2 = math.radians(b.lat)
    dlat = lat2 - lat1
    dlon = math.radians(b.lon - a.lon)
    haversine = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * radius * math.asin(min(1.0, math.sqrt(haversine)))


def parse_speed(tags: dict[str, str], highway: str) -> float:
    raw = tags.get("maxspeed", "")
    digits = "".join(character if character.isdigit() or character == "." else " " for character in raw)
    try:
        speed = float(digits.split()[0])
        if "mph" in raw.lower():
            speed *= 1.60934
        return max(5.0, min(speed, 150.0))
    except (IndexError, ValueError):
        return ROAD_SPEED_KMH.get(highway, 30)


def eligible_way(way: object) -> bool:
    tags = {str(tag.k): str(tag.v) for tag in way.tags}
    highway = tags.get("highway", "")
    return (
        highway in CAR_ROAD_TYPES
        and tags.get("area") != "yes"
        and tags.get("access") not in {"no", "private"}
        and tags.get("motor_vehicle") not in {"no", "private"}
        and tags.get("motorcar") not in {"no", "private"}
    )


class GeorgiaGraphHandler(osmium.SimpleHandler):
    """Collect only drivable OSM ways and their location-bearing segments."""

    def __init__(self) -> None:
        super().__init__()
        self.points: dict[int, Point] = {}
        self.edges_by_node: dict[int, list[tuple[int, float, float, int, str]]] = defaultdict(list)
        self.way_count = 0

    def way(self, way: object) -> None:
        if not eligible_way(way):
            return
        references = list(way.nodes)
        if len(references) < 2:
            return
        tags = {str(tag.k): str(tag.v) for tag in way.tags}
        highway = tags.get("highway", "road")
        speed_kmh = parse_speed(tags, highway)
        flags = 0
        if highway in {"motorway", "motorway_link", "trunk", "trunk_link", "primary", "primary_link", "secondary", "secondary_link"}:
            flags |= EDGE_HIGHWAY
        if tags.get("surface", "") in UNPAVED_SURFACES or tags.get("tracktype") == "grade5":
            flags |= EDGE_UNPAVED
        if tags.get("toll") in {"yes", "true", "1"}:
            flags |= EDGE_TOLL
        name = tags.get("name") or tags.get("ref") or "Road"
        oneway = tags.get("oneway") in {"yes", "1", "true"}
        reverse = tags.get("oneway") == "-1"

        for first, second in zip(references, references[1:]):
            if not first.location.valid() or not second.location.valid():
                continue
            a = Point(first.lat, first.lon)
            b = Point(second.lat, second.lon)
            distance = distance_meters(a, b)
            if not math.isfinite(distance) or distance < 1:
                continue
            duration = max(1.0, distance / 1000 * 3600 / speed_kmh)
            self.points[first.ref] = a
            self.points[second.ref] = b
            forward = (second.ref, distance, duration, flags, name)
            backward = (first.ref, distance, duration, flags, name)
            if reverse:
                self.edges_by_node[second.ref].append(forward)
                self.edges_by_node[first.ref].append(backward)
            elif oneway:
                self.edges_by_node[first.ref].append(forward)
            else:
                self.edges_by_node[first.ref].append(forward)
                self.edges_by_node[second.ref].append(backward)
            self.way_count += 1


def pack_graph(handler: GeorgiaGraphHandler) -> dict[str, object]:
    used_ids = sorted(handler.edges_by_node)
    index = {node_id: position for position, node_id in enumerate(used_ids)}
    nodes = [[round(handler.points[node_id].lat * 1_000_000), round(handler.points[node_id].lon * 1_000_000)] for node_id in used_ids]
    names: list[str] = []
    name_indexes: dict[str, int] = {}
    edge_rows: list[list[int]] = []
    offsets = [0]
    for node_id in used_ids:
        for target, distance, duration, flags, name in handler.edges_by_node[node_id]:
            if target not in index:
                continue
            name_index = name_indexes.setdefault(name, len(names))
            if name_index == len(names):
                names.append(name)
            edge_rows.append([index[target], round(distance), round(duration), flags, name_index])
        offsets.append(len(edge_rows))

    if not nodes or not edge_rows:
        raise ValueError("The extract did not contain a routable car graph")
    latitudes = [node[0] / 1_000_000 for node in nodes]
    longitudes = [node[1] / 1_000_000 for node in nodes]
    return {
        "version": 2,
        "country": "GE",
        "profile": "car",
        "source": "OpenStreetMap contributors / Geofabrik Georgia extract",
        "nodes": nodes,
        "offsets": offsets,
        "edges": edge_rows,
        "names": names,
        "bbox": [min(latitudes), min(longitudes), max(latitudes), max(longitudes)],
        "stats": {"nodes": len(nodes), "edges": len(edge_rows), "ways": handler.way_count},
    }


def write_output(graph: dict[str, object], output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(graph, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    if output.suffix == ".gz":
        with gzip.open(output, "wb", compresslevel=9) as stream:
            stream.write(payload)
    else:
        output.write_bytes(payload)
    digest = hashlib.sha256(output.read_bytes()).hexdigest()
    manifest = output.with_suffix(output.suffix + ".sha256")
    manifest.write_text(f"{digest}  {output.name}\n", encoding="utf-8")
    print(json.dumps({"output": str(output), "sha256": digest, **graph["stats"]}, indent=2))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pbf", required=True, type=Path, help="Geofabrik Georgia .osm.pbf input")
    parser.add_argument("--output", required=True, type=Path, help=".json or .json.gz output path")
    args = parser.parse_args()
    if not args.pbf.is_file():
        parser.error(f"PBF not found: {args.pbf}")
    handler = GeorgiaGraphHandler()
    handler.apply_file(str(args.pbf), locations=True)
    write_output(pack_graph(handler), args.output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
