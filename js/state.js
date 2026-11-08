/* ===========================================================
   state.js —— 全局状态、流程步骤定义、校验规则、持久化
   =========================================================== */
(function () {
  "use strict";

  var KEY = "shanhe_plan_v1";

  var S = {
    cities: [],            /* [{n:"杭州", prov:"浙江", ad:"330100"}] */
    place: {
      want: [], exclude: [],
      hotel: { type: "", locs: [], locNote: "", budget: { min: 200, max: 500, any: false }, reqs: [], note: "" },
      night: { plan: "", custom: "", note: "" },
      food: { style: "", spicy: "", budget: { min: 50, max: 150, any: false }, diet: [], dietNote: "", scenes: [], note: "" }
    },
    time: {
      start: "", end: "", arrive: "", leave: "",
      flags: [], note: "",
      pace: { wake: "", intensity: "", rest: "", latest: "21:00", note: "" },
      weather: { mode: "", prio: [], buffer: "", note: "" }
    },
    people: {
      count: "", tags: [], fitness: "", barriers: [], note: "",
      health: { allergies: [], allergyNote: "", conditions: [], meds: "", note: "" },
      social: { roles: [], style: "", limits: [], note: "" },
      budget: { mode: "", perCap: "", items: { transport: "", hotel: "", food: "", ticket: "" }, tilts: [], note: "" }
    },
    ui: { mapLevel: "nation", mapProv: null, tab: 0, musicOn: true },
    generated: null,
    checked: {}
  };

  /* ---------------- 步骤清单（严格对应框架链路） ---------------- */
  var STEPS = [
    { id: "spots", mod: "地点模块", no: "一", title: "想去景点", route: "#/place/spots" },
    { id: "exclude", mod: "地点模块", no: "二", title: "不想去景点", route: "#/place/exclude" },
    { id: "hotel", mod: "地点模块", no: "三", title: "住宿偏好", route: "#/place/hotel" },
    { id: "night", mod: "地点模块", no: "四", title: "夜游与风俗", route: "#/place/night" },
    { id: "dining", mod: "地点模块", no: "五", title: "餐饮美食", route: "#/place/dining" },
    { id: "date", mod: "时间模块", no: "一", title: "行程基础时间", route: "#/time/base" },
    { id: "pace", mod: "时间模块", no: "二", title: "作息与节奏", route: "#/time/pace" },
    { id: "weather", mod: "时间模块", no: "三", title: "天气与预案", route: "#/time/weather" },
    { id: "timeReview", mod: "时间模块", no: "四", title: "时间汇总确认", route: "#/time/review" },
    { id: "team", mod: "人物模块", no: "一", title: "团队基础信息", route: "#/people/team" },
    { id: "health", mod: "人物模块", no: "二", title: "饮食健康", route: "#/people/health" },
    { id: "roles", mod: "人物模块", no: "三", title: "分工与风格", route: "#/people/roles" },
    { id: "budget", mod: "人物模块", no: "四", title: "预算分配", route: "#/people/budget" },
    { id: "peopleReview", mod: "人物模块", no: "五", title: "人物汇总确认", route: "#/people/review" }
  ];

  var ROUTE_TO_STEP = {};
  STEPS.forEach(function (s) { ROUTE_TO_STEP[s.route.replace("#/", "")] = s.id; });

  function stepIndex(id) {
    for (var i = 0; i < STEPS.length; i++) if (STEPS[i].id === id) return i;
    return -1;
  }

  /* ---------------- 日期工具 ---------------- */
  function today() {
    var d = new Date();
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }
  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function parseDate(s) {
    if (!s) return null;
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) return null;
    var d = new Date(+m[1], +m[2] - 1, +m[3]);
    if (d.getFullYear() !== +m[1] || d.getMonth() !== +m[2] - 1 || d.getDate() !== +m[3]) return null;
    return d;
  }
  function dayDiff(a, b) {
    var d1 = parseDate(a), d2 = parseDate(b);
    if (!d1 || !d2) return 0;
    return Math.round((d2 - d1) / 86400000) + 1;
  }
  function addDays(s, n) {
    var d = parseDate(s); if (!d) return s;
    d.setDate(d.getDate() + n);
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }
  var WEEK = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  function weekdayOf(s) {
    var d = parseDate(s);
    return d ? WEEK[d.getDay()] : "";
  }

  /* ---------------- 校验 ---------------- */
  function need(cond, msg) { return { ok: !!cond, msg: cond ? "" : msg }; }

  var VALID = {
    spots: function () { return need(S.place.want.length > 0, "请至少选择一个想去的景点"); },
    exclude: function () { return need(true, ""); },
    hotel: function () { return need(!!S.place.hotel.type, "请选择住宿类型（必选）"); },
    night: function () { return need(!!S.place.night.plan, "请选择夜间出行规划（必选）"); },
    dining: function () { return need(!!S.place.food.style, "请选择美食体验倾向（必选）"); },
    date: function () {
      if (!S.time.start || !S.time.end) return need(false, "请补全出发日期与返程日期");
      if (!parseDate(S.time.start) || !parseDate(S.time.end)) return need(false, "日期格式不正确");
      if (parseDate(S.time.end) < parseDate(S.time.start)) return need(false, "返程日期不可早于出发日期");
      if (!S.time.arrive) return need(false, "请选择首日抵达约束（必选）");
      if (!S.time.leave) return need(false, "请选择返程离开约束（必选）");
      return need(true, "");
    },
    pace: function () {
      if (!S.time.pace.wake) return need(false, "请选择团队作息偏好（必选）");
      if (!S.time.pace.intensity) return need(false, "请选择整体行程松紧强度（必选）");
      if (!S.time.pace.rest) return need(false, "请选择午休安排规则（必选）");
      return need(true, "");
    },
    weather: function () {
      if (!S.time.weather.mode) return need(false, "请选择恶劣天气预案策略（必选）");
      if (!S.time.weather.buffer) return need(false, "请选择预留缓冲时长（必选）");
      return need(true, "");
    },
    timeReview: function () { return need(true, ""); },
    team: function () {
      if (!S.people.count || +S.people.count < 1) return need(false, "请填写团队总人数（不少于 1 人）");
      if (!S.people.tags.length) return need(false, "请选择团队成员人群标签");
      if (!S.people.fitness) return need(false, "请选择成员体力整体水平（必选）");
      return need(true, "");
    },
    health: function () { return need(true, ""); },
    roles: function () { return need(!!S.people.social.style, "请选择出行风格标签（必选）"); },
    budget: function () {
      if (!S.people.budget.mode) return need(false, "请选择预算模式（必选）");
      if (S.people.budget.mode === "unified") {
        var v = Number(S.people.budget.perCap);
        if (!v || v < 100) return need(false, "请填写人均总预算（不少于 100 元）");
      }
      if (S.people.budget.mode === "split") {
        var it = S.people.budget.items;
        if (!it.transport && !it.hotel && !it.food && !it.ticket) return need(false, "分项预算请至少填写一项");
      }
      return need(true, "");
    },
    peopleReview: function () { return need(true, ""); }
  };

  function canNext(id) {
    var fn = VALID[id];
    return fn ? fn() : { ok: true, msg: "" };
  }

  /* ---------------- 持久化 ---------------- */
  function save() {
    try {
      var data = {
        cities: S.cities, place: S.place, time: S.time, people: S.people,
        ui: S.ui, checked: S.checked, generated: S.generated
      };
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) { /* 隐私模式或被禁用时静默 */ }
  }
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return false;
      var d = JSON.parse(raw);
      if (!d || typeof d !== "object") return false;
      if (d.cities) S.cities = d.cities;
      if (d.place) deepAssign(S.place, d.place);
      if (d.time) deepAssign(S.time, d.time);
      if (d.people) deepAssign(S.people, d.people);
      if (d.ui) deepAssign(S.ui, d.ui);
      if (d.checked) S.checked = d.checked;
      if (d.generated) S.generated = d.generated;
      return !!(S.cities.length);
    } catch (e) { return false; }
  }
  function deepAssign(target, src) {
    Object.keys(src || {}).forEach(function (k) {
      var v = src[k];
      if (v && typeof v === "object" && !Array.isArray(v) && target[k] && typeof target[k] === "object" && !Array.isArray(target[k])) {
        deepAssign(target[k], v);
      } else if (v !== undefined) {
        target[k] = v;
      }
    });
    return target;
  }
  function reset() {
    try { localStorage.removeItem(KEY); } catch (e) { }
    S.cities = [];
    S.place = { want: [], exclude: [], hotel: { type: "", locs: [], locNote: "", budget: { min: 200, max: 500, any: false }, reqs: [], note: "" }, night: { plan: "", custom: "", note: "" }, food: { style: "", spicy: "", budget: { min: 50, max: 150, any: false }, diet: [], dietNote: "", scenes: [], note: "" } };
    S.time = { start: "", end: "", arrive: "", leave: "", flags: [], note: "", pace: { wake: "", intensity: "", rest: "", latest: "21:00", note: "" }, weather: { mode: "", prio: [], buffer: "", note: "" } };
    S.people = { count: "", tags: [], fitness: "", barriers: [], note: "", health: { allergies: [], allergyNote: "", conditions: [], meds: "", note: "" }, social: { roles: [], style: "", limits: [], note: "" }, budget: { mode: "", perCap: "", items: { transport: "", hotel: "", food: "", ticket: "" }, tilts: [], note: "" } };
    S.ui = { mapLevel: "nation", mapProv: null, tab: 0, musicOn: true };
    S.generated = null; S.checked = {};
  }

  /* ---------------- 城市数据访问 ---------------- */
  var SPOT = window.SPOT_BANK || {};
  var META = window.SPOT_META || {};
  var GENERIC = window.SPOT_GENERIC || [];

  function citySpots(cityName) {
    var rec = SPOT[cityName];
    if (rec && rec.s && rec.s.length) return rec.s.map(spotObj);
    return GENERIC.map(function (a) {
      var copy = a.slice();
      copy[0] = String(copy[0]).replace(/\{city\}/g, cityName);
      return spotObj(copy);
    });
  }
  function provOfCity(name) {
    for (var i = 0; i < S.cities.length; i++) if (S.cities[i].n === name) return S.cities[i].prov;
    return "";
  }
  function spotObj(a) {
    return { name: a[0], type: a[1], indoor: !!a[2], fee: a[3], dur: a[4], open: a[5], zone: a[6], tags: (a[7] || "").split(",").filter(Boolean) };
  }
  function spotObjWithCity(a, city) {
    var o = spotObj(a);
    o.genericCity = city;
    return o;
  }
  function dishes(cityName) {
    var rec = SPOT[cityName];
    if (rec && rec.f && rec.f.length) return rec.f;
    return ["本地家常菜", "街边小吃", "时令汤羹", "地方点心"];
  }
  function spotsByIds(ids) {
    var out = [];
    ids.forEach(function (id) {
      var p = id.split("::");
      var city = p[0], name = p[1];
      var list = citySpots(city);
      for (var i = 0; i < list.length; i++) {
        if (list[i].name === name) {
          var o = list[i];
          out.push({ city: city, spot: o, id: id });
          break;
        }
      }
    });
    return out;
  }
  function allSpotsOf(cities) {
    var out = [];
    cities.forEach(function (c) {
      citySpots(c.n).forEach(function (sp) {
        out.push({ id: c.n + "::" + sp.name, city: c.n, prov: c.prov, spot: sp });
      });
    });
    /* 稳定但可辨识的排序：按城市顺序、再按片区聚集 */
    out.sort(function (a, b) {
      if (a.city !== b.city) return 0;
      if (a.spot.zone === b.spot.zone) return 0;
      return a.spot.zone > b.spot.zone ? 1 : -1;
    });
    return out;
  }

  window.STATE = S;
  window.AppState = {
    S: S, STEPS: STEPS, stepIndex: stepIndex, routeToStep: ROUTE_TO_STEP,
    canNext: canNext, save: save, load: load, reset: reset,
    today: today, parseDate: parseDate, dayDiff: dayDiff, addDays: addDays, weekdayOf: weekdayOf,
    citySpots: citySpots, dishes: dishes, allSpotsOf: allSpotsOf, spotsByIds: spotsByIds,
    provOfCity: provOfCity
  };
})();
