"use strict";
const V="8.4",KEY="pokerTrainerState",R=["2","3","4","5","6","7","8","9","T","J","Q","K","A"],S=["♠","♥","♦","♣"],RV=Object.fromEntries(R.map((r,i)=>[r,i+2])),H=0,SB=50,BB=100,START=10000;
const CAT=["하이카드","원페어","투페어","트립스","스트레이트","플러시","풀하우스","포카드","스트레이트 플러시"];
const T=[{name:"나",style:"Human",type:"human"},{name:"Bot A",style:"TAG · 정석",type:"tag"},{name:"Bot B",style:"LAG · 공격",type:"lag"},{name:"Bot C",style:"Calling Station",type:"call"}];

/* ---------- Preflop GTO-lite trainer ----------
   RFI ranges are simplified 100bb cash "implementable GTO" baselines.
   Facing-raise branches are deliberately simplified training heuristics,
   so displayed EV loss is an educational estimate, not solver output. */
const PR="23456789TJQKA";
function rangeSet(spec){
  const out=new Set();
  for(const raw of spec.split(",").map(x=>x.trim()).filter(Boolean)){
    if(!raw.endsWith("+")){out.add(raw);continue}
    const t=raw.slice(0,-1);
    if(t.length===2&&t[0]===t[1]){
      for(let i=PR.indexOf(t[0]);i<PR.length;i++)out.add(PR[i]+PR[i]);
    }else{
      const suited=t.endsWith("s")?"s":t.endsWith("o")?"o":"";
      const core=suited?t.slice(0,-1):t;
      const hi=core[0],lo=core[1],hiI=PR.indexOf(hi),loI=PR.indexOf(lo);
      if(hiI>loI)for(let i=loI;i<hiI;i++)out.add(hi+PR[i]+suited);
    }
  }
  return out;
}
const RFI={
  CO:rangeSet("33+,A2s+,K3s+,Q6s+,J8s+,T7s+,97s+,87s,76s,A8o+,KTo+,QTo+,JTo"),
  BTN:rangeSet("33+,A2s+,K2s+,Q3s+,J4s+,T6s+,96s+,85s+,75s+,64s+,53s+,A4o+,K8o+,Q9o+,J9o+,T8o+,98o"),
  SB:rangeSet("22+,A2s+,K2s+,Q2s+,J2s+,T3s+,94s+,84s+,74s+,63s+,53s+,43s,A2o+,K4o+,Q5o+,J7o+,T7o+,96o+,86o+,76o")
};
const SB_CORE=rangeSet("22+,A2s+,K7s+,Q8s+,J8s+,T8s+,98s,87s,76s,A8o+,KTo+,QTo+,JTo");
const SB_EDGE=new Set([...RFI.SB].filter(x=>!SB_CORE.has(x)));
const OPEN_BLUNDER=rangeSet("QQ+,AKs,AKo");
const VS_OPEN_BLUNDER=rangeSet("KK+,AKs,AKo");
const THREE_IP=rangeSet("QQ+,AQs+,AKo,A5s,A4s");
const CALL_IP=rangeSet("22+,A2s+,K9s+,Q9s+,J9s+,T9s,98s,87s,AQo,AJo,KQo,QJo,JTo");
const THREE_SB=rangeSet("TT+,AJs+,AKo,A5s,A4s,KQs");
const CALL_SB=rangeSet("22,33,44,55,66,77,88,99,A2s+,KTs+,QTs+,JTs,T9s,98s,AQo");
const THREE_BB=rangeSet("JJ+,AQs+,AKo,A5s,A4s,KQs");
const DEF_BB_CO=rangeSet("22+,A2s+,K6s+,Q8s+,J8s+,T8s+,97s+,87s,76s,65s,A7o+,K9o+,Q9o+,J9o+,T9o");
const DEF_BB_BTN=rangeSet("22+,A2s+,K2s+,Q4s+,J6s+,T6s+,96s+,85s+,75s+,64s+,53s+,A2o+,K8o+,Q9o+,J9o+,T8o+,98o");
const DEF_BB_SB=RFI.SB;
const CONT_3B=rangeSet("TT+,AJs+,AQo+,KQs");
const FOUR_BET=rangeSet("QQ+,AKs,AKo");
const MIX_4B=rangeSet("A5s,A4s");
const CONT_4B=rangeSet("QQ+,AKs,AKo,AQs");

