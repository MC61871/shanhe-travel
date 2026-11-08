/* ===========================================================
   ui.js —— 通用工具、弹窗、提示、导航栏
   =========================================================== */
(function () {
  "use strict";

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function ic(name, cls) {
    return '<svg class="' + (cls || "") + '" aria-hidden="true"><use href="#' + name + '"/></svg>';
  }

  var toastTimer = null;
  function toast(msg, ms) {
    var el = $("#toast");
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    el.style.animation = "none";
    void el.offsetWidth;
    el.style.animation = "";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, ms || 2200);
  }

  /* ---------------- 弹窗 ---------------- */
  function modal(html, opts) {
    opts = opts || {};
    var root = $("#modalRoot");
    root.innerHTML = '<div class="modal ' + (opts.wide ? "wide" : "") + '" role="dialog" aria-modal="true">' +
      '<div class="modal-head"><h3>' + esc(opts.title || "") + "</h3>" +
      '<button class="modal-close" type="button" data-close aria-label="关闭">' + ic("i-x") + "</button></div>" +
      "<div class=\"modal-body\">" + html + "</div></div>";
    root.hidden = false;
    document.body.style.overflow = "hidden";
    root.onclick = function (e) {
      if (e.target === root || e.target.closest("[data-close]")) closeModal();
    };
    return root.querySelector(".modal");
  }
  function closeModal() {
    var root = $("#modalRoot");
    if (!root) return;
    root.hidden = true;
    root.innerHTML = "";
    document.body.style.overflow = "";
  }
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeModal();
  });

  /* ---------------- 顶栏面包屑 ---------------- */
  var CRUMB_MAP = {
    home: ["首页版图", "城市选择", "地点模块", "时间模块", "人物模块", "行程台账"],
    pick: ["首页版图", "城市选择"],
    place: ["首页版图", "城市选择", "地点模块"],
    time: ["首页版图", "城市选择", "地点模块", "时间模块"],
    people: ["首页版图", "城市选择", "地点模块", "时间模块", "人物模块"],
    result: ["首页版图", "城市选择", "地点模块", "时间模块", "人物模块", "行程台账"]
  };
  function crumbs(key) {
    var arr = CRUMB_MAP[key] || CRUMB_MAP.home;
    var html = arr.map(function (n, i) {
      return (i ? '<span class="arr">›</span>' : "") + '<span class="cb' + (i === arr.length - 1 ? " on" : "") + '">' + esc(n) + "</span>";
    }).join("");
    var el = $("#crumbs");
    if (el) el.innerHTML = html;
  }

  function showTopbar(show) {
    var el = $("#topbar");
    if (el) el.hidden = !show;
  }

  /* ---------------- 复制文本 ---------------- */
  function copyText(text) {
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      return ok;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { return true; }).catch(fallback);
    }
    return Promise.resolve(fallback());
  }

  /* ---------------- 其它 ---------------- */
  function money(n) {
    n = Math.round(n || 0);
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function scrollTop() {
    window.scrollTo({ top: 0, behavior: "instant" in document.documentElement.style ? "instant" : "auto" });
  }

  function debounce(fn, ms) {
    var t;
    return function () {
      var args = arguments, ctx = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, ms || 120);
    };
  }

  window.UI = {
    $: $, $$: $$, esc: esc, ic: ic, toast: toast,
    modal: modal, closeModal: closeModal,
    crumbs: crumbs, showTopbar: showTopbar,
    copyText: copyText, money: money, clamp: clamp,
    scrollTop: scrollTop, debounce: debounce
  };
})();
