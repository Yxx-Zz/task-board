# 教学组 · 今日任务板

一个简洁优雅的团队每日任务管理工具。从腾讯云 CloudBase 逆向工程，现已独立部署。

## 📁 文件结构

```
reverse-task-board/
├── index.html          # SPA 入口页面
├── app.js              # 前端应用（原生 JS，无框架）
├── styles.css           # 样式表（3416 行）
├── favicon.svg          # 网站图标
├── server.js            # 后端服务（Express + JSON 存储）
├── package.json         # Node.js 依赖配置
├── 启动任务板.bat        # Windows 一键启动脚本
└── data/                # 运行时自动生成的数据目录
    ├── config.json      # 管理员密码等配置
    ├── members.json     # 团队成员数据
    └── tasks/           # 每日任务 JSON 文件（按日期分）
```

## 🚀 快速部署

### 方式一：在自己电脑上运行

```bash
# 1. 安装依赖
npm install --cache .npm-cache

# 2. 启动服务
npm start
# 或者双击 Windows 上的「启动任务板.bat」
```

访问 `http://localhost:3456`

### 方式二：部署到服务器

```bash
# 上传整个 reverse-task-board 文件夹到服务器，然后：
npm install
npm start

# 推荐使用 pm2 守护进程
npm install -g pm2
pm2 start server.js --name task-board
```

### 方式三：使用 Nginx 反向代理

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://127.0.0.1:3456;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 🔧 配置

### 修改端口

编辑 `server.js` 顶部的 `PORT` 变量，或在启动时设置环境变量：

```bash
PORT=8080 npm start
```

### 修改管理员密码

编辑 `data/config.json`（首次启动后自动生成）：

```json
{
  "adminPassword": "你的密码",
  "revisionCounter": 0
}
```

### 管理团队成员

编辑 `data/members.json`：

```json
[
  {
    "id": "唯一ID",
    "name": "姓名",
    "role": "角色",
    "letter": "姓",
    "accent": "#ff6d4a",
    "color1": "#ffb36b",
    "color2": "#ff5f7e"
  }
]
```

每个成员建议使用不同的配色（accent/color1/color2），可参考以下方案：
- 橙红系：`#ff6d4a` / `#ffb36b` / `#ff5f7e`
- 蓝色系：`#3d7dff` / `#63b3ff` / `#4f7cff`
- 紫色系：`#a357e8` / `#c084fc` / `#8b5cf6`
- 绿色系：`#0f9f7a` / `#5eead4` / `#10b981`
- 金色系：`#d58b00` / `#fcd34d` / `#fb923c`
- 粉色系：`#e64b73` / `#fda4af` / `#fb7185`
- 青色系：`#0c9faf` / `#67e8f9` / `#22c1d6`

## 📖 使用说明

### 普通用户（查看任务）
1. 打开页面，看到所有成员的卡片
2. 点击卡片进入成员详情，查看今天任务
3. 勾选完成的任务，进度实时同步

### 管理员（安排任务）
1. 点击右上角「管理工作台」
2. 输入管理密码（默认: `admin123`）
3. 选择日期 → 勾选成员 → 填写任务 → 添加
4. 可编辑、删除、复制任务到次日
5. 可导出全部数据备份

## 📡 API 接口

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/state?date=` | 公开 | 获取指定日期的状态（成员、任务） |
| POST | `/api/tasks` | 管理员 | 创建任务 |
| PATCH | `/api/tasks/:id` | mixed | 更新任务（done 字段公开，其余需管理员） |
| DELETE | `/api/tasks/:id` | 管理员 | 删除任务 |
| POST | `/api/tasks/copy` | 管理员 | 复制任务到另一天 |
| GET | `/api/admin/check` | 公开 | 验证管理密码 |
| GET | `/api/export` | 管理员 | 导出全部数据备份 |

## 🛠 技术栈

- **前端**：原生 JavaScript（零框架、零构建步骤）
- **后端**：Node.js + Express
- **存储**：JSON 文件（无需数据库）
- **实时同步**：前端每 7 秒轮询 API