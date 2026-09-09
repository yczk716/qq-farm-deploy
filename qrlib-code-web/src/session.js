const axios = require('axios');
const { CookieUtils, HashUtils } = require('./utils');

// User Agent Definition
const ChromeUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

class QRLoginSession {
    /**
     * Presets for different login targets
     */
    static Presets = {
        vip: {
            name: 'QQ会员 (VIP)',
            description: 'QQ会员官网',
            aid: '8000201',
            daid: '18',
            redirectUri: 'https://vip.qq.com/loginsuccess.html',
            referrer: 'https://xui.ptlogin2.qq.com/cgi-bin/xlogin?appid=8000201&style=20&s_url=https%3A%2F%2Fvip.qq.com%2Floginsuccess.html&maskOpacity=60&daid=18&target=self',
        },
        qzone: {
            name: 'QQ空间 (QZone)',
            description: 'QQ空间网页版',
            aid: '549000912',
            daid: '5',
            redirectUri: 'https://qzs.qzone.qq.com/qzone/v5/loginsucc.html?para=izone',
            referrer: 'https://qzone.qq.com/',
        },
        music: {
            name: 'QQ音乐 (Music)',
            description: 'QQ音乐网页版',
            aid: '716027609',
            daid: '383',
            redirectUri: 'https://y.qq.com/portal/wx_redirect.html?login_type=1&surl=https%3A%2F%2Fy.qq.com%2F',
            ptThirdAid: '100497308',
            responseType: 'code',
            openapi: '1010_1030',
        },
        wegame: {
            name: 'WeGame',
            description: 'WeGame 平台',
            aid: '1600001063',
            daid: '733',
            redirectUri: 'https://www.wegame.com.cn/middle/login/third_callback.html',
            referrer: 'https://www.wegame.com.cn/',
        },
        val: {
            name: '瓦罗兰特 (VAL)',
            description: '无畏契约官网',
            aid: '716027609',
            daid: '383',
            redirectUri: 'https://val.qq.com/comm-htdocs/login/qc_redirect.html?parent_domain=https%3A%2F%2Fval.qq.com&isMiloSDK=1&isPc=1',
            ptThirdAid: '102059301',
            responseType: 'code',
            openapi: '1010_1030',
        },
    };

    /**
     * Request a new QR Code
     * @param {string} presetKey - The key of the preset to use (vip, qzone, etc)
     */
    static async requestQRCode(presetKey) {
        const config = this.Presets[presetKey] || this.Presets.vip;

        const params = new URLSearchParams({
            appid: config.aid,
            e: '2',
            l: 'M',
            s: '3',
            d: '72',
            v: '4',
            t: String(Math.random()),
            daid: config.daid,
        });

        if (config.ptThirdAid) {
            params.set('pt_3rd_aid', config.ptThirdAid);
            params.set('u1', 'https://graph.qq.com/oauth2.0/login_jump');
        } else {
            params.set('u1', config.redirectUri);
        }

        const url = `https://ssl.ptlogin2.qq.com/ptqrshow?${params.toString()}`;

        try {
            const response = await axios.get(url, {
                responseType: 'arraybuffer',
                headers: {
                    'Referer': config.referrer || `https://xui.ptlogin2.qq.com/cgi-bin/xlogin?appid=${config.aid}&style=20&s_url=${encodeURIComponent(config.redirectUri)}&maskOpacity=60&daid=${config.daid}&target=self`,
                    'User-Agent': ChromeUA,
                }
            });

            const setCookie = response.headers['set-cookie'];
            const qrsig = CookieUtils.getValue(setCookie, 'qrsig');
            const qrcodeBase64 = Buffer.from(response.data).toString('base64');

            return { qrsig, qrcode: `data:image/png;base64,${qrcodeBase64}`, url };
        } catch (error) {
            console.error('Request QRCode Error:', error);
            throw error;
        }
    }

