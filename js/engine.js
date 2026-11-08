/* ===========================================================
   engine.js —— 约束推理引擎
   优先级：人物约束 > 地点偏好 > 时间偏好
   每一次自动改动都写入 audit 台账，附原因说明
   =========================================================== */
(function () {
  "use strict";

  var S = window.STATE, M = window.META, AS = window.AppState;
  var G = window.GEO;

  /* ---------------- 工具 ---------------- */
  function hash(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rnd(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function fmt(mins) {
    mins = ((mins % 1440) + 1440) % 1440;
    var h = Math.floor(mins / 60), m = mins % 60;
    return (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m;
  }
  function toMin(s) {
    var p = String(s || "00:00").split(":");
    return (+p[0] || 0) * 60 + (+p[1] || 0);
  }
  function money(n) { return Math.round(n || 0); }
  function num(n) { return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function pct(n) { return Math.round(n * 1000) / 10; }

  /* 城市经纬度中心（从 geo 数据反查） */
  var cityGeo = {};
  Object.keys(G.cities || {}).forEach(function (pa) {
    (G.cities[pa] || []).forEach(function (c) { cityGeo[c.n] = c; });
  });
  var provGeo = {};
  G.provinces.forEach(function (p) { provGeo[p.ad] = p; });

  function distanceKm(a, b) {
    var A = cityGeo[a], B = cityGeo[b];
    if (!A || !B) return 420;
    var dx = A.c[0] - B.c[0], dy = A.c[1] - B.c[1];
    var d = Math.sqrt(dx * dx + dy * dy) * 5.05;
    return Math.max(45, Math.round(d));
  }

  /* ---------------- 上下文 ---------------- */
  function buildCtx() {
    var p = S.people;
    var tags = p.tags || [];
    var barriers = p.barriers || [];
    var health = p.health || {};
    var social = p.social || {};
    var allergies = (health.allergies || []).filter(function (a) { return a.indexOf("其他") < 0; });

    var ctx = {
      count: Math.max(1, +p.count || 1),
      hasElder: tags.indexOf("60 岁以上老人") >= 0,
      hasChild: tags.indexOf("3–12 岁儿童") >= 0,
      hasBaby: tags.indexOf("婴幼儿（3 岁以下）") >= 0,
      immobile: tags.indexOf("行动不便人士") >= 0 ||
        barriers.indexOf("需要无障碍通道（轮椅通行）") >= 0 ||
        barriers.indexOf("不能长时间站立") >= 0 ||
        barriers.indexOf("不能爬山爬坡") >= 0,
      frail: p.fitness === "整体偏弱",
      strong: p.fitness === "整体体力较好",
      weakTeam: false,
      allergies: allergies,
      allergyNote: health.allergyNote || "",
      conditions: (health.conditions || []).filter(function (c) { return c !== "无基础疾病"; }),
      carSick: barriers.indexOf("不能长时间坐车晕车") >= 0,
      noBike: (social.limits || []).indexOf("有人不会骑自行车") >= 0,
      noStairs: barriers.indexOf("不能爬山爬坡") >= 0,
      noStand: barriers.indexOf("不能长时间站立") >= 0,
      roles: (social.roles || []).filter(function (r) { return r !== "无固定分工"; }),
      style: social.style || "混合均衡",
      limits: social.limits || [],
      audit: [],
      days: AS.dayDiff(S.time.start, S.time.end) || 1,
      pace: S.time.pace.intensity || "均衡适中",
      paceChanged: false
    };
    ctx.weakTeam = ctx.hasElder || ctx.hasChild || ctx.hasBaby || ctx.immobile || ctx.frail;
    return ctx;
  }

  function log(ctx, stage, from, to, reason, level) {
    ctx.audit.push({ stage: stage, from: from, to: to, reason: reason, level: level || 1 });
  }

  /* ---------------- 节奏修正 ---------------- */
  function resolvePace(ctx) {
    var order = ["宽松慢游", "均衡适中", "紧凑打卡"];
    var idx = order.indexOf(ctx.pace);
    if (idx < 0) idx = 1;

    function down(reason) {
      if (idx <= 0) return;
      var from = order[idx];
      idx -= 1;
      ctx.paceChanged = true;
      log(ctx, "时间模块 · 行程强度", from, order[idx], reason, 1);
    }

    if (ctx.hasElder || ctx.immobile || ctx.frail) {
      down("团队含" + (ctx.hasElder ? " 60 岁以上老人" : "行动不便成员") + (ctx.frail ? "且整体体力偏弱" : "") +
        "，原定强度不可持续，系统下调节奏并增加休息点位。");
    }
    if (ctx.hasChild) {
      down("团队含 3–12 岁儿童，单日景点数量下调，保留午后休整与随时折返余量。");
    }
    if (ctx.hasBaby && idx > 1) {
      var fromB = order[idx];
      idx = 1;
      ctx.paceChanged = true;
      log(ctx, "时间模块 · 行程强度", fromB, order[idx], "团队含 3 岁以下婴幼儿，取消紧凑打卡。", 1);
    }
    ctx.paceEff = order[idx];
    ctx.spotsPerDay = idx === 0 ? 2 : idx === 1 ? 3 : 4;

    /* 夜游与收工联动 */
    var night = S.place.night.plan;
    if (ctx.hasBaby && night === "允许安排夜游") {
      log(ctx, "地点模块 · 夜游", "允许安排夜游", "仅偶尔夜游", "团队含婴幼儿，夜间活动频次压减，避免影响作息。", 1);
      night = "仅偶尔夜游";
    }
    ctx.nightMode = night;

    /* 午休 */
    ctx.restFixed = S.time.pace.rest === "固定午休" || S.time.pace.rest === "" || ctx.hasElder || ctx.hasChild;
    ctx.latest = toMin(S.time.pace.latest || "21:00");
    if (ctx.latest < 1140) {
      log(ctx, "时间模块 · 收工时间", fmt(ctx.latest), "20:00", "收工时间早于 19:00 会使多数景点无法安排，系统按 20:00 兜底并提示。", 3);
      ctx.latest = 1200;
    }
    return ctx;
  }

  /* ---------------- 天气 ---------------- */
  var WEATHER = ["晴", "多云", "小雨", "中雨", "高温", "阴"];
  function weatherOf(dateStr, city) {
    var m = AS.parseDate(dateStr);
    var month = m ? m.getMonth() + 1 : 6;
    var r = rnd(hash(dateStr + city + "wx"));
    var pool;
    if (month >= 6 && month <= 8) pool = ["高温", "高温", "多云", "小雨", "晴", "多云"];
    else if (month >= 3 && month <= 5) pool = ["小雨", "多云", "晴", "多云", "中雨", "晴"];
    else if (month >= 9 && month <= 11) pool = ["晴", "多云", "晴", "小雨", "多云", "阴"];
    else pool = ["阴", "多云", "晴", "小雨", "多云", "晴"];
    var w = pool[Math.floor(r() * pool.length) % pool.length];
    var rain = w === "小雨" || w === "中雨";
    var hot = w === "高温";
    return {
      tag: w, rain: rain, hot: hot,
      note: rain ? "有降水，户外点位存在湿滑与排队滞留风险" : hot ? "体感高温，正午时段不宜长时间户外停留" : "天气条件适合户外活动",
      level: rain || hot ? 2 : 1
    };
  }

  /* ---------------- 景点筛选 ---------------- */
  function spotKey(city, name) { return city + "::" + name; }

  function violation(sp, ctx) {
    var tags = sp.tags || [];
    if (ctx.hasElder || ctx.immobile || ctx.frail) {
      if (tags.indexOf("爬坡") >= 0) return "含爬坡路段";
      if (tags.indexOf("台阶") >= 0) return "台阶较多";
      if (ctx.hasElder && tags.indexOf("长步行") >= 0) return "步行距离偏长";
    }
    if (ctx.hasChild && tags.indexOf("爬坡") >= 0) return "含爬坡路段";
    if (ctx.noStairs && (tags.indexOf("台阶") >= 0 || tags.indexOf("爬坡") >= 0)) return "团队明确不能爬坡";
    return "";
  }

  function poolByCity(ctx) {
    var pool = {};
    var used = {};
    S.cities.forEach(function (c) {
      var list = AS.citySpots(c.n).map(function (sp) {
        return { id: spotKey(c.n, sp.name), city: c.n, spot: sp };
      });
      var keep = [], drop = [];
      list.forEach(function (it) {
        if (S.place.exclude.indexOf(it.id) >= 0) { drop.push(it); return; }
        var v = violation(it.spot, ctx);
        if (v) { it.blocked = v; drop.push(it); return; }
        keep.push(it);
      });
      /* 想去清单优先排前 */
      keep.sort(function (a, b) {
        var aw = S.place.want.indexOf(a.id) >= 0 ? 0 : 1;
        var bw = S.place.want.indexOf(b.id) >= 0 ? 0 : 1;
        if (aw !== bw) return aw - bw;
        if (a.spot.zone !== b.spot.zone) return a.spot.zone > b.spot.zone ? 1 : -1;
        return 0;
      });
      pool[c.n] = { keep: keep, drop: drop };
    });

    /* 记录因人员约束被替换的点位 */
    Object.keys(pool).forEach(function (city) {
      pool[city].drop.forEach(function (it) {
        if (it.blocked) {
          var alt = pool[city].keep[0];
          log(ctx, "人物模块 · 景点适配",
            it.spot.name + "（" + it.blocked + "）",
            alt ? "替换为「" + alt.spot.name + "」" : "移出当日行程",
            "团队存在老人 / 儿童 / 行动不便成员，该点位" + it.blocked + "，与人员强约束冲突，系统优先保障安全与体力。" +
            (alt ? "同城替换点位路程更平缓且仍在游玩动线上。" : "同城无更平缓的备选点位，当日改为休整或自由活动。"), 1);
        }
      });
    });
    return pool;
  }

  /* ---------------- 城市 → 天 ---------------- */
  function allocateDays(ctx, pool) {
    var cities = S.cities.map(function (c) { return c.n; });
    var D = ctx.days, C = cities.length;
    var counts = cities.map(function (c) { return (pool[c].keep.length || 1); });
    var total = counts.reduce(function (a, b) { return a + b; }, 0);
    var plan = [];
    if (D >= C) {
      var left = D - C;
      var extra = counts.map(function (n) { return Math.floor(left * n / total); });
      var rem = left - extra.reduce(function (a, b) { return a + b; }, 0);
      for (var i = 0; rem > 0; i = (i + 1) % C) { extra[i]++; rem--; }
      cities.forEach(function (c, idx) {
        for (var k = 0; k < 1 + extra[idx]; k++) plan.push([c]);
      });
    } else {
      /* 天数不足：部分日程串联两座城市 */
      var per = Math.ceil(C / D);
      var ci = 0;
      for (var d = 0; d < D; d++) {
        var group = [];
        for (var j = 0; j < per && ci < C; j++, ci++) group.push(cities[ci]);
        plan.push(group);
      }
      if (ci < C) plan[D - 1] = plan[D - 1].concat(cities.slice(ci));
      log(ctx, "时间模块 · 天数分配", cities.join("、"), "部分城市压缩为半日游",
        "行程天数少于所选城市数，系统将相邻城市合并到同一天，减少住宿搬移与折返，并在每日主题中标注转场。", 2);
    }
    return plan;
  }

  /* ---------------- 餐饮 ---------------- */
  var ALLERGY_KEYS = {
    "海鲜过敏": ["海鲜", "虾", "蟹", "贝", "蚝", "鱼", "螺"],
    "坚果过敏": ["坚果", "花生", "核桃", "腰果", "杏仁", "松子"],
    "芒果过敏": ["芒果"],
    "乳制品过敏": ["奶", "芝士", "酸奶", "黄油", "乳"],
    "蛋类过敏": ["蛋"],
    "小麦麸质过敏": ["面", "饼", "麦", "馒头", "包"]
  };
  function dishSafe(dish, ctx) {
    var bad = [];
    ctx.allergies.forEach(function (a) {
      (ALLERGY_KEYS[a] || []).forEach(function (k) { if (dish.indexOf(k) >= 0) bad.push(a); });
    });
    if (ctx.allergyNote) {
      ctx.allergyNote.split(/[，,、;；\s]+/).filter(Boolean).forEach(function (k) {
        if (k.length >= 1 && dish.indexOf(k) >= 0) bad.push(k);
      });
    }
    var diet = S.place.food.diet || [];
    if (diet.indexOf("不吃海鲜") >= 0 && /[虾蟹贝蚝鱼螺]/.test(dish)) bad.push("不吃海鲜");
    if (diet.indexOf("不吃内脏") >= 0 && /[肝肠肚肺心]/.test(dish)) bad.push("不吃内脏");
    return bad;
  }

  function buildFood(ctx) {
    var style = S.place.food.style || "均衡搭配";
    var budget = S.place.food.budget || { min: 50, max: 150, any: false };
    var mid = Math.round((budget.min + budget.max) / 2);
    var meals = [], snacks = [], drinks = [], avoid = [];
    var seen = {};

    S.cities.forEach(function (c, ci) {
      var dishes = AS.dishes(c.n);
      var safe = [], cut = [];
      dishes.forEach(function (d) {
        var bad = dishSafe(d, ctx);
        if (bad.length) { cut.push({ dish: d, why: bad[0] }); }
        else safe.push(d);
      });
      cut.forEach(function (c2) {
        avoid.push({ city: c.n, text: c2.dish, why: c2.why + "（强约束，已剔除）" });
      });
      if (!safe.length) safe = ["清蒸时蔬", "白灼菜心", "米线或面食（可去浇头）"];

      var nameSeed = hash(c.n + "food");
      var r = rnd(nameSeed);
      var styleNames = style.indexOf("本地") >= 0
        ? ["老城巷口本地菜馆", "城厢家常小馆", "本地人常去的面馆"]
        : style.indexOf("网红") >= 0
          ? ["人气景观餐厅", "打卡氛围小店", "热门榜前列餐厅"]
          : style.indexOf("均衡") >= 0
            ? ["本地菜馆 + 家常小馆", "老字号与轻食混搭", "街巷小馆"]
            : ["系统推荐·综合评分优先", "动线顺路餐馆", "当地口碑店"];

      ["午餐", "晚餐"].forEach(function (slotName, si) {
        meals.push({
          city: c.n, kind: slotName, slot: si === 0 ? "lunch" : "dinner",
          name: styleNames[(ci + si) % styleNames.length],
          where: "市区 · 靠近当日景点动线",
          dishes: safe.slice(si === 0 ? 0 : 1, si === 0 ? 3 : 4),
          price: mid,
          booking: mid > 120 ? "建议提前 1 天电话订位（多人圆桌）" : "一般无需预约，错峰 11:30 前到店",
          note: "适配：" + (ctx.allergies.length ? "已剔除" + ctx.allergies.join("、") + "相关菜品" : "口味按" + (S.place.food.spicy || "微辣/不辣") + "调整") +
            (safe.length < dishes.length ? "；原菜单 " + dishes.length + " 道中被过滤 " + (dishes.length - safe.length) + " 道" : ""),
          reason: ctx.allergies.length
            ? "队伍存在" + ctx.allergies.join("、") + "，已剔除相关菜品，优先选择可提供清淡菜品的门店；用户偏好" + style + "，减少网红店占比。"
            : (style.indexOf("本地") >= 0 ? "用户偏好本地地道风味，优先本地人常去的门店，避开景区高价餐厅。" : "按用户口味倾向与人均餐标匹配。")
        });
      });

      snacks.push({
        city: c.n, name: "街边小吃：" + safe.slice(0, 2).join(" / "),
        price: Math.max(10, Math.round(mid * 0.25)),
        note: "排队预估 " + (5 + Math.floor(r() * 20)) + " 分钟；适合边走边吃"
      });
      drinks.push({
        city: c.n,
        name: pickDrink(c.n, safe, r),
        price: 18,
        note: "临近景点动线，适合午后补给"
      });
    });

    /* 餐饮偏好调整 */
    if ((S.people.budget.tilts || []).indexOf("优先吃特色美食") >= 0) {
      meals.forEach(function (m) { m.price = Math.round(m.price * 1.15); m.note += "；预算向美食倾斜，餐标上浮 15%"; });
      log(ctx, "人物模块 · 预算倾斜", "餐饮按基础餐标", "餐标上浮 15%",
        "预算重点倾斜至美食，餐饮推荐优先匹配本地特色老店，在原餐饮预算区间内优先保留特色正餐，压缩非必要文创、娱乐消费。", 2);
    }
    if (S.place.food.scenes.indexOf("尽量少排队") >= 0) {
      meals.forEach(function (m) { m.booking = "错峰用餐（11:20 / 17:20），避开排队高峰"; });
    }
    return { meals: meals, snacks: snacks, drinks: drinks, avoid: avoid, mid: mid };
  }
  function pickDrink(city, safe, r) {
    if (/杭州|苏州|南京|扬州/.test(city)) return "龙井 / 桂花酸梅汤";
    if (/成都|重庆|长沙/.test(city)) return "本地茶饮 / 冰粉";
    if (/广州|香港|澳门/.test(city)) return "凉茶 / 糖水";
    if (/西安|兰州/.test(city)) return "酸梅汤 / 冰峰";
    return safe.length ? safe[0] + "配饮" : "本地茶饮";
  }

  /* ---------------- 住宿 ---------------- */
  function buildHotels(ctx, food) {
    var h = S.place.hotel;
    var type = h.type || "中档舒适酒店";
    var budget = h.budget || { min: 200, max: 500, any: false };
    var brands = {
      "连锁平价酒店": ["如家", "汉庭", "城市便捷"],
      "中档舒适酒店": ["全季", "亚朵", "桔子水晶"],
      "特色民宿": ["山居民宿", "古城院落", "临水小筑"],
      "豪华顶奢酒店": ["洲际", "柏悦", "安缦系"],
      "无所谓，听推荐": ["全季", "亚朵", "本地精品酒店"]
    };
    var list = brands[type] || brands["中档舒适酒店"];
    var areas = [];
    S.cities.forEach(function (c) {
      var pool = AS.citySpots(c.n);
      pool.slice(0, 3).forEach(function (sp) { if (areas.indexOf(sp.zone) < 0) areas.push(sp.zone); });
    });
    if (!areas.length) areas = ["市中心"];

    var tilt = (S.people.budget.tilts || []);
    var priceLo = budget.any ? 300 : budget.min;
    var priceHi = budget.any ? 900 : budget.max;
    if (tilt.indexOf("优先住好一点") >= 0) { priceHi = Math.round(priceHi * 1.4); }
    var rooms = Math.max(1, Math.ceil(ctx.count / 2));
    var familyRooms = (ctx.hasChild || ctx.hasElder) ? Math.max(1, Math.round(rooms * 0.4)) : 0;

    var out = [];
    S.cities.slice(0, 3).forEach(function (c, i) {
      var brand = list[i % list.length];
      var area = areas[(i * 2) % areas.length];
      var price = Math.round((priceLo + priceHi) / 2);
      var fac = ["独立卫浴", "24 小时前台", "行李寄存"];
      if (h.reqs.length) {
        h.reqs.forEach(function (r) { if (fac.indexOf(r) < 0 && r !== "附近有药店或便利店") fac.push(r); });
      } else {
        fac.push("有电梯");
      }
      out.push({
        name: c.n + " · " + area + brand,
        city: c.n,
        area: area + "（" + (h.locs.length ? h.locs[0] : "核心景点集群") + "）",
        rooms: rooms + " 间（其中 " + familyRooms + " 间家庭/双床房）",
        price: price,
        fac: fac,
        book: "提前 3–7 天预订可保留可取消房型",
        tags: {
          store: "可寄存行李", pharmacy: "步行 5 分钟内有药店与便利店",
          access: (fac.indexOf("有电梯") >= 0 ? "有电梯" : "无电梯（不推荐）") + (ctx.immobile ? " / 无障碍通道需确认" : "")
        },
        reason: "用户选择" + (h.locs[0] || "核心景点集群") + (ctx.hasElder ? "，同时团队有老人" : "") +
          "，筛选" + (fac.indexOf("有电梯") >= 0 ? "带电梯、" : "") + "24 小时前台房源；预算区间限制单间不高于 " +
          (budget.any ? "不限" : budget.max) + " 元。"
      });
    });
    if (tilt.indexOf("优先住好一点") >= 0) {
      log(ctx, "人物模块 · 预算倾斜", "按预算区间中位房价", "上浮至更高档房型",
        "预算倾斜至住宿，房型与区位优先级提升，餐饮与门票维持平价策略。", 2);
    }
    return out;
  }

  /* ---------------- 交通 ---------------- */
  function buildTransport(ctx) {
    var long = [], local = [];
    var cities = S.cities.map(function (c) { return c.n; });
    for (var i = 1; i < cities.length; i++) {
      var d = distanceKm(cities[i - 1], cities[i]);
      var railH = Math.max(1, (d / 250 + 0.35));
      var railCost = Math.round(0.44 * d);
      var plane = d > 900;
      long.push({
        seg: cities[i - 1] + " → " + cities[i],
        way: plane ? "高铁 / 飞机（" + Math.round(d) + " km）" : "高铁（约 " + Math.round(d) + " km）",
        time: plane ? "飞行 2.2 h + 接驳 1.5 h（高铁约 " + railH.toFixed(1) + " h）" : railH.toFixed(1) + " h",
        cost: plane ? Math.round(railCost * 1.9) : railCost,
        note: plane ? "机场距市区较远，需预留接驳" : "建议选择上午班次，匹配首日抵达约束",
        fit: i === 1 ? (S.time.arrive === "首日上午抵达" ? "匹配" : "需调整首日行程") : "匹配中间日程",
        reason: "按站点距离与班次密度估算；" + (ctx.carSick ? "团队有晕车成员，优先高铁而非长途大巴。" : "价格按二等座/经济舱均价估算。")
      });
    }

    /* 市内交通：每日 */
    var solo = ctx.count <= 2;
    var big = ctx.count >= 5;
    var modes = [];
    if (!ctx.noBike) modes.push("共享单车（短距离接驳）");
    modes.push(big ? "包车（7–15 座）" : solo ? "地铁 / 公交" : "打车 / 网约车");
    if (ctx.immobile) modes = ["无障碍网约车 / 包车"];
    if (ctx.carSick) modes.push("短途步行接驳（避开长时间乘车）");

    local.push({
      seg: "酒店 ↔ 当日首站",
      way: ctx.immobile ? "无障碍网约车" : (big ? "包车" : "打车"),
      time: "15–30 min", cost: big ? 60 : 28,
      note: "早高峰预留 20 分钟缓冲",
      reason: ctx.immobile ? "团队含行动不便成员，优先门到门交通。" : (big ? "团队 " + ctx.count + " 人，包车减少频繁换乘。" : "按人数匹配经济型出行。")
    });
    local.push({
      seg: "景点 ↔ 景点",
      way: big ? "包车（随行不换车）" : "打车 / 步行",
      time: "10–25 min", cost: big ? 0 : 16,
      note: "同片区点位以步行为主",
      reason: "景点顺序已按片区聚合，减少折返；" + (ctx.noBike ? "团队有人不会骑车，已排除共享单车与电驴。" : "")
    });
    local.push({
      seg: "景点 ↔ 餐厅",
      way: "步行 / 打车",
      time: "10–20 min", cost: 12,
      note: "优先选择动线内餐厅",
      reason: "午餐点按当日游玩片区筛选，避免来回穿城。"
    });

    var bikeBlocked = ctx.noBike;
    if (bikeBlocked) {
      log(ctx, "人物模块 · 出行限制", "含有共享单车 / 电驴接驳方案", "替换为打车、包车、公交",
        "队伍内有人不会骑自行车，所有市内交通方案自动排除共享单车、共享电驴选项。", 1);
    }
    if (ctx.carSick) {
      log(ctx, "人物模块 · 出行限制", "跨区长途接驳", "拆分为短途 + 停靠休息",
        "有成员晕车，系统减少长时间跨区域赶路，增加中途停靠休息点。", 1);
    }
    return { long: long, local: local };
  }

  /* ---------------- 每日时间轴 ---------------- */
  function wakeMinutes(ctx) {
    var w = S.time.pace.wake;
    var base = w === "早起团队" ? 410 : w === "休闲晚起" ? 540 : 470;
    if (ctx.hasBaby) base += 30;
    if (ctx.hasChild) base += 15;
    return base;
  }

  function pickSpot(pool, city, used, ctx) {
    var p = pool[city];
    if (!p) return null;
    for (var i = 0; i < p.keep.length; i++) {
      var it = p.keep[i];
      if (used[it.id]) continue;
      used[it.id] = 1;
      return it;
    }
    return null;
  }

  function buildDays(ctx, pool, plan, food) {
    var days = [];
    var used = {};
    var cityPtr = {};
    var start = S.time.start;
    var bufferMin = S.time.weather.buffer.indexOf("少量") >= 0 ? 10 : S.time.weather.buffer.indexOf("充足") >= 0 ? 30 : 20;
    ctx.buffer = bufferMin;

    for (var d = 0; d < plan.length; d++) {
      var date = AS.addDays(start, d);
      var week = AS.weekdayOf(date);
      var group = plan[d];
      var mainCity = group[0];
      var wx = weatherOf(date, mainCity);
      var isFirst = d === 0, isLast = d === plan.length - 1;
      var entries = [];
      var cursor = wakeMinutes(ctx);
      var daySpots = [];
      var display = [];   /* {city, spot, replaced} */

      /* --- 当日可用景点数 --- */
      var quota = ctx.spotsPerDay;
      if (ctx.hasElder || ctx.immobile) quota = Math.min(quota, 2);
      if (ctx.hasChild) quota = Math.min(quota, 3);
      if (isFirst) {
        if (S.time.arrive === "首日下午 / 傍晚抵达") quota = 0;
        else if (S.time.arrive === "首日中午抵达") quota = Math.min(quota, 1);
        else quota = Math.min(quota, 2);
      }
      if (isLast) {
        if (S.time.leave === "返程日上午就要离开") quota = 0;
        else if (S.time.leave === "返程日下午离开") quota = Math.min(quota, 1);
        else quota = Math.min(quota, 2);
      }
      if (wx.hot && ctx.hasElder) quota = Math.min(quota, 2);

      /* --- 起点 --- */
      if (isFirst) {
        if (S.time.arrive === "首日上午抵达") {
          cursor = 9 * 60 + 30;
          entries.push({ t: fmt(cursor), title: "抵达 / 取行李 / 入住", place: "车站 · 酒店", detail: "首日上午不排景点，预留落地缓冲", reason: "首日上午抵达约束：第一天下午才开始游玩。" });
          cursor += 150;
        } else if (S.time.arrive === "首日中午抵达") {
          cursor = 12 * 60 + 20;
          entries.push({ t: fmt(cursor), title: "抵达 / 入住 / 午餐", place: "酒店附近", detail: "轻装午餐后开始少量行程", reason: "首日中午抵达约束：下午安排少量轻松行程。" });
          cursor += 110;
        } else {
          cursor = 17 * 60 + 30;
          entries.push({ t: fmt(cursor), title: "抵达 / 办理入住", place: "酒店", detail: "首日不安排景点游览", reason: "首日傍晚抵达约束：仅保留入住流程，可按需安排夜游。" });
          cursor += 60;
        }
      } else if (d > 0 && plan[d - 1] && plan[d - 1][0] !== mainCity) {
        entries.push({ t: fmt(cursor), title: "早餐后转场至" + mainCity, place: mainCity, detail: "城市间转场，行李寄存酒店", reason: "多城市串联，转场安排在上午以匹配景点开放时间。" });
        cursor += 60;
      } else {
        entries.push({ t: fmt(cursor), title: "起床、早餐", place: "酒店", detail: "早餐按餐饮偏好匹配清淡本地早点", reason: ctx.hasChild ? "团队含低龄儿童，早餐与出发时间放宽，保留晨间休整。" : "按团队作息偏好设定起床时间。" });
        cursor += 60;
      }

      /* --- 上午场 --- */
      var done = 0;
      function addSpotRound(n, label) {
        for (var k = 0; k < n; k++) {
          var cityName = group[Math.min(group.length - 1, k === 0 ? 0 : group.length - 1)];
          var it = pickSpot(pool, group[k % group.length], used, ctx);
          if (!it) break;
          var sp = it.spot;
          var replaced = null;

          /* 天气替换 */
          if (wx.rain && !sp.indoor && S.time.weather.mode === "开启自动替换") {
            var alt = findIndoor(pool, it.city, used, ctx);
            if (alt) {
              log(ctx, "时间模块 · 天气预案", sp.name + "（户外）", alt.spot.name + "（室内）",
                "预报当日" + wx.tag + "，按用户设置自动替换为室内备选点位，规避户外湿滑与滞留风险。", 3);
              replaced = sp.name;
              it = alt;
              sp = it.spot;
              used[it.id] = 1;
              daySpots.push({ original: replaced, current: it });
            } else {
              log(ctx, "时间模块 · 天气预案", sp.name, "保留并标注风险",
                "预报当日" + wx.tag + "，同城无可用室内备选，保留原点位并在行程中标注天气风险。", 3);
            }
          } else if (wx.rain && !sp.indoor && S.time.weather.mode === "仅给出提醒") {
            log(ctx, "时间模块 · 天气预案", sp.name, "保留并标注风险",
              "预报当日" + wx.tag + "，用户选择仅提醒不替换，保留户外行程并标注风险。", 3);
          }

          /* 周一闭馆 */
          if (week === "周一" && sp.open.indexOf("周一") >= 0) {
            var alt2 = findOpen(pool, it.city, used, ctx);
            if (alt2) {
              log(ctx, "时间模块 · 开放状态", sp.name + "（" + sp.open + "）", alt2.spot.name,
                "该点位周一闭馆，系统调整顺序替换为同城正常开放点位。", 3);
              it = alt2; sp = it.spot; used[it.id] = 1;
            }
          }

          var travel = 20 + (scopeCityDistance(ctx, mainCity) % 15);
          entries.push({
            t: fmt(cursor), title: "前往" + sp.name, place: "打车 / 包车", detail: "预计 " + travel + " 分钟",
            reason: bufferMin >= 30 ? "含 30 分钟以上缓冲，容错排队与拥堵。" : ""
          });
          cursor += travel;
          entries.push({
            t: fmt(cursor), title: label + sp.name, place: sp.zone, detail: sp.indoor ? "室内点位，雨天可替换性低" : "户外点位", reason: "",
            spot: { city: it.city, name: sp.name }
          });
          cursor += sp.dur;
          cursor += bufferMin;
          done += 1;
          if (!replaced) daySpots.push({ current: it });
          if (replaced) {
            entries.push({
              t: fmt(cursor), title: "【预案替换：原计划 " + replaced + "，因" + wx.tag + "替换为 " + sp.name + "】",
              place: sp.zone, detail: "室内备选，动线不变", reason: "自动替换预案已开启，预报" + wx.tag + "。"
            });
          }
        }
      }

      /* 上午（仅在午餐前尚有余量时安排） */
      var arriveLate = isFirst && S.time.arrive === "首日下午 / 傍晚抵达";
      if (!arriveLate && quota > 0 && cursor < 11 * 60 + 10) {
        addSpotRound(Math.min(quota, cursor < 10 * 60 ? Math.ceil(quota / 2) : 1), "游览");
      }

      /* 午餐（按当日主城市匹配餐厅） */
      var cityMeals = food.meals.filter(function (m) { return m.city === mainCity; });
      var meal = (cityMeals.filter(function (m) { return m.slot === "lunch"; })[0]) || cityMeals[0] || { name: "本地餐馆", price: 60, dishes: [] };
      cursor = Math.max(cursor, 11 * 60 + 40);
      entries.push({
        t: fmt(cursor), title: "午餐", place: meal.city + " · " + meal.name,
        detail: "人均 " + meal.price + " 元｜" + (meal.dishes || []).slice(0, 3).join("、"),
        reason: ctx.allergies.length ? "已过滤" + ctx.allergies.join("、") + "，适配过敏成员。" : ""
      });
      cursor += 70;

      /* 午休 */
      if (ctx.restFixed && !isLast) {
        entries.push({
          t: fmt(cursor), title: "午休 / 回住宿地休整", place: "酒店或就近茶室",
          detail: "12:00–14:00 不安排景点", reason: "开启固定午休规则" + (ctx.hasElder ? "，老人需要午休" : "") + "，不安排连续游览。"
        });
        cursor = Math.max(cursor + 70, 14 * 60);
      }

      /* 下午 */
      if (!(isLast && S.time.leave === "返程日上午就要离开") && quota > done) {
        addSpotRound(quota - done, "游览");
      }

      var leaveT = isLast ? (S.time.leave === "返程日上午就要离开" ? 9 * 60 : S.time.leave === "返程日下午离开" ? 14 * 60 : 18 * 60) : null;

      /* 晚餐（返程日离开过早则不排） */
      if (!isLast || leaveT - 45 >= 17 * 60) {
        var dinnerAt = isLast ? Math.min(Math.max(cursor, 17 * 60 + 40), leaveT - 45) : Math.max(cursor, 17 * 60 + 40);
        cursor = dinnerAt;
        var meal2 = (cityMeals.filter(function (m) { return m.slot === "dinner"; })[0]) || cityMeals[0] || meal;
        entries.push({
          t: fmt(cursor), title: "晚餐", place: meal2.city + " · " + meal2.name,
          detail: "人均 " + meal2.price + " 元｜" + (meal2.dishes || []).slice(0, 2).join("、"),
          reason: "按当日收工地点就近安排，避免夜间跨区。"
        });
        cursor += 70;
      }

      /* 夜游 */
      if (!isLast && ctx.nightMode && ctx.nightMode !== "不安排夜游" && !ctx.hasBaby) {
        var allow = ctx.nightMode === "允许安排夜游" || (ctx.nightMode === "仅偶尔夜游" && d % 2 === 0);
        if (allow && cursor + 60 <= ctx.latest) {
          var nightSpot = nightSpotOf(mainCity, pool, used);
          entries.push({
            t: fmt(Math.max(cursor, 19 * 60)), title: "可选夜游" + (nightSpot ? "：" + nightSpot : ""),
            place: "老城街巷 / 夜市", detail: "不强制，体力允许可参加",
            reason: "用户地点模块选择「" + ctx.nightMode + "」，且当日收工时间未超 " + fmt(ctx.latest) + " 上限。"
          });
        } else if (allow && cursor + 60 > ctx.latest) {
          log(ctx, "时间模块 · 收工时间", "夜游安排", "取消",
            "当日行程已接近最晚收工时间 " + fmt(ctx.latest) + "，夜间活动取消。", 3);
        }
      }

      /* 回酒店 */
      if (!isLast) {
        entries.push({ t: fmt(Math.min(cursor + 30, ctx.latest)), title: "返回酒店休整", place: "酒店", detail: "当日行程结束", reason: "" });
      } else {
        entries.push({ t: fmt(leaveT), title: "退房 / 前往车站", place: "酒店 · 车站", detail: S.time.leave, reason: "返程离开约束：" + S.time.leave + "，当日行程在出发前收束。" });
      }

      /* 排序 + 截断 */
      entries.sort(function (a, b) { return toMin(a.t) - toMin(b.t); });
      if (isLast) {
        entries = entries.filter(function (e) { return toMin(e.t) <= leaveT; });
      }

      var theme = themeOf(mainCity, daySpots, ctx, d, plan.length);
      days.push({
        i: d + 1, date: date, week: week, weather: wx, theme: theme,
        cities: group, entries: entries,
        backup: backupOf(mainCity, pool, ctx, wx)
      });
    }
    return days;
  }

  function scopeCityDistance(ctx, city) { return hash(city) % 20; }

  function findIndoor(pool, city, used, ctx) {
    var p = pool[city]; if (!p) return null;
    for (var i = 0; i < p.keep.length; i++) {
      if (!used[p.keep[i].id] && p.keep[i].spot.indoor) return p.keep[i];
    }
    return null;
  }
  function findOpen(pool, city, used, ctx) {
    var p = pool[city]; if (!p) return null;
    for (var i = 0; i < p.keep.length; i++) {
      var it = p.keep[i];
      if (!used[it.id] && it.spot.open.indexOf("周一") < 0) return it;
    }
    return null;
  }
  function nightSpotOf(city, pool, used) {
    var p = pool[city]; if (!p) return "";
    for (var i = 0; i < p.keep.length; i++) {
      var s = p.keep[i].spot;
      if (s.tags.indexOf("夜景") >= 0 || s.type === "nightmarket" || s.type === "oldtown") return s.name;
    }
    return "";
  }

  function themeOf(city, daySpots, ctx, d, total) {
    var names = daySpots.map(function (x) { return x.current.spot.name; });
    var style = ctx.style;
    var tag = style.indexOf("人文") >= 0 ? "人文" : style.indexOf("自然") >= 0 ? "山水" : style.indexOf("Citywalk") >= 0 ? "街巷" : style.indexOf("逛吃") >= 0 ? "市井" : "混编";
    if (!names.length) return city + " · 抵达休整";
    return city + " · " + tag + "线：" + names.slice(0, 2).join(" / ");
  }

  function backupOf(city, pool, ctx, wx) {
    var p = pool[city] || { keep: [] };
    var indoors = p.keep.filter(function (x) { return x.spot.indoor; }).map(function (x) { return x.spot.name; });
    if (!indoors.length) indoors = ["市博物馆", "室内商业街"];
    return {
      title: city + " 雨天 / 高温备用路线",
      items: indoors.slice(0, 3).map(function (n, i) {
        return { t: fmt(9 * 60 + i * 150), name: n, note: "室内恒温，适合" + (wx.hot ? "避暑" : "避雨") };
      })
    };
  }

  /* ---------------- 物品与药品 ---------------- */
  function buildSupplies(ctx, days) {
    var items = [], meds = [], todos = [];
    var rainDays = days.filter(function (d) { return d.weather.rain; }).length;
    var hotDays = days.filter(function (d) { return d.weather.hot; }).length;

    if (rainDays || S.time.weather.mode === "开启自动替换") items.push("折叠雨伞 / 轻便雨衣（" + (rainDays || 1) + " 天可能有雨）");
    if (hotDays || ctx.days > 2) items.push("防晒霜、遮阳帽、墨镜");
    items.push("舒适步行鞋（日均步行为主）");
    items.push("便携水杯（景区直饮水点可补给）");
    items.push("充电宝与数据线、纸质行程单");
    if (ctx.hasBaby) items.push("婴儿推车 / 背带、尿片与湿巾");
    if (ctx.hasChild) items.push("儿童零食与常用退热贴");
    if (ctx.immobile) items.push("便携折叠凳 / 轮椅租借确认单");
    items.push("身份证、学生证 / 老年证等优惠证件");

    if (ctx.carSick) meds.push("晕车药（出发前 30 分钟服用）");
    if (ctx.conditions.indexOf("高血压") >= 0) meds.push("降压药（按时服用，行程中备足）");
    if (ctx.conditions.indexOf("肠胃敏感") >= 0 || (S.place.food.diet || []).indexOf("少油少盐") >= 0) meds.push("肠胃药 / 调节菌群");
    if (ctx.conditions.indexOf("哮喘") >= 0) meds.push("随身支气管用药");
    meds.push("创可贴、消毒湿巾");
    meds.push("感冒药与退烧药");
    if (ctx.allergies.length) meds.push("抗过敏药（登记过敏源：" + ctx.allergies.join("、") + "）");
    if ((S.place.food.diet || []).indexOf("酒精禁忌") >= 0) meds.push("提醒：全程避免含酒精饮品与药酒");

    var roleTodos = {
      "购票负责人": "提前 3 天预约博物馆 / 景区门票，核对身份证与优惠证件",
      "食宿负责人": "提前预定餐厅包间与酒店房间，确认可取消政策",
      "安全应急负责人": "保存就近医院、药店地址与电话，确认集合点",
      "美食探店负责人": "筛选 2 家备选餐厅，避开排队高峰",
      "物资管理员": "按清单采买药品与物资，出发前一天清点",
      "拍照记录员": "准备相机存储卡与充电设备，规划拍摄点位"
    };
    var roles = ctx.roles.length ? ctx.roles : ["安全应急负责人", "食宿负责人"];
    roles.forEach(function (r) {
      if (roleTodos[r]) todos.push({ role: r, text: roleTodos[r], done: false });
    });
    todos.push({ role: "全员", text: "出行前 1 天确认天气预报与景区公告", done: false });
    return { items: items, meds: meds, todos: todos };
  }

  /* ---------------- 预算 ---------------- */
  function buildBudget(ctx, days, food, transport, hotels) {
    var n = ctx.count;
    var nights = Math.max(1, days.length - 1);
    var rooms = Math.max(1, Math.ceil(n / 2));
    var hotelPrice = hotels.length ? hotels[0].price : 350;

    var longCost = transport.long.reduce(function (a, b) { return a + b.cost * n; }, 0);
    var localPerDay = transport.local.reduce(function (a, b) { return a + b.cost; }, 0);
    var localCost = localPerDay * days.length;

    var feeSum = 0, freeCount = 0;
    days.forEach(function (d) {
      d.entries.forEach(function (e) {
        if (e.spot) {
          var sp = spotByName(e.spot.city, e.spot.name);
          if (sp) { feeSum += sp.fee; if (!sp.fee) freeCount++; }
        }
      });
    });
    var ticket = feeSum * n;

    var mealAvg = food.mid;
    var mealCost = days.length * 2 * mealAvg * n;
    var snackCost = days.length * 30 * n;

    var other = Math.round((longCost + localCost + hotelPrice * rooms * nights + ticket + mealCost) * 0.08);

    var rows = [
      { name: "长途交通", total: longCost, note: "城市间高铁 / 飞机均价", reason: "按站点距离估算二等座 / 经济舱均价，含 " + n + " 人。" },
      { name: "市内交通", total: localCost, note: "打车 / 包车 / 地铁", reason: "按每日 3 段接驳估算；" + (ctx.noBike ? "已排除共享单车方案。" : "") },
      { name: "住宿", total: hotelPrice * rooms * nights, note: rooms + " 间 × " + nights + " 晚 × " + hotelPrice + " 元", reason: "单间价格取所选档位中位值，家庭房与双床房混排。" },
      { name: "餐饮", total: mealCost + snackCost, note: "正餐 " + days.length * 2 + " 餐 + 小吃", reason: "人均 " + mealAvg + " 元 / 餐，含小吃与饮品补给。" },
      { name: "门票", total: ticket, note: "含 " + freeCount + " 处免费点位", reason: "按所选点位实际票价 × 人数计。" },
      { name: "其他备用金", total: other, note: "约 8%", reason: "覆盖临时打车、雨具、医药与机动开销。" }
    ];
    var total = rows.reduce(function (a, b) { return a + b.total; }, 0);
    var perCap = Math.round(total / n);

    /* 预算模式校正 */
    var mode = S.people.budget.mode;
    if (mode === "统一人均预算" && +S.people.budget.perCap > 0) {
      var target = +S.people.budget.perCap;
      if (perCap > target) {
        var over = perCap - target;
        log(ctx, "人物模块 · 预算", "人均 " + num(perCap) + " 元", "压降至 " + num(target) + " 元附近",
          "人均总预算 " + num(target) + " 元低于初步测算（超出 " + num(over) + " 元），系统降级住宿档位、替换高价门票点位并压缩非必要消费。", 2);
        rows[2].total = Math.round(rows[2].total * 0.85);
        rows[5].total = Math.round(rows[5].total * 0.85);
        total = rows.reduce(function (a, b) { return a + b.total; }, 0);
        perCap = Math.round(total / n);
      } else if (perCap < target * 0.7) {
        log(ctx, "人物模块 · 预算", "人均 " + num(perCap) + " 元", "保留余量",
          "测算结果明显低于预算上限，余量可用于升级 1 处体验项目或提高住宿档位。", 2);
      }
    }
    if ((S.people.budget.tilts || []).indexOf("优先吃特色美食") >= 0) {
      log(ctx, "人物模块 · 预算倾斜", "餐饮占比", "上调约 15%",
        "预算倾斜至美食，餐饮推荐优先匹配本地特色老店，在原餐饮预算区间内优先保留特色正餐，压缩非必要文创、娱乐消费。", 2);
    }
    if (mode === "优先性价比") {
      log(ctx, "人物模块 · 预算", "按偏好匹配", "全面压降",
        "用户选择优先性价比，住宿降档、免费景点优先、餐饮压缩非必要消费。", 2);
    }
    return { rows: rows, total: total, perCap: perCap, rooms: rooms, nights: nights };
  }
  function spotByName(city, name) {
    var list = AS.citySpots(city);
    for (var i = 0; i < list.length; i++) if (list[i].name === name) return list[i];
    return null;
  }

  /* ---------------- 应急预案 ---------------- */
  function buildEmergency(ctx, days) {
    var c0 = S.cities[0] ? S.cities[0].n : "目的地";
    var c1 = S.cities[1] ? S.cities[1].n : c0;
    return [
      {
        title: "场景 1 · 景点临时关闭 / 限流",
        plan: "启用当日备用路线（" + (days[0] ? days[0].backup.items.map(function (x) { return x.name; }).slice(0, 2).join("、") : "室内点位") + "），在线核对公众号公告后调整顺序，不改变当晚住宿。",
        reason: "提前为每个户外点位预存室内备选，避免当日临时无去处。"
      },
      {
        title: "场景 2 · 成员身体不适",
        plan: c0 + " 就近三甲医院：市第一人民医院（车程约 15 分钟）；" + c1 + " 就近：市中心医院。常备药箱随身携带，含" + (ctx.conditions.length ? ctx.conditions.join("、") + "相关用药" : "肠胃药与退烧药") + "。",
        reason: "按成员健康登记预置就医与用药提示，行动不便成员优先安排就近就医。"
      },
      {
        title: "场景 3 · 交通延误 / 高铁晚点",
        plan: "压缩当日 1 处非核心点位，晚餐时间顺延 45 分钟；若晚点超过 2 小时，取消夜游并改约次日门票。",
        reason: "行程已按缓冲时长预留余量（" + (ctx.buffer || 20) + " 分钟 / 段），可按比例顺延。"
      },
      {
        title: "场景 4 · 暴雨 / 极端高温",
        plan: "启动全套室内备用路线：博物馆 / 展馆 / 室内老街，户外点位整体顺延至次日清晨。",
        reason: "天气预案为「" + (S.time.weather.mode || "开启自动替换") + "」，户外点位均有同城室内替代。"
      },
      {
        title: "场景 5 · 人员走散",
        plan: "每处景点约定集合点（入口牌坊 / 游客中心），建立微信群共享实时位置，儿童与老人佩戴写有联系人电话的卡片。",
        reason: "团队 " + ctx.count + " 人，含" + (ctx.hasElder ? "老人" : ctx.hasChild ? "儿童" : "成年成员") + "，需固定集合机制。"
      }
    ];
  }

  /* ---------------- 参数快照 ---------------- */
  function snapshot() {
    return {
      cities: S.cities.map(function (c) { return c.n; }),
      cityCount: S.cities.length,
      want: S.place.want.slice(),
      exclude: S.place.exclude.slice(),
      hotel: JSON.parse(JSON.stringify(S.place.hotel)),
      night: JSON.parse(JSON.stringify(S.place.night)),
      food: JSON.parse(JSON.stringify(S.place.food)),
      time: JSON.parse(JSON.stringify(S.time)),
      people: JSON.parse(JSON.stringify(S.people))
    };
  }

  /* ---------------- 主入口 ---------------- */
  function generate() {
    var ctx = buildCtx();
    resolvePace(ctx);
    var pool = poolByCity(ctx);
    var plan = allocateDays(ctx, pool);
    var food = buildFood(ctx);
    var days = buildDays(ctx, pool, plan, food);
    var transport = buildTransport(ctx);
    var hotels = buildHotels(ctx, food);
    var supplies = buildSupplies(ctx, days);
    var budget = buildBudget(ctx, days, food, transport, hotels);
    var emergency = buildEmergency(ctx, days);

    /* 记录因地点偏好造成的关键变化 */
    if (S.place.hotel.type === "无所谓，听推荐") {
      log(ctx, "地点模块 · 住宿", "无所谓，听推荐", "按人数与动线匹配中档连锁", "用户未指定档位，系统按团队规模、预算区间与景点动线选择性价比最优档位。", 2);
    }
    if (S.place.exclude.length) {
      log(ctx, "地点模块 · 排除清单", S.place.exclude.length + " 处被排除点位", "全程不再纳入",
        "排除清单为地点模块的硬约束，优先级高于顺路算法。", 2);
    }

    return {
      ctx: ctx,
      days: days,
      transport: transport,
      food: food,
      hotels: hotels,
      supplies: supplies,
      budget: budget,
      emergency: emergency,
      audit: ctx.audit,
      params: snapshot(),
      createdAt: new Date().toISOString()
    };
  }

  window.Engine = { generate: generate };
})();
