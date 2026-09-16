// GrainBroker shared navigation and verified website intake.
(function () {
  var btn=document.querySelector('.menu-btn'), links=document.querySelector('.nav-links');
  if(btn&&links)btn.addEventListener('click',function(){links.classList.toggle('open');btn.setAttribute('aria-expanded',links.classList.contains('open'));});
  window.GB_CONFIG={buyerIntakeUrl:'https://grainbroker-intake.jackharrington.workers.dev',turnstileSiteKey:'0x4AAAAAAE3G_m70pehYdim8',phoneDisplay:'0414 503 466',fallbackEmail:'info@grainbroker.com.au',buyerCheckFormEndpoint:'https://4e07af79.sibforms.com/serve/MUIFAF4JSYeF1sh00OXN8UCwc5-V_9Gl-KVslk6Bmds0o6XTDv8CU5p_zwNTYeUxoSco4CtYM5mCoXR5SSCDCCZ4NGhZpNCQ8ZTjmRTGpT3YMgv94WgN4CDnsUq7dWKkKoHMf0-ShJ6tlaOs9XuyWuG5BRJu4gqSdT_5rFeewo0pLa_CUeOmK2UGS2kSKMB8_HhJyriaWa0Kk_yWnQ=='};
  var scriptPromise, widget, busy=false, pending={};
  function verification(){
    if(!scriptPromise)scriptPromise=new Promise(function(resolve,reject){
      if(window.turnstile){resolve();return;}
      var script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;
      script.onload=resolve;script.onerror=function(){scriptPromise=null;reject(Error('Verification could not load. Please try again.'));};document.head.appendChild(script);
    });
    return scriptPromise.then(function(){return new Promise(function(resolve,reject){
      var host=document.getElementById('gb-turnstile-host');
      if(!host){host=document.createElement('div');host.id='gb-turnstile-host';host.style.margin='16px 0';var button=document.getElementById('submit')||document.getElementById('wnav');button.parentNode.insertBefore(host,button);}
      if(widget!==undefined){window.turnstile.remove(widget);widget=undefined;}
      var finished=false;
      var timer=setTimeout(function(){finish(Error('Verification timed out. Please try again.'));},90000);
      function finish(error,token){if(finished)return;finished=true;clearTimeout(timer);if(error)reject(error);else resolve(token);}
      widget=window.turnstile.render(host,{sitekey:window.GB_CONFIG.turnstileSiteKey,theme:'light',callback:function(token){finish(null,token);},'error-callback':function(){finish(Error('Verification failed. Please try again.'));},'expired-callback':function(){finish(Error('Verification expired. Please try again.'));}});
    });});
  }
  async function submit(body,done){
    if(busy){done(false,'Please wait for your current submission.');return;}busy=true;
    var key,id;
    try{
      var hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(body)));
      key='gb-enquiry-'+Array.from(new Uint8Array(hash),function(b){return b.toString(16).padStart(2,'0');}).join('');
      try{id=sessionStorage.getItem(key);}catch(e){}
      id=id||pending[key]||crypto.randomUUID();pending[key]=id;
      try{sessionStorage.setItem(key,id);}catch(e){}
      body.submissionId=id;body.turnstileToken=await verification();
      var response=await fetch(window.GB_CONFIG.buyerIntakeUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(60000)});
      var data=await response.json();
      if(!response.ok||data.ok!==true)throw Error(data.error||'Please call 0414 503 466 to confirm your enquiry.');
      delete pending[key];try{sessionStorage.removeItem(key);}catch(e){}
      var host=document.getElementById('gb-turnstile-host');if(host)host.hidden=true;
      busy=false;done(true,null);
    }catch(e){busy=false;done(false,e.message||'Connection failed. Please try again.');}
  }
  window.gbSubmitYes=function(fields,done){submit(Object.assign({},fields,{type:'yes'}),done);};
  window.gbSubmitGrower=function(fields,done){submit(Object.assign({},fields,{type:'grower'}),done);};
  window.gbSubmit=function(summary,fields,done){
    var details=['COMMODITY','GRADE','TONNES','DELIVERY','WINDOW','PRICE','PRICE_BASIS','PAYMENT_TERMS','NOTES'].filter(function(k){return fields[k];}).map(function(k){return (k==='PRICE'?'Target price ($/t, excluding GST)':k[0]+k.slice(1).toLowerCase().replace(/_/g,' '))+': '+fields[k];}).join('\n');
    submit(Object.assign({},fields,{type:'buyer',needs:details||summary}),done);
  };
  window.gbSubmitBuyerCheck=function(fields,done){
    var data=new FormData();data.append('EMAIL',fields.email||'');data.append('BUYER_DEMAND',fields.demand||'');data.append('email_address_check','');data.append('locale','en');
    fetch(window.GB_CONFIG.buyerCheckFormEndpoint.replace('/serve/','/v2/serve/'),{method:'POST',body:data}).then(function(r){done(r.ok);}).catch(function(){done(false);});
  };
})();
