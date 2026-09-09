const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { QRLoginSession, MiniProgramLoginSession } = require('./session');
const QRCode = require('qrcode'); // [定制] 本地生成二维码，避免把登录链接发给第三方在线服务

const app = express();
const port = process.env.PORT || 3000; // [定制] 允许通过 PORT 环境变量覆盖（Docker 部署）

app.use(cors());
app.use(bodyParser.json());

// ---------------------------------------------------------------------------
// [定制补丁] 访问控制：与 napcat-code-web(8088) 保持一致的使用体验
//   - 脚本/API：请求头 x-auth-pwd 或查询参数 ?pwd=
//   - 浏览器：HTTP Basic Auth（原生密码框，浏览器会记住）
//   - QRLIB_WEB_PASSWORD 为空时不校验
// ---------------------------------------------------------------------------
const ACCESS_PASSWORD = process.env.QRLIB_WEB_PASSWORD || '';

app.use((req, res, next) => {
    if (!ACCESS_PASSWORD) return next();
    if (req.headers['x-auth-pwd'] === ACCESS_PASSWORD) return next();
    if (req.query && req.query.pwd === ACCESS_PASSWORD) return next();

    const auth = req.headers.authorization || '';
    if (auth.indexOf('Basic ') === 0) {
        const decoded = Buffer.from(auth.slice(6), 'base64').toString();
        const idx = decoded.indexOf(':');
        if (idx >= 0 && decoded.slice(idx + 1) === ACCESS_PASSWORD) return next();
    }

    if (req.path.indexOf('/api/') === 0) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    res.set('WWW-Authenticate', 'Basic realm="QRLib Farm Code"');
    return res.status(401).send('Unauthorized');
});

// Configuration: WebUI Switch (Default: true)
const webUiEnabled = process.env.WEBUI_ENABLED !== 'false';
// const webUiEnabled = false;

if (webUiEnabled) {
    // Serve static files for WebUI
    app.use(express.static('public'));
} else {
    // Pure API Mode: Root returns status
    app.get('/', (req, res) => {
        res.json({
            success: true,
            message: 'QRLib API Server is running in Pure API Mode.',
            documentation: 'See API.md for usage.'
        });
    });
}

// 1. Get List of Presets
app.get('/api/presets', (req, res) => {
    // 1. Standard QR Login Presets
    const qrPresets = Object.keys(QRLoginSession.Presets).map(key => {
        const config = QRLoginSession.Presets[key];
        return {
            key,
            type: 'qr',
            name: config.name,
            description: config.description
        };
    });

    // 2. Mini Program Presets
    const mpPresets = Object.keys(MiniProgramLoginSession.Presets).map(key => {
        const config = MiniProgramLoginSession.Presets[key];
        return {
            key,
            type: 'mp',
            name: config.name,
            description: config.description,
            // Hide AppID for Farm (Security/User Request)
            defaultAppId: key === 'farm' ? undefined : config.appid
        };
    });

    res.json([...qrPresets, ...mpPresets]);
});

// 2. Create QR Code
app.post('/api/qr/create', async (req, res) => {
    const { preset = 'vip' } = req.body;
    try {
        // Check if it's a Mini Program Preset
        if (MiniProgramLoginSession.Presets[preset]) {
            const result = await MiniProgramLoginSession.requestLoginCode();

            // [定制] 本地生成二维码（原实现调用 api.qrserver.com，会把登录链接发给第三方）
            let qrcode = '';
            try {
                qrcode = await QRCode.toDataURL(result.url, { width: 300, margin: 1 });
            } catch (e) {
                qrcode = '';
            }

            res.json({
                success: true,
                qrsig: result.code,
                qrcode: qrcode || `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(result.url)}`,
                url: result.url,
                isMiniProgram: true
            });
        } else {
            // Standard QR Login
            const result = await QRLoginSession.requestQRCode(preset);
            res.json({ success: true, ...result, isMiniProgram: false });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 3. Check QR Status
app.post('/api/qr/check', async (req, res) => {
    const { qrsig, preset = 'vip', appid: customAppId } = req.body;
    if (!qrsig) {
        return res.status(400).json({ success: false, message: 'Missing qrsig/code' });
    }

    // Security Check: Validate qrsig format (alphanumeric, chars)
    if (!/^[a-zA-Z0-9+/=._-]+$/.test(qrsig)) {
        return res.status(400).json({ success: false, message: 'Invalid qrsig/code format' });
    }

    try {
        const mpConfig = MiniProgramLoginSession.Presets[preset];
        const { CookieUtils } = require('./utils');

        // --- Mini Program Strategy ---
        if (mpConfig) {
            const result = await MiniProgramLoginSession.queryStatus(qrsig);

            let ret = '66';
            let msg = '等待扫码...';
            // New return fields
            let code = '';
            let uin = '';
            let avatar = '';
            let ticket = '';

            if (result.status === 'Wait') {
                ret = '66';
                msg = '等待扫码...';
            } else if (result.status === 'Used') {
                ret = '65';
                msg = '二维码已失效';
            } else if (result.status === 'OK') {
                ret = '0';
                msg = '登录成功';
                ticket = result.ticket;
                uin = result.uin || ''; // Get UIN from MP status result
                if (uin) {
                    avatar = `https://q1.qlogo.cn/g?b=qq&nk=${uin}&s=640`;
                }

                // Determine AppID
                const appid = customAppId || mpConfig.appid || '1108291530';

                // Get Auth Code (This is the 'code' user wants)
                code = await MiniProgramLoginSession.getAuthCode(ticket, appid);

                // Try to extract UIN from ticket or we don't have it?
                // MP login usually doesn't expose UIN easily unless we decode something.
                // For now, leave UIN empty for MP or check if we can parse it from ticket if it was a JWT (unlikely).
                // User asked for UIN. If unavailable, send empty string.
            } else if (result.status === 'Error') {
                ret = '65';
                msg = '状态查询错误';
            }

            // Return flattened structure as requested
            res.json({ success: true, ret, msg, code, uin, ticket, avatar });

        } else {
            // --- Standard QR Strategy ---
            const result = await QRLoginSession.checkStatus(qrsig, preset);

            let code = '';
            let uin = '';
            let avatar = '';
            let ticket = ''; // QR login might not have 'ticket' in MP sense, but might have 'code' in url

            if (result.ret === '0') {
                // Determine UIN from cookies
                if (result.cookie) {
                    uin = CookieUtils.getUin(result.cookie);
                    if (uin) {
                        avatar = `https://q1.qlogo.cn/g?b=qq&nk=${uin}&s=640`;
                    }
                }

                // Determine 'Code'
                // If the flow returns a Jump URL with a code (e.g. valid 'responseType'), extract it.
                if (result.jumpUrl) {
                    try {
                        const urlObj = new URL(result.jumpUrl);
                        code = urlObj.searchParams.get('code') || '';
                    } catch (e) { }
                }
            }

            // Clean up result - remove old fields we don't want
            const { nickname, jumpUrl, cookie, ...rest } = result;

            res.json({ success: true, ...rest, code, uin, ticket, avatar });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
