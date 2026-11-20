# EngagedMD hero for Webflow: tablet, Doc and Flo in one embed

Revision 3 (Nov 20, 2026): designer's page-optimized build (new key light and shadow, skin shading, Flo blinks, 4x MSAA, gentler head-follow), with the r2 fixes re-applied: brand colors, rendering pauses offscreen, static poster.

Files
- `emd-hero.js`: the viewer, with the tablet artwork and screen animation built in (three.js r187).
- `emd-hero-poster.webp`: the finished frame (1200 x 1156, transparent, 55 KB). Shown instantly, and on its own for low-end devices.
- `doc-web.glb`: Doc (0.58 MB).
- `flo-web.glb`: Flo (0.78 MB).
- `tablet-source.js`, `duo-source.js`: sources, updated with the same fixes. The small embed bootstrap (the `data-emd-hero` loader) lives only in the bundle; port the poster logic into its source before the next rebuild.

Embed (one Webflow Embed element)
```html
<div data-emd-hero
     data-doc-src="https://YOUR-HOST/doc-web.glb"
     data-flo-src="https://YOUR-HOST/flo-web.glb"
     style="width:600px;max-width:100%;aspect-ratio:600/578">
  <img data-emd-poster src="https://YOUR-HOST/emd-hero-poster.webp"
       width="1200" height="1156" fetchpriority="high"
       alt="The EngagedMD patient app on a tablet, with Doc and Flo">
</div>
<script type="module" src="https://YOUR-HOST/emd-hero.js"></script>
```
Keep the `<img>` inside the div in the HTML itself (not added by script) so it paints with the page, before any JavaScript loads. The poster can also be uploaded to Webflow's asset library; the `.js` and `.glb` files need an HTTPS host with CORS (CDN, S3/CloudFront, Netlify, or GitHub via jsDelivr).

Loading
1. The poster paints immediately.
2. When the hero is within 200 px of the viewport, the 3D loads. Once its first frame is drawn, the poster fades out (0.35 s) and the opening plays: the screen builds its cards, then Doc and Flo greet.
3. Poster only, no 3D download: reduced motion, Data Saver, 2G connections, devices reporting 2 GB of memory or less, browsers without WebGL 2, or a hero narrower than `data-min-width`.

Performance
- All rendering (3D scene and tablet screen) stops while the hero is more than 100 px offscreen or the tab is hidden, and resumes when it returns.

Behaviour
1. After the opening, the screen keeps a small idle loop. On later greetings (every ~20 s) the card nearest Doc's hand lifts and its progress bar ticks forward.
2. Clicking the screen replays the screen build only. Hovering over or clicking a character makes just that character wave.
3. Coming back to the hero after 30 s or more away replays the opening.

Options (attributes)
- `data-min-width="480"`: below this hero width (px), show the poster only. Default 0 (3D at every width).
- `data-poster-only="false"`: always load 3D, even on low-end devices (reduced motion then shows a still 3D frame).
- `data-auto-greet="false"`: only the opening greeting, with no repeats.
- `data-hover-greet="false"`: characters don't wave on hover (clicking still works).
- `data-follow="false"`: heads don't follow the cursor.
- `data-screen="faithful"`: use the exact After Effects timing instead of the enhanced screen.

Events and scripting
```js
const el = document.querySelector('[data-emd-hero]');
el.addEventListener('hero:poster', () => { /* poster-only mode chosen */ });
el.addEventListener('hero:ready', (e) => {
  const hero = e.detail;
  hero.replayIntro();      // screen build, then greeting
  hero.replayScreen();     // screen only
  hero.greet('both');      // or 'doc' | 'flo'
  hero.setPaused(true);    // pause animation (rendering continues while visible)
  hero.setHoseCurve(0.6);  // rubber-hose sweep, 0.3 broad ... 0.9 near-elbow
});
```

Brand colors on the tablet screen (from the style guide)
Dark Green `#005459`, Teal `#05C9BF`, Pink `#F54FB0`, Orange `#FF9663`, card Cream `#FFF2E3`.
