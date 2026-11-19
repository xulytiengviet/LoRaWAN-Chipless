#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
"""IEEE IoTaIS 2024 chipless RFID: transparent, synthetic FHS reproduction.

Paper facts: four nominal resonances, 4-bit ID, 4x4 array (~20 dB RCS gain).
The Gaussian notch shape, widths, thresholds and noise model BELOW are
independent modeling assumptions, NOT extracted source measurements.
"""
from __future__ import annotations
import argparse
import csv
import json
import math
import random
from pathlib import Path

RESONANCES_GHZ = (1.4, 1.8, 2.4, 5.2)
DEPTHS_DB = (22.0, 22.0, 15.0, 17.0)  # illustrative, not paper fit
WIDTHS_GHZ = (0.028, 0.033, 0.039, 0.060)  # illustrative
PAPER = "10.1109/IoTaIS64014.2024.10799492"

def spectrum(bits: str = "1111", noise_db: float = 0.8,
             seed: int = 2024, array_gain_db: float = 20.0,
             samples: int = 2101):
    if len(bits) != 4 or set(bits) - {"0", "1"}:
        raise ValueError("bits must contain exactly four binary digits")
    if samples < 401 or noise_db < 0:
        raise ValueError("samples >= 401 and noise_db >= 0 required")
    rng = random.Random(seed)
    x = [1.2 + (5.4 - 1.2) * k / (samples - 1) for k in range(samples)]
    y = []
    for f in x:
        # Broad, smooth, entirely synthetic RCS baseline.
        base = 6.0 + 2.5 * (f - 1.2) + 1.4 * math.sin(2.1 * f) + 0.6 * math.sin(8.8 * f)
        for active, f0, depth, width in zip(bits, RESONANCES_GHZ, DEPTHS_DB, WIDTHS_GHZ):
            if active == "1":
                base -= depth * math.exp(-0.5 * ((f - f0) / width) ** 2)
        y.append(base + array_gain_db - 20.0 + rng.gauss(0.0, noise_db))
    return x, y

def detect(x, y, threshold_db: float = 4.5):
    """Measure center of notch and mean of its two shoulders."""
    result = []
    for f0 in RESONANCES_GHZ:
        def avg(a, b):
            v = [power for f, power in zip(x, y) if a <= f - f0 <= b]
            if not v:
                raise ValueError("Insufficient spectrum sampling")
            return sum(v) / len(v)
        left = avg(-0.120, -0.075)
        middle = avg(-0.023, 0.023)
        right = avg(0.075, 0.120)
        score = (left + right) / 2 - middle
        result.append({"resonance_ghz": f0, "left_db": round(left, 4),
                       "center_db": round(middle, 4), "right_db": round(right, 4),
                       "notch_score_db": round(score, 4),
                       "bit": int(score >= threshold_db)})
    return result

def run(bits="1111", noise_db=0.8, seed=2024, threshold_db=4.5, array_gain_db=20):
    x, y = spectrum(bits, noise_db, seed, array_gain_db)
    scores = detect(x, y, threshold_db)
    decoded = "".join(str(d["bit"]) for d in scores)
    return x, y, {
        "provenance": "SYNTHETIC SIMULATION - NOT PAPER MEASUREMENTS",
        "paper_doi": PAPER,
        "bits_requested": bits,
        "bits_detected": decoded,
        "decimal_id": int(decoded, 2),
        "exact_match": decoded == bits,
        "parameters": {"noise_sigma_db": noise_db, "seed": seed,
                       "notch_threshold_db": threshold_db,
                       "array_gain_db_assumed": array_gain_db,
                       "notch_depths_db_assumed": DEPTHS_DB,
                       "notch_widths_ghz_assumed": WIDTHS_GHZ,
                       "resonances_ghz_from_paper": RESONANCES_GHZ,
                       "frequency_range_ghz": [1.2, 5.4]},
        "notch_regions": scores
    }

