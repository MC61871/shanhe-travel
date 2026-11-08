/* ===========================================================
   audio.js —— 背景音乐面板：平凡之路 / 默认 25% / 淡入淡出 / 单曲循环
   =========================================================== */
(function () {
  "use strict";

  var audio = document.getElementById("bgm");
  var panel = document.getElementById("audioPanel");
  var btnPlay = document.getElementById("audioPlay");
  var btnPrev = document.getElementById("audioPrev");
  var btnNext = document.getElementById("audioNext");
  var btnMute = document.getElementById("audioMute");
  var slider = document.getElementById("audioVol");
  var pctEl = document.getElementById("audioPct");
  var stateEl = document.getElementById("audioState");
  var minBtn = document.getElementById("audioMin");
  var icPlay = btnPlay.querySelector(".ic-play");
  var icPause = btnPlay.querySelector(".ic-pause");

  var DEFAULT_VOL = 0.25;
  var muted = false;
  var lastVol = DEFAULT_VOL;
  var started = false;
  var rampId = null;

  audio.volume = 0;
  audio.loop = true;

  function setIcon(playing) {
    icPlay.hidden = playing;
    icPause.hidden = !playing;
  }
  function setState() {
    if (audio.paused) {
      stateEl.textContent = started ? "已暂停" : "未播放 · 点击开始";
      stateEl.classList.remove("playing");
    } else {
      stateEl.textContent = "正在播放 · " + Math.round(audio.volume * 100) + "%";
      stateEl.classList.add("playing");
    }
  }
  function updateSlider() {
    if (muted) {
      slider.value = 0;
      slider.style.setProperty("--p", "0%");
      pctEl.textContent = "静音";
      return;
    }
    var v = Math.round(audio.volume * 100);
    slider.value = v;
    slider.style.setProperty("--p", v + "%");
    pctEl.textContent = v;
  }
  function fadeTo(target, ms, cb) {
    cancelAnimationFrame(rampId);
    var from = audio.volume;
    var t0 = performance.now();
    function step(t) {
      var k = Math.min(1, (t - t0) / ms);
      audio.volume = from + (target - from) * k;
      updateSlider();
      if (k < 1) rampId = requestAnimationFrame(step);
      else if (cb) cb();
    }
    rampId = requestAnimationFrame(step);
  }

  function play() {
    var p = audio.play();
    started = true;
    if (p && p.catch) {
      p.catch(function () {
        setState();
        stateEl.textContent = "浏览器限制自动播放 · 点击开始";
      });
    }
  }

  function toggle() {
    if (audio.paused) {
      if (audio.volume < 0.02) audio.volume = muted ? lastVol : DEFAULT_VOL;
      play();
    } else {
      audio.pause();
    }
    setTimeout(setState, 60);
  }

  function restart() {
    audio.currentTime = 0;
    if (audio.paused) play();
  }

  btnPlay.addEventListener("click", toggle);
  btnPrev.addEventListener("click", restart);
  btnNext.addEventListener("click", restart);

  btnMute.addEventListener("click", function () {
    muted = !muted;
    if (muted) { lastVol = audio.volume || DEFAULT_VOL; audio.volume = 0; }
    else { audio.volume = lastVol || DEFAULT_VOL; }
    updateSlider();
    setState();
    if (!muted && audio.paused) play();
  });

  slider.addEventListener("input", function () {
    muted = false;
    audio.volume = (+slider.value) / 100;
    updateSlider();
    setState();
  });

  minBtn.addEventListener("click", function () {
    panel.classList.toggle("min");
    minBtn.textContent = panel.classList.contains("min") ? "+" : "—";
  });

  audio.addEventListener("play", function () { setIcon(true); setState(); });
  audio.addEventListener("pause", function () { setIcon(false); setState(); });
  audio.addEventListener("volumechange", updateSlider);

  /* 首次交互后自动开始 */
  function firstGesture() {
    if (started) return;
    started = true;
    audio.volume = 0;
    play();
    fadeTo(DEFAULT_VOL, 1400);
    document.removeEventListener("pointerdown", firstGesture);
    document.removeEventListener("keydown", firstGesture);
  }
  document.addEventListener("pointerdown", firstGesture, { once: false });
  document.addEventListener("keydown", firstGesture, { once: false });

  /* 页面切换的淡入淡出 */
  function pageFade() {
    if (audio.paused) return;
    var base = muted ? 0 : (audio.volume || DEFAULT_VOL);
    fadeTo(base * 0.35, 160, function () {
      fadeTo(base, 520);
    });
  }

  /* 打印时静音 */
  var preMute = null;
  function fadeOutForPrint() {
    preMute = { paused: audio.paused, vol: audio.volume };
    if (!audio.paused) { audio.pause(); }
    audio.volume = 0;
    updateSlider();
    setState();
  }
  function resumeAfterPrint() {
    if (preMute && !preMute.paused) {
      audio.volume = preMute.vol;
      play();
    } else if (preMute) {
      audio.volume = preMute.vol;
    }
    updateSlider();
    setState();
  }

  /* 顶栏音乐按钮 */
  var topBtn = document.getElementById("btnAudioToggle");
  if (topBtn) {
    topBtn.addEventListener("click", function () {
      panel.classList.remove("min");
      minBtn.textContent = "—";
      toggle();
    });
  }

  updateSlider();
  setState();

  /* 小屏默认收起面板，避免遮挡标题 */
  if (window.innerWidth < 900) {
    panel.classList.add("min");
    minBtn.textContent = "+";
  }

  /* 尝试直接自动播放（部分浏览器允许静音/低音量自动播放） */
  window.addEventListener("load", function () {
    setTimeout(function () {
      if (started) return;
      audio.volume = DEFAULT_VOL;
      var p = audio.play();
      if (p && p.catch) {
        p.catch(function () {
          audio.volume = 0;
          started = false;
          setState();
          stateEl.textContent = "点击任意处开始音乐";
        });
      } else {
        started = true;
        updateSlider();
      }
    }, 600);
  });

  window.Bgm = { pageFade: pageFade, fadeOutForPrint: fadeOutForPrint, resumeAfterPrint: resumeAfterPrint, toggle: toggle };
})();
