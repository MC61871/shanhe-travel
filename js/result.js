/* ===========================================================
   result.js —— 事件模块：8 个台账标签页 / 弹窗 / 导出
   =========================================================== */
(function () {
  "use strict";

  var S = window.STATE, M = window.META, U = window.UI, AS = window.AppState;

  var TABS = [
    { id: "days", name: "按天行程总表", icon: "i-cal" },
    { id: "transport", name: "交通方案台账", icon: "i-bus" },
    { id: "food", name: "美食与用餐清单", icon: "i-bowl" },
    { id: "hotel", name: "住宿安排详情", icon: "i-bed" },
    { id: "supplies", name: "物资、药品与行前待办", icon: "i-yao" },
    { id: "budget", name: "预算明细台账", icon: "i-money" },
    { id: "emergency", name: "突发应急预案", icon: "i-alert" },
    { id: "audit", name: "全部修改归因记录", icon: "i-log" }
  ];

  function model() { return S.generated; }

  /* ---------------- 头部 ---------------- */
  function headHTML(m) {
    var p = m.params;
    var cities = p.cities.join("、");
    var people = p.people.count || "—";
    return '<header class="ledger-head">' +
      '<div class="scroll-banner">' +
      '<div class="sb-title">团队行程规划台账</div>' +
      '<div class="sb-sub">已规划目的地：' + U.esc(cities) + " ｜ 出行周期：" + U.esc(p.time.start) + " — " + U.esc(p.time.end) +
      " ｜ 团队人数：" + U.esc(people) + " 人</div>" +
      "</div>" +
      '<div class="sb-actions">' +
      '<button class="btn btn-sm btn-ghost" data-act="restart">' + U.ic("i-redo") + "重新规划</button>" +
      '<button class="btn btn-sm btn-ghost" data-act="pdf">' + U.ic("i-print") + "导出 PDF 台账</button>" +
      '<button class="btn btn-sm btn-ghost" data-act="copy">' + U.ic("i-copy") + "复制纯文本行程</button>" +
      '<button class="btn btn-sm btn-ghost" data-act="constraints">' + U.ic("i-list") + "查看全部约束汇总</button>" +
      "</div></header>";
  }

  function tabsHTML() {
    var cur = S.ui.tab || 0;
    return '<nav class="ledger-tabs">' + TABS.map(function (t, i) {
      return '<button class="ltab' + (i === cur ? " on" : "") + '" type="button" data-tab="' + i + '">' +
        '<span class="no">' + (i + 1) + "</span>" + U.esc(t.name) + "</button>";
    }).join("") + "</nav>";
  }

  /* ---------------- 标签 1：按天行程 ---------------- */
  function wxClass(w) {
    if (w.rain) return "wx-rain";
    if (w.hot) return "wx-hot";
    return "wx-ok";
  }
  function tabDays(m) {
    var html = '<div class="panel-head"><h2 class="panel-title">逐日行程时间轴</h2>' +
      '<p class="panel-sub">行程会根据团队人员、天气、景点开放时间、通勤距离动态排布；所有自动调整项附带【原因说明】</p></div>';
    m.days.forEach(function (d, di) {
      html += '<article class="day-card paper-card fret" data-day="' + di + '">' +
        '<div class="day-head">' +
        '<div class="day-no">DAY ' + d.i + "</div>" +
        '<div class="day-date">' + U.esc(d.date) + " · " + U.esc(d.week) + "</div>" +
        '<span class="wx-tag ' + wxClass(d.weather) + '">' + U.esc(d.weather.tag) + "</span>" +
        '<div class="day-theme">' + U.esc(d.theme) + "</div>" +
        "</div>" +
        '<div class="wx-note">' + U.esc(d.weather.note) + (d.cities.length > 1 ? "｜当日串联：" + U.esc(d.cities.join(" + ")) : "") + "</div>" +
        '<table class="tl"><thead><tr><th style="width:74px">时间</th><th style="width:190px">事项</th><th style="width:140px">地点</th><th>简要说明</th></tr></thead><tbody>';

      d.entries.forEach(function (e) {
        var clickable = !!e.spot;
        html += '<tr class="' + (clickable ? "clickable" : "") + '"' +
          (clickable ? ' data-spot-city="' + U.esc(e.spot.city) + '" data-spot-name="' + U.esc(e.spot.name) + '"' : "") + ">" +
          "<td><b>" + U.esc(e.t) + "</b></td>" +
          "<td>" + U.esc(e.title) + "</td>" +
          "<td>" + U.esc(e.place) + "</td>" +
          "<td>" + U.esc(e.detail || "") +
          (clickable ? '<span class="tl-link">查看点位</span>' : "") + "</td></tr>";
        if (e.reason) {
          html += '<tr class="reason-row"><td></td><td colspan="3"><div class="reason inline-reason">' +
            '<span class="rtag">原因说明</span>' + U.esc(e.reason) + "</div></td></tr>";
        }
      });

      html += "</tbody></table>" +
        '<div class="day-foot"><button class="btn btn-sm btn-ghost" type="button" data-backup="' + di + '">' + U.ic("i-yun") + "查看当日备用方案</button>" +
        '<span class="hint-text">点击带下划线的点位可查看油画预览与开放信息</span></div>' +
        "</article>";
    });
    return html;
  }

  /* ---------------- 标签 2：交通 ---------------- */
  function tabTransport(m) {
    var t = m.transport;
    var html = '<div class="panel-head"><h2 class="panel-title">交通方案汇总台账</h2>' +
      '<p class="panel-sub">长途大交通 + 市内交通统一规划，自动过滤团队不可行方案</p></div>';

    html += '<h3 class="sec-title"><span>一</span>长途交通</h3>';
    if (!t.long.length) {
      html += '<div class="empty">本次行程为单城市，无城市间长途交通。</div>';
    } else {
      html += '<div class="table-wrap"><table class="grid-table"><thead><tr>' +
        "<th>路段</th><th>推荐方式</th><th>耗时</th><th>预估票价</th><th>是否匹配首尾约束</th><th>原因说明</th></tr></thead><tbody>" +
        t.long.map(function (x) {
          return "<tr><td><b>" + U.esc(x.seg) + "</b></td><td>" + U.esc(x.way) + "</td><td>" + U.esc(x.time) +
            "</td><td>¥" + U.money(x.cost) + " / 人</td><td>" + U.esc(x.fit) + "</td><td class=\"cell-reason\">" + U.esc(x.reason) + "</td></tr>";
        }).join("") + "</tbody></table></div>";
    }

    html += '<h3 class="sec-title"><span>二</span>市内通勤</h3><div class="table-wrap"><table class="grid-table"><thead><tr>' +
      "<th>路段</th><th>推荐方式</th><th>预估时长</th><th>预估费用</th><th>注意事项</th><th>原因说明</th></tr></thead><tbody>" +
      t.local.map(function (x) {
        return "<tr><td>" + U.esc(x.seg) + "</td><td>" + U.esc(x.way) + "</td><td>" + U.esc(x.time) +
          "</td><td>¥" + U.money(x.cost) + "</td><td>" + U.esc(x.note) + "</td><td class=\"cell-reason\">" + U.esc(x.reason) + "</td></tr>";
      }).join("") + "</tbody></table></div>";

    var blocked = m.audit.filter(function (a) { return a.stage.indexOf("出行限制") >= 0; });
    if (blocked.length) {
      html += '<div class="reason" style="margin-top:18px"><span class="rtag">原因说明</span>' +
        blocked.map(function (b) { return "<div>" + U.esc(b.reason) + "</div>"; }).join("") + "</div>";
    }
    return html;
  }

  /* ---------------- 标签 3：美食 ---------------- */
  function tabFood(m) {
    var f = m.food;
    var html = '<div class="panel-head"><h2 class="panel-title">美食 & 小吃清单台账</h2>' +
      '<p class="panel-sub">联动地点模块餐饮偏好、人物模块过敏忌口；过敏类为强约束</p></div>';

    html += '<h3 class="sec-title"><span>一</span>正餐推荐</h3><div class="food-grid">';
    f.meals.forEach(function (x) {
      html += '<div class="food-card paper-card">' +
        '<div class="fc-head"><b>' + U.esc(x.name) + "</b><span class=\"fc-price\">¥" + x.price + " / 人</span></div>" +
        '<div class="fc-meta">' + U.esc(x.city) + " ｜ " + U.esc(x.where) + "</div>" +
        '<div class="fc-dishes">推荐菜品：' + U.esc(x.dishes.join("、")) + "</div>" +
        '<div class="fc-meta">预约：' + U.esc(x.booking) + "</div>" +
        '<div class="fc-meta">' + U.esc(x.note) + "</div>" +
        '<div class="reason inline-reason" style="margin-top:10px"><span class="rtag">原因说明</span>' + U.esc(x.reason) + "</div>" +
        "</div>";
    });
    html += "</div>";

    html += '<h3 class="sec-title"><span>二</span>街边小吃与特色饮品</h3><div class="snack-list">';
    f.snacks.forEach(function (s) {
      html += '<div class="snack-item"><div class="sn-head"><b>' + U.esc(s.name) + '</b><span class="fc-price">¥' + s.price + " / 人</span></div><div class=\"sn-note\">" + U.esc(s.note) + "</div></div>";
    });
    f.drinks.forEach(function (s) {
      html += '<div class="snack-item"><div class="sn-head"><b>饮品 · ' + U.esc(s.name) + '</b><span class="fc-price">¥' + s.price + '</span></div><div class="sn-note">' + U.esc(s.note) + "</div></div>";
    });
    html += "</div>";

    html += '<h3 class="sec-title"><span>三</span>避雷清单（已剔除）</h3>';
    if (!f.avoid.length) html += '<div class="empty">未触发忌口剔除。</div>';
    else {
      html += '<div class="table-wrap"><table class="grid-table"><thead><tr><th>城市</th><th>被剔除菜品</th><th>原因</th></tr></thead><tbody>' +
        f.avoid.map(function (a) {
          return "<tr><td>" + U.esc(a.city) + "</td><td>" + U.esc(a.text) + "</td><td class=\"cell-reason\">" + U.esc(a.why) + "</td></tr>";
        }).join("") + "</tbody></table></div>";
    }
    return html;
  }

  /* ---------------- 标签 4：住宿 ---------------- */
  function tabHotel(m) {
    var html = '<div class="panel-head"><h2 class="panel-title">住宿安排台账</h2>' +
      '<p class="panel-sub">优先匹配地点模块住宿偏好与位置偏好，最多提供 3 套备选</p></div><div class="hotel-grid">';
    m.hotels.forEach(function (h, i) {
      html += '<div class="hotel-card paper-card fret">' +
        '<div class="hc-badge">备选 ' + (i + 1) + "</div>" +
        '<div class="hc-name">' + U.esc(h.name) + "</div>" +
        '<div class="hc-area">' + U.esc(h.area) + "</div>" +
        '<div class="hc-row"><span>房型建议</span><b>' + U.esc(h.rooms) + "</b></div>" +
        '<div class="hc-row"><span>单价区间</span><b>¥' + U.money(h.price) + " / 间 / 晚</b></div>" +
        '<div class="hc-row"><span>配套设施</span><b>' + U.esc(h.fac.join(" · ")) + "</b></div>" +
        '<div class="hc-row"><span>预约提示</span><b>' + U.esc(h.book) + "</b></div>" +
        '<div class="hc-tags"><span>' + U.esc(h.tags.store) + "</span><span>" + U.esc(h.tags.pharmacy) + "</span><span>" + U.esc(h.tags.access) + "</span></div>" +
        '<div class="reason inline-reason" style="margin-top:12px"><span class="rtag">原因说明</span>' + U.esc(h.reason) + "</div>" +
        "</div>";
    });
    html += "</div>";
    return html;
  }

  /* ---------------- 标签 5：物资待办 ---------------- */
  function tabSupplies(m) {
    var s = m.supplies;
    var html = '<div class="panel-head"><h2 class="panel-title">行前准备清单 + 随身物资</h2>' +
      '<p class="panel-sub">按天气、行程强度与成员健康情况生成，勾选状态自动保存</p></div>';

    html += '<div class="sup-grid">' +
      '<div class="paper-card fret"><h4 class="sup-title">' + U.ic("i-scroll") + ' 物资清单</h4><div class="check-list">' +
      s.items.map(function (x, i) {
        var id = "sup-i" + i;
        var on = !!S.checked[id];
        return '<label class="check-item' + (on ? " done" : "") + '"><input type="checkbox" data-check="' + id + '"' + (on ? " checked" : "") + '><span class="box"></span><span class="tx">' + U.esc(x) + "</span></label>";
      }).join("") + "</div></div>" +

      '<div class="paper-card fret"><h4 class="sup-title">' + U.ic("i-yao") + ' 药品清单</h4><div class="check-list">' +
      s.meds.map(function (x, i) {
        var id = "sup-m" + i;
        var on = !!S.checked[id];
        return '<label class="check-item' + (on ? " done" : "") + '"><input type="checkbox" data-check="' + id + '"' + (on ? " checked" : "") + '><span class="box"></span><span class="tx">' + U.esc(x) + "</span></label>";
      }).join("") + "</div></div>" +
      "</div>";

    html += '<h3 class="sec-title"><span>三</span>角色待办</h3><div class="todo-list">';
    s.todos.forEach(function (t, i) {
      var id = "todo-" + i;
      var on = !!S.checked[id];
      html += '<label class="todo-item' + (on ? " done" : "") + '"><input type="checkbox" data-check="' + id + '"' + (on ? " checked" : "") + '>' +
        '<span class="role">' + U.esc(t.role) + '</span><span class="box"></span><span class="tx">' + U.esc(t.text) + "</span></label>";
    });
    html += "</div>";
    return html;
  }

  /* ---------------- 标签 6：预算 ---------------- */
  function tabBudget(m) {
    var b = m.budget;
    var perView = S.ui.budgetPer !== false;
    var n = m.ctx.count;
    var html = '<div class="panel-head"><h2 class="panel-title">预算拆解台账</h2>' +
      '<p class="panel-sub">分项预估花费、人均花费与总预算；可手动调整单项预算并重新核算</p>' +
      '<div class="view-switch"><button class="' + (perView ? "on" : "") + '" data-bview="per" type="button">按人均</button>' +
      '<button class="' + (perView ? "" : "on") + '" data-bview="total" type="button">按团队总价</button></div></div>';

    html += '<div class="table-wrap"><table class="grid-table budget-table"><thead><tr>' +
      "<th>分项</th><th>说明</th><th>" + (perView ? "人均（元）" : "合计（元）") + "</th><th>占比</th><th>原因说明</th></tr></thead><tbody>";
    b.rows.forEach(function (r, i) {
      var val = perView ? Math.round(r.total / n) : r.total;
      var share = b.total ? (r.total / b.total * 100) : 0;
      html += "<tr><td><b>" + U.esc(r.name) + "</b></td><td>" + U.esc(r.note) + "</td><td class=\"num\">" + U.money(val) +
        "</td><td><div class=\"bar\"><i style=\"width:" + share.toFixed(1) + "%\"></i></div><span class=\"pct\">" + share.toFixed(1) + "%</span></td>" +
        "<td class=\"cell-reason\">" + U.esc(r.reason) + ' <button class="mini-btn" data-editrow="' + i + '">调整</button></td></tr>';
    });
    html += "</tbody><tfoot><tr><td><b>合计</b></td><td>" + U.esc(n) + " 人 · " + b.nights + " 晚 · " + b.rooms + " 间</td><td class=\"num\"><b>" +
      U.money(perView ? b.perCap : b.total) + "</b></td><td>100%</td><td></td></tr></tfoot></table></div>";

    html += '<div class="budget-sum">' +
      '<div><span>团队总预算</span><b>¥' + U.money(b.total) + "</b></div>" +
      '<div><span>人均预算</span><b>¥' + U.money(b.perCap) + "</b></div>" +
      '<div><span>预算模式</span><b>' + U.esc(S.people.budget.mode || "—") + "</b></div>" +
      "</div>";
    return html;
  }

  /* ---------------- 标签 7：应急 ---------------- */
  function tabEmergency(m) {
    var html = '<div class="panel-head"><h2 class="panel-title">旅途应急方案台账</h2>' +
      '<p class="panel-sub">结合本行程定制，不是通用模板</p></div>';
    m.emergency.forEach(function (e) {
      html += '<div class="emerg-card paper-card fret">' +
        '<div class="ec-title">' + U.esc(e.title) + "</div>" +
        '<div class="ec-plan">' + U.esc(e.plan) + "</div>" +
        '<div class="reason inline-reason"><span class="rtag">原因说明</span>' + U.esc(e.reason) + "</div>" +
        "</div>";
    });
    return html;
  }

  /* ---------------- 标签 8：归因 ---------------- */
  function tabAudit(m) {
    var a = m.audit;
    var l1 = a.filter(function (x) { return x.level === 1; }).length;
    var l2 = a.filter(function (x) { return x.level === 2; }).length;
    var l3 = a.filter(function (x) { return x.level === 3; }).length;
    var html = '<div class="panel-head"><h2 class="panel-title">全流程约束变更记录</h2>' +
      '<p class="panel-sub">约束优先级：人物约束（最高）＞ 地点偏好 ＞ 时间偏好。以下为全部自动改动，逐条可溯源</p></div>';

    html += '<div class="audit-stat">' +
      '<div class="as-item"><b>' + a.length + "</b><span>调整总数</span></div>" +
      '<div class="as-item lv1"><b>' + l1 + "</b><span>人物约束触发</span></div>" +
      '<div class="as-item lv2"><b>' + l2 + "</b><span>地点偏好触发</span></div>" +
      '<div class="as-item lv3"><b>' + l3 + "</b><span>时间偏好触发</span></div>" +
      "</div>";

    if (!a.length) html += '<div class="empty">本次没有触发自动调整，行程完全按用户原始选择执行。</div>';
    else {
      html += '<div class="audit-list">';
      a.forEach(function (x, i) {
        html += '<div class="audit-item paper-card">' +
          '<div class="ai-head"><span class="ai-no">#' + (i + 1) + '</span><span class="ai-stage">' + U.esc(x.stage) + "</span>" +
          '<span class="lv lv' + x.level + '">' + (x.level === 1 ? "人物约束" : x.level === 2 ? "地点偏好" : "时间偏好") + "</span></div>" +
          '<div class="ai-body">' +
          '<div class="ai-cell"><span class="ai-k">用户原始选择</span><span class="ai-v from">' + U.esc(x.from) + "</span></div>" +
          '<div class="ai-arrow">→</div>' +
          '<div class="ai-cell"><span class="ai-k">系统调整结果</span><span class="ai-v to">' + U.esc(x.to) + "</span></div>" +
          "</div>" +
          '<div class="reason inline-reason"><span class="rtag">原因说明</span>' + U.esc(x.reason) + "</div>" +
          "</div>";
      });
      html += "</div>";
    }
    return html;
  }

  /* ---------------- 弹窗 ---------------- */
  function spotModal(city, name) {
    var list = AS.citySpots(city);
    var sp = null;
    for (var i = 0; i < list.length; i++) if (list[i].name === name) sp = list[i];
    if (!sp) return;
    var art = window.Art.scene(sp.type, window.Art.hash(city + name), {});
    var customs = S.place.night.custom ? '<div class="dl-row"><span>风俗提示</span><b>' + customsText(city, sp) + "</b></div>" : "";
    U.modal(
      '<div class="spot-modal-art">' + art + "</div>" +
      '<div class="spot-modal-body">' +
      '<h4>' + U.esc(sp.name) + "</h4>" +
      '<div class="dl-row"><span>所在城市 / 片区</span><b>' + U.esc(city) + " · " + U.esc(sp.zone) + "</b></div>" +
      '<div class="dl-row"><span>开放时间</span><b>' + U.esc(sp.open) + "</b></div>" +
      '<div class="dl-row"><span>门票价格</span><b>' + (sp.fee ? "¥" + sp.fee + " / 人" : "免费") + "</b></div>" +
      '<div class="dl-row"><span>建议停留</span><b>' + sp.dur + " 分钟</b></div>" +
      '<div class="dl-row"><span>预约渠道</span><b>' + (sp.fee ? "官方公众号 / 小程序实名预约" : "多数免预约，节假日建议提前登记") + "</b></div>" +
      customs +
      '<div class="dl-row"><span>适游提示</span><b>' + (sp.tags.length ? U.esc(sp.tags.join(" / ")) : "常规游览") + "</b></div>" +
      "</div>",
      { title: "景点详情", wide: false }
    );
  }
  function customsText(city, sp) {
    var t = {
      temple: "寺庙着装遮盖肩膝，殿内不拍照、不喧哗，进门不踩门槛。",
      oldtown: "老街居民区请勿大声喧哗，拍摄人物先征得同意。",
      museum: "馆内禁用闪光灯与三脚架，部分展厅禁止饮食。",
      mountain: "山区禁明火，垃圾随身带走，雨雾天勿走野路。",
      lake: "湖边栈道湿滑，禁止翻越护栏。",
      palace: "宫殿区严禁触摸文物，单向参观动线请勿逆行。"
    };
    return t[sp.type] || (city + " 当地风俗请以景区公告为准，遇民俗活动请勿围观拍摄。");
  }

  function budgetEditModal(rowIdx) {
    var m = model();
    var row = m.budget.rows[rowIdx];
    U.modal(
      '<div class="form-row"><label>分项名称</label><input class="input" id="editName" value="' + U.esc(row.name) + '"></div>' +
      '<div class="form-row"><label>团队合计金额（元）</label><input class="input" type="number" id="editTotal" value="' + row.total + '"></div>' +
      '<div class="form-row"><label>调整说明（写入归因台账）</label><textarea class="textarea" id="editReason" rows="2">手动调整：按实际询价修正该项预算。</textarea></div>' +
      '<div class="hint-text">调整后系统会重新计算合计与人均，并新增一条归因记录。</div>',
      { title: "预算调整" }
    );
    var foot = document.createElement("div");
    foot.className = "modal-foot";
    foot.innerHTML = '<button class="btn btn-ghost" data-close>取消</button><button class="btn btn-primary" id="doEdit">确认调整</button>';
    document.querySelector(".modal").appendChild(foot);
    document.getElementById("doEdit").onclick = function () {
      var nm = document.getElementById("editName").value.trim() || row.name;
      var tv = Math.max(0, +document.getElementById("editTotal").value || 0);
      var rs = document.getElementById("editReason").value.trim() || "手动调整预算。";
      var old = row.total;
      row.name = nm;
      row.total = tv;
      m.budget.total = m.budget.rows.reduce(function (a, b) { return a + b.total; }, 0);
      m.budget.perCap = Math.round(m.budget.total / m.ctx.count);
      m.audit.push({
        stage: "事件模块 · 预算调整", from: "原「" + nm + "」预算 ¥" + U.money(old),
        to: "调整为 ¥" + U.money(tv), reason: rs, level: 2
      });
      AS.save(); U.closeModal(); render(false); U.toast("预算已更新，并新增 1 条归因记录");
    };
  }

  function tweakModal() {
    var m = model();
    var opts = [];
    S.cities.forEach(function (c) {
      AS.citySpots(c.n).forEach(function (sp) {
        var id = c.n + "::" + sp.name;
        if (S.place.exclude.indexOf(id) >= 0) return;
        var inPlan = false;
        m.days.forEach(function (d) {
          d.entries.forEach(function (e) { if (e.spot && e.spot.city === c.n && e.spot.name === sp.name) inPlan = true; });
        });
        if (!inPlan) opts.push({ city: c.n, sp: sp });
      });
    });
    var html = '<div class="hint-text" style="margin-bottom:10px">可在当前方案中增删点位，改动后自动写入时间轴并记录归因。</div>';
    html += '<div class="tweak-list">';
    if (!opts.length) html += '<div class="empty">所选城市点位已全部在方案中。</div>';
    opts.slice(0, 24).forEach(function (o) {
      html += '<label class="tweak-item"><input type="checkbox" data-tweak="' + U.esc(o.city + "::" + o.sp.name) + '">' +
        "<span>" + U.esc(o.city) + " · " + U.esc(o.sp.name) + "</span><em>" + U.esc(o.sp.zone) + "</em></label>";
    });
    html += "</div>";
    U.modal(html, { title: "方案微调 · 增删点位", wide: true });
    var foot = document.createElement("div");
    foot.className = "modal-foot";
    foot.innerHTML = '<button class="btn btn-ghost" data-close>取消</button><button class="btn btn-primary" id="doTweak">加入选中点位</button>';
    document.querySelector(".modal").appendChild(foot);
    document.getElementById("doTweak").onclick = function () {
      var picked = Array.prototype.slice.call(document.querySelectorAll("[data-tweak]:checked")).map(function (x) { return x.dataset.tweak; });
      if (!picked.length) { U.toast("未选择点位"); return; }
      picked.forEach(function (id) {
        var p = id.split("::");
        var last = m.days[m.days.length - 1];
        var sp = null;
        AS.citySpots(p[0]).forEach(function (s) { if (s.name === p[1]) sp = s; });
        if (!sp) return;
        last.entries.push({
          t: "18:30", title: "增补游览" + sp.name, place: sp.zone, detail: "手动微调新增点位",
          reason: "用户手动增补点位，系统按当日收工时间与动线就近插入。", spot: { city: p[0], name: sp.name }
        });
        m.audit.push({
          stage: "事件模块 · 方案微调", from: "原方案未含 " + sp.name,
          to: "增补 " + p[0] + " · " + sp.name, reason: "用户手动调整，系统按就近原则插入当日最后一站，并提示收工时间。", level: 2
        });
      });
      lastEntrySort(m.days);
      AS.save(); U.closeModal(); render(false); U.toast("已加入方案并记录归因");
    };
  }
  function lastEntrySort(days) {
    days.forEach(function (d) {
      d.entries.sort(function (a, b) {
        function t(s) { var p = String(s).split(":"); return (+p[0]) * 60 + (+p[1] || 0); }
        return t(a.t) - t(b.t);
      });
    });
  }

  function constraintsModal() {
    var m = model(), p = m.params;
    function row(k, v) { return '<div class="sum-row"><span class="k">' + k + '</span><span class="v">' + (v || "<em>未填写</em>") + "</span></div>"; }
    var html = '<div class="sum-grid" style="grid-template-columns:1fr 1fr">' +
      '<div class="sum-card"><h4>地点模块</h4><div class="sum-list">' +
      row("目的地", U.esc(p.cities.join("、"))) +
      row("想去景点", U.esc(p.want.map(function (x) { return x.split("::")[1]; }).join("、")) || "—") +
      row("排除景点", U.esc(p.exclude.map(function (x) { return x.split("::")[1]; }).join("、")) || "无") +
      row("住宿类型", U.esc(p.hotel.type)) +
      row("位置偏好", U.esc(p.hotel.locs.join("、"))) +
      row("住宿预算", p.hotel.budget.any ? "不限" : p.hotel.budget.min + "–" + p.hotel.budget.max + " 元/晚/间") +
      row("夜游", U.esc(p.night.plan)) +
      row("餐饮倾向", U.esc(p.food.style)) +
      row("忌口", U.esc(p.food.diet.join("、"))) +
      "</div></div>" +
      '<div class="sum-card"><h4>时间模块</h4><div class="sum-list">' +
      row("起止", p.time.start + " — " + p.time.end) +
      row("首日抵达", U.esc(p.time.arrive)) +
      row("返程离开", U.esc(p.time.leave)) +
      row("作息", U.esc(p.time.pace.wake)) +
      row("强度", U.esc(p.time.pace.intensity)) +
      row("午休", U.esc(p.time.pace.rest)) +
      row("最晚收工", U.esc(p.time.pace.latest)) +
      row("天气预案", U.esc(p.time.weather.mode)) +
      row("缓冲", U.esc(p.time.weather.buffer)) +
      "</div></div>" +
      '<div class="sum-card"><h4>人物模块</h4><div class="sum-list">' +
      row("人数", U.esc(p.people.count)) +
      row("人群", U.esc(p.people.tags.join("、"))) +
      row("体力", U.esc(p.people.fitness)) +
      row("障碍", U.esc(p.people.barriers.join("、"))) +
      row("过敏", U.esc(p.people.health.allergies.join("、"))) +
      row("疾病", U.esc(p.people.health.conditions.join("、"))) +
      row("风格", U.esc(p.people.social.style)) +
      row("分工", U.esc(p.people.social.roles.join("、"))) +
      row("预算模式", U.esc(p.people.budget.mode)) +
      "</div></div>" +
      '<div class="sum-card"><h4>约束优先级</h4><div class="sum-list">' +
      row("最高", "人物约束：过敏、行动障碍、年龄结构不可突破") +
      row("其次", "地点偏好：景点想去 / 排除、住宿、夜游、餐饮") +
      row("再次", "时间偏好：节奏、午休、天气预案、缓冲") +
      row("执行", "冲突时高层级覆盖低层级，并在归因台账留痕") +
      "</div></div>" +
      "</div>";
    U.modal(html, { title: "全部约束参数汇总", wide: true });
  }

  /* ---------------- 复制文本 ---------------- */
  function plainText(m) {
    var L = [];
    var p = m.params;
    L.push("团队行程规划台账");
    L.push("目的地：" + p.cities.join("、"));
    L.push("出行周期：" + p.time.start + " — " + p.time.end + "（" + m.days.length + " 天）");
    L.push("团队人数：" + p.people.count + " 人");
    L.push("");
    m.days.forEach(function (d) {
      L.push("【DAY " + d.i + "】" + d.date + " " + d.week + "｜" + d.weather.tag + "｜" + d.theme);
      d.entries.forEach(function (e) {
        L.push("  " + e.t + " " + e.title + "｜" + e.place + (e.detail ? "｜" + e.detail : ""));
        if (e.reason) L.push("      【原因说明】" + e.reason);
      });
      L.push("");
    });
    L.push("【交通】");
    m.transport.long.forEach(function (x) { L.push("  " + x.seg + "：" + x.way + "，" + x.time + "，约 ¥" + x.cost + "/人"); });
    L.push("");
    L.push("【餐饮】");
    m.food.meals.forEach(function (x) { L.push("  " + x.city + " " + x.name + "（¥" + x.price + "/人）：" + x.dishes.join("、")); });
    L.push("");
    L.push("【住宿】");
    m.hotels.forEach(function (h) { L.push("  " + h.name + "｜" + h.rooms + "｜¥" + h.price + "/间/晚"); });
    L.push("");
    L.push("【预算】合计 ¥" + U.money(m.budget.total) + "，人均 ¥" + U.money(m.budget.perCap));
    m.budget.rows.forEach(function (r) { L.push("  " + r.name + "：¥" + U.money(r.total)); });
    L.push("");
    L.push("【归因记录】共 " + m.audit.length + " 条");
    m.audit.forEach(function (a, i) {
      L.push("  #" + (i + 1) + " " + a.stage + "：" + a.from + " → " + a.to);
      L.push("      【原因说明】" + a.reason);
    });
    return L.join("\n");
  }

  /* ---------------- 打印文档 ---------------- */
  function buildPrintDoc(m) {
    var p = m.params;
    var h = '<section class="pdf-cover">' +
      '<div class="pdf-seal">山河卷</div>' +
      '<h1>团队行程规划台账</h1>' +
      '<p class="pdf-sub">' + U.esc(p.cities.join("、")) + "</p>" +
      '<p class="pdf-meta">出行周期：' + U.esc(p.time.start) + " — " + U.esc(p.time.end) + "（" + m.days.length + " 天）｜团队人数：" + U.esc(p.people.count) + " 人</p>" +
      '<p class="pdf-meta">生成时间：' + new Date().toLocaleString("zh-CN") + "</p>" +
      '<div class="pdf-art">' + window.Art.landscape(20240601, { pal: "dawn" }) + "</div>" +
      "</section>";

    h += '<section class="pdf-page"><h2>目录</h2><ol class="pdf-toc">' + TABS.map(function (t) {
      return "<li>" + U.esc(t.name) + "</li>";
    }).join("") + "<li>附录：全部约束参数快照</li></ol></section>";

    h += '<section class="pdf-page"><h2>一、按天行程总表</h2>';
    m.days.forEach(function (d) {
      h += '<div class="pdf-day"><h3>DAY ' + d.i + " · " + U.esc(d.date) + " " + U.esc(d.week) + " · " + U.esc(d.weather.tag) + "</h3>" +
        '<p class="pdf-theme">' + U.esc(d.theme) + "</p>" +
        '<table class="pdf-table"><thead><tr><th>时间</th><th>事项</th><th>地点</th><th>说明</th></tr></thead><tbody>';
      d.entries.forEach(function (e) {
        h += "<tr><td>" + U.esc(e.t) + "</td><td>" + U.esc(e.title) + "</td><td>" + U.esc(e.place) + "</td><td>" + U.esc(e.detail || "") + "</td></tr>";
        if (e.reason) h += '<tr><td></td><td colspan="3" class="pdf-reason">【原因说明】' + U.esc(e.reason) + "</td></tr>";
      });
      h += "</tbody></table></div>";
    });
    h += "</section>";

    h += '<section class="pdf-page"><h2>二、交通方案台账</h2><table class="pdf-table"><thead><tr><th>路段</th><th>方式</th><th>耗时</th><th>费用</th><th>原因说明</th></tr></thead><tbody>';
    m.transport.long.concat(m.transport.local).forEach(function (x) {
      h += "<tr><td>" + U.esc(x.seg) + "</td><td>" + U.esc(x.way) + "</td><td>" + U.esc(x.time) + "</td><td>¥" + U.money(x.cost) + "</td><td>" + U.esc(x.reason || "") + "</td></tr>";
    });
    h += "</tbody></table></section>";

    h += '<section class="pdf-page"><h2>三、美食与用餐清单</h2><table class="pdf-table"><thead><tr><th>城市</th><th>店名</th><th>菜品</th><th>人均</th><th>原因说明</th></tr></thead><tbody>';
    m.food.meals.forEach(function (x) {
      h += "<tr><td>" + U.esc(x.city) + "</td><td>" + U.esc(x.name) + "</td><td>" + U.esc(x.dishes.join("、")) + "</td><td>¥" + x.price + "</td><td>" + U.esc(x.reason) + "</td></tr>";
    });
    h += "</tbody></table></section>";

    h += '<section class="pdf-page"><h2>四、住宿安排详情</h2>';
    m.hotels.forEach(function (x) {
      h += '<div class="pdf-block"><h3>' + U.esc(x.name) + "</h3><p>" + U.esc(x.area) + "｜" + U.esc(x.rooms) + "｜¥" + x.price + "/间/晚</p><p>" + U.esc(x.fac.join(" · ")) + "</p><p class=\"pdf-reason\">【原因说明】" + U.esc(x.reason) + "</p></div>";
    });
    h += "</section>";

    h += '<section class="pdf-page"><h2>五、物资、药品与行前待办</h2><div class="pdf-cols"><ul>' +
      m.supplies.items.map(function (x) { return "<li>" + U.esc(x) + "</li>"; }).join("") + "</ul><ul>" +
      m.supplies.meds.map(function (x) { return "<li>" + U.esc(x) + "</li>"; }).join("") + "</ul></div><ul>" +
      m.supplies.todos.map(function (x) { return "<li><b>" + U.esc(x.role) + "</b>：" + U.esc(x.text) + "</li>"; }).join("") + "</ul></section>";

    h += '<section class="pdf-page"><h2>六、预算明细台账</h2><table class="pdf-table"><thead><tr><th>分项</th><th>合计</th><th>人均</th><th>原因说明</th></tr></thead><tbody>';
    m.budget.rows.forEach(function (r) {
      h += "<tr><td>" + U.esc(r.name) + "</td><td>¥" + U.money(r.total) + "</td><td>¥" + U.money(r.total / m.ctx.count) + "</td><td>" + U.esc(r.reason) + "</td></tr>";
    });
    h += '<tr><td><b>合计</b></td><td><b>¥' + U.money(m.budget.total) + "</b></td><td><b>¥" + U.money(m.budget.perCap) + "</b></td><td></td></tr></tbody></table></section>";

    h += '<section class="pdf-page"><h2>七、突发应急预案</h2>';
    m.emergency.forEach(function (e) {
      h += '<div class="pdf-block"><h3>' + U.esc(e.title) + "</h3><p>" + U.esc(e.plan) + '</p><p class="pdf-reason">【原因说明】' + U.esc(e.reason) + "</p></div>";
    });
    h += "</section>";

    h += '<section class="pdf-page"><h2>八、全部修改归因记录</h2><table class="pdf-table"><thead><tr><th>阶段</th><th>原始选择</th><th>调整结果</th><th>原因说明</th></tr></thead><tbody>';
    m.audit.forEach(function (a) {
      h += "<tr><td>" + U.esc(a.stage) + "</td><td>" + U.esc(a.from) + "</td><td>" + U.esc(a.to) + '</td><td class="pdf-reason">【原因说明】' + U.esc(a.reason) + "</td></tr>";
    });
    h += "</tbody></table></section>";

    h += '<section class="pdf-page"><h2>附录：全部约束参数快照</h2><pre class="pdf-pre">' +
      U.esc(JSON.stringify({
        cities: p.cities, want: p.want, exclude: p.exclude,
        hotel: p.hotel, night: p.night, food: p.food, time: p.time, people: p.people
      }, null, 2)) + "</pre></section>";

    return h;
  }

  /* ---------------- 渲染 ---------------- */
  function render(tabOnly) {
    var m = model();
    if (!m || !m.days || !m.audit || !m.budget) { location.hash = "#/home"; return; }
    var view = document.getElementById("view");
    if (tabOnly) {
      var panel = document.getElementById("tabPanel");
      panel.innerHTML = panelFor(S.ui.tab || 0, m);
      bindPanel();
      return;
    }
    view.innerHTML = '<div class="result-page">' +
      '<div class="wrap">' + headHTML(m) + tabsHTML() +
      '<div id="tabPanel" class="tab-panel">' + panelFor(S.ui.tab || 0, m) + "</div>" +
      '<footer class="result-foot">所有自动调整均可在「全部修改归因记录」中溯源 ｜ 约束优先级：人物 ＞ 地点 ＞ 时间</footer>' +
      "</div></div>";
    U.crumbs("result");
    U.showTopbar(true);
    U.scrollTop();
    bind();
    bindPanel();
  }

  function panelFor(i, m) {
    var t = TABS[i] || TABS[0];
    switch (t.id) {
      case "days": return tabDays(m);
      case "transport": return tabTransport(m);
      case "food": return tabFood(m);
      case "hotel": return tabHotel(m);
      case "supplies": return tabSupplies(m);
      case "budget": return tabBudget(m);
      case "emergency": return tabEmergency(m);
      case "audit": return tabAudit(m);
    }
    return "";
  }

  function bind() {
    var view = document.getElementById("view");
    if (view.dataset.bound) return;
    view.dataset.bound = "1";
    view.addEventListener("click", function (e) {
      var tabBtn = e.target.closest("[data-tab]");
      if (tabBtn) {
        S.ui.tab = +tabBtn.dataset.tab;
        AS.save();
        document.querySelectorAll(".ltab").forEach(function (b) { b.classList.toggle("on", b === tabBtn); });
        render(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      var act = e.target.closest("[data-act]");
      if (act) {
        var a = act.dataset.act;
        if (a === "restart") {
          if (confirm("重新规划将清空当前全部输入与已生成台账，确定继续？")) {
            AS.reset();
            location.hash = "#/home";
          }
        } else if (a === "pdf") {
          doPrint();
        } else if (a === "copy") {
          var m = model();
          U.copyText(plainText(m)).then(function (ok) {
            U.toast(ok ? "纯文本行程已复制到剪贴板" : "复制失败，请手动选择文本");
          });
        } else if (a === "constraints") {
          constraintsModal();
        }
        return;
      }
      var bk = e.target.closest("[data-backup]");
      if (bk) {
        var di = +bk.dataset.backup;
        var d = model().days[di];
        U.modal('<div class="backup-body"><h4>' + U.esc(d.backup.title) + "</h4>" +
          d.backup.items.map(function (x) {
            return '<div class="backup-item"><b>' + U.esc(x.t) + "</b><span>" + U.esc(x.name) + "</span><em>" + U.esc(x.note) + "</em></div>";
          }).join("") +
          '<div class="reason" style="margin-top:14px"><span class="rtag">原因说明</span>备用方案仅在该日触发降雨 / 高温时启用，原户外点位顺延或替换，不改变住宿与用餐安排。</div></div>',
          { title: "当日备用方案（雨天 / 高温）" });
        return;
      }
    });
  }

  function bindPanel() {
    var panel = document.getElementById("tabPanel");
    if (!panel || panel.dataset.bound) return;
    panel.dataset.bound = "1";
    panel.addEventListener("click", function (e) {
      var sp = e.target.closest("tr[data-spot-name]");
      if (sp) { spotModal(sp.dataset.spotCity, sp.dataset.spotName); return; }
      var bv = e.target.closest("[data-bview]");
      if (bv) { S.ui.budgetPer = bv.dataset.bview === "per"; render(true); return; }
      var er = e.target.closest("[data-editrow]");
      if (er) { budgetEditModal(+er.dataset.editrow); return; }
    });
    panel.addEventListener("change", function (e) {
      var c = e.target.closest("[data-check]");
      if (c) {
        S.checked[c.dataset.check] = c.checked;
        var lab = c.closest(".check-item,.todo-item");
        if (lab) lab.classList.toggle("done", c.checked);
        AS.save();
      }
    });
  }

  /* ---------------- 打印 ---------------- */
  function preparePrint() {
    var m = model();
    var root = document.getElementById("printRoot");
    root.innerHTML = buildPrintDoc(m);
    return root;
  }
  function cleanupPrint() {
    var root = document.getElementById("printRoot");
    if (root) root.innerHTML = "";
  }
  function doPrint() {
    preparePrint();
    if (window.Bgm) window.Bgm.fadeOutForPrint();
    window.addEventListener("afterprint", function once() {
      window.removeEventListener("afterprint", once);
      cleanupPrint();
      if (window.Bgm) window.Bgm.resumeAfterPrint();
    });
    setTimeout(function () { window.print(); }, 220);
  }

  window.Result = {
    render: render, TABS: TABS, plainText: plainText, model: model,
    tweak: tweakModal, constraints: constraintsModal, preparePrint: preparePrint
  };
})();
