(function () {
  'use strict';

  const queue = [];
  let playing = false;

  function next() {
    if (queue.length === 0) { playing = false; return; }
    playing = true;
    play(queue.shift()).then(next);
  }

  function play({ image, text, duration = 0.5, textColor = '#fff' }) {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      Object.assign(overlay.style, {
        position: 'fixed', inset: '0', zIndex: '9999',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0)', pointerEvents: 'all',
      });

      const content = document.createElement('div');
      Object.assign(content.style, {
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: '20px',
      });

      if (image) {
        const img = document.createElement('img');
        img.src = image;
        Object.assign(img.style, {
          maxWidth: '70vw', maxHeight: '55vh', objectFit: 'contain',
        });
        content.appendChild(img);
      }

      if (text) {
        const textEl = document.createElement('div');
        textEl.textContent = text;
        Object.assign(textEl.style, {
          fontSize: image ? '1.8rem' : '3rem',
          fontWeight: '900',
          color: textColor,
          textShadow: `0 0 24px ${textColor}99, 0 2px 12px rgba(0,0,0,.9)`,
          letterSpacing: '0.06em',
          textAlign: 'center',
          whiteSpace: 'nowrap',
        });
        content.appendChild(textEl);
      }

      overlay.appendChild(content);
      document.body.appendChild(overlay);

      const FADE_IN  = 0.12;
      const FADE_OUT = 0.13;
      const hold = Math.max(0.05, duration - FADE_IN - FADE_OUT);

      gsap.timeline({ onComplete: () => { overlay.remove(); resolve(); } })
        .to(overlay,  { background: 'rgba(0,0,0,0.72)', duration: FADE_IN, ease: 'power2.out' })
        .fromTo(content, { opacity: 0, scale: 0.7 }, { opacity: 1, scale: 1, duration: FADE_IN, ease: 'back.out(1.4)' }, '<')
        .to({}, { duration: hold })
        .to(overlay,  { background: 'rgba(0,0,0,0)', duration: FADE_OUT, ease: 'power2.in' })
        .to(content,  { opacity: 0, scale: 1.06, duration: FADE_OUT, ease: 'power2.in' }, '<');
    });
  }

  window.enqueueCutscene = function (config) {
    queue.push(config);
    if (!playing) next();
  };
})();
