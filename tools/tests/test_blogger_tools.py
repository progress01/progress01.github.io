import importlib.util
import contextlib
import io
import tempfile
import unittest
from pathlib import Path
import sys

from PIL import Image

sys.path.insert(0, str(Path(__file__).parents[1]))

from blogger_scope import ScopeError, resolve_posts


def load_tool(name):
    path = Path(__file__).parents[1] / f"{name}.py"
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


NORMALIZER = load_tool("normalize-blogger-imports")
CONVERTER = load_tool("convert-images-to-webp")
WALL = load_tool("build-blogger-photo-wall")


class BloggerToolFixtureTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.posts = self.root / "source" / "_posts"
        self.images = self.root / "source" / "images" / "blogger-import" / "alpha"
        self.posts.mkdir(parents=True)
        self.images.mkdir(parents=True)
        self.a = self.posts / "alpha.md"
        self.b = self.posts / "beta.md"
        front = "---\ntitle: Alpha\ndate: 2026-01-01 12:00:00\npermalink: /custom/alpha/\ncategories: [音樂]\nblogger_import: true\n---\n"
        self.a.write_text(front + '<img class="blogger-import-image" src="/images/blogger-import/alpha/song.png">\n\n原文\n', encoding="utf-8")
        self.b.write_text(front.replace("Alpha", "Beta") + "unrelated\n", encoding="utf-8")
        Image.new("RGB", (8, 6), "red").save(self.images / "song.png")

    def tearDown(self):
        self.temp.cleanup()

    def test_scope_write_requires_explicit_and_rejects_outside(self):
        with self.assertRaises(ScopeError):
            resolve_posts(None, False, True, self.root)
        with self.assertRaises(ScopeError):
            resolve_posts(Path("missing.md"), False, False, self.root)
        self.assertEqual(resolve_posts(Path("source/_posts/alpha.md"), False, False, self.root), [self.a.resolve()])

    def test_normalizer_and_converter_only_touch_selected_article(self):
        before_b = self.b.read_bytes()
        result, changed = NORMALIZER.normalize_file(self.a, True)
        self.assertTrue(changed)
        self.assertEqual(self.b.read_bytes(), before_b)
        mapping = CONVERTER.references_for_posts([self.a], self.root / "source" / "images")
        destination = self.images / "song.webp"
        CONVERTER.convert_image(self.images / "song.png", destination)
        CONVERTER.update_references(self.root, mapping, True, [self.a])
        self.assertTrue(destination.exists())
        self.assertTrue((self.images / "song.png").exists())
        self.assertEqual(self.b.read_bytes(), before_b)
        first = self.a.read_bytes()
        _, changed_again = NORMALIZER.normalize_file(self.a, True)
        self.assertFalse(changed_again)
        self.assertEqual(self.a.read_bytes(), first)

    def test_scoped_wall_uses_permalink_and_preserves_manual_layout(self):
        wall_path = self.root / "source" / "photos" / "index.md"
        wall_path.parent.mkdir(parents=True)
        manual = '<div class="ig-card"><a href="/manual/"><img src="/images/song_manual.webp"></a></div>\n'
        sections = []
        for key in ("music", "books", "films"):
            sections.append(f'<section data-photo-wall-section="{key}"><div class="ig-grid">\n')
            if key == "music": sections.append(manual)
            sections.append(f'<!-- BLOGGER_IMPORT_PHOTO_WALL:{key.upper()}:START -->\n<!-- BLOGGER_IMPORT_PHOTO_WALL:{key.upper()}:END -->\n</div></section>\n')
        wall_path.write_text("---\ntitle: Photos\n---\n" + "".join(sections) + "<p>hand edit</p>\n", encoding="utf-8")
        WALL.ROOT = self.root
        WALL.POSTS_DIR = self.posts
        WALL.PHOTO_WALL = wall_path
        articles = WALL.imported_articles([self.a])
        images, _ = WALL.build_thumbnails(articles, True)
        added, changed = WALL.update_photo_wall_scoped(images, True)
        self.assertEqual(added, 1)
        self.assertTrue(changed)
        output = wall_path.read_text(encoding="utf-8")
        self.assertIn('href="/custom/alpha/"', output)
        self.assertIn('href="/manual/"', output)
        self.assertIn("<p>hand edit</p>", output)
        first = wall_path.read_bytes()
        added_again, changed_again = WALL.update_photo_wall_scoped(images, True)
        self.assertEqual((added_again, changed_again), (0, False))
        self.assertEqual(wall_path.read_bytes(), first)

    def test_block_categories_use_real_yaml_and_converter_accepts_spaces(self):
        post = self.posts / "block.md"
        post.write_text(
            "---\ntitle: Block\ndate: 2026-01-02\ncategories:\n  - 音樂\nblogger_import: true\n---\n"
            "intro\n\n<img class=\"blogger-import-image\" src=\"/images/blogger-import/alpha/song (live).jpg\">\n",
            encoding="utf-8",
        )
        Image.new("RGB", (8, 6), "blue").save(self.images / "song (live).jpg")
        result, changed = NORMALIZER.normalize_file(post, True)
        self.assertTrue(changed)
        self.assertEqual(result, "歌曲資訊卡")
        mapping = CONVERTER.references_for_posts([post], self.root / "source" / "images")
        self.assertEqual(mapping["/images/blogger-import/alpha/song (live).jpg"], "/images/blogger-import/alpha/song (live).webp")
        self.assertNotIn(".jpg.backup", CONVERTER.LOCAL_RASTER_RE.findall("/images/blogger-import/alpha/song.jpg.backup"))

    def test_converter_rejects_escape_and_wall_protects_different_thumb(self):
        escaped = self.posts / "escape.md"
        escaped.write_text(
            "---\ntitle: Escape\ndate: 2026-01-03\nblogger_import: true\n---\n"
            '<img class="blogger-import-image" src="/images/../outside.png">\n',
            encoding="utf-8",
        )
        with self.assertRaises(ScopeError):
            CONVERTER.references_for_posts([escaped], self.root / "source" / "images")

        old_root, old_posts = WALL.ROOT, WALL.POSTS_DIR
        try:
            WALL.ROOT, WALL.POSTS_DIR = self.root, self.posts
            articles = WALL.imported_articles([self.a])
            thumb = self.root / "source" / "images" / "blogger-import" / "thumbs" / "alpha" / "song.webp"
            thumb.parent.mkdir(parents=True, exist_ok=True)
            thumb.write_bytes(b"different-existing-webp")
            with self.assertRaises(ScopeError):
                WALL.validate_thumbnail_targets(articles)
        finally:
            WALL.ROOT, WALL.POSTS_DIR = old_root, old_posts

    def test_dry_run_only_plans_bytes(self):
        before_post = self.a.read_bytes()
        before_image = (self.images / "song.png").read_bytes()
        _, changed, planned = NORMALIZER.plan_normalization(self.a)
        self.assertTrue(changed)
        self.assertNotEqual(planned, before_post)
        mapping = CONVERTER.references_for_posts([self.a], self.root / "source" / "images")
        CONVERTER.update_references(self.root, mapping, False, [self.a])
        self.assertEqual(self.a.read_bytes(), before_post)
        self.assertEqual((self.images / "song.png").read_bytes(), before_image)

    def test_converter_cli_preflights_all_assets_before_first_write(self):
        post = self.posts / "partial.md"
        post.write_text(
            "---\ntitle: Partial\ndate: 2026-01-04\nblogger_import: true\n---\n"
            '<img src="/images/blogger-import/alpha/song.png">\n'
            '<img src="/images/blogger-import/alpha/missing.png">\n',
            encoding="utf-8",
        )
        before_post = post.read_bytes()
        destination = self.images / "song.webp"
        with contextlib.redirect_stderr(io.StringIO()):
            with self.assertRaises(SystemExit) as error:
                CONVERTER.main(["--post", str(post), "--write"], root=self.root)
        self.assertEqual(error.exception.code, 2)
        self.assertEqual(post.read_bytes(), before_post)
        self.assertFalse(destination.exists())

    def test_raster_references_include_unquoted_frontmatter_and_markdown_query(self):
        post = self.posts / "paths.md"
        image = self.images / "cover (日記).png"
        Image.new("RGB", (8, 6), "green").save(image)
        post.write_text(
            "---\ntitle: Paths\ndate: 2026-01-05\ncover: /images/blogger-import/alpha/cover%20(%E6%97%A5%E8%A8%98).png\n"
            "blogger_import: true\n---\n[cover](/images/blogger-import/alpha/cover%20(%E6%97%A5%E8%A8%98).png?size=small)\n",
            encoding="utf-8",
        )
        mapping = CONVERTER.references_for_posts([post], self.root / "source" / "images")
        self.assertIn("/images/blogger-import/alpha/cover%20(%E6%97%A5%E8%A8%98).png", mapping)
        _, _, _, plans = CONVERTER.plan_reference_updates(self.root, mapping, [post])
        self.assertIn("cover%20(%E6%97%A5%E8%A8%98).webp?size=small", plans[0][1].decode("utf-8"))

    def test_normalizer_rejects_mixed_explicit_scope_before_writing(self):
        plain = self.posts / "plain.md"
        plain.write_text("---\ntitle: Plain\ndate: 2026-01-06\n---\nordinary\n", encoding="utf-8")
        before = self.a.read_bytes()
        with contextlib.redirect_stderr(io.StringIO()):
            with self.assertRaises(SystemExit) as error:
                NORMALIZER.main(["--post", str(self.a), "--post", str(plain), "--write"], root=self.root)
        self.assertEqual(error.exception.code, 2)
        self.assertEqual(self.a.read_bytes(), before)


if __name__ == "__main__":
    unittest.main()
