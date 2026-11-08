/* ===========================================================
   app.js —— 路由、启动、加载页、404
   =========================================================== */
(function () {
  "use strict";

  var S = window.STATE, U = window.UI, AS = window.AppState;
  var loadingTimer = null;

  function parseRoute() {
    var h = location.hash || "#/home";
    h = h.replace(/^#\/?/, "");
    if (!h) h = "home";
    return h.split("?")[0];
  }

  function showTopbar(show) {
    var tb = document.getElementById("topbar");
    if (tb) tb.hidden = !show;
  }

  function route() {
    var r = parseRoute();
    if (loadingTimer) { clearTimeout(loadingTimer); loadingTimer = null; if (window.Bgm) window.Bgm.pageFade(); }

    /* 首页 / 地图 */
    if (r === "home" || r === "") {
      showTopbar(false);
      window.MapScreen.render(false);
      document.title = "山河卷 · 团队旅游规划台账";
      return;
    }
    if (r === "pick") {
      showTopbar(false);
      window.MapScreen.render(true);
      return;
    }
    if (r === "loading") {
      showLoading();
      return;
    }
    if (r === "result") {
      if (!S.generated) { location.hash = "#/people/review"; return; }
      window.Result.render();
      return;
    }
    var stepId = AS.routeToStep[r];
    if (stepId) {
      if (!S.cities.length) { U.toast("请先选择目的地城市"); location.hash = "#/pick"; return; }
      window.Flow.render(stepId);
      return;
    }
    render404();
  }

  /* ---------------- 加载页 ---------------- */
  function showLoading() {
    showTopbar(false);
    var view = document.getElementById("view");
    view.innerHTML = '<div class="loading-screen">' +
      '<div class="loading-scroll">' + window.Art.scrollArt() + "</div>" +
      '<div class="loading-text">正在根据地点、时间、团队人员约束推演行程' +
      "<small>约束优先级：人物 ＞ 地点 ＞ 时间 · 所有自动调整将写入归因台账</small></div>" +
      '<div class="loading-bar"><i></i></div>' +
      "</div>";

    loadingTimer = setTimeout(function () {
      try {
        var t0 = performance.now();
        var model = window.Engine.generate();
        S.generated = model;
        S.ui.tab = 0;
        AS.save();
        if (window.Bgm) window.Bgm.pageFade();
        /* 保证加载动画至少展示 1.4 秒 */
        var wait = Math.max(0, 1450 - (performance.now() - t0));
        setTimeout(function () {
          location.hash = "#/result";
          setTimeout(function () { successModal(model); }, 700);
        }, wait);
      } catch (err) {
        console.error(err);
        U.toast("生成失败：" + (err && err.message ? err.message : "未知错误"));
        location.hash = "#/people/review";
      }
    }, 320);
  }

  /* ---------------- 生成成功弹窗 ---------------- */
  function successModal(m) {
    if (!m) return;
    var lv = { 1: 0, 2: 0, 3: 0 };
    (m.audit || []).forEach(function (a) { lv[a.level] = (lv[a.level] || 0) + 1; });
    U.modal(
      '<div style="text-align:center;padding:4px 0 10px">' +
      '<div style="font-family:var(--font-serif);font-size:38px;color:var(--stone-2);letter-spacing:.2em">推演完成</div>' +
      '<div class="hint-text" style="margin-top:6px">地点 · 时间 · 人物 三类约束已合并运算</div>' +
      "</div>" +
      '<div class="sum-grid" style="grid-template-columns:repeat(3,1fr);gap:12px">' +
      '<div class="paper-card" style="padding:14px;text-align:center"><div class="big-num">' + m.days.length + "<small>天</small></div><div class=\"hint-text\">行程台账</div></div>" +
      '<div class="paper-card" style="padding:14px;text-align:center"><div class="big-num">' + (m.audit || []).length + "<small>条</small></div><div class=\"hint-text\">自动调整</div></div>" +
      '<div class="paper-card" style="padding:14px;text-align:center"><div class="big-num">¥' + U.money(m.budget.total) + "</div><div class=\"hint-text\">团队总预算</div></div>" +
      "</div>" +
      '<div class="reason" style="margin-top:16px"><span class="rtag">原因说明</span>所有自动调整均按「人物约束 ＞ 地点偏好 ＞ 时间偏好」的优先级执行，并逐条写入归因台账，可随时溯源。</div>' +
      '<div class="modal-foot"><button class="btn btn-primary" data-close>查看台账</button></div>',
      { title: "行程方案已生成" }
    );
  }

  /* ---------------- 404 ---------------- */
  function render404() {
    showTopbar(false);
    var view = document.getElementById("view");
    view.innerHTML = '<div class="notfound">' +
      '<div class="nf-bg">' + window.Art.landscape(77123, { pal: "mist" }) + "</div>" +
      '<div class="nf-code">404</div>' +
      '<div class="nf-title">此页无迹</div>' +
      '<div class="nf-sub">迷途知返，可返回主卷重新落笔</div>' +
      '<button class="scroll-btn" type="button" data-nav="home" style="padding:14px 40px;font-size:18px">返回主卷</button>' +
      "</div>";
    view.querySelector("[data-nav]").addEventListener("click", function () { location.hash = "#/home"; });
  }

  /* ---------------- 全局点击：返回首页按钮 ---------------- */
  document.addEventListener("click", function (e) {
    var a = e.target.closest("a[data-nav]");
    if (a) { e.preventDefault(); location.hash = "#/home"; }
  });

  /* ---------------- 启动 ---------------- */
  function boot() {
    var hasSaved = false;
    try { hasSaved = AS.load(); } catch (e) { hasSaved = false; }

    window.addEventListener("hashchange", function () {
      if (window.Bgm) window.Bgm.pageFade();
      route();
    });

    if (!location.hash) location.hash = "#/home";
    route();

    if (hasSaved && S.cities.length) {
      var shown = false;
      try { shown = sessionStorage.getItem("resumeToastShown") === "1"; } catch (e) { shown = false; }
      if (!shown) {
        try { sessionStorage.setItem("resumeToastShown", "1"); } catch (e) { }
        setTimeout(function () {
          U.toast("已恢复上次规划进度，可继续填写或直接查看台账", 2600);
        }, 900);
      }
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
