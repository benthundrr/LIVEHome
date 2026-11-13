#!/usr/bin/env python3
"""Submit the live www.thundrr.co sitemap to IndexNow after GitHub Pages deploys.

This repository publishes from main with the built-in "pages build and
deployment" workflow. Run this after that push. It waits until that workflow
has succeeded and the live site is serving the new deploy, then POSTs the
sitemap URLs to https://api.indexnow.org/indexnow.

The IndexNow key is the 32-hex file in the repository root. Its public URL is
https://www.thundrr.co/<key>.txt. HTTP errors from IndexNow are logged and do
not fail the process.
"""

from __future__ import annotations

import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path

HOST = "www.thundrr.co"
INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow"
PAGES_WORKFLOW_NAME = "pages build and deployment"
USER_AGENT = "thundrr-indexnow"
# GitHub Pages can cache a response for about 10 minutes. Wait long enough
# for that, plus the Pages build itself, then log whatever IndexNow returns.
DEADLINE_SECONDS = 16 * 60
POLL_SECONDS = 15
# Last-Modified is the end of the Pages build, which is after the workflow
# started. A few seconds of clock skew is enough. A wider window would treat
# the previous deploy as already live when two pushes land close together.
KEY_SKEW = timedelta(seconds=5)
LOC_RE = re.compile(
    r"<(?:[A-Za-z0-9]+:)?loc>\s*([^<\s]+)\s*</(?:[A-Za-z0-9]+:)?loc>"
)
KEY_NAME_RE = re.compile(r"[0-9a-f]{32}")


def log(message: str) -> None:
    print(message, flush=True)


