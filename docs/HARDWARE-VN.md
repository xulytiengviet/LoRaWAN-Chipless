# Phần cứng DIY khả thi cho Việt Nam: từ SDR chuẩn sang ứng viên reader chi phí thấp

**Mức độ:** engineering candidate, NOT validated reader. **Không phát sóng thật** trước khi có thẩm định pháp lý, đo kiểm phát xạ và môi trường kiểm soát.

## 1. Hai đường phục dựng tách biệt

**A — IEEE 2024 reference (4 bit, 16 ID):** BladeRF 2.0 micro xA4 (TX+RX) + 2 anten UWB + GNU Radio + SRR 4×4, 1.4/1.8/2.4/5.2 GHz; FPGA/SDR và PC được cấp nguồn. Đây là cấu hình chuẩn để so thuật toán và vật lý.

**B — Narrowband reader (đề xuất 1-bit):**

```text
Controlled clock / reference oscillator
   -> ADF4351 PLL synthesizer (2.44 GHz candidate)
   -> attenuator + directional coupler / isolation -> Tx patch antenna
   -> [one-notch passive tag] -> Rx patch antenna
   -> LNA / band filtering / variable gain as needed
   -> AD8318 logarithmic RF detector
   -> calibrated ADC + MCU
   -> 3-region FHS / background correction / reject-on-uncertainty
   -> local event buffer + SX1262 LoRaWAN radio
   -> gateway AS923 Group 2 (920–923 MHz under documented conditions)
```

**Electronic feasibility (from vendor specs, not demonstration):**
- Analog Devices **ADF4351**: frequency synthesizer **35 MHz to 4.4 GHz**. This can generate a test tone near **2.44 GHz** in a compliant lab, but **cannot directly synthesize 5.2 GHz** to copy the IEEE tag's 4th notch. See https://www.analog.com/en/products/adf4351.html
- Analog Devices **AD8318**: logarithmic power detector with **1 MHz to 8 GHz** operating range, suitable for exploring relative RF power vs frequency with proper calibration. Detector power measurements are **not automatically calibrated bistatic RCS**. See https://www.analog.com/en/products/ad8318.html
- Semtech **SX1262**: LoRa radio supports roughly **150–960 MHz**; suitable as a *backhaul device* for a compatible 921.x MHz LoRaWAN end device, **not** as the RF frontend for chipless interrogation at 2.44 or 5.2 GHz. A LoRa PHY radio alone also does not automatically implement OTAA/LoRaWAN MAC. See https://www.semtech.com/products/wireless-rf/lora-connect/sx1262
- MCU: ESP32-S3 or similar with SPI, ADC or external ADC, nonvolatile queue, antenna separation and power-managed domains; vendor and board choices are **not selected** as validated BOM items yet.

**Caution on electronics:** An ADF4351 alone is a synthesizer, not a full chipless RFID reader. The design must handle reference calibration, phase noise, spur suppression, TX leakage, RX sensitivity, linearity, gain drift, RF switching, attenuators, antenna coupling, tag-vs-background subtraction and spurious emission limits. The AD8318 log detector discards phase; scalar backscatter measurements may not resolve a weak tag in reflective multipath. A coherent IQ architecture may ultimately be necessary, increasing cost and power.

## 2. “Tag vật lý 1 bit” không thể tự trở thành 16 mã

- One notch as a presence/absence code has just 2 symbols.
- Four independent notch bits yield 16 combinations, subject to coupling effects and actual distinguishability.
- Moving all four notches into a 3 MHz-wide LPWAN band is **not an automatic solution**: adequate Q, separation, manufacturing tolerances, detuning and RF regulatory clearance must be established. LPWAN frequency rules are for backhaul radio; passive-tag reflection and active interrogation require separate analysis.
- A future **4-bit narrowband candidate** must prove ≥16 stable *physical spectral signatures* with EM solver, fabricated tags and calibrated measurements, not just assign new symbolic Base27 IDs to one resonator.
- Ring-108 represents **detected events**, not 108 resolvable RF codes.

## 3. Test stand (no public RF emission)

1. Power, SPI/clock and digital ADC loopback tests; use RF load or shielded/coaxial attenuated paths.
2. Confirm actual measured synthesized frequency using an independent calibrated instrument; record phase noise/spurs, output level and modulation leakage.
3. Calibrate AD8318 amplitude response against swept power over relevant frequency grid. Record temperature.
4. Check receiver dynamic range, noise floor, TX leakage, saturation and ADC conversion errors on the fixed DUT geometry.
5. Create controlled passive reference structures and measure with/without tag. Log raw ADC, calibrated power, background correction and frequency/step metadata.
6. Apply **the same raw measurements** to baseline three-region average and median-3 with quality guard; evaluate false positives and rejects.
7. Collect true reader on/off power, cycle energy, fail/retry costs and **cost per successfully distinguished ID**.
8. Only after radio compliance review and certified LoRaWAN hardware setup, use AS923 Group 2 backhaul under domestic conditions.

## 4. Instrument and acceptance sheet

Required files per run:
- `hardware/device.yaml`: board part number, chip revision, supply, antenna, gain settings, SDR firmware, BOM purchase records, instrument calibration IDs.
- `measurements/iqlike_or_power.csv`: sample timestamp, RF frequency, tag ID truth, measured power, antenna separation, distance, rotation angle, background calibration ID, temperature.
- `measurements/power.csv`: timestamp, rail voltage and current, exact reader/wake/sleep/LoRaWAN state.
- `measurements/uplink.csv`: gateway identifier, time, planned RF channel, SF/BW, device sequence, PDR, RSSI/SNR and metadata with secrets removed.
- `stats/metrics.json`: n, coverage, accepted accuracy, overall accuracy, false positives/negatives, confidence interval assumptions, correction policy, version/seed.
- `photos`: reference fixture and tag fabrication details, preserving necessary data privacy.

Use ≥30 repeated read trials per condition as a starting **protocol**, but size samples statistically based on expected confidence intervals and false-positive risk. Check physical tag read distance separately from gateway distance.

## 5. Scenario-specific questions

**Nông thôn:** solar power feasibility, antenna mounting, low maintenance, local caching when internet unavailable, water/dust IP enclosure and LoRaWAN gateway installation economics.

**Miền núi:** channel NLOS and terrain shadowing, RSSI/SNR versus GIS elevation profile, gateway placement, lightning protection, cold/humidity and 1% uplink duty-cycle including retransmits.

**Hải đảo:** saline corrosion, marine humidity, solar/storage autonomy, backhaul internet dependence, antenna salt film detuning, coastal multipath, wind and waterproof RF connectors.

A gateway without internet/satellite/mobile relay cannot deliver to a cloud server; LoRaWAN is not a satellite backhaul by itself.

## 6. Evidence grading

- **Algorithm & Ring code tested:** yes, GitHub Actions.
- **Near-band hardware candidate identified:** only components/architecture proposed, no RF measurements.
- **Cheaper/smaller:** only editable parameter model, no BOM and form factor measured.
- **Lower energy:** only symbolic duty/active-power model, no measured watt-hours.
- **More accurate under real VN interference:** not established; requires calibrated RF recordings and fair A/B.
- **Long-range LoRaWAN in VN terrain:** not established; needs compliant field trials.

See [Vietnam Field Lab](../vn-lab.html) and [Research Protocol](VIETNAM-RESEARCH.md).