function handKey(h){
  if(!h||h.length<2)return"";
  let a=h[0],b=h[1],va=RV[a.r],vb=RV[b.r];
  if(va===vb)return a.r+b.r;
  let hi=va>vb?a:b,lo=va>vb?b:a;
  return hi.r+lo.r+(hi.s===lo.s?"s":"o");
}
function gradeObj(grade,loss,rec,detail,confidence,spot,hand){
  return{grade,loss,rec,detail,confidence,spot,hand};
}
function isIP(pos,opener){ return pos==="BTN"&&opener==="CO"; }
function preflopReview(k,to){
  const p=G.p[H],hand=handKey(p.hole),pos=p.pos,score=pre(p.hole);
  const raises=Number.isFinite(G.preRaises)?G.preRaises:(G.bet>BB?1:0);
  const openPos=G.preOpenPos||"상대";
  const action=k==="check"?"check":k;
  const premium=OPEN_BLUNDER.has(hand),trash=score<.22;
  const mk=(g,l,r,d,cf,sp)=>gradeObj(g,l,r,d,cf,sp,hand);

  if(raises===0){
    if(pos==="CO"||pos==="BTN"){
      const inRange=RFI[pos].has(hand),target=250;
      if(inRange){
        if(action==="raise"){
          const dev=Math.abs((to||target)-target);
          if(dev<=50)return mk("Best",0,`Raise ${target}`,"기준 RFI 범위 안 + 표준 2.5BB 오픈","높음",`${pos} RFI`);
          if(dev<=100)return mk("Good",.05,`Raise ${target}`,`오픈은 맞고 사이징만 기준에서 ${dev}칩 차이`,"높음",`${pos} RFI`);
          return mk("Inaccuracy",.15,`Raise ${target}`,"오픈 자체는 맞지만 사이징이 과하게 벗어남","높음",`${pos} RFI`);
        }
        if(action==="fold")return mk(premium?"Blunder":"Mistake",premium?1.6:.45,`Raise ${target}`,"오픈해야 할 핸드를 폴드함","높음",`${pos} RFI`);
        return mk("Mistake",.35,`Raise ${target}`,"언오픈 팟의 오픈 림프는 간소화 기준에서 제외","높음",`${pos} RFI`);
      }else{
        if(action==="fold")return mk("Best",0,"Fold","기준 오픈 범위 밖","높음",`${pos} RFI`);
        if(action==="raise")return mk(trash?"Mistake":"Inaccuracy",trash?.55:.18,"Fold","기준보다 너무 넓은 오픈","높음",`${pos} RFI`);
        return mk("Mistake",.35,"Fold","범위 밖 핸드로 오픈 림프","높음",`${pos} RFI`);
      }
    }

    if(pos==="SB"||pos==="BTN/SB"){
      const playable=RFI.SB.has(hand),core=SB_CORE.has(hand),edge=SB_EDGE.has(hand),target=300;
      if(playable){
        if(edge){
          if(action==="fold")return mk("Mixed",.02,"Fold / Call / Raise","SB 경계선 핸드: 폴드도 충분히 가능한 혼합 구간","중간","SB mixed");
          if(action==="call")return mk("Mixed",.01,"Fold / Call / Raise","SB 경계선 핸드: 콜·레이즈·폴드가 섞일 수 있음","중간","SB mixed");
          if(action==="raise"){
            const dev=Math.abs((to||target)-target);
            return dev<=100?mk("Mixed",.02,"Fold / Call / Raise","SB 경계선 핸드: 레이즈도 가능한 혼합 구간","중간","SB mixed"):mk("Inaccuracy",.10,`Raise ${target} 또는 Fold`,"참가 자체는 가능하지만 레이즈 크기가 과함","중간","SB mixed");
          }
        }
        if(core){
          if(action==="raise"){
            const dev=Math.abs((to||target)-target);
            return dev<=50?mk("Best",0,"Raise / Call","SB에서 충분히 플레이할 수 있는 핵심 범위","중간","SB core"):mk("Good",.05,`Raise ${target} / Call`,"계속 플레이는 맞고 레이즈 크기만 조정","중간","SB core");
          }
          if(action==="call")return mk("Good",.03,"Raise / Call","SB에서 콜이나 레이즈로 계속할 수 있는 범위","중간","SB core");
          if(action==="fold")return mk(premium?"Blunder":"Inaccuracy",premium?1.2:.18,"Raise / Call","이 패는 SB에서 버리기엔 다소 강함","중간","SB core");
        }
      }else{
        if(action==="fold")return mk("Best",0,"Fold","SB에서도 이 패는 기본적으로 정리하는 쪽","중간","SB fold");
        return mk(trash?"Mistake":"Inaccuracy",trash?.40:.18,"Fold","SB라고 해도 이 패까지 계속하면 너무 넓음","중간","SB fold");
      }
    }

    if(pos==="BB"){
      if(action==="check")return mk("Best",0,"Check","무료 플랍을 보는 상황","중간","BB vs limp/check");
      if(action==="raise")return mk(score>.48?"Good":"Inaccuracy",score>.48?.05:.18,"Check / strong hands Raise","BB 무레이즈 팟은 체크도 정상 선택","중간","BB vs limp/check");
    }
  }

  if(raises===1){
    let three,cont;
    if(pos==="BTN"){three=THREE_IP;cont=CALL_IP}
    else if(pos==="SB"){three=THREE_SB;cont=CALL_SB}
    else if(pos==="BB"){
      three=THREE_BB;
      cont=openPos==="CO"?DEF_BB_CO:openPos==="BTN"?DEF_BB_BTN:DEF_BB_SB;
    }else{three=THREE_IP;cont=CALL_IP}
    const wants3=three.has(hand),wantsContinue=wants3||cont.has(hand);
    const ip=isIP(pos,openPos),target=r50(G.bet*(ip?3.5:4));
    if(wants3){
      if(action==="raise"){
        const dev=Math.abs((to||target)-target);
        return dev<=100?mk("Best",0,`3-bet ${target}`,`${ip?"IP":"OOP"} 기준 3-bet 사이징에 근접`,"중간",`${pos} vs ${openPos} open`):mk("Good",.08,`3-bet ${target}`,"3-bet 선택은 좋고 사이징 조정 필요","중간",`${pos} vs ${openPos} open`);
      }
      if(action==="call")return mk("Inaccuracy",.15,`3-bet ${target}`,"계속 플레이는 맞지만 이 간소화 범위에서는 3-bet 우선","중간",`${pos} vs ${openPos} open`);
      return mk(VS_OPEN_BLUNDER.has(hand)?"Blunder":"Mistake",VS_OPEN_BLUNDER.has(hand)?1.2:.40,`3-bet ${target}`,"강한 continue/3-bet 핸드를 폴드","중간",`${pos} vs ${openPos} open`);
    }
    if(wantsContinue){
      if(action==="call")return mk("Best",0,"Call","간소화 continue 범위 안","중간",`${pos} vs ${openPos} open`);
      if(action==="raise")return mk("Inaccuracy",.18,"Call","continue는 맞지만 3-bet 빈도를 과하게 늘림","중간",`${pos} vs ${openPos} open`);
      return mk("Mistake",.38,"Call","방어 가능한 핸드를 폴드","중간",`${pos} vs ${openPos} open`);
    }
    if(action==="fold")return mk("Best",0,"Fold","간소화 방어 범위 밖","중간",`${pos} vs ${openPos} open`);
    return mk(trash?"Mistake":"Inaccuracy",trash?.45:.22,"Fold","오픈 상대로 너무 넓게 방어","중간",`${pos} vs ${openPos} open`);
  }

  if(raises===2){
    const four=FOUR_BET.has(hand),mix=MIX_4B.has(hand),cont=CONT_3B.has(hand)||four||mix;
    const ip=pos==="BTN",target=r50(G.bet*(ip?2.3:2.5));
    if(four){
      if(action==="raise")return mk("Best",0,`4-bet ${target}`,"강한 4-bet 핵심 범위","낮음","Facing 3-bet");
      if(action==="call")return mk("Good",.08,`4-bet ${target} / 일부 call`,"강한 핸드라 계속 플레이는 정상","낮음","Facing 3-bet");
      return mk("Blunder",1.7,`4-bet ${target}`,"프리미엄 핸드를 3-bet에 폴드","낮음","Facing 3-bet");
    }
    if(mix){
      if(action==="raise"||action==="fold")return mk("Good",.05,"4-bet bluff / Fold mix","A5s/A4s 계열은 블러프 혼합 후보","낮음","Facing 3-bet");
      return mk("Inaccuracy",.15,"4-bet/Fold mix","간소화 기준에서 콜 비중은 낮게 봄","낮음","Facing 3-bet");
    }
    if(cont){
      if(action==="call")return mk("Best",0,"Call","간소화 3-bet 방어 범위","낮음","Facing 3-bet");
      if(action==="fold")return mk("Mistake",.4,"Call","방어 가능한 강한 핸드를 폴드","낮음","Facing 3-bet");
      return mk("Inaccuracy",.2,"Call","4-bet 범위보다 넓게 재레이즈","낮음","Facing 3-bet");
    }
    if(action==="fold")return mk("Best",0,"Fold","3-bet 방어 범위 밖","낮음","Facing 3-bet");
    return mk("Mistake",trash?.65:.40,"Fold","3-bet에 과도하게 계속 플레이","낮음","Facing 3-bet");
  }

  const cont4=CONT_4B.has(hand);
  if(cont4){
    if(action==="fold")return mk("Mistake",.7,"Continue","4-bet 상대로도 계속 가능한 최상단 범위","낮음","Facing 4-bet+");
    return mk("Good",.05,"Continue","상위 프리플랍 범위로 계속 플레이","낮음","Facing 4-bet+");
  }
  if(action==="fold")return mk("Best",0,"Fold","큰 프리플랍 재레이즈에 범위 정리","낮음","Facing 4-bet+");
  return mk("Blunder",1.2,"Fold","4-bet+ 상대로 너무 넓게 계속 플레이","낮음","Facing 4-bet+");
}

