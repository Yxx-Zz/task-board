/* global window, document, fetch, location, CSS */
"use strict";

/* =========================================================
   State
   ========================================================= */

const state = {
  today: "",
  date: "",
  members: [],
  tasks: [],
  revision: 0,
  route: { view: "board", date: null, memberId: null },
  loaded: false,
  loading: false,
  busy: false,
  online: true,
  selected: new Set(),
  compose: { title: "", time: "", priority: false },
  inlineDrafts: {},
  editTask: null,
  adminPassword: "",
  adminError: "",
  focusTarget: null,
  pendingToggles: new Set(),
  celebrated: new Set(),
  pollTimer: null,
  loadToken: 0,
};

const app = document.getElementById("app");
const toastRegion = document.getElementById("toast-region");
const modalRoot = document.getElementById("modal-root");
const confettiLayer = document.getElementById("confetti-layer");

const POLL_MS = 7000;
const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

/* =========================================================
   Tiny utilities
   ========================================================= */

function escapeHTML(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[char];
  });
}

function pad2(number) {
  return String(number).padStart(2, "0");
}

function dateToStr(date) {
  return date.getFullYear() + "-" + pad2(date.getMonth() + 1) + "-" + pad2(date.getDate());
}

function parseDateStr(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return null;
  const parts = value.split("-").map(Number);
  const date = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0, 0);
  if (date.getFullYear() !== parts[0] || date.getMonth() !== parts[1] - 1 || date.getDate() !== parts[2]) {
    return null;
  }
  return date;
}

function isDateStr(value) {
  return Boolean(parseDateStr(value));
}

function addDays(value, amount) {
  const date = parseDateStr(value) || new Date();
  date.setDate(date.getDate() + amount);
  return dateToStr(date);
}

function weekdayOf(value) {
  const date = parseDateStr(value);
  return date ? WEEKDAYS[date.getDay()] : "";
}

function formatDateShort(value) {
  const date = parseDateStr(value);
  if (!date) return value;
  return date.getMonth() + 1 + "月" + date.getDate() + "日";
}

function formatDateFull(value) {
  const date = parseDateStr(value);
  if (!date) return value;
  return date.getFullYear() + "年" + (date.getMonth() + 1) + "月" + date.getDate() + "日";
}

function relativeDate(value) {
  if (!state.today) return weekdayOf(value);
  if (value === state.today) return "今天";
  if (value === addDays(state.today, -1)) return "昨天";
  if (value === addDays(state.today, 1)) return "明天";
  return weekdayOf(value);
}

function isPast(value) {
  return Boolean(state.today) && value < state.today;
}

function isFuture(value) {
  return Boolean(state.today) && value > state.today;
}

function icon(name, className) {
  return (
    '<svg class="' +
    (className || "icon") +
    '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    (ICONS[name] || "") +
    "</svg>"
  );
}