def parse_github_time(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed


def last_modified_is_fresh(header_value: str, started: datetime) -> bool:
    try:
        modified = parsedate_to_datetime(header_value)
    except (TypeError, ValueError, IndexError):
        return False
    if modified is None:
        return False
    if modified.tzinfo is None:
        modified = modified.replace(tzinfo=timezone.utc)
    return modified >= started - KEY_SKEW


def extract_urls(xml: str, host: str = HOST) -> list[str]:
    found: list[str] = []
    seen: set[str] = set()
    for match in LOC_RE.findall(xml):
        url = match.strip()
        parsed = urllib.parse.urlparse(url)
        if parsed.scheme not in {"http", "https"}:
            continue
        if parsed.netloc != host or parsed.username or parsed.password:
            continue
        if url in seen:
            continue
        seen.add(url)
        found.append(url)
    return found


def key_files(root: Path) -> list[Path]:
    matches = []
    for path in root.glob("*.txt"):
        if path.parent == root and KEY_NAME_RE.fullmatch(path.stem):
            matches.append(path)
    return sorted(matches)


def load_key(root: Path) -> str:
    matches = key_files(root)
    if len(matches) != 1:
        names = ", ".join(path.name for path in matches) or "(none)"
        raise RuntimeError(f"expected one 32-hex IndexNow key file, found {names}")
    path = matches[0]
    body = path.read_bytes()
    key = path.stem.encode("ascii")
    if body != key:
        raise RuntimeError(f"{path.name} must contain exactly the key and nothing else")
    return path.stem


def github_json(url: str, token: str) -> tuple[int, object]:
    request = urllib.request.Request(
        url,
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {token}",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": USER_AGENT,
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return response.status, json.load(response)
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        try:
            return exc.code, json.loads(raw)
        except json.JSONDecodeError:
            return exc.code, raw


def classify_pages_runs(runs: list[dict]) -> str:
    pages = [run for run in runs if run.get("name") == PAGES_WORKFLOW_NAME]
    if not pages:
        return "missing"
    if any(run.get("status") != "completed" for run in pages):
        return "pending"
    if any(run.get("conclusion") == "success" for run in pages):
        return "success"
    conclusions = {run.get("conclusion") for run in pages}
    if conclusions <= {"cancelled"}:
        return "cancelled"
    return "failed"


def successful_pages_start(runs: list[dict]) -> tuple[datetime | None, str | None]:
    pages = [
        run
        for run in runs
        if run.get("name") == PAGES_WORKFLOW_NAME and run.get("conclusion") == "success"
    ]
    if not pages:
        return None, None
    pages.sort(key=lambda run: run.get("created_at") or "")
    started = pages[0].get("created_at")
    parsed = parse_github_time(started) if started else None
    return parsed, pages[0].get("html_url")


def classify_page_builds(builds: list[dict], sha: str) -> str:
    mine = [build for build in builds if build.get("commit") == sha]
    if not mine:
        return "missing"
    statuses = {build.get("status") for build in mine}
    if "built" in statuses:
        return "success"
    if "errored" in statuses and not (statuses & {"queued", "building", None}):
        return "failed"
    return "pending"


def built_page_start(builds: list[dict], sha: str) -> datetime | None:
    mine = [
        build
        for build in builds
        if build.get("commit") == sha and build.get("status") == "built" and build.get("created_at")
    ]
    if not mine:
        return None
    mine.sort(key=lambda build: build["created_at"])
    return parse_github_time(mine[0]["created_at"])


def fetch(url: str) -> tuple[int | None, object | None, bytes, str]:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Cache-Control": "no-cache",
            "Pragma": "no-cache",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return response.status, response.headers, response.read(), response.geturl()
    except urllib.error.HTTPError as exc:
        return exc.code, exc.headers, exc.read(), getattr(exc, "url", url)
    except Exception as exc:
        return None, None, str(exc).encode("utf-8", errors="replace"), url


def deployment_state(repository: str, sha: str, token: str) -> tuple[str, datetime | None, str | None]:
    runs_url = (
        f"https://api.github.com/repos/{repository}/actions/runs"
        f"?head_sha={sha}&per_page=50"
    )
    code, payload = github_json(runs_url, token)
    state = "missing"
    started: datetime | None = None
    run_url: str | None = None
    if code == 200 and isinstance(payload, dict):
        runs = payload.get("workflow_runs") or []
        if not isinstance(runs, list):
            runs = []
        state = classify_pages_runs(runs)
        if state == "success":
            started, run_url = successful_pages_start(runs)
        elif state == "missing" and runs and not deployment_state.logged_names:
            deployment_state.logged_names = True
            names = sorted({str(run.get("name")) for run in runs})
            log(f"No '{PAGES_WORKFLOW_NAME}' run yet. Runs for this commit: {', '.join(names)}")
    else:
        log(f"Could not list workflow runs (HTTP {code}).")

    if state == "success" and started is not None:
        return state, started, run_url

    builds_url = f"https://api.github.com/repos/{repository}/pages/builds?per_page=30"
    build_code, builds = github_json(builds_url, token)
    if build_code == 200 and isinstance(builds, list):
        build_state = classify_page_builds(builds, sha)
        if state == "missing" or build_state == "success":
            # A built Pages site is the signal we need even if the Actions
            # name lookup has not caught up.
            if build_state == "success":
                build_started = built_page_start(builds, sha)
                return "success", build_started or started, run_url
            if state == "missing":
                state = build_state
    elif state == "missing":
        log(f"Could not list Pages builds (HTTP {build_code}).")
    return state, started, run_url


deployment_state.logged_names = False


def live_site(key: str, started: datetime) -> tuple[bool, str, bytes]:
    key_url = f"https://{HOST}/{key}.txt"
    status, _headers, body, final_url = fetch(key_url)
    text = body.decode("utf-8", errors="replace").strip()
    final_host = urllib.parse.urlparse(final_url).netloc
    key_ok = status == 200 and text == key and final_host == HOST
    exact = body == key.encode("ascii")
    sitemap_url = f"https://{HOST}/sitemap.xml"
    site_status, site_headers, site_body, site_final = fetch(sitemap_url)
    modified = None
    age = None
    if site_headers is not None:
        modified = site_headers.get("Last-Modified")
        age = site_headers.get("Age")
    fresh = bool(modified) and last_modified_is_fresh(str(modified), started)
    site_host = urllib.parse.urlparse(site_final).netloc
    sitemap_ok = site_status == 200 and site_host == HOST
    note = (
        f"key HTTP {status} exact={exact} match={key_ok} url={final_url}; "
        f"sitemap HTTP {site_status} last-modified={modified or 'missing'} "
        f"age={age or 'missing'} fresh={fresh}"
    )
    return key_ok and sitemap_ok and fresh, note, site_body


def should_retry(status: int | None) -> bool:
    if status is None:
        return True
    if status in {403, 429}:
        return True
    return status >= 500


def post_indexnow(key: str, urls: list[str]) -> tuple[int | None, str]:
    payload = {
        "host": HOST,
        "key": key,
        "keyLocation": f"https://{HOST}/{key}.txt",
        "urlList": urls,
    }
    data = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        INDEXNOW_ENDPOINT,
        data=data,
        method="POST",
        headers={
            "Content-Type": "application/json; charset=utf-8",
            "User-Agent": USER_AGENT,
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            return response.status, response.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read().decode("utf-8", errors="replace")
    except Exception as exc:
        return None, str(exc)


def wait_for_deployment(repository: str, sha: str, token: str, deadline: float) -> tuple[datetime | None, str]:
    while True:
        state, started, run_url = deployment_state(repository, sha, token)
        if run_url:
            log(f"Pages workflow: {run_url}")
        log(f"Pages deployment for {sha[:7]}: {state}")
        if state == "success" and started is not None:
            return started, "success"
        if state in {"cancelled", "failed"}:
            return None, state
        if time.monotonic() >= deadline:
            return None, "timeout"
        time.sleep(POLL_SECONDS)


def wait_for_live_sitemap(key: str, started: datetime, deadline: float) -> tuple[bool, bytes]:
    last_body = b""
    while True:
        ready, note, body = live_site(key, started)
        last_body = body
        log(note)
        if ready:
            return True, body
        if time.monotonic() >= deadline:
            return False, last_body
        time.sleep(POLL_SECONDS)


def submit(key: str, urls: list[str], deadline: float) -> int | None:
    attempt = 0
    status: int | None = None
    while True:
        attempt += 1
        status, body = post_indexnow(key, urls)
        if status is None:
            log(f"IndexNow attempt {attempt} failed: {body}")
        else:
            log(f"IndexNow attempt {attempt} HTTP status: {status}")
            if body.strip():
                log(f"IndexNow response body: {body[:2000]}")
        if status in {200, 202} or not should_retry(status) or time.monotonic() >= deadline:
            return status
        if status == 403:
            log("IndexNow returned 403 (key not verifiable yet). Retrying.")
        elif status == 429:
            log("IndexNow returned 429. Retrying.")
        else:
            log(f"IndexNow returned {status}. Retrying.")
        time.sleep(POLL_SECONDS)


def run() -> int:
    token = os.environ.get("GITHUB_TOKEN", "")
    repository = os.environ.get("GITHUB_REPOSITORY", "")
    sha = os.environ.get("GITHUB_SHA", "")
    if not token or not repository or not sha:
        log("GITHUB_TOKEN, GITHUB_REPOSITORY and GITHUB_SHA are required.")
        log("IndexNow HTTP status: skipped")
        return 0

    root = Path(os.environ.get("INDEXNOW_ROOT", "."))
    key = load_key(root)
    log(f"IndexNow key location: https://{HOST}/{key}.txt")
    log(f"Waiting for the Pages deployment of {sha}.")

    deadline = time.monotonic() + DEADLINE_SECONDS
    started, state = wait_for_deployment(repository, sha, token, deadline)
    if started is None:
        log(f"Pages deployment was not successful ({state}). Not calling IndexNow.")
        log("IndexNow HTTP status: skipped")
        return 0

    ready, sitemap_body = wait_for_live_sitemap(key, started, deadline)
    if not ready:
        log("Live sitemap did not show this deployment before the wait ended.")
    if b"<urlset" not in sitemap_body:
        log("Live sitemap response was not a urlset.")
        log("IndexNow HTTP status: skipped")
        return 0

    xml = sitemap_body.decode("utf-8", errors="replace")
    urls = extract_urls(xml)
    if not urls:
        log("No www.thundrr.co URLs found in the live sitemap.")
        log("IndexNow HTTP status: skipped")
        return 0

    log(f"Submitting {len(urls)} URL(s) from https://{HOST}/sitemap.xml")
    for url in urls:
        log(f"  {url}")

    # IndexNow accepts up to 10,000 URLs per request. This sitemap is small.
    reported: int | None = None
    for start in range(0, len(urls), 10000):
        batch = urls[start : start + 10000]
        reported = submit(key, batch, deadline)
    if reported is None:
        log("IndexNow HTTP status: error")
    else:
        log(f"IndexNow HTTP status: {reported}")
        if reported == 403:
            log("403 means IndexNow could not verify the key file yet.")
    return 0


def selftest() -> None:
    xml = """<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://www.thundrr.co/</loc></url>
  <url><loc>https://www.thundrr.co/join/</loc></url>
  <url><loc>https://www.thundrr.co/blog/</loc></url>
  <url><loc>https://www.thundrr.co/blog/what-is-a-tiktok-live-agency/</loc></url>
  <url><loc>https://app.thundrr.co/</loc></url>
  <url><loc>https://example.com/nope</loc></url>
  <url><loc>https://www.thundrr.co/blog/</loc></url>
</urlset>
"""
    urls = extract_urls(xml)
    assert urls == [
        "https://www.thundrr.co/",
        "https://www.thundrr.co/join/",
        "https://www.thundrr.co/blog/",
        "https://www.thundrr.co/blog/what-is-a-tiktok-live-agency/",
    ], urls

    started = datetime(2026, 11, 11, 17, 40, 55, tzinfo=timezone.utc)
    assert last_modified_is_fresh("Wed, 11 Nov 2026 17:41:27 GMT", started)
    assert last_modified_is_fresh("Wed, 11 Nov 2026 17:40:52 GMT", started)
    assert not last_modified_is_fresh("Wed, 11 Nov 2026 17:40:20 GMT", started)
    assert not last_modified_is_fresh("Wed, 11 Nov 2026 15:52:00 GMT", started)
    assert not last_modified_is_fresh("not-a-date", started)
    assert parse_github_time("2026-11-11T17:40:55Z") == started

    assert classify_pages_runs([]) == "missing"
    assert classify_pages_runs([{"name": PAGES_WORKFLOW_NAME, "status": "in_progress"}]) == "pending"
    assert (
        classify_pages_runs(
            [{"name": PAGES_WORKFLOW_NAME, "status": "completed", "conclusion": "success"}]
        )
        == "success"
    )
    assert (
        classify_pages_runs(
            [{"name": PAGES_WORKFLOW_NAME, "status": "completed", "conclusion": "cancelled"}]
        )
        == "cancelled"
    )
    assert classify_page_builds([{"commit": "abc", "status": "built"}], "abc") == "success"
    assert classify_page_builds([{"commit": "abc", "status": "building"}], "abc") == "pending"
    assert classify_page_builds([{"commit": "abc", "status": "errored"}], "abc") == "failed"
    assert should_retry(403) and should_retry(429) and should_retry(None) and should_retry(503)
    assert not should_retry(200) and not should_retry(202) and not should_retry(400)
    assert not should_retry(422)

    import tempfile

    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        key = "0123456789abcdef0123456789abcdef"
        (root / f"{key}.txt").write_bytes(key.encode("ascii"))
        (root / "robots.txt").write_text("User-agent: *\nAllow: /\n", encoding="utf-8")
        assert load_key(root) == key
        (root / f"{key}.txt").write_bytes(key.encode("ascii") + b"\n")
        try:
            load_key(root)
        except RuntimeError:
            pass
        else:
            raise AssertionError("trailing newline must be rejected")

    repo_keys = key_files(Path("."))
    if len(repo_keys) == 1:
        assert load_key(Path(".")) == repo_keys[0].stem

    log("selftest ok")


def main() -> int:
    if "--selftest" in sys.argv:
        selftest()
        return 0
    try:
        return run()
    except Exception as exc:
        log(f"IndexNow submission stopped: {exc}")
        log("IndexNow HTTP status: skipped")
        return 0


if __name__ == "__main__":
    sys.exit(main())
