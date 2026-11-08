/* ===========================================================
   flow.js —— 地点模块 5 步 / 时间模块 4 步 / 人物模块 5 步
   =========================================================== */
(function () {
  "use strict";

  var S = window.STATE, M = window.META, U = window.UI;
  var AS = window.AppState;

  /* ---------------- 状态读写 ---------------- */
  function getPath(p) {
    var parts = p.split("."), o = S;
    for (var i = 0; i < parts.length; i++) { if (o == null) return undefined; o = o[parts[i]]; }
    return o;
  }
  function setPath(p, v) {
    var parts = p.split("."), o = S;
    for (var i = 0; i < parts.length - 1; i++) o = o[parts[i]];
    o[parts[parts.length - 1]] = v;
  }

  /* ---------------- 组件 ---------------- */
  function optGrid(path, list, size) {
    var val = getPath(path);
    var multi = /(^|\.)(locs|diet|scenes|prio|reqs|flags|tags|barriers|allergies|conditions|roles|limits|tilts)$/.test(path);
    var cls = "opt-grid" + (size === "wide" ? " wide" : "");
    var html = '<div class="' + cls + '" data-group="' + path + '" data-multi="' + (multi ? 1 : 0) + '">';
    list.forEach(function (item) {
      var v = typeof item === "string" ? item : item.v;
      var sub = typeof item === "string" ? "" : item.s;
      var on = multi ? (Array.isArray(val) && val.indexOf(v) >= 0) : val === v;
      html += '<button class="opt-card' + (on ? " on" : "") + (sub ? " two-line" : "") + '" type="button" data-val="' + U.esc(v) + '">' +
        "<b>" + U.esc(v) + "</b>" + (sub ? "<i>" + U.esc(sub) + "</i>" : "") +
        '<span class="tick"></span></button>';
    });
    return html + "</div>";
  }

  function chipList(path, list) {
    var val = getPath(path) || [];
    var html = '<div class="chips" data-group="' + path + '" data-multi="1">';
    list.forEach(function (v) {
      var on = Array.isArray(val) && val.indexOf(v) >= 0;
      html += '<button class="chip' + (on ? " on" : "") + '" type="button" data-val="' + U.esc(v) + '">' + U.esc(v) + "</button>";
    });
    return html + "</div>";
  }

  function fieldHead(idx, label, need, opt, tip) {
    return '<div class="field-head"><span class="field-idx">' + idx + "</span>" +
      '<span class="field-label">' + U.esc(label) + "</span>" +
      (need ? '<span class="req">必选</span>' : "") +
      (opt ? '<span class="opt">非必选</span>' : "") + "</div>" +
      (tip ? '<div class="field-tip">' + tip + "</div>" : "");
  }

  function textarea(path, ph, rows) {
    var v = getPath(path) || "";
    return '<textarea class="textarea" rows="' + (rows || 3) + '" data-field="' + path + '" placeholder="' + U.esc(ph || "") + '">' + U.esc(v) + "</textarea>";
  }
  function inputText(path, ph, cls) {
    var v = getPath(path) || "";
    return '<input class="input ' + (cls || "") + '" type="text" data-field="' + path + '" value="' + U.esc(v) + '" placeholder="' + U.esc(ph || "") + '">';
  }

  function rangeBox(path, min, max, step, unit, anyLabel) {
    var b = getPath(path) || { min: min, max: max, any: false };
    var left = ((b.min - min) / (max - min)) * 100;
    var right = ((b.max - min) / (max - min)) * 100;
    return '<div class="range-box" data-range="' + path + '" data-min="' + min + '" data-max="' + max + '" data-step="' + step + '">' +
      '<div class="range-head">' +
      '<div class="range-vals">' +
      '<input type="number" data-rmin value="' + b.min + '" min="' + min + '" max="' + max + '" step="' + step + '">' +
      '<span class="dash">—</span>' +
      '<input type="number" data-rmax value="' + b.max + '" min="' + min + '" max="' + max + '" step="' + step + '">' +
      '<span class="unit">' + unit + "</span></div>" +
      '<label class="switch"><input type="checkbox" data-rany' + (b.any ? " checked" : "") + '><span class="sw"></span>' + (anyLabel || "不限") + "</label>" +
      "</div>" +
      '<div class="range-slider">' +
      '<div class="track"></div><div class="fill" style="left:' + left + "%;width:" + Math.max(0, right - left) + '%"></div>' +
      '<input type="range" class="rmin" min="' + min + '" max="' + max + '" step="' + step + '" value="' + b.min + '">' +
      '<input type="range" class="rmax" min="' + min + '" max="' + max + '" step="' + step + '" value="' + b.max + '">' +
      "</div></div>";
  }

  function reasonBox(id, html, quiet) {
    return '<div class="reason' + (quiet ? " quiet" : "") + '" id="' + id + '">' + html + "</div>";
  }
  function R(text) { return '<span class="rtag">原因说明</span>' + text; }

  /* ---------------- 归因文案 ---------------- */
  function reasonsFor(stepId) {
    var out = [];
    if (stepId === "hotel") {
      var h = S.place.hotel;
      if (h.type) out.push("住宿类型锁定为<b>「" + U.esc(h.type) + "」</b>，系统只在该档位内匹配房源" + (h.type === "无所谓，听推荐" ? "，由人数、动线与预算共同决定档位" : "") + "。");
      if (h.locs.length) out.push("位置偏好「" + U.esc(h.locs.join("、")) + "」用于计算房源到核心景点的通勤半径，优先落在 3 公里内的住宿点。");
      if (!h.budget.any) out.push("预算 " + h.budget.min + "–" + h.budget.max + " 元 / 晚 / 间 作为价格硬约束，超出区间的高价房型直接剔除。");
      else out.push("已开启不限预算，价格不再作为筛选条件，改为按位置与设施评分排序。");
      if (h.reqs.length) out.push("硬性要求「" + U.esc(h.reqs.join("、")) + "」逐条校验房源设施，任一不满足即不入选。");
      if (S.people.tags.indexOf("60 岁以上老人") >= 0 || S.people.barriers.length) out.push("人物模块存在老人或用行动障碍成员，房源额外校验电梯与无障碍通道。");
    }
    if (stepId === "night") {
      var n = S.place.night;
      if (n.plan === "允许安排夜游") out.push("每日可安排 1 处夜间活动，收工时间仍以时间模块的上限为准。");
      if (n.plan === "不安排夜游") out.push("日落前结束全部户外行程，晚间仅保留回住宿地休整与用餐。");
      if (n.plan === "仅偶尔夜游") out.push("按每 2–3 晚 1 次的频率安排夜游，避免连续夜间活动透支体力。");
      if (n.custom) out.push("行程单将随景点条目附带当地风俗、礼仪与禁忌提示。");
      if (S.people.tags.indexOf("婴幼儿（3 岁以下）") >= 0) out.push("团队含婴幼儿，夜游频次自动压减至 0–1 次。");
    }
    if (stepId === "dining") {
      var f = S.place.food;
      if (f.style) out.push("美食倾向为<b>「" + U.esc(f.style) + "」</b>，正餐与小吃按此比例配比。");
      if (f.spicy) out.push("辣度「" + U.esc(f.spicy) + "」会过滤菜单中超出承受度的菜品。");
      if (!f.budget.any) out.push("人均 " + f.budget.min + "–" + f.budget.max + " 元 / 餐 作为餐标约束，超价餐厅降级为小吃或替换。");
      if (f.diet.length && f.diet.indexOf("无特殊忌口") < 0) out.push("忌口「" + U.esc(f.diet.join("、")) + "」为强约束，菜单筛选时逐项剔除相关食材。");
      if (S.people.health.allergies.length) out.push("人物模块的过敏信息优先级更高：即便此处未勾选，含过敏源的菜品同样被剔除。");
    }
    if (stepId === "date") {
      var t = S.time;
      if (t.start && t.end) out.push("行程共 <b>" + AS.dayDiff(t.start, t.end) + " 天</b>（含往返），按每日一个主行程单元排布。");
      if (t.arrive === "首日上午抵达") out.push("首日上午不排景点，下午起开始游览，预留落地、取行李与入住时间。");
      if (t.arrive === "首日中午抵达") out.push("首日下午仅安排 1 处轻松点位，避免团队刚落地即高强度移动。");
      if (t.arrive === "首日下午 / 傍晚抵达") out.push("首日不安排景点游览，仅保留入住流程；若地点模块允许夜游，可酌情安排夜市。");
      if (t.leave === "返程日上午就要离开") out.push("返程当天不安排游玩，仅保留早餐与退房，行程在前一晚收束。");
      if (t.leave === "返程日下午离开") out.push("返程上午安排 1 处短时点位，中午收束返回交通枢纽。");
      if (t.leave === "返程日晚间离开") out.push("返程当天可正常游览，傍晚前结束并留出赶车时间。");
    }
    if (stepId === "pace") {
      var p = S.time.pace;
      if (p.intensity === "紧凑打卡") out.push("选择紧凑打卡，系统会压缩景点之间休息时长，优先串联顺路点位；若人物模块录入老人、低龄儿童，系统会自动降级调整松紧并在台账标注变更原因。");
      if (p.intensity === "均衡适中") out.push("每日 2–3 个核心景点，午后保留缓冲，换乘衔接留出余量。");
      if (p.intensity === "宽松慢游") out.push("单日景点不超过 2 处，午休与自由活动写进时间轴，不安排跨区折返。");
      if (p.wake) out.push("起床时间按「" + U.esc(p.wake) + "」推算，第一处景点不早于起床后 2 小时。");
      if (p.rest === "固定午休") out.push("12:00–14:00 不排景点，午餐后回住宿地或就近茶室休息。");
      if (p.latest) out.push("每日 " + U.esc(p.latest) + " 后不再安排新景点，已开始的夜游条目按此上限截断。");
    }
    if (stepId === "weather") {
      var w = S.time.weather;
      if (w.mode === "开启自动替换") out.push("已开启雨天自动替换预案，系统会在生成行程时，为您选中的每一个户外景点预存同城市室内备选点位，在天气预报判定雨天时替换，并在最终台账标注替换理由。");
      if (w.mode === "仅给出提醒") out.push("保留原户外行程，只在台账标注天气风险，不自动更换景点。");
      if (w.mode === "不做预案提醒") out.push("严格按原定景点执行，不主动调整，风险由出行方自行判断。");
      if (w.buffer) out.push("缓冲规则「" + U.esc(w.buffer) + "」会写入每两个点位之间的通勤余量。");
      if (w.prio.length) out.push("天气优先级「" + U.esc(w.prio.join("、")) + "」用于判断替换的触发条件。");
    }
    if (stepId === "team") {
      var tags = S.people.tags;
      if (tags.indexOf("60 岁以上老人") >= 0) out.push(M.reason.elderly);
      if (tags.indexOf("3–12 岁儿童") >= 0) out.push(M.reason.child);
      if (tags.indexOf("婴幼儿（3 岁以下）") >= 0) out.push(M.reason.baby);
      if (tags.indexOf("行动不便人士") >= 0 || S.people.barriers.length) out.push(M.reason.disabled);
      if (S.people.count) out.push("按 " + S.people.count + " 人核算包车座位、餐桌、门票团购与房间数量。");
    }
    if (stepId === "health") {
      var al = S.people.health.allergies.filter(function (a) { return a !== "其他过敏（自定义填写）"; });
      if (al.length) out.push("存在<b>" + U.esc(al.join("、")) + "</b>成员，所有推荐餐厅、小吃、宴席方案将剔除相关菜品，菜单筛选时优先过滤相关食材。");
      if (S.people.health.conditions.length && S.people.health.conditions.indexOf("无基础疾病") < 0) out.push("基础健康情况「" + U.esc(S.people.health.conditions.join("、")) + "」会影响步行强度与就近医疗点提示。");
      if (!al.length && !S.people.health.conditions.length) out.push("未登记过敏与基础疾病，餐饮与强度按常规处理；如后续补充，系统将重新校验全部餐饮与点位。");
    }
    if (stepId === "roles") {
      if (S.people.social.limits.indexOf("有人不会骑自行车") >= 0) out.push(M.reason.noBike);
      if (S.people.barriers.indexOf("不能长时间坐车晕车") >= 0 || S.people.social.limits.indexOf("有人不会骑自行车") >= 0) out.push(M.reason.carSick);
      if (S.people.social.style) out.push("出行风格「" + U.esc(S.people.social.style) + "」决定景点配比与讲解时长。");
      if (S.people.social.roles.length && S.people.social.roles.indexOf("无固定分工") < 0) out.push("分工栏「" + U.esc(S.people.social.roles.join("、")) + "」会生成对应的行前待办。");
    }
    if (stepId === "budget") {
      var b = S.people.budget;
      if (b.tilts.indexOf("优先吃特色美食") >= 0) out.push(M.reason.budgetFood);
      if (b.tilts.indexOf("优先住好一点") >= 0) out.push(M.reason.budgetHotel);
      if (b.mode === "统一人均预算" && b.perCap) out.push("人均总预算 " + b.perCap + " 元由系统按交通 / 住宿 / 餐饮 / 门票自动拆分，超支项会被降级替换。");
      if (b.mode === "优先性价比") out.push("全面优先平价方案：住宿降档、免费景点优先、餐饮压缩非必要消费。");
    }
    return out;
  }

  function renderReasons(stepId) {
    var el = document.getElementById("reasonBox");
    if (!el) return;
    var list = reasonsFor(stepId);
    if (!list.length) { el.hidden = true; return; }
    el.hidden = false;
    el.innerHTML = R(list.map(function (t) { return "<div>" + t + "</div>"; }).join(""));
  }

  /* ---------------- 页面骨架 ---------------- */
  function railHTML(stepId) {
    var idx = AS.stepIndex(stepId);
    var html = '<div class="step-rail">';
    M.modules.forEach(function (mod, mi) {
      if (mi) html += '<span class="rail-sep"></span>';
      html += '<span class="rail-mod">' + mod.name + "</span>";
      mod.ids.forEach(function (id) {
        var st = AS.STEPS[AS.stepIndex(id)];
        var cls = "rail-node" + (id === stepId ? " now" : "") + (AS.stepIndex(id) < idx ? " done" : "");
        html += '<span class="' + cls + '" title="' + (AS.stepIndex(id) + 1) + ". " + U.esc(st.title) + '"><span class="n">' + (AS.stepIndex(id) + 1) + "</span></span>";
      });
    });
    var cur = AS.STEPS[idx];
    html += '<span class="rail-current">' + cur.mod + " · 第" + cur.no + "步 · " + U.esc(cur.title) + "</span>";
    return html + "</div>";
  }

  function pageHead(step, title, sub) {
    return '<div class="flow-head">' +
      '<div class="flow-mod">' + step.mod + " · 第" + step.no + "步</div>" +
      '<h1 class="page-title">' + U.esc(title || step.title) + "</h1>" +
      (sub ? '<p class="page-sub">' + sub + "</p>" : "") +
      "</div>" + railHTML(step.id);
  }

  function foot(step, nextLabel, nextRoute, opts) {
    opts = opts || {};
    var v = AS.canNext(step.id);
    return '<footer class="flow-foot"><div class="wrap inner">' +
      '<div class="foot-hint' + (v.ok ? "" : " err") + '" id="footHint">' +
      (v.ok ? (opts.hint || "所有已填内容会自动保存，返回上一步不会清空") : v.msg) + "</div>" +
      '<div class="foot-actions">' +
      (opts.backRoute === null ? "" : '<button class="btn btn-ghost" type="button" data-go="' + (opts.backRoute || "") + '">' + U.ic("i-back") + (opts.backLabel || "上一步") + "</button>") +
      '<button class="btn btn-primary btn-next" type="button" data-go="' + nextRoute + '" id="nextBtn"' + (v.ok ? "" : " disabled") + ">" +
      (nextLabel || "下一步") + U.ic("i-next", "arrow") + "</button>" +
      "</div></div></footer>";
  }

  function refreshFoot(stepId) {
    var v = AS.canNext(stepId);
    var btn = document.getElementById("nextBtn");
    var hint = document.getElementById("footHint");
    if (btn) btn.disabled = !v.ok;
    if (hint) {
      hint.classList.toggle("err", !v.ok);
      if (!v.ok) hint.textContent = v.msg;
      else if (hint.dataset.defaultText) hint.textContent = hint.dataset.defaultText;
    }
  }

  /* ---------------- 景点卡片 ---------------- */
  function spotCard(item, mode) {
    var sp = item.spot;
    var inWant = S.place.want.indexOf(item.id) >= 0;
    var inEx = S.place.exclude.indexOf(item.id) >= 0;
    var on = mode === "want" ? inWant : inEx;
    var cls = "spot-card" + (mode === "want" ? (on ? " on" : "") : (on ? " excluded" : ""));
    var seed = window.Art.hash(item.id);
    var art = window.Art.scene(sp.type, seed, {});
    var fee = sp.fee ? "¥" + sp.fee : "免费";
    var tags = sp.tags || [];
    var badge = sp.indoor ? "室内" : "户外";
    return '<article class="' + cls + '" data-id="' + U.esc(item.id) + '" data-mode="' + mode + '" tabindex="0">' +
      '<div class="pic">' + art +
      '<span class="noise"></span>' +
      '<span class="tick"></span><span class="corner"></span>' +
      '<span class="exlabel">排除</span>' +
      '<span class="badge">' + badge + " · " + fee + "</span>" +
      "</div>" +
      '<div class="meta"><div class="nm">' + U.esc(sp.name) + "</div>" +
      '<div class="sub"><span class="z">' + U.esc(sp.zone) + "</span><span>" + U.esc(sp.dur) + " 分钟</span>" +
      (tags.length ? "<span>" + U.esc(tags.slice(0, 2).join(" / ")) + "</span>" : "") +
      "</div></div></article>";
  }

  function spotGroups(mode) {
    var html = "";
    S.cities.forEach(function (c) {
      var list = AS.citySpots(c.n);
      var curated = !!(window.SPOT_BANK && window.SPOT_BANK[c.n]);
      html += '<section class="city-group"><h5>' + U.esc(c.n) + '<span class="n">' + list.length + " 处点位</span><span class=\"ln\"></span>" +
        (curated ? "" : '<span class="hint-text">通用样本点位</span>') + "</h5>";
      html += '<div class="spot-grid">';
      list.forEach(function (sp) {
        html += spotCard({ id: c.n + "::" + sp.name, city: c.n, spot: sp }, mode);
      });
      html += "</div></section>";
    });
    return html;
  }

  /* ---------------- 各步骤 ---------------- */
  function stepSpots(step) {
    var cities = S.cities.map(function (c) { return c.n; }).join("、");
    return pageHead(step, "想去景点", "请先选择你想去的景点，再选择不想去的景点，支持多选") +
      '<div class="paper-card fret" style="padding:18px 22px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap">' +
      '<div><div class="hint-text">已选定目的地</div><div style="font-family:var(--font-serif);font-size:20px;letter-spacing:.08em;color:var(--stone-2)">' + U.esc(cities) + "</div></div>" +
      '<div class="count-bar" style="margin:0"><span>已选择 <b id="cntWant">' + S.place.want.length + "</b> 个想去景点</span></div>" +
      "</div></div>" +
      '<div style="margin-top:22px">' + spotGroups("want") + "</div>" +
      reasonBox("reasonBox", R("景点顺序将按同城片区聚合后再排入时间轴，减少折返；标注「台阶 / 爬坡」的点位会在人物模块出现老人、行动不便成员时被降级或替换。")) +
      foot(step, "下一步，选择不想去的地方", "#/place/exclude", { backRoute: "#/pick", backLabel: "上一步，返回地图" });
  }

  function stepExclude(step) {
    return pageHead(step, "不想去景点", "与上一步同一批城市景点；打叉的点位将不再出现在任何方案中") +
      '<div class="paper-card fret" style="padding:18px 22px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap">' +
      '<div><div class="hint-text">已选定目的地</div><div style="font-family:var(--font-serif);font-size:20px;letter-spacing:.08em;color:var(--stone-2)">' +
      U.esc(S.cities.map(function (c) { return c.n; }).join("、")) + "</div></div>" +
      '<div class="count-bar" style="margin:0"><span>已排除 <b id="cntEx">' + S.place.exclude.length + "</b> 个景点</span></div>" +
      "</div></div>" +
      '<div style="margin-top:22px">' + spotGroups("exclude") + "</div>" +
      reasonBox("reasonBox", R("排除清单为硬约束：即便后续按顺路算法更优，也不会重新纳入被排除景点。与「想去」互斥，重复勾选时以最后一次操作为准。")) +
      foot(step, "确认地点偏好", "#/place/hotel", { backRoute: "#/place/spots", backLabel: "上一步，回到想去景点" });
  }

  function stepHotel(step) {
    return pageHead(step, "住宿偏好", "选择住宿类型，系统会结合游玩位置匹配住处") +
      '<div class="paper-card fret">' +
      '<div class="field">' + fieldHead("1", "住宿类型", true) + optGrid("place.hotel.type", M.hotelTypes) + "</div>" +

      '<div class="field">' + fieldHead("2", "位置偏好", false, true, "可多选，另可自定义补充") + optGrid("place.hotel.locs", M.hotelLocs) +
      '<div class="custom-row"><input class="input" type="text" data-field="place.hotel.locNote" value="' + U.esc(S.place.hotel.locNote) + '" placeholder="自定义补充，如：步行 10 分钟内到地铁"></div></div>' +

      '<div class="field">' + fieldHead("3", "预算区间", false, true, "元 / 晚 / 间") +
      rangeBox("place.hotel.budget", 100, 1500, 50, "元 / 晚 / 间", "不限预算") + "</div>" +

      '<div class="field">' + fieldHead("4", "住宿硬性要求", false, true) + chipList("place.hotel.reqs", M.hotelReqs) + "</div>" +

      '<div class="field" style="margin-bottom:6px">' + fieldHead("5", "特殊说明", false, true) +
      textarea("place.hotel.note", "如：无障碍通道、可做饭、不临街") + "</div>" +
      reasonBox("reasonBox", "") +
      "</div>" +
      foot(step, "下一步，夜游与风俗偏好", "#/place/night", { backRoute: "#/place/exclude", backLabel: "上一步，回到景点选择" });
  }

  function stepNight(step) {
    return pageHead(step, "夜游与风俗偏好", "设置夜间出行安排，同时开启当地风俗提醒，规避行程中的禁忌") +
      '<div class="paper-card fret">' +
      '<div class="field">' + fieldHead("1", "夜间出行规划", true) + optGrid("place.night.plan", M.nightPlans) + "</div>" +
      '<div class="field">' + fieldHead("2", "当地风俗禁忌提醒", false, true) + optGrid("place.night.custom", M.nightCustom) + "</div>" +
      '<div class="field" style="margin-bottom:6px">' + fieldHead("3", "夜间补充备注", false, true) +
      textarea("place.night.note", "如：想看江边夜景、不逛嘈杂夜市、22 点前回住宿点") + "</div>" +
      reasonBox("reasonBox", "") +
      "</div>" +
      foot(step, "下一步，餐饮美食偏好", "#/place/dining", { backRoute: "#/place/hotel", backLabel: "上一步，回到住宿偏好" });
  }

  function stepDining(step) {
    return pageHead(step, "餐饮美食偏好", "设置口味、用餐预算、忌口，行程会结合游玩动线匹配合适的正餐、小吃") +
      '<div class="paper-card fret">' +
      '<div class="field">' + fieldHead("1", "美食体验倾向", true) + optGrid("place.food.style", M.foodStyles) + "</div>" +
      '<div class="field">' + fieldHead("2", "口味与辣度", false, true) + optGrid("place.food.spicy", M.spicy) + "</div>" +
      '<div class="field">' + fieldHead("3", "用餐预算", false, true, "元 / 人 / 餐") +
      rangeBox("place.food.budget", 20, 800, 10, "元 / 人 / 餐", "不限餐饮预算") + "</div>" +
      '<div class="field">' + fieldHead("4", "饮食忌口与特殊需求", false, true) + chipList("place.food.diet", M.diet) +
      '<div class="custom-row"><input class="input" type="text" data-field="place.food.dietNote" value="' + U.esc(S.place.food.dietNote) + '" placeholder="其他忌口或过敏源，可自定义补充"></div></div>' +
      '<div class="field">' + fieldHead("5", "用餐场景偏好", false, true) + chipList("place.food.scenes", M.scenes) + "</div>" +
      '<div class="field" style="margin-bottom:6px">' + fieldHead("6", "美食额外备注", false, true) +
      textarea("place.food.note", "如：想吃当地小吃、避开景区高价餐厅、希望安排一次特色宴席、不吃甜口") + "</div>" +
      reasonBox("reasonBox", "") +
      "</div>" +
      foot(step, "下一步，进入时间模块", "#/time/base", { backRoute: "#/place/night", backLabel: "上一步，回到夜游与风俗偏好" });
  }

  function stepDate(step) {
    var t = S.time;
    var days = (t.start && t.end && AS.parseDate(t.end) >= AS.parseDate(t.start)) ? AS.dayDiff(t.start, t.end) : 0;
    return pageHead(step, "行程基础时间", "确定出行起止日期、总行程天数，系统将根据日期拉取对应时段天气、景点开放状态、节假日人流约束") +
      '<div class="paper-card fret">' +
      '<div class="field">' + fieldHead("1 · 2", "出发日期 / 返程日期", true) +
      '<div class="date-row">' +
      '<div class="date-field"><label>出发日期</label><input class="input" type="date" data-field="time.start" value="' + U.esc(t.start) + '"></div>' +
      '<div class="date-field"><label>返程日期</label><input class="input" type="date" data-field="time.end" value="' + U.esc(t.end) + '"></div>' +
      '<div class="date-field" style="flex:0 0 auto;min-width:150px"><label>总行程天数（含往返）</label>' +
      '<div class="input" style="display:flex;align-items:center;background:rgba(244,228,187,.55)" id="dayCount">' + (days ? days + " 天" : "待选择") + "</div></div>" +
      "</div>" +
      '<div class="warn-text" id="dateWarn" hidden>返程日期不可早于出发日期</div></div>' +

      '<div class="field">' + fieldHead("3a", "首日抵达约束", true) + optGrid("time.arrive", M.arrive) + "</div>" +
      '<div class="field">' + fieldHead("3b", "返程离开约束", true) + optGrid("time.leave", M.leave) + "</div>" +

      '<div class="field">' + fieldHead("4", "出行特殊时段标记", false, true) + chipList("time.flags", M.timeFlags) + "</div>" +
      '<div class="field" style="margin-bottom:6px">' + fieldHead("5", "时间备注", false, true) +
      textarea("time.note", "示例：周五傍晚出发、周日晚上返程；高铁早上 8 点到站；飞机 22 点落地等") + "</div>" +
      reasonBox("reasonBox", "") +
      "</div>" +
      foot(step, "下一步，作息与行程松紧节奏", "#/time/pace", { backRoute: "#/place/dining", backLabel: "上一步，回到餐饮美食偏好" });
  }

  function stepPace(step) {
    var p = S.time.pace;
    return pageHead(step, "作息与行程松紧节奏", "设定全队作息习惯，决定每日起床、就餐、游玩的时间轴密度，控制行程强度") +
      '<div class="paper-card fret">' +
      '<div class="field">' + fieldHead("1", "团队作息偏好", true) + optGrid("time.pace.wake", M.wake) + "</div>" +
      '<div class="field">' + fieldHead("2", "整体行程松紧强度", true) + optGrid("time.pace.intensity", M.intensity) + "</div>" +
      '<div class="field">' + fieldHead("3", "午休安排规则", true) + optGrid("time.pace.rest", M.rest) + "</div>" +
      '<div class="field">' + fieldHead("4", "每日最晚收工时间", false, true, "默认 21:00，填写 20:30 代表 20:30 后不再安排新景点，并与夜游偏好联动校验") +
      '<input class="input input-sm" type="time" data-field="time.pace.latest" value="' + U.esc(p.latest || "21:00") + '"></div>' +
      '<div class="field" style="margin-bottom:6px">' + fieldHead("5", "时间节奏备注", false, true) +
      textarea("time.pace.note", "示例：中午必须回酒店午休、不想早起排队、每天至少留 1 小时自由活动") + "</div>" +
      reasonBox("reasonBox", "") +
      "</div>" +
      foot(step, "下一步，天气与备选预案偏好", "#/time/weather", { backRoute: "#/time/base", backLabel: "上一步，回到行程基础时间" });
  }

  function stepWeather(step) {
    return pageHead(step, "天气与备选预案偏好", "设置雨天、高温等恶劣天气下的行程切换规则，系统将提前准备备用方案") +
      '<div class="paper-card fret">' +
      '<div class="field">' + fieldHead("1", "恶劣天气自动切换预案", true) + optGrid("time.weather.mode", M.weatherMode) + "</div>" +
      '<div class="field">' + fieldHead("2", "天气优先级", false, true) + chipList("time.weather.prio", M.weatherPrio) + "</div>" +
      '<div class="field">' + fieldHead("3", "预留缓冲时长", true) + optGrid("time.weather.buffer", M.buffer) + "</div>" +
      '<div class="field" style="margin-bottom:6px">' + fieldHead("4", "预案备注", false, true) +
      textarea("time.weather.note", "示例：下雨优先去美术馆、暴雨直接原地休息，不外出") + "</div>" +
      reasonBox("reasonBox", "") +
      "</div>" +
      foot(step, "下一步，时间模块确认汇总", "#/time/review", { backRoute: "#/time/pace", backLabel: "上一步，回到作息与行程松紧节奏" });
  }

  function stepTimeReview(step) {
    var t = S.time;
    var days = AS.dayDiff(t.start, t.end);
    function row(k, v) { return '<div class="sum-row"><span class="k">' + k + '</span><span class="v">' + (v || "<em>未填写</em>") + "</span></div>"; }
    return pageHead(step, "时间配置汇总确认", "核对全部时间相关设置，确认后数据锁定，传入【人物模块】") +
      '<div class="sum-grid">' +
      '<div class="paper-card sum-card fret"><h4>' + U.ic("i-cal") + " 出行周期</h4><div class=\"sum-list\">" +
      row("出发日期", U.esc(t.start) + " " + AS.weekdayOf(t.start)) +
      row("返程日期", U.esc(t.end) + " " + AS.weekdayOf(t.end)) +
      row("总天数", '<span class="big-num">' + days + "<small>天（含往返）</small></span>") +
      row("首日抵达", U.esc(t.arrive)) +
      row("返程离开", U.esc(t.leave)) +
      row("特殊时段", t.flags.length ? U.esc(t.flags.join("、")) : "") +
      "</div></div>" +

      '<div class="paper-card sum-card fret"><h4>' + U.ic("i-yun") + ' 作息与节奏</h4><div class="sum-list">' +
      row("起床节奏", U.esc(t.pace.wake)) +
      row("行程强度", U.esc(t.pace.intensity)) +
      row("午休规则", U.esc(t.pace.rest)) +
      row("最晚收工", U.esc(t.pace.latest || "21:00")) +
      row("时间备注", t.pace.note ? U.esc(t.pace.note) : "") +
      "</div></div>" +

      '<div class="paper-card sum-card fret"><h4>' + U.ic("i-lu") + ' 天气与缓冲</h4><div class="sum-list">' +
      row("天气策略", U.esc(t.weather.mode)) +
      row("天气优先", t.weather.prio.length ? U.esc(t.weather.prio.join("、")) : "") +
      row("路段缓冲", U.esc(t.weather.buffer)) +
      row("预案备注", t.weather.note ? U.esc(t.weather.note) : "") +
      "</div></div>" +

      '<div class="paper-card sum-card fret"><h4>' + U.ic("i-shan") + ' 时间备注</h4><div class="sum-list">' +
      row("用户填写", t.note ? U.esc(t.note) : "") +
      "</div></div>" +
      "</div>" +
      reasonBox("reasonBox", R("所有时间约束将和前面地点模块的景点、住宿、夜游、餐饮偏好联动，共同约束行程时间轴。本页不新增选项，仅做预览复核。"), true) +
      foot(step, "确认时间配置，进入人物模块", "#/people/team", { backRoute: "#/time/weather", backLabel: "上一步，回到天气与备选预案偏好" });
  }

  function stepTeam(step) {
    var p = S.people;
    return pageHead(step, "团队基础信息", "录入团队规模、成员构成，系统依据人员情况校正行程强度、交通方案、景点适配性") +
      '<div class="paper-card fret">' +
      '<div class="field">' + fieldHead("1", "团队总人数", true) +
      '<div class="inline"><input class="input input-sm" type="number" min="1" max="80" data-field="people.count" data-num="1" value="' + U.esc(p.count) + '" placeholder="如 6">' +
      '<span class="unit">人</span></div>' +
      '<div class="link-note" id="countNote">' + (p.count ? "将按照 " + U.esc(p.count) + " 人核算包车、餐桌、门票团购、住宿房间预估数量" : "输入人数后，系统自动核算包车座位、餐桌与房间数量") + "</div></div>" +

      '<div class="field">' + fieldHead("2", "成员人群标签", true) + chipList("people.tags", M.teamTags) + "</div>" +
      '<div class="field">' + fieldHead("3", "成员体力整体水平", true) + optGrid("people.fitness", M.fitness) + "</div>" +
      '<div class="field">' + fieldHead("4", "同行有无特殊障碍需求", false, true) + chipList("people.barriers", M.barriers) + "</div>" +
      '<div class="field" style="margin-bottom:6px">' + fieldHead("5", "人物基础备注", false, true) +
      textarea("people.note", "示例：老人腿脚不便、两个小朋友需要午睡、全员大学生体力充足") + "</div>" +
      reasonBox("reasonBox", "") +
      "</div>" +
      foot(step, "下一步：饮食健康与过敏信息", "#/people/health", { backRoute: "#/time/review", backLabel: "上一步，回到时间汇总确认" });
  }

  function stepHealth(step) {
    var h = S.people.health;
    return pageHead(step, "饮食健康与过敏信息", "补充全员过敏、基础健康情况，联动地点模块餐饮偏好，规避风险食物") +
      '<div class="paper-card fret">' +
      '<div class="link-note" style="margin:0 0 18px">本页信息优先级高于前面餐饮偏好，过敏类项目为强约束，绝对不安排相关食材。</div>' +
      '<div class="field">' + fieldHead("1", "食物过敏", false, true) + chipList("people.health.allergies", M.allergies) +
      '<div class="custom-row"><input class="input" type="text" data-field="people.health.allergyNote" value="' + U.esc(h.allergyNote) + '" placeholder="其他过敏源，如：花生、芝麻、特定药物"></div></div>' +
      '<div class="field">' + fieldHead("2", "基础健康情况", false, true) + chipList("people.health.conditions", M.conditions) + "</div>" +
      '<div class="field">' + fieldHead("3", "用药相关提示", false, true) +
      textarea("people.health.meds", "示例：有人需要按时服药、需要就近药店、常备氧气袋等") + "</div>" +
      '<div class="field" style="margin-bottom:6px">' + fieldHead("4", "饮食补充备注", false, true) +
      textarea("people.health.note", "示例：儿童需要清淡软烂饭菜、老人需要少盐") + "</div>" +
      reasonBox("reasonBox", "") +
      "</div>" +
      foot(step, "下一步：团队分工与出行风格标签", "#/people/roles", { backRoute: "#/people/team", backLabel: "上一步，回到团队基础信息" });
  }

  function stepRoles(step) {
    var so = S.people.social;
    return pageHead(step, "团队分工与出行风格标签", "设置队内分工、出行偏好风格，用于行程里增加对应事务提醒") +
      '<div class="paper-card fret">' +
      '<div class="field">' + fieldHead("1", "团队负责人分工", false, true, "可多选，最终行程台账会增加对应角色的待办提醒栏") +
      chipList("people.social.roles", M.roles) + "</div>" +
      '<div class="field">' + fieldHead("2", "出行风格标签", true) + optGrid("people.social.style", M.styles) + "</div>" +
      '<div class="field">' + fieldHead("3", "额外限制条件", false, true) + chipList("people.social.limits", M.limits) + "</div>" +
      '<div class="field" style="margin-bottom:6px">' + fieldHead("4", "风格备注", false, true) +
      textarea("people.social.note", "示例：希望多留自由活动时间、不赶打卡、优先安静人少的点位") + "</div>" +
      reasonBox("reasonBox", "") +
      "</div>" +
      foot(step, "下一步：预算分配偏好", "#/people/budget", { backRoute: "#/people/health", backLabel: "上一步，回到饮食健康与过敏信息" });
  }

  function stepBudget(step) {
    var b = S.people.budget;
    var mode = b.mode;
    var extra = "";
    if (mode === "统一人均预算") {
      extra = '<div class="custom-row" style="max-width:360px"><input class="input" type="number" min="100" step="100" data-field="people.budget.perCap" data-num="1" value="' + U.esc(b.perCap) + '" placeholder="人均总预算，如 2000"><span class="unit">元 / 人</span></div>';
    } else if (mode === "分项自主设置") {
      extra = '<div class="opt-grid" style="grid-template-columns:repeat(2,1fr);max-width:640px">' +
        rowNum("交通", "people.budget.items.transport") + rowNum("住宿", "people.budget.items.hotel") +
        rowNum("餐饮", "people.budget.items.food") + rowNum("门票", "people.budget.items.ticket") + "</div>";
    }
    return pageHead(step, "预算分配偏好", "按团队意愿分配资金倾斜方向，系统在匹配住宿、餐厅、交通、门票时优先遵从分配比例") +
      '<div class="paper-card fret">' +
      '<div class="field">' + fieldHead("1", "预算模式", true) + optGrid("people.budget.mode", M.budgetModes) +
      '<div id="budgetExtra" style="margin-top:14px">' + extra + "</div></div>" +
      '<div class="field">' + fieldHead("2", "预算重点倾斜", false, true) + chipList("people.budget.tilts", M.tilts) + "</div>" +
      '<div class="field" style="margin-bottom:6px">' + fieldHead("3", "预算红线备注", false, true) +
      textarea("people.budget.note", "示例：门票尽量选免费景点、住宿单间不要超过 400、尽量不买高价演出") + "</div>" +
      reasonBox("reasonBox", "") +
      "</div>" +
      foot(step, "下一步：人物模块汇总确认", "#/people/review", { backRoute: "#/people/roles", backLabel: "上一步，回到分工与出行风格标签" });
  }
  function rowNum(label, path) {
    return '<div class="inline" style="justify-content:space-between"><span class="unit" style="width:44px">' + label + "</span>" +
      '<input class="input" type="number" min="0" step="50" data-field="' + path + '" data-num="1" value="' + U.esc(getPath(path) || "") + '" placeholder="0" style="max-width:120px"><span class="unit">元</span></div>';
  }

  function stepPeopleReview(step) {
    var p = S.people;
    function row(k, v) { return '<div class="sum-row"><span class="k">' + k + '</span><span class="v">' + (v || "<em>未填写</em>") + "</span></div>"; }
    return pageHead(step, "人物配置汇总确认", "核对全部团队人员相关设置，确认后地点、时间、人物三大模块参数全部集齐，进入事件生成模块") +
      '<div class="sum-grid">' +
      '<div class="paper-card sum-card fret"><h4>' + U.ic("i-users") + ' 团队构成</h4><div class="sum-list">' +
      row("总人数", '<span class="big-num">' + U.esc(p.count) + "<small>人</small></span>") +
      row("人群标签", p.tags.length ? U.esc(p.tags.join("、")) : "") +
      row("体力水平", U.esc(p.fitness)) +
      row("行动限制", p.barriers.length ? U.esc(p.barriers.join("、")) : "") +
      row("基础备注", p.note ? U.esc(p.note) : "") +
      "</div></div>" +

      '<div class="paper-card sum-card fret"><h4>' + U.ic("i-yao") + ' 健康与饮食</h4><div class="sum-list">' +
      row("食物过敏", p.health.allergies.length ? U.esc(p.health.allergies.join("、")) : "") +
      row("其他过敏", p.health.allergyNote ? U.esc(p.health.allergyNote) : "") +
      row("基础疾病", p.health.conditions.length ? U.esc(p.health.conditions.join("、")) : "") +
      row("用药提示", p.health.meds ? U.esc(p.health.meds) : "") +
      "</div></div>" +

      '<div class="paper-card sum-card fret"><h4>' + U.ic("i-lu") + ' 分工与风格</h4><div class="sum-list">' +
      row("队内分工", p.social.roles.length ? U.esc(p.social.roles.join("、")) : "") +
      row("出行风格", U.esc(p.social.style)) +
      row("额外限制", p.social.limits.length ? U.esc(p.social.limits.join("、")) : "") +
      row("风格备注", p.social.note ? U.esc(p.social.note) : "") +
      "</div></div>" +

      '<div class="paper-card sum-card fret"><h4>' + U.ic("i-money") + ' 预算分配</h4><div class="sum-list">' +
      row("预算模式", U.esc(p.budget.mode)) +
      row("预算倾斜", p.budget.tilts.length ? U.esc(p.budget.tilts.join("、")) : "") +
      row("人均预算", p.budget.perCap ? U.esc(p.budget.perCap) + " 元" : "") +
      row("红线备注", p.budget.note ? U.esc(p.budget.note) : "") +
      "</div></div>" +
      "</div>" +
      reasonBox("reasonBox", R("地点、时间、人物全部约束参数将合并运算；人员约束属于最高优先级约束，会反向修正时间节奏、住宿、餐饮、交通方案，所有自动调整项均会在行程台账中附带【原因说明】。"), true) +
      '<footer class="flow-foot"><div class="wrap inner">' +
      '<div class="foot-hint" id="footHint">确认后将进入推演过程，约需 2 秒</div>' +
      '<div class="foot-actions">' +
      '<button class="btn btn-ghost" type="button" data-go="#/people/budget">' + U.ic("i-back") + "上一步，回到预算分配偏好</button>" +
      '<button class="btn btn-ochre btn-next" type="button" data-go="generate" id="nextBtn">' + U.ic("i-spark", "") + "确认全部配置，生成行程方案</button>" +
      "</div></div></footer>";
  }

  /* ---------------- 事件 ---------------- */
  function afterChange(stepId) {
    AS.save();
    renderReasons(stepId);
    refreshFoot(stepId);
    /* 动态计数 */
    var cw = document.getElementById("cntWant");
    if (cw) cw.textContent = S.place.want.length;
    var ce = document.getElementById("cntEx");
    if (ce) ce.textContent = S.place.exclude.length;
    var dc = document.getElementById("dayCount");
    if (dc) {
      var t = S.time;
      var ok = t.start && t.end && AS.parseDate(t.end) >= AS.parseDate(t.start);
      dc.textContent = ok ? AS.dayDiff(t.start, t.end) + " 天" : "待选择";
      var warn = document.getElementById("dateWarn");
      if (warn) warn.hidden = !(t.start && t.end && AS.parseDate(t.end) < AS.parseDate(t.start));
    }
    var cn = document.getElementById("countNote");
    if (cn) cn.textContent = S.people.count ? "将按照 " + S.people.count + " 人核算包车、餐桌、门票团购、住宿房间预估数量" : "输入人数后，系统自动核算包车座位、餐桌与房间数量";
  }

  var currentStep = null;
  var boundOnce = false;

  function bindStep(stepId) {
    currentStep = stepId;
    if (boundOnce) return;
    boundOnce = true;
    var view = document.getElementById("view");

    view.addEventListener("click", function (e) {
      var step = currentStep;
      /* 选项卡片 / 标签 */
      var opt = e.target.closest("[data-val]");
      if (opt && opt.closest("[data-group]")) {
        var group = opt.closest("[data-group]");
        var path = group.dataset.group;
        var multi = group.dataset.multi === "1";
        var val = opt.dataset.val;
        if (multi) {
          var arr = (getPath(path) || []).slice();
          var i = arr.indexOf(val);
          if (i >= 0) arr.splice(i, 1); else arr.push(val);
          setPath(path, arr);
        } else {
          setPath(path, val);
        }
        if (!multi) {
          group.querySelectorAll("[data-val]").forEach(function (b) { b.classList.remove("on"); });
        }
        opt.classList.toggle("on");
        if (step === "budget" && path === "people.budget.mode") renderBudgetExtra();
        afterChange(step);
        return;
      }

      /* 景点卡片 */
      var card = e.target.closest(".spot-card");
      if (card) { toggleSpot(card); return; }

      /* 底部按钮 */
      var go = e.target.closest("[data-go]");
      if (go) { handleGo(go.dataset.go); return; }
    });

    view.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" && e.key !== " ") return;
      var card = e.target.closest && e.target.closest(".spot-card");
      if (card) { e.preventDefault(); toggleSpot(card); }
    });

    view.addEventListener("input", function (e) {
      var step = currentStep;
      var rb = e.target.closest("[data-range]");
      if (rb && e.target.type === "range") {
        var lo0 = +rb.querySelector(".rmin").value, hi0 = +rb.querySelector(".rmax").value;
        if (lo0 > hi0) { e.target.value = Math.min(lo0, hi0); }
        var l2 = +rb.querySelector(".rmin").value, h2 = +rb.querySelector(".rmax").value;
        var b2 = getPath(rb.dataset.range);
        b2.min = Math.min(l2, h2); b2.max = Math.max(l2, h2);
        rb.querySelector("[data-rmin]").value = b2.min;
        rb.querySelector("[data-rmax]").value = b2.max;
        syncRange(rb, b2.min, b2.max);
        afterChange(step);
        return;
      }
      var f = e.target.closest("[data-field]");
      if (!f) return;
      var path = f.dataset.field;
      var v = f.value;
      if (f.dataset.num) v = v === "" ? "" : Number(v);
      setPath(path, v);
      afterChange(step);
    });

    view.addEventListener("change", function (e) {
      var step = currentStep;
      var f = e.target.closest("[data-field]");
      if (f && f.type === "date") { setPath(f.dataset.field, f.value); afterChange(step); }

      var rb = e.target.closest("[data-range]");
      if (rb) {
        var min = +rb.dataset.min, max = +rb.dataset.max;
        var lo = +rb.querySelector(".rmin").value, hi = +rb.querySelector(".rmax").value;
        if (lo > hi) { var tmp = lo; lo = hi; hi = tmp; }
        var path2 = rb.dataset.range;
        var b = getPath(path2);
        b.min = lo; b.max = hi;
        if (e.target.dataset.rany !== undefined) b.any = e.target.checked;
        rb.querySelector("[data-rmin]").value = lo;
        rb.querySelector("[data-rmax]").value = hi;
        syncRange(rb, lo, hi);
        setPath(path2, b);
        afterChange(step);
      }
    });
  }

  function syncRange(rb, lo, hi) {
    var min = +rb.dataset.min, max = +rb.dataset.max;
    var l = ((lo - min) / (max - min)) * 100, r = ((hi - min) / (max - min)) * 100;
    var fill = rb.querySelector(".fill");
    fill.style.left = l + "%";
    fill.style.width = Math.max(0, r - l) + "%";
  }

  function toggleSpot(card) {
    var id = card.dataset.id, mode = card.dataset.mode;
    if (mode === "want") {
      var i = S.place.want.indexOf(id);
      if (i >= 0) S.place.want.splice(i, 1); else S.place.want.push(id);
      var j = S.place.exclude.indexOf(id);
      if (j >= 0) S.place.exclude.splice(j, 1);
      card.classList.toggle("on");
      document.querySelectorAll('.spot-card[data-mode="exclude"][data-id="' + cssEsc(id) + '"]').forEach(function (c) { c.classList.remove("excluded"); });
      if (S.place.exclude.indexOf(id) < 0) U.toast("已加入想去清单");
    } else {
      var k = S.place.exclude.indexOf(id);
      if (k >= 0) S.place.exclude.splice(k, 1);
      else {
        S.place.exclude.push(id);
        var w = S.place.want.indexOf(id);
        if (w >= 0) { S.place.want.splice(w, 1); U.toast("该点位原在想去清单，已自动移出"); }
      }
      card.classList.toggle("excluded");
    }
    AS.save();
    var stepId = location.hash.indexOf("exclude") >= 0 ? "exclude" : "spots";
    renderReasons(stepId);
    refreshFoot(stepId);
    var cw = document.getElementById("cntWant");
    if (cw) cw.textContent = S.place.want.length;
    var ce = document.getElementById("cntEx");
    if (ce) ce.textContent = S.place.exclude.length;
  }
  function cssEsc(s) { return String(s).replace(/"/g, '\\"'); }

  function renderBudgetExtra() {
    var box = document.getElementById("budgetExtra");
    if (!box) return;
    var b = S.people.budget;
    if (b.mode === "统一人均预算") {
      box.innerHTML = '<div class="custom-row" style="max-width:360px"><input class="input" type="number" min="100" step="100" data-field="people.budget.perCap" data-num="1" value="' + U.esc(b.perCap) + '" placeholder="人均总预算，如 2000"><span class="unit">元 / 人</span></div>';
    } else if (b.mode === "分项自主设置") {
      box.innerHTML = '<div class="opt-grid" style="grid-template-columns:repeat(2,1fr);max-width:640px">' +
        rowNum("交通", "people.budget.items.transport") + rowNum("住宿", "people.budget.items.hotel") +
        rowNum("餐饮", "people.budget.items.food") + rowNum("门票", "people.budget.items.ticket") + "</div>";
    } else box.innerHTML = "";
  }

  function handleGo(route) {
    if (route === "generate") {
      var v = AS.canNext("peopleReview");
      if (!v.ok) { U.toast(v.msg); return; }
      location.hash = "#/loading";
      return;
    }
    /* 防御性校验：任何情况下都不允许跳过未完成的必选项 */
    var cur = AS.routeToStep[location.hash.replace(/^#\//, "")];
    if (cur) {
      var chk = AS.canNext(cur);
      if (!chk.ok) { U.toast(chk.msg); return; }
    }
    location.hash = route;
  }

  /* ---------------- 渲染入口 ---------------- */
  var RENDERERS = {
    spots: stepSpots, exclude: stepExclude, hotel: stepHotel, night: stepNight, dining: stepDining,
    date: stepDate, pace: stepPace, weather: stepWeather, timeReview: stepTimeReview,
    team: stepTeam, health: stepHealth, roles: stepRoles, budget: stepBudget, peopleReview: stepPeopleReview
  };

  function render(stepId) {
    var view = document.getElementById("view");
    var step = AS.STEPS[AS.stepIndex(stepId)];
    if (!step) { location.hash = "#/404"; return; }
    view.innerHTML = '<div class="flow-page"><div class="wrap">' + RENDERERS[stepId](step) + "</div></div>";
    U.crumbs(step.mod === "地点模块" ? "place" : step.mod === "时间模块" ? "time" : "people");
    U.showTopbar(true);
    U.scrollTop();
    /* 记录默认提示，便于恢复 */
    var hint = document.getElementById("footHint");
    if (hint) hint.dataset.defaultText = hint.textContent;
    bindStep(stepId);
    renderReasons(stepId);
    refreshFoot(stepId);
  }

  window.Flow = { render: render, getPath: getPath, setPath: setPath };
})();
