import importlib.util
import pathlib
import unittest
path=pathlib.Path(__file__).with_name("reader.py")
spec=importlib.util.spec_from_file_location("reader",path)
reader=importlib.util.module_from_spec(spec);spec.loader.exec_module(reader)

class VietnamLabTests(unittest.TestCase):
    def test_all_ring_events(self):
        for a in (0,1):
            for q in range(3):
                for tag in range(16):
                    enc=reader.encode_ring(tag,q,a)
                    self.assertEqual(reader.decode_ring(enc["state"])["tag_id"],tag)
                    self.assertEqual(reader.decode_ring(enc["state"])["quality"],q)
                    self.assertEqual(reader.decode_ring(enc["state"])["alarm"],a)
                    self.assertEqual(enc["mod4"],enc["state"]%4)
                    self.assertEqual(enc["mod27"],enc["state"]%27)
                    self.assertEqual(enc["byte"],tag+16*q+48*a)

    def test_unused_ring_states(self):
        for n in range(96,108):
            with self.assertRaises(ValueError):
                reader.decode_ring(n)

    def test_duty_fails_outside(self):
        self.assertFalse(reader.duty_check(923.6)["inside_nominal_lpwan_band"])
        self.assertFalse(reader.duty_check(921.4,erp_mw=50)["erp_within_25mw"])
        self.assertFalse(reader.duty_check(921.4,time_on_air_ms=2000,interval_seconds=10)["duty_cycle_within_limit"])
        self.assertTrue(reader.duty_check()["inside_nominal_lpwan_band"])

    def test_zero_noise_no_false_detection(self):
        rng=__import__("random").Random(4)
        for truth in (0,1):
            pts=reader.synth_sample(bool(truth),rng,0,0,0,0)
            pred,score=reader.classify(pts,"median")
            self.assertEqual(pred,truth,(truth,score))

    def test_deterministic_research(self):
        x=reader.trial_benchmark(trials=20)
        self.assertEqual(x,reader.trial_benchmark(trials=20))
        self.assertEqual(x["baseline_vs_candidate"]["median_guard"]["n"],40)

if __name__=="__main__":
    unittest.main()
