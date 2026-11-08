/* ===========================================================
   map.js —— 全屏油画中国版图 / 省市下钻 / 多选城市 / 目录联动
   =========================================================== */
(function () {
  "use strict";

  var G = window.GEO;
  var S = window.STATE;
  var U = window.UI;

  var VIEW_W = G.width, VIEW_H = G.height;
  var CX = VIEW_W / 2, CY = VIEW_H / 2;

  /* Albers 投影（与离线生成数据时一致） */
  var P1 = 25 * Math.PI / 180, P2 = 47 * Math.PI / 180, L0 = 105 * Math.PI / 180, P0 = 35 * Math.PI / 180;
  var N = (Math.sin(P1) + Math.sin(P2)) / 2;
  var C = Math.cos(P1) * Math.cos(P1) + 2 * N * Math.sin(P1);
  var RHO0 = Math.sqrt(C - 2 * N * Math.sin(P0)) / N;
  function proj(lng, lat) {
    var lam = lng * Math.PI / 180, phi = lat * Math.PI / 180;
    var rho = Math.sqrt(Math.max(C - 2 * N * Math.sin(phi), 1e-9)) / N;
    var th = N * (lam - L0);
    var x = rho * Math.sin(th), y = -(RHO0 - rho * Math.cos(th));
    return { x: (x - G.proj.minx) * G.proj.k, y: (y - G.proj.miny) * G.proj.k };
  }
  function pt(lng, lat) { var p = proj(lng, lat); return p.x.toFixed(1) + " " + p.y.toFixed(1); }

  /* 城市索引 */
  var cityIndex = {};
  Object.keys(G.cities || {}).forEach(function (provAd) {
    (G.cities[provAd] || []).forEach(function (c) {
      cityIndex[c.ad] = { c: c, prov: provAd };
    });
  });
  var provByAd = {};
  G.provinces.forEach(function (p) { provByAd[p.ad] = p; });

  /* ---------------- 装饰：名山大川 / 古都 / 经纬 ---------------- */
  var RANGES = [
    ["昆 仑 山", 85, 36.2], ["天 山", 83.5, 43], ["喜马拉雅", 87, 28.2], ["秦 岭", 108.2, 33.6],
    ["太 行 山", 113.6, 37.2], ["大兴安岭", 122.4, 49.4], ["武 夷 山", 117.6, 27.2],
    ["阴 山", 110, 41.6], ["南 岭", 113, 24.8], ["祁 连 山", 99, 38.4], ["横 断 山", 99.6, 29.2],
    ["长 白 山", 128, 42.2], ["秦 巴 山 地", 109, 32], ["雪 峰 山", 110.8, 27.6]
  ];
  var CAPITALS = [["长安", 108.9, 34.3], ["洛阳", 112.4, 34.6], ["金陵", 118.8, 32.1], ["燕京", 116.4, 39.9], ["汴梁", 114.3, 34.8], ["临安", 120.2, 30.3], ["锦官城", 104.1, 30.6]];
  var RIVERS = {
    changjiang: [[91, 33.4], [97, 32.4], [101, 29.6], [104, 29], [106.6, 29.6], [109, 30.8], [112.2, 30.4], [114.3, 30.6], [117.2, 30.6], [119.4, 32], [121.7, 31.6]],
    huanghe: [[96, 35], [100, 34.6], [103, 36], [106, 37.6], [109, 40.2], [111, 40.6], [111.6, 37], [113, 35.6], [116, 36], [118, 37.4], [119.2, 37.8]]
  };

  function smoothPath(pts) {
    var d = "M" + pts[0].join(",");
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      var c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      var c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += "C" + c1[0].toFixed(1) + "," + c1[1].toFixed(1) + " " + c2[0].toFixed(1) + "," + c2[1].toFixed(1) + " " + p2[0].toFixed(1) + "," + p2[1].toFixed(1);
    }
    return d;
  }

  function decoSVG() {
    var s = '<g class="deco" pointer-events="none">';
    /* 淡墨经纬 */
    for (var lng = 80; lng <= 130; lng += 10) {
      s += '<path class="graticule" d="M' + pt(lng, 18) + "L" + pt(lng, 53) + '"/>';
    }
    for (var lat = 20; lat <= 50; lat += 10) {
      s += '<path class="graticule" d="M' + pt(74, lat) + "L" + pt(135, lat) + '"/>';
    }
    /* 江河 */
    Object.keys(RIVERS).forEach(function (k) {
      var pts = RIVERS[k].map(function (p) { var q = proj(p[0], p[1]); return [Math.round(q.x * 10) / 10, Math.round(q.y * 10) / 10]; });
      var d = smoothPath(pts);
      s += '<path d="' + d + '" fill="none" stroke="#4f737b" stroke-width="2.2" opacity=".2" stroke-linecap="round" stroke-linejoin="round"/>';
      s += '<path d="' + d + '" fill="none" stroke="#5b828a" stroke-width="1.1" opacity=".5" stroke-linecap="round"/>';
    });
    /* 山川题字 */
    RANGES.forEach(function (m) {
      var p = proj(m[1], m[2]);
      s += '<text x="' + p.x.toFixed(1) + '" y="' + p.y.toFixed(1) + '" font-size="10.5" letter-spacing="2" fill="#6b5a45" opacity=".42" font-family="STKaiti,KaiTi,serif" transform="rotate(-8 ' + p.x.toFixed(1) + " " + p.y.toFixed(1) + ')">' + m[0] + "</text>";
    });
    /* 古都轮廓 */
    CAPITALS.forEach(function (m) {
      var p = proj(m[1], m[2]);
      s += '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="9" fill="none" stroke="#7d5a3a" stroke-width=".7" stroke-dasharray="2 3" opacity=".5"/>';
      s += '<text x="' + p.x.toFixed(1) + '" y="' + (p.y + 20).toFixed(1) + '" font-size="9.5" fill="#6b4a2c" opacity=".5" text-anchor="middle" font-family="STKaiti,KaiTi,serif" letter-spacing="1">' + m[0] + "</text>";
    });
    s += "</g>";
    return s;
  }

  /* ---------------- 版图主体 ---------------- */
  function buildSvg() {
    var s = '<svg class="map-svg" id="mapSvg" viewBox="-26 -24 1052 911" preserveAspectRatio="xMidYMid meet" role="img" aria-label="中国版图">';
    s += "<defs>";
    s += '<linearGradient id="ocean" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e7ddc6"/><stop offset="1" stop-color="#dccfb2"/></linearGradient>';
    s += '<linearGradient id="provFill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d6c29a"/><stop offset=".45" stop-color="#cbb68c"/><stop offset="1" stop-color="#bfa87e"/></linearGradient>';
    s += '<linearGradient id="provFill1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d3c49e"/><stop offset="1" stop-color="#c2b086"/></linearGradient>';
    s += '<linearGradient id="provFill2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#cfbf9c"/><stop offset="1" stop-color="#bca87f"/></linearGradient>';
    s += '<linearGradient id="provFill3" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d9c8a1"/><stop offset="1" stop-color="#c6b288"/></linearGradient>';
    s += '<linearGradient id="provHover" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#a9c0bc"/><stop offset="1" stop-color="#8aa8a6"/></linearGradient>';
    s += '<linearGradient id="provActive" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8fb0ae"/><stop offset="1" stop-color="#729795"/></linearGradient>';
    s += '<radialGradient id="glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#f6ecd4" stop-opacity=".85"/><stop offset="1" stop-color="#f6ecd4" stop-opacity="0"/></radialGradient>';
    s += '<filter id="inkBleed" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="1.1"/></filter>';
    s += "</defs>";

    /* 画面晕染（径向淡出，不出现矩形边界） */
    s += '<ellipse cx="' + (VIEW_W * .46) + '" cy="' + (VIEW_H * .46) + '" rx="' + (VIEW_W * .56) + '" ry="' + (VIEW_H * .5) + '" fill="url(#glow)" opacity=".85"/>';

    s += '<g id="mapZoom">';
    s += '<g id="provLayer" style="filter:drop-shadow(0 2px 3px rgba(90,70,40,.3))">';
    G.provinces.forEach(function (p, pi) {
      s += '<path class="prov" data-fill="' + (pi % 4) + '" data-ad="' + p.ad + '" d="' + p.d + '" tabindex="0" role="button" aria-label="' + p.n + '"></path>';
    });
    s += "</g>";
    s += decoSVG();
    s += '<g id="cityLayer" opacity="0" pointer-events="none"></g>';
    s += '<g id="markLayer" pointer-events="none"></g>';
    s += '<g id="labelLayer" pointer-events="none"></g>';
    s += "</g>";

    /* 南海诸岛附图 */
    if (G.nanhai && G.nanhaiBox) {
      var b = G.nanhaiBox;
      var pad = 12;
      var bx = b[0] - pad, by = b[1] - pad, bw = (b[2] - b[0]) + pad * 2, bh = (b[3] - b[1]) + pad * 2;
      var scale = 128 / Math.max(bw, bh);
      var iw = bw * scale, ih = bh * scale;
      s += '<g id="nanhaiInset" transform="translate(' + (VIEW_W - iw - 16) + "," + (VIEW_H - ih - 16) + ')">';
      s += '<rect x="-3" y="-3" width="' + (iw + 6).toFixed(1) + '" height="' + (ih + 12).toFixed(1) + '" rx="3" fill="rgba(247,239,221,.6)" stroke="#b39c74" stroke-width=".7" opacity=".9"/>';
      s += '<svg width="' + iw.toFixed(1) + '" height="' + ih.toFixed(1) + '" viewBox="' + bx.toFixed(1) + " " + by.toFixed(1) + " " + bw.toFixed(1) + " " + bh.toFixed(1) + '">';
      s += '<path class="nanhai" d="' + G.nanhai + '"/>';
      s += "</svg>";
      s += '<text x="' + (iw / 2).toFixed(1) + '" y="' + (ih + 9).toFixed(1) + '" font-size="10" fill="#6b5a45" opacity=".8" text-anchor="middle" font-family="STKaiti,KaiTi,serif" letter-spacing="2">南海诸岛</text>';
      s += "</g>";
    }
    s += "</svg>";
    return s;
  }

  /* ---------------- 目录 ---------------- */
  function dirHTML(level, provAd) {
    if (level === "prov" && provAd) {
      var p = provByAd[provAd];
      var cities = (G.cities[provAd] || []);
      var h = '<h4>' + U.esc(p ? p.n : "") + " 下辖城市<span>" + cities.length + " 座</span></h4>";
      h += '<div class="prov-list">';
      cities.forEach(function (c) {
        var on = !!citySelected(c.n);
        h += '<button class="dir-item' + (on ? " checked" : "") + '" type="button" data-city="' + c.ad + '" data-name="' + U.esc(c.n) + '">' +
          '<span class="nm">' + U.esc(c.n) + "</span><span class=\"cx\"></span></button>";
      });
      if (!cities.length) h += '<div class="hint-text" style="padding:8px">该省暂无下辖城市数据</div>';
      h += "</div>";
      h += '<div class="dir-foot"><button class="btn btn-sm btn-ghost" type="button" data-act="back">' + U.ic("i-back") + " 返回全国版图</button></div>";
      return h;
    }
    var out = '<h4>省份目录<span>' + G.provinces.length + ' 个省级行政区</span></h4><div class="prov-list">';
    G.provinces.forEach(function (p) {
      out += '<button class="dir-item' + (provAd === p.ad ? " on" : "") + '" type="button" data-prov="' + p.ad + '">' +
        '<span class="dot"></span><span class="nm">' + U.esc(p.n) + "</span></button>";
    });
    out += "</div>";
    return out;
  }
  function citySelected(name) {
    for (var i = 0; i < S.cities.length; i++) if (S.cities[i].n === name) return true;
    return false;
  }

  /* ---------------- 选中城市标记 ---------------- */
  function marksHTML() {
    var s = "";
    S.cities.forEach(function (c) {
      var rec = cityIndex[c.ad];
      if (!rec) return;
      var x = rec.c.c[0], y = rec.c.c[1];
      if (!x && !y && c.ad.indexOf("710") === 0) return;
      s += '<circle cx="' + x + '" cy="' + y + '" r="3.4" fill="#f6ecd4" stroke="#26454e" stroke-width="1.6"/>';
      s += '<circle cx="' + x + '" cy="' + y + '" r="8" fill="none" stroke="#38646f" stroke-width="1" opacity=".55"/>';
    });
    return s;
  }

  /* ---------------- 缩放动画 ---------------- */
  var cur = { s: 1, tx: 0, ty: 0 };
  var animId = null;
  function applyTransform(g, s, tx, ty) {
    g.setAttribute("transform", "translate(" + tx.toFixed(2) + "," + ty.toFixed(2) + ") scale(" + s.toFixed(4) + ")");
  }
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
  function animateTo(g, target, done) {
    cancelAnimationFrame(animId);
    var from = { s: cur.s, tx: cur.tx, ty: cur.ty };
    var t0 = performance.now(), dur = 820;
    function step(t) {
      var k = Math.min(1, (t - t0) / dur);
      var e = easeOutCubic(k);
      cur.s = from.s + (target.s - from.s) * e;
      cur.tx = from.tx + (target.tx - from.tx) * e;
      cur.ty = from.ty + (target.ty - from.ty) * e;
      applyTransform(g, cur.s, cur.tx, cur.ty);
      if (k < 1) animId = requestAnimationFrame(step);
      else if (done) done();
    }
    animId = requestAnimationFrame(step);
  }
  function targetForProvince(provAd) {
    var p = provByAd[provAd];
    if (!p) return { s: 1, tx: 0, ty: 0 };
    var b = p.b;
    var bw = Math.max(b[2] - b[0], 30), bh = Math.max(b[3] - b[1], 30);
    var s = Math.min(VIEW_W / (bw * 1.28), VIEW_H / (bh * 1.22));
    s = Math.max(1.15, Math.min(s, 6.2));
    var cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
    return { s: s, tx: CX - cx * s, ty: CY - cy * s };
  }

  /* ---------------- 渲染 ---------------- */
  var tipEl = null;
  function render(pickMode) {
    if (!pickMode) { S.ui.mapLevel = "nation"; S.ui.mapProv = null; }
    var level = S.ui.mapLevel || "nation";
    var provAd = level === "prov" ? S.ui.mapProv : null;
    var prov = provAd ? provByAd[provAd] : null;
    var view = document.getElementById("view");

    var html = '<div class="home' + (pickMode ? " picking" : "") + '">';
    if (!pickMode) {
      html += '<div class="home-head">' +
        '<div class="home-kicker">山 河 卷 · 团 队 旅 行</div>' +
        '<h1 class="home-title">按<em>约束</em>落笔<br>把一队人的行程写成台账</h1>' +
        '<p class="home-sub">地点 · 时间 · 人物 三类约束合并推演<br>每一次自动调整都附【原因说明】</p>' +
        "</div>";
    }
    html += '<div class="map-stage" id="mapStage">' + buildSvg();
    if (pickMode) {
      html += '<div class="pick-bar">' +
        '<span class="pb-label">已选 <b id="pickCount">' + S.cities.length + "</b> 座城市</span>" +
        '<div class="pick-chips" id="pickChips"></div>' +
        '<button class="btn btn-sm btn-primary" type="button" data-act="confirm">确认目的地</button>' +
        "</div>";
    } else {
      html += '<div class="home-center">' +
        '<div class="silk-line">支持多选城市，可同省选择多座城市，也可跨省份挑选城市串联行程</div>' +
        '<button class="scroll-btn" type="button" data-act="start">开始规划行程<span class="btn-sub">SCROLL</span></button>' +
        "</div>";
    }
    if (pickMode) {
      html += '<div class="map-hint">' + (level === "prov" ? "点击城市板块勾选 / 取消，可跨省继续选择" : "点击省份板块下钻到城市，或使用右侧目录") + "</div>";
    }
    html += '<div class="map-legend"><span><i class="lg1"></i>已选城市</span><br><span><i class="lg2"></i>省级板块</span></div>';
    html += '<div class="map-tooltip" id="mapTip"></div>';
    html += "</div>";
    html += '<aside class="prov-dir" id="provDir">' + dirHTML(level, provAd) + "</aside>";
    html += "</div>";

    view.innerHTML = html;
    tipEl = document.getElementById("mapTip");
    mount(pickMode, level, provAd);
  }

  function mount(pickMode, level, provAd) {
    var svg = document.getElementById("mapSvg");
    var zoomG = document.getElementById("mapZoom");
    var provLayer = document.getElementById("provLayer");
    var cityLayer = document.getElementById("cityLayer");
    var labelLayer = document.getElementById("labelLayer");
    var markLayer = document.getElementById("markLayer");

    markLayer.innerHTML = marksHTML();

    /* 恢复/设置视图 */
    if (level === "prov" && provAd) {
      var t = targetForProvince(provAd);
      cur = t;
      applyTransform(zoomG, t.s, t.tx, t.ty);
      renderCities(provAd, cityLayer, labelLayer, t.s);
      focusProvStyles(provAd);
      cityLayer.setAttribute("opacity", "1");
      cityLayer.style.pointerEvents = "auto";
      var inset = document.getElementById("nanhaiInset");
      if (inset) inset.style.display = "none";
    } else {
      cur = { s: 1, tx: 0, ty: 0 };
      applyTransform(zoomG, 1, 0, 0);
      cityLayer.setAttribute("opacity", "0");
      cityLayer.innerHTML = "";
      provLayer.querySelectorAll(".prov").forEach(function (p) { p.style.opacity = ""; });
      provLayer.style.pointerEvents = "auto";
      labelLayer.innerHTML = "";
      var inset2 = document.getElementById("nanhaiInset");
      if (inset2) inset2.style.display = "";
    }

    /* 悬停提示 */
    function showTip(text, x, y) {
      if (!tipEl) return;
      tipEl.textContent = text;
      tipEl.style.left = (x + 14) + "px";
      tipEl.style.top = (y + 14) + "px";
      tipEl.classList.add("show");
    }
    function hideTip() { if (tipEl) tipEl.classList.remove("show"); }

    svg.addEventListener("mousemove", function (e) {
      var p = e.target.closest ? e.target.closest(".prov,.city-cell") : null;
      if (p && p.dataset.n) showTip(p.dataset.n, e.clientX, e.clientY);
      else hideTip();
    });
    svg.addEventListener("mouseleave", hideTip);

    /* 省份点击 */
    provLayer.addEventListener("click", function (e) {
      var p = e.target.closest(".prov");
      if (!p) return;
      focusProvince(p.dataset.ad);
    });
    provLayer.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" && e.key !== " ") return;
      var p = e.target.closest(".prov");
      if (!p) return;
      e.preventDefault();
      focusProvince(p.dataset.ad);
    });

    /* 城市点击 */
    cityLayer.addEventListener("click", function (e) {
      var c = e.target.closest(".city-cell");
      if (!c) return;
      toggleCity(c.dataset.city, c.dataset.name);
    });

    /* 目录交互 */
    var dir = document.getElementById("provDir");
    dir.addEventListener("click", function (e) {
      var b = e.target.closest("[data-prov]");
      if (b) { focusProvince(b.dataset.prov); return; }
      var ci = e.target.closest("[data-city]");
      if (ci) { toggleCity(ci.dataset.city, ci.dataset.name); return; }
      var act = e.target.closest("[data-act]");
      if (act && act.dataset.act === "back") goNation();
    });

    /* 地图按钮 */
    document.querySelectorAll("[data-act]").forEach(function (b) {
      if (b.closest("#provDir")) return;
      b.addEventListener("click", function () {
        var a = b.dataset.act;
        if (a === "start") { location.hash = "#/pick"; }
        else if (a === "home") { location.hash = "#/home"; }
        else if (a === "back") { goNation(); }
        else if (a === "confirm") { confirmPick(); }
      });
    });

    if (pickMode) setBackButton(level === "prov" ? "prov" : "home");
    updateChips();
  }

  function renderCities(provAd, layer, labels, scale) {
    var cities = G.cities[provAd] || [];
    var p = provByAd[provAd];
    var s = "";
    var ls = "";
    var fallbackPos = fallbackPositions(p, cities.length);
    cities.forEach(function (c, i) {
      var on = citySelected(c.n);
      var cls = "city-cell" + (on ? " on" : "");
      if (c.d) {
        s += '<path class="' + cls + '" data-city="' + c.ad + '" data-name="' + U.esc(c.n) + '" d="' + c.d + '"></path>';
      } else {
        var pos = fallbackPos[i];
        s += '<circle class="' + cls + '" data-city="' + c.ad + '" data-name="' + U.esc(c.n) + '" cx="' + pos[0] + '" cy="' + pos[1] + '" r="' + (9 / Math.max(scale, 1)) + '"></circle>';
      }
      var cx = c.d ? c.c[0] : fallbackPos[i][0];
      var cy = c.d ? c.c[1] : fallbackPos[i][1];
      ls += '<text class="clabel" x="' + cx + '" y="' + cy + '" font-size="' + (11.5 / Math.max(scale * .8, 1)).toFixed(2) + '" text-anchor="middle" letter-spacing="1">' + U.esc(c.n) + "</text>";
    });
    layer.innerHTML = s;
    labels.innerHTML = ls;
  }
  function fallbackPositions(p, n) {
    var b = p.b, out = [];
    for (var i = 0; i < n; i++) {
      out.push([b[0] + (b[2] - b[0]) * (0.36 + (i % 3) * 0.14), b[1] + (b[3] - b[1]) * (0.34 + Math.floor(i / 3) * 0.13)]);
    }
    return out;
  }

  function focusProvStyles(ad) {
    document.querySelectorAll("#provLayer .prov").forEach(function (p) {
      p.style.opacity = p.dataset.ad === ad ? "1" : ".13";
    });
    var layer = document.getElementById("provLayer");
    if (layer) { layer.style.pointerEvents = "none"; layer.style.filter = "none"; }
  }
  function unfocusProvStyles() {
    document.querySelectorAll("#provLayer .prov").forEach(function (p) { p.style.opacity = ""; });
    var layer = document.getElementById("provLayer");
    if (layer) { layer.style.pointerEvents = "auto"; layer.style.filter = "drop-shadow(0 2px 3px rgba(90,70,40,.3))"; }
  }

  function setBackButton(mode) {
    var stage = document.getElementById("mapStage");
    var btn = document.querySelector(".map-back");
    if (mode === "none") { if (btn) btn.remove(); return; }
    if (!btn) {
      btn = document.createElement("button");
      btn.className = "map-back";
      btn.type = "button";
      stage.appendChild(btn);
    }
    if (mode === "prov") {
      btn.innerHTML = U.ic("i-back") + " 返回全国版图";
      btn.onclick = function () { goNation(); };
    } else {
      btn.innerHTML = U.ic("i-back") + " 返回首页";
      btn.onclick = function () { location.hash = "#/home"; };
    }
  }

  function focusProvince(ad) {
    if (!provByAd[ad]) return;
    if (S.ui.mapLevel === "prov" && S.ui.mapProv === ad) return;
    S.ui.mapLevel = "prov";
    S.ui.mapProv = ad;
    AppState.save();
    var zoomG = document.getElementById("mapZoom");
    var t = targetForProvince(ad);
    animateTo(zoomG, t, function () {
      var cityLayer = document.getElementById("cityLayer");
      var labelLayer = document.getElementById("labelLayer");
      renderCities(ad, cityLayer, labelLayer, t.s);
      focusProvStyles(ad);
      cityLayer.style.pointerEvents = "auto";
      cityLayer.setAttribute("opacity", "1");
      var inset = document.getElementById("nanhaiInset");
      if (inset) inset.style.display = "none";
      var dir = document.getElementById("provDir");
      if (dir) dir.innerHTML = dirHTML("prov", ad);
    });
    setBackButton("prov");
    var d0 = document.getElementById("provDir");
    if (d0) d0.innerHTML = dirHTML("prov", ad);
  }

  function goNation() {
    S.ui.mapLevel = "nation";
    S.ui.mapProv = null;
    AppState.save();
    var zoomG = document.getElementById("mapZoom");
    animateTo(zoomG, { s: 1, tx: 0, ty: 0 }, function () {
      var cityLayer = document.getElementById("cityLayer");
      cityLayer.setAttribute("opacity", "0");
      cityLayer.style.pointerEvents = "none";
      cityLayer.innerHTML = "";
      unfocusProvStyles();
      document.getElementById("labelLayer").innerHTML = "";
      var inset = document.getElementById("nanhaiInset");
      if (inset) inset.style.display = "";
      var dir = document.getElementById("provDir");
      if (dir) dir.innerHTML = dirHTML("nation", null);
      setBackButton(location.hash.indexOf("#/pick") === 0 ? "home" : "none");
    });
  }

  function toggleCity(ad, name) {
    var provAd = null;
    for (var i = 0; i < S.cities.length; i++) {
      if (S.cities[i].n === name) {
        S.cities.splice(i, 1);
        refreshSelection();
        return;
      }
    }
    var rec = cityIndex[ad];
    if (rec) {
      Object.keys(G.cities).forEach(function (pa) {
        (G.cities[pa] || []).forEach(function (c) { if (c.ad === ad) provAd = pa; });
      });
    }
    S.cities.push({ n: name, ad: ad, prov: provAd ? provByAd[provAd].n : "" });
    refreshSelection();
  }

  function refreshSelection() {
    AppState.save();
    /* 更新城市板块状态 */
    document.querySelectorAll(".city-cell").forEach(function (el) {
      el.classList.toggle("on", citySelected(el.dataset.name));
    });
    document.querySelectorAll(".dir-item[data-city]").forEach(function (el) {
      el.classList.toggle("checked", citySelected(el.dataset.name));
    });
    document.getElementById("markLayer").innerHTML = marksHTML();
    updateChips();
  }

  function updateChips() {
    var box = document.getElementById("pickChips");
    var cnt = document.getElementById("pickCount");
    if (cnt) cnt.textContent = S.cities.length;
    if (!box) return;
    if (!S.cities.length) {
      box.innerHTML = '<span class="pick-empty">尚未选择城市</span>';
      return;
    }
    box.innerHTML = S.cities.map(function (c) {
      return '<span class="pick-chip">' + U.esc(c.n) + '<button type="button" data-rm="' + U.esc(c.n) + '" aria-label="移除">×</button></span>';
    }).join("");
    box.querySelectorAll("[data-rm]").forEach(function (b) {
      b.addEventListener("click", function (e) {
        e.stopPropagation();
        var nm = b.dataset.rm;
        S.cities = S.cities.filter(function (c) { return c.n !== nm; });
        refreshSelection();
      });
    });
  }

  function confirmPick() {
    if (!S.cities.length) { U.toast("请先选择至少一座城市"); return; }
    location.hash = "#/place/spots";
  }

  window.MapScreen = { render: render };
})();
