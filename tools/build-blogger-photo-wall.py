"""Build photo-wall thumbnails and entries for imported Blogger articles.

The imported article images remain at their article-friendly size.  The photo
wall gets separate square WebP thumbnails so browsing the wall does not make
the browser download every full-size image.
"""

from __future__ import annotations

import argparse
import html
import re
from datetime import datetime
from pathlib import Path
from urllib.parse import quote

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[1]
POSTS_DIR = ROOT / "source" / "_posts"
PHOTO_WALL = ROOT / "source" / "photos" / "index.md"
IMAGE_RE = re.compile(
    r'<img\s+class="blogger-import-image"[^>]*\s+src="(/images/blogger-import/[^\"]+)"[^>]*>',
    re.IGNORECASE,
)
TITLE_RE = re.compile(r'^title:\s*(.+?)\s*$', re.MULTILINE)
DATE_RE = re.compile(r'^date:\s*(\d{4}-\d{2}-\d{2})', re.MULTILINE)
CATEGORIES_RE = re.compile(r'^categories:\s*(.+?)\s*$', re.MULTILINE)
PHOTO_WALL_CATEGORIES = {"音樂", "閱讀與影視"}
SECTIONS = (
    {
        "key": "music",
        "title": "音樂推薦",
        "eyebrow": "01 / LISTEN",
        "description": "歌曲推薦與那些留在耳邊的片段。",
    },
    {
        "key": "books",
        "title": "書籍閱讀",
        "eyebrow": "02 / READ",
        "description": "讀過的書、小說與還想回頭翻閱的段落。",
    },
    {
        "key": "films",
        "title": "觀影紀錄",
        "eyebrow": "03 / WATCH",
        "description": "看過的電影與影像，留下當時的觀看痕跡。",
    },
)
SECTION_KEYS = {section["key"] for section in SECTIONS}
SECTION_START_MARKERS = {
    key: f"<!-- BLOGGER_IMPORT_PHOTO_WALL:{key.upper()}:START -->"
    for key in SECTION_KEYS
}
SECTION_END_MARKERS = {
    key: f"<!-- BLOGGER_IMPORT_PHOTO_WALL:{key.upper()}:END -->"
    for key in SECTION_KEYS
}
LEGACY_START_MARKER = "<!-- BLOGGER_IMPORT_PHOTO_WALL:START -->"
LEGACY_END_MARKER = "<!-- BLOGGER_IMPORT_PHOTO_WALL:END -->"
CARD_RE = re.compile(r'<div class="ig-card">.*?</div>', re.DOTALL)
IMAGE_SRC_RE = re.compile(r'<img\b[^>]*\bsrc="([^"]+)"', re.IGNORECASE)
LOCAL_DATE_RE = re.compile(r'/((?:19|20)\d{2})/(\d{2})/(\d{2})/')
IMAGE_PATH_RE = re.compile(r'/images/[^"\'\s)]+')


def parse_categories(front_matter: str) -> set[str]:
    match = CATEGORIES_RE.search(front_matter)
    if not match:
        return set()
    raw = match.group(1).strip()
    if raw.startswith("[") and raw.endswith("]"):
        raw = raw[1:-1]
    return {
        item.strip().strip('"').strip("'")
        for item in raw.split(",")
        if item.strip()
    }


def article_section(title: str, categories: set[str]) -> str:
    if "音樂" in categories:
        return "music"
    if "觀影紀錄" in title or "影片紀錄" in title:
        return "films"
    return "books"


def parse_front_matter(text: str) -> tuple[str, str, set[str]]:
    match = re.match(r"^---\s*\n(.*?)\n---\s*\n", text, re.DOTALL)
    if not match:
        raise ValueError("missing front matter")
    front_matter = match.group(1)
    title_match = TITLE_RE.search(front_matter)
    date_match = DATE_RE.search(front_matter)
    if not title_match or not date_match:
        raise ValueError("missing title or date")
    title = title_match.group(1).strip().strip('"').strip("'")
    return title, date_match.group(1), parse_categories(front_matter)


