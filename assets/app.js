/* SPDX-License-Identifier: MIT
 * Educational digital twin only. No RF transmission or real TTN connection.
 * Frequencies from Gehron et al., IEEE IoTaIS 2024, DOI 10.1109/IoTaIS64014.2024.10799492.
 * Gaussian resonance shape, noise and detection threshold are independent assumptions.
 */
(() => {
"use strict";
const F0 = [1.4,1.8,2.4,5.2], depths=[22,22,15,17], widths=[.028,.033,.039,.060];
const $ = id => document.getElementById(id);
const bitsEl = [...document.querySelectorAll(".tagbit")];
let last = null;
function prng(seed) { let a = (seed|0) >>> 0; return () => {a+=0x6D2B79F5;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;}; }
function gauss(rand){return Math.sqrt(-2*Math.log(Math.max(1e-12,rand())))*Math.cos(2*Math.PI*rand());}
function params() {
  return {bits:bitsEl.map(n=>n.checked?"1":"0").join(""),noise:+$("noise").value,threshold:+$("threshold").value,seed:+$("seed").value,gain:$("array").checked?20:0,region:$("region").value};
}
function generate(bits,noise,seed,gain,n=1401) {
  const rnd=prng(seed), x=[], y=[];
  for(let i=0;i<n;i++){
    const f=1.2+4.2*i/(n-1);
    let v=6+2.5*(f-1.2)+1.4*Math.sin(2.1*f)+.6*Math.sin(8.8*f);
    for(let k=0;k<4;k++)if(bits[k]==="1")v-=depths[k]*Math.exp(-.5*((f-F0[k])/widths[k])**2);
    x.push(f);y.push(v+gain-20+(noise?noise*gauss(rnd):0));
  }
  return {x,y};
}
function detect(spec,threshold) {
  return F0.map(f0=>{
    const avg=(a,b)=>{let sum=0,n=0;for(let j=0;j<spec.x.length;j++){const df=spec.x[j]-f0;if(df>=a&&df<=b){sum+=spec.y[j];n++;}}return sum/n;};
    const left=avg(-.120,-.075),mid=avg(-.023,.023),right=avg(.075,.120);
    const score=(left+right)/2-mid;
    return {f0,left,mid,right,score,bit:+(score>=threshold)};
  });
}
function configureCanvas(canvas,h) {
  const w=Math.max(350,Math.floor(canvas.getBoundingClientRect().width||720));
  const ratio=Math.min(window.devicePixelRatio||1,2);
  canvas.style.height=h+"px";canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio);
  const ctx=canvas.getContext("2d");ctx.setTransform(ratio,0,0,ratio,0,0);
  return {ctx,w,h};
}
function drawRcs(spec,dets) {
  const {ctx,w,h}=configureCanvas($("rcsChart"),355);
  const m={l:53,r:15,t:23,b:43},plotw=w-m.l-m.r,ploth=h-m.t-m.b;
  const min=Math.floor((Math.min(...spec.y)-3)/5)*5,max=Math.ceil((Math.max(...spec.y)+3)/5)*5;
  const xx=f=>m.l+(f-1.2)/4.2*plotw,yy=v=>m.t+(max-v)/(max-min)*ploth;
  ctx.clearRect(0,0,w,h);ctx.fillStyle="#0a1a29";ctx.fillRect(0,0,w,h);
  ctx.font="11px system-ui";ctx.textBaseline="middle";
  for(let i=0;i<=5;i++){
    const v=min+i*(max-min)/5,y=yy(v);
    ctx.strokeStyle="#263c51";ctx.beginPath();ctx.moveTo(m.l,y);ctx.lineTo(w-m.r,y);ctx.stroke();
    ctx.fillStyle="#a9bbcc";ctx.textAlign="right";ctx.fillText(v.toFixed(0),m.l-9,y);
  }
  for(const f of [1.2,1.8,2.4,3,3.6,4.2,4.8,5.4]){
    const x=xx(f);
    ctx.fillStyle="#abc1d2";ctx.textAlign="center";ctx.fillText(f.toFixed(1),x,h-23);
  }
  F0.forEach((f,k)=>{
    const x=xx(f);ctx.strokeStyle="#c58b52";ctx.setLineDash([4,5]);ctx.beginPath();ctx.moveTo(x,m.t);ctx.lineTo(x,h-m.b);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle=dets[k].bit?"#fbd18d":"#9fb4c2";ctx.font="bold 11px system-ui";ctx.textAlign="center";ctx.fillText(f.toFixed(1),x,m.t+10);
  });
  ctx.strokeStyle="#55e6be";ctx.lineWidth=1.7;ctx.beginPath();
  spec.x.forEach((f,i)=>{const x=xx(f),y=yy(spec.y[i]);i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.stroke();
  ctx.fillStyle="#bad0db";ctx.font="11px system-ui";ctx.textAlign="center";ctx.fillText("Frequency (GHz) — synthetic",w/2,h-6);
  ctx.textAlign="left";ctx.fillText("Relative RCS (dB)",m.l,11);
}
function drawChirps(id) {
  const {ctx,w,h}=configureCanvas($("chirpChart"),290);
  const left=46,right=17,top=20,bottom=35,W=w-left-right,H=h-top-bottom, n=7;
  ctx.fillStyle="#0a1a29";ctx.fillRect(0,0,w,h);
  ctx.strokeStyle="#244157";ctx.lineWidth=1;
  for(let i=0;i<=4;i++){const yy=top+H*i/4;ctx.beginPath();ctx.moveTo(left,yy);ctx.lineTo(w-right,yy);ctx.stroke();}
  ctx.fillStyle="#aec6d4";ctx.textAlign="right";ctx.font="11px system-ui";
  ctx.fillText("+62.5 kHz",left-6,top+4);ctx.fillText("0",left-6,top+H/2+4);ctx.fillText("−62.5 kHz",left-6,top+H);
  const symbols=[8,24,(parseInt(id,2)*7)%128,70,6,101,31]; // illustration only
  for(let s=0;s<n;s++){
    const xbase=left+W*s/n,slot=W/n;
    const phase=symbols[s]/128;
    ctx.strokeStyle=s%2===0?"#55e6be":"#78b9ef";ctx.lineWidth=2;ctx.beginPath();
    let prev=phase,started=false;
    for(let k=0;k<=105;k++){
      const u=k/105,p=(phase+u)%1,x=xbase+u*slot,y=top+(1-p)*H;
      if(k>0&&p<prev){ctx.stroke();ctx.beginPath();started=false;}
      if(!started){ctx.moveTo(x,y);started=true;}else{ctx.lineTo(x,y);}
      prev=p;
    }
    ctx.stroke();
    ctx.fillStyle="#9db9c8";ctx.textAlign="center";ctx.font="10px system-ui";ctx.fillText(String(s+1),xbase+slot/2,h-15);
  }
  ctx.fillStyle="#b8cdda";ctx.textAlign="left";ctx.font="11px system-ui";ctx.fillText("t →    CSS chirps, SF7 / BW125 (minh họa)",left,11);
}
function showResults(p,spec,dets) {
  const decoded=dets.map(d=>d.bit).join("");
  $("noiseLabel").textContent=p.noise.toFixed(1);$("thresholdLabel").textContent=p.threshold.toFixed(1);$("seedLabel").textContent=p.seed;
  $("requested").textContent=p.bits;$("decoded").textContent=decoded;$("decimal").textContent=parseInt(decoded,2);
  $("match").textContent=decoded===p.bits?"KHỚP":"LỖI";$("match").className=decoded===p.bits?"success":"error";
  $("scores").innerHTML=dets.map(d=>'<tr><td>'+d.f0.toFixed(1)+'</td><td>'+d.left.toFixed(2)+'</td><td>'+d.mid.toFixed(2)+'</td><td>'+d.right.toFixed(2)+'</td><td>'+d.score.toFixed(2)+'</td><td><b>'+d.bit+'</b></td></tr>').join("");
  const uplink={mode:"SIMULATED / NOT SENT",data_origin:"synthetic SDR+FHS",radio_segment:"LoRa CSS illustrative",network_region:p.region,network_connection:"mock (no OTAA / no gateway)",paper_setting:"EU868, SF7, BW125kHz",device_id:"diy-chipless-demo",uplink_message:{f_port:1,frm_payload_hex:parseInt(decoded,2).toString(16).padStart(2,"0"),decoded_payload:{id_binary:decoded,id_decimal:parseInt(decoded,2),bit_count:4}},reader:{expected:p.bits,detected:decoded,notch_threshold_db:p.threshold,noise_sigma_db:p.noise,seed:p.seed}};
  $("payload").textContent=JSON.stringify(uplink,null,2);
  drawRcs(spec,dets);drawChirps(decoded);
  last={p,spec,dets,decoded};
}
function run(){const p=params(),spec=generate(p.bits,p.noise,p.seed,p.gain),dets=detect(spec,p.threshold);showResults(p,spec,dets);}
function benchmark(){
  const p=params();let good=0,bitErr=0,total=0;
  for(let t=0;t<10;t++)for(let id=0;id<16;id++){
    const original=id.toString(2).padStart(4,"0");
    const spec=generate(original,p.noise,2024+31*t+id,p.gain,1201);
    const detected=detect(spec,p.threshold).map(d=>d.bit).join("");
    good+=+(original===detected);
    bitErr+=[0,1,2,3].filter(k=>original[k]!==detected[k]).length;
    total++;
  }
  $("benchResult").textContent="MONTE CARLO GIẢ LẬP: "+good+"/"+total+" ID đúng ("+(100*good/total).toFixed(1)+"%) · BER "+(100*bitErr/(total*4)).toFixed(2)+"% · 16 ID × 10 lần · σ="+p.noise.toFixed(1)+" dB. Không phải số đo vô tuyến.";
}
function exportCsv(){
  if(!last)run();
  const {spec,p}=last;
  const text="frequency_ghz,synthetic_rcs_db\n"+spec.x.map((f,i)=>f.toFixed(6)+","+spec.y[i].toFixed(6)).join("\n");
  const blob=new Blob([text],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download="chipless_synthetic_"+p.bits+"_seed"+p.seed+".csv";document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
}
$("run").addEventListener("click",run);$("benchmark").addEventListener("click",benchmark);$("export").addEventListener("click",exportCsv);
for(const el of [...bitsEl,$("noise"),$("threshold"),$("seed"),$("array"),$("region")])el.addEventListener("change",run);
for(const id of ["noise","threshold","seed"])$(id).addEventListener("input",run);
let resizeJob=0;window.addEventListener("resize",()=>{cancelAnimationFrame(resizeJob);resizeJob=requestAnimationFrame(()=>{if(last)showResults(last.p,last.spec,last.dets);});});
window.ChiplessLab={generate,detect};
run();
})();
