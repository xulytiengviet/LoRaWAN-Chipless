# Vietnam-first Chipless RFID + LoRaWAN + Ring-108

**Working research protocol v1.1 | 19 November 2026 | status: simulation only**

## Executive hypothesis

**Chipless RFID turns passive materials into identifiers. LoRaWAN carries the locally detected ID over long distance.** Neither LoRaWAN nor Ring-108 expands the **physical** read range of the passive tag. The proof target is not a predeclared result; we must compare hardware under comparable requirements and publish both successes and failures.

### RQ and falsifiable success metrics

| ID | Hypothesis | Metric and control | Status |
|---|---|---|---|
| RQ1 | Narrowband candidate can cost less | Total BOM reader + antenna + enclosure + power + lifetime, per **equivalent tag ID capacity and error threshold**, receipts & calibration | NOT TESTED |
| RQ2 | Candidate can be physically smaller | Volume (cm³), antenna aperture, enclosure and mass under comparable read range | NOT TESTED |
| RQ3 | Candidate can use less energy | Joules per successful unique ID incl. wakeups, reruns, TX, idle and retries; energy/day at equal read schedule | NOT TESTED |
| RQ4 | Robust sensing can lower false IDs under interference | Exact-ID, bit-error, false-positive, false-negative, reject/coverage, calibration, confidence intervals, paired IQ trials | Synthetic comparison implemented; hardware NOT TESTED |
| RQ5 | AS923 Group 2 backhaul can work in VN terrain | Packet delivery rate, RSSI, SNR, airtime, link margin, uplink latency, location/site metadata | NOT TESTED |

**Hard constraint:** the IEEE reference has **4 RF notch bits = 16 tag IDs**. The low-cost alternative modeled here is **one-notch/two classes** at a *hypothetical* 2.44 GHz tag-sensing frontend, which is **NOT equivalent**. A 1-notch proof-of-concept cannot claim to beat an equal-capacity 4-bit system. It is a phased research milestone. A follow-up version must implement 4+ independent, separable states or 16 reliable multi-state signatures at appropriate spectrum, hardware and tags before cost/ID comparisons.

## Verified frequency-policy correction — do not use the old default

The original IEEE experimental LoRa PHY used **EU868 / 868 MHz**, SF7/BW125. Those measurements were not made under Vietnam-specific operating conditions.

**Vietnam LPWAN engineering profile (conservative, licensing conditions only; always check updates)**

- Ministry consolidated circular **01/VBHN-BKHCN, 04 June 2025**, Annex 19: **920–923 MHz**, **≤25 mW ERP**, **≤1% duty cycle end device**, **≤10% gateway**, plus spurious emissions and other requirements. Restricted sites (e.g. near mobile base stations) have additional unwanted-emission conditions.
- The LoRa Alliance **RP002-1.0.5** lists Vietnam **AS923-2**, broader regional entry **918–923 MHz**. A regional band description is **NOT automatically** the unlicensed national operating band: honor local 920–923 MHz regulatory limits for this LPWAN use case.
- Some legacy TTN community docs say *Vietnam AS923-925 (“AS2”)*. The Things Stack distinguishes `AS_923_925` (≥923 MHz) from `AS_923_2` (Group 2; default 921.x MHz). This repo uses **AS923 Group 2** as the planning baseline, not AS_923_925. Confirm exact channel plan ID against the deployed stack/gateway/device.
- 921.4 / 921.6 MHz are **illustrative common channels**, not a license or a complete channel plan. A center frequency alone does **not** prove the full occupied spectrum and spurious emissions lie within authorization.
- `ERP` ≠ `EIRP`. A 25 mW ERP limit equals roughly 14 dBm ERP, not an automatic 14 dBm radio setting; include antenna gains/losses in measurement. **Do not use arbitrary high power**.
- Legal text also distinguishes permission for higher-power LPWAN with license; our code does not implement that path.
- Chipless sensing **RF radiation** has a separate regulatory classification. **Do not assume the LPWAN exemption authorizes arbitrary 1.2–5.4 GHz sweep, 2.44 GHz CW interrogation, or 920–923 MHz active RFID interrogators**. Develop in a fully shielded lab/attenuated RF connection under proper conditions and obtain radio compliance review before over-the-air trials.
- GitHub Pages, Python and JS in this project are **non-transmitting simulations only**.