def imported_articles() -> list[dict]:
    articles = []
    for post_path in POSTS_DIR.rglob("*.md"):
        text = post_path.read_text(encoding="utf-8")
        if "blogger-import-image" not in text:
            continue
        title, date, categories = parse_front_matter(text)
        if not categories.intersection(PHOTO_WALL_CATEGORIES):
            continue
        refs = [match.group(1) for match in IMAGE_RE.finditer(text)]
        if not refs:
            continue
        relative = post_path.relative_to(POSTS_DIR)
        folder = relative.parent.as_posix()
        stem = post_path.stem
        article_url = "/" + "/".join(
            [date[0:4], date[5:7], date[8:10], folder, stem.replace(" ", "-")]
        ) + "/"
        articles.append(
            {
                "path": post_path,
                "title": title,
                "date": date,
                "folder": folder,
                "stem": stem,
                "article_url": quote(article_url, safe="/:@&+$,-_.!~*'()"),
                "images": refs,
                "section": article_section(title, categories),
            }
        )
    return sorted(articles, key=lambda item: (item["date"], item["title"]), reverse=True)


def flatten_alpha(image: Image.Image) -> Image.Image:
    image = ImageOps.exif_transpose(image)
    if image.mode in ("RGBA", "LA") or "transparency" in image.info:
        rgba = image.convert("RGBA")
        background = Image.new("RGB", rgba.size, "#f4f0e6")
        background.paste(rgba, mask=rgba.getchannel("A"))
        return background
    return image.convert("RGB")


def build_thumbnails(articles: list[dict], write: bool) -> tuple[list[dict], int]:
    wall_images = []
    total_bytes = 0
    for article in articles:
        article_folder = Path("source") / "images" / "blogger-import" / "thumbs" / Path(article["images"][0]).parent.name
        # The wall uses one representative image per article.  Extra images
        # remain available inside the article but do not make the wall longer.
        image_url = article["images"][0]
        source_path = ROOT / "source" / image_url.lstrip("/").replace("/", "\\")
        if not source_path.exists():
            raise FileNotFoundError(source_path)
        thumb_rel = article_folder / "01.webp"
        thumb_path = ROOT / thumb_rel
        thumb_url = "/" + thumb_rel.relative_to("source").as_posix()
        if write:
            thumb_path.parent.mkdir(parents=True, exist_ok=True)
            with Image.open(source_path) as source_image:
                thumb = ImageOps.fit(
                    flatten_alpha(source_image),
                    (480, 480),
                    method=Image.Resampling.LANCZOS,
                    centering=(0.5, 0.5),
                )
                thumb.save(thumb_path, "WEBP", quality=82, method=6)
            total_bytes += thumb_path.stat().st_size
        wall_images.append(
            {
                "title": article["title"],
                "date": article["date"],
                "index": 1,
                "href": article["article_url"],
                "src": thumb_url,
                "section": article["section"],
            }
        )
    return wall_images, total_bytes


def card_markup(item: dict) -> list[str]:
    alt = html.escape(f"{item['title']}｜主圖", quote=True)
    return [
        '  <div class="ig-card">',
        f'    <a href="{item["href"]}" target="_blank">',
        f'      <img loading="lazy" decoding="async" src="{item["src"]}" alt="{alt}">',
        "    </a>",
        "  </div>",
        "",
    ]


def marker_spans(text: str) -> list[tuple[int, int]]:
    marker_pairs = [(LEGACY_START_MARKER, LEGACY_END_MARKER)]
    marker_pairs.extend(
        (SECTION_START_MARKERS[key], SECTION_END_MARKERS[key])
        for key in SECTION_KEYS
    )
    spans = []
    for start_marker, end_marker in marker_pairs:
        pattern = re.compile(
            re.escape(start_marker) + r".*?" + re.escape(end_marker), re.DOTALL
        )
        spans.extend((match.start(), match.end()) for match in pattern.finditer(text))
    return spans


