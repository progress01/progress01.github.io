"""Shared, fail-closed scope handling for Blogger maintenance tools."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import re
import subprocess


ROOT = Path(__file__).resolve().parents[1]
POSTS_DIR = ROOT / "source" / "_posts"


class ScopeError(ValueError):
    pass


FRONT_MATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*(?:\n|$)", re.DOTALL)
_YAML_FIELDS_SCRIPT = r'''
const yaml = require('js-yaml');
const fs = require('fs');
const value = yaml.load(fs.readFileSync(0, 'utf8'));
if (!value || typeof value !== 'object' || Array.isArray(value)) {
  throw new Error('front matter must be a YAML mapping');
}
const fields = {title: value.title, date: value.date, permalink: value.permalink, categories: value.categories};
process.stdout.write(JSON.stringify(fields));
'''


def parse_front_matter_fields(text: str) -> dict:
    """Parse the metadata with the repository's real js-yaml dependency.

    The Python tools preserve the original front-matter bytes when writing;
    this helper is only for classification and target URL/metadata decisions.
    """
    match = FRONT_MATTER_RE.match(text)
    if not match:
        raise ValueError("missing front matter")
    try:
        result = subprocess.run(
            ["node", "-e", _YAML_FIELDS_SCRIPT],
            cwd=ROOT,
            input=match.group(1),
            text=True,
            encoding="utf-8",
            capture_output=True,
            check=True,
        )
        fields = json.loads(result.stdout)
    except (FileNotFoundError, subprocess.CalledProcessError, json.JSONDecodeError) as error:
        raise ScopeError("無法使用 node/js-yaml 解析文章 front matter") from error
    if not isinstance(fields, dict):
        raise ValueError("front matter must be a mapping")
    return fields


def resolve_repo_subpath(path: Path, root: Path, boundary: Path, label: str) -> Path:
    """Resolve a path while rejecting lexical and resolved escapes.

    Checking both forms catches a source/images directory (or any descendant)
    implemented as a symlink/junction to outside the repository.
    """
    repo_lexical = root.absolute()
    boundary_lexical = boundary.absolute()
    candidate = path if path.is_absolute() else repo_lexical / path
    candidate = candidate.absolute()
    try:
        candidate.relative_to(boundary_lexical)
    except ValueError as error:
        raise ScopeError(f"{label} 必須位於允許目錄內：{candidate}") from error
    repo_resolved = root.resolve()
    boundary_resolved = boundary.resolve()
    candidate_resolved = candidate.resolve(strict=False)
    try:
        candidate_resolved.relative_to(repo_resolved)
        candidate_resolved.relative_to(boundary_resolved)
    except ValueError as error:
        raise ScopeError(f"{label} 的 symlink/junction 解析後越界：{candidate}") from error
    return candidate_resolved


def add_scope_arguments(parser: argparse.ArgumentParser) -> None:
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--post", type=Path, action="append", help="只處理指定的 source/_posts Markdown 文章（可重複）")
    group.add_argument("--all", action="store_true", help="明確處理整站 Blogger 文章")
    parser.add_argument("--write", action="store_true", help="套用變更")


def resolve_posts(post: Path | list[Path] | None, all_posts: bool, write: bool, root: Path = ROOT) -> list[Path]:
    posts_dir_lexical = root / "source" / "_posts"
    posts_dir = resolve_repo_subpath(posts_dir_lexical, root, root, "文章目錄")
    if post is None and not all_posts and write:
        raise ScopeError("--write 必須搭配 --post 或 --all")
    if post is not None:
        candidates = post if isinstance(post, list) else [post]
        resolved = []
        for item in candidates:
            candidate = item if item.is_absolute() else root / item
            candidate = resolve_repo_subpath(candidate, root, posts_dir_lexical, "--post")
            if candidate.suffix.lower() != ".md" or not candidate.is_file():
                raise ScopeError("--post 必須是存在的 Markdown 檔案")
            if candidate not in resolved: resolved.append(candidate)
        return resolved
    if all_posts or not write:
        selected = []
        for candidate in posts_dir.rglob("*.md"):
            selected.append(resolve_repo_subpath(candidate, root, posts_dir_lexical, "文章"))
        return sorted(set(selected))
    return []


def display_paths(paths: list[Path], root: Path = ROOT) -> list[str]:
    return [path.resolve().relative_to(root.resolve()).as_posix() for path in paths]
