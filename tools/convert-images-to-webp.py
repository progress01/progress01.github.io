#!/usr/bin/env python3
"""Convert local raster assets to WebP and update site-local image references.

The original PNG/JPG files are intentionally kept beside the converted files so
the conversion is reversible until the generated site has been checked.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageOps


RASTER_EXTENSIONS = {".png", ".jpg", ".jpeg"}
TEXT_EXTENSIONS = {
    ".css",
    ".html",
    ".js",
    ".json",
    ".md",
    ".txt",
    ".xml",
    ".yml",
    ".yaml",
}


def convert_image(source: Path, destination: Path) -> None:
    with Image.open(source) as opened:
        image = ImageOps.exif_transpose(opened)
        if "A" in image.getbands():
            image = image.convert("RGBA")
        elif image.mode not in {"RGB", "L"}:
            image = image.convert("RGB")
        image.save(destination, "WEBP", quality=88, method=6)


def reference_map(image_root: Path) -> dict[str, str]:
    mapping: dict[str, str] = {}
    for source in image_root.rglob("*"):
        if not source.is_file() or source.suffix.lower() not in RASTER_EXTENSIONS:
            continue
        relative = source.relative_to(image_root).as_posix()
        mapping[f"/images/{relative}"] = f"/images/{Path(relative).with_suffix('.webp').as_posix()}"
    return mapping


def update_references(root: Path, mapping: dict[str, str], write: bool) -> tuple[int, int]:
    files_changed = 0
    references_changed = 0
    for scan_root in (root / "source", root / "themes"):
        if not scan_root.exists():
            continue
        for path in scan_root.rglob("*"):
            if not path.is_file() or path.suffix.lower() not in TEXT_EXTENSIONS:
                continue
            data = path.read_bytes()
            updated = data
            count_for_file = 0
            for old, new in mapping.items():
                old_bytes = old.encode("utf-8")
                count = updated.count(old_bytes)
                if count:
                    updated = updated.replace(old_bytes, new.encode("utf-8"))
                    count_for_file += count
            if updated != data:
                if write:
                    path.write_bytes(updated)
                files_changed += 1
                references_changed += count_for_file
    return files_changed, references_changed


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true", help="write converted files and references")
    args = parser.parse_args()

    root = Path(__file__).resolve().parents[1]
    image_root = root / "source" / "images"
    sources = [
        path
        for path in image_root.rglob("*")
        if path.is_file() and path.suffix.lower() in RASTER_EXTENSIONS
    ]

    converted = 0
    original_bytes = 0
    webp_bytes = 0
    if args.write:
        for source in sources:
            destination = source.with_suffix(".webp")
            convert_image(source, destination)
            converted += 1
            original_bytes += source.stat().st_size
            webp_bytes += destination.stat().st_size
    else:
        converted = len(sources)

    mapping = reference_map(image_root)
    files_changed, references_changed = update_references(root, mapping, args.write)

    print(f"mode={'write' if args.write else 'dry-run'}")
    print(f"raster_sources={len(sources)}")
    print(f"webp_converted={converted}")
    if args.write:
        print(f"original_bytes={original_bytes}")
        print(f"webp_bytes={webp_bytes}")
    print(f"reference_files={files_changed}")
    print(f"references_updated={references_changed}")
    if not args.write:
        print("dry-run only; use --write to apply the conversion")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
