#!/usr/bin/env python3
"""Convert local raster assets to WebP and update site-local image references.

The original PNG/JPG files are intentionally kept beside the converted files so
the conversion is reversible until the generated site has been checked.
"""

from __future__ import annotations

import argparse
from io import BytesIO
import re
from pathlib import Path
from urllib.parse import unquote

from PIL import Image, ImageOps

from blogger_scope import (
    ScopeError,
    add_scope_arguments,
    display_paths,
    resolve_posts,
    resolve_repo_subpath,
)


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


def converted_bytes(source: Path) -> bytes:
    with Image.open(source) as opened:
        image = ImageOps.exif_transpose(opened)
        if "A" in image.getbands(): image = image.convert("RGBA")
        elif image.mode not in {"RGB", "L"}: image = image.convert("RGB")
        buffer = BytesIO()
        image.save(buffer, "WEBP", quality=88, method=6)
        return buffer.getvalue()


def reference_map(image_root: Path) -> dict[str, str]:
    mapping: dict[str, str] = {}
    for source in image_root.rglob("*"):
        if not source.is_file() or source.suffix.lower() not in RASTER_EXTENSIONS:
            continue
        relative = source.relative_to(image_root).as_posix()
        mapping[f"/images/{relative}"] = f"/images/{Path(relative).with_suffix('.webp').as_posix()}"
    return mapping


def plan_reference_updates(root: Path, mapping: dict[str, str], target_files=None):
    files_changed = 0
    references_changed = 0
    changed_paths = []
    plans = []
    if target_files is not None:
        candidates = [
            resolve_repo_subpath(path, root, root / "source" / "_posts", "選取文章")
            for path in target_files
        ]
    else:
        candidates = []
        for scan_root in (root / "source", root / "themes"):
            trusted_root = resolve_repo_subpath(scan_root, root, root, "文字掃描根目錄")
            for path in trusted_root.rglob("*"):
                # Validate every entry, including a nested junction/symlink
                # directory that pathlib may otherwise skip while recursing.
                resolved = resolve_repo_subpath(path, root, trusted_root, "文字掃描路徑")
                if resolved.is_file():
                    candidates.append(resolved)
        candidates = sorted(set(candidates))
    for path in candidates:
        if not path.is_file() or path.suffix.lower() not in TEXT_EXTENSIONS:
            continue
        data = path.read_bytes()
        updated = data
        count_for_file = 0
        for old, new in mapping.items():
            pattern = rb"(?<![A-Za-z0-9._-])" + re.escape(old.encode("utf-8")) + rb"(?![A-Za-z0-9._-])"
            updated, count = re.subn(pattern, new.encode("utf-8"), updated)
            count_for_file += count
        if updated != data:
            changed_paths.append(path)
            plans.append((path, updated))
            files_changed += 1
            references_changed += count_for_file
    return files_changed, references_changed, changed_paths, plans


def apply_reference_updates(plans) -> None:
    for path, updated in plans:
        path.write_bytes(updated)


def update_references(root: Path, mapping: dict[str, str], write: bool, target_files=None) -> tuple[int, int, list[Path]]:
    files_changed, references_changed, changed_paths, plans = plan_reference_updates(root, mapping, target_files)
    if write:
        apply_reference_updates(plans)
    return files_changed, references_changed, changed_paths


LOCAL_RASTER_RE = re.compile(
    r"/images/[^\"'<>\r\n]*?\.(?:png|jpe?g)"
    r"(?=(?:[?#][^\"'<>\r\n]*)?(?:[\"'<>)]|\s|$))",
    re.IGNORECASE,
)


def references_for_posts(posts: list[Path], image_root: Path) -> dict[str, str]:
    mapping = {}
    image_root = image_root.resolve()
    for post in posts:
        text = post.read_text(encoding="utf-8")
        for reference in LOCAL_RASTER_RE.findall(text):
            decoded = unquote(reference)
            source_name = re.split(r"[?#]", decoded, maxsplit=1)[0]
            source = (image_root / source_name.removeprefix("/images/")).resolve()
            try:
                source.relative_to(image_root)
            except ValueError as error:
                raise ScopeError(f"圖片引用越界：{reference}") from error
            if not source.is_file() or source.suffix.lower() not in RASTER_EXTENSIONS:
                raise FileNotFoundError(source)
            suffix_position = reference.lower().rfind(source.suffix.lower())
            mapping[reference] = reference[:suffix_position] + ".webp"
    return mapping


