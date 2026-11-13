/* =========================================================
   教学组 · 今日任务板 — 后端服务
   独立部署版本：Express + JSON 文件存储
   ========================================================= */

"use strict";

const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3456;
const DATA_DIR = path.join(__dirname, "data");
const TASKS_DIR = path.join(DATA_DIR, "tasks");
const CONFIG_PATH = path.join(DATA_DIR, "config.json");
const MEMBERS_PATH = path.join(DATA_DIR, "members.json");

// =========================================================
// 工具函数
// =========================================================

function pad2(n) {
  return String(n).padStart(2, "0");
}

function todayStr() {
  const d = new Date();
  return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
}

function isDateStr(v) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));
}

function taskFilePath(date) {
  return path.join(TASKS_DIR, date + ".json");
}

function genId() {
  return crypto.randomBytes(6).toString("hex");
}

function loadJSON(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch (_) {
    return fallback;
  }
}

function saveJSON(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

function loadConfig() {
  return loadJSON(CONFIG_PATH, { adminPassword: "admin123", revisionCounter: 0 });
}

function saveConfig(config) {
  saveJSON(CONFIG_PATH, config);
}

function nextRevision(config) {
  config.revisionCounter = (config.revisionCounter || 0) + 1;
  saveConfig(config);
  return config.revisionCounter + "-" + Date.now();
}

// =========================================================
// 中间件
// =========================================================

app.use(express.json());

// CORS
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type, X-Admin-Password");
  res.header("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  res.header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.header("Pragma", "no-cache");
  res.header("Expires", "0");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// 管理密码校验
function checkAdmin(req) {
  const config = loadConfig();
  const password = req.headers["x-admin-password"] || "";
  return password && password === config.adminPassword;
}

function requireAdmin(req, res, next) {
  if (!checkAdmin(req)) {
    return res.status(401).json({ error: "管理密码不正确或未提供" });
  }
  next();
}

// =========================================================
// API 路由
// =========================================================

// GET /api/state?date=YYYY-MM-DD
app.get("/api/state", (req, res) => {
  const config = loadConfig();
  const members = loadJSON(MEMBERS_PATH, []);
  const date = isDateStr(req.query.date) ? req.query.date : todayStr();
  const tasks = loadJSON(taskFilePath(date), []);
  const today = todayStr();

  res.json({
    today,
    date,
    members,
    tasks,
    revision: String(config.revisionCounter || 0) + "-" + Date.now(),
    updatedAt: new Date().toISOString(),
  });
});

// POST /api/tasks  创建任务（可同时为多人创建）
app.post("/api/tasks", requireAdmin, (req, res) => {
  const { date, memberIds, title, time, priority } = req.body || {};

  if (!date || !isDateStr(date)) {
    return res.status(400).json({ error: "日期格式不正确" });
  }
  if (!Array.isArray(memberIds) || memberIds.length === 0) {
    return res.status(400).json({ error: "请选择至少一位伙伴" });
  }
  if (!title || !String(title).trim()) {
    return res.status(400).json({ error: "任务内容不能为空" });
  }

  const config = loadConfig();
  const members = loadJSON(MEMBERS_PATH, []);
  const memberIdSet = new Set(members.map((m) => m.id));

  const tasks = loadJSON(taskFilePath(date), []);
  const now = new Date().toISOString();
  const newTasks = [];

  for (const memberId of memberIds) {
    if (!memberIdSet.has(memberId)) continue;
    const task = {
      id: genId(),
      memberId,
      date,
      title: String(title).trim(),
      time: time || "",
      priority: Boolean(priority),
      done: false,
      createdAt: now,
      completedAt: null,
      updatedAt: Date.now(),
      sort: tasks.length + newTasks.length + 1,
    };
    tasks.push(task);
    newTasks.push(task);
  }

  saveJSON(taskFilePath(date), tasks);
  nextRevision(config);

  res.json({ tasks: newTasks });
});

// PATCH /api/tasks/:id  更新任务
app.patch("/api/tasks/:id", (req, res) => {
  const taskId = req.params.id;
  const body = req.body || {};

  // done 字段不需要管理员权限，其他字段需要
  const isToggleOnly =
    Object.keys(body).length === 1 && "done" in body;

  if (!isToggleOnly && !checkAdmin(req)) {
    return res.status(401).json({ error: "管理密码不正确或未提供" });
  }

  // 查找任务所在日期的文件
  let task = null;
  let taskDate = null;
  let tasks = [];

  if (fs.existsSync(TASKS_DIR)) {
    const files = fs.readdirSync(TASKS_DIR).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      const dateTasks = loadJSON(path.join(TASKS_DIR, file), []);
      const found = dateTasks.find((t) => t.id === taskId);
      if (found) {
        task = found;
        taskDate = file.replace(".json", "");
        tasks = dateTasks;
        break;
      }
    }
  }

  if (!task) {
    return res.status(404).json({ error: "任务不存在" });
  }

  if ("title" in body) {
    const newTitle = String(body.title || "").trim();
    if (!newTitle) return res.status(400).json({ error: "任务内容不能为空" });
    task.title = newTitle;
  }
  if ("time" in body) task.time = body.time || "";
  if ("priority" in body) task.priority = Boolean(body.priority);
  if ("done" in body) {
    task.done = Boolean(body.done);
    task.completedAt = task.done ? new Date().toISOString() : null;
  }
  task.updatedAt = Date.now();

  saveJSON(taskFilePath(taskDate), tasks);

  const config = loadConfig();
  nextRevision(config);

  res.json({ task });
});

// DELETE /api/tasks/:id  删除任务
app.delete("/api/tasks/:id", requireAdmin, (req, res) => {
  const taskId = req.params.id;

  if (!fs.existsSync(TASKS_DIR)) {
    return res.status(404).json({ error: "任务不存在" });
  }

  const files = fs.readdirSync(TASKS_DIR).filter((f) => f.endsWith(".json"));
  for (const file of files) {
    const filePath = path.join(TASKS_DIR, file);
    let tasks = loadJSON(filePath, []);
    const idx = tasks.findIndex((t) => t.id === taskId);
    if (idx !== -1) {
      tasks.splice(idx, 1);
      saveJSON(filePath, tasks);

      const config = loadConfig();
      nextRevision(config);

      return res.json({ ok: true });
    }
  }

  return res.status(404).json({ error: "任务不存在" });
});

// POST /api/tasks/copy  复制任务到另一天
app.post("/api/tasks/copy", requireAdmin, (req, res) => {
  const { fromDate, toDate } = req.body || {};

  if (!isDateStr(fromDate) || !isDateStr(toDate)) {
    return res.status(400).json({ error: "日期格式不正确" });
  }

  const sourceFile = taskFilePath(fromDate);
  if (!fs.existsSync(sourceFile)) {
    return res.status(400).json({ error: "来源日期没有任务" });
  }

  const sourceTasks = loadJSON(sourceFile, []);
  if (sourceTasks.length === 0) {
    return res.status(400).json({ error: "来源日期没有任务" });
  }

  const destTasks = loadJSON(taskFilePath(toDate), []);
  const now = new Date().toISOString();
  let count = 0;

  for (const src of sourceTasks) {
    const task = {
      id: genId(),
      memberId: src.memberId,
      date: toDate,
      title: src.title,
      time: src.time || "",
      priority: Boolean(src.priority),
      done: false,
      createdAt: now,
      completedAt: null,
      updatedAt: Date.now(),
      sort: destTasks.length + count + 1,
    };
    destTasks.push(task);
    count++;
  }

  saveJSON(taskFilePath(toDate), destTasks);

  const config = loadConfig();
  nextRevision(config);

  res.json({ count });
});

// GET /api/admin/check  管理员密码验证
app.get("/api/admin/check", (req, res) => {
  if (checkAdmin(req)) {
    return res.json({ ok: true });
  }
  return res.status(401).json({ error: "密码不正确" });
});

// GET /api/export  导出全部数据（备份）
app.get("/api/export", requireAdmin, (req, res) => {
  const members = loadJSON(MEMBERS_PATH, []);
  const config = loadConfig();

  const allTasks = {};
  if (fs.existsSync(TASKS_DIR)) {
    const files = fs.readdirSync(TASKS_DIR).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      const date = file.replace(".json", "");
      allTasks[date] = loadJSON(path.join(TASKS_DIR, file), []);
    }
  }

  const exportData = {
    exportedAt: new Date().toISOString(),
    version: 1,
    members,
    tasksByDate: allTasks,
  };

  res.attachment("task-board-" + todayStr() + ".json");
  res.json(exportData);
});

