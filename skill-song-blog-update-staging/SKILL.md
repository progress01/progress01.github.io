---
name: song-blog-update
description: Update the user's Hexo song-recommendation posts from supplied song details, listening links, images, dates, and personal notes. Use when the user asks to add or revise a song article, copy a cover image into the blog, and synchronize the photo wall entry.
---

# Song Blog Update

## Purpose

Maintain the user's Hexo blog's song recommendation article, cover image, and photo-wall card as one consistent change. Work in `C:\Blog\blog-1988` unless the user gives another project root.

Photo-wall image rule: every image in `source\photos\index.md` must use native lazy loading and asynchronous decoding with `loading="lazy" decoding="async"`. When synchronizing the photo wall, add these attributes to any existing card that is missing them, without changing the card's visual structure or unrelated content.

Category rule: every song recommendation article stored under `source\_posts\歌曲推薦` must include `categories: [音樂]`. This is a fixed site content rule, not a user-supplied field; add it when creating or repairing a song article.

Do not publish, deploy, commit, or push as part of the normal update. The user must first inspect the result with `hexo clean && hexo s` and separately authorize any release action.

Song article presentation rule: posts stored under `source\_posts\歌曲推薦` automatically receive the shared `post-content-song` class from the post macro. The shared CSS controls the reading width, song-information card, Spotify link button, and mobile image-first layout. Do not add a per-post layout class or duplicate these styles in individual song articles.

## Required Inputs

Collect the following information from the user or infer it only when unambiguous:

- Image file or an existing image path.
- Image identifier `picture`, normally the basename without the `song_` prefix and `.png` extension. When it is omitted, infer it from the song title in the user's text when that title is unambiguous; do not derive it by inspecting the image. Example: `愛作夢的人` maps to `song_愛作夢的人.png`, and `kiss_me` maps to `song_kiss_me.png`.
- Song title, artist, album, listening link, publication date/time, and the user's experience text.

If a listening link is missing, ask before editing. If `picture` is missing but the song title is clear, use the song title as `picture`; ask only when the title is unclear, needs ambiguous normalization, or the target image already exists. If the user supplies only a date, use `12:00:00` when that default is acceptable; otherwise ask for the time. Interpret dates in `Asia/Taipei`.

## Text-First Parsing

Treat the supplied image as a binary asset only. Do not inspect, OCR, or infer the song title, artist, album, or image identifier from the image content.

Prefer the first text block when it follows the user's usual format:

```text
推薦 <artist> 的 <song title>
出自專輯 <album>
```

Parse the artist, song title, and album from those lines. If `picture` was not separately provided, use the parsed song title as the exact image identifier after trimming surrounding whitespace. Use the same inferred `picture` for the image target, article image path, and photo-wall card.

Accept unambiguous dates such as `YYYYMMDD`, `YYYY-MM-DD`, and `YYYY/MM/DD`. When only `MMDD` is supplied and the year is clear from the surrounding blog context, infer that year and state the assumption in the handoff. For malformed dates such as a seven-digit value (`2060721`), ask the user to confirm the intended date instead of silently guessing.

## File Conventions

Use these project paths:

- Article: `source\_posts\歌曲推薦\歌曲推薦-XXX.md`
- Images: `source\images\song_<picture>.png`
- Photo wall: `source\photos\index.md`

Keep the article filename pattern `歌曲推薦-XXX.md`. For English filenames, use the user's confirmed form; the common pattern is hyphens in the article filename and underscores in the image basename, such as `歌曲推薦-kiss-me.md` with `song_kiss_me.png`. Do not silently rename an existing file or overwrite an existing image.

## Update Workflow

1. Inspect the repository status and search for an existing article or image with the same title/identifier. If an existing target would be replaced, tell the user exactly what will be replaced and get confirmation.

2. Resolve the exact image target as `source\images\song_<picture>.png`. Copy the supplied image to that target. Preserve the image as a binary file; do not use text editing to recreate it. Verify that the target exists and has nonzero size.

3. Create or update the article at `source\_posts\歌曲推薦\歌曲推薦-XXX.md` using this exact structure, replacing the placeholders with the user's data. Keep the existing inline structure so older song posts and new posts are rendered consistently by the shared song style:

   ```markdown
   ---
   categories: [音樂]
   title: 歌曲推薦-<song title>
   date: YYYY-MM-DD HH:mm:ss
   tags: [音樂推薦, 專輯插圖]
   ---

   <div style="display: flex; gap: 20px; align-items: flex-start;">
     
     <div style="flex: 1; text-align: left;">
       <p style="margin-top: 0;">
         推薦 <artist> 的 <song title>
         <br>
         出自專輯 <album>
         <br>
         <a href="<listening link>" target="_blank">收聽連結 -> 點此前往</a>
       </p>
     </div>

     <div style="width: 150px; flex-shrink: 0;">
       <img src="/images/song_<picture>.png" style="border-radius: 5px; width: 100%; height: auto; box-shadow: 2px 2px 5px rgba(0,0,0,0.2);">
     </div>

   </div>
   <!-- more --> 
   轉載自個人ig每日點播> chjuhsu05
       <br>
       <experience>
   ```

4. Add one photo-wall card to the `.ig-grid` in `source\photos\index.md`:

   ```html
   <div class="ig-card">
     <a href="<listening link>" target="_blank">
       <img loading="lazy" decoding="async" src="/images/song_<picture>.png">
     </a>
   </div>
   ```

   Insert it before the closing `</div>` of the `.ig-grid`, not inside the later script. The page reverses the grid children on load, so appending the new card at the end makes it appear first.

5. Use `apply_patch` for Markdown/HTML text changes. Use a file-copy operation only for the supplied binary image. Do not alter unrelated posts or reformat the whole photo-wall file.

## Validation

Before handing back the change:

- Confirm the article date, title, link, and experience text.
- Confirm the article front matter includes exactly `categories: [音樂]` for a song recommendation post.
- Confirm the exact image target exists: `source\images\song_<picture>.png`.
- Confirm the article and photo wall both use the identical `/images/song_<picture>.png` path and listening URL.
- Confirm a generated song article includes the shared `post-content-song` class; do not modify the post macro for an individual song.
- Confirm every photo-wall `<img>` tag has both `loading="lazy"` and `decoding="async"`, including existing cards retained during the update.
- Run `npm run check:content` when available. If it reports missing categories in other existing posts, report them separately and do not alter unrelated content.
- Check `git diff --check`.
- Run `npx hexo generate --silent` when practical and verify the generated article and image exist under `public`.
- Report changed files and remind the user to run `hexo clean && hexo s`.

Never run `hexo d`, `git commit`, or `git push` unless the user explicitly asks after reviewing the local preview.