def main(argv=None, root=None) -> int:
    parser = argparse.ArgumentParser()
    add_scope_arguments(parser)
    parser.add_argument("--overwrite-images", action="store_true", help="允許覆寫已存在的 WebP（預設拒絕）")
    args = parser.parse_args(argv)

    root = Path(root).resolve() if root is not None else Path(__file__).resolve().parents[1]
    image_root = root / "source" / "images"
    try:
        selected_posts = resolve_posts(args.post, args.all, args.write, root)
        scoped = args.post is not None
        image_root_resolved = resolve_repo_subpath(image_root, root, root / "source", "圖片根目錄")
        mapping = references_for_posts(selected_posts, image_root_resolved) if scoped else reference_map(image_root_resolved)
        target_files = selected_posts if scoped else None
        files_changed, references_changed, reference_paths, reference_plans = plan_reference_updates(root, mapping, target_files)
        sources = []
        seen_sources = set()
        for key in mapping:
            source_name = re.split(r"[?#]", unquote(key), maxsplit=1)[0]
            source = resolve_repo_subpath(
                image_root_resolved / source_name.removeprefix('/images/'),
                root,
                image_root_resolved,
                "圖片來源",
            )
            if source not in seen_sources:
                sources.append(source)
                seen_sources.add(source)
        destinations = [resolve_repo_subpath(source.with_suffix('.webp'), root, image_root_resolved, "WebP 目標") for source in sources]
        for destination in destinations:
            try: destination.relative_to(image_root_resolved)
            except ValueError as error: raise ScopeError(f"WebP 目標越界：{destination}") from error
        if len(set(destinations)) != len(destinations):
            raise ScopeError("選取文章產生同一 WebP 目標，拒絕默默覆寫")
        asset_data = {source: converted_bytes(source) for source in sources}
        asset_changed_paths = [
            destination
            for source, destination in zip(sources, destinations)
            if not destination.exists() or destination.read_bytes() != asset_data[source]
        ]
        collisions = [destination for source, destination in zip(sources, destinations)
                      if destination.exists() and destination.read_bytes() != asset_data[source]]
        if collisions and not args.overwrite_images:
            raise ScopeError("既有 WebP 會被覆寫，請先移除或明確使用 --overwrite-images：" + ", ".join(display_paths(collisions, root)))
    except (ScopeError, OSError, UnicodeError, ValueError) as error:
        parser.error(str(error))

    converted = 0
    original_bytes = 0
    webp_bytes = 0
    if args.write:
        for source, destination in zip(sources, destinations):
            if not destination.exists() or destination.read_bytes() != asset_data[source]:
                destination.parent.mkdir(parents=True, exist_ok=True)
                destination.write_bytes(asset_data[source])
            converted += 1
            original_bytes += source.stat().st_size
            webp_bytes += destination.stat().st_size
    else:
        converted = len(sources)

    if args.write:
        apply_reference_updates(reference_plans)
    changed_paths = []
    for path in [*asset_changed_paths, *reference_paths]:
        if path not in changed_paths:
            changed_paths.append(path)

    print(f"mode={'write' if args.write else 'dry-run'}")
    print(f"raster_sources={len(sources)}")
    print(f"webp_converted={converted}")
    if args.write:
        print(f"original_bytes={original_bytes}")
        print(f"webp_bytes={webp_bytes}")
    print(f"reference_files={files_changed}")
    print(f"references_updated={references_changed}")
    print("選取：" + ("、".join(display_paths(selected_posts, root)) if selected_posts else "無"))
    print("變更：" + ("、".join(display_paths(changed_paths, root)) if changed_paths else "無"))
    if not args.write:
        print("dry-run only; use --write to apply the conversion")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
