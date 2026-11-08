/* ===========================================================
   art.js v3 —— 程序化「中式山水油画」场景（全站零实拍图片）
   层次：天空晕染 / 三层远山 / 云气 / 水面 / 主体 / 古木 / 笔触肌理
   =========================================================== */
(function () {
  "use strict";

  var uid = 0;
  function nid(p) { uid += 1; return p + "_" + uid; }

  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function f(n) { return Math.round(n * 10) / 10; }

  var PAL = {
    dawn: { sky: ["#e3d2b2", "#f1e3c6", "#e0c9a0"], far: "#9fb0aa", mid: "#5f7c77", near: "#2f443f", warm: "#c0854e", cool: "#7d9a9a", water: ["#c6d2c8", "#7f9a92"], sun: "#f4e2ba" },
    mist: { sky: ["#dce3d9", "#ebe6d0", "#cfd7c7"], far: "#a8b8ad", mid: "#7a9188", near: "#44574f", warm: "#b08f68", cool: "#8ba9a3", water: ["#cbd6ca", "#93a89e"], sun: "#f2ecd8" },
    jade: { sky: ["#d5e1cf", "#e9e4c6", "#c4d2bd"], far: "#97b29f", mid: "#5f8370", near: "#2f4c3d", warm: "#bb8d55", cool: "#7c9d8b", water: ["#c4d4c5", "#86a394"], sun: "#f0e6c6" },
    ochre: { sky: ["#e6cfa7", "#efdcb7", "#cfae85"], far: "#a89675", mid: "#7d6444", near: "#402f1f", warm: "#c47a40", cool: "#8d7c5f", water: ["#cdbd9c", "#98835f"], sun: "#f6ddb0" },
    dusk: { sky: ["#e5c39a", "#e9cea7", "#c49d76"], far: "#948775", mid: "#63685c", near: "#343a30", warm: "#c87f3a", cool: "#7f8470", water: ["#c8bfa4", "#928a72"], sun: "#f0c98e" },
    blue: { sky: ["#d8e2e2", "#e9e2ca", "#c5d1d1"], far: "#93a9ad", mid: "#5b7c83", near: "#2f484e", warm: "#b38f68", cool: "#7d9aa1", water: ["#c3d1d0", "#84a0a2"], sun: "#f2ecd6" }
  };

  function defs(id, pal) {
    var s = "<defs>";
    s += '<linearGradient id="sky' + id + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="' + pal.sky[0] + '"/><stop offset=".52" stop-color="' + pal.sky[1] + '"/><stop offset="1" stop-color="' + pal.sky[2] + '"/></linearGradient>';
    s += '<radialGradient id="glow' + id + '" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="' + pal.sun + '" stop-opacity=".9"/><stop offset="1" stop-color="' + pal.sun + '" stop-opacity="0"/></radialGradient>';
    s += '<linearGradient id="far' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + pal.far + '"/><stop offset="1" stop-color="' + pal.mid + '"/></linearGradient>';
    s += '<linearGradient id="mid' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + pal.mid + '"/><stop offset="1" stop-color="' + pal.near + '"/></linearGradient>';
    s += '<linearGradient id="near' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + pal.near + '"/><stop offset="1" stop-color="#20302b"/></linearGradient>';
    s += '<linearGradient id="wat' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + pal.water[0] + '"/><stop offset="1" stop-color="' + pal.water[1] + '"/></linearGradient>';
    s += '<radialGradient id="vig' + id + '" cx=".5" cy=".46" r=".76"><stop offset=".48" stop-color="#241c12" stop-opacity="0"/><stop offset="1" stop-color="#241c12" stop-opacity=".45"/></radialGradient>';
    s += "</defs>";
    return s;
  }

  function ridge(r, w, h, baseY, amp, fill, op, jitter) {
    var n = 16 + Math.floor(r() * 8);
    var pts = [[-12, h + 6]];
    for (var i = 0; i <= n; i++) {
      var x = (w + 24) * i / n - 12;
      var t = i / n;
      var peak = Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, t))), 0.55);
      var y = baseY - amp * peak * (0.45 + r() * 0.75) + (r() - .5) * (jitter || 0);
      if (i === 0 || i === n) y = baseY + 8;
      pts.push([x, y]);
    }
    pts.push([w + 12, h + 6]);
    var d = "M" + pts.map(function (p) { return f(p[0]) + " " + f(p[1]); }).join("L") + "Z";
    return '<path d="' + d + '" fill="' + fill + '" opacity="' + op + '"/>';
  }

  function dabs(r, w, h, y0, colors, n) {
    var s = "";
    for (var i = 0; i < n; i++) {
      var cx = r() * w, cy = y0 + r() * (h - y0);
      s += '<ellipse cx="' + f(cx) + '" cy="' + f(cy) + '" rx="' + f(6 + r() * 20) + '" ry="' + f(2.5 + r() * 7) + '" fill="' + colors[Math.floor(r() * colors.length)] +
        '" opacity="' + (0.04 + r() * 0.07).toFixed(3) + '" transform="rotate(' + f(-12 + r() * 24) + " " + f(cx) + " " + f(cy) + ')"/>';
    }
    return s;
  }

  function brushStroke(r, w, baseY, amp, color, n) {
    var s = "";
    for (var i = 0; i < n; i++) {
      var x = r() * w, y = baseY - r() * amp;
      var len = 10 + r() * 30;
      s += '<path d="M' + f(x) + " " + f(y) + "q" + f(len * .5) + " " + f(-2 - r() * 5) + " " + f(len) + " " + f(1 + r() * 3) +
        '" stroke="' + color + '" stroke-width="' + (1 + r() * 2.6).toFixed(1) + '" opacity="' + (0.06 + r() * 0.1).toFixed(3) +
        '" fill="none" stroke-linecap="round"/>';
    }
    return s;
  }

  function mistBand(r, w, y, op) {
    var s = "";
    for (var i = 0; i < 3; i++) {
      s += '<ellipse cx="' + f(w * (0.2 + r() * 0.6)) + '" cy="' + f(y + (r() - .5) * 12) + '" rx="' + f(46 + r() * 80) +
        '" ry="' + f(3 + r() * 6) + '" fill="#fbf4e4" opacity="' + (op * (0.45 + r() * 0.55)).toFixed(2) + '"/>';
    }
    return s;
  }

  function roof(x, y, w, hh, color, trim, tiles) {
    var hw = w / 2, flare = Math.max(4, w * 0.08);
    var d = "M" + f(x - hw - flare) + " " + f(y) +
      "Q" + f(x - hw + 2) + " " + f(y - hh * .28) + " " + f(x - hw + flare * 1.6) + " " + f(y - hh * .34) +
      "L" + f(x - hw + flare * 2.2) + " " + f(y - hh) +
      "L" + f(x + hw - flare * 2.2) + " " + f(y - hh) +
      "L" + f(x + hw - flare * 1.6) + " " + f(y - hh * .34) +
      "Q" + f(x + hw - 2) + " " + f(y - hh * .28) + " " + f(x + hw + flare) + " " + f(y) + "Z";
    var s = '<path d="' + d + '" fill="' + color + '"/>';
    s += '<path d="M' + f(x - hw - flare) + " " + f(y) + "Q" + f(x) + " " + f(y - hh * .12) + " " + f(x + hw + flare) + " " + f(y) +
      '" fill="none" stroke="' + trim + '" stroke-width="1.1" opacity=".7"/>';
    s += '<path d="M' + f(x - hw + flare * 2.2) + " " + f(y - hh) + "h" + f(w - flare * 4.4) +
      '" stroke="' + trim + '" stroke-width="1.4" opacity=".85"/>';
    if (tiles) {
      for (var i = 1; i < 6; i++) {
        var tx = x - hw + flare * 2.2 + (w - flare * 4.4) * i / 6;
        s += '<path d="M' + f(tx) + " " + f(y - hh) + "l" + f(-2) + " " + f(hh * .62) + '" stroke="#000" stroke-width=".6" opacity=".12"/>';
      }
    }
    return s;
  }

  function pine(x, groundY, hh, color) {
    var s = '<path d="M' + f(x) + " " + f(groundY) + "l" + f(-1.2) + " " + f(-hh * 0.3) + '" stroke="#3f3222" stroke-width="1.8" opacity=".85"/>';
    for (var i = 0; i < 4; i++) {
      var t = i / 4;
      var yy = groundY - hh * (0.26 + t * 0.62);
      var ww = hh * (0.36 - t * 0.075);
      s += '<path d="M' + f(x - ww) + " " + f(yy) + "q" + f(ww * .55) + " " + f(-hh * 0.12) + " " + f(ww * 1.1) + " " + f(-hh * .02) +
        "q" + f(ww * .5) + " " + f(hh * .1) + " " + f(ww * .9) + " " + f(hh * .02) + "z" +
        '" fill="' + color + '" opacity="' + (0.92 - t * 0.05).toFixed(2) + '"/>';
    }
    return s;
  }

  function boat(x, y, sc, color) {
    return '<g transform="translate(' + f(x) + "," + f(y) + ") scale(" + sc + ')" opacity=".95">' +
      '<path d="M-16 0h32l-5 6h-22z" fill="' + color + '"/>' +
      '<path d="M0 -1v-13l10 13z" fill="#f0e1c4" opacity=".92"/>' +
      '<path d="M0 -13l1 12" stroke="#6a5b45" stroke-width=".7"/>' +
      '<path d="M-8 7h16" stroke="#41605a" stroke-width=".8" opacity=".45"/></g>';
  }

  function houses(r, w, groundY, wallColor, roofColor, n) {
    var s = "";
    for (var i = 0; i < n; i++) {
      var x = 4 + i * (w - 8) / n + r() * 6;
      var ww = 22 + r() * 20, hh = 11 + r() * 9;
      s += '<rect x="' + f(x) + '" y="' + f(groundY - hh) + '" width="' + f(ww) + '" height="' + f(hh + 2) + '" fill="' + wallColor + '" opacity=".95"/>';
      s += roof(x + ww / 2, groundY - hh, ww * 1.3, 9 + r() * 4, roofColor, "#c9a86c", false);
      if (r() > .5) s += '<rect x="' + f(x + ww * .32) + '" y="' + f(groundY - hh * .6) + '" width="' + f(ww * .28) + '" height="' + f(hh * .36) + '" fill="#f0cd8a" opacity=".5"/>';
    }
    return s;
  }

  function water(r, w, h, y, gid, pal) {
    var s = '<rect x="0" y="' + f(y) + '" width="' + w + '" height="' + f(h - y) + '" fill="url(#wat' + gid + ')"/>';
    s += '<rect x="0" y="' + f(y) + '" width="' + w + '" height="10" fill="' + pal.near + '" opacity=".16"/>';
    for (var i = 0; i < 20; i++) {
      var yy = y + 4 + r() * (h - y - 6);
      var len = 14 + r() * 56;
      var x = r() * (w - len);
      s += '<path d="M' + f(x) + " " + f(yy) + "h" + f(len) + '" stroke="#fdf7e8" stroke-width="' + (0.7 + r() * 1.4).toFixed(1) +
        '" opacity="' + (0.1 + r() * .24).toFixed(2) + '" stroke-linecap="round"/>';
    }
    return s;
  }

  function scene(type, seed, opt) {
    opt = opt || {};
    var W = 360, H = 240;
    var r = rng(seed);
    var keys = ["dawn", "mist", "jade", "blue", "dusk", "ochre"];
    var pal = PAL[opt.pal || keys[seed % keys.length]];
    var id = nid("a");
    var horizon = H * (0.47 + r() * 0.05);
    var s = '<svg viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">';
    s += defs(id, pal);

    s += '<rect width="' + W + '" height="' + H + '" fill="url(#sky' + id + ')"/>';
    s += '<ellipse cx="' + f(W * .7) + '" cy="' + f(horizon - 40) + '" rx="70" ry="66" fill="url(#glow' + id + ')" opacity=".85"/>';
    s += '<circle cx="' + f(W * .7) + '" cy="' + f(horizon - 40) + '" r="11" fill="' + pal.sun + '" opacity=".92"/>';
    for (var c = 0; c < 4; c++) {
      s += '<ellipse cx="' + f(20 + r() * (W - 40)) + '" cy="' + f(horizon - 76 + r() * 52) + '" rx="' + f(36 + r() * 64) + '" ry="' + f(2.5 + r() * 4) +
        '" fill="#fbf4e3" opacity="' + (0.14 + r() * .16).toFixed(2) + '"/>';
    }

    s += ridge(r, W, H, horizon - 6, 78 + r() * 16, "url(#far" + id + ")", .62, 4);
    s += ridge(r, W, H, horizon + 4, 56 + r() * 14, "url(#far" + id + ")", .78, 5);
    s += mistBand(r, W, horizon - 8, .55);

    if (type === "lake") {
      s += ridge(r, W, H, horizon + 12, 34, "url(#mid" + id + ")", .8);
      s += water(r, W, H, horizon + 8, id, pal);
      s += '<ellipse cx="' + f(W * .27) + '" cy="' + f(horizon + 10) + '" rx="40" ry="6" fill="url(#mid' + id + ')" opacity=".7"/>';
      s += pine(W * .12, horizon + 11, 40, pal.near) + pine(W * .2, horizon + 13, 30, pal.near);
      s += boat(W * .68, horizon + 40, 1.05, "#33443f");
      s += mistBand(r, W, horizon + 24, .3);
    } else if (type === "mountain") {
      s += ridge(r, W, H, horizon + 28, 100, "url(#mid" + id + ")", .88, 8);
      s += '<path d="M' + f(W * .47) + " " + f(horizon - 18) + "l18 -34 16 34z" + '" fill="#f7efdb" opacity=".55"/>';
      s += '<path d="M' + f(W * .74) + " " + f(horizon + 2) + "l11 -20 10 20z" + '" fill="#f7efdb" opacity=".38"/>';
      s += mistBand(r, W, horizon + 40, .5);
      s += ridge(r, W, H, horizon + 74, 56, "url(#near" + id + ")", .55, 6);
      s += brushStroke(r, W, horizon + 70, 70, "#f2e6cc", 8);
      s += pine(W * .13, H - 10, 46, pal.near) + pine(W * .88, H - 12, 40, pal.near);
    } else if (type === "temple" || type === "palace") {
      var gy = horizon + 46;
      s += '<rect x="0" y="' + f(gy - 8) + '" width="' + W + '" height="' + f(H - gy + 8) + '" fill="' + pal.near + '" opacity=".22"/>';
      if (type === "palace") {
        s += '<rect x="' + f(W / 2 - 82) + '" y="' + f(gy + 6) + '" width="164" height="44" fill="#9a5636" opacity=".95"/>';
        s += roof(W / 2, gy - 4, 190, 26, "#7d4128", "#d9b271", true);
        s += roof(W / 2, gy - 30, 132, 22, "#86492f", "#d9b271", true);
        s += '<rect x="' + f(W / 2 - 12) + '" y="' + f(gy + 24) + '" width="24" height="26" fill="#4d2a1b" opacity=".9"/>';
        s += '<rect x="' + f(W / 2 - 56) + '" y="' + f(gy + 20) + '" width="18" height="22" fill="#3d2417" opacity=".55"/>';
        s += '<rect x="' + f(W / 2 + 38) + '" y="' + f(gy + 20) + '" width="18" height="22" fill="#3d2417" opacity=".55"/>';
      } else {
        s += '<rect x="' + f(W / 2 - 50) + '" y="' + f(gy + 4) + '" width="100" height="40" fill="#9c6446" opacity=".95"/>';
        s += roof(W / 2, gy - 2, 124, 24, "#743e2c", "#dcb275", true);
        s += '<rect x="' + f(W / 2 - 10) + '" y="' + f(gy + 18) + '" width="20" height="26" fill="#3f2820" opacity=".92"/>';
        s += '<path d="M' + f(W / 2 - 78) + " " + f(gy + 46) + "h156" + '" stroke="#6d4a36" stroke-width="3" opacity=".55"/>';
        s += roof(W / 2 - 56, gy + 30, 62, 16, "#7d4834", "#dcb275", false);
        s += roof(W / 2 + 56, gy + 30, 62, 16, "#7d4834", "#dcb275", false);
      }
      s += pine(W * .12, gy + 40, 54, pal.near) + pine(W * .88, gy + 44, 46, pal.near);
      s += mistBand(r, W, gy + 6, .5);
    } else if (type === "garden") {
      s += ridge(r, W, H, horizon + 2, 26, "url(#mid" + id + ")", .45);
      s += water(r, W, H, horizon + 16, id, pal);
      s += '<path d="M' + f(W * .64) + " " + f(horizon + 24) + "l26 -22 14 36z" + '" fill="#79715f" opacity=".9"/>';
      s += '<path d="M' + f(W * .2) + " " + f(horizon + 30) + "l32 -24 28 24z" + '" fill="#6a6154" opacity=".75"/>';
      s += roof(W * .2, horizon + 32, 58, 16, "#7c5c46", "#d3b184", true);
      s += '<rect x="' + f(W * .2 - 15) + '" y="' + f(horizon + 32) + '" width="30" height="22" fill="#8a6a52"/>';
      s += pine(W * .85, horizon + 40, 44, pal.near);
    } else if (type === "oldtown" || type === "nightmarket") {
      var gy2 = horizon + 52;
      s += houses(r, W, gy2, "#7a6047", "#4a382a", 5);
      s += '<rect x="0" y="' + f(gy2) + '" width="' + W + '" height="' + f(H - gy2) + '" fill="#69563f" opacity=".3"/>';
      s += '<path d="M0 ' + f(gy2 + 10) + "h" + W + '" stroke="#c9a86c" stroke-width="1.4" opacity=".32"/>';
      if (type === "nightmarket") {
        for (var l = 0; l < 8; l++) {
          var lx = 20 + l * (W - 40) / 8, ly = gy2 - 18 - (l % 2) * 8;
          s += '<circle cx="' + f(lx) + '" cy="' + f(ly) + '" r="3.6" fill="#f2c676" opacity=".95"/>';
          s += '<circle cx="' + f(lx) + '" cy="' + f(ly) + '" r="13" fill="#f2c676" opacity=".15"/>';
        }
        s += '<rect width="' + W + '" height="' + H + '" fill="#33323c" opacity=".22"/>';
      }
      s += mistBand(r, W, gy2 - 12, .32);
    } else if (type === "museum" || type === "art") {
      var my = horizon + 40;
      s += '<rect x="0" y="' + f(my) + '" width="' + W + '" height="' + f(H - my) + '" fill="#8a7d64" opacity=".16"/>';
      s += '<rect x="' + f(W * .16) + '" y="' + f(my - 34) + '" width="' + f(W * .68) + '" height="66" fill="#9c8c72" opacity=".95"/>';
      s += roof(W / 2, my - 34, W * .74, 20, "#6b5f4d", "#d8c69c", true);
      s += '<rect x="' + f(W * .2) + '" y="' + f(my + 30) + '" width="' + f(W * .6) + '" height="6" fill="#7a6d58" opacity=".5"/>';
      for (var q = 0; q < 7; q++) {
        s += '<rect x="' + f(W * .2 + q * W * .085) + '" y="' + f(my - 18) + '" width="' + f(W * .045) + '" height="30" fill="#f4e8cf" opacity=".42"/>';
      }
      s += pine(W * .07, H - 8, 42, pal.near) + pine(W * .94, H - 10, 36, pal.near);
    } else if (type === "river" || type === "bridge") {
      s += water(r, W, H, horizon - 2, id, pal);
      s += '<path d="M0 ' + f(horizon + 30) + "q" + f(W * .3) + " -18 " + f(W * .58) + " 4t" + f(W * .46) + " 0" + '" fill="none" stroke="#fdf7e8" stroke-width="2.4" opacity=".22"/>';
      if (type === "bridge") {
        var bw = 108, bx = W * .22, by2 = horizon + 30;
        s += '<path d="M' + f(bx) + " " + f(by2) + "q" + f(bw / 2) + " " + f(-bw * .4) + " " + f(bw) + " 0" + '" fill="none" stroke="#54452f" stroke-width="5" stroke-linecap="round"/>';
        for (var bb = 1; bb < 5; bb++) {
          var tx = bx + bw * bb / 5, ty = by2 - Math.sin(Math.PI * bb / 5) * bw * .2;
          s += '<path d="M' + f(tx) + " " + f(ty) + "v" + f(bw * .17) + '" stroke="#54452f" stroke-width="1.2" opacity=".7"/>';
        }
        s += '<path d="M' + f(bx) + " " + f(by2) + "q" + f(bw / 2) + " " + f(-bw * .4) + " " + f(bw) + " 0" + '" fill="none" stroke="#c9a86c" stroke-width="1" opacity=".5"/>';
      } else {
        s += '<path d="M' + f(W * .56) + " " + f(horizon - 2) + "l22 34h-44z" + '" fill="#6a6253" opacity=".85"/>';
      }
      s += boat(W * .74, horizon + 46, .9, "#33443f");
      s += pine(W * .09, horizon + 46, 44, pal.near);
    } else if (type === "coast") {
      s += water(r, W, H, horizon, id, pal);
      s += '<path d="M' + f(W * .64) + " " + f(horizon) + "l34 52h-66z" + '" fill="#6a6253" opacity=".85"/>';
      s += '<path d="M' + f(W * .06) + " " + f(horizon + 18) + "h50" + '" stroke="#fdf7e8" stroke-width="2.2" opacity=".28"/>';
      s += '<circle cx="' + f(W * .72) + '" cy="' + f(horizon - 30) + '" r="10" fill="' + pal.sun + '" opacity=".9"/>';
    } else if (type === "forest" || type === "grassland" || type === "park") {
      s += '<path d="M0 ' + f(horizon + 22) + "q" + f(W * .3) + " -22 " + f(W * .6) + " -2t" + f(W * .46) + " 8V" + H + 'H0z" fill="#7d8c69" opacity=".8"/>';
      s += '<path d="M0 ' + f(horizon + 56) + "q" + f(W * .3) + " -16 " + f(W * .62) + " 2t" + f(W * .5) + " 2V" + H + 'H0z" fill="#5c6f52"/>';
      s += pine(W * .14, horizon + 70, 50, "#3c5340") + pine(W * .28, horizon + 78, 40, "#31463a") + pine(W * .84, horizon + 72, 46, "#3c5340");
      s += pine(W * .5, horizon + 84, 34, "#31463a");
      s += mistBand(r, W, horizon + 24, .42);
    } else if (type === "waterfall") {
      s += ridge(r, W, H, horizon + 28, 96, "url(#mid" + id + ")", .9, 9);
      s += '<path d="M' + f(W * .47) + " " + f(horizon - 6) + "l10 0 -3 88 -7 0z" + '" fill="#f7efdb" opacity=".92"/>';
      s += '<ellipse cx="' + f(W * .49) + '" cy="' + f(horizon + 78) + '" rx="34" ry="7" fill="#f7efdb" opacity=".55"/>';
      s += mistBand(r, W, horizon + 62, .5);
      s += pine(W * .18, horizon + 62, 48, pal.near) + pine(W * .82, horizon + 66, 42, pal.near);
    } else if (type === "desert") {
      s += '<path d="M0 ' + f(horizon + 26) + "q" + f(W * .32) + " -28 " + f(W * .62) + " 0t" + f(W * .5) + " -6V" + H + 'H0z" fill="#d0b892"/>';
      s += '<path d="M0 ' + f(horizon + 62) + "q" + f(W * .34) + " -22 " + f(W * .64) + " 4t" + f(W * .5) + " -2V" + H + 'H0z" fill="#b79c74"/>';
      s += '<path d="M' + f(W * .12) + " " + f(horizon + 32) + "q44 -12 70 2" + '" fill="none" stroke="#e8d5ae" stroke-width="1.6" opacity=".6"/>';
    } else if (type === "cave") {
      s += '<rect width="' + W + '" height="' + H + '" fill="#574f43"/>';
      s += '<ellipse cx="' + f(W * .5) + '" cy="' + f(H * .58) + '" rx="' + f(W * .34) + '" ry="' + f(H * .34) + '" fill="#ddceab" opacity=".62"/>';
      s += '<path d="M' + f(W * .12) + " " + f(H) + "q" + f(W * .38) + " " + f(-H * .66) + " " + f(W * .76) + " 0" + '" fill="#392f26"/>';
    } else {
      var gy3 = horizon + 50;
      s += ridge(r, W, H, horizon + 18, 46, "url(#mid" + id + ")", .6);
      s += ridge(r, W, H, horizon + 44, 30, "url(#near" + id + ")", .5);
      s += roof(W / 2, gy3 + 14, 54, 16, "#6d4c39", "#d3b184", true);
      s += roof(W / 2, gy3 + 2, 40, 14, "#7a563f", "#d3b184", true);
      s += '<rect x="' + f(W / 2 - 20) + '" y="' + f(gy3 + 14) + '" width="40" height="30" fill="#7d5a42"/>';
      s += pine(W * .2, gy3 + 30, 44, pal.near) + pine(W * .8, gy3 + 34, 38, pal.near);
      s += mistBand(r, W, gy3 - 6, .34);
    }

    s += dabs(r, W, H, horizon - 20, [pal.warm, pal.cool, pal.near, "#f7e9c9"], 26);
    s += brushStroke(r, W, horizon + 40, 50, pal.warm, 10);
    s += '<rect width="' + W + '" height="' + H + '" fill="url(#vig' + id + ')"/>';
    s += '<rect width="' + W + '" height="' + H + '" fill="none" stroke="#54452f" stroke-width="1" opacity=".2"/>';
    s += "</svg>";
    return s;
  }

  function landscape(seed, opts) {
    opts = opts || {};
    var W = 1200, H = 700;
    var r = rng(seed);
    var pal = PAL[opts.pal || "dawn"];
    var id = nid("L");
    var s = '<svg viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">';
    s += defs(id, pal);
    s += '<rect width="' + W + '" height="' + H + '" fill="url(#sky' + id + ')"/>';
    s += '<ellipse cx="' + (W * .72) + '" cy="' + (H * .26) + '" rx="260" ry="260" fill="url(#glow' + id + ')" opacity=".9"/>';
    s += '<circle cx="' + (W * .72) + '" cy="' + (H * .26) + '" r="40" fill="' + pal.sun + '" opacity=".85"/>';
    s += ridge(r, W, H, H * .58, 165, "url(#far" + id + ")", .5);
    s += ridge(r, W, H, H * .7, 140, "url(#far" + id + ")", .55);
    s += mistBand(r, W, H * .62, .5);
    s += ridge(r, W, H, H * .86, 130, "url(#mid" + id + ")", .45);
    s += mistBand(r, W, H * .82, .38);
    s += pine(W * .1, H * .97, 84, pal.near) + pine(W * .19, H * .99, 62, pal.near);
    s += dabs(r, W, H, H * .4, [pal.warm, pal.cool], 40);
    s += '<rect width="' + W + '" height="' + H + '" fill="url(#vig' + id + ')"/>';
    s += "</svg>";
    return s;
  }

  function scrollArt() {
    return '<svg viewBox="0 0 560 150" width="100%" xmlns="http://www.w3.org/2000/svg">' +
      '<rect x="26" y="0" width="508" height="150" rx="3" fill="#f7edd8" stroke="#c8b48f"/>' +
      '<rect x="10" y="-8" width="22" height="166" rx="11" fill="url(#roller)"/>' +
      '<rect x="528" y="-8" width="22" height="166" rx="11" fill="url(#roller)"/>' +
      '<defs><linearGradient id="roller" x1="0" y1="0" x2="1" y2="0">' +
      '<stop offset="0" stop-color="#c9a86c"/><stop offset=".4" stop-color="#e6cd97"/><stop offset=".75" stop-color="#b08a4a"/><stop offset="1" stop-color="#8e6c34"/></linearGradient></defs>' +
      '<g opacity=".6">' +
      '<path d="M40 112q80 -46 160 -10t180 -16 140 8" fill="none" stroke="#8fa39b" stroke-width="2.4"/>' +
      '<path d="M40 124q96 -30 176 -4t170 -8 140 4" fill="none" stroke="#6f8781" stroke-width="1.6"/>' +
      '<circle cx="432" cy="44" r="15" fill="#dcc39a" opacity=".85"/>' +
      '<path d="M132 122l30 -38 28 38z" fill="#5c7570" opacity=".75"/>' +
      '<path d="M312 122l40 -48 34 48z" fill="#48605c" opacity=".7"/>' +
      '<path d="M120 122l8 -22" stroke="#4a3a28" stroke-width="2" opacity=".6"/>' +
      "</g></svg>";
  }

  window.Art = { scene: scene, landscape: landscape, scrollArt: scrollArt, hash: hash };
})();
