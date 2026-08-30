"""Attach imported Blogger posts to the site's current article presentation.

This only changes presentation metadata and HTML structure.  Article wording,
titles, dates, and the original Blogger source note are retained.
"""

from __future__ import annotations

import argparse
import html
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
POSTS_DIR = ROOT / "source" / "_posts"
IMAGE_TAG_RE = re.compile(r'<img\s+class="blogger-import-image"[^>]*>', re.IGNORECASE)
SRC_RE = re.compile(r'\ssrc="([^"]+)"', re.IGNORECASE)
FRONT_MATTER_RE = re.compile(r"^(---\r?\n)([\s\S]*?)(\r?\n---)([\s\S]*)$")
SOURCE_NOTE_RE = re.compile(r"\s*<!-- Blogger 原文:.*? -->\s*$", re.DOTALL)
PARAGRAPH_RE = re.compile(r"(?ms)(?P<block>\S.*?)(?=\n\s*\n|\Z)")
MORE_MARKER = "<!-- more -->"
SONG_CARD_MARKER = "legacy-song-card"


def split_front_matter(text: str) -> tuple[str, str, str]:
    match = FRONT_MATTER_RE.match(text)
    if not match:
        raise ValueError("missing front matter")
    front_matter = match.group(1) + match.group(2) + match.group(3)
    body = match.group(4)
    note_match = SOURCE_NOTE_RE.search(body)
    source_note = note_match.group(0).strip() if note_match else ""
    if note_match:
        body = body[: note_match.start()]
    return front_matter, body.strip(), source_note


def category_is_song(front_matter: str, post_path: Path) -> bool:
    if post_path.parent.name == "歌曲推薦":
        return True
    match = re.search(r"^categories:\s*\[([^\]]+)\]", front_matter, re.MULTILINE)
    return bool(match and "音樂" in match.group(1))


def ensure_field(front_matter: str, key: str, value: str) -> str:
    if re.search(rf"^{re.escape(key)}:", front_matter, re.MULTILINE):
        return front_matter
    lines = front_matter.splitlines()
    insert_at = next(
        (index + 1 for index, line in enumerate(lines) if line.startswith("date:")),
        len(lines) - 1,
    )
    lines.insert(insert_at, f"{key}: {value}")
    return "\n".join(lines)


def first_image_source(body: str) -> str:
    match = IMAGE_TAG_RE.search(body)
    if not match:
        return ""
    source_match = SRC_RE.search(match.group(0))
    return source_match.group(1) if source_match else ""


def cover_image_source(image_source: str) -> str:
    parts = image_source.strip("/").split("/")
    if len(parts) < 3 or parts[0:2] != ["images", "blogger-import"]:
        return image_source
    folder = parts[-2]
    filename = Path(parts[-1]).stem
    return f"/images/blogger-import/thumbs/{folder}/{filename}.webp"


def ensure_imported_cover(front_matter: str, image_source: str) -> str:
    cover = cover_image_source(image_source)
    pattern = re.compile(r"^cover:\s*.*$", re.MULTILINE)
    if pattern.search(front_matter):
        return pattern.sub(f"cover: {cover}", front_matter, count=1)
    return ensure_field(front_matter, "cover", cover)


def add_more_after_first_paragraph(body: str) -> str:
    if MORE_MARKER in body:
        return body
    for match in PARAGRAPH_RE.finditer(body):
        block = match.group("block").strip()
        if not block or block.startswith("#") or "blogger-import-image" in block:
            continue
        position = match.end("block")
        return body[:position].rstrip() + f"\n\n{MORE_MARKER}\n\n" + body[position:].lstrip()
    return body


def styled_image_tag(tag: str) -> str:
    if " style=" in tag.lower():
        return tag
    style = ' style="border-radius: 5px; width: 100%; height: auto; box-shadow: 2px 2px 5px rgba(0,0,0,0.2);"'
    return tag[:-1] + style + ">"


def normalize_song_body(body: str) -> str:
    if SONG_CARD_MARKER in body:
        return body
    image_match = IMAGE_TAG_RE.search(body)
    if not image_match:
        return add_more_after_first_paragraph(body)

    before = body[: image_match.start()].strip()
    after = body[image_match.end() :].strip()
    paragraphs = [part.strip() for part in re.split(r"\n\s*\n", before) if part.strip()]
    if not paragraphs:
        return body

    intro = html.escape(paragraphs[0], quote=False).replace("\n", "<br>\n")
    remainder = paragraphs[1:]
    if after:
        remainder.append(after)
    tail = "\n\n".join(remainder).strip()
    image = styled_image_tag(image_match.group(0))
    card = "\n".join(
        [
            f'<div class="{SONG_CARD_MARKER}" style="display: flex; gap: 20px; align-items: flex-start;">',
            '  <div style="flex: 1; text-align: left;">',
            '    <p style="margin-top: 0;">',
            f"      {intro}",
            "    </p>",
            "  </div>",
            '  <div style="width: 150px; flex-shrink: 0;">',
            f"    {image}",
            "  </div>",
            "</div>",
            MORE_MARKER,
        ]
    )
    return card + (f"\n\n{tail}" if tail else "")


def normalize_file(path: Path, write: bool) -> tuple[str, bool]:
    raw = path.read_bytes().decode("utf-8")
    newline = "\r\n" if "\r\n" in raw else "\n"
    text = raw.replace("\r\n", "\n")
    front_matter, body, source_note = split_front_matter(text)
    image_source = first_image_source(body)
    if not image_source:
        return "沒有可用圖片", False

    is_song = category_is_song(front_matter, path)
    front_matter = ensure_field(front_matter, "blogger_import", "true")
    if not is_song:
        front_matter = ensure_imported_cover(front_matter, image_source)
        plain = re.sub(r"<[^>]+>", "", body)
        heading_count = len(re.findall(r"(?m)^#{2,6}\s", body))
        if len(plain) >= 1800 or heading_count >= 3 or len(IMAGE_TAG_RE.findall(body)) > 1:
            front_matter = ensure_field(front_matter, "longform", "true")
        body = add_more_after_first_paragraph(body)
    else:
        body = normalize_song_body(body)

    output = front_matter + "\n\n" + body
    if source_note:
        output += "\n\n" + source_note
    output += "\n"
    if write:
        path.write_bytes(output.replace("\n", newline).encode("utf-8"))
    return ("歌曲資訊卡" if is_song else "cover／more"), True


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true", help="write normalized article metadata and markup")
    args = parser.parse_args()

    files = [
        path
        for path in POSTS_DIR.rglob("*.md")
        if "Blogger" in path.read_text(encoding="utf-8")
    ]
    changed = 0
    results: dict[str, int] = {}
    for path in files:
        result, valid = normalize_file(path, args.write)
        if valid:
            results[result] = results.get(result, 0) + 1
            changed += 1
    mode = "已寫入" if args.write else "預覽"
    print(f"{mode}：檢查 {len(files)} 篇匯入文章，處理 {changed} 篇")
    for key, count in results.items():
        print(f"{key}：{count} 篇")


if __name__ == "__main__":
    main()
