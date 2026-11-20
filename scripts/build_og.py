#!/usr/bin/env python3
"""Build a 1200x630 social image for each guide.

Same C2 variant 1 cover as the cards: a video frame graded to THUNDRR blue,
the topic word, and the title (accent phrase in light blue). Frame choice
matches _includes/guides/cover.html: cover_frame wins, otherwise a hash of
the slug into the topic pool in _data/guide_topics.yml.

Writes /assets/img/og/<slug>.jpg. Set the post's image: to that path.

    python3 scripts/build_og.py              # every guide
    python3 scripts/build_og.py <slug> ...   # one or more

Needs google-chrome and the WebP frames already in /assets/img/covers/.
"""
import html
import io
import pathlib
import subprocess
import sys
import tempfile

import yaml
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
POSTS = ROOT / "_posts"
TOPICS = ROOT / "_data" / "guide_topics.yml"
COVERS = ROOT / "assets" / "img" / "covers"
OUT = ROOT / "assets" / "img" / "og"
MAP = "abcdefghijklmnopqrstuvwxyz0123456789-"

CSS = """
html,body{margin:0;background:#04050A}
.cv{position:relative;display:block;width:1200px;height:630px;overflow:hidden;
  container-type:inline-size;isolation:isolate;font-family:Montserrat,system-ui,sans-serif;
  color:#EEF1F8;text-align:left;
  background:radial-gradient(70% 100% at 0% 110%,rgba(47,107,255,.30),transparent 60%),#04050A}
.cv > *{position:absolute;z-index:2}
.cv-ph{top:0;right:0;bottom:0;left:auto;z-index:0;width:62%;height:100%;object-fit:cover;
  object-position:var(--pos,50% 40%);filter:grayscale(1) contrast(1.18) brightness(.95)}
.cv::before{content:'';position:absolute;top:0;right:0;bottom:0;width:62%;z-index:1;
  mix-blend-mode:color;background:#2F6BFF;opacity:.82}
.cv-shade{inset:0;z-index:1;background:
  linear-gradient(90deg,#04050A 0%,#04050A 38%,rgba(4,5,10,.6) 54%,rgba(4,5,10,0) 80%),
  linear-gradient(0deg,rgba(4,5,10,.6) 0%,transparent 40%)}
.cv-mark{left:6cqw;top:5.6cqw;height:3.4cqw;width:auto;opacity:.85}
.cv-txt{left:6cqw;right:40cqw;bottom:7cqw;display:flex;flex-direction:column;
  align-items:flex-start;gap:2.6cqw}
.cv-t{position:static;margin:0;font-weight:800;font-size:var(--fs,6.4cqw);line-height:1.06;
  letter-spacing:-.025em;text-wrap:balance;display:-webkit-box;-webkit-box-orient:vertical;
  -webkit-line-clamp:3;overflow:hidden}
.cv.long .cv-t{--fs:5.6cqw}
.cv.xlong .cv-t{--fs:4.8cqw}
.cv-t em{font-style:normal;color:#9DB8FF}
.cv-lab{font-size:2.3cqw;font-weight:600;letter-spacing:.24em;text-transform:uppercase;
  color:#9DB8FF;line-height:1}
"""


def load_topics():
    data = yaml.safe_load(TOPICS.read_text())
    labels = {row["id"]: row.get("label") or row["title"] for row in data["order"]}
    labels[None] = (data.get("more") or {}).get("label") or "Guides"
    return data, labels


def front_matter(path):
    text = path.read_text()
    if not text.startswith("---"):
        raise SystemExit(f"{path.name} has no front matter")
    end = text.find("\n---", 3)
    return yaml.safe_load(text[3:end])


def slug_of(path):
    name = path.name
    # _posts/YYYY-MM-DD-slug.md
    return name[11:-3] if name[10] == "-" else name[:-3]


def frame_hash(slug):
    total = 0
    for i, ch in enumerate(slug):
        pos = MAP.find(ch)
        if pos < 0:
            pos = len(MAP)
        total += pos + (i + 1)
    return total


def pick_frame(fm, slug, topics):
    frames = topics["frames"]
    chosen = fm.get("cover_frame")
    if chosen and chosen in frames["file"]:
        return chosen
    topic = (topics.get("by_slug") or {}).get(slug)
    pool = (frames.get("pools") or {}).get(topic) or frames["pools"]["fallback"]
    return pool[frame_hash(slug) % len(pool)]


def cover_title(fm):
    custom = fm.get("cover_title")
    if custom:
        return str(custom).strip()
    return str(fm["title"]).split(":", 1)[0].strip()


