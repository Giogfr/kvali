#!/usr/bin/env python3
"""Build Kvali's compact nationwide Georgia car-routing graph from an OSM PBF.

The PBF is deliberately an input, not a checked-in repository asset. The
output is a versioned binary document (KVRG v3) that stores integer
coordinates, contracted road chains, and typed arrays. It gzips well and can
be loaded into a phone without building millions of JavaScript objects.

Requires the ``osmium`` Python package (https://github.com/osmcode/pyosmium).
Example:

    python scripts/build-georgia-routing-graph.py \
      --pbf georgia-latest.osm.pbf \
      --output artifacts/georgia-routing-graph-v3.kvr.gz
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import math
import struct
import sys
from array import array
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path

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

MAGIC = b"KVRG"
FORMAT_VERSION = 3
PROFILE_CAR = 1


@dataclass(frozen=True)
class Point:
    lat: float
    lon: float


@dataclass(frozen=True)
class Segment:
    id: int
    target: int
    distance_m: float
    duration_s: float
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
    """Collect only drivable OSM ways and their directed segments."""

    def __init__(self) -> None:
        super().__init__()
        self.points: dict[int, Point] = {}
        self.outgoing: dict[int, list[Segment]] = defaultdict(list)
        self.incoming: dict[int, int] = defaultdict(int)
        self.neighbors: dict[int, set[int]] = defaultdict(set)
        self.way_count = 0
        self.segment_count = 0
        self._next_segment_id = 0

    def _add(self, source: int, target: int, distance: float, duration: float, flags: int, name: str) -> None:
        segment = Segment(self._next_segment_id, target, distance, duration, flags, name)
        self._next_segment_id += 1
        self.outgoing[source].append(segment)
        self.incoming[target] += 1
        self.neighbors[source].add(target)
        self.neighbors[target].add(source)
        self.segment_count += 1

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
        reversed_oneway = tags.get("oneway") == "-1"

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
            if oneway:
                self._add(first.ref, second.ref, distance, duration, flags, name)
            elif reversed_oneway:
                self._add(second.ref, first.ref, distance, duration, flags, name)
            else:
                self._add(first.ref, second.ref, distance, duration, flags, name)
                self._add(second.ref, first.ref, distance, duration, flags, name)
        self.way_count += 1


@dataclass
class PackedEdge:
    source: int
    target: int
    distance_m: int
    duration_s: int
    flags: int
    name: str
    geometry: list[Point]


def contract(handler: GeorgiaGraphHandler) -> list[PackedEdge]:
    """Collapse degree-two chains so the phone stores junctions, not every node."""
    kept: set[int] = set()
    for node, neighbours in handler.neighbors.items():
        out_degree = len(handler.outgoing.get(node, ()))
        in_degree = handler.incoming.get(node, 0)
        if len(neighbours) != 2 or out_degree != in_degree:
            kept.add(node)

    processed: set[int] = set()
    pending = list(kept)
    edges: list[PackedEdge] = []

    while pending:
        source = pending.pop()
        for segment in handler.outgoing.get(source, ()):
            if segment.id in processed:
                continue
            processed.add(segment.id)
            name = segment.name
            flags = segment.flags
            distance = segment.distance_m
            duration = segment.duration_s
            previous = source
            current = segment.target
            geometry = [handler.points[current]]

            while current not in kept:
                options = [
                    candidate
                    for candidate in handler.outgoing.get(current, ())
                    if candidate.target != previous and candidate.id not in processed
                ]
                if len(options) != 1:
                    break
                following = options[0]
                if following.name != name or following.flags != flags:
                    break
                processed.add(following.id)
                distance += following.distance_m
                duration += following.duration_s
                previous, current = current, following.target
                geometry.append(handler.points[current])

            if current not in kept:
                kept.add(current)
                pending.append(current)

            edges.append(
                PackedEdge(
                    source=source,
                    target=current,
                    distance_m=max(1, int(round(distance))),
                    duration_s=max(1, int(round(duration))),
                    flags=flags,
                    name=name,
                    geometry=geometry,
                )
            )

    return edges


def pack_graph(handler: GeorgiaGraphHandler, edges: list[PackedEdge]) -> bytes:
    used = sorted({edge.source for edge in edges} | {edge.target for edge in edges})
    if not used or not edges:
        raise ValueError("The extract did not contain a routable car graph")
    index = {node_id: position for position, node_id in enumerate(used)}

    by_source: dict[int, list[PackedEdge]] = defaultdict(list)
    for edge in edges:
        by_source[index[edge.source]].append(edge)

    names: list[str] = []
    name_indexes: dict[str, int] = {}
    edge_rows: list[PackedEdge] = []
    offsets = [0]
    for source in range(len(used)):
        edge_rows.extend(by_source.get(source, ()))
        offsets.append(len(edge_rows))

    latitudes = array("i")
    longitudes = array("i")
    for node_id in used:
        point = handler.points[node_id]
        latitudes.append(round(point.lat * 1_000_000))
        longitudes.append(round(point.lon * 1_000_000))

    targets = array("I")
    distances = array("I")
    durations = array("I")
    flags = array("B")
    name_ids = array("I")
    geometry_offsets = array("I", [0])
    geometry_latitudes = array("i")
    geometry_longitudes = array("i")

    for edge in edge_rows:
        targets.append(index[edge.target])
        distances.append(edge.distance_m)
        durations.append(edge.duration_s)
        flags.append(edge.flags)
        name_index = name_indexes.get(edge.name)
        if name_index is None:
            name_index = len(names)
            name_indexes[edge.name] = name_index
            names.append(edge.name)
        name_ids.append(name_index)
        for point in edge.geometry:
            geometry_latitudes.append(round(point.lat * 1_000_000))
            geometry_longitudes.append(round(point.lon * 1_000_000))
        geometry_offsets.append(len(geometry_latitudes))

    if sys.byteorder != "little":
        for values in (latitudes, longitudes, targets, distances, durations, name_ids, geometry_offsets, geometry_latitudes, geometry_longitudes):
            values.byteswap()

    names_bytes = b"\0".join(name.encode("utf-8") for name in names)
    points = [handler.points[node_id] for node_id in used]
    header = struct.pack(
        "<4sHBBIIIIddddI",
        MAGIC,
        FORMAT_VERSION,
        PROFILE_CAR,
        0,
        len(used),
        len(edge_rows),
        len(names),
        len(geometry_latitudes),
        min(point.lat for point in points),
        min(point.lon for point in points),
        max(point.lat for point in points),
        max(point.lon for point in points),
        len(names_bytes),
    )

    payload = bytearray(header)
    for values in (
        latitudes,
        longitudes,
        array("I", offsets),
        targets,
        distances,
        durations,
        name_ids,
        geometry_offsets,
        geometry_latitudes,
        geometry_longitudes,
        flags,
    ):
        payload.extend(values.tobytes())
    payload.extend(names_bytes)

    stats = {
        "nodes": len(used),
        "edges": len(edge_rows),
        "ways": handler.way_count,
        "segments": handler.segment_count,
        "geometryPoints": len(geometry_latitudes),
        "bytes": len(payload),
    }
    print(json.dumps(stats, indent=2), file=sys.stderr)
    return bytes(payload)


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
    parser.add_argument("--output", required=True, type=Path, help=".kvr or .kvr.gz output path")
    args = parser.parse_args()
    if not args.pbf.is_file():
        parser.error(f"PBF not found: {args.pbf}")
    handler = GeorgiaGraphHandler()
    handler.apply_file(str(args.pbf), locations=True)
    edges = contract(handler)
    payload = pack_graph(handler, edges)
    digest = write_output(args.output, payload)
    print(json.dumps({"output": str(args.output), "sha256": digest, "uncompressedBytes": len(payload)}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
