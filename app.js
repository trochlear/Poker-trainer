"use strict";
const V="7.2",KEY="pokerTrainerState",R=["2","3","4","5","6","7","8","9","T","J","Q","K","A"],S=["♠","♥","♦","♣"],RV=Object.fromEntries(R.map((r,i)=>[r,i+2])),H=0,SB=50,BB=100,START=10000;
const CAT=["하이카드","원페어","투페어","트립스","스트레이트","플러시","풀하우스","포카드","스트레이트 플러시"];
const T=[{name:"나",style:"Human",type:"human"},{name:"Bot A",style:"TAG · 정석",type:"tag"},{name:"Bot B",style:"LAG · 공격",type:"lag"},{name:"Bot C",style:"Calling Station",type:"call"}];
let cfg={auto:true,nextDelay:1200,botDelay:1000,durationEnd:0,untilEnd:0,maxHands:0,loss:0,profit:0,bust:true,stopped:false,reason:""},G={},bt=0,nt=0;

const $=id=>document.getElementById(id),r50=n=>Math.max(50,Math.round(n/50)*50);
function deck(){let d=[];for(const s of S)for(const r of R)d.push({r,s});return d}
function shuffle(a){for(let i=a.length-1;i;i--){let j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function ct(c){return c.r+c.s}function red(c){return c.s==="♥"||c.s==="♦"}
function comb(a,k){let o=[];function f(i,x){if(x.length===k){o.push(x.slice());return}for(let j=i;j<=a.length-(k-x.length);j++){x.push(a[j]);f(j+1,x);x.pop()}}f(0,[]);return o}
function sh(v){let u=[...new Set(v)].sort((a,b)=>b-a);if(u.includes(14))u.push(1);for(let i=0;i<=u.length-5;i++)if(u[i]-u[i+4]===4)return u[i];return 0}
function e5(c){let v=c.map(x=>RV[x.r]).sort((a,b)=>b-a),n={};v.forEach(x=>n[x]=(n[x]||0)+1);let g=Object.entries(n).map(([v,n])=>({v:+v,n})).sort((a,b)=>b.n-a.n||b.v-a.v),fl=c.every(x=>x.s===c[0].s),st=sh(v);if(fl&&st)return[8,st];if(g[0].n===4)return[7,g[0].v,g[1].v];if(g[0].n===3&&g[1].n===2)return[6,g[0].v,g[1].v];if(fl)return[5,...v];if(st)return[4,st];if(g[0].n===3)return[3,g[0].v,...g.filter(x=>x.n===1).map(x=>x.v).sort((a,b)=>b-a)];if(g[0].n===2&&g[1].n===2){let hi=Math.max(g[0].v,g[1].v),lo=Math.min(g[0].v,g[1].v),k=g.find(x=>x.n===1).v;return[2,hi,lo,k]}if(g[0].n===2)return[1,g[0].v,...g.filter(x=>x.n===1).map(x=>x.v).sort((a,b)=>b-a)];return[0,...v]}
function cmp(a,b){for(let i=0;i<Math.max(a.length,b.length);i++){let x=a[i]||0,y=b[i]||0;if(x!==y)return x-y}return 0}
function best(c){let b=null;for(const x of comb(c,5)){let s=e5(x);if(!b||cmp(s,b)>0)b=s}return b}

function fresh(t){return{...t,stack:START,hole:[],fold:false,allin:false,sc:0,hc:0,last:"",pos:""}}
function alive(){return G.p.map((p,i)=>p.stack>0?i:null).filter(x=>x!==null)}
function next(i){for(let k=1;k<=4;k++){let j=(i+k)%4;if(G.p[j].stack>0)return j}return i}
function live(){return G.p.map((p,i)=>!p.fold?i:null).filter(x=>x!==null)}
function nextIn(i){for(let k=1;k<=4;k++){let j=(i+k)%4,p=G.p[j];if(!p.fold&&!p.allin&&p.stack>0)return j}return null}
function pot(){G.pot=G.p.reduce((s,p)=>s+p.hc,0)}
function pack(){return{v:V,cfg,G:{...G,need:[...(G.need||new Set())]}}}
function save(){try{localStorage.setItem(KEY,JSON.stringify(pack()))}catch(e){}}
function load(){try{let x=JSON.parse(localStorage.getItem(KEY)||"null");if(!x?.G?.p||x.G.p.length!==4)return false;cfg={...cfg,...x.cfg};G={...x.G,need:new Set(x.G.need||[])};return true}catch(e){return false}}
function timers(){clearTimeout(bt);clearTimeout(nt)}
function positions(){
 G.p.forEach(p=>p.pos="");let a=alive(),d=G.d;
 if(a.length===2){G.p[d].pos="BTN/SB";G.sb=d;G.bb=next(d);G.p[G.bb].pos="BB";return}
 G.p[d].pos="BTN";G.sb=next(d);G.bb=next(G.sb);G.p[G.sb].pos="SB";G.p[G.bb].pos="BB";
 let r=a.filter(i=>![d,G.sb,G.bb].includes(i));if(r.length)G.p[r[0]].pos="CO";
}
function blind(i,n,label){let p=G.p[i],x=Math.min(n,p.stack);p.stack-=x;p.sc+=x;p.hc+=x;p.last=`${label} ${x}`;if(!p.stack)p.allin=true}
function log(s){G.log.push(s);if(G.log.length>250)G.log=G.log.slice(-250);render()}
function reset(){timers();cfg={auto:true,nextDelay:1200,botDelay:1000,durationEnd:0,untilEnd:0,maxHands:0,loss:0,profit:0,bust:true,stopped:false,reason:""};G={p:T.map(fresh),d:3,n:0,dck:[],all:[],board:[],street:"idle",bet:0,min:BB,pot:0,need:new Set(),actor:null,over:true,reveal:false,sb:0,bb:0,log:[],lastC:[0,0,0,0],result:""};sync();newHand()}
function reason(){
 let now=Date.now(),me=G.p?.[H];
 if(cfg.stopped)return cfg.reason||"사용자 정지";
 if(cfg.durationEnd&&now>=cfg.durationEnd)return"설정한 플레이 시간 종료";
 if(cfg.untilEnd&&now>=cfg.untilEnd)return"설정한 종료 시각 도달";
 if(cfg.maxHands>0&&G.n>=cfg.maxHands)return`최대 ${cfg.maxHands}핸드 도달`;
 if(me&&cfg.loss>0&&me.stack<=cfg.loss)return`내 스택 ${cfg.loss} 이하`;
 if(me&&cfg.profit>0&&me.stack>=cfg.profit)return`내 스택 ${cfg.profit} 이상`;
 if(cfg.bust&&G.p?.some(p=>p.stack<=0))return"플레이어 1명 파산";
 return"";
}
function stop(r){cfg.stopped=true;cfg.reason=r||"세션 정지";timers();save();render()}
function nextAuto(){clearTimeout(nt);let r=reason();if(r){stop(r);return}if(cfg.auto&&G.over&&!cfg.stopped&&alive().length>=2)nt=setTimeout(newHand,cfg.nextDelay)}
function newHand(){
 timers();let r=reason();if(r&&G.n){stop(r);return}if(alive().length<2){stop("게임 종료");return}
 G.n++;G.d=next(G.d);G.dck=shuffle(deck());G.all=[];G.board=[];G.street="preflop";G.bet=BB;G.min=BB;G.over=false;G.reveal=false;G.result="";
 G.p.forEach(p=>{p.hole=[];p.fold=p.stack<=0;p.allin=false;p.sc=0;p.hc=0;p.last="";p.pos=""});positions();
 let a=alive(),i=next(G.d);for(let r=0;r<2;r++)for(let c=0;c<a.length;c++){G.p[i].hole.push(G.dck.pop());i=next(i)}for(let x=0;x<5;x++)G.all.push(G.dck.pop());
 blind(G.sb,SB,"SB");blind(G.bb,BB,"BB");pot();G.need=new Set(a.filter(i=>!G.p[i].allin));G.actor=nextIn(G.bb);log(`— Hand #${G.n} 시작 —`);log(`BTN ${G.p[G.d].name} · SB ${G.p[G.sb].name} · BB ${G.p[G.bb].name}`);run();
}
function pay(i,n){let p=G.p[i],x=Math.min(n,p.stack);p.stack-=x;p.sc+=x;p.hc+=x;if(!p.stack)p.allin=true;pot();return x}
function clean(){for(const i of[...G.need]){let p=G.p[i];if(p.fold||p.allin||!p.stack)G.need.delete(i)}}
function nxt(i){for(let k=1;k<=4;k++){let j=(i+k)%4;if(G.need.has(j)&&!G.p[j].fold&&!G.p[j].allin)return j}return null}
function act(i,k,to=0){
 if(G.over||cfg.stopped||i!==G.actor)return;let p=G.p[i],call=Math.max(0,G.bet-p.sc),txt="";
 if(k==="fold"){p.fold=true;G.need.delete(i);txt="다이"}
 else if(k==="check"){if(call)return;G.need.delete(i);txt="체크"}
 else if(k==="call"){if(!call){G.need.delete(i);txt="체크"}else{let x=pay(i,call);G.need.delete(i);txt=x<call?`올인 콜 ${x}`:`콜 ${x}`}}
 else if(k==="raise"){
  let max=p.sc+p.stack,target=Math.min(r50(to),max),min=G.bet===0?BB:G.bet+G.min;if(target<=G.bet)return;if(target<min&&target<max)target=min;
  let old=G.bet,x=pay(i,target-p.sc),actual=p.sc;if(actual<=old){G.need.delete(i);txt=`콜 ${x}`}else{let rs=actual-old;if(rs>=G.min)G.min=rs;G.bet=actual;G.need=new Set(live().filter(j=>j!==i&&!G.p[j].allin&&G.p[j].stack>0));txt=old?`레이즈 ${actual}`:`베팅 ${actual}`}
 }
 p.last=txt;log(`${p.name}: ${txt}`);if(i===H)coach(k,call);clean();if(live().length===1){foldWin(live()[0]);return}if(!G.need.size){advance();return}G.actor=nxt(i);run();
}
function advance(){
 if(G.over)return;if(G.street==="river"){show();return}G.p.forEach(p=>{p.sc=0;p.last=""});G.bet=0;G.min=BB;
 if(G.street==="preflop"){G.street="flop";G.board=G.all.slice(0,3)}else if(G.street==="flop"){G.street="turn";G.board=G.all.slice(0,4)}else{G.street="river";G.board=G.all.slice(0,5)}
 log(`--- ${G.street.toUpperCase()} ${G.board.map(ct).join(" ")} ---`);let e=live().filter(i=>!G.p[i].allin&&G.p[i].stack>0);if(!e.length){G.board=G.all.slice();G.street="river";show();return}G.need=new Set(e);for(let k=1;k<=4;k++){let j=(G.d+k)%4;if(G.need.has(j)){G.actor=j;break}}run();
}
function foldWin(w){pot();G.lastC=G.p.map(p=>p.hc);let x=G.pot;G.p[w].stack+=x;G.result=`${G.p[w].name} +${x}`;log(`🏆 ${G.result}`);G.p.forEach(p=>{p.hc=0;p.sc=0});G.pot=0;G.over=true;G.reveal=true;G.actor=null;G.need=new Set();save();render();nextAuto()}
function sidepots(){let c=G.p.map(p=>p.hc),lv=[...new Set(c.filter(x=>x>0))].sort((a,b)=>a-b),o=[],prev=0;for(const l of lv){let con=c.map((x,i)=>x>=l?i:null).filter(x=>x!==null),amt=(l-prev)*con.length,el=con.filter(i=>!G.p[i].fold);if(amt)o.push({amt,el});prev=l}return o}
function show(){
 G.board=G.all.slice();G.reveal=true;G.over=true;G.actor=null;G.lastC=G.p.map(p=>p.hc);let sc={};for(const i of live())sc[i]=best([...G.p[i].hole,...G.board]);let out=[];
 for(const po of sidepots()){let b=null,w=[];for(const i of po.el){let s=sc[i];if(!b||cmp(s,b)>0){b=s;w=[i]}else if(!cmp(s,b))w.push(i)}let sh=Math.floor(po.amt/w.length),rem=po.amt-sh*w.length;w.forEach(i=>G.p[i].stack+=sh);for(let k=1;k<=4&&rem;k++){let i=(G.d+k)%4;if(w.includes(i)){G.p[i].stack++;rem--}}out.push(`${w.map(i=>G.p[i].name).join(", ")} +${po.amt}`)}
 for(const i of live())log(`${G.p[i].name}: ${G.p[i].hole.map(ct).join(" ")} · ${CAT[sc[i][0]]}`);G.result=out.join(" / ");log(`🏆 ${G.result}`);G.p.forEach(p=>{p.hc=0;p.sc=0});G.pot=0;G.need=new Set();save();render();nextAuto();
}

function pre(h){let[a,b]=h,A=RV[a.r],B=RV[b.r],hi=Math.max(A,B),lo=Math.min(A,B),pair=A===B,suit=a.s===b.s,gap=hi-lo,s=pair?.45+hi/28:(hi-2)/12*.35+(lo-2)/12*.12;if(!pair){if(suit)s+=.09;if(gap===1)s+=.07;else if(gap===2)s+=.04;else if(gap>=5)s-=.05;if(hi===14)s+=.1;if(hi>=12&&lo>=10)s+=.1}return Math.max(0,Math.min(1,s))}
function post(i){let p=G.p[i],c=[...p.hole,...G.board];if(c.length<5)return pre(p.hole);let s=best(c),v=s[0]/8+(s[1]-2)/12*.09,n={};c.forEach(x=>n[x.s]=(n[x.s]||0)+1);if(Math.max(...Object.values(n))===4)v+=.08;return Math.max(0,Math.min(1,v))}
function bot(i){
 let p=G.p[i],type=p.type,call=Math.max(0,G.bet-p.sc),price=call?call/(G.pot+call):0,s=G.street==="preflop"?pre(p.hole):post(i);if(p.pos.includes("BTN"))s+=.04;if(p.pos==="SB")s-=.02;
 let ag=.45,lo=.45,bl=.08;if(type==="tag"){ag=.52;lo=.34;bl=.05}if(type==="lag"){ag=.78;lo=.66;bl=.17}if(type==="call"){ag=.25;lo=.72;bl=.025}
 if(!call){if(s>.56-(ag-.5)*.16||Math.random()<bl*(G.street==="preflop"?.5:1)){let base=G.street==="preflop"?250:Math.max(BB,r50(G.pot*({tag:.5,lag:.65,call:.38}[type])));return{kind:"raise",to:Math.min(p.sc+p.stack,Math.max(base,G.bet+G.min))}}return{kind:"check"}}
 let a=s+(lo-.5)*.16-price*.45;if(a>.72-(ag-.5)*.12&&p.stack>call){let t=G.street==="preflop"?r50(G.bet*(type==="lag"?3.4:3)):r50(G.bet+Math.max(G.min,G.pot*(type==="lag"?.6:.45)));t=Math.min(p.sc+p.stack,t);if(t>G.bet)return{kind:"raise",to:t}}
 if(a>.33-(lo-.5)*.18||(type==="call"&&Math.random()<.14))return{kind:"call"};if(type==="lag"&&Math.random()<bl&&p.stack>call+G.min)return{kind:"raise",to:Math.min(p.sc+p.stack,G.bet+Math.max(G.min,r50(G.pot*.55)))};return{kind:"fold"};
}
function run(){clearTimeout(bt);render();if(G.over||cfg.stopped)return;if(G.actor===null){advance();return}if(G.actor===H)return;let a=G.actor,d=bot(a);bt=setTimeout(()=>{if(!G.over&&!cfg.stopped&&G.actor===a)act(a,d.kind,d.to)},cfg.botDelay)}
function coach(k,call){let p=G.p[H],m="";if(G.street==="preflop"){let s=pre(p.hole);if(k==="fold")m=s<.35?"깔끔한 폴드입니다.":"조금 타이트할 수 있습니다.";if(k==="call")m="콜. 가격뿐 아니라 지배당할 가능성도 같이 보세요.";if(k==="raise")m="레이즈. 포지션과 상대 성향도 함께 보세요."}else{if(k==="fold")m="이미 넣은 칩은 잊고 앞으로 낼 칩만 판단하세요.";if(k==="check")m="체크로 팟을 통제했습니다.";if(k==="call")m="콜. 팟오즈와 상대 범위가 핵심입니다.";if(k==="raise")m="베팅/레이즈. 밸류인지 블러프인지 목적을 분명히 해보세요."}$("coach").textContent=m}
function size(f){let p=G.p[H],call=Math.max(0,G.bet-p.sc),t;if(G.bet===0)t=p.sc+r50(G.pot*f);else t=p.sc+call+r50((G.pot+call)*f);let min=G.bet===0?BB:G.bet+G.min,max=p.sc+p.stack;return Math.min(max,Math.max(min,r50(t)))}

function card(c){return`<div class="card ${red(c)?"red":""}"><span>${c.r}</span><span>${c.s}</span></div>`}function back(){return'<div class="card back">X</div>'}
function seat(i){let p=G.p[i],show=i===H||G.reveal,cards=p.hole.length?(show?p.hole.map(card).join(""):back()+back()):"",turn=!G.over&&G.actor===i,hand=G.over?(G.lastC?.[i]||0):p.hc;let e=$("seat"+i);e.className=`seat s${i}${turn?" turn":""}${p.fold?" fold":""}`;e.innerHTML=`<div class="head"><div><div class="nl"><span class="dot ${turn?"on":""}"></span><span class="name">${p.name}</span><span class="pos">${p.pos}</span></div><div class="style">${p.style}</div></div><div class="stack">${p.stack.toLocaleString()}</div></div><div class="cards">${cards}</div><div class="stats"><div class="stat"><div class="lab">이번 핸드</div><div class="val">${hand.toLocaleString()}</div></div><div class="stat"><div class="lab">스트리트</div><div class="val">${p.sc.toLocaleString()}</div></div></div><div class="act">${p.last||"대기"}</div>`}
function remain(ms){if(ms<=0)return"종료 대기";let m=Math.floor(ms/60000),s=Math.floor(ms%60000/1000);return m?`${m}분 ${s}초`:`${s}초`}
function render(){
 if(!G.p)return;for(let i=0;i<4;i++)seat(i);$("board").innerHTML=G.board.map(card).join("");$("pot").textContent=`Pot ${G.pot.toLocaleString()}`;$("hPot").innerHTML=`Pot <b>${G.pot.toLocaleString()}</b>`;$("street").textContent=G.street.toUpperCase();$("hStreet").textContent=G.street.toUpperCase();
 let me=G.p[H],actor=G.actor==null?"-":G.p[G.actor].name;$("hTurn").textContent=`현재 차례: ${cfg.stopped?"세션 정지":G.over?"핸드 종료":actor}`;
 let r=G.result?`<br><span class="good">${G.result}</span>`:"";$("status").innerHTML=`Hand #${G.n} · ${G.street.toUpperCase()}${r}<div class="mine">🂠 내 패 <b>${me.hole.map(ct).join(" ")||"-"}</b></div>`;
 let call=Math.max(0,G.bet-me.sc);$("info").textContent=`현재 베팅 ${G.bet.toLocaleString()} · 내 콜 ${Math.min(call,me.stack).toLocaleString()} · 버전 ${V}`;
 $("summary").innerHTML=G.p.map((p,i)=>{let h=G.over?(G.lastC?.[i]||0):p.hc;return`<div class="sumrow"><span>${p.name}${!G.over&&G.actor===i?" ▶":""}</span><span>핸드 <strong>${h.toLocaleString()}</strong> / 스트리트 <strong>${p.sc.toLocaleString()}</strong></span></div>`}).join("");
 let mine=!G.over&&!cfg.stopped&&G.actor===H;$("controls").style.opacity=mine?"1":".55";["fold","call","amount","raise"].forEach(id=>$(id).disabled=!mine);document.querySelectorAll(".sizeActions button").forEach(b=>b.disabled=!mine);
 $("ctitle").textContent=cfg.stopped?`세션 정지: ${cfg.reason}`:mine?"내 차례 · 액션 선택":G.over?(cfg.auto?"다음 핸드 자동 대기 중":"핸드 종료"):`${actor} 생각 중…`;
 if(mine){$("call").textContent=call?`콜 ${Math.min(call,me.stack).toLocaleString()}`:"체크";let min=G.bet===0?BB:G.bet+G.min,max=me.sc+me.stack,a=$("amount");if(+a.value<Math.min(min,max)||+a.value>max)a.value=Math.min(max,Math.max(min,G.street==="preflop"&&G.bet<=BB?250:r50(G.pot*.5+G.bet)));a.min=Math.min(min,max);a.max=max;$("raise").textContent=G.bet?"레이즈":"베팅"}
 $("log").innerHTML=G.log.map(x=>`<div>${x}</div>`).join("");$("log").scrollTop=$("log").scrollHeight;$("pause").textContent=cfg.stopped?"세션 재개":"세션 정지";save();clock();
}
function clock(){if(!G.p)return;let now=Date.now(),a=[];if(cfg.durationEnd)a.push(`남은 ${remain(cfg.durationEnd-now)}`);if(cfg.untilEnd)a.push(`${new Date(cfg.untilEnd).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}까지`);if(cfg.maxHands)a.push(`${G.n}/${cfg.maxHands}핸드`);$("hTimer").textContent=cfg.stopped?`정지: ${cfg.reason}`:(a.length?a.join(" · "):"세션 제한 없음")}
function sync(){$("auto").checked=cfg.auto;$("nextDelay").value=String(cfg.nextDelay);$("botDelay").value=String(cfg.botDelay);$("hands").value=cfg.maxHands||"";$("loss").value=cfg.loss||"";$("profit").value=cfg.profit||"";$("bust").checked=cfg.bust}
function apply(){cfg.auto=$("auto").checked;cfg.nextDelay=+$("nextDelay").value;cfg.botDelay=+$("botDelay").value;cfg.maxHands=Math.max(0,+$("hands").value||0);cfg.loss=Math.max(0,+$("loss").value||0);cfg.profit=Math.max(0,+$("profit").value||0);cfg.bust=$("bust").checked;let m=Math.max(0,+$("mins").value||0);cfg.durationEnd=m?Date.now()+m*60000:0;let t=$("until").value;if(t){let[hh,mm]=t.split(":").map(Number),d=new Date();d.setHours(hh,mm,0,0);if(+d<=Date.now())d.setDate(d.getDate()+1);cfg.untilEnd=+d}else cfg.untilEnd=0;cfg.stopped=false;cfg.reason="";$("msg").textContent="설정 저장됨. 종료조건은 현재 핸드를 끝낸 뒤 확인합니다.";save();render();G.over?nextAuto():run()}

$("fold").onclick=()=>act(H,"fold");$("call").onclick=()=>act(H,Math.max(0,G.bet-G.p[H].sc)?"call":"check");$("raise").onclick=()=>{let n=+$("amount").value;if(Number.isFinite(n))act(H,"raise",r50(n))};document.querySelectorAll(".sizeActions button").forEach(b=>b.onclick=()=>{if(G.actor===H&&!G.over&&!cfg.stopped){$("amount").value=size(+b.dataset.f);act(H,"raise",+$("amount").value)}});$("apply").onclick=apply;
$("new").onclick=()=>{if(confirm("저장된 스택과 진행상황을 모두 초기화할까요?")){localStorage.removeItem(KEY);reset()}};
$("pause").onclick=()=>{if(cfg.stopped){cfg.stopped=false;cfg.reason="";render();G.over?nextAuto():run()}else stop("사용자가 세션을 정지함")};

if(!load())reset();else{sync();render();if(!cfg.stopped)(G.over?nextAuto():run())}
setInterval(clock,1000);