References:
1. Official 01/VBHN-BKHCN: https://datafiles.chinhphu.vn/cpp/files/vbpq/2025/6/01-vbhn-bkhcn.pdf (Annex 19, LPWAN).
2. LoRa Alliance RP002-1.0.5, Vietnam: https://read.uberflip.com/i/1540208-rp002-1-0-5-lorawan-regional-parameters/22
3. The Things Stack plan IDs: https://www.thethingsindustries.com/docs/concepts/features/lorawan/frequency-plans/
4. Older TTN by-country plan (not definitive domestic legal permission): https://www.thethingsnetwork.org/docs/lorawan/frequencies-by-country/
5. IEEE source: https://doi.org/10.1109/IoTaIS64014.2024.10799492

## Architecture: intentionally distinct radios and layers

```text
[PASSIVE TAG]   ring/split-ring resonator, one notch candidate (2.44GHz hypothesis)
       |
       | near-field / scattered RF; close physical reader, calibrated
       v
[LOCAL FRONTEND] low-cost narrowband coherent front end: NOT YET BUILT
       |
       +--> guard against TX leakage, calibration, dwell/retune
       v
[DETECTOR]    mean FHS vs median-3 sweep + guard/abstain
       |
       | 1-bit current demonstration (NOT 4-bit capacity)
       v
[EVENT POLICY] confidence quality; false-positive safety rule; 108-state ring
       |
       +--> ID4/quality3/alarm2 => 96 valid states [0..95]; 12 reserved
       |    ring algebra is exact but no inherent RF gain
       v
[MCU + LoRaWAN end-device] regional plan AS923 Group 2, OTAA keys private
       |
       | radio at legally reviewed 920–923MHz / compliant power & duty
       v
[FIELD GATEWAY] LoRaWAN gateway, Ethernet/solar/cellular/satellite uplink as available
       |
       v
[THE THINGS STACK] event log, acknowledgements/queue, cloud dashboard
```

### What really transfers from kientrucvong?

Source: https://github.com/xulytiengviet/kientrucvong · core https://github.com/xulytiengviet/kientrucvong/blob/main/src/core.js

- **Exactly valid:** `Z108 ≅ Z4 × Z27` through CRT; 108 = 4×27 = 2 bits + 3 trits (NOT five trits), and ring visualization `exp(2πin/108)`.
- **Our event format:** `n = id + 16×quality + 48×flag` for `id∈[0,15]`, `quality∈[0,2]`, `flag∈[0,1]`. All 96 combinations map uniquely to bytes 0..95. Invalid states 96..107 are reserved; CRC/LoRaWAN MIC is still necessary for radio protection.
- **Decoding:** `flag = n//48`, `quality = (n%48)//16`, `id = n%16`. Derive `mod4=n%4`, `mod27=n%27`; inverse CRT `n = r+27*((3*(q-r))%4)`.
- **Not an efficiency proof:** standard binary `4 ID bits + 2 quality bits + 1 status bit = 7 bits`, also one byte. Base27 does not automatically compress this more. `27-FSK` of the audio demo is **not** a LoRaWAN PHY and must not be pasted into radio configuration. Ring encoding does **not** create RF notches or boost sensitivity; the detector algorithms need independent validation.
- The source converter CVNSS4.0 is language-oriented and sometimes many-to-one; do not use it to encode critical binary RF IDs. Use CVNSS4.0 optionally only for human-readable Vietnamese event descriptions **after** verified binary ID decoding, with an audit trail.

## Experimental implementation you can run today

### Python 3.10+ (standard library only)

```bash
python vn/reader.py --trials 500 --seed 20261119 --noise-db 3.2 --impulse-prob 0.12 --out results/vn
python -m unittest discover -s vn -p 'test_*.py' -v
python -m unittest discover -s simulation -p 'test_*.py' -v
```

Output: `results/vn/vn_benchmark.json`, with seeded, balanced 0-vs-1 synthetic trial counts; both algorithms see **the same exact observations**.

### A/B model details

- `1 notch` at hypothetical 2.44GHz, Gaussian notch amplitude -12 dB, Gaussian width .02GHz, random detuning σ=.005GHz; not from any solver or measurement.
- 13 frequency sample points around the notch, 3 repeated readings each (39 reads total) for **both** methods.
- Independent AWGN σ=3.2dB by default and an impulsive outlier of ±18dB with 12% probability/sample. Both models use **identical** noises.
- **A:** average 3 repeats per frequency, compute three-region FHS shoulders/center score, hard-threshold 4.5 dB.
- **B:** median 3 repeats per frequency, same three-region score; **reject** uncertain scores inside 1.5dB around decision boundary.
- Always report: `overall_accuracy_including_reject`, `accuracy_accepted`, `coverage`, `unconditional_error_rate`, false positives and negatives. Reject is NOT a success; improvement in accuracy among accepted reads is not necessarily overall superiority.
- The RF notch parameters and noise distribution are illustrative assumptions. Need a further read of IQ from actual low-cost front end + wideband reference at the same physical targets.

