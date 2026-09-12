import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).parents[1]))


def load_tool():
    path = Path(__file__).parents[1] / "build-blogger-photo-wall.py"
    spec = importlib.util.spec_from_file_location("blogger_wall_round4", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


WALL = load_tool()


class BloggerWallRound4Tests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.posts = self.root / "source" / "_posts"
        self.images = self.root / "source" / "images" / "blogger-import" / "alpha"
        self.posts.mkdir(parents=True)
        self.images.mkdir(parents=True)
        self.wall = self.root / "source" / "photos" / "index.md"
        self.wall.parent.mkdir(parents=True)
        sections = []
        for key in ("music", "books", "films"):
            sections.append(
                f'<section data-photo-wall-section="{key}"><div class="ig-grid">\r\n'
                f'{WALL.SECTION_START_MARKERS[key]}\r\n{WALL.SECTION_END_MARKERS[key]}\r\n'
                '</div></section>\r\n'
            )
        self.wall.write_bytes(("---\r\ntitle: Photos\r\n---\r\n" + "".join(sections)).encode("utf-8"))
        front = '---\ntitle: Alpha\ndate: 2026-01-01 12:00:00\npermalink: "/custom/a&b/"\ncategories: [音樂]\n---\n'
        self.a = self.posts / "alpha.md"
        self.a.write_text(front + '<img class="blogger-import-image" src="/images/blogger-import/alpha/song.png">\n', encoding="utf-8")
        Image.new("RGB", (8, 6), "red").save(self.images / "song.png")
        self.old = (WALL.ROOT, WALL.POSTS_DIR, WALL.PHOTO_WALL)
        WALL.ROOT, WALL.POSTS_DIR, WALL.PHOTO_WALL = self.root, self.posts, self.wall

    def tearDown(self):
        WALL.ROOT, WALL.POSTS_DIR, WALL.PHOTO_WALL = self.old
        self.temp.cleanup()

    def test_scoped_crlf_ampersand_is_escaped_and_idempotent(self):
        articles = WALL.imported_articles([self.a])
        images, _ = WALL.build_thumbnails(articles, False)
        self.assertEqual(images[0]["href"], "/custom/a&b/")
        encoded = self.posts / "encoded.md"
        encoded.write_text(self.a.read_text(encoding="utf-8").replace("alpha.md", "encoded.md").replace("Alpha", "Encoded").replace("/custom/a&b/", "/custom/%E4%B8%AD%E6%96%87/"), encoding="utf-8")
        self.assertEqual(WALL.imported_articles([encoded])[0]["article_url"], "/custom/%E4%B8%AD%E6%96%87/")
        added, changed = WALL.update_photo_wall_scoped(images, True)
        self.assertEqual((added, changed), (1, True))
        first = self.wall.read_bytes()
        self.assertNotIn(b"\r\r\n", first)
        self.assertIn(b'href="/custom/a&amp;b/"', first)
        added_again, changed_again = WALL.update_photo_wall_scoped(images, True)
        self.assertEqual((added_again, changed_again), (0, False))
        self.assertEqual(self.wall.read_bytes(), first)

    def test_main_preflights_all_selected_before_writing(self):
        b = self.posts / "beta.md"
        b.write_text(
            '---\ntitle: Beta\ndate: 2026-01-02\ncategories: [音樂]\n---\n'
            '<img class="blogger-import-image" src="/images/blogger-import/alpha/missing.png">\n',
            encoding="utf-8",
        )
        before_wall = self.wall.read_bytes()
        before_thumb = list((self.root / "source" / "images").rglob("*.webp"))
        old_argv = sys.argv
        try:
            sys.argv = ["build-blogger-photo-wall.py", "--post", "source/_posts/alpha.md", "--post", "source/_posts/beta.md", "--write"]
            with self.assertRaises(SystemExit):
                WALL.main()
        finally:
            sys.argv = old_argv
        self.assertEqual(self.wall.read_bytes(), before_wall)
        self.assertEqual(list((self.root / "source" / "images").rglob("*.webp")), before_thumb)

    def test_selected_unsupported_article_is_rejected(self):
        unsupported = self.posts / "unsupported.md"
        unsupported.write_text('---\ntitle: Unsupported\ndate: 2026-01-03\ncategories: [生活紀錄]\n---\ntext\n', encoding="utf-8")
        old_argv = sys.argv
        try:
            sys.argv = ["build-blogger-photo-wall.py", "--post", "source/_posts/unsupported.md"]
            with self.assertRaises(SystemExit):
                WALL.main()
        finally:
            sys.argv = old_argv

    def test_bad_wall_marker_fails_before_writing_thumbnail(self):
        before_wall = self.wall.read_bytes()
        broken = self.wall.read_text(encoding="utf-8").replace(WALL.SECTION_END_MARKERS["music"], "", 1)
        self.wall.write_text(broken, encoding="utf-8", newline="")
        old_argv = sys.argv
        try:
            sys.argv = ["build-blogger-photo-wall.py", "--post", "source/_posts/alpha.md", "--write"]
            with self.assertRaises(SystemExit):
                WALL.main()
        finally:
            sys.argv = old_argv
        self.assertFalse(list((self.root / "source" / "images").rglob("*.webp")))
        self.wall.write_bytes(before_wall)


if __name__ == "__main__":
    unittest.main()