def post_image_dates() -> dict[str, str]:
    dates = {}
    for post_path in POSTS_DIR.rglob("*.md"):
        text = post_path.read_text(encoding="utf-8")
        date_match = DATE_RE.search(text)
        if not date_match:
            continue
        date = date_match.group(1)
        for image_path in IMAGE_PATH_RE.findall(text):
            dates[image_path] = date
    return dates


def manual_card_section(card: str) -> str:
    image_match = IMAGE_SRC_RE.search(card)
    if not image_match:
        raise ValueError("photo-wall card is missing an image source")
    source = image_match.group(1)
    if "/images/song_" in source:
        return "music"
    if "/images/book_" in source:
        return "books"
    if "/images/drama_" in source:
        return "films"
    raise ValueError(f"unsupported photo-wall image source: {source}")


def manual_card_date(card: str, image_dates: dict[str, str]) -> str:
    href_match = re.search(r'href="([^"]+)"', card)
    if href_match:
        local_date = LOCAL_DATE_RE.search(href_match.group(1))
        if local_date:
            return "-".join(local_date.groups())
    image_match = IMAGE_SRC_RE.search(card)
    if image_match:
        return image_dates.get(image_match.group(1), "")
    return ""


def existing_manual_cards(text: str) -> dict[str, list[str]]:
    spans = marker_spans(text)
    image_dates = post_image_dates()
    grouped = {key: [] for key in SECTION_KEYS}
    cards = []
    seen_cards = set()
    for position, match in enumerate(CARD_RE.finditer(text)):
        if any(start <= match.start() < end for start, end in spans):
            continue
        card = match.group(0).strip()
        section = manual_card_section(card)
        href_match = re.search(r'href="([^"]+)"', card)
        image_match = IMAGE_SRC_RE.search(card)
        identity = (
            href_match.group(1) if href_match else "",
            image_match.group(1) if image_match else "",
        )
        if identity in seen_cards:
            continue
        seen_cards.add(identity)
        cards.append(
            {
                "section": section,
                "date": manual_card_date(card, image_dates),
                "position": position,
                "markup": card,
            }
        )
    for item in cards:
        grouped[item["section"]].append(item)
    for key in SECTION_KEYS:
        grouped[key].sort(
            key=lambda item: (item["date"], item["position"]), reverse=True
        )
        grouped[key] = [item["markup"] for item in grouped[key]]
    return grouped


def section_markup(
    section: dict, generated: list[dict], manual: list[str]
) -> list[str]:
    key = section["key"]
    title_id = f"photo-wall-{key}-title"
    lines = [
        f'<section class="photo-wall-section photo-wall-section--{key}" id="photo-wall-{key}" data-photo-wall-section="{key}">',
        '  <header class="photo-wall-section__header">',
        f'    <span class="photo-wall-section__eyebrow">{section["eyebrow"]}</span>',
        f'    <h2 id="{title_id}">{section["title"]}</h2>',
        f'    <p>{section["description"]}</p>',
        "  </header>",
        f'  <div class="ig-grid" data-photo-wall-grid="{key}" aria-labelledby="{title_id}">',
    ]
    # Manual covers are kept first so recent additions remain easy to find.
    for card in manual:
        lines.extend(f"  {line}" for line in card.splitlines())
        lines.append("")
    lines.append(SECTION_START_MARKERS[key])
    for item in generated:
        lines.extend(card_markup(item))
    lines.append(SECTION_END_MARKERS[key])
    lines.extend(["  </div>", "</section>", ""])
    return lines


