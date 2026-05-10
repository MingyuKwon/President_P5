(function () {
  'use strict';

  const queue = [];
  let playing = false;
  let drainCallback = null;

  function next() {
    if (queue.length === 0) {
      playing = false;
      if (typeof window.onCutsceneQueueEmpty === 'function') window.onCutsceneQueueEmpty();
      if (drainCallback) { const cb = drainCallback; drainCallback = null; cb(); }
      return;
    }
    playing = true;
    play(queue.shift()).then(next);
  }

  function buildDOM({ image, subImage, text, textColor, imageScale }) {
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
        width: `${27.44 * imageScale}vw`, height: `${21.56 * imageScale}vh`, objectFit: 'contain',
      });
      content.appendChild(img);
    }

    if (subImage) {
      const img2 = document.createElement('img');
      img2.src = subImage;
      Object.assign(img2.style, { width: '9vw', height: '9vh', objectFit: 'contain' });
      content.appendChild(img2);
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
    return { overlay, content };
  }

  function play({ image, subImage, text, duration = 0.9, delay = 0.3, textColor = '#fff', imageScale = 1, fadeIn = 0.35 }) {
    return new Promise(resolve => {
      const FADE_IN  = fadeIn;
      const FADE_OUT = 0.15;
      const hold     = Math.max(0.05, duration - FADE_IN - FADE_OUT);
      const totalSecs = delay + duration;
      const startTime = Date.now();
      let done = false;
      let tl = null;
      let overlay = null;

      function finish() {
        if (done) return;
        done = true;
        clearTimeout(wallTimer);
        document.removeEventListener('visibilitychange', onVisibilityChange);
        if (tl) { tl.kill(); tl = null; }
        if (overlay && overlay.parentNode) overlay.remove();
        resolve();
      }

      // 벽시계 타이머: 탭이 숨겨져 있어도 실제 시간이 지나면 큐에서 빠짐
      const wallTimer = setTimeout(finish, totalSecs * 1000);

      function startVisual() {
        if (done || overlay) return;
        const elapsed = (Date.now() - startTime) / 1000;
        if (elapsed >= totalSecs) { finish(); return; }

        const dom = buildDOM({ image, subImage, text, textColor, imageScale });
        overlay = dom.overlay;
        document.body.appendChild(overlay);

        tl = gsap.timeline({ onComplete: finish })
          .to({}, { duration: delay })
          .to(overlay,      { background: 'rgba(0,0,0,0.72)', duration: FADE_IN, ease: 'power2.out' })
          .fromTo(dom.content, { opacity: 0, scale: 0.7 }, { opacity: 1, scale: 1, duration: FADE_IN, ease: 'back.out(1.4)' }, '<')
          .to({}, { duration: hold })
          .to(overlay,      { background: 'rgba(0,0,0,0)', duration: FADE_OUT, ease: 'power2.in' })
          .to(dom.content,  { opacity: 0, scale: 1.06,    duration: FADE_OUT, ease: 'power2.in' }, '<');

        // 창이 다시 열린 경우 경과 시간만큼 건너뜀
        if (elapsed > 0) tl.seek(elapsed);
      }

      function onVisibilityChange() {
        if (done) return;
        if (document.hidden) {
          if (tl) tl.pause();
        } else {
          if (!overlay) {
            // 탭이 숨겨진 채로 시작됐다가 다시 열린 경우
            startVisual();
          } else if (tl) {
            const elapsed = (Date.now() - startTime) / 1000;
            tl.seek(elapsed);
            tl.resume();
          }
        }
      }

      document.addEventListener('visibilitychange', onVisibilityChange);

      if (!document.hidden) startVisual();
    });
  }

  window.isCutscenePlaying = function () { return playing; };

  window.enqueueCutscene = function (config) {
    queue.push(config);
    if (!playing) next();
  };

  window.afterCutsceneQueue = function (callback) {
    if (!playing && queue.length === 0) callback();
    else drainCallback = callback;
  };

  window.clearCutsceneQueue = function () {
    queue.length = 0;
    drainCallback = null;
  };
})();