function simpleGrade(g){
  return {Best:"🟢 정답에 가까움",Good:"🟢 좋은 선택",Mixed:"🟣 둘 다 가능",Inaccuracy:"🟡 조금 아쉬움",Mistake:"🟠 실수",Blunder:"🔴 큰 실수"}[g]||g;
}
function simpleRec(rec){
  return String(rec||"")
    .replace(/Fold \/ Call \/ Raise/gi,"다이 / 콜 / 레이즈")
    .replace(/Raise \/ Call/gi,"레이즈 또는 콜")
    .replace(/Raise\/Call mix/gi,"레이즈 또는 콜")
    .replace(/4-bet bluff \/ Fold mix/gi,"다시 레이즈 또는 다이")
    .replace(/4-bet/gi,"다시 레이즈")
    .replace(/3-bet/gi,"다시 레이즈")
    .replace(/Raise/gi,"레이즈")
    .replace(/Call/gi,"콜")
    .replace(/Fold/gi,"다이")
    .replace(/Continue/gi,"계속 플레이");
}
function simpleReason(r){
  const d=r.detail||"",sp=r.spot||"";
  if(d.includes("기준 RFI 범위 안"))return "이 자리에서는 이 패로 먼저 레이즈하는 게 기본입니다.";
  if(d.includes("기준 오픈 범위 밖"))return "이 자리에서는 이 패를 버리는 게 기본입니다.";
  if(d.includes("오픈해야 할 핸드를 폴드"))return "이 패는 버리기보다 먼저 레이즈하는 편이 좋습니다.";
  if(d.includes("기준보다 너무 넓은 오픈"))return "이 패까지 레이즈하면 너무 많은 패로 들어가게 됩니다.";
  if(d.includes("오픈 림프"))return "아무도 레이즈하지 않았다면 이 패는 레이즈하거나 버리는 쪽이 기본입니다.";
  if(d.includes("SB는 GTO에서 림프와 레이즈"))return "스몰블라인드에서는 이 패로 콜이나 레이즈 둘 다 가능합니다.";
  if(d.includes("SB 경계선 핸드"))return "스몰블라인드는 한 명만 상대해서 넓게 플레이하지만, 이 정도 경계선 패는 폴드해도 괜찮습니다.";
  if(d.includes("버리기엔 다소 강함"))return "스몰블라인드에서는 이 패를 폴드하기보다 콜이나 레이즈로 계속하는 편이 조금 낫습니다.";
  if(d.includes("플레이 가능한 SB 범위를 폴드"))return "스몰블라인드에서 이 패는 버리기엔 아깝습니다.";
  if(d.includes("SB 참가 범위보다 넓음"))return "스몰블라인드라도 이 패까지 들어가면 너무 넓습니다.";
  if(d.includes("무료 플랍"))return "추가 칩 없이 다음 카드를 볼 수 있으니 체크가 기본입니다.";
  if(d.includes("3-bet 사이징에 근접"))return "상대 레이즈에 다시 레이즈할 만큼 강하고, 금액도 적당합니다.";
  if(d.includes("3-bet 선택은 좋고"))return "다시 레이즈하는 선택은 좋습니다. 금액만 조금 다듬으면 됩니다.";
  if(d.includes("3-bet 우선"))return "이 패는 콜보다 다시 레이즈하는 쪽을 더 자주 씁니다.";
  if(d.includes("continue/3-bet 핸드를 폴드"))return "상대가 레이즈했어도 이 패는 버리기엔 너무 강합니다.";
  if(d.includes("continue 범위 안"))return "상대가 레이즈했지만 이 패는 콜해서 계속할 만합니다.";
  if(d.includes("3-bet 빈도를 과하게"))return "계속 플레이는 맞지만, 다시 레이즈하기엔 조금 약합니다.";
  if(d.includes("방어 가능한 핸드를 폴드"))return "상대 레이즈에도 이 패는 콜할 만합니다.";
  if(d.includes("방어 범위 밖"))return "상대가 먼저 레이즈했다면 이 패는 버리는 편이 기본입니다.";
  if(d.includes("오픈 상대로 너무 넓게 방어"))return "상대 레이즈에 이 패까지 따라가면 너무 넓게 플레이하게 됩니다.";
  if(d.includes("4-bet 핵심 범위"))return "레이즈가 여러 번 나와도 계속 강하게 밀 수 있는 최상위 패입니다.";
  if(d.includes("프리미엄 핸드를 3-bet에 폴드"))return "이 정도 강한 패를 여기서 버리면 너무 아깝습니다.";
  if(d.includes("블러프 혼합 후보"))return "이 패는 가끔 다시 레이즈하는 블러프로 쓰고, 가끔 버리는 패입니다.";
  if(d.includes("3-bet 방어 범위"))return "상대의 재레이즈에도 이 패는 콜해서 계속할 수 있습니다.";
  if(d.includes("큰 프리플랍 재레이즈"))return "레이즈가 여러 번 나온 상황에서는 이 패를 정리하는 게 안전합니다.";
  if(d.includes("4-bet 상대로도 계속"))return "여러 번 재레이즈가 나와도 계속할 만큼 매우 강한 패입니다.";
  if(d.includes("오픈 자체는 맞지만 사이징"))return "레이즈한 판단은 맞고, 금액만 표준보다 조금 큽니다.";
  if(d.includes("오픈은 맞고 사이징만"))return "레이즈한 판단은 맞고, 금액만 조금 다릅니다.";
  return d || (sp.includes("RFI")?"이 자리에서의 기본 시작 패 범위를 기준으로 평가했습니다.":"상대의 프리플랍 레이즈에 대한 기본 대응을 기준으로 평가했습니다.");
}

