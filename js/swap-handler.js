// ═══════════════════════════════════════════════════════════════
// THORChain Swap Handler v3.1
// ONLY manages: swap widget, metrics, pools, blog, expandable cards
// Does NOT touch: integration cards (Svelte handles those)
// All chain logos: LOCAL from images/chains/
// ═══════════════════════════════════════════════════════════════

(function () {
  'use strict';

  var CONFIG = {
    QUOTE_POLL_MS: 1000,
    STATS_POLL_MS: 15000,
    PRICE_POLL_MS: 10000,
    POOLS_POLL_MS: 30000,
    BLOG_POLL_MS: 300000,
    PRICE_CACHE_TTL: 8000,
    ANIMATION_MS: 600,
  };

  var API = {
    QUOTE: 'https://thornode.ninerealms.com/thorchain/quote/swap',
    NETWORK: 'https://midgard.ninerealms.com/v2/network',
    STATS: 'https://midgard.ninerealms.com/v2/stats',
    POOLS: 'https://midgard.ninerealms.com/v2/pools?status=available',
    COINGECKO: 'https://api.coingecko.com/api/v3/simple/price',
    BLOG_RSS: 'https://api.rss2json.com/v1/api.json?rss_url=https://blog.thorchain.org/rss/',
  };

  // ALL LOCAL chain logos
  var ASSETS = {
    bitcoin:     { id:'BTC.BTC',   s:'BTC',  n:'Bitcoin',      d:8, icon:'images/chains/BTC.svg',  cg:'bitcoin',      c:'#f2a900' },
    ethereum:    { id:'ETH.ETH',   s:'ETH',  n:'Ethereum',     d:8, icon:'images/chains/ETH.svg',  cg:'ethereum',     c:'#716b94' },
    bnb:         { id:'BSC.BNB',   s:'BNB',  n:'BNB Chain',    d:8, icon:'images/chains/BSC.svg',  cg:'binancecoin',  c:'#F0B90B' },
    avalanche:   { id:'AVAX.AVAX', s:'AVAX', n:'Avalanche',    d:8, icon:'images/chains/AVAX.svg', cg:'avalanche-2',  c:'#E84142' },
    cosmos:      { id:'GAIA.ATOM', s:'ATOM', n:'Cosmos Hub',   d:8, icon:'images/chains/GAIA.svg', cg:'cosmos',       c:'#5064fb' },
    dogecoin:    { id:'DOGE.DOGE', s:'DOGE', n:'Dogecoin',     d:8, icon:'images/chains/DOGE.svg', cg:'dogecoin',     c:'#e1b303' },
    bitcoincash: { id:'BCH.BCH',   s:'BCH',  n:'Bitcoin Cash', d:8, icon:'images/chains/BCH.svg',  cg:'bitcoin-cash', c:'#0AC18E' },
    litecoin:    { id:'LTC.LTC',   s:'LTC',  n:'Litecoin',     d:8, icon:'images/chains/LTC.svg',  cg:'litecoin',     c:'#345d9d' },
    base:        { id:'BASE.ETH',  s:'ETH',  n:'Base',         d:8, icon:'images/chains/BASE.svg', cg:'ethereum',     c:'#0052FF' },
    ripple:      { id:'XRP.XRP',   s:'XRP',  n:'Ripple',       d:8, icon:'images/chains/XRP.svg',  cg:'ripple',       c:'#1779ba' },
    tron:        { id:'TRON.TRX',  s:'TRX',  n:'TRON',         d:8, icon:'images/chains/TRON.svg', cg:'tron',         c:'#FF060A' },
    thorchain:   { id:'THOR.RUNE', s:'RUNE', n:'THORChain',    d:8, icon:'images/coins/rune-logo.svg', cg:'thorchain',c:'#00D4AA' },
  };

  var CHAIN_LOGO = {
    BTC:'images/chains/BTC.svg', ETH:'images/chains/ETH.svg', BSC:'images/chains/BSC.svg',
    AVAX:'images/chains/AVAX.svg', GAIA:'images/chains/GAIA.svg', DOGE:'images/chains/DOGE.svg',
    BCH:'images/chains/BCH.svg', LTC:'images/chains/LTC.svg', BASE:'images/chains/BASE.svg',
    XRP:'images/chains/XRP.svg', TRON:'images/chains/TRON.svg', THOR:'images/coins/rune-logo.svg',
  };

  var S = { from:'bitcoin', to:'ethereum', prices:{}, pt:0, lastQ:null, ql:false, qp:null, sp:null, pp:null, plp:null, bp:null, busy:false };

  // ─── UTILS ──────────────────────────────────────────────────

  function ph(l,c){l=(l||'?').charAt(0).toUpperCase();c=c||'#22c55e';return 'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect width="80" height="80" rx="40" fill="'+c+'" opacity=".15"/><text x="40" y="50" text-anchor="middle" font-family="Arial" font-size="32" font-weight="bold" fill="'+c+'">'+l+'</text></svg>');}
  function fUSD(n){if(n==null||isNaN(n))return'$0';if(n>=1e12)return'$'+(n/1e12).toFixed(2)+'T';if(n>=1e9)return'$'+(n/1e9).toFixed(2)+'B';if(n>=1e6)return'$'+(n/1e6).toFixed(2)+'M';if(n>=1e3)return'$'+(n/1e3).toFixed(2)+'K';return'$'+n.toFixed(2);}
  function fN(n,d){d=d||2;if(n==null||isNaN(n))return'0';if(n>=1e9)return(n/1e9).toFixed(d)+'B';if(n>=1e6)return(n/1e6).toFixed(d)+'M';if(n>=1e3)return(n/1e3).toFixed(d)+'K';return n.toFixed(d);}
  function fC(a){if(a==null||isNaN(a))return'0';if(Math.abs(a)>=10000)return a.toFixed(2);if(Math.abs(a)>=100)return a.toFixed(3);if(Math.abs(a)>=1)return a.toFixed(4);return a.toFixed(6);}
  function fB(a,d){return Number(a)/Math.pow(10,d||8);}
  function tB(a,d){return Math.round(Number(a)*Math.pow(10,d||8));}
  function gC(id){return(id||'').split('.')[0];}
  function gS(id){var p=(id||'').split('.');return p.length>1?p[1].split('-')[0]:p[0];}
  function cL(id){return CHAIN_LOGO[gC(id)]||'images/coins/rune-logo.svg';}
  function tS(d){var s=Math.floor((Date.now()-new Date(d).getTime())/1000);if(s<60)return'now';if(s<3600)return Math.floor(s/60)+'m';if(s<86400)return Math.floor(s/3600)+'h';return Math.floor(s/86400)+'d';}
  function esc(s){var d=document.createElement('div');d.textContent=s;return d.innerHTML;}
  function fl(e){if(!e)return;e.classList.remove('tc-fl');void e.offsetWidth;e.classList.add('tc-fl');}

  // ─── STYLES ──────────────────────────────────────────────────

  function injectCSS(){
    if(document.getElementById('tc-css'))return;
    var s=document.createElement('style');s.id='tc-css';
    s.textContent='@keyframes tc-sp{to{transform:rotate(360deg)}}@keyframes tc-fi{from{opacity:0}to{opacity:1}}@keyframes tc-su{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}@keyframes tc-pu{0%,100%{box-shadow:0 0 0 0 rgba(34,197,94,0)}50%{box-shadow:0 0 0 6px rgba(34,197,94,.12)}}@keyframes tc-fb{0%{background:rgba(34,197,94,.2)}100%{background:transparent}}.tc-fl{animation:tc-fb .6s ease-out!important}.tc-sn{display:inline-block;width:16px;height:16px;border:2px solid rgba(34,197,94,.2);border-top-color:#22c55e;border-radius:50%;animation:tc-sp .7s linear infinite}.tc-dt{width:8px;height:8px;border-radius:50%;background:#22c55e;animation:tc-pu 2s infinite;display:inline-block;margin-right:5px;vertical-align:middle}.tc-dd{display:none;position:absolute;top:100%;left:0;right:0;z-index:200;background:#141720;border:1px solid rgba(255,255,255,.1);border-radius:12px;margin-top:4px;max-height:260px;overflow-y:auto;box-shadow:0 12px 40px rgba(0,0,0,.6)}.tc-dd.open{display:block}.tc-di{display:flex;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;transition:background .15s;font-size:13px;color:#e2e8f0}.tc-di:hover{background:rgba(34,197,94,.08)}.tc-qg{display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px}.tc-qc{background:rgba(255,255,255,.04);border-radius:8px;padding:8px 10px}.tc-qc .l{color:#64748b;font-size:11px;margin-bottom:2px}.tc-qc .v{color:#fff;font-weight:600}.tc-pr{display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.04);font-size:12px}.tc-pr:last-child{border-bottom:none}.tc-sb{display:inline-flex;align-items:center;gap:3px;color:#22c55e;font-size:10px;font-weight:600;text-decoration:none;padding:3px 8px;border-radius:6px;border:1px solid rgba(34,197,94,.25);transition:all .2s;flex-shrink:0}.tc-sb:hover{background:rgba(34,197,94,.1);border-color:#22c55e}.tc-st{display:flex;align-items:center;justify-content:space-between;padding:6px 0;font-size:10px;color:#64748b;border-top:1px solid rgba(255,255,255,.04);margin-top:8px}';
    document.head.appendChild(s);
  }

  // ─── API ────────────────────────────────────────────────────

  function fJ(url,t){t=t||12000;return new Promise(function(ok,no){var c=new AbortController();var tm=setTimeout(function(){c.abort();no(new Error('Timeout'));},t);fetch(url,{signal:c.signal}).then(function(r){clearTimeout(tm);if(!r.ok)throw new Error('HTTP '+r.status);return r.json();}).then(ok).catch(function(e){clearTimeout(tm);no(e);});});}
  function fR(url,n){n=(n===undefined)?3:n;return fJ(url).catch(function(e){if(n<=0)throw e;return new Promise(function(r){setTimeout(function(){r(fR(url,n-1));},2000);});});}

  function fetchPrices(){
    if(Object.keys(S.prices).length&&Date.now()-S.pt<CONFIG.PRICE_CACHE_TTL)return Promise.resolve(S.prices);
    var ids={};var ks=Object.keys(ASSETS);for(var i=0;i<ks.length;i++)ids[ASSETS[ks[i]].cg]=1;
    return fJ(API.COINGECKO+'?ids='+Object.keys(ids).join(',')+'&vs_currencies=usd&include_24hr_change=true').then(function(d){S.prices=d;S.pt=Date.now();return d;}).catch(function(){return S.prices;});
  }
  function gP(k){var a=ASSETS[k];return(a&&S.prices[a.cg])?S.prices[a.cg].usd||0:0;}

  // ═══════════════════════════════════════════════════════════
  // SWAP WIDGET
  // ═══════════════════════════════════════════════════════════

  function initSwap(){
    var c=document.querySelector('.app-container.svelte-2em7m7');if(!c)return;
    var sc=c.querySelector('.swap-container.svelte-2em7m7');if(!sc)return;
    sc.innerHTML='';

    // Header
    var h=document.createElement('div');h.className='header svelte-2em7m7';
    h.innerHTML='<img src="images/coins/thorchain-rune-logo.svg" alt="THORChain" class="svelte-2em7m7"><div class="header-title svelte-2em7m7"><span class="tc-dt"></span>THORChain Swap Quote</div>';
    sc.appendChild(h);

    var dv=document.createElement('div');dv.className='divider svelte-2em7m7';sc.appendChild(dv);

    var sel=document.createElement('div');sel.className='asset-selection svelte-2em7m7';

    // Labels
    var lr=document.createElement('div');lr.className='asset-label-container svelte-2em7m7';
    lr.innerHTML='<label class="asset-label svelte-2em7m7">From:</label><label class="asset-label svelte-2em7m7">To:</label>';
    sel.appendChild(lr);

    // Selectors
    var sr=document.createElement('div');sr.className='asset-select-container svelte-2em7m7';
    sr.appendChild(mkSel('tc-f',S.from,function(k){S.from=k;uL();uU();rQ();}));
    sr.appendChild(mkSel('tc-t',S.to,function(k){S.to=k;rQ();}));
    sel.appendChild(sr);

    // Amount
    var ex=document.createElement('div');ex.className='expand svelte-2em7m7';
    var lb=document.createElement('label');lb.className='svelte-2em7m7';lb.id='tc-lb';lb.style.marginTop='12px';
    lb.textContent='Swap Amount ('+ASSETS[S.from].s+'):';ex.appendChild(lb);

    var ic=document.createElement('div');ic.className='amount-input-container svelte-2em7m7';
    var iw=document.createElement('div');iw.className='amount-input-wrapper svelte-2em7m7';
    var inp=document.createElement('input');inp.type='number';inp.id='tc-in';inp.className='input-with-usd svelte-2em7m7';
    inp.placeholder='Enter amount';inp.value='1';inp.min='0';inp.step='any';
    var db=null;inp.addEventListener('input',function(){uU();clearTimeout(db);db=setTimeout(rQ,400);});
    iw.appendChild(inp);

    var ud=document.createElement('div');ud.id='tc-ud';ud.style.cssText='color:#22c55e;font-size:12px;margin-top:4px;text-align:right;font-weight:600;';
    ud.textContent='≈ Loading...';iw.appendChild(ud);ic.appendChild(iw);ex.appendChild(ic);sel.appendChild(ex);

    // Button
    var bt=document.createElement('button');bt.className='svelte-2em7m7';bt.id='tc-bt';
    bt.innerHTML='<span class="tc-dt"></span> Live Quote';
    bt.addEventListener('click',function(){if(S.ql){sQ();bt.innerHTML='Get Quote';}else stQ();});
    sel.appendChild(bt);

    var rs=document.createElement('div');rs.id='tc-rs';sel.appendChild(rs);
    var st=document.createElement('div');st.className='tc-st';st.id='tc-ss';
    st.innerHTML='<span>Ready</span><span></span>';sel.appendChild(st);
    sc.appendChild(sel);

    fetchPrices().then(function(){uU();stQ();});
  }

  function mkSel(id,dk,cb){
    var w=document.createElement('div');w.className='custom-select svelte-2em7m7';w.id=id;
    w.style.position='relative';w.style.cursor='pointer';
    var a=ASSETS[dk];var s=document.createElement('div');s.className='selected svelte-2em7m7';
    rS(s,a);w.appendChild(s);

    var dd=document.createElement('div');dd.className='tc-dd';
    var ks=Object.keys(ASSETS);
    for(var i=0;i<ks.length;i++){(function(k){
      var aa=ASSETS[k];var it=document.createElement('div');it.className='tc-di';
      it.innerHTML='<img src="'+aa.icon+'" alt="" style="width:22px;height:22px;border-radius:50%;" onerror="this.src=\''+ph(aa.s.charAt(0),aa.c)+'\'"><span style="flex:1;">'+aa.n+' ('+aa.s+')</span>';
      it.addEventListener('click',function(e){e.stopPropagation();rS(s,aa);dd.classList.remove('open');cb(k);});
      dd.appendChild(it);
    })(ks[i]);}
    w.appendChild(dd);
    s.addEventListener('click',function(e){e.stopPropagation();cD();dd.classList.toggle('open');});
    return w;
  }

  function rS(el,a){el.innerHTML='<img src="'+a.icon+'" alt="'+a.n+'" class="svelte-2em7m7" style="width:22px;height:22px;border-radius:50%;" onerror="this.src=\''+ph(a.s.charAt(0),a.c)+'\'"><span class="svelte-2em7m7">'+a.n+'</span><svg style="width:12px;height:12px;margin-left:auto;opacity:.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>';}
  function cD(){var ds=document.querySelectorAll('.tc-dd');for(var i=0;i<ds.length;i++)ds[i].classList.remove('open');}
  document.addEventListener('click',cD);
  function uL(){var l=document.getElementById('tc-lb');if(l)l.textContent='Swap Amount ('+ASSETS[S.from].s+'):';}
  function uU(){var e=document.getElementById('tc-ud'),i=document.getElementById('tc-in');if(!e||!i)return;var a=parseFloat(i.value);if(isNaN(a)||a<=0){e.textContent='≈ $0.00';return;}var p=gP(S.from);e.textContent=p>0?'≈ '+fUSD(a*p):'≈ Loading...';}

  // ─── LIVE QUOTE ─────────────────────────────────────────────

  function stQ(){sQ();S.ql=true;var b=document.getElementById('tc-bt');if(b){b.innerHTML='<span class="tc-dt"></span> Live ● Stop';b.style.background='rgba(34,197,94,.1)';}dQ();S.qp=setInterval(dQ,CONFIG.QUOTE_POLL_MS);}
  function sQ(){S.ql=false;if(S.qp){clearInterval(S.qp);S.qp=null;}var b=document.getElementById('tc-bt');if(b){b.innerHTML='Get Quote';b.style.background='';}}
  function rQ(){if(S.ql){sQ();stQ();}}

  function dQ(){
    var inp=document.getElementById('tc-in'),rs=document.getElementById('tc-rs'),ss=document.getElementById('tc-ss');
    if(!inp||!rs)return;
    var amt=parseFloat(inp.value);
    if(isNaN(amt)||amt<=0){qE(rs,'Enter a valid amount');return;}
    if(S.from===S.to){qE(rs,'Select different assets');return;}
    if(S.busy)return;S.busy=true;
    if(ss)ss.innerHTML='<span><span class="tc-sn"></span> Fetching...</span><span>'+new Date().toLocaleTimeString()+'</span>';

    var f=ASSETS[S.from],t=ASSETS[S.to];
    var url=API.QUOTE+'?from_asset='+encodeURIComponent(f.id)+'&to_asset='+encodeURIComponent(t.id)+'&amount='+tB(amt,f.d)+'&streaming_interval=1&streaming_quantity=0';

    fJ(url,8000).then(function(d){
      S.lastQ=d;showQ(rs,d,amt);
      if(ss)ss.innerHTML='<span style="color:#22c55e;">● Live</span><span>'+new Date().toLocaleTimeString()+'</span>';
    }).catch(function(e){
      if(!S.lastQ)qE(rs,qEM(e.message));
      if(ss)ss.innerHTML='<span style="color:#f59e0b;">⚠ Retry</span><span>'+new Date().toLocaleTimeString()+'</span>';
    }).finally(function(){S.busy=false;});
  }

  function qEM(m){if(!m)return'Quote unavailable';if(m.indexOf('not enough')>-1)return'Amount too small';if(m.indexOf('404')>-1)return'Pair not available';if(m.indexOf('Timeout')>-1)return'Timeout — retrying...';return'Quote unavailable';}

  function showQ(el,d,amt){
    var f=ASSETS[S.from],t=ASSETS[S.to];
    var out=fB(parseInt(d.expected_amount_out||'0'),t.d);
    var fees=d.fees||{};var tf=fB(parseInt(fees.total||'0'),t.d);
    var lf=fB(parseInt(fees.liquidity||'0'),t.d);
    var of_=fB(parseInt(fees.outbound||'0'),t.d);
    var af=fB(parseInt(fees.affiliate||'0'),t.d);
    var sl=(parseFloat(fees.slippage_bps||d.slippage_bps||'0'))/100;
    var secs=parseInt(d.inbound_confirmation_seconds||'0')+parseInt(d.outbound_delay_seconds||'0')+parseInt(d.streaming_swap_seconds||'0');
    var mins=Math.max(1,Math.ceil(secs/60));
    var tp=gP(S.to);var rate=amt>0?out/amt:0;
    var sc=sl>3?'#ef4444':sl>1?'#f59e0b':'#22c55e';

    var prev=el.getAttribute('data-p');var chg=prev&&prev!==out.toFixed(6);el.setAttribute('data-p',out.toFixed(6));

    el.innerHTML='<div style="background:rgba(34,197,94,.04);border:1px solid rgba(34,197,94,.1);border-radius:12px;padding:14px;margin-top:8px;">'+
    '<div style="text-align:center;margin-bottom:10px;"><div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.08em;margin-bottom:3px;">You Receive</div>'+
    '<div style="display:flex;align-items:center;justify-content:center;gap:6px;">'+
    '<img src="'+t.icon+'" alt="" style="width:22px;height:22px;border-radius:50%;" onerror="this.src=\''+ph(t.s.charAt(0),t.c)+'\'">'+
    '<span id="tc-ov" style="font-size:20px;font-weight:700;color:#fff;">'+fC(out)+'</span>'+
    '<span style="font-size:13px;color:#94a3b8;font-weight:600;">'+t.s+'</span></div>'+
    (tp>0?'<div style="font-size:11px;color:#22c55e;margin-top:2px;">≈ '+fUSD(out*tp)+'</div>':'')+
    '</div>'+
    '<div class="tc-qg">'+
    '<div class="tc-qc"><div class="l">Rate</div><div class="v">1 '+f.s+' = '+fC(rate)+' '+t.s+'</div></div>'+
    '<div class="tc-qc"><div class="l">Slippage</div><div class="v" style="color:'+sc+'">'+sl.toFixed(2)+'%</div></div>'+
    '<div class="tc-qc"><div class="l">Total Fee</div><div class="v">'+fC(tf)+' '+t.s+'</div></div>'+
    '<div class="tc-qc"><div class="l">Est. Time</div><div class="v">~'+mins+' min</div></div></div>'+
    '<details style="margin-top:8px;"><summary style="color:#64748b;font-size:11px;cursor:pointer;">Fee Breakdown</summary>'+
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:3px;margin-top:6px;font-size:11px;">'+
    '<span style="color:#94a3b8;">Liquidity:</span><span style="color:#e2e8f0;">'+fC(lf)+' '+t.s+'</span>'+
    '<span style="color:#94a3b8;">Outbound:</span><span style="color:#e2e8f0;">'+fC(of_)+' '+t.s+'</span>'+
    '<span style="color:#94a3b8;">Affiliate:</span><span style="color:#e2e8f0;">'+fC(af)+' '+t.s+'</span></div></details>'+
    '<a href="swap.html?sellAsset='+encodeURIComponent(f.id)+'&buyAsset='+encodeURIComponent(t.id)+'&sellAmount='+amt+'" '+
    'style="display:block;margin-top:10px;text-align:center;background:linear-gradient(135deg,#22c55e,#16a34a);color:#000;font-weight:700;font-size:13px;padding:10px;border-radius:10px;text-decoration:none;transition:transform .15s,box-shadow .2s;" '+
    'onmouseover="this.style.transform=\'scale(1.02)\';this.style.boxShadow=\'0 4px 20px rgba(34,197,94,.3)\'" '+
    'onmouseout="this.style.transform=\'scale(1)\';this.style.boxShadow=\'none\'">'+
    'Swap '+f.s+' → '+t.s+'</a></div>';

    if(chg)fl(document.getElementById('tc-ov'));
  }

  function qE(el,m){el.innerHTML='<div style="background:rgba(239,68,68,.06);border:1px solid rgba(239,68,68,.15);border-radius:10px;padding:12px;margin-top:8px;text-align:center;"><div style="color:#ef4444;font-size:12px;font-weight:600;">⚠ '+esc(m)+'</div></div>';}

  // ═══════════════════════════════════════════════════════════
  // METRICS
  // ═══════════════════════════════════════════════════════════

  function renderMetrics(){
    Promise.all([fR(API.NETWORK),fR(API.STATS),fetchPrices()]).then(function(r){
      var net=r[0],stats=r[1];var rp=gP('thorchain');if(!rp&&stats.runePriceUSD)rp=parseFloat(stats.runePriceUSD);
      var pooled=fB(parseInt(net.totalPooledRune||'0'));var liq=pooled*rp*2;
      var bond=0;if(net.totalActiveBond)bond=fB(parseInt(net.totalActiveBond));
      else if(net.activeBonds){var sm=0;for(var i=0;i<net.activeBonds.length;i++)sm+=parseInt(net.activeBonds[i]||'0');bond=fB(sm);}
      var bv=bond*rp;var tvl=liq+bv;var vol=fB(parseInt(stats.swapVolume||'0'))*rp;
      var earn=fB(parseInt(stats.earnings||'0'))*rp;var sc=parseInt(stats.swapCount||'0');
      var nodes=parseInt(net.activeNodeCount||'0');var apy=parseFloat(net.bondingAPY||'0')*100;

      var vals=[fUSD(tvl),fUSD(liq),fUSD(bv),fUSD(vol),fUSD(earn),fN(sc,0),fUSD(vol),String(nodes),apy.toFixed(1)+'%'];
      var ms=document.querySelectorAll('.metric-margin.svelte-fk41rr');
      for(var i=0;i<ms.length&&i<vals.length;i++){
        var v=ms[i].querySelectorAll('h1')[1];if(v){
          var old=v.textContent.trim();v.textContent=vals[i];v.classList.remove('bg-green','opacity-20');v.style.color='#fff';
          if(old&&old!=='\u00a0'&&old!==''&&old!==vals[i])fl(v);
        }
      }
      var g=document.querySelector('.grid.animate-pulse');if(g)g.classList.remove('animate-pulse');
    }).catch(function(){
      var ms=document.querySelectorAll('.metric-margin.svelte-fk41rr');
      for(var i=0;i<ms.length;i++){var v=ms[i].querySelectorAll('h1')[1];if(v&&(v.textContent.trim()==='\u00a0'||v.textContent.trim()==='')){v.textContent='—';v.classList.remove('bg-green','opacity-20');v.style.color='#64748b';}}
      var g=document.querySelector('.grid.animate-pulse');if(g)g.classList.remove('animate-pulse');
    });
  }

  // ═══════════════════════════════════════════════════════════
  // TOP 5 POOLS
  // ═══════════════════════════════════════════════════════════

  function renderPools(){
    fR(API.POOLS).then(function(pools){
      pools.sort(function(a,b){return parseInt(b.volume24h||'0')-parseInt(a.volume24h||'0');});
      var top=pools.slice(0,5);var rp=gP('thorchain');
      var cont=document.querySelector('.button-container.svelte-h3q2qi');if(!cont)return;
      var ld=cont.querySelector('.animate-pulse');var ex=document.getElementById('tc-pl');

      if(ex){
        for(var i=0;i<top.length&&i<5;i++){
          var row=document.getElementById('tc-r'+i);if(!row)continue;
          var vl=fB(parseInt(top[i].volume24h||'0'))*(rp||1);var ap=parseFloat(top[i].poolAPY||'0')*100;
          var ve=row.querySelector('.tc-vl');var ae=row.querySelector('.tc-ap');
          if(ve){var ov=ve.textContent;ve.textContent=fUSD(vl);if(ov!==ve.textContent)fl(ve);}
          if(ae)ae.textContent=ap.toFixed(1)+'%';
        }
        var te=document.getElementById('tc-pt');if(te)te.textContent=new Date().toLocaleTimeString();
        return;
      }
      if(!ld)return;

      var div=document.createElement('div');div.id='tc-pl';div.style.marginTop='12px';
      div.innerHTML='<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;"><div style="display:flex;align-items:center;gap:5px;"><span class="tc-dt"></span><span style="font-size:11px;font-weight:700;color:#22c55e;text-transform:uppercase;letter-spacing:.08em;">Top Pools (Live)</span></div><span style="font-size:10px;color:#64748b;" id="tc-pt">'+new Date().toLocaleTimeString()+'</span></div>';

      for(var i=0;i<top.length;i++){
        var p=top[i];var asset=p.asset||'';var ch=gC(asset);var sy=gS(asset);
        var logo=cL(asset);var vl=fB(parseInt(p.volume24h||'0'))*(rp||1);var ap=parseFloat(p.poolAPY||'0')*100;
        var row=document.createElement('div');row.className='tc-pr';row.id='tc-r'+i;
        row.style.animation='tc-fi .3s ease '+(i*.05)+'s both';
        row.innerHTML='<img src="'+logo+'" alt="" style="width:20px;height:20px;border-radius:50%;" onerror="this.src=\''+ph(sy.charAt(0))+'\'">'+
        '<div style="flex:1;min-width:0;"><div style="color:#fff;font-weight:600;font-size:12px;">'+ch+'.'+sy+'</div>'+
        '<div class="tc-vl" style="color:#64748b;font-size:10px;">'+fUSD(vl)+'</div></div>'+
        '<div style="text-align:right;margin-right:6px;"><span class="tc-ap" style="color:#22c55e;font-size:11px;font-weight:700;">'+ap.toFixed(1)+'%</span>'+
        '<span style="color:#64748b;font-size:10px;"> APY</span></div>'+
        '<a href="swap.html?sellAsset=THOR.RUNE&buyAsset='+encodeURIComponent(asset)+'" class="tc-sb">Swap</a>';
        div.appendChild(row);
      }
      ld.replaceWith(div);
    }).catch(function(){});
  }

  // ═══════════════════════════════════════════════════════════
  // BLOG
  // ═══════════════════════════════════════════════════════════

  function renderBlog(){
    var grid=document.querySelector('.grid.grid-cols-1.md\\:grid-cols-3.gap-6.mt-12');if(!grid)return;
    fJ(API.BLOG_RSS).then(function(d){
      if(!d||!d.items||!d.items.length)return;grid.innerHTML='';
      var posts=d.items.slice(0,3);
      for(var i=0;i<posts.length;i++){
        var p=posts[i];var thumb=p.thumbnail||(p.enclosure&&p.enclosure.link)||'';
        var tmp=document.createElement('div');tmp.innerHTML=p.description||'';
        var desc=(tmp.textContent||'').substring(0,120);if(desc.length>=120)desc+='...';
        var card=document.createElement('a');card.href=p.link||'#';card.target='_blank';card.rel='noopener noreferrer';
        card.className='svelte-mhth7d';card.style.cssText='text-decoration:none;display:block;border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,.05);background:rgba(255,255,255,.02);transition:all .3s;';
        card.onmouseenter=function(){this.style.transform='translateY(-3px)';this.style.borderColor='rgba(34,197,94,.25)';};
        card.onmouseleave=function(){this.style.transform='';this.style.borderColor='rgba(255,255,255,.05)';};
        card.innerHTML='<div style="aspect-ratio:16/10;overflow:hidden;background:#0f172a;">'+(thumb?'<img src="'+thumb+'" alt="" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display=\'none\'">':'<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;"><img src="images/coins/thorchain-rune-logo.svg" style="width:40px;opacity:.2;"></div>')+'</div><div style="padding:14px;"><h3 style="color:#fff;font-weight:700;font-size:14px;line-height:1.4;margin-bottom:5px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">'+esc(p.title||'Untitled')+'</h3><p style="color:#94a3b8;font-size:12px;line-height:1.5;margin-bottom:8px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">'+esc(desc)+'</p><div style="display:flex;justify-content:space-between;align-items:center;"><span style="color:#64748b;font-size:11px;">'+tS(p.pubDate)+'</span><span style="color:#22c55e;font-size:11px;font-weight:600;">Read →</span></div></div>';
        grid.appendChild(card);
      }
    }).catch(function(){});
  }

  // ═══════════════════════════════════════════════════════════
  // EXPANDABLE CARDS
  // ═══════════════════════════════════════════════════════════

  function initCards(){
    var cards=document.querySelectorAll('.card-hover-effect.svelte-12c62a');
    var descs=['Swap native assets on-chain without wrapped tokens or bridges.','Large swaps split into sub-swaps for 5-10x better execution.','Deposit either asset or both for deep cross-chain liquidity.','Routes through 1inch, Uniswap & more for optimal rates.','Deposit memos enable limit orders and DCA strategies.','Validator bonds exceed pooled assets ensuring fund safety.'];
    for(var i=0;i<cards.length;i++){(function(card,desc){
      card.style.cursor='pointer';var inner=card.querySelector('.flex.flex-col');if(!inner)return;
      var de=document.createElement('div');de.style.cssText='max-height:0;overflow:hidden;transition:max-height .4s,opacity .3s,margin-top .3s;opacity:0;font-size:13px;color:#94a3b8;line-height:1.6;margin-top:0;';
      de.textContent=desc;inner.appendChild(de);var open=false;
      card.addEventListener('click',function(){open=!open;var arrow=card.querySelector('.expand-arrow');
      de.style.maxHeight=open?'250px':'0';de.style.opacity=open?'1':'0';de.style.marginTop=open?'10px':'0';
      if(arrow)arrow.style.transform=open?'rotate(180deg)':'';});
    })(cards[i],descs[i]||'');}
  }

  // ═══════════════════════════════════════════════════════════
  // NEWSLETTER FAB
  // ═══════════════════════════════════════════════════════════

  function initFAB(){
    var fab=document.querySelector('.fixed.bottom-6.right-6 button');if(!fab)return;
    fab.addEventListener('click',function(){
      var ov=document.createElement('div');ov.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.7);z-index:1000;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);animation:tc-fi .2s;';
      ov.innerHTML='<div style="background:#141720;border:1px solid rgba(255,255,255,.08);border-radius:20px;padding:28px;max-width:400px;width:90%;animation:tc-su .3s;position:relative;"><button id="tc-cm" style="position:absolute;top:10px;right:12px;background:none;border:none;color:#64748b;font-size:18px;cursor:pointer;" onmouseover="this.style.color=\'#fff\'" onmouseout="this.style.color=\'#64748b\'">✕</button><div style="text-align:center;margin-bottom:18px;"><img src="images/coins/thorchain-rune-logo.svg" style="width:36px;height:36px;margin:0 auto 10px;"><h2 style="color:#fff;font-size:18px;font-weight:700;">Stay Updated</h2></div><div style="display:flex;flex-direction:column;gap:8px;"><a href="https://blog.thorchain.org/" target="_blank" style="display:flex;align-items:center;gap:12px;padding:12px;border-radius:12px;background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.2);text-decoration:none;"><span style="font-size:20px;">📝</span><div><div style="color:#fff;font-weight:600;font-size:13px;">Blog</div><div style="color:#94a3b8;font-size:11px;">Articles & updates</div></div></a><a href="https://twitter.com/thorchain" target="_blank" style="display:flex;align-items:center;gap:12px;padding:12px;border-radius:12px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);text-decoration:none;"><span style="font-size:20px;">𝕏</span><div><div style="color:#fff;font-weight:600;font-size:13px;">X</div><div style="color:#94a3b8;font-size:11px;">@thorchain</div></div></a><a href="https://discord.gg/c4EhDZdFMA" target="_blank" style="display:flex;align-items:center;gap:12px;padding:12px;border-radius:12px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);text-decoration:none;"><span style="font-size:20px;">💬</span><div><div style="color:#fff;font-weight:600;font-size:13px;">Discord</div><div style="color:#94a3b8;font-size:11px;">Community</div></div></a></div></div>';
      document.body.appendChild(ov);
      function cl(){ov.style.opacity='0';ov.style.transition='opacity .2s';setTimeout(function(){ov.remove();},200);}
      document.getElementById('tc-cm').onclick=cl;ov.addEventListener('click',function(e){if(e.target===ov)cl();});
    });
  }

  // ═══════════════════════════════════════════════════════════
  // MOBILE MENU
  // ═══════════════════════════════════════════════════════════

  function initMobile(){
    var btn=document.querySelector('.xl\\:hidden .w-6.h-6');if(!btn)return;
    var par=btn.closest('div');if(!par)return;par.style.cursor='pointer';
    par.addEventListener('click',function(){
      if(document.getElementById('tc-mm')){document.getElementById('tc-mm').remove();document.body.style.overflow='';return;}
      var ov=document.createElement('div');ov.id='tc-mm';ov.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.97);z-index:1000;display:flex;flex-direction:column;padding:20px;animation:tc-fi .2s;overflow-y:auto;';
      ov.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;"><a href="index.html"><img src="images/logos/full-dark.png" alt="logo" width="140" height="30"></a><button id="tc-cmm" style="background:none;border:none;color:#fff;font-size:22px;cursor:pointer;">✕</button></div><nav style="display:flex;flex-direction:column;gap:2px;"><a href="swap.html" style="display:block;padding:14px;border-radius:12px;text-decoration:none;color:#22c55e;font-weight:700;font-size:17px;background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.2);">⚡ Swap</a><a href="ecosystem.html" style="padding:14px;text-decoration:none;color:#fff;font-weight:600;font-size:17px;">Ecosystem</a><a href="https://blog.thorchain.org/" target="_blank" style="padding:14px;text-decoration:none;color:#fff;font-weight:600;font-size:17px;">Blog</a><a href="integrate.html" style="padding:14px;text-decoration:none;color:#fff;font-weight:600;font-size:17px;">Integrate</a><a href="tcy.html" style="padding:14px;text-decoration:none;color:#fff;font-weight:600;font-size:17px;">TCY</a><a href="rune.html" style="padding:14px;text-decoration:none;color:#fff;font-weight:600;font-size:17px;">RUNE</a></nav>';
      document.body.appendChild(ov);document.body.style.overflow='hidden';
      document.getElementById('tc-cmm').onclick=function(){ov.remove();document.body.style.overflow='';};
    });
  }

  // ═══════════════════════════════════════════════════════════
  // POLLING + VISIBILITY
  // ═══════════════════════════════════════════════════════════

  function startPoll(){
    S.sp=setInterval(renderMetrics,CONFIG.STATS_POLL_MS);
    S.pp=setInterval(function(){fetchPrices().then(uU);},CONFIG.PRICE_POLL_MS);
    S.plp=setInterval(renderPools,CONFIG.POOLS_POLL_MS);
    S.bp=setInterval(renderBlog,CONFIG.BLOG_POLL_MS);
  }
  function stopAll(){sQ();clearInterval(S.sp);clearInterval(S.pp);clearInterval(S.plp);clearInterval(S.bp);}
  document.addEventListener('visibilitychange',function(){if(document.hidden)stopAll();else{renderMetrics();fetchPrices().then(uU);renderPools();startPoll();if(S.ql)stQ();}});

  // ═══════════════════════════════════════════════════════════
  // INIT — Does NOT touch integration cards (Svelte handles those)
  // ═══════════════════════════════════════════════════════════

  function init(){
    console.log('[THORChain] v3.1 init — swap widget, metrics, pools, blog');
    injectCSS();
    initSwap();
    renderMetrics();
    // DO NOT render integration cards — Svelte JS handles those via Integrated-edd2fdf7.js
    renderBlog();
    renderPools();
    initCards();
    initFAB();
    initMobile();
    startPoll();
    console.log('[THORChain] ✓ Ready | Quote:1s | Prices:10s | Stats:15s | Pools:30s');
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
