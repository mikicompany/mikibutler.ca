# Sanxian — new protected entries

Five images were added to `images/work/` for the Protected gallery. Below are
the ready-to-paste item objects plus the ordering the client asked for.

## How to add them

1. Run the site locally: `python serve.py`
2. Open `http://localhost:8321/tools/protect.html`
3. Enter the gallery password, click **Load & decrypt current data** — the
   textarea fills with the current items.
4. Paste the five objects below and arrange the order per **Ordering** below.
5. Click **Encrypt**, then **Download protected-data.json**, and replace the
   file in the site root. Commit it.

## The five items

```json
{ "img": "images/work/sanxian-kit-a.jpg",   "tag": "Sanxian", "title": "Sanxian Building Kit A" },
{ "img": "images/work/sanxian-kit-b.jpg",   "tag": "Sanxian", "title": "Sanxian Building Kit B" },
{ "img": "images/work/sanxian-kit-c.jpg",   "tag": "Sanxian", "title": "Sanxian Building Kit C" },
{ "img": "images/work/sanxian-early-01.jpg", "tag": "Sanxian", "title": "Sanxian Early Development" },
{ "img": "images/work/sanxian-early-02.jpg", "tag": "Sanxian", "title": "Sanxian Early Development" }
```

## Ordering (from the Blurb doc)

> Rename to: Sanxian Building kits A B and C. For the rest of the imgs rename to
> Sanxian early development. Organize the kits first and then have the other
> imgs, you might have to move protected 27 and 28 to after the kit imgs as well.

So, in the Sanxian block:

1. Sanxian Building Kit A
2. Sanxian Building Kit B
3. Sanxian Building Kit C
4. *(the two existing items that were "protected 27 and 28" — move them here,
   after the kits)*
5. Sanxian Early Development (sanxian-early-01)
6. Sanxian Early Development (sanxian-early-02)

Adjust `tag` if you'd rather these read `NDA` like the rest of the gallery.