function recordReview(r){
  if(!r)return;
  G.review=r;
  G.gtoStats=G.gtoStats||{n:0,loss:0,Best:0,Good:0,Mixed:0,Inaccuracy:0,Mistake:0,Blunder:0};
  G.gtoStats.n++;G.gtoStats.loss+=r.loss||0;G.gtoStats[r.grade]=(G.gtoStats[r.grade]||0)+1;
}

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
function reset(){timers();cfg={auto:true,nextDelay:1200,botDelay:1000,durationEnd:0,untilEnd:0,maxHands:0,loss:0,profit:0,bust:true,stopped:false,reason:""};G={p:T.map(fresh),d:3,n:0,dck:[],all:[],board:[],street:"idle",bet:0,min:BB,pot:0,need:new Set(),actor:null,over:true,reveal:false,sb:0,bb:0,log:[],lastC:[0,0,0,0],result:"",review:null,preRaises:0,preOpenPos:"",preOpenSize:0,gtoStats:{n:0,loss:0,Best:0,Good:0,Mixed:0,Inaccuracy:0,Mistake:0,Blunder:0}};sync();newHand()}
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
 G.n++;G.d=next(G.d);G.dck=shuffle(deck());G.all=[];G.board=[];G.street="preflop";G.bet=BB;G.min=BB;G.over=false;G.reveal=false;G.result="";G.review=null;G.preRaises=0;G.preOpenPos="";G.preOpenSize=0;G.gtoStats=G.gtoStats||{n:0,loss:0,Best:0,Good:0,Mixed:0,Inaccuracy:0,Mistake:0,Blunder:0};
 G.p.forEach(p=>{p.hole=[];p.fold=p.stack<=0;p.allin=false;p.sc=0;p.hc=0;p.last="";p.pos=""});positions();
 let a=alive(),i=next(G.d);for(let r=0;r<2;r++)for(let c=0;c<a.length;c++){G.p[i].hole.push(G.dck.pop());i=next(i)}for(let x=0;x<5;x++)G.all.push(G.dck.pop());
 blind(G.sb,SB,"SB");blind(G.bb,BB,"BB");pot();G.need=new Set(a.filter(i=>!G.p[i].allin));G.actor=nextIn(G.bb);log(`— Hand #${G.n} 시작 —`);log(`BTN ${G.p[G.d].name} · SB ${G.p[G.sb].name} · BB ${G.p[G.bb].name}`);run();
}
function pay(i,n){let p=G.p[i],x=Math.min(n,p.stack);p.stack-=x;p.sc+=x;p.hc+=x;if(!p.stack)p.allin=true;pot();return x}
function clean(){for(const i of[...G.need]){let p=G.p[i];if(p.fold||p.allin||!p.stack)G.need.delete(i)}}
function nxt(i){for(let k=1;k<=4;k++){let j=(i+k)%4;if(G.need.has(j)&&!G.p[j].fold&&!G.p[j].allin)return j}return null}
function act(i,k,to=0){
 if(G.over||cfg.stopped||i!==G.actor)return;let p=G.p[i],call=Math.max(0,G.bet-p.sc),txt="";if(i===H&&G.street==="preflop")recordReview(preflopReview(k,to));
 if(k==="fold"){p.fold=true;G.need.delete(i);txt="다이"}
 else if(k==="check"){if(call)return;G.need.delete(i);txt="체크"}
 else if(k==="call"){if(!call){G.need.delete(i);txt="체크"}else{let x=pay(i,call);G.need.delete(i);txt=x<call?`올인 콜 ${x}`:`콜 ${x}`}}
 else if(k==="raise"){
  let max=p.sc+p.stack,target=Math.min(r50(to),max),min=G.bet===0?BB:G.bet+G.min;if(target<=G.bet)return;if(target<min&&target<max)target=min;
  let old=G.bet,x=pay(i,target-p.sc),actual=p.sc;if(actual<=old){G.need.delete(i);txt=`콜 ${x}`}else{let rs=actual-old;if(rs>=G.min)G.min=rs;G.bet=actual;if(G.street==="preflop"){G.preRaises=Number.isFinite(G.preRaises)?G.preRaises:0;if(G.preRaises===0){G.preOpenPos=p.pos;G.preOpenSize=actual}G.preRaises++}G.need=new Set(live().filter(j=>j!==i&&!G.p[j].allin&&G.p[j].stack>0));txt=old?`레이즈 ${actual}`:`베팅 ${actual}`}
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
function coach(k,call){let p=G.p[H],m="";if(G.street==="preflop"){if(G.review)m=`${simpleGrade(G.review.grade)} · 추천 ${simpleRec(G.review.rec)}. ${simpleReason(G.review)}`;else{let s=pre(p.hole);if(k==="fold")m=s<.35?"깔끔한 폴드입니다.":"조금 타이트할 수 있습니다.";if(k==="call")m="콜. 가격뿐 아니라 지배당할 가능성도 같이 보세요.";if(k==="raise")m="레이즈. 포지션과 상대 성향도 함께 보세요."}}else{if(k==="fold")m="이미 넣은 칩은 잊고 앞으로 낼 칩만 판단하세요.";if(k==="check")m="체크로 팟을 통제했습니다.";if(k==="call")m="콜. 팟오즈와 상대 범위가 핵심입니다.";if(k==="raise")m="베팅/레이즈. 밸류인지 블러프인지 목적을 분명히 해보세요."}$("coach").textContent=m}
function size(f){let p=G.p[H],call=Math.max(0,G.bet-p.sc),t;if(G.bet===0)t=p.sc+r50(G.pot*f);else t=p.sc+call+r50((G.pot+call)*f);let min=G.bet===0?BB:G.bet+G.min,max=p.sc+p.stack;return Math.min(max,Math.max(min,r50(t)))}

function card(c){return`<div class="card ${red(c)?"red":""}"><span>${c.r}</span><span>${c.s}</span></div>`}function back(){return'<div class="card back">X</div>'}
function seat(i){let p=G.p[i],show=i===H||G.reveal,cards=p.hole.length?(show?p.hole.map(card).join(""):back()+back()):"",turn=!G.over&&G.actor===i,hand=G.over?(G.lastC?.[i]||0):p.hc;let e=$("seat"+i);e.className=`seat s${i}${turn?" turn":""}${p.fold?" fold":""}`;e.innerHTML=`<div class="head"><div><div class="nl"><span class="dot ${turn?"on":""}"></span><span class="name">${p.name}</span><span class="pos">${p.pos}</span></div><div class="style">${p.style}</div></div><div class="stack">${p.stack.toLocaleString()}</div></div><div class="cards">${cards}</div><div class="stats"><div class="stat"><div class="lab">이번 핸드</div><div class="val">${hand.toLocaleString()}</div></div><div class="stat"><div class="lab">스트리트</div><div class="val">${p.sc.toLocaleString()}</div></div></div><div class="act">${p.last||"대기"}</div>`}
function currentHandLog(){
  if(!G.log||!G.log.length)return[];
  const marker=`— Hand #${G.n} 시작 —`;
  let idx=G.log.lastIndexOf(marker);
  if(idx<0){
    for(let i=G.log.length-1;i>=0;i--){
      if(String(G.log[i]).includes("Hand #")){idx=i;break}
    }
  }
  const lines=idx>=0?G.log.slice(idx):G.log.slice(-8);
  return lines.slice(-7);
}
function remain(ms){if(ms<=0)return"종료 대기";let m=Math.floor(ms/60000),s=Math.floor(ms%60000/1000);return m?`${m}분 ${s}초`:`${s}초`}
function render(){
 if(!G.p)return;for(let i=0;i<4;i++)seat(i);$("board").innerHTML=G.board.map(card).join("");$("pot").textContent=`Pot ${G.pot.toLocaleString()}`;$("hPot").innerHTML=`Pot <b>${G.pot.toLocaleString()}</b>`;$("street").textContent=G.street.toUpperCase();$("hStreet").textContent=G.street.toUpperCase();
 let me=G.p[H],actor=G.actor==null?"-":G.p[G.actor].name;$("hTurn").textContent=`현재 차례: ${cfg.stopped?"세션 정지":G.over?"핸드 종료":actor}`;
 const gf=$("gtoFeedback");
 if(gf){
   if(G.review){
     const cls=G.review.grade.toLowerCase();
     const st=G.gtoStats||{n:0,loss:0};
     const acc=st.n?Math.round(((st.Best||0)+(st.Good||0)+(st.Mixed||0))/st.n*100):0;
     gf.className="gtoFeedback "+cls;
     gf.innerHTML=`<b>${simpleGrade(G.review.grade)}</b><span>추천: ${simpleRec(G.review.rec)} · ${simpleReason(G.review)}</span>`;
   }else{
     gf.className="gtoFeedback idle";
     gf.innerHTML="<b>프리플랍 코치</b><span>먼저 선택해보세요. 누른 뒤 추천 행동과 이유를 한 줄로 알려드립니다.</span>";
   }
 }
 let r=G.result?`<br><span class="good">${G.result}</span>`:"";$("status").innerHTML=`Hand #${G.n} · ${G.street.toUpperCase()}${r}<div class="mine">🂠 내 패 <b>${me.hole.map(ct).join(" ")||"-"}</b></div>`;
 let call=Math.max(0,G.bet-me.sc);$("info").textContent=`현재 베팅 ${G.bet.toLocaleString()} · 내 콜 ${Math.min(call,me.stack).toLocaleString()} · 버전 ${V}`;
 $("summary").innerHTML=G.p.map((p,i)=>{let h=G.over?(G.lastC?.[i]||0):p.hc;return`<div class="sumrow"><span>${p.name}${!G.over&&G.actor===i?" ▶":""}</span><span>핸드 <strong>${h.toLocaleString()}</strong> / 스트리트 <strong>${p.sc.toLocaleString()}</strong></span></div>`}).join("");
 let mine=!G.over&&!cfg.stopped&&G.actor===H;$("controls").style.opacity=mine?"1":".55";["fold","call","amount","raise"].forEach(id=>$(id).disabled=!mine);document.querySelectorAll(".sizeActions button").forEach(b=>b.disabled=!mine);
 $("ctitle").textContent=cfg.stopped?`세션 정지: ${cfg.reason}`:mine?"내 차례 · 액션 선택":G.over?(cfg.auto?"다음 핸드 자동 대기 중":"핸드 종료"):`${actor} 생각 중…`;
 if(mine){$("call").textContent=call?`콜 ${Math.min(call,me.stack).toLocaleString()}`:"체크";let min=G.bet===0?BB:G.bet+G.min,max=me.sc+me.stack,a=$("amount");if(+a.value<Math.min(min,max)||+a.value>max)a.value=Math.min(max,Math.max(min,G.street==="preflop"&&G.bet<=BB?250:r50(G.pot*.5+G.bet)));a.min=Math.min(min,max);a.max=max;$("raise").textContent=G.bet?"레이즈":"베팅"}
 const mini=$("handLogMini");
 if(mini)mini.innerHTML=currentHandLog().map(x=>`<div>${x}</div>`).join("");
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
