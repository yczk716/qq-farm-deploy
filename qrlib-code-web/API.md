# QRLib API 接口文档

本文档详细描述了 QRLib 提供的后端 API 接口。所有接口均返回 JSON 格式数据。

**Base URL**: `http://localhost:3000` (默认)

---

## 1. 获取预设列表 (Get Presets)

获取支持的登录目标预设列表。

-   **Endpoint**: `/api/presets`
-   **Method**: `GET`

### 响应 (Response)

返回一个对象数组，包含所有可用预设。

```json
[
  {
    "key": "vip",
    "type": "qr",
    "name": "QQ会员 (VIP)",
    "description": "QQ会员官网"
  },
  {
    "key": "miniprogram",
    "type": "mp",
    "name": "小程序开发 (DevTools)",
    "description": "QQ小程序开发者工具",
    "defaultAppId": ""
  },
  {
    "key": "farm",
    "type": "mp",
    "name": "QQ经典农场 (Farm)",
    "description": "QQ经典农场小程序"
  }
]
```

---

## 2. 获取登录二维码 (Create QR Code)

请求生成一个新的登录二维码。

-   **Endpoint**: `/api/qr/create`
-   **Method**: `POST`
-   **Content-Type**: `application/json`

### 请求参数 (Request Body)

| 参数名 | 类型 | 必选 | 描述 | 示例 |
| :--- | :--- | :--- | :--- | :--- |
| `preset` | string | 否 | 预设 Key (来自接口 1)，默认为 `vip` | `"vip"`, `"farm"` |

### 响应 (Response)

```json
{
  "success": true,
  "qrsig": "xxxx...",           // 二维码签名 (核心，用于查询状态)
  "qrcode": "data:image...",    // 二维码图片的 Base64 数据 (直接用于 img src)
  "url": "https://...",         // 二维码原始内容链接
  "isMiniProgram": false        // 是否为小程序模式
}
```

---

## 3. 查询扫码状态 (Check QR Status)

轮询查询二维码的扫描和登录状态。**建议轮询间隔：2-3秒**。

-   **Endpoint**: `/api/qr/check`
-   **Method**: `POST`
-   **Content-Type**: `application/json`

### 请求参数 (Request Body)

| 参数名 | 类型 | 必选 | 描述 | 示例 |
| :--- | :--- | :--- | :--- | :--- |
| `qrsig` | string | **是** | 上一步获取的 `qrsig` | `"ptqrtoken_..."` |
| `preset` | string | 否 | 当前使用的预设 Key | `"vip"` |
| `appid` | string | 否 | (仅限小程序模式) 自定义 AppID | `"1108291530"` |

### 响应 (Response)

#### 状态：等待扫码 / 扫码中
```json
{
  "success": true,
  "ret": "66",
  "msg": "等待扫码...",
  "code": "",
  "uin": "",
  "ticket": ""
}
```

#### 状态：已过期
```json
{
  "success": true,
  "ret": "65",
  "msg": "二维码已失效",
  ...
}
```

#### 状态：登录成功 (Success) 🎉
```json
{
  "success": true,
  "ret": "0",
  "msg": "登录成功",
  "code": "A1B2C3D4...",      // [核心] 登录授权码
  "uin": "123456789",         // [核心] 用户 QQ 号
  "avatar": "https://...",    // [新增] 用户头像 URL
  "ticket": "xxxx..."         // [可选] 票据 (小程序模式通常有)
}
```

---

## 错误代码说明 (ret)

| ret | 含义 | 处理建议 |
| :--- | :--- | :--- |
| `0` | 成功 | 停止轮询，保存凭证 |
| `66` | 等待中 | 继续轮询 |
| `65` | 失效/错误 | 停止轮询，提示用户刷新二维码 |
