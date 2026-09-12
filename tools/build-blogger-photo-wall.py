"""Build photo-wall thumbnails and entries for imported Blogger articles.

The imported article images remain at their article-friendly size.  The photo
wall gets separate square WebP thumbnails so browsing the wall does not make
the browser download every full-size image.
"""

from __future__ import annotations

import argparse
import html
import re
from io import BytesIO
from datetime import datetime
from pathlib import Path
from urllib.parse import quote, unquote

from PIL import Image, ImageOps

from blogger_scope import (
    ScopeError,
    add_scope_arguments,
    display_paths,
    parse_front_matter_fields,
    resolve_posts,
    resolve_repo_subpath,
)


ROOT = Path(__file__).resolve().parents[1]
POSTS_DIR = ROOT / "source" / "_posts"
PHOTO_WALL = ROOT / "source" / "photos" / "index.md"
IMAGE_RE = re.compile(
    r'<img\s+class="blogger-import-image"[^>]*\s+src="(/images/blogger-import/[^\"]+)"[^>]*>',
    re.IGNORECASE,
)
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


def article_section(title: str, categories: set[str]) -> str:
    if "音樂" in categories:
        return "music"
    if "觀影紀錄" in title or "影片紀錄" in title:
        return "films"
    return "books"


def parse_front_matter(text: str) -> tuple[str, str, set[str], str]:
    fields = parse_front_matter_fields(text)
    title = fields.get("title")
    date = fields.get("date")
    if not isinstance(title, str) or not title.strip() or date is None:
        raise ValueError("missing title or date")
    date_text = str(date)
    date_match = re.match(r"^(\d{4}-\d{2}-\d{2})", date_text)
    if not date_match:
        raise ValueError("invalid article date")
    categories = fields.get("categories", [])
    if isinstance(categories, str):
        categories = [categories]
    if not isinstance(categories, list):
        categories = []
    permalink = fields.get("permalink", "")
    return title.strip(), date_match.group(1), {str(item) for item in categories if item is not None}, str(permalink or "")


