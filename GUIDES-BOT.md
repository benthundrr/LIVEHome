# TikTok LIVE Guides — how Grok Bot writes a guide

Each guide is **one new Markdown file** in `_posts/`. Never edit, move or delete any other file.
The site builds everything else from that file: the page design, title tag, description, canonical link,
Open Graph and Twitter tags, Article and Breadcrumb data, the Guides page card, "More guides" and the sitemap.

Live URL of a guide: `https://www.thundrr.co/blog/<slug>/`

---

## 1. File name

```
_posts/YYYY-MM-DD-<slug>.md
```

- `YYYY-MM-DD` is today's date in Los Angeles time. Never a future date — future posts don't publish.
- `<slug>` is the main search phrase in lowercase words joined by hyphens, 3 to 6 words.
  Example: `_posts/2026-11-12-how-tiktok-live-battles-work.md`
- Check https://www.thundrr.co/blog/ first. Never reuse a slug, and never change a slug after it's published.

---

## 2. Front matter (top of the file)

Copy this block exactly and fill in the values. Every text value goes in double quotes.
Never put a double quote inside a value (use single quotes instead).

```yaml
---
title: "How TikTok LIVE Battles work"
accent: "LIVE Battles work"
seo_title: "How TikTok LIVE Battles Work | Thundrr"
description: "How TikTok LIVE Battles are scored, how long they last and how to pick matchups, from an official TikTok LIVE partner agency."
summary: "Scoring, timing and how to pick your matchups."
date: 2026-11-12
last_modified_at: 2026-11-12
icon: battle
takeaways:
  - "First short takeaway sentence."
  - "Second short takeaway sentence."
  - "Third short takeaway sentence."
faq:
  - q: "A question creators actually ask?"
    a: "A direct answer in one to three sentences."
---
```

| Field | Rule |
|---|---|
| `title` | The big page title. Sentence case. 60 characters max. |
| `accent` | Optional. 2 to 4 words copied **exactly** from the end of `title`. Shown in the moving blue gradient. |
| `seo_title` | The Google title. Ends with ` \| Thundrr`. **60 characters max, counting everything.** |
| `description` | The Google snippet. One sentence, **120 to 155 characters**. |
| `summary` | One line under the title and on the Guides card. 110 characters max. |
| `date` | Today. Must match the date in the file name. |
| `last_modified_at` | Same as `date`. When you edit an existing guide later, set it to that day. |
| `icon` | One of: `agency`, `battle`, `gift`, `diamond`, `schedule`, `growth`, `manager`, `safety` |
| `takeaways` | 3 to 5 short sentences. They appear in the Key takeaways box at the top. |
| `faq` | Optional. 2 to 5 questions. Shown as a Questions section at the end. |

Do not add `layout`, `author`, `image` or anything else. The author is always Andrew Andrawes and the site adds him.

---

## 3. Body

- Start the body with a `##` section. **Never use a single `#`** — the page already has its title.
- 4 to 7 `##` sections. Use `###` for sub-points inside a section.
- Headings are plain text: no links, no bold, no class lines under them.
- Paragraphs are 1 to 3 sentences. Leave one blank line between every block.
- A class line like `{: .cards}` goes on the line **directly under** its block, with no blank line between.

### Blocks you can use

**Cards** — 2 to 4 short points, each starting with a bold title:

```markdown
- **Coaching** Your manager reviews your LIVEs and helps you set a schedule.
- **Battles and events** Agencies line up LIVE Battles and campaign entries.
{: .cards}
```

**Stat tiles** — 2 to 4 numbers. Only numbers from the approved facts list (section 5):

```markdown
- **4** regions we recruit in
- **48h** usual application review
{: .stats}
```

**Comparison table** — `Yes` and `No` turn into icons, and the last column is highlighted, so put Thundrr last:

```markdown
| What you get | On your own | With Thundrr |
|---|---|---|
| A named manager | No | Yes |
| Fee to join | None | None |
{: .compare}
```

**Plain table** — any normal Markdown table with no class line.

**Callouts** — a blockquote that starts with a bold label. Pick `.tip`, `.warn` or `.live`:

```markdown
> **Tip** Ask the agency to put its terms in writing.
{: .callout .tip}
```

**Pull line** — one strong sentence, at most once per guide:

```markdown
> The right agency gives you a person to call when something breaks.
{: .pull}
```

**Steps** — only for things that really happen in order:

```markdown
1. **Apply** Send your handle through the regional link.
2. **Intro call** A short call about your goals and your schedule.
{: .steps}
```

**Apply panel** — once per guide, after the second or third section:

```liquid
{% include cta.html %}
```

You can change its words: `{% include cta.html title="Want help with Battles?" text="Thundrr is an official TikTok LIVE partner agency." %}`

**Graphics** — at most one of each per guide, only where they fit the section:

```liquid
{% include graphic.html name="battle" caption="LIVE Battles put two creators head to head while their viewers send gifts." %}
{% include graphic.html name="manager" caption="Your manager is one message away." %}
```

**Apply button** — always the last line of the guide:

```markdown
[Apply to join Thundrr](https://www.thundrr.co/join){: .button}
```

**Links** — link other guides as `/blog/<slug>/`. Link outside the site only to official TikTok pages.

Every guide uses at least three different blocks, one Apply panel, and ends with the Apply button.

---

## 4. Brand rules

- Thundrr is "an official TikTok LIVE partner agency". Guides cover TikTok LIVE only: never mention TikTok Shop, Thundrr Shop, Thundrr GO, or travel and hotel programs.
- Say "LIVE Battles" or "Battles". Never "PK".
- Never write "X, not Y" contrast sentences (for example "An agency, not a middleman"). Say the thing directly.
- No emojis. No mention of Discord.
- Write LIVE in capitals when it means TikTok LIVE.
- Plain, direct sentences. Sentence case headings. American English.
- Never name Thundrr staff other than Andrew Andrawes. Don't add email addresses or phone numbers.

---

## 5. Facts

Only use facts from this list or from https://www.thundrr.co. Never invent numbers, payouts, diamond rates,
percentages, follower minimums, rankings, quotes or creator names. If you can't confirm something, leave it out.

- Thundrr is an official TikTok LIVE partner agency headquartered in Los Angeles.
- Thundrr recruits creators in the United States, Latin America, the United Kingdom and Australia.
- No agency fees. Thundrr doesn't take a percentage of creator earnings. TikTok pays creators directly.
- Every creator gets a named manager.
- Applications are reviewed by hand, usually within 48 hours.
- Joining works in four steps: Apply, Intro call, Join and get onboarded, Go LIVE with a plan.
- Creators can usually switch from another agency once their current agreement allows it. Thundrr won't ask anyone to break a contract.
- As an official partner, Thundrr can escalate account issues through a direct channel. No outcome is ever promised.

If a paragraph needs Ben to check a claim, start it with `[DRAFT – replace]` — it shows as a yellow tag on the page.

---

## 6. Publishing (github.com, in the browser)

1. Open https://github.com/benthundrr/LIVEHome on the `main` branch.
2. Click **Add file → Create new file**.
3. In the name box type the full path, for example `_posts/2026-11-12-how-tiktok-live-battles-work.md`
   (typing the `/` puts it in the `_posts` folder).
4. Paste the whole guide.
5. Click **Commit changes…**, choose **Create a new branch for this commit and start a pull request**,
   name the branch `guide-<slug>`, then **Propose changes**.
6. Title the pull request `Guide: <title>` and click **Create pull request**.
7. Never commit to `main`. Never merge. Ben reviews and merges.

### Check before you open the pull request

- [ ] `seo_title` 60 characters or less, `description` 120 to 155, `summary` 110 or less
- [ ] `accent` appears exactly in `title`
- [ ] `date` is today, matches the file name, and isn't in the future
- [ ] Slug isn't already used on https://www.thundrr.co/blog/
- [ ] Body starts with `##`, no single `#`
- [ ] Every class line sits directly under its block
- [ ] Only the includes and graphic names listed above
- [ ] Ends with the Apply button
- [ ] Brand rules and facts list followed
