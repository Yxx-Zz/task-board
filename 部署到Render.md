# 部署到 Render 指南

## 前提

一个 [Render](https://render.com) 账号 + GitHub 账号。

## 步骤（5 分钟搞定）

### 1. 推送代码到 GitHub

```bash
cd D:\ai\reverse-task-board
git init
git add .
git commit -m "init: 教学组任务板"
git remote add origin https://github.com/你的用户名/task-board.git
git push -u origin main
```

### 2. 在 Render 创建 Web Service

1. 登录 https://dashboard.render.com
2. 点击 **New +** → **Web Service**
3. 授权并选择刚才的 GitHub 仓库
4. 配置：

| 字段 | 值 |
|------|-----|
| Name | `task-board`（随便填） |
| Environment | `Node` |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Instance Type | **Free** |

5. 点 **Create Web Service**

### 3. 等 2-3 分钟

Render 自动构建 + 部署，完成后给你一个 `https://task-board.onrender.com` 地址。

## 注意事项

### 数据持久化

免费版有持久化磁盘，重启/休眠唤醒数据**不丢**。

但 **每次推送新代码会重置数据**（重新构建会把 JSON 文件清掉）。

建议：部署完成后去管理页面点「导出备份」定期备份 `export` 文件。

### 15 分钟休眠

免费版 15 分钟没人访问就休眠。下次打开页面，**等 ~30 秒冷启动**就好了。介意的话可以用 [UptimeRobot](https://uptimerobot.com) 每 10 分钟 ping 一下，就不会休眠了。

### 密码

默认管理密码 `admin123`，部署完记得通过 admin 页面改掉。

## Render 变量说明

不需要设置任何环境变量。`server.js` 会自动读取 `PORT`（Render 自动注入），数据文件自动创建。