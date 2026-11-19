/* Vietnam Field Lab; no radio access. New, MIT educational synthetic model.
 * FHS reader A/B inspired by IEEE IoTaIS 2024; event-state algebra follows
 * independent Ring-108 research. No hardware performance claims.
 */
(()=>{"use strict";
const $=id=>document.getElementById(id);
const offsets=[-.100,-.085,-.065,-.045,-.018,-.009,0,.009,.018,.045,.065,.085,.100];
const left=[0,1,2],middle=[5,6,7],right=[10,11,12];
let latest=null;
function prng(seed){let s=(Math.floor(seed)||1)>>>0;return ()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return(s>>>0)/4294967296;};}
function gaussian(rand){return Math.sqrt(-2*Math.log(Math.max(1e-12,rand())))*Math.cos(2*Math.PI*rand());}
function median(a){const b=a.slice().sort((x,y)=>x-y);return b[Math.floor(b.length/2)];}
function observation(actual,rand,sigma,impulseProbability){
 const delta=.005*gaussian(rand);
 return offsets.map(offset=>{
  const baseline=.4*(offset/.1)+.30*Math.cos(offset*27);
  const notch=actual?-12*Math.exp(-.5*Math.pow((offset-delta)/.02,2)):0;
  return [0,1,2].map(()=>baseline+notch+sigma*gaussian(rand)+(rand()<impulseProbability?(rand()<.5?-18:18):0));
 });
}
function score(matrix,mode){const vals=matrix.map(row=>mode==="mean"?row.reduce((a,b)=>a+b,0)/row.length:median(row));
 const region=indexes=>indexes.reduce((sum,i)=>sum+vals[i],0)/indexes.length;
 return (region(left)+region(right))/2-region(middle);
}
function pct(x){return(100*x).toFixed(1)+"%";}
function benchmark(){
 const sigma=+$("vn-noise").value, impulse=+$("vn-imp").value/100,guard=+$("vn-guard").value;
 const trials=+$("vn-trials").value,seed=+$("vn-seed").value;
 const rand=prng(seed);
 const stats={mean:{correct:0,wrong:0,reject:0,fp:0,fn:0},
              robust:{correct:0,wrong:0,reject:0,fp:0,fn:0}};
 for(let actual=0;actual<=1;actual++)for(let t=0;t<trials;t++){
  const matrix=observation(actual,rand,sigma,impulse);
  for(const mode of ["mean","robust"]){
    const s=stats[mode],depth=score(matrix,mode==="mean"?"mean":"median");
    const pred=mode==="robust"&&Math.abs(depth-4.5)<guard?null:Number(depth>=4.5);
    if(pred===null)s.reject++;
    else if(pred===actual)s.correct++;
    else{s.wrong++;s.fp+=Number(actual===0);s.fn+=Number(actual===1);}
  }
 }
 const n=2*trials,base=stats.mean,rob=stats.robust,accAccepted=rob.correct/(n-rob.reject);
 $("vn-base-acc").textContent=pct(base.correct/n);
 $("vn-robust-acc").textContent=pct(rob.correct/n);
 $("vn-coverage").textContent=pct((n-rob.reject)/n);
 $("vn-accepted").textContent=Number.isFinite(accAccepted)?pct(accAccepted):"—";
 $("vn-table").innerHTML=[["Trung bình",base],["Trung vị + từ chối",rob]].map(([name,s])=>"<tr><td>"+name+"</td><td>"+s.correct+"</td><td>"+s.wrong+"</td><td>"+s.reject+"</td><td>"+s.fp+"</td><td>"+s.fn+"</td></tr>").join("");
 const isBetter=rob.wrong<base.wrong;
 $("vn-explain").textContent="Lỗi trên tổng "+n+" mẫu: baseline "+pct(base.wrong/n)+", robust "+pct(rob.wrong/n)+". Robust từ chối "+rob.reject+" mẫu; "+(isBetter?"ít quyết định sai hơn trong mô phỏng này.":"không cải thiện số quyết định sai trong cấu hình này.")+" Cần xem coverage và so trên IQ đo thực. Thuật toán vòng 108 không tham gia phát hiện notch.";
 for(const [key,val,unit] of [["vn-noise-label",sigma,""],["vn-imp-label",impulse*100,"%"],["vn-guard-label",guard,""],["vn-trials-label",trials,""]])$(key).textContent=val+unit;
 latest={provenance:"SYNTHETIC ONLY; NO HARDWARE; 1-bit tag class",
  params:{seed,sigma_db:sigma,impulse_probability:impulse,impulse_magnitude_db:18,guard_db:guard,trials_per_class:trials,threshold_db:4.5,paired_samples:true,reader_samples_per_trial:39},
  baseline:base,robust:rob,coverage:(n-rob.reject)/n,accuracy_accepted:Number.isFinite(accAccepted)?accAccepted:null,
  overall_accuracy_baseline:base.correct/n,overall_accuracy_robust:rob.correct/n};
}
function download(){
 if(!latest)benchmark();
 const blob=new Blob([JSON.stringify(latest,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");
 a.href=url;a.download="vn-chipless-seeded-ab.json";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500);
}
function number(id){return +$(id).value;}
function recost(){
 const costA=number("vn-costa"),costB=number("vn-costb"),pa=number("vn-pa"),pb=number("vn-pb"),
 sa=number("vn-sa"),sb=number("vn-sb"),ta=number("vn-ta"),tb=number("vn-tb"),period=number("vn-period");
 if(![costA,costB,pa,pb,sa,sb,ta,tb,period].every(Number.isFinite)||period<=Math.max(ta,tb)||costA<=0||costB<=0){
  $("vn-cost-save").textContent="Lỗi";return;
 }
 const eA=pa*ta+sa*(period-ta),eB=pb*tb+sb*(period-tb);
 $("vn-cost-save").textContent=pct(1-costB/costA);
 $("vn-energy-save").textContent=pct(1-eB/eA);
 $("vn-ea").textContent=(eA*24/period).toFixed(2);
 $("vn-eb").textContent=(eB*24/period).toFixed(2);
}
function ring(){
 const id=number("vn-id"),q=number("vn-quality"),alarm=number("vn-alert"),n=id+16*q+48*alarm;
 const m4=n%4,m27=n%27,theta=2*Math.PI*n/108;
 $("vn-id-label").textContent=id;
 const item={state:n,angle_deg:+(theta*180/Math.PI).toFixed(3),tag_id:id,quality:q,flag:alarm,
  mod4:m4,mod27:m27,bits:[m4%2,Math.floor(m4/2)],
  trits:[m27%3-1,Math.floor(m27/3)%3-1,Math.floor(m27/9)-1],LoRaWAN_payload_hex:n.toString(16).padStart(2,"0"),
  warning:"Mapping state to 1 byte does not outperform standard 7-bit bitfield"};
 $("vn-ring-out").textContent=JSON.stringify(item,null,2);
 const c=$("vn-wheel"),ctx=c.getContext("2d"),cx=c.width/2,cy=c.height/2,r=91;
 ctx.clearRect(0,0,c.width,c.height);ctx.fillStyle="#0a1a29";ctx.fillRect(0,0,c.width,c.height);
 for(let i=0;i<108;i++){
  const t=2*Math.PI*i/108-Math.PI/2,x=cx+r*Math.cos(t),y=cy+r*Math.sin(t);
  ctx.fillStyle=i<96?"#417489":"#8d6470";ctx.beginPath();ctx.arc(x,y,1.7,0,2*Math.PI);ctx.fill();
 }
 const x=cx+r*Math.cos(theta-Math.PI/2),y=cy+r*Math.sin(theta-Math.PI/2);
 ctx.strokeStyle="#63e5be";ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(x,y);ctx.stroke();
 ctx.fillStyle="#63e5be";ctx.beginPath();ctx.arc(x,y,6,0,2*Math.PI);ctx.fill();
 ctx.textAlign="center";ctx.fillStyle="#e3f4fa";ctx.font="bold 25px sans-serif";ctx.fillText(String(n),cx,cy+7);
 ctx.font="11px sans-serif";ctx.fillStyle="#a9cbd7";ctx.fillText("Ring-108",cx,cy+25);
}
function check(){
 const freq=number("vn-freq"),erp=number("vn-erp"),toa=number("vn-toa"),interval=number("vn-interval");
 const duty=toa/(1000*interval);
 const freqOk=freq>=920&&freq<=923,erpOk=erp>=0&&erp<=25,dutyOk=interval>0&&toa>=0&&duty<=.01;
 const fine=freqOk&&erpOk&&dutyOk;
 $("vn-policy").textContent=(fine?"SƠ BỘ PHÙ HỢP GIỚI HẠN ĐƠN GIẢN. ":"CÓ THÔNG SỐ VƯỢT GIỚI HẠN SƠ BỘ. ")+"Băng trung tâm: "+(freqOk?"✓":"×")+
  "; ERP ≤25 mW: "+(erpOk?"✓":"×")+"; duty ≤1%: "+(dutyOk?"✓":"×")+" ("+pct(duty)+"). Cần xác minh toàn dải phát, hiệu chuẩn ERP, LoRaWAN plan/certification, spurious, dự phòng join/retry và quy định hiện hành. Không bật phát trong bản demo.";
}
$("vn-run").addEventListener("click",benchmark);$("vn-save").addEventListener("click",download);
$("vn-recost").addEventListener("click",recost);$("vn-check").addEventListener("click",check);
for(const id of ["vn-id","vn-quality","vn-alert"])$(id).addEventListener("input",ring);
for(const id of ["vn-noise","vn-imp","vn-guard","vn-trials"])$(id).addEventListener("input",()=>{const out={"vn-noise":"vn-noise-label","vn-imp":"vn-imp-label","vn-guard":"vn-guard-label","vn-trials":"vn-trials-label"};$(out[id]).textContent=$(id).value+(id==="vn-imp"?"%":"");});
benchmark();recost();ring();check();
})();