function cssEscape(value) {
  if (window.CSS && typeof window.CSS.escape === "function") return window.CSS.escape(String(value));
  return String(value).replace(/["\\]/g, "\\$&");
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

const ICONS = {
  arrowLeft: '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>',
  chevronLeft: '<path d="m15 18-6-6 6-6"/>',
  chevronRight: '<path d="m9 18 6-6-6-6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3"/><path d="M1 14h6M9 8h6M17 16h6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  flag: '<path d="M5 21V4"/><path d="M5 4c4-3 8 3 14 0v10c-6 3-10-3-14 0"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/>',
  sparkle: '<path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z"/><path d="M19 16v4M17 18h4"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M10 11v6M14 11v6"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
  inbox: '<path d="M4 4h16v16H4z"/><path d="M4 13h4l2 3h4l2-3h4"/>',
  external: '<path d="M14 3h7v7"/><path d="M21 3 10 14"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  wifiOff: '<path d="M2 2l20 20"/><path d="M8.5 16.5a5 5 0 0 1 7 0"/><path d="M5 12.5a10 10 0 0 1 4-2.3"/><path d="M15 10.2a10 10 0 0 1 4 2.3"/><path d="M2 8.8a15 15 0 0 1 4-2.6"/><path d="M18 6.2a15 15 0 0 1 4 2.6"/><path d="M12 20h.01"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><path d="M12 14v3"/>',
};

/* =========================================================
   API + routing
   ========================================================= */

async function request(path, options) {
  const config = Object.assign({ cache: "no-store" }, options || {});
  const headers = Object.assign({}, config.headers || {});
  if (config.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  if (state.adminPassword && !headers["X-Admin-Password"]) {
    headers["X-Admin-Password"] = state.adminPassword;
  }
  config.headers = headers;
  const response = await fetch(path, config);
  let payload = null;
  const type = response.headers.get("content-type") || "";
  if (type.indexOf("application/json") !== -1) {
    payload = await response.json().catch(function () {
      return null;
    });
  }
  if (!response.ok) {
    const error = new Error(payload && payload.error ? payload.error : "请求失败（" + response.status + "）");
    error.status = response.status;
    if (response.status === 401 && path !== "/api/admin/check") {
      clearAdminSession();
      if (state.route.view === "admin") {
        state.adminError = "管理密码已失效，请重新输入。";
        window.setTimeout(function () {
          renderApp({ animate: false });
        }, 0);
      }
    }
    throw error;
  }
  return payload;
}

function fetchState(date) {
  return request("/api/state" + (date ? "?date=" + encodeURIComponent(date) : ""));
}

function clearAdminSession() {
  state.adminPassword = "";
  try {
    sessionStorage.removeItem("taskboard_admin_password");
  } catch (error) {
    /* ignore storage errors */
  }
}

async function loginAdmin(form) {
  const input = form.querySelector("[data-admin-password]");
  const password = input ? input.value.trim() : "";
  if (!password) {
    state.adminError = "请输入管理密码。";
    state.focusTarget = { kind: "admin" };
    renderApp({ animate: false });
    return;
  }
  const button = form.querySelector('button[type="submit"]');
  if (button) button.disabled = true;
  try {
    await request("/api/admin/check", {
      headers: { "X-Admin-Password": password },
    });
    state.adminPassword = password;
    state.adminError = "";
    try {
      sessionStorage.setItem("taskboard_admin_password", password);
    } catch (error) {
      /* ignore storage errors */
    }
    renderApp({ animate: true });
    toast("已进入管理员模式", "success");
  } catch (error) {
    if (button) button.disabled = false;
    state.adminPassword = "";
    state.adminError = error.status === 401 ? "密码不正确，请重试。" : error.message;
    state.focusTarget = { kind: "admin" };
    renderApp({ animate: false });
  }
}

function logoutAdmin() {
  clearAdminSession();
  state.adminError = "";
  navigate({ view: "board", date: state.date });
  toast("已退出管理员模式", "info");
}

async function exportTasks() {
  try {
    const response = await fetch("/api/export", {
      cache: "no-store",
      headers: { "X-Admin-Password": state.adminPassword },
    });
    if (response.status === 401) {
      clearAdminSession();
      state.adminError = "管理密码已失效，请重新输入。";
      renderApp({ animate: false });
      return;
    }
    if (!response.ok) {
      const payload = await response.json().catch(function () {
        return null;
      });
      throw new Error(payload && payload.error ? payload.error : "导出失败");
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "task-board-" + state.date + ".json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
    toast("备份已下载", "success");
  } catch (error) {
    toast("导出失败：" + error.message, "error");
  }
}

function parseRoute() {
  const raw = location.hash.replace(/^#\/?/, "");
  const parts = raw
    .split("/")
    .filter(Boolean)
    .map(function (part) {
      try {
        return decodeURIComponent(part);
      } catch (error) {
        return part;
      }
    });

  if (parts[0] === "member" && parts[1]) {
    return {
      view: "member",
      memberId: parts[1],
      date: isDateStr(parts[2]) ? parts[2] : null,
    };
  }
  if (parts[0] === "admin") {
    return { view: "admin", memberId: null, date: isDateStr(parts[1]) ? parts[1] : null };
  }
  if (parts[0] === "day" && isDateStr(parts[1])) {
    return { view: "board", memberId: null, date: parts[1] };
  }
  return { view: "board", memberId: null, date: null };
}

function hrefFor(view, date, memberId) {
  const day = date || state.today;
  const isToday = !state.today || day === state.today;
  if (view === "member") {
    return isToday ? "#/member/" + encodeURIComponent(memberId) : "#/member/" + encodeURIComponent(memberId) + "/" + day;
  }
  if (view === "admin") {
    return isToday ? "#/admin" : "#/admin/" + day;
  }
  return isToday ? "#/" : "#/day/" + day;
}

function navigate(route) {
  const href = hrefFor(route.view, route.date || state.today, route.memberId);
  if (location.hash === href || (href === "#/" && (location.hash === "" || location.hash === "#"))) {
    handleRoute();
    return;
  }
  location.hash = href;
}

async function handleRoute() {
  if (!state.loaded) return;
  const route = parseRoute();
  const date = route.date || state.today;
  const previousView = state.route.view;
  const previousMember = state.route.memberId;

  if (date !== state.date) {
    await loadDate(date, route);
    return;
  }

  state.route = route;
  if (route.view !== "admin") state.editTask = null;
  state.focusTarget = null;
  renderApp({ animate: true });
  if (route.view !== previousView || route.memberId !== previousMember) {
    window.scrollTo(0, 0);
  }
}

async function loadDate(date, route) {
  const token = ++state.loadToken;
  const previousRoute = state.route;
  const previousDate = state.date;
  state.route = route;
  state.loading = true;

  try {
    const data = await fetchState(date);
    if (token !== state.loadToken) return;
    state.loading = false;
    state.today = data.today;
    state.members = data.members || [];
    state.tasks = data.tasks || [];
    state.revision = data.revision;
    state.date = data.date;
    state.loaded = true;
    state.route = route;
    if (previousDate && previousDate !== data.date) resetComposeState();
    if (state.editTask && !state.tasks.some(function (task) {
      return task.id === state.editTask.id;
    })) {
      state.editTask = null;
    }
    renderApp({ animate: true });
    setSync(true);
    window.scrollTo(0, 0);
  } catch (error) {
    if (token !== state.loadToken) return;
    state.loading = false;
    if (!state.loaded) {
      renderFatal(error);
      return;
    }
    state.route = previousRoute;
    state.date = previousDate;
    setSync(false);
    renderApp({ animate: false });
    toast("加载失败：" + error.message, "error");
  }
}

function startPolling() {
  if (state.pollTimer) return;
  state.pollTimer = window.setInterval(poll, POLL_MS);
}

function isInteracting() {
  if (state.busy || state.loading || state.pendingToggles.size > 0) return true;
  if (state.editTask) return true;
  if (modalRoot.querySelector(".modal-backdrop")) return true;
  const active = document.activeElement;
  if (!active) return false;
  if (active.isContentEditable) return true;
  if (active.tagName === "TEXTAREA" || active.tagName === "SELECT") return true;
  if (active.tagName === "INPUT") {
    const type = String(active.getAttribute("type") || "text").toLowerCase();
    return ["text", "search", "url", "email", "password", "number", "tel", "date", "time"].indexOf(type) !== -1;
  }
  return false;
}

async function poll() {
  if (!state.loaded || document.hidden || isInteracting()) return;
  try {
    const data = await fetchState(state.date);
    if (data.date !== state.date) return;
    state.online = true;
    setSync(true);
    if (data.revision === state.revision) return;
    if (isInteracting()) return;
    state.today = data.today;
    state.members = data.members || state.members;
    state.tasks = data.tasks || [];
    state.revision = data.revision;
    if (state.editTask && !state.tasks.some(function (task) {
      return task.id === state.editTask.id;
    })) {
      state.editTask = null;
    }
    renderApp({ animate: false });
  } catch (error) {
    state.online = false;
    setSync(false);
  }
}

function setSync(online) {
  state.online = online;
  const chip = document.querySelector("[data-sync-chip]");
  if (!chip) return;
  chip.classList.toggle("is-offline", !online);
  const label = chip.querySelector("[data-sync-label]");
  if (label) label.textContent = online ? "自动同步" : "连接中断";
  chip.title = online ? "任务每 7 秒自动同步" : "暂时连不上服务，请检查任务板程序是否在运行";
}

/* =========================================================
   Data helpers
   ========================================================= */

function memberById(id) {
  return state.members.find(function (member) {
    return member.id === id;
  });
}

function tasksFor(memberId) {
  return state.tasks.filter(function (task) {
    return task.memberId === memberId;
  });
}

function statsFor(memberId) {
  const tasks = memberId ? tasksFor(memberId) : state.tasks;
  const done = tasks.filter(function (task) {
    return task.done;
  }).length;
  const total = tasks.length;
  return {
    tasks: tasks,
    total: total,
    done: done,
    pending: total - done,
    pct: total ? Math.round((done / total) * 100) : 0,
  };
}

function sortTasks() {
  state.tasks.sort(function (a, b) {
    const timeA = a.time || "99:99";
    const timeB = b.time || "99:99";
    if (timeA !== timeB) return timeA < timeB ? -1 : 1;
    const sortA = Number(a.sort || 0);
    const sortB = Number(b.sort || 0);
    if (sortA !== sortB) return sortA - sortB;
    return String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
  });
}

function resetComposeState() {
  state.selected.clear();
  state.compose = { title: "", time: "", priority: false };
  state.inlineDrafts = {};
  state.editTask = null;
}

function composePlaceholder() {
  if (state.selected.size === 0) return "先选择伙伴，再填写任务…";
  if (state.selected.size === 1) {
    const member = memberById(Array.from(state.selected)[0]);
    return member ? "给" + member.name + "安排一项任务…" : "填写任务内容…";
  }
  return "给 " + state.selected.size + " 位伙伴安排同一项任务…";
}

function memberNames(ids) {
  return ids
    .map(function (id) {
      const member = memberById(id);
      return member ? member.name : "";
    })
    .filter(Boolean);
}

/* =========================================================
   Shared markup
   ========================================================= */

function avatar(member, extraClass) {
  if (!member) return "";
  return (
    '<span class="avatar ' +
    (extraClass || "") +
    '" style="--accent:' +
    escapeHTML(member.accent) +
    ";--c1:" +
    escapeHTML(member.color1) +
    ";--c2:" +
    escapeHTML(member.color2) +
    '" aria-hidden="true">' +
    escapeHTML(member.letter) +
    "</span>"
  );
}

function memberStyle(member) {
  return (
    "--accent:" +
    escapeHTML(member.accent) +
    ";--c1:" +
    escapeHTML(member.color1) +
    ";--c2:" +
    escapeHTML(member.color2)
  );
}

function renderHeader() {
  const adminView = state.route.view === "admin";
  const actionHref = adminView ? hrefFor("board", state.date) : hrefFor("admin", state.date);
  return (
    '<header class="site-header">' +
    '<div class="header-inner">' +
    '<a class="brand" href="#/" aria-label="回到今日任务板">' +
    '<span class="brand-mark" aria-hidden="true">&lt;/&gt;</span>' +
    '<span class="brand-copy"><strong>教学组 · 任务板</strong><span class="brand-sub">TODAY, ONE TASK AT A TIME</span></span>' +
    "</a>" +
    '<div class="header-actions">' +
    '<span class="sync-chip" data-sync-chip title="任务每 7 秒自动同步">' +
    '<span class="sync-dot" aria-hidden="true"></span>' +
    '<span data-sync-label>自动同步</span>' +
    "</span>" +
    '<a class="btn btn-dark" href="' +
    actionHref +
    '">' +
    icon(adminView ? "arrowLeft" : "sliders") +
    '<span class="btn-label-long">' +
    (adminView ? "返回任务板" : "管理工作台") +
    "</span>" +
    '<span class="btn-label-short">' +
    (adminView ? "返回" : "管理") +
    "</span>" +
    "</a>" +
    "</div>" +
    "</div>" +
    "</header>"
  );
}

function renderFooter() {
  const adminView = state.route.view === "admin";
  const isCloud = /(^|\.)tcloudbase\.com$/i.test(location.hostname);
  return (
    '<footer class="site-footer">' +
    '<div class="footer-left"><span class="footer-code">' +
    (isCloud ? "CLOUD" : "LOCAL") +
    "</span><span>" +
    (isCloud ? "教学组内部任务板 · 数据保存在腾讯云" : "教学组内部任务板 · 数据保存在这台电脑上") +
    "</span></div>" +
    '<a class="footer-admin" href="' +
    (adminView ? hrefFor("board", state.date) : hrefFor("admin", state.date)) +
    '">' +
    (adminView ? "返回任务板" : "管理工作台") +
    " →</a>" +
    "</footer>"
  );
}

function renderDateNav() {
  const day = state.date;
  const relative = relativeDate(day);
  const weekday = weekdayOf(day);
  const sub = relative === weekday ? weekday : weekday + " · " + relative;
  return (
    '<div class="date-nav" aria-label="切换日期">' +
    '<button class="date-arrow" type="button" data-action="date-step" data-step="-1" aria-label="前一天">' +
    icon("chevronLeft") +
    "</button>" +
    '<label class="date-pill">' +
    '<input class="date-native" type="date" value="' +
    escapeHTML(day) +
    '" data-date-input aria-label="选择日期">' +
    '<span class="date-pill-main">' +
    escapeHTML(formatDateShort(day)) +
    "</span>" +
    '<span class="date-pill-sub">' +
    escapeHTML(sub) +
    "</span>" +
    "</label>" +
    '<button class="date-arrow" type="button" data-action="date-step" data-step="1" aria-label="后一天">' +
    icon("chevronRight") +
    "</button>" +
    (day !== state.today
      ? '<button class="today-jump" type="button" data-action="today">回到今天</button>'
      : "") +
    "</div>"
  );
}

/* =========================================================
   Board
   ========================================================= */

function renderMemberCard(member, index) {
  const stats = statsFor(member.id);
  const tasks = stats.tasks;
  const ordered = tasks
    .filter(function (task) {
      return !task.done;
    })
    .concat(
      tasks.filter(function (task) {
        return task.done;
      })
    );
  const preview = ordered.slice(0, 2);
  const more = Math.max(0, tasks.length - preview.length);

  let statusText = "待安排";
  let statusClass = "";
  if (stats.total > 0 && stats.pending === 0) {
    statusText = "已完成";
    statusClass = " is-done";
  } else if (stats.total > 0) {
    statusText = "进行中";
    statusClass = " is-active";
  }

  const previewHTML = preview.length
    ? preview
        .map(function (task) {
          return (
            '<span class="preview-task ' +
            (task.done ? "is-done" : "") +
            '"><span class="preview-dot"></span><span>' +
            escapeHTML(task.title) +
            "</span></span>"
          );
        })
        .join("") +
      (more > 0 ? '<span class="card-more">还有 ' + more + " 项…</span>" : "")
    : '<span class="preview-empty">' + icon("inbox") + "今天暂无任务</span>";

  const footText =
    stats.total === 0
      ? "等待任务发布"
      : stats.pending > 0
        ? "还有 " + stats.pending + " 项待完成"
        : "今日任务全部完成";

  return (
    '<a class="member-card ' +
    (stats.total > 0 && stats.pending === 0 ? "is-complete" : "") +
    '" href="' +
    hrefFor("member", state.date, member.id) +
    '" style="' +
    memberStyle(member) +
    ";--i:" +
    index +
    '" aria-label="查看' +
    escapeHTML(member.name) +
    "的任务，" +
    (stats.total === 0 ? "今天暂无任务" : "已完成 " + stats.done + " / " + stats.total) +
    '">' +
    '<div class="member-card-head">' +
    avatar(member) +
    '<div class="member-identity"><h3>' +
    escapeHTML(member.name) +
    "</h3><span class=\"member-role\"><span class=\"role-dot\"></span>" +
    escapeHTML(member.role) +
    "</span></div>" +
    '<span class="status-pill' +
    statusClass +
    '">' +
    statusText +
    "</span>" +
    "</div>" +
    '<div class="member-progress">' +
    '<div class="progress-meta"><span>今日进度</span><strong>' +
    stats.done +
    " / " +
    stats.total +
    "</strong></div>" +
    '<div class="track"><i data-progress="' +
    stats.pct +
    '" style="width:0"></i></div>' +
    "</div>" +
    '<div class="card-preview">' +
    previewHTML +
    "</div>" +
    '<div class="card-foot"><span>' +
    footText +
    '</span><span class="card-arrow">查看任务' +
    icon("chevronRight") +
    "</span></div>" +
    "</a>"
  );
}

function renderBoard() {
  const stats = statsFor(null);
  const isToday = state.date === state.today;
  const pct = stats.pct;
  let title;
  if (isToday) {
    title = '今天，把任务<br><span class="mark">一件件点亮</span>。';
  } else if (isPast(state.date)) {
    title = escapeHTML(formatDateShort(state.date)) + '，<br><span class="mark">完成了多少</span>？';
  } else {
    title = escapeHTML(formatDateShort(state.date)) + '，<br><span class="mark">提前看看安排</span>。';
  }

  let sub;
  if (stats.total === 0) {
    sub = isToday
      ? "今天的任务还没有发布。进入管理工作台，为伙伴们安排今天的第一项工作。"
      : "这一天还没有任务记录，可以切换日期，或回到今天看看。";
  } else if (isToday) {
    sub = "选一个名字，看看今天要完成什么。完成一项，就勾掉一项；所有进度会自动同步给全组。";
  } else if (isPast(state.date)) {
    sub = "正在查看这一天的任务记录。点击名字，可以回看每个人的完成情况。";
  } else {
    sub = "任务可以提前查看。完成情况会由负责的伙伴在当天勾选。";
  }

  return (
    '<div class="board-page">' +
    '<div class="page-top"><div class="eyebrow"><span class="live-dot"></span>TEAM MISSION / 每日任务</div>' +
    renderDateNav() +
    "</div>" +
    '<section class="hero">' +
    '<div class="hero-copy">' +
    "<h1>" +
    title +
    "</h1>" +
    '<p class="hero-sub">' +
    sub +
    "</p>" +
    '<div class="hero-tags">' +
    '<span class="hero-tag">' +
    icon("users") +
    state.members.length +
    " 位伙伴</span>" +
    '<span class="hero-tag">' +
    icon("list") +
    stats.total +
    " 项任务</span>" +
    (stats.total > 0
      ? '<span class="hero-tag">' + icon("check") + "已完成 " + stats.done + " 项</span>"
      : "") +
    '<span class="hero-tag">' + icon("sparkle") + "自动同步</span>" +
    "</div>" +
    "</div>" +
    '<div class="hero-side">' +
    '<div class="progress-ring" data-ring="' +
    pct +
    '" style="--value:0" role="img" aria-label="今日完成度 ' +
    pct +
    '%">' +
    '<div class="ring-center"><strong>' +
    pct +
    '<small>%</small></strong><span>今日完成</span></div>' +
    "</div>" +
    '<div class="hero-metrics">' +
    '<div class="hero-metric"><strong>' +
    stats.total +
    "</strong><span>今日任务</span></div>" +
    '<div class="hero-metric"><strong>' +
    stats.done +
    "</strong><span>已完成</span></div>" +
    "</div>" +
    "</div>" +
    "</section>" +
    '<div class="section-head"><h2 class="section-title">找到你的名字</h2><p class="section-note"><strong>' +
    state.members.length +
    "</strong> 位伙伴 · 点击卡片查看任务</p></div>" +
    '<div class="member-grid">' +
    state.members.map(renderMemberCard).join("") +
    "</div>" +
    (stats.total === 0
      ? '<div class="board-empty">' +
        '<span class="board-empty-icon">' +
        icon("inbox") +
        "</span>" +
        '<div class="board-empty-copy"><strong>今天的任务还是空的</strong><p>进入管理工作台，为伙伴们安排第一项工作。</p></div>' +
        '<a class="btn btn-soft btn-small" href="' +
        hrefFor("admin", state.date) +
        '">去安排任务' +
        icon("chevronRight") +
        "</a></div>"
      : "") +
    "</div>"
  );
}

/* =========================================================
   Member detail
   ========================================================= */

function taskMeta(task) {
  const parts = [];
  if (task.time) {
    parts.push('<span class="meta-time">' + icon("clock") + escapeHTML(task.time) + "</span>");
  }
  if (task.priority) {
    parts.push('<span class="task-flag">' + icon("flag") + "重点</span>");
  }
  return parts.length ? '<div class="task-detail">' + parts.join("") + "</div>" : "";
}

function renderTaskRow(task) {
  return (
    '<li class="task-row ' +
    (task.done ? "is-done" : "") +
    '" data-task-id="' +
    escapeHTML(task.id) +
    '">' +
    '<label class="task-label">' +
    '<input class="task-checkbox" type="checkbox" data-task-toggle data-task-id="' +
    escapeHTML(task.id) +
    '" ' +
    (task.done ? "checked " : "") +
    'aria-label="' +
    (task.done ? "标记为未完成：" : "标记为已完成：") +
    escapeHTML(task.title) +
    '">' +
    '<span class="check-box">' +
    icon("check") +
    "</span>" +
    '<span class="task-body"><span class="task-title">' +
    escapeHTML(task.title) +
    "</span>" +
    taskMeta(task) +
    "</span>" +
    "</label>" +
    "</li>"
  );
}

function renderMemberPage() {
  const member = memberById(state.route.memberId);
  if (!member) {
    return (
      '<div class="page-top"><a class="back-link" href="' +
      hrefFor("board", state.date) +
      '">' +
      icon("arrowLeft") +
      "返回任务板</a>" +
      renderDateNav() +
      "</div>" +
      '<div class="error-screen"><div class="error-mark">' +
      icon("users") +
      "</div><h1>没有找到这位伙伴</h1><p>链接里的成员可能不在这张任务板上，回到任务板重新选择吧。</p>" +
      '<a class="btn btn-primary" href="' +
      hrefFor("board", state.date) +
      '">回到任务板</a></div>'
    );
  }

  const stats = statsFor(member.id);
  const isToday = state.date === state.today;
  const allDone = stats.total > 0 && stats.pending === 0;
  let sub = "今天还没有安排任务，先喘口气。";
  if (stats.total > 0 && stats.pending === 0) sub = "全部完成，漂亮收工。";
  else if (stats.pending > 0) sub = "还有 " + stats.pending + " 项待完成，按自己的节奏来。";

  const panelTitle = isToday ? "今日任务" : "当日任务";
  const emptyTitle = isToday ? "今天还没有任务" : "这一天还没有任务";
  const emptyText = isToday
    ? "可以先休息一下，或提醒姜宇在管理工作台添加。"
    : "这一天没有任务记录，切换到其他日期看看吧。";

  return (
    '<div class="member-page">' +
    '<div class="member-topbar"><a class="back-link" href="' +
    hrefFor("board", state.date) +
    '">' +
    icon("arrowLeft") +
    "返回任务板</a>" +
    renderDateNav() +
    "</div>" +
    '<section class="profile-card" style="' +
    memberStyle(member) +
    '" data-letter="' +
    escapeHTML(member.letter) +
    '">' +
    avatar(member, "avatar-profile") +
    '<div class="profile-copy">' +
    '<span class="profile-role">' +
    (member.role === "教学主管" ? "教学主管 · TEAM LEAD" : "教学组 · 组员") +
    "</span>" +
    '<div class="profile-name-row"><h1>' +
    escapeHTML(member.name) +
    '</h1><span class="profile-date">' +
    escapeHTML(formatDateFull(state.date) + " " + weekdayOf(state.date)) +
    "</span></div>" +
    '<p class="profile-sub" data-profile-sub>' +
    sub +
    "</p>" +
    "</div>" +
    '<div class="profile-progress">' +
    '<div class="profile-ring" data-profile-ring data-ring="' +
    stats.pct +
    '" style="--value:0" role="img" aria-label="完成度 ' +
    stats.pct +
    '%">' +
    '<div class="profile-ring-center"><strong data-profile-pct>' +
    stats.pct +
    '%</strong><span>今日完成</span></div>' +
    "</div>" +
    '<div class="profile-stats">' +
    '<div class="profile-stat"><strong data-stat-total>' +
    stats.total +
    "</strong><span>全部任务</span></div>" +
    '<div class="profile-stat"><strong data-stat-done>' +
    stats.done +
    "</strong><span>已完成</span></div>" +
    '<div class="profile-stat"><strong data-stat-pending>' +
    stats.pending +
    "</strong><span>待完成</span></div>" +
    "</div>" +
    "</div>" +
    "</section>" +
    '<section class="tasks-panel">' +
    '<div class="tasks-panel-head">' +
    '<div class="tasks-panel-title">' +
    panelTitle +
    '<span class="title-count" data-panel-count>' +
    stats.total +
    "</span></div>" +
    '<span class="tasks-panel-note" data-panel-note>已完成 ' +
    stats.done +
    " / " +
    stats.total +
    "</span></div>" +
    (stats.tasks.length
      ? '<ul class="task-list">' + stats.tasks.map(renderTaskRow).join("") + "</ul>"
      : '<div class="empty-panel">' +
        '<div class="empty-illustration">' +
        icon("inbox") +
        "</div><h3>" +
        emptyTitle +
        "</h3><p>" +
        emptyText +
        '</p><a class="btn btn-primary btn-small" href="' +
        hrefFor("admin", state.date) +
        '">' +
        icon("plus") +
        "去添加任务</a></div>") +
    '<div class="all-done-banner" data-all-done ' +
    (allDone ? "" : "hidden") +
    '><div class="all-done-icon">' +
    icon("check") +
    '</div><div class="all-done-copy"><strong>全部完成，漂亮收工。</strong><span>每一项都勾掉了，记得给自己一点掌声。</span></div></div>' +
    "</section>" +
    "</div>"
  );
}

/* =========================================================
   Admin
   ========================================================= */

function renderPickChip(member) {
  const selected = state.selected.has(member.id);
  return (
    '<button class="pick-chip" type="button" data-pick-member="' +
    escapeHTML(member.id) +
    '" aria-pressed="' +
    (selected ? "true" : "false") +
    '" style="' +
    memberStyle(member) +
    '">' +
    avatar(member) +
    "<span>" +
    escapeHTML(member.name) +
    "</span>" +
    icon("check", "pick-check") +
    "</button>"
  );
}

function renderEditForm(task) {
  const edit = state.editTask;
  return (
    '<form class="task-edit" data-edit-form data-task-id="' +
    escapeHTML(task.id) +
    '">' +
    '<input class="task-edit-title" type="text" data-edit-title maxlength="200" value="' +
    escapeHTML(edit.title) +
    '" aria-label="任务内容">' +
    '<div class="task-edit-row">' +
    '<input type="time" data-edit-time value="' +
    escapeHTML(edit.time || "") +
    '" aria-label="任务时间">' +
    '<label class="task-edit-priority"><input type="checkbox" data-edit-priority ' +
    (edit.priority ? "checked" : "") +
    "> 重点</label>" +
    '<div class="task-edit-buttons">' +
    '<button class="edit-cancel" type="button" data-action="cancel-edit">取消</button>' +
    '<button class="edit-save" type="submit">保存</button>' +
    "</div>" +
    "</div>" +
    "</form>"
  );
}

function renderAdminTask(task) {
  if (state.editTask && state.editTask.id === task.id) {
    return '<div class="admin-task is-editing" data-task-id="' + escapeHTML(task.id) + '">' + renderEditForm(task) + "</div>";
  }
  const meta = taskMeta(task).replace('class="task-detail"', 'class="task-meta"');
  return (
    '<div class="admin-task ' +
    (task.done ? "is-done" : "") +
    '" data-task-id="' +
    escapeHTML(task.id) +
    '">' +
    '<button class="task-check" type="button" data-action="toggle-admin-task" data-task-id="' +
    escapeHTML(task.id) +
    '" aria-pressed="' +
    (task.done ? "true" : "false") +
    '" aria-label="' +
    (task.done ? "标记为未完成：" : "标记为已完成：") +
    escapeHTML(task.title) +
    '">' +
    icon("check") +
    "</button>" +
    '<div class="admin-task-main"><span class="admin-task-title">' +
    escapeHTML(task.title) +
    "</span>" +
    meta +
    "</div>" +
    '<div class="admin-task-actions">' +
    '<button class="icon-mini" type="button" data-action="edit-task" data-task-id="' +
    escapeHTML(task.id) +
    '" title="编辑任务" aria-label="编辑任务">' +
    icon("edit") +
    "</button>" +
    '<button class="icon-mini is-danger" type="button" data-action="delete-task" data-task-id="' +
    escapeHTML(task.id) +
    '" title="删除任务" aria-label="删除任务">' +
    icon("trash") +
    "</button>" +
    "</div>" +
    "</div>"
  );
}

function renderAdminMember(member) {
  const stats = statsFor(member.id);
  const draft = state.inlineDrafts[member.id] || "";
  return (
    '<article class="admin-member" style="' +
    memberStyle(member) +
    '" data-member-panel="' +
    escapeHTML(member.id) +
    '">' +
    '<div class="admin-member-head">' +
    avatar(member) +
    '<div class="admin-member-info"><div class="admin-member-name"><strong>' +
    escapeHTML(member.name) +
    '</strong><a href="' +
    hrefFor("member", state.date, member.id) +
    '" title="查看' +
    escapeHTML(member.name) +
    '的任务页" aria-label="查看' +
    escapeHTML(member.name) +
    '的任务页">' +
    icon("external") +
    "</a></div>" +
    '<div class="admin-member-count">' +
    (stats.total ? "已完成 " + stats.done + " / " + stats.total : "等待安排") +
    "</div></div>" +
    '<span class="admin-member-count">' +
    stats.pct +
    "%</span>" +
    "</div>" +
    '<div class="mini-track"><i data-progress="' +
    stats.pct +
    '" style="width:0"></i></div>' +
    '<div class="admin-task-list">' +
    (stats.tasks.length
      ? stats.tasks.map(renderAdminTask).join("")
      : '<div class="admin-empty">在下方输入框添加第一项任务。</div>') +
    "</div>" +
    '<form class="inline-add" data-inline-add data-member-id="' +
    escapeHTML(member.id) +
    '">' +
    '<input type="text" maxlength="200" data-inline-input data-member-id="' +
    escapeHTML(member.id) +
    '" value="' +
    escapeHTML(draft) +
    '" placeholder="给' +
    escapeHTML(member.name) +
    '添加任务…" aria-label="给' +
    escapeHTML(member.name) +
    '添加任务">' +
    '<button type="submit" aria-label="添加任务">' +
    icon("plus") +
    "</button>" +
    "</form>" +
    "</article>"
  );
}

function renderAdminGate() {
  return (
    '<div class="admin-gate">' +
    '<div class="gate-card">' +
    '<div class="gate-icon">' +
    icon("lock") +
    "</div>" +
    '<div class="eyebrow">ADMIN ONLY / 管理员入口</div>' +
    "<h1>管理工作台</h1>" +
    "<p>这里可以添加、修改、删除任务。请输入管理密码。</p>" +
    '<form class="gate-form" data-admin-login novalidate>' +
    '<input type="password" data-admin-password maxlength="64" placeholder="请输入管理密码" autocomplete="current-password" aria-label="管理密码" autofocus>' +
    '<button class="btn btn-primary" type="submit">' +
    icon("lock") +
    "进入管理</button>" +
    "</form>" +
    '<div class="form-error ' +
    (state.adminError ? "is-visible" : "") +
    '" data-admin-error role="alert">' +
    escapeHTML(state.adminError) +
    "</div>" +
    '<a class="back-link" href="' +
    hrefFor("board", state.date) +
    '">' +
    icon("arrowLeft") +
    "组员请返回任务板</a>" +
    "</div></div>"
  );
}

function renderAdmin() {
  if (!state.adminPassword) return renderAdminGate();
  const stats = statsFor(null);
  const nextDate = addDays(state.date, 1);
  return (
    '<div class="admin-page">' +
    '<div class="page-top"><div class="eyebrow"><span class="live-dot"></span>MANAGEMENT / 任务编排</div>' +
    renderDateNav() +
    "</div>" +
    '<div class="page-head">' +
    '<div class="page-head-copy"><div class="eyebrow">WORKSPACE · 管理员模式</div><h1>管理工作台</h1>' +
    "<p>为伙伴们安排 <strong>" +
    escapeHTML(formatDateFull(state.date)) +
    "</strong> 的工作。保存后，组员打开链接或等待几秒即可看到更新。</p></div>" +
    '<div class="admin-tools">' +
    '<button class="btn btn-ghost" type="button" data-action="copy-tasks" ' +
    (stats.total === 0 ? "disabled" : "") +
    ">" +
    icon("copy") +
    "复制到次日</button>" +
    '<button class="btn btn-ghost" type="button" data-action="export-tasks">' +
    icon("download") +
    "导出备份</button>" +
    '<button class="btn btn-soft" type="button" data-action="admin-logout">' +
    icon("lock") +
    "退出管理</button>" +
    "</div></div>" +
    '<section class="compose-card">' +
    '<div class="compose-top"><div><div class="compose-title-row"><span class="compose-step">01</span><h2 class="compose-title">安排任务</h2></div>' +
    '<p class="compose-sub">先选择伙伴，可以多选，一次把同一件事安排给多位伙伴。</p></div>' +
    '<span class="compose-badge">' +
    icon("sparkle") +
    "保存后自动同步</span></div>" +
    '<form data-compose-form novalidate>' +
    '<div class="member-picker">' +
    state.members.map(renderPickChip).join("") +
    "</div>" +
    '<div class="compose-main">' +
    '<input class="compose-input" type="text" data-compose-input maxlength="200" value="' +
    escapeHTML(state.compose.title) +
    '" placeholder="' +
    escapeHTML(composePlaceholder()) +
    '" aria-label="任务内容">' +
    '<div class="compose-controls">' +
    '<label class="time-field">' +
    icon("clock") +
    '<span class="field-label">时间</span>' +
    '<input type="time" data-compose-time value="' +
    escapeHTML(state.compose.time) +
    '" aria-label="任务时间（可选）">' +
    "</label>" +
    '<button class="priority-toggle" type="button" data-action="toggle-priority" aria-pressed="' +
    (state.compose.priority ? "true" : "false") +
    '">' +
    icon("flag") +
    "重点任务</button>" +
    '<button class="btn btn-primary compose-submit" type="submit">' +
    icon("plus") +
    "添加任务</button>" +
    "</div>" +
    '<div class="form-error" data-compose-error role="alert"></div>' +
    '<p class="compose-hint">' +
    icon("info") +
    "勾选多位伙伴，可以把同一条任务一次性发给大家；不填时间也可以。</p>" +
    "</div>" +
    "</form>" +
    "</section>" +
    '<div class="admin-summary">' +
    '<span class="admin-summary-chip"><strong>' +
    stats.total +
    "</strong> 项任务</span>" +
    '<span class="admin-summary-chip">已完成 <strong>' +
    stats.done +
    "</strong></span>" +
    '<span class="admin-summary-chip">待完成 <strong>' +
    stats.pending +
    "</strong></span>" +
    '<span class="admin-summary-chip">' +
    icon("sparkle") +
    "组员勾选后自动同步</span>" +
    "</div>" +
    '<div class="admin-grid">' +
    state.members.map(renderAdminMember).join("") +
    "</div>" +
    "</div>"
  );
}

/* =========================================================
   App render
   ========================================================= */

function renderApp(options) {
  const animate = Boolean(options && options.animate);
  let content;
  if (state.route.view === "admin") {
    content = renderAdmin();
  } else if (state.route.view === "member") {
    content = renderMemberPage();
  } else {
    content = renderBoard();
  }

  const title =
    state.route.view === "admin"
      ? "管理工作台 · 教学组"
      : state.route.view === "member"
        ? (memberById(state.route.memberId) || { name: "伙伴" }).name + "的任务 · 教学组"
        : "今日任务板 · 教学组";
  document.title = title;

  app.innerHTML =
    renderHeader() +
    '<main id="main" class="site-shell"><div class="' +
    (animate ? "view-enter" : "") +
    '">' +
    content +
    "</div></main>" +
    renderFooter();

  afterRender();
}

function afterRender() {
  const header = document.querySelector(".site-header");
  if (header) header.classList.toggle("is-scrolled", window.scrollY > 8);

  window.requestAnimationFrame(function () {
    document.querySelectorAll("[data-progress]").forEach(function (el) {
      el.style.width = clamp(Number(el.dataset.progress || 0), 0, 100) + "%";
    });
    document.querySelectorAll("[data-ring]").forEach(function (el) {
      el.style.setProperty("--value", String(clamp(Number(el.dataset.ring || 0), 0, 100)));
    });
  });

  if (state.focusTarget) {
    const target = state.focusTarget;
    state.focusTarget = null;
    window.setTimeout(function () {
      let el = null;
      if (target.kind === "compose") el = document.querySelector("[data-compose-input]");
      if (target.kind === "inline") {
        const form = document.querySelector('.inline-add[data-member-id="' + cssEscape(target.memberId) + '"]');
        el = form ? form.querySelector("input") : null;
      }
      if (target.kind === "edit") el = document.querySelector("[data-edit-title]");
      if (target.kind === "admin") el = document.querySelector("[data-admin-password]");
      if (el) {
        el.focus();
        if (target.kind === "edit" && typeof el.select === "function") el.select();
      }
    }, 35);
  }
}

function renderFatal(error) {
  const fileMode = location.protocol === "file:";
  const title = fileMode ? "请通过任务板程序打开" : "暂时连不上任务板";
  const message = fileMode
    ? "不要直接双击 index.html。请双击项目里的「启动任务板.bat」，等窗口显示启动成功后，再打开浏览器里的地址。"
    : "请刷新页面重试；如果一直打不开，请联系姜宇检查任务板服务。";
  app.innerHTML =
    '<div class="error-screen"><div class="error-mark">' +
    icon(fileMode ? "info" : "wifiOff") +
    "</div><h1>" +
    title +
    "</h1><p>" +
    message +
    '</p><button class="btn btn-primary" type="button" data-action="retry">重新连接</button>' +
    '<div class="error-code">' +
    escapeHTML(error && error.message ? error.message : "无法连接服务") +
    "</div></div>";
}

/* =========================================================
   Member selection, task creation
   ========================================================= */

function clearComposeError() {
  const box = document.querySelector("[data-compose-error]");
  if (!box) return;
  box.classList.remove("is-visible");
  box.textContent = "";
}

function showComposeError(message) {
  const box = document.querySelector("[data-compose-error]");
  if (!box) {
    toast(message, "error");
    return;
  }
  box.textContent = message;
  box.classList.add("is-visible");
}

function updateComposePlaceholder() {
  const input = document.querySelector("[data-compose-input]");
  if (input) input.placeholder = composePlaceholder();
}

function toggleMemberSelection(button) {
  const id = button.dataset.pickMember;
  if (!id) return;
  if (state.selected.has(id)) state.selected.delete(id);
  else state.selected.add(id);
  const pressed = state.selected.has(id);
  button.setAttribute("aria-pressed", pressed ? "true" : "false");
  clearComposeError();
  updateComposePlaceholder();
}

async function createTasks(form) {
  if (state.busy) return;
  const title = state.compose.title.trim();
  if (state.selected.size === 0) {
    showComposeError("先选择至少一位伙伴，再添加任务。");
    const firstChip = document.querySelector(".pick-chip");
    if (firstChip) firstChip.focus();
    return;
  }
  if (!title) {
    showComposeError("任务内容不能为空，写一句具体要做的事吧。");
    const input = form.querySelector("[data-compose-input]");
    if (input) input.focus();
    return;
  }

  const submit = form.querySelector('button[type="submit"]');
  state.busy = true;
  if (submit) submit.disabled = true;
  clearComposeError();

  const memberIds = Array.from(state.selected);
  const targetDate = state.date;
  try {
    const data = await request("/api/tasks", {
      method: "POST",
      body: JSON.stringify({
        date: targetDate,
        memberIds: memberIds,
        title: title,
        time: state.compose.time,
        priority: state.compose.priority,
      }),
    });
    if (state.date === targetDate) {
      (data.tasks || []).forEach(function (task) {
        if (!state.tasks.some(function (existing) { return existing.id === task.id; })) {
          state.tasks.push(task);
        }
      });
      sortTasks();
    }
    const names = memberNames(memberIds);
    state.compose.title = "";
    state.compose.time = "";
    state.compose.priority = false;
    state.busy = false;
    if (state.date === targetDate) {
      state.focusTarget = { kind: "compose" };
      renderApp({ animate: false });
    }
    toast("已为" + names.slice(0, 3).join("、") + (names.length > 3 ? "等" : "") + " 添加 " + (data.tasks || []).length + " 项任务", "success");
  } catch (error) {
    state.busy = false;
    if (submit) submit.disabled = false;
    showComposeError(error.message);
  }
}

async function addInlineTask(form) {
  if (state.busy) return;
  const memberId = form.dataset.memberId;
  const input = form.querySelector("input");
  const member = memberById(memberId);
  const title = input ? input.value.trim() : "";
  if (!title) {
    if (input) input.focus();
    return;
  }

  const button = form.querySelector('button[type="submit"]');
  const targetDate = state.date;
  state.busy = true;
  if (button) button.disabled = true;
  try {
    const data = await request("/api/tasks", {
      method: "POST",
      body: JSON.stringify({
        date: targetDate,
        memberIds: [memberId],
        title: title,
        time: "",
        priority: false,
      }),
    });
    if (state.date === targetDate) {
      (data.tasks || []).forEach(function (task) {
        if (!state.tasks.some(function (existing) { return existing.id === task.id; })) {
          state.tasks.push(task);
        }
      });
      sortTasks();
    }
    state.inlineDrafts[memberId] = "";
    state.busy = false;
    if (state.date === targetDate) {
      state.focusTarget = { kind: "inline", memberId: memberId };
      renderApp({ animate: false });
    }
    toast("已给" + (member ? member.name : "伙伴") + "添加任务", "success");
  } catch (error) {
    state.busy = false;
    if (button) button.disabled = false;
    toast(error.message, "error");
  }
}

/* =========================================================
   Toggle / edit / delete / copy
   ========================================================= */

function applyTaskDom(task) {
  const id = cssEscape(task.id);
  const row = document.querySelector('.task-row[data-task-id="' + id + '"]');
  if (row) {
    row.classList.toggle("is-done", Boolean(task.done));
    const input = row.querySelector("[data-task-toggle]");
    if (input) {
      input.checked = Boolean(task.done);
      input.setAttribute("aria-label", (task.done ? "标记为未完成：" : "标记为已完成：") + task.title);
    }
  }
  const adminRow = document.querySelector('.admin-task[data-task-id="' + id + '"]');
  if (adminRow) {
    adminRow.classList.toggle("is-done", Boolean(task.done));
    const button = adminRow.querySelector('[data-action="toggle-admin-task"]');
    if (button) {
      button.setAttribute("aria-pressed", task.done ? "true" : "false");
      button.setAttribute("aria-label", (task.done ? "标记为未完成：" : "标记为已完成：") + task.title);
    }
  }
}

function updateMemberStats(memberId, options) {
  const member = memberById(memberId);
  if (!member) return;
  const stats = statsFor(memberId);
  const pct = stats.pct;

  const ring = document.querySelector("[data-profile-ring]");
  if (ring) {
    ring.dataset.ring = String(pct);
    ring.style.setProperty("--value", String(pct));
  }
  const pctEl = document.querySelector("[data-profile-pct]");
  if (pctEl) pctEl.textContent = pct + "%";
  const totalEl = document.querySelector("[data-stat-total]");
  if (totalEl) totalEl.textContent = String(stats.total);
  const doneEl = document.querySelector("[data-stat-done]");
  if (doneEl) doneEl.textContent = String(stats.done);
  const pendingEl = document.querySelector("[data-stat-pending]");
  if (pendingEl) pendingEl.textContent = String(stats.pending);
  const countEl = document.querySelector("[data-panel-count]");
  if (countEl) countEl.textContent = String(stats.total);
  const noteEl = document.querySelector("[data-panel-note]");
  if (noteEl) noteEl.textContent = "已完成 " + stats.done + " / " + stats.total;
  const subEl = document.querySelector("[data-profile-sub]");
  if (subEl) {
    if (stats.total === 0) subEl.textContent = "今天还没有安排任务，先喘口气。";
    else if (stats.pending === 0) subEl.textContent = "全部完成，漂亮收工。";
    else subEl.textContent = "还有 " + stats.pending + " 项待完成，按自己的节奏来。";
  }
  const banner = document.querySelector("[data-all-done]");
  const allDone = stats.total > 0 && stats.pending === 0;
  if (banner) banner.hidden = !allDone;

  if (allDone && options && options.celebrate) {
    const key = memberId + ":" + state.date;
    if (!state.celebrated.has(key)) {
      state.celebrated.add(key);
      celebrate();
      toast("全部完成，漂亮收工！", "success");
    }
  }
}

async function toggleTask(taskId, done, context, checkbox) {
  const task = state.tasks.find(function (item) {
    return item.id === taskId;
  });
  if (!task) return;
  if (state.pendingToggles.has(taskId)) {
    if (checkbox) checkbox.checked = Boolean(task.done);
    return;
  }

  const previousDone = task.done;
  const previousCompleted = task.completedAt;
  state.pendingToggles.add(taskId);
  task.done = done;
  task.completedAt = done ? new Date().toISOString() : null;
  applyTaskDom(task);
  if (context === "member") updateMemberStats(task.memberId);

  try {
    const data = await request("/api/tasks/" + encodeURIComponent(taskId), {
      method: "PATCH",
      body: JSON.stringify({ done: done }),
    });
    Object.assign(task, data.task);
    applyTaskDom(task);
    if (context === "member") {
      updateMemberStats(task.memberId, { celebrate: done });
    } else {
      renderApp({ animate: false });
    }
  } catch (error) {
    task.done = previousDone;
    task.completedAt = previousCompleted;
    applyTaskDom(task);
    if (context === "member") updateMemberStats(task.memberId);
    else renderApp({ animate: false });
    toast("勾选失败：" + error.message, "error");
  } finally {
    state.pendingToggles.delete(taskId);
  }
}

function openEditTask(taskId) {
  const task = state.tasks.find(function (item) {
    return item.id === taskId;
  });
  if (!task) return;
  state.editTask = {
    id: task.id,
    title: task.title,
    time: task.time || "",
    priority: Boolean(task.priority),
  };
  state.focusTarget = { kind: "edit" };
  renderApp({ animate: false });
}

async function saveEditTask(form) {
  if (state.busy || !state.editTask) return;
  const taskId = state.editTask.id;
  const title = state.editTask.title.trim();
  if (!title) {
    toast("任务内容不能为空", "error");
    const input = document.querySelector("[data-edit-title]");
    if (input) input.focus();
    return;
  }
  state.busy = true;
  try {
    const data = await request("/api/tasks/" + encodeURIComponent(taskId), {
      method: "PATCH",
      body: JSON.stringify({
        title: title,
        time: state.editTask.time,
        priority: state.editTask.priority,
      }),
    });
    const task = state.tasks.find(function (item) {
      return item.id === taskId;
    });
    if (task) Object.assign(task, data.task);
    state.editTask = null;
    state.busy = false;
    renderApp({ animate: false });
    toast("任务已更新", "success");
  } catch (error) {
    state.busy = false;
    toast(error.message, "error");
  }
}

async function deleteTask(taskId) {
  const task = state.tasks.find(function (item) {
    return item.id === taskId;
  });
  if (!task) return;
  const confirmed = await openConfirm({
    kicker: "DELETE",
    title: "删除这项任务？",
    message: "「" + task.title + "」会从 " + formatDateShort(task.date) + " 的任务中移除，删除后无法恢复。",
    confirmText: "删除任务",
    danger: true,
  });
  if (!confirmed || state.busy) return;

  state.busy = true;
  try {
    const data = await request("/api/tasks/" + encodeURIComponent(taskId), { method: "DELETE" });
    state.tasks = state.tasks.filter(function (item) {
      return item.id !== taskId;
    });
    if (state.editTask && state.editTask.id === taskId) state.editTask = null;
    state.busy = false;
    renderApp({ animate: false });
    toast("任务已删除", "success");
  } catch (error) {
    state.busy = false;
    toast(error.message, "error");
  }
}

async function copyTasksToNextDay() {
  if (state.busy) return;
  if (state.tasks.length === 0) {
    toast("这一天还没有任务可以复制", "info");
    return;
  }
  const target = addDays(state.date, 1);
  const confirmed = await openConfirm({
    kicker: "COPY",
    title: "复制到 " + formatDateShort(target) + "？",
    message: "会把 " + formatDateShort(state.date) + " 的 " + state.tasks.length + " 项任务复制到 " + formatDateShort(target) + "，复制出的任务都是未完成状态。目标日期已有任务时，会追加而不是覆盖。",
    confirmText: "复制过去",
    danger: false,
  });
  if (!confirmed || state.busy) return;

  state.busy = true;
  try {
    const data = await request("/api/tasks/copy", {
      method: "POST",
      body: JSON.stringify({ fromDate: state.date, toDate: target }),
    });
    state.busy = false;
    toast("已复制 " + data.count + " 项任务到 " + formatDateShort(target), "success");
  } catch (error) {
    state.busy = false;
    toast(error.message, "error");
  }
}

/* =========================================================
   Confirm modal / toast / confetti
   ========================================================= */

function openConfirm(config) {
  return new Promise(function (resolve) {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const id = "confirm-title-" + Date.now();
    modalRoot.innerHTML =
      '<div class="modal-backdrop" data-modal-backdrop>' +
      '<div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="' +
      id +
      '">' +
      '<div class="modal-kicker">' +
      escapeHTML(config.kicker || "请确认") +
      "</div>" +
      '<h3 id="' +
      id +
      '">' +
      escapeHTML(config.title || "确认操作") +
      "</h3>" +
      "<p>" +
      escapeHTML(config.message || "") +
      "</p>" +
      '<div class="modal-actions">' +
      '<button class="btn btn-ghost btn-small" type="button" data-modal-cancel>取消</button>' +
      '<button class="btn ' +
      (config.danger ? "btn-danger" : "btn-dark") +
      ' btn-small" type="button" data-modal-confirm>' +
      escapeHTML(config.confirmText || "确定") +
      "</button>" +
      "</div></div></div>";

    const backdrop = modalRoot.querySelector("[data-modal-backdrop]");
    const cancelButton = modalRoot.querySelector("[data-modal-cancel]");
    const confirmButton = modalRoot.querySelector("[data-modal-confirm]");

    function finish(value) {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      modalRoot.innerHTML = "";
      resolve(value);
    }

    function onKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        finish(false);
      }
    }

    cancelButton.addEventListener("click", function () {
      finish(false);
    });
    confirmButton.addEventListener("click", function () {
      finish(true);
    });
    backdrop.addEventListener("click", function (event) {
      if (event.target === backdrop) finish(false);
    });
    document.addEventListener("keydown", onKeyDown);
    window.setTimeout(function () {
      if (cancelButton.isConnected) cancelButton.focus();
    }, 20);
  });
}

function toast(message, type) {
  if (!toastRegion) return;
  while (toastRegion.children.length >= 3) {
    toastRegion.firstElementChild.remove();
  }
  const variant = type || "info";
  const el = document.createElement("div");
  el.className = "toast is-" + variant;
  el.setAttribute("role", "status");
  el.innerHTML =
    '<span class="toast-icon">' +
    icon(variant === "success" ? "check" : variant === "error" ? "wifiOff" : "info") +
    "</span><span>" +
    escapeHTML(message) +
    "</span>";
  toastRegion.appendChild(el);
  window.setTimeout(function () {
    el.classList.add("is-leaving");
    window.setTimeout(function () {
      el.remove();
    }, 240);
  }, 3400);
}

function celebrate() {
  if (!confettiLayer) return;
  const colors = ["#ff6a45", "#ffc34f", "#1b9d69", "#3d7dff", "#a357e8", "#0c9faf", "#fb7185"];
  const pieceCount = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 36;
  for (let i = 0; i < pieceCount; i += 1) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    piece.style.left = Math.round(Math.random() * 100) + "%";
    piece.style.background = colors[i % colors.length];
    piece.style.animationDelay = (Math.random() * 0.45).toFixed(2) + "s";
    piece.style.setProperty("--drift", Math.round(Math.random() * 160 - 80) + "px");
    piece.style.setProperty("--spin", Math.round(Math.random() * 540 + 360) + "deg");
    if (i % 3 === 0) piece.style.borderRadius = "50%";
    confettiLayer.appendChild(piece);
  }
  window.setTimeout(function () {
    confettiLayer.innerHTML = "";
  }, 3400);
}

/* =========================================================
   Events
   ========================================================= */

function handleClick(event) {
  const pick = event.target.closest("[data-pick-member]");
  if (pick) {
    toggleMemberSelection(pick);
    return;
  }

  const actionEl = event.target.closest("[data-action]");
  if (!actionEl) return;
  const action = actionEl.dataset.action;

  if (action === "retry") {
    location.reload();
    return;
  }
  if (action === "date-step") {
    const step = Number(actionEl.dataset.step || 0);
    navigate({
      view: state.route.view,
      memberId: state.route.memberId,
      date: addDays(state.date, step),
    });
    return;
  }
  if (action === "today") {
    navigate({ view: state.route.view, memberId: state.route.memberId, date: state.today });
    return;
  }
  if (action === "toggle-priority") {
    state.compose.priority = !state.compose.priority;
    actionEl.setAttribute("aria-pressed", state.compose.priority ? "true" : "false");
    return;
  }
  if (action === "toggle-admin-task") {
    const task = state.tasks.find(function (item) {
      return item.id === actionEl.dataset.taskId;
    });
    if (task) toggleTask(task.id, !task.done, "admin");
    return;
  }
  if (action === "edit-task") {
    openEditTask(actionEl.dataset.taskId);
    return;
  }
  if (action === "cancel-edit") {
    state.editTask = null;
    renderApp({ animate: false });
    return;
  }
  if (action === "delete-task") {
    deleteTask(actionEl.dataset.taskId);
    return;
  }
  if (action === "copy-tasks") {
    copyTasksToNextDay();
    return;
  }
  if (action === "export-tasks") {
    exportTasks();
    return;
  }
  if (action === "admin-logout") {
    logoutAdmin();
  }
}

function handleChange(event) {
  const dateInput = event.target.closest("[data-date-input]");
  if (dateInput && isDateStr(dateInput.value)) {
    navigate({ view: state.route.view, memberId: state.route.memberId, date: dateInput.value });
    return;
  }

  const checkbox = event.target.closest("[data-task-toggle]");
  if (checkbox) {
    const task = state.tasks.find(function (item) {
      return item.id === checkbox.dataset.taskId;
    });
    if (task) toggleTask(task.id, checkbox.checked, "member", checkbox);
    return;
  }

  const editPriority = event.target.closest("[data-edit-priority]");
  if (editPriority && state.editTask) {
    state.editTask.priority = editPriority.checked;
  }
}

function handleInput(event) {
  const target = event.target;
  if (target.matches("[data-compose-title]") || target.matches("[data-compose-input]")) {
    state.compose.title = target.value;
    clearComposeError();
    return;
  }
  if (target.matches("[data-compose-time]")) {
    state.compose.time = target.value;
    return;
  }
  if (target.matches("[data-inline-input]")) {
    state.inlineDrafts[target.dataset.memberId] = target.value;
    return;
  }
  if (target.matches("[data-edit-title]") && state.editTask) {
    state.editTask.title = target.value;
    return;
  }
  if (target.matches("[data-edit-time]") && state.editTask) {
    state.editTask.time = target.value;
  }
}

function handleSubmit(event) {
  const adminForm = event.target.closest("[data-admin-login]");
  if (adminForm) {
    event.preventDefault();
    loginAdmin(adminForm);
    return;
  }
  const composeForm = event.target.closest("[data-compose-form]");
  if (composeForm) {
    event.preventDefault();
    createTasks(composeForm);
    return;
  }
  const inlineForm = event.target.closest("[data-inline-add]");
  if (inlineForm) {
    event.preventDefault();
    addInlineTask(inlineForm);
    return;
  }
  const editForm = event.target.closest("[data-edit-form]");
  if (editForm) {
    event.preventDefault();
    saveEditTask(editForm);
  }
}

function handleScroll() {
  const header = document.querySelector(".site-header");
  if (header) header.classList.toggle("is-scrolled", window.scrollY > 8);
}

/* =========================================================
   Boot
   ========================================================= */

async function boot() {
  try {
    state.adminPassword = sessionStorage.getItem("taskboard_admin_password") || "";
  } catch (error) {
    state.adminPassword = "";
  }
  document.addEventListener("click", handleClick);
  document.addEventListener("change", handleChange);
  document.addEventListener("input", handleInput);
  document.addEventListener("submit", handleSubmit);
  window.addEventListener("hashchange", handleRoute);
  window.addEventListener("scroll", handleScroll, { passive: true });
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) poll();
  });

  const route = parseRoute();
  state.route = route;
  const requestedDate = route.date || "";

  try {
    const data = await fetchState(requestedDate);
    state.today = data.today;
    state.members = data.members || [];
    state.date = data.date;
    state.tasks = data.tasks || [];
    state.revision = data.revision;
    state.loaded = true;
    sortTasks();
    renderApp({ animate: true });
    setSync(true);
    startPolling();
  } catch (error) {
    renderFatal(error);
  }
}

boot();
