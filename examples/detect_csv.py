#!/usr/bin/env python3
"""Decode a frequency sweep CSV with the same 3-window FHS algorithm.

Input must already be background-calibrated/normalized if claimed measured.
--measured is only an operator label; it is not a proof of data provenance.
"""
import argparse
import csv
import importlib.util
import json
from pathlib import Path

MODULE = Path(__file__).resolve().parents[1] / "simulation" / "chipless.py"
spec = importlib.util.spec_from_file_location("chipless", MODULE)
chipless = importlib.util.module_from_spec(spec)
spec.loader.exec_module(chipless)

def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("csv_path", type=Path)
    ap.add_argument("--threshold-db", type=float, default=4.5)
    ap.add_argument("--measured", action="store_true")
    args = ap.parse_args()
    x, y = [], []
    with args.csv_path.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        if not reader.fieldnames:
            raise ValueError("CSV requires a header")
        freq_col = next((k for k in ("frequency_ghz", "f_ghz") if k in reader.fieldnames), None)
        value_col = next((k for k in ("power_db", "rcs_db", "synthetic_rcs_db") if k in reader.fieldnames), None)
        if not freq_col or not value_col:
            raise ValueError("Need frequency_ghz + power_db/rcs_db/synthetic_rcs_db")
        for row in reader:
            x.append(float(row[freq_col]))
            y.append(float(row[value_col]))
    paired = sorted(zip(x,y))
    if not paired:
        raise ValueError("CSV contains no samples")
    x,y = zip(*paired)
    detected = chipless.detect(x,y,args.threshold_db)
    bits = "".join(str(d["bit"]) for d in detected)
    print(json.dumps({"source_file":str(args.csv_path),
                      "provenance":"OPERATOR_CLAIMED_MEASURED" if args.measured else "UNVERIFIED_DATA_OR_SYNTHETIC",
                      "background_calibration_verified":False,
                      "detection_threshold_db":args.threshold_db,"bits_detected":bits,
                      "decimal_id":int(bits,2),"notch_regions":detected},indent=2))

if __name__=="__main__":
    main()