### Cost/power simulator, hypotheses only

`vn-lab.html` lets the reader edit reader cost (USD), active/sleep power (W), read duration (s), polling period (s). The example prices **1200 vs 180 USD** and active powers **12 vs 1.5W** are user-modifiable scenario values, **not verified BOM, prices or real wattmeter data**. Energy formula:

```text
E_cycle [J] = P_active [W] × t_read [s] + P_sleep [W] × (T_cycle − t_read)
E_day [Wh] = E_cycle × 86400 / (T_cycle × 3600)
```

The narrowband design may lower volume, parts and energy but loses ID bits (1 vs 4). Compare energy per **successful tag ID under equal capability**, not power alone. Remove abstentions and retransmission energy from measurements only when justified; otherwise include them.

## What to build and prove in four environments

| Site | Questions | Required observations |
|---|---|---|
| Shielded laboratory (first, mandatory) | Resonances and safe RF characteristics | Calibrated IQ spectra, tag/no-tag false-positive, single-cell vs 4×4 RCS; front-end current, clock and sleep power |
| Rural farm / warehouse | Can 1 node observe tags within short range and backhaul kilometers? | Exact ID, 30+ repeats per sample, gateway RSSI/SNR, supply voltage, uplink log |
| Mountain slope / valley | NLOS and shadowing? | GIS coordinates, elevation profile, gateway location, packet delivery at measured path lengths, local tag read separately |
| Island / coast | Salt mist, humidity, power outage and gateway IP availability? | IP downtime, buffered events, antenna corrosion, battery/solar budget, link budget, no claims about sea propagation without data |

## Field-proof protocol: acceptance gates

A valid *comparison* requires:
1. **Equivalent task**: same number of uniquely identifiable tags, distance, angular tolerance, read time, and false-positive target. For candidate to replace IEEE 4-bit, demonstrate ≥16 reliably distinguishable physical signatures or explicitly narrow use-case to 1-bit presence detection.
2. **Registered targets**: example engineering targets for a future experiment (not achieved): at least 95% accepted-read accuracy, at least 90% coverage, ≥30 repetitions per ID/scenario, measured BOM and Joules per successful read; set final thresholds with domain stakeholders **before** data collection.
3. **Interference corpus**: Wi-Fi coexistence, reflective metal, water, tag rotation, varying distance, multiple readers; calibrated background, noise floor and reference IQ saved with metadata.
4. **A/B fairness**: same raw IQ, same RF chain or calibrated equivalent, same compute budget where possible. Include processing time and energy for median/retry.
5. **Local + backhaul split**: tag→reader detection reliability is separate from LoRaWAN uplink PDR. Do not call 5 km the passive-tag read range.
6. **Uncertainty**: repeat with multiple devices/sites/temperatures, confidence intervals, fixed version/hash/config; public failures, negative results, recalibration and post-hoc exploratory changes.
7. **Safe RF**: only measured, compliant radio configuration in an authorized environment; comply with duty cap and emission masks.

### Publication evidence ledger

| Claim | Today | Evidence needed |
|---|---|---|
| Ring-108 encode/decode lossless for 96 events | Proved by algebra and enumerated tests | Source commit & test logs |
| More robust to **synthetic** impulse outliers | Tested with repeatable paired Monte Carlo | Parameter sweep + confidence intervals |
| Smaller and cheaper **physical** reader | Not established | CAD, antenna+PCB area, purchase BOM |
| Lower average active/sleep consumption | Not established | Power meter traces and comparable task |
| Better in real Vietnam interference | Not established | Field IQ, environmental logs, repeated controlled benchmark |
| Useful LoRaWAN range in mountains/islands | Not established | Licensed compliant deployments and field link measurements |

## Repository deliverables

- [Vietnam Field Lab](../vn-lab.html): browser A/B + numeric budget + ring event wheel + LPWAN preflight
- [Reference 4-bit IEEE lab](../index.html): preserves original comparison
- [VN Python model](../vn/reader.py) and [tests](../vn/test_reader.py)
- [VN policy config](../vn/config_vn.json)
- [kientrucvong core](https://github.com/xulytiengviet/kientrucvong/blob/main/src/core.js) (read-only architectural reference)

**No automatic radio transmission or use of credentials in this repository.**
