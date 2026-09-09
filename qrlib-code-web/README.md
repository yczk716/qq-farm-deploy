# QRLib 

-   本工具仅供学习和开发测试使用，请勿用于非法用途。

## 📦 安装步骤

1.  **下载源码**
    下载并解压本项目到本地目录。

2.  **安装依赖**
    在项目根目录下打开终端，运行：
    ```bash
    npm install
    ```
    *如果要手动安装依赖：*
    ```bash
    npm install express cors body-parser axios
    ```

3.  **目录结构**
    ```text
    /
    ├── public/             # 前端静态资源 (HTML/CSS/JS)
    ├── src/
    │   ├── server.js       # 后端入口与路由
    │   ├── session.js      # 核心登录逻辑
    │   └── utils.js        # 工具类
    ├── API.md              # 接口开发文档
    └── README.md           # 说明文档
    ```

## 🐳 Docker 部署 (推荐)

如果您熟悉 Docker，可以使用以下命令快速启动：

1.  **构建并启动容器**
    ```bash
    docker-compose up -d
    ```

2.  **访问服务**
    浏览器打开 [http://localhost:3000](http://localhost:3000)

3.  **停止服务**
    ```bash
    docker-compose down
    ```

## 🚀 启动与部署

### 开发模式 / 本地运行
在项目根目录运行：
```bash
node src/server.js
```
启动成功后，控制台会输出：
```text
Server running at http://localhost:3000
```

### 访问前端
打开浏览器访问：[http://localhost:3000](http://localhost:3000)
即可看到图形化登录界面。

### 服务器部署 (PM2 推荐)
建议使用 `pm2` 进行生产环境部署，以保证进程常驻。
```bash
# 全局安装 pm2
npm install pm2 -g

# 启动服务
pm2 start src/server.js --name "qrlib"

# 查看状态
pm2 status
```

## ⚙️ 高级配置

### 纯 API 模式 (Pure API Mode)

如果您只需要 API 服务，不需要网页界面（例如集成到其他系统），可以通过环境变量关闭 WebUI，节省资源。

**PowerShell (Windows):**
```powershell
$env:WEBUI_ENABLED="false"; node src/server.js
```

**Linux / Mac:**
```bash
WEBUI_ENABLED=false node src/server.js
```

此时访问根目录 `/` 将返回 JSON 状态信息，且不会提供静态文件服务。

## 🖥️ 功能特性

-   **多模式支持**：支持 QQ 会员、空间、WeGame、无畏契约等 Web 端登录，以及小程序开发工具登录。
-   **安全隐私**：
    -   API 仅返回核心凭证 (`Code`, `UIN`, `Ticket`)。
    -   敏感信息（如 Farm AppID）后端脱敏。
    -   `qrsig` 参数严格校验。
-   **极简 UI**：采用 "Soft Modernism" 设计风格，大字体、宽间距，适应各种屏幕。

## ⚠️ 注意事项

-   生成的二维码有效期通常为 2 分钟，超时需刷新。
-   请妥善保管获取到的 `Code` 和 `Ticket`，这等同于您的登录凭证。

## 📖 接口文档

-   [API.md](./API.md) - 完整 API 接口参数与返回定义。

## 🔗 参考项目

-   [mioki/plugins/qr-login](https://github.com/vikiboss/mioki/blob/main/plugins/qr-login/index.ts) - 核心逻辑参考自此项目，特此感谢。