// =========================================================
// 静态文件
// =========================================================

app.use(express.static(__dirname, {
  index: "index.html",
  setHeaders(res, filePath) {
    if (filePath.endsWith(".js")) {
      res.setHeader("Content-Type", "application/javascript; charset=utf-8");
    }
    if (filePath.endsWith(".css")) {
      res.setHeader("Content-Type", "text/css; charset=utf-8");
    }
  },
}));

// 404 兜底 → index.html（SPA 路由）
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(__dirname, "index.html"));
});

// =========================================================
// 初始化 & 启动
// =========================================================

function initData() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(TASKS_DIR, { recursive: true });

  if (!fs.existsSync(CONFIG_PATH)) {
    saveJSON(CONFIG_PATH, { adminPassword: "admin123", revisionCounter: 0 });
    console.log("[init] 已创建 config.json（默认密码: admin123）");
  }

  if (!fs.existsSync(MEMBERS_PATH)) {
    const defaultMembers = [
      { id: "demo1", name: "张三", role: "组员", letter: "张", accent: "#ff6d4a", color1: "#ffb36b", color2: "#ff5f7e" },
      { id: "demo2", name: "李四", role: "组员", letter: "李", accent: "#3d7dff", color1: "#63b3ff", color2: "#4f7cff" },
      { id: "demo3", name: "王五", role: "组员", letter: "王", accent: "#a357e8", color1: "#c084fc", color2: "#8b5cf6" },
    ];
    saveJSON(MEMBERS_PATH, defaultMembers);
    console.log("[init] 已创建 members.json（示例数据）");
  }
}

initData();

app.listen(PORT, () => {
  console.log("");
  console.log("  ╔══════════════════════════════════════╗");
  console.log("  ║   教学组 · 今日任务板 已启动       ║");
  console.log("  ║   地址: http://localhost:" + String(PORT).padEnd(5) + "      ║");
  console.log("  ║   管理: 点击右上角「管理工作台」    ║");
  console.log("  ║   默认密码: admin123                ║");
  console.log("  ╚══════════════════════════════════════╝");
  console.log("");
});