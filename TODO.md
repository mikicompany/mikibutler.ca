# TODO / Ideas

A running list of ideas and follow-ups for mikibutler.ca.

## Work page — juicier project browsing

- [x] **Controller support (site-wide).** Gamepad navigation shipped in
      `js/gamepad.js` (auto-loaded via `sidebar.js`): D-pad/stick moves a
      focus ring across links/buttons/tiles, A selects, B backs out/closes,
      Start shows a help card; inside image lightboxes it routes to
      Arrow/Enter/Esc so existing nav drives them.
- [ ] **Keyboard flow for Work sub-groups** (arrows within/between albums)
      as a mouse-free complement — the controller covers it via focus nav,
      but native album keyboard nav could still be nicer.
  - Arrow keys: **← / →** move between projects (albums), **↑ / ↓** move
    within the open project's pieces.
  - **Enter** dives into the focused project / opens the focused piece;
    **Esc / Backspace** backs out one level.
  - **Gamepad support** via the Gamepad API — D-pad + face buttons (A =
    open, B = back) mirror the keyboard, with the same springy motion.
  - A visible **focus highlight** (accent ring) on the current tile that
    moves with a quick spring, plus optional soft blip + haptic on move
    (reuse the sketch-radial audio approach; muteable).
  - Keep it accessible: real focus states, screen-reader labels, and it
    should coexist with mouse/touch, not replace them.

## Backlog (from the "satisfying dive-in" brainstorm)

- [ ] Shared-element zoom: cover expands into the album header.
- [ ] Staggered card reveal when an album opens.
- [ ] Soft open/close blips + haptics on dive-in / back.
- [ ] Album count-up header ("1 / 8") + scroll progress bar.
- [ ] Neighboring-project "peek" at the grid edges.

## Other open threads

- [ ] **Résumé — Education section** (waiting on school / program / years).
- [ ] **Blog — Office Mural post** (waiting on text + image URLs from
      ArtStation; the build env can't reach ArtStation).
- [ ] **Collection covers** — 11 console-exclusive / obscure titles still
      rely on the live fetch; pin exact image URLs if any stay blank.