def benchmark(trials=20, noise_db=0.8, threshold_db=4.5):
    """Enumerate all 16 IDs, evaluate exact-ID accuracy and bit errors."""
    if trials < 1:
        raise ValueError("trials must be >= 1")
    exact, bit_errors, count = 0, 0, 0
    for t in range(trials):
        for idx in range(16):
            bits = format(idx, "04b")
            _, _, result = run(bits, noise_db, 2024 + t * 31 + idx,
                              threshold_db=threshold_db)
            exact += int(result["exact_match"])
            bit_errors += sum(a != b for a, b in zip(bits, result["bits_detected"]))
            count += 1
    return {"trials_per_id": trials, "n_ids": 16, "n_samples": count,
            "exact_id_accuracy": exact / count, "bit_error_rate": bit_errors / (4 * count),
            "description": "Synthetic Monte Carlo; not measured SDR or LoRa BER"}

def svg_chart(x, y, decoded):
    w, h, left, right, top, bottom = 1000, 440, 65, 30, 55, 55
    ymin, ymax = min(y) - 3, max(y) + 3
    fx = lambda f: left + (f - 1.2) / 4.2 * (w - left - right)
    fy = lambda p: top + (ymax - p) / (ymax - ymin) * (h - top - bottom)
    pts = " ".join(f"{fx(f):.1f},{fy(v):.1f}" for f, v in zip(x, y))
    lines = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">',
             '<rect width="100%" height="100%" fill="#0b1324"/>',
             '<text x="65" y="28" fill="#e8f4ff" font-size="17" font-family="sans-serif">Synthetic RCS / 4x4 model — decoded '+decoded+'</text>']
    for f0 in RESONANCES_GHZ:
        X = fx(f0)
        lines += [f'<line x1="{X:.1f}" x2="{X:.1f}" y1="{top}" y2="{h-bottom}" stroke="#4c647f" stroke-dasharray="4 4"/>',
                  f'<text x="{X:.1f}" y="{h-25}" text-anchor="middle" fill="#aec9dd" font-family="sans-serif" font-size="12">{f0} GHz</text>']
    for t in range(6):
        v = ymin + (ymax - ymin) * t / 5
        Y = fy(v)
        lines += [f'<line x1="{left}" x2="{w-right}" y1="{Y:.1f}" y2="{Y:.1f}" stroke="#27354b"/>',
                  f'<text x="{left-9}" y="{Y+4:.1f}" text-anchor="end" fill="#aec9dd" font-family="sans-serif" font-size="11">{v:.1f}</text>']
    lines += [f'<polyline fill="none" stroke="#4ce3bc" stroke-width="1.7" points="{pts}"/>',
              f'<text x="{w/2}" y="{h-5}" text-anchor="middle" fill="#aec9dd" font-family="sans-serif" font-size="12">Frequency (GHz) — simulated</text>',
              '<text x="10" y="45" fill="#aec9dd" font-size="11" font-family="sans-serif">relative RCS (dB)</text>', '</svg>']
    return "\n".join(lines)

def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--bits", default="1111")
    ap.add_argument("--seed", type=int, default=2024)
    ap.add_argument("--noise-db", type=float, default=0.8)
    ap.add_argument("--threshold-db", type=float, default=4.5)
    ap.add_argument("--array-gain-db", type=float, default=20.0)
    ap.add_argument("--trials", type=int, default=20)
    ap.add_argument("--out", type=Path, default=Path("results"))
    args = ap.parse_args()
    x, y, result = run(args.bits, args.noise_db, args.seed, args.threshold_db,
                       args.array_gain_db)
    result["benchmark"] = benchmark(args.trials, args.noise_db, args.threshold_db)
    args.out.mkdir(parents=True, exist_ok=True)
    with (args.out / "spectrum.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["frequency_ghz", "synthetic_rcs_db"])
        w.writerows(zip(x, y))
    (args.out / "summary.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    (args.out / "rcs.svg").write_text(svg_chart(x, y, result["bits_detected"]), encoding="utf-8")
    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    main()
