// A summer beach scene: sky, sun, sea and a little boat that sails from the
// beach out to the goal buoy as the community's minutes add up. Drawn as
// inline SVG in a soft "clay" style. (Deliberately generic: no real landmark.)
//
// preserveAspectRatio "xMidYMax meet": on wide screens it fills the frame; on
// phones it sits at the bottom and the frame's sky colour fills the space above,
// so both the beach and the goal buoy always stay in view.

const SKY_TOP = '#a9e3f1';

// Route from the beach out to the goal buoy near the horizon.
const START = [300, 352];
const CONTROL = [640, 334];
const END = [930, 276];

function pointAt(t) {
  const u = 1 - t;
  return [
    u * u * START[0] + 2 * u * t * CONTROL[0] + t * t * END[0],
    u * u * START[1] + 2 * u * t * CONTROL[1] + t * t * END[1],
  ];
}

const escapeXml = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function coastSVG({ startLabel = 'Start', endLabel = 'Goal' } = {}) {
  startLabel = escapeXml(startLabel);
  endLabel = escapeXml(endLabel);
  return `
<svg viewBox="0 0 1200 400" preserveAspectRatio="xMidYMax meet" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${SKY_TOP}"/><stop offset="0.65" stop-color="#e3f6f3"/>
    </linearGradient>
    <radialGradient id="sun" cx="0.38" cy="0.35" r="0.7">
      <stop offset="0" stop-color="#fff6d2"/><stop offset="0.45" stop-color="#ffc93f"/><stop offset="1" stop-color="#f29d00"/>
    </radialGradient>
    <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#5ccbc3"/><stop offset="1" stop-color="#1f9993"/>
    </linearGradient>
    <linearGradient id="sand" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fbe7b5"/><stop offset="1" stop-color="#e9c77c"/>
    </linearGradient>
    <radialGradient id="puff" cx="0.4" cy="0.3" r="0.8">
      <stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#e2f1f2"/>
    </radialGradient>
    <filter id="clay" x="-20%" y="-20%" width="140%" height="160%">
      <feDropShadow dx="0" dy="6" stdDeviation="6" flood-color="#0b4552" flood-opacity="0.22"/>
    </filter>
  </defs>

  <rect width="1200" height="400" fill="url(#sky)"/>

  <g filter="url(#clay)">
    <circle cx="1060" cy="92" r="56" fill="url(#sun)"/>
    <g fill="url(#puff)">
      <circle cx="720" cy="86" r="26"/><circle cx="752" cy="74" r="34"/><circle cx="790" cy="88" r="24"/>
      <rect x="704" y="86" width="104" height="26" rx="13"/>
    </g>
    <g fill="url(#puff)" opacity="0.9">
      <circle cx="930" cy="128" r="16"/><circle cx="952" cy="120" r="22"/><circle cx="976" cy="130" r="15"/>
      <rect x="918" y="128" width="70" height="17" rx="8.5"/>
    </g>
  </g>

  <!-- Sea -->
  <rect y="256" width="1200" height="144" fill="url(#sea)"/>
  <path class="wave-a" fill="#8fe0d6" opacity="0.55"
        d="M-40 290 q 30 -12 60 0 t 60 0 t 60 0 t 60 0 t 60 0 t 60 0 t 60 0 t 60 0 t 60 0 t 60 0 t 60 0 t 60 0 t 60 0 t 60 0 t 60 0 t 60 0 t 60 0 t 60 0 t 60 0 t 60 0 t 60 0 v 8 h -1300 z"/>
  <path class="wave-b" fill="#ffffff" opacity="0.28"
        d="M-40 330 q 40 -14 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 v 7 h -1320 z"/>

  <!-- Beach -->
  <path filter="url(#clay)" fill="url(#sand)" d="M0 318 C 110 300, 250 318, 380 400 L 0 400 Z"/>
  <path fill="#ffffff" opacity="0.35" d="M0 324 C 100 310, 220 322, 320 372 C 230 334, 120 322, 0 332 Z"/>
  <!-- Beach umbrella -->
  <g filter="url(#clay)">
    <rect x="128" y="262" width="5" height="70" rx="2.5" fill="#0b4552"/>
    <path d="M70 276 Q 130 220 192 276 Z" fill="#d93a2b"/>
    <path d="M110 276 Q 130 226 152 276 Z" fill="#fff1c9"/>
    <path d="M70 276 Q 130 236 192 276" fill="none" stroke="#ffffff" stroke-opacity="0.35" stroke-width="3"/>
  </g>
  <text x="34" y="384" class="scene-label">${startLabel}</text>

  <!-- Goal buoy with a flag -->
  <g filter="url(#clay)" transform="translate(${END[0] + 34} ${END[1] - 4})">
    <rect x="-1.5" y="-58" width="3" height="46" rx="1.5" fill="#0b4552"/>
    <path d="M1.5 -58 L34 -48 L1.5 -38 Z" fill="#ffc23a"/>
    <path d="M-16 -8 Q 0 -30 16 -8 L 13 4 Q 0 10 -13 4 Z" fill="#d93a2b"/>
    <path d="M-15 -6 L15 -6 L14 -1 L-14 -1 Z" fill="#ffffff"/>
  </g>
  <text x="${END[0] + 34}" y="${END[1] - 70}" text-anchor="middle" class="scene-label" data-goal-label>${endLabel}</text>

  <!-- Route the boat follows -->
  <path d="M${START.join(' ')} Q ${CONTROL.join(' ')} ${END.join(' ')}" fill="none" stroke="#ffffff"
        stroke-width="3" stroke-dasharray="2 12" stroke-linecap="round" opacity="0.8"/>

  <g class="boat" data-boat transform="translate(${START.join(' ')})">
    <g class="boat-bob" filter="url(#clay)">
      <path d="M-36 -12 L36 -12 Q 30 6 0 8 Q -30 6 -36 -12 Z" fill="#d93a2b"/>
      <path d="M-30 -10 L30 -10 Q 26 -4 0 -3 Q -26 -4 -30 -10 Z" fill="#ffffff" opacity="0.25"/>
      <rect x="-1.5" y="-70" width="3" height="58" rx="1.5" fill="#0b4552"/>
      <path d="M2 -68 L2 -16 L34 -16 Z" fill="#ffffff"/>
      <path d="M-3 -62 L-3 -18 L-26 -18 Z" fill="#fff1c9"/>
      <path d="M1 -70 L16 -65 L1 -60 Z" fill="#ffc23a"/>
    </g>
  </g>
</svg>`;
}