def title_html(title, accent):
    if accent and accent in title:
        i = title.rfind(accent)
        return (
            html.escape(title[:i])
            + "<em>"
            + html.escape(accent)
            + "</em>"
            + html.escape(title[i + len(accent) :])
        )
    return html.escape(title)


def page(slug, fm, topics, labels):
    title = cover_title(fm)
    topic = (topics.get("by_slug") or {}).get(slug)
    label = labels.get(topic) or labels[None]
    frame = pick_frame(fm, slug, topics)
    src = (COVERS / topics["frames"]["file"][frame]).resolve().as_uri()
    mark = (COVERS / "wordmark.png").resolve().as_uri()
    pos = topics["frames"]["pos"].get(frame, "50% 40%")
    # Titles past 46 characters overflow three lines at the OG size.
    long = " xlong" if len(title) > 46 else ""
    body = (
        f'<div class="cv cv-c2 lab-kicker og{long}">'
        f'<img class="cv-ph" src="{src}" alt="" style="--pos:{pos}">'
        f'<span class="cv-shade"></span>'
        f'<img class="cv-mark" src="{mark}" alt="">'
        f'<span class="cv-txt"><span class="cv-lab">{html.escape(label)}</span>'
        f'<span class="cv-t">{title_html(title, fm.get("accent") or "")}</span></span></div>'
    )
    return (
        "<!doctype html><html><head><meta charset=\"utf-8\">"
        "<link href=\"https://fonts.googleapis.com/css2?family=Montserrat:wght@600;800&display=block\" rel=\"stylesheet\">"
        f"<style>{CSS}</style></head><body>{body}</body></html>"
    )


def chrome_bin():
    for candidate in ("/opt/google/chrome/chrome", "/usr/bin/google-chrome-stable", "google-chrome"):
        if candidate == "google-chrome" or pathlib.Path(candidate).is_file():
            return candidate
    raise SystemExit("google-chrome not found")


def shoot(html_path, png_path):
    # Call the Chrome binary directly. A `google-chrome` wrapper on some
    # machines keeps the browser open for debugging and never writes the shot.
    subprocess.run(
        [
            chrome_bin(),
            "--headless=new",
            "--no-sandbox",
            "--disable-gpu",
            "--disable-dev-shm-usage",
            "--hide-scrollbars",
            "--allow-file-access-from-files",
            "--force-device-scale-factor=1",
            "--window-size=1200,630",
            "--virtual-time-budget=8000",
            f"--user-data-dir={png_path.parent / 'chrome-profile'}",
            f"--screenshot={png_path}",
            html_path.as_uri(),
        ],
        check=True,
        capture_output=True,
    )


def to_jpeg(png_path, jpg_path):
    im = Image.open(png_path).convert("RGB")
    if im.size != (1200, 630):
        im = im.resize((1200, 630), Image.Resampling.LANCZOS)
    best = None
    for quality in (92, 88, 84, 80, 76, 72, 68, 64, 60, 56, 52):
        buf = io.BytesIO()
        im.save(buf, "JPEG", quality=quality, optimize=True, progressive=True, subsampling=0)
        size = buf.tell()
        best = (size, quality, buf.getvalue())
        if size <= 120_000:
            break
    size, quality, data = best
    if size < 60_000:
        for quality in (94, 96, 98):
            buf = io.BytesIO()
            im.save(buf, "JPEG", quality=quality, optimize=True, progressive=True, subsampling=0)
            if buf.tell() <= 120_000:
                size, data = buf.tell(), buf.getvalue()
            else:
                break
    jpg_path.write_bytes(data)
    return jpg_path.stat().st_size


def main(argv):
    topics, labels = load_topics()
    wanted = set(argv)
    paths = sorted(POSTS.glob("*.md"))
    if wanted:
        paths = [p for p in paths if slug_of(p) in wanted]
        missing = wanted - {slug_of(p) for p in paths}
        if missing:
            raise SystemExit(f"no post for: {', '.join(sorted(missing))}")
    OUT.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="thundrr-og-") as tmp:
        tmp = pathlib.Path(tmp)
        for path in paths:
            slug = slug_of(path)
            fm = front_matter(path)
            html_path = tmp / f"{slug}.html"
            png_path = tmp / f"{slug}.png"
            html_path.write_text(page(slug, fm, topics, labels))
            shoot(html_path, png_path)
            size = to_jpeg(png_path, OUT / f"{slug}.jpg")
            frame = pick_frame(fm, slug, topics)
            print(f"{slug}  {frame}  {size // 1024} KB  -> assets/img/og/{slug}.jpg")
    print("set image: /assets/img/og/<slug>.jpg in the post front matter")


if __name__ == "__main__":
    main(sys.argv[1:])