def wall_markup(images: list[dict], manual: dict[str, list[str]]) -> str:
    generated = {key: [] for key in SECTION_KEYS}
    for image in images:
        generated[image["section"]].append(image)
    counts = {
        key: len(generated[key]) + len(manual[key]) for key in SECTION_KEYS
    }
    total_count = sum(counts.values())
    lines = [
        '<nav class="photo-wall-index" aria-label="圖牆分類" data-photo-wall-filter-group>',
        '  <span class="photo-wall-index__label">PHOTO WALL / INDEX</span>',
        f'  <button type="button" data-photo-wall-filter="all" aria-pressed="false">全部 <span>{total_count}</span></button>',
    ]
    for section in SECTIONS:
        lines.append(
            f'  <button type="button" data-photo-wall-filter="{section["key"]}" aria-pressed="{str(section["key"] == "music").lower()}">{section["title"]} <span>{counts[section["key"]]}</span></button>'
        )
    lines.append("</nav>")
    for section in SECTIONS:
        lines.extend(
            section_markup(
                section,
                generated[section["key"]],
                manual[section["key"]],
            )
        )
    lines.extend(
        [
            '<script>',
            '  (function() {',
            '    var filters = Array.from(document.querySelectorAll("[data-photo-wall-filter]"));',
            '    var sections = Array.from(document.querySelectorAll("[data-photo-wall-section]"));',
            '    var validKeys = ["music", "books", "films"];',
            '',
            '    function keyFromHash() {',
            '      var match = window.location.hash.match(/^#photo-wall-(music|books|films)(?:-title)?$/);',
            '      return match ? match[1] : "music";',
            '    }',
            '',
            '    function showSection(key) {',
            '      var showAll = key === "all";',
            '      sections.forEach(function(section) {',
            '        section.hidden = !showAll && section.dataset.photoWallSection !== key;',
            '      });',
            '      filters.forEach(function(filter) {',
            '        var active = filter.dataset.photoWallFilter === key;',
            '        filter.classList.toggle("is-active", active);',
            '        filter.setAttribute("aria-pressed", String(active));',
            '      });',
            '    }',
            '',
            '    function focusHashTarget() {',
            '      var targetId = window.location.hash.slice(1);',
            '      var target = targetId ? document.getElementById(targetId) : null;',
            '      if (target) {',
            '        target.scrollIntoView({block: "start"});',
            '      }',
            '    }',
            '',
            '    filters.forEach(function(filter) {',
            '      filter.addEventListener("click", function() {',
            '        var key = filter.dataset.photoWallFilter;',
            '        showSection(key);',
            '        if (key !== "all" && validKeys.indexOf(key) !== -1) {',
            '          window.history.replaceState(null, "", "#photo-wall-" + key);',
            '        } else {',
            '          window.history.replaceState(null, "", window.location.pathname + window.location.search);',
            '        }',
            '      });',
            '    });',
            '',
            '    window.addEventListener("hashchange", function() {',
            '      showSection(keyFromHash());',
            '      focusHashTarget();',
            '    });',
            '',
            '    showSection(keyFromHash());',
            '    if (window.location.hash) {',
            '      window.setTimeout(focusHashTarget, 0);',
            '    }',
            '  })();',
            '</script>',
        ]
    )
    return "\n".join(lines).rstrip() + "\n"


def update_photo_wall(images: list[dict], write: bool) -> int:
    raw = PHOTO_WALL.read_text(encoding="utf-8")
    newline = "\r\n" if "\r\n" in raw else "\n"
    text = raw.replace("\r\n", "\n")
    manual = existing_manual_cards(text)
    front_matter = re.match(r"^---\s*\n.*?\n---\s*\n", text, re.DOTALL)
    if not front_matter:
        raise ValueError("could not find photo-wall front matter")
    updated = front_matter.group(0) + "\n" + wall_markup(images, manual)
    old_cards = len(CARD_RE.findall(text))
    new_cards = len(CARD_RE.findall(updated))
    if write:
        PHOTO_WALL.write_bytes(updated.replace("\n", newline).encode("utf-8"))
    return new_cards - old_cards


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true", help="write thumbnails and update the wall")
    args = parser.parse_args()

    articles = imported_articles()
    images, thumbnail_bytes = build_thumbnails(articles, args.write)
    added = update_photo_wall(images, args.write)
    mode = "已寫入" if args.write else "預覽"
    print(f"{mode}：{len(articles)} 篇文章、{len(images)} 張圖牆圖片、增加 {added} 個卡片")
    if args.write:
        print(f"圖牆縮圖：{thumbnail_bytes / 1024 / 1024:.2f} MiB（480×480 WebP）")
    else:
        print("使用 --write 才會建立縮圖並更新 source/photos/index.md")


if __name__ == "__main__":
    main()