    /**
     * Check the status of the QR Code
     * @param {string} qrsig 
     * @param {string} presetKey 
     */
    static async checkStatus(qrsig, presetKey) {
        const config = this.Presets[presetKey] || this.Presets.vip;
        const ptqrtoken = HashUtils.hash(qrsig);

        const params = new URLSearchParams({
            ptqrtoken: String(ptqrtoken),
            from_ui: '1',
            aid: config.aid,
            daid: config.daid,
            action: `0-0-${Date.now()}`, // Added timestamp
            pt_uistyle: '40',
            js_ver: '21020514',
            js_type: '1'
        });

        if (config.ptThirdAid) {
            params.set('pt_3rd_aid', config.ptThirdAid);
            params.set('u1', 'https://graph.qq.com/oauth2.0/login_jump');
        } else {
            params.set('u1', config.redirectUri);
        }

        const api = `https://ssl.ptlogin2.qq.com/ptqrlogin?${params.toString()}`;

        try {
            const response = await axios.get(api, {
                headers: {
                    'Cookie': `qrsig=${qrsig}`,
                    'Referer': config.referrer || 'https://xui.ptlogin2.qq.com/',
                    'User-Agent': ChromeUA,
                },
            });

            const text = response.data;
            // Parse response: ptuiCB('66','0','','0','二维码未失效。(3776510309)', '')
            // Robust parsing using Regex to handle commas in content
            const matcher = /ptuiCB\((.+)\)/;
            const match = text.match(matcher);

            if (!match) {
                throw new Error('Invalid response format');
            }

            // Extract arguments: 'arg1', 'arg2', ...
            // This regex matches single-quoted strings: '([^']*)'
            const args = [];
            const argMatcher = /'([^']*)'/g;
            let argMatch;
            while ((argMatch = argMatcher.exec(match[1])) !== null) {
                args.push(argMatch[1]);
            }

            const [ret, extret, jumpUrl, redirect, msg, nickname] = args;

            return {
                ret,
                msg,
                nickname,
                jumpUrl,
                cookie: response.headers['set-cookie'] // Return cookies to frontend if success
            };

        } catch (error) {
            console.error('Check Status Error:', error);
            throw new Error('Check status failed');
        }
    }

    /**
     * Get final cookies from the successful jump URL
     * @param {string} jumpUrl 
     */
    static async getFinalCookies(jumpUrl) {
        try {
            // Prevent auto redirect to capture cookies
            const response = await axios.get(jumpUrl, {
                maxRedirects: 0,
                validateStatus: status => status >= 200 && status < 400,
                headers: {
                    'User-Agent': ChromeUA
                }
            });

            // This might return 302 Found
            return response.headers['set-cookie'];
        } catch (error) {
            console.error("Get Final Cookies Error", error);
            return [];
        }
    }
}

class MiniProgramLoginSession {
    static QUA = 'V1_HT5_QDT_0.70.2209190_x64_0_DEV_D';

    /**
     * Mini Program Presets
     */
    static Presets = {
        miniprogram: {
            name: '小程序开发 (DevTools)',
            description: 'QQ小程序开发者工具',
            appid: '' // User provided
        },
        farm: {
            name: 'QQ经典农场 (Farm)',
            description: 'QQ经典农场小程序',
            appid: '1112386029'
        }
    };

    static getHeaders() {
        return {
            'qua': MiniProgramLoginSession.QUA,
            'host': 'q.qq.com',
            'accept': 'application/json',
            'content-type': 'application/json',
            'user-agent': ChromeUA
        };
    }

    /**
     * Request Login Code (for Mini Program DevTools)
     */
    static async requestLoginCode() {
        try {
            const response = await axios.get('https://q.qq.com/ide/devtoolAuth/GetLoginCode', {
                headers: this.getHeaders()
            });

            const { code, data } = response.data;

            if (+code !== 0) {
                throw new Error('获取登录码失败');
            }

            return {
                code: data.code || '',
                url: `https://h5.qzone.qq.com/qqq/code/${data.code}?_proxy=1&from=ide`
            };
        } catch (error) {
            console.error('MP Request Login Code Error:', error);
            throw error;
        }
    }

    /**
     * Query Status for Mini Program Login
     * @param {string} code 
     */
    static async queryStatus(code) {
        try {
            const response = await axios.get(`https://q.qq.com/ide/devtoolAuth/syncScanSateGetTicket?code=${code}`, {
                headers: this.getHeaders()
            });

            // If response is not OK (e.g. 404/500), return Error
            if (response.status !== 200) {
                return { status: 'Error' };
            }

            const { code: resCode, data } = response.data;

            if (+resCode === 0) {
                // data.ok: 1 = Success, 0 = Waiting/Scanning?
                if (+data.ok !== 1) return { status: 'Wait' };
                // User says uin is here
                return { status: 'OK', ticket: data.ticket, uin: data.uin };
            }

            if (+resCode === -10003) return { status: 'Used' };

            return { status: 'Error', msg: `Code: ${resCode}` };
        } catch (error) {
            console.error('MP Query Status Error:', error);
            throw error;
        }
    }

    /**
     * Get Auth Code (Final step for MP login)
     * @param {string} ticket 
     * @param {string} appid 
     */
    static async getAuthCode(ticket, appid) {
        try {
            const response = await axios.post('https://q.qq.com/ide/login', {
                appid: appid,
                ticket: ticket
            }, {
                headers: this.getHeaders()
            });

            if (response.status !== 200) return '';

            const { code } = response.data;
            return code || '';
        } catch (error) {
            console.error('MP Get Auth Code Error:', error);
            return '';
        }
    }
}

module.exports = { QRLoginSession, MiniProgramLoginSession };
