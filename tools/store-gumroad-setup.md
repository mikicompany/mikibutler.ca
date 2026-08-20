# Store — Gumroad setup

The shop (`store.html` + `store.json`) is wired to **Gumroad**, using Gumroad's
**overlay** so checkout opens *on the page* instead of redirecting away. Gumroad
handles payments, digital delivery, receipts, and tax. Nothing is charged until
real product links are in place.

## One-time

1. Create a Gumroad account at gumroad.com and note your store URL —
   `https://<yourhandle>.gumroad.com`.

## For each product

2. Create the product on Gumroad:
   - **Digital** (trim packs, brushes, kit, PDF): upload the file(s), set the
     price, publish. Gumroad emails the download automatically.
   - **Physical** (prints, stickers, artbook): toggle it to a physical product,
     set shipping, publish. Gumroad collects the shipping address at checkout.
   - If a product has options (print size, cover), create them as Gumroad
     **variants** on that product.
3. Copy the product URL: `https://<yourhandle>.gumroad.com/l/<permalink>`.
4. Paste it into that product's **`gumroad`** field in `store.json`:

   ```json
   {
     "slug": "rock-cliff-trim-pack",
     "title": "Rock & Cliff Trim Sheet Pack",
     "gumroad": "https://yourhandle.gumroad.com/l/rock-trims"
   }
   ```

   *(Your store base is already set to `https://mikib.gumroad.com/l/`, so you
   can just use the bare permalink: `"gumroad": "rock-trims"`.)*

## How checkout behaves

- **Add to cart → Checkout** opens the Gumroad overlay for the first item on the
  page. Gumroad is one-product-per-overlay, so each cart item also has its own
  **Buy ▸** button in the cart drawer — that's the reliable way to buy several.
- Any item without a `gumroad` link is flagged at checkout ("still needs a
  Gumroad product link"), so a half-configured store fails safe instead of
  charging wrong.
- If `gumroad.js` is ever blocked, the Buy button falls back to opening the
  Gumroad product page in a new tab — it still works.

## Going live

- The shop is currently **hidden** (reachable only from the arcade). When you're
  ready, ask to add **Shop** to the nav + sitemap.
- Test with a real cheap product (or Gumroad's own preview) before announcing.
