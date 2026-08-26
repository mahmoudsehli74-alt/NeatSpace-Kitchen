# NeatSpace-Kitchen — Bridge Storefront

Static, mobile-first Pinterest landing storefront for the **NeatSpace Kitchen**
account. Served by GitHub Pages; hydrated client-side from per-product JSON
files committed by the NeatSpace-Core bridge committer (`pinner/tools/bridge.py`).

## How the handshake works

```
Pinterest pin ──▶ https://<domain>/?id=<product_key>
                          │
                          ▼
              app.js fetches ./products/<product_key>.json
              (committed by the runner's BridgeTool)
                          │
                          ▼
              DOM hydration: gallery · copy · price · sticky CTA
                          │
                          ▼
              CTA ──▶ affiliate_url (s.click.aliexpress.com/...)
```

The JSON contract (produced by `_landing_payload` in `pinner/runner/main.py`):

```json
{
  "key": "stub-store-1005006123456789",
  "title": "AI-written Pinterest title",
  "description": "AI-written description …",
  "hashtags": ["#kitchenorganization"],
  "landing_angle": "budget-luxury",
  "board_choice": "Kitchen Organization",
  "product": {
    "title": "Original marketplace title",
    "price": { "current": 14.99, "original": 24.99, "currency": "USD" },
    "image": "https://ae01.alicdn.com/…H1.jpg",
    "images": ["…H1.jpg", "…H2.jpg"],
    "source_url": "https://www.aliexpress.com/item/….html"
  },
  "affiliate_url": "https://s.click.aliexpress.com/e/_XXXX",
  "disclosure": "As an affiliate, we may earn from qualifying purchases."
}
```

`app.js` reads `product.images` when present (gallery) and falls back to the
single `product.image` — so older payloads keep working.

## Files

| File | Purpose |
|---|---|
| `index.html` | Skeleton + product + fallback views, OG meta hooks |
| `style.css` | Warm kitchen palette, sticky mobile CTA, desktop 2-col layout |
| `app.js` | `?id=` parsing, JSON fetch/hydrate, snap carousel, 404 fallback |
| `featured.json` *(optional)* | Up to 6 product keys shown on the fallback page |

## Deploy

1. Push `index.html`, `style.css`, `app.js`, `.nojekyll` to this repo's `main`.
2. Settings → Pages → Deploy from branch `main` / root.
3. Optional: add `featured.json` (see `featured.json.example`) for the 404 grid.
4. Optional: set the custom domain in GitHub Pages and put the same value in
   the Atlas `accounts.site.custom_domain` field — the runner builds pin URLs
   from it automatically.

## Security posture (matching the backend)

Product data is untrusted marketplace content: hydration uses
`textContent`/`createElement` exclusively (never `innerHTML`), the `?id`
parameter is whitelisted to `[A-Za-z0-9._-]`, affiliate links are
`rel="nofollow sponsored noopener"`, and images load with
`referrerpolicy="no-referrer"` plus a graceful placeholder on error.
