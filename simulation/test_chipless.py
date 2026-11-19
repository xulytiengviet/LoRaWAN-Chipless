"""Regression tests for the mathematical simulator, not RF measurements."""
import importlib.util
import pathlib
import unittest

spec = importlib.util.spec_from_file_location("chipless", pathlib.Path(__file__).with_name("chipless.py"))
model = importlib.util.module_from_spec(spec)
spec.loader.exec_module(model)

class ReproductionTests(unittest.TestCase):
    def test_all_16_tags_low_noise(self):
        for n in range(16):
            bits = format(n, "04b")
            _, _, result = model.run(bits, noise_db=0.2, seed=2024 + n)
            self.assertEqual(result["bits_detected"], bits, result)
            self.assertEqual(result["decimal_id"], n)

    def test_paper_example_1111_equals_15(self):
        _, _, res = model.run("1111")
        self.assertEqual(res["bits_detected"], "1111")
        self.assertEqual(res["decimal_id"], 15)

    def test_repeatability_by_seed(self):
        self.assertEqual(model.run("1001", seed=73), model.run("1001", seed=73))

    def test_threshold_rejects_non_notches(self):
        xs, ys = model.spectrum("0000", noise_db=0.0)
        self.assertEqual([d["bit"] for d in model.detect(xs, ys)], [0, 0, 0, 0])

    def test_invalid_id(self):
        with self.assertRaises(ValueError):
            model.run("101")

    def test_benchmark_bounds(self):
        b = model.benchmark(trials=1, noise_db=0.4)
        self.assertEqual(b["n_samples"], 16)
        self.assertTrue(0 <= b["bit_error_rate"] <= 1)

if __name__ == "__main__":
    unittest.main()
