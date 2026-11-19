#!/usr/bin/env python3
"""Vietnam rural/island chipless + LoRaWAN study: fully synthetic A/B experiment.

No radiation, no real EM simulation, no actual measured hardware. The candidate is
a ONE-NOTCH prototype, not equivalent information capacity to IEEE four-notch tag.
Inspired by kientrucvong's exact CRT Z108 <-> Z4 x Z27 algebra; this code is new.
"""
from __future__ import annotations
import argparse
import json
import math
import random
from pathlib import Path

F_CANDIDATE_GHZ=2.44
FREQUENCY_OFFSETS_GHZ=(-.100,-.085,-.065,-.045,-.018,-.009,0,.009,.018,.045,.065,.085,.100)
LEFT=(0,1,2)
CENTER=(5,6,7)
RIGHT=(10,11,12)

def encode_ring(tag_id:int, quality:int, alarm:int)->dict:
    """Encode 16 tags x 3 quality x 2 flags = 96 states of 108."""
    if not 0<=tag_id<=15 or not 0<=quality<=2 or alarm not in (0,1):
        raise ValueError("tag_id=0..15, quality=0..2, alarm=0/1")
    state=tag_id+16*quality+48*alarm
    q,r=state%4,state%27
    return {"state":state,"angle_deg":360*state/108,"mod4":q,"mod27":r,
            "bits":[q%2,q//2],
            "trits":[r%3-1,r//3%3-1,r//9-1],
            "byte":state}

def decode_ring(state:int)->dict:
    if not isinstance(state,int) or not 0<=state<96:
        raise ValueError("Only states 0..95 are defined as event codes")
    q,r=state%4,state%27
    rebuilt=r+27*((3*(q-r))%4)
    assert rebuilt==state
    alarm,tail=divmod(state,48)
    quality,tag_id=divmod(tail,16)
    return {"tag_id":tag_id,"quality":quality,"alarm":alarm,
            "state":rebuilt,"angle_deg":360*state/108}

def synth_sample(tag:bool, rng:random.Random, sigma:float, impulsive_p:float,
                 impulse_db:float, detune_ghz:float=0.0, repeat:int=3):
    """Same observed sample matrix is supplied to baseline and robust detector."""
    points=[]
    for offset in FREQUENCY_OFFSETS_GHZ:
        f=F_CANDIDATE_GHZ+offset
        # An independent thought experiment, not an EM solver / measured RCS.
        baseline=0.4*(offset/.1)+.30*math.cos(offset*27)
        notch=-12*math.exp(-.5*((offset-detune_ghz)/.020)**2) if tag else 0
        scans=[]
        for _ in range(repeat):
            v=baseline+notch+rng.gauss(0,sigma)
            if rng.random()<impulsive_p:
                v+=rng.choice((-1,1))*impulse_db
            scans.append(v)
        points.append((f,scans))
    return points

def median(v):
    ordered=sorted(v);n=len(v)
    return ordered[n//2] if n%2 else (ordered[n//2-1]+ordered[n//2])/2

def three_region_score(pts, method="mean"):
    if method not in ("mean","median"):
        raise ValueError("method=mean or median")
    if len(pts)!=len(FREQUENCY_OFFSETS_GHZ):
        raise ValueError("expected frequency grid")
    reducer=(lambda a:sum(a)/len(a)) if method=="mean" else median
    columns=[reducer(scans) for _,scans in pts]
    region=lambda ids:sum(columns[i] for i in ids)/len(ids)
    left,center,right=region(LEFT),region(CENTER),region(RIGHT)
    return (left+right)/2-center

def classify(pts, method="mean", threshold_db=4.5, guard_db=0):
    score=three_region_score(pts,method)
    if guard_db and abs(score-threshold_db)<guard_db:
        return None,score
    return int(score>=threshold_db),score

def trial_benchmark(trials=500, seed=20261119, sigma=3.2,
                    impulse_p=.12, impulse_db=18, threshold_db=4.5,
                    guard_db=1.5):
    if trials<1 or sigma<0 or not 0<=impulse_p<=1 or impulse_db<0 or guard_db<0:
        raise ValueError("Invalid trial/noise parameters")
    rng=random.Random(seed)
    results={m:{"correct":0,"wrong":0,"reject":0,"false_positive":0,"false_negative":0} for m in ("mean","median_guard")}
    for actual in (0,1):
        for _ in range(trials):
            # Detuning simulates antenna/tag environmental frequency shift.
            detune=rng.gauss(0,.005)
            points=synth_sample(bool(actual),rng,sigma,impulse_p,impulse_db,detune)
            for method in ("mean","median_guard"):
                pred,_=classify(points,"mean" if method=="mean" else "median",
                         threshold_db,0 if method=="mean" else guard_db)
                stats=results[method]
                if pred is None:stats["reject"]+=1
                elif pred==actual:stats["correct"]+=1
                else:
                    stats["wrong"]+=1
                    stats["false_positive"]+=int(actual==0)
                    stats["false_negative"]+=int(actual==1)
    n=2*trials
    for method in results:
        s=results[method]
        s["n"]=n
        s["coverage"]=(n-s["reject"])/n
        s["overall_accuracy_including_reject"]=s["correct"]/n
        s["accuracy_accepted"]=s["correct"]/(n-s["reject"]) if n>s["reject"] else None
        s["unconditional_error_rate"]=s["wrong"]/n
    return {
        "provenance":"SYNTHETIC / HYPOTHESIS ONLY / NOT HARDWARE PROOF",
        "radio_tx":False, "tag_capacity_bits":1,
        "params":{"trials_per_class":trials,"seed":seed,"sigma_db":sigma,
          "impulsive_p":impulse_p,"impulsive_magnitude_db":impulse_db,
          "threshold_db":threshold_db,"reject_guard_db":guard_db,
          "sample_count_equal_for_both":len(FREQUENCY_OFFSETS_GHZ)*3},
        "baseline_vs_candidate":results,
        "interpretation":"Median and abstention may reduce *accepted* errors; check coverage/reject rate. No claims of cost, power or overall superiority without equivalent hardware measurement."
    }

def duty_check(frequency_mhz=921.4, erp_mw=25.0, time_on_air_ms=80, interval_seconds=60,
               gateway=False):
    limit=.10 if gateway else .01
    dc=(time_on_air_ms/1000)/interval_seconds
    inside_band=920<=frequency_mhz and frequency_mhz<=923
    return {"frequency_mhz":frequency_mhz,"inside_nominal_lpwan_band":inside_band,
            "erp_mw":erp_mw,"erp_within_25mw":erp_mw<=25 and erp_mw>=0,
            "duty_cycle":dc,"duty_cycle_cap":limit,
            "duty_cycle_within_limit":dc<=limit,
            "status":"ENGINEERING PRE-CHECK ONLY (NOT LEGAL CERTIFICATION)",
            "warnings":["occupied bandwidth and spectral masks must fit band",
                        "valid frequency plan, certification and gateway configuration required",
                        "RFID sensing transmitter has separate radio compliance rules"]}

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--seed",type=int,default=20261119)
    ap.add_argument("--trials",type=int,default=500)
    ap.add_argument("--noise-db",type=float,default=3.2)
    ap.add_argument("--impulse-prob",type=float,default=.12)
    ap.add_argument("--out",type=Path,default=Path("results/vn"))
    args=ap.parse_args()
    output=trial_benchmark(args.trials,args.seed,args.noise_db,args.impulse_prob)
    output["lpwan_precheck"]=duty_check()
    output["ring_examples"]=[encode_ring(15,2,1),decode_ring(95)]
    args.out.mkdir(parents=True,exist_ok=True)
    (args.out/"vn_benchmark.json").write_text(json.dumps(output,ensure_ascii=False,indent=2),encoding="utf-8")
    print(json.dumps(output,ensure_ascii=False,indent=2))

if __name__=="__main__":
    main()
