# QQ 农场扫码取 Code 服务（qrlib-code-web，端口 8089）

> 上游项目：**[lkeme/QRLib](https://github.com/lkeme/QRLib)**（MIT License，作者 [@lkeme](https://github.com/lkeme)）
> 本目录在其基础上仅做了最小集成改动，用于在本仓库的 Docker Compose 部署中提供「QQ 端农场 code 获取」能力。
> **仅支持 QQ 端，不支持微信端**（微信端请使用 `yyb-go` 服务）。

## 它解决什么问题

QQ 农场机器人登录农场需要一次性的**农场 code**。本项目通过 QQ 小程序登录链路获取它：

```
生成二维码 → 手机 QQ 扫码确认 → 轮询拿 ticket → 换取 code + uin
```

底层走的 AppID 是 `1112386029`（QQ 经典农场小程序），与 NapCat 方案的 `start_mini_app_1112386029` **同源**，
因此拿到的 `code` 是同一种凭证，可直接填入 Bot 账号使用。相比 NapCat 方案，它不需要运行整个 QQ 客户端容器，
更轻量、取码即用即走。

## 访问方式

| 入口 | 地址 | 说明 |
| --- | --- | --- |
| 网页（推荐） | `http://<服务器IP>:8089` | 浏览器弹出密码框，登录后点击生成二维码，手机 QQ 扫码 |
| 纯 API 模式 | 环境变量 `WEBUI_ENABLED=false` | 不提供静态页面，只提供接口 |

> ⚠️ 若部署在公网，请务必配置 `QRLIB_WEB_PASSWORD`，并在防火墙/安全组只放行可信来源。

## 访问控制（本仓库定制）

密码通过环境变量 `QRLIB_WEB_PASSWORD` 配置；**为空则不校验**（与 `napcat-code-web` 的约定一致）。

三种通过方式：

```bash
# 1) 请求头（脚本/服务端调用推荐）
curl -H "x-auth-pwd: 你的密码" http://IP:8089/api/presets

# 2) 查询参数
curl "http://IP:8089/api/presets?pwd=你的密码"

# 3) 浏览器：HTTP Basic Auth 原生弹框（浏览器会记住，任意用户名 + 密码）
```

## API 用法

```bash
# 1. 创建二维码（preset 固定用 farm）
curl -s -X POST -H "Content-Type: application/json" -H "x-auth-pwd: 密码" \
  -d '{"preset":"farm"}' http://IP:8089/api/qr/create
# → { success, qrsig, qrcode(data:image...), url, isMiniProgram }

# 2. 轮询扫码状态（建议 2-3 秒一次）
curl -s -X POST -H "Content-Type: application/json" -H "x-auth-pwd: 密码" \
  -d '{"qrsig":"上一步的qrsig","preset":"farm"}' http://IP:8089/api/qr/check
# ret: 66=等待扫码 / 65=已失效 / 0=成功
# 成功时返回：{ ret:"0", code:"农场code", uin:"QQ号", avatar, ticket }
```

拿到 `code` 后，在 Bot 面板添加/更新 QQ 账号时填入即可。

## 本仓库对上游做的改动（升级上游时需复查）

1. `src/server.js`：端口改为 `process.env.PORT || 3000`
2. `src/server.js`：新增访问控制中间件（Basic Auth + `x-auth-pwd` / `?pwd=`）
3. `public/app.js`：前端默认预设由 `vip` 改为 `farm`

除以上三处外，其余均为上游原始文件（含上游 `LICENSE`）。

## 相关

- Bot 主面板：`:3010`
- NapCat 扫码取 Code（旧方案，依赖 QQ 客户端容器）：`:8088`
- 微信端换码：`yyb-go` `:8450`