// progress: 0..1 of the community goal.
export function placeBoat(root, progress) {
  const boat = root.querySelector('[data-boat]');
  if (!boat) return;
  const t = Math.min(Math.max(progress, 0), 1);
  const visual = t === 0 ? 0 : 0.03 + t * 0.97;  // nudge off the sand once anyone reads
  const [x, y] = pointAt(visual);
  const scale = 1 - visual * 0.35;               // smaller as it heads out to sea
  boat.removeAttribute('transform');
  boat.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${scale.toFixed(3)})`;
}

export const SCENE_SKY = SKY_TOP;

// Wide frames: fill edge to edge (crop a little sky). Narrow frames: shrink to
// fit so the beach and the buoy both stay visible, sky fills the space above.
// narrow: how to fit a frame narrower than the scene. 'meet' shows it all
// (dashboard); 'slice' fills the frame and keeps the beach end (login page).
export function fitScene(frame, narrow = 'xMidYMax meet') {
  const apply = () => {
    const svg = frame.querySelector('svg');
    if (!svg || !frame.clientHeight) return;
    svg.setAttribute('preserveAspectRatio', frame.clientWidth / frame.clientHeight > 3 ? 'xMidYMax slice' : narrow);
  };
  apply();
  if (!frame._fitObserver) {
    frame._fitObserver = new ResizeObserver(apply);
    frame._fitObserver.observe(frame);
  }
}
