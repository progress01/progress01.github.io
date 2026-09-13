---
name: blog-excerpt-check
description: "Check Hexo article excerpts for concise archive and index previews before publishing or repairing a target post."
---

# Blog Excerpt Check

Use this skill when adding or revising a post and its `<!-- more -->` boundary may make the home, pagination, category, or archive preview too long. It checks a selected post and does not automatically publish, deploy, truncate prose, or insert a marker into a standalone article.

## Check

From `C:\Blog\blog-1988`, run the repeatable target check:

```powershell
node tools/excerpt-check.js --post "source/_posts/<path>.md"
```

Repeat `--post` for each selected article; do not combine it with `--all`. Both modes are read-only. Use `--all` only for a site-wide audit. A target repair may change only the authorized article; run the same `--post` check again and inspect the generated card after the edit. Do not treat a missing `<!-- more -->` as a reason to add one when the article is intentionally standalone.

The default limit is 86 visible non-whitespace Unicode characters before `<!-- more -->`, based on the current N+4 example and one short paragraph. Exceeding it is a `FAIL`, not a warning; an intentionally longer excerpt may be reported as an explicit exception only after rendered-card review and must never be relabeled `PASS`. The limit is a conservative guardrail, not a pixel-width guarantee. Preserve the opening meaning and move supporting detail after the marker instead of hard-cutting sentences or words. A front-matter `description` or hand-written `excerpt` can separately control list presentation; the tool reports that condition, and the actual rendered target card still needs review when it applies.

For song posts, retain the fixed HTML information card, cover behavior, and established template. The length check still applies to the preview text; do not replace the card with a generic excerpt. For every post, preserve the author's specified `date`, `permalink`, and unknown front-matter keys. Formatting-only excerpt work does not add or refresh `updated`; use the existing metadata rules for substantive edits.

## Acceptance

- The CLI reports `PASS`, `WARN`, or `FAIL`: `PASS` has no static warning; `WARN` is the `REVIEW` state and exits successfully but requires human review of the generated target card; `FAIL`/`ERROR` is a failed check with a non-zero exit. Report the command and output, and never treat `WARN` as visual proof or edit unrelated posts to remove it.
- Confirm the target article, its generated URL, and the preview at every location where the theme displays it (home, pagination, category, or other matching archive).
- Check desktop and 320–390px mobile rendering when the excerpt or card appears likely to wrap or overflow; skip broad browser QA when there is no such concern.
- Report warnings that require human review, especially complex markup, front-matter excerpts, or a card whose rendered height still looks wrong. A passing character count does not prove visual layout.
- Keep JSON/YAML index-only changes and `life-index-only` updates outside this check.