def imported_articles(posts: list[Path] | None = None) -> list[dict]:
    articles = []
    for post_path in posts or list(POSTS_DIR.rglob("*.md")):
        text = post_path.read_text(encoding="utf-8")
        if "blogger-import-image" not in text:
            continue
        title, date, categories, permalink = parse_front_matter(text)
        if not categories.intersection(PHOTO_WALL_CATEGORIES):
            continue
        refs = [match.group(1) for match in IMAGE_RE.finditer(text)]
        if not refs:
            continue
        relative = post_path.relative_to(POSTS_DIR.resolve())
        folder = "" if relative.parent == Path(".") else relative.parent.as_posix()
        stem = post_path.stem
        article_url = permalink or ("/" + "/".join(
            [date[0:4], date[5:7], date[8:10], folder, stem.replace(" ", "-")]
        ) + "/")
        if not article_url.startswith("/"):
            article_url = "/" + article_url
        articles.append(
            {
                "path": post_path,
                "title": title,
                "date": date,
                "folder": folder,
                "stem": stem,
                "article_url": quote(article_url, safe="/%:@&+$,-_.!~*'()"),
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


def thumbnail_bytes(source_path: Path) -> bytes:
    with Image.open(source_path) as source_image:
        thumb = ImageOps.fit(
            flatten_alpha(source_image),
            (480, 480),
            method=Image.Resampling.LANCZOS,
            centering=(0.5, 0.5),
        )
        buffer = BytesIO()
        thumb.save(buffer, "WEBP", quality=82, method=6)
        return buffer.getvalue()


def build_thumbnails(articles: list[dict], write: bool) -> tuple[list[dict], int]:
    plan = plan_thumbnails(articles)
    if write:
        apply_thumbnail_plan(plan)
    return plan["images"], sum(len(item["data"]) for item in plan["thumbs"])


def plan_thumbnails(articles: list[dict]) -> dict:
    wall_images = []
    planned = {}
    image_root = resolve_repo_subpath(ROOT / "source" / "images", ROOT, ROOT / "source", "圖片根目錄")
    for article in articles:
        image_reference = unquote(article["images"][0])
        image_name = re.split(r"[?#]", image_reference, maxsplit=1)[0]
        article_folder = Path("source") / "images" / "blogger-import" / "thumbs" / Path(image_name).parent.name
        # The wall uses one representative image per article.  Extra images
        # remain available inside the article but do not make the wall longer.
        image_url = article["images"][0]
        source_path = resolve_repo_subpath(
            image_root / image_name.removeprefix("/images/"),
            ROOT,
            image_root,
            "圖牆圖片來源",
        )
        thumb_rel = article_folder / (Path(image_name).stem + ".webp")
        thumb_path = ROOT / thumb_rel
        thumb_url = "/" + thumb_rel.relative_to("source").as_posix()
        data = thumbnail_bytes(source_path)
        if thumb_rel in planned and planned[thumb_rel] != data:
            raise ScopeError(f"多篇選取文章產生不同縮圖內容：{thumb_rel}")
        planned[thumb_rel] = data
        resolve_repo_subpath(thumb_path, ROOT, image_root, "縮圖目標")
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
    return {"images": wall_images, "thumbs": [{"path": ROOT / relative, "data": data} for relative, data in planned.items()]}


def apply_thumbnail_plan(plan: dict) -> int:
    written = 0
    for item in plan["thumbs"]:
        if item["path"].exists() and item["path"].read_bytes() != item["data"]:
            raise ScopeError(f"既有縮圖內容不同，拒絕覆寫：{item['path']}")
    for item in plan["thumbs"]:
        if not item["path"].exists():
            item["path"].parent.mkdir(parents=True, exist_ok=True)
            item["path"].write_bytes(item["data"])
            written += 1
    return written


def validate_thumbnail_targets(articles: list[dict]) -> None:
    plan = plan_thumbnails(articles)
    for item in plan["thumbs"]:
        if item["path"].exists() and item["path"].read_bytes() != item["data"]:
            raise ScopeError(f"既有縮圖內容不同，拒絕覆寫：{item['path']}")


def card_markup(item: dict) -> list[str]:
    alt = html.escape(f"{item['title']}｜主圖", quote=True)
    href = html.escape(item["href"], quote=True)
    src = html.escape(item["src"], quote=True)
    return [
        '  <div class="ig-card">',
        f'    <a href="{href}" target="_blank">',
        f'      <img loading="lazy" decoding="async" src="{src}" alt="{alt}">',
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
    wall_bytes, added = plan_photo_wall(images)
    if write and wall_bytes != PHOTO_WALL.read_bytes():
        PHOTO_WALL.write_bytes(wall_bytes)
    return added


def plan_photo_wall(images: list[dict]) -> tuple[bytes, int]:
    raw = PHOTO_WALL.read_bytes().decode("utf-8")
    newline = "\r\n" if "\r\n" in raw else "\n"
    text = raw.replace("\r\n", "\n")
    front_matter = re.match(r"^---\s*\n.*?\n---\s*\n", text, re.DOTALL)
    if not front_matter:
        raise ValueError("could not find photo-wall front matter")
    manual = existing_manual_cards(text)
    updated = front_matter.group(0) + "\n" + wall_markup(images, manual)
    return updated.replace("\n", newline).encode("utf-8"), len(CARD_RE.findall(updated)) - len(CARD_RE.findall(text))


def validate_scoped_wall(text: str, images: list[dict]) -> None:
    spans = marker_spans(text)
    for key in SECTION_KEYS:
        starts = text.count(SECTION_START_MARKERS[key])
        ends = text.count(SECTION_END_MARKERS[key])
        if starts != 1 or ends != 1:
            raise ScopeError(f"圖牆 {key} marker 必須各有一組")
    seen = set()
    for match in CARD_RE.finditer(text):
        if any(start <= match.start() < end for start, end in spans):
            continue
        href = re.search(r'href="([^"]+)"', match.group(0))
        if href and href.group(1) in seen:
            raise ScopeError(f"圖牆存在重複文章卡片：{href.group(1)}")
        if href: seen.add(href.group(1))
    for image in images:
        if text.count(f'href="{html.escape(image["href"], quote=True)}"') > 1:
            raise ScopeError(f"指定文章卡片不唯一：{image['href']}")


def update_photo_wall_scoped(images: list[dict], write: bool) -> tuple[int, bool]:
    wall_bytes, added, changed = plan_photo_wall_scoped(images)
    if write and changed:
        PHOTO_WALL.write_bytes(wall_bytes)
    return added, changed


def plan_photo_wall_scoped(images: list[dict]) -> tuple[bytes, int, bool]:
    raw = PHOTO_WALL.read_bytes()
    text = raw.decode("utf-8")
    newline = "\r\n" if b"\r\n" in raw else "\n"
    validate_scoped_wall(text, images)
    updated = text
    changed = False
    for image in images:
        card_matches = list(re.finditer(r'<div class="ig-card">.*?</div>', updated, re.DOTALL))
        escaped_href = html.escape(image["href"], quote=True)
        matching = [match for match in card_matches if f'href="{escaped_href}"' in match.group(0)]
        if matching:
            old_card = matching[0].group(0)
            new_card = re.sub(r'(?<=\bsrc=")[^"]+', html.escape(image["src"], quote=True), old_card, count=1)
            updated = updated.replace(old_card, new_card, 1)
            changed = changed or old_card != new_card
            continue
        marker = SECTION_END_MARKERS[image["section"]]
        card = newline.join(card_markup(image)).rstrip()
        insertion = "    " + card.replace(newline, newline + "    ") + newline
        marker_position = updated.find(marker)
        if marker_position < 0: raise ScopeError(f"找不到圖牆 {image['section']} 結束 marker")
        updated = updated[:marker_position] + insertion + updated[marker_position:]
        changed = True
    return updated.encode("utf-8"), sum(1 for image in images if f'href="{html.escape(image["href"], quote=True)}"' not in text), changed


def validate_photo_wall_path() -> Path:
    wall_path = resolve_repo_subpath(PHOTO_WALL, ROOT, ROOT / "source", "PHOTO_WALL")
    if not wall_path.is_file():
        raise ScopeError(f"PHOTO_WALL 不存在或不是檔案：{wall_path}")
    return wall_path


def validate_wall_plan(wall_bytes: bytes, images: list[dict]) -> None:
    try:
        text = wall_bytes.decode("utf-8")
    except UnicodeDecodeError as error:
        raise ScopeError("PHOTO_WALL 不是有效 UTF-8") from error
    validate_scoped_wall(text, images)


def main() -> None:
    parser = argparse.ArgumentParser()
    add_scope_arguments(parser)
    args = parser.parse_args()
    root = ROOT
    try:
        selected_posts = resolve_posts(args.post, args.all, args.write, root)
        articles = imported_articles(selected_posts if args.post else None)
        if args.post and len(articles) != len(selected_posts):
            supported = {article["path"].resolve() for article in articles}
            unsupported = [post for post in selected_posts if post.resolve() not in supported]
            raise ScopeError("指定文章不支援 Blogger 圖牆或缺少可用圖片：" + ", ".join(display_paths(unsupported, root)))
        validate_photo_wall_path()
        thumbnail_plan = plan_thumbnails(articles)
        images = thumbnail_plan["images"]
        if args.post:
            wall_bytes, added, wall_changed = plan_photo_wall_scoped(images)
        else:
            wall_bytes, added = plan_photo_wall(images)
            wall_changed = wall_bytes != PHOTO_WALL.read_bytes()
        validate_wall_plan(wall_bytes, images)
    except (ScopeError, OSError, UnicodeError, ValueError) as error:
        parser.error(str(error))
    thumbnail_bytes = sum(len(item["data"]) for item in thumbnail_plan["thumbs"])
    if args.write:
        apply_thumbnail_plan(thumbnail_plan)
        if wall_changed:
            PHOTO_WALL.write_bytes(wall_bytes)
    mode = "已寫入" if args.write else "預覽"
    print(f"{mode}：{len(articles)} 篇文章、{len(images)} 張圖牆圖片、增加 {added} 個卡片")
    if args.write:
        print(f"圖牆縮圖：{thumbnail_bytes / 1024 / 1024:.2f} MiB（480×480 WebP）")
    else:
        print("使用 --write 才會建立縮圖並更新 source/photos/index.md")
    print("選取：" + ("、".join(display_paths(selected_posts, root)) if selected_posts else "無"))
    print("圖牆變更：" + ("是" if wall_changed else "否"))


if __name__ == "__main__":
    main()
