"""Regression checks for documentary review gates; run from repository root."""
import copy
import importlib.util
import json
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("documentary", pathlib.Path(__file__).with_name("apply-documentary-review.py"))
review = importlib.util.module_from_spec(spec)
spec.loader.exec_module(review)

class DocumentaryReviewTests(unittest.TestCase):
    def setUp(self):
        self.report = json.loads((ROOT / "data/review/spain-quality-review-20261016.json").read_text())
        self.evidence = json.loads((ROOT / "data/review/documentary-decisions-20261016.json").read_text())

    def test_preserves_original_entities_coordinates_and_input(self):
        before = copy.deepcopy(self.report)
        output = review.apply(self.report, self.evidence)
        self.assertEqual(self.report, before)
        self.assertEqual(len(output["records"]), 161)
        for a, b in zip(self.report["records"], output["records"]):
            for key in ("candidateId", "lat", "lon", "municipality", "batchMatches"):
                self.assertEqual(a.get(key), b.get(key))

    def test_only_two_exclusions_no_approval(self):
        output = review.apply(self.report, self.evidence)
        excluded = {r["candidateId"] for r in output["records"] if r["state"] == "excluded_from_winery_queue"}
        self.assertEqual(excluded, {"murcia_5280", "murcia_4948"})
        self.assertTrue(all(not r["indexable"] for r in output["records"]))
        self.assertEqual(output["publicationReadyCount"], 0)
        self.assertFalse(output["productionWritePerformed"])

    def test_only_documented_pairs_resolved(self):
        output = review.apply(self.report, self.evidence)
        pending = {r["candidateId"] for r in output["records"] if r["unresolvedBatchMatches"]}
        self.assertEqual(pending, {"murcia_905", "murcia_6367", "murcia_6369", "murcia_5320", "euskadi_fb29cc14fefab6c7", "euskadi_c2170a14b70ab5e9"})
        self.assertEqual(output["documentaryReviewSummary"]["distinctPairsResolved"], 11)
        self.assertEqual(review.apply(output, self.evidence), output)

    def test_unknown_and_repeated_decisions_rejected(self):
        bad = copy.deepcopy(self.evidence)
        bad["decisions"][0]["candidateIds"] = ["unknown"]
        with self.assertRaises(ValueError):
            review.apply(self.report, bad)
        bad = copy.deepcopy(self.evidence)
        bad["decisions"].append(bad["decisions"][0])
        with self.assertRaises(ValueError):
            review.apply(self.report, bad)

    def test_unsourced_and_invented_pair_rejected(self):
        bad = copy.deepcopy(self.evidence)
        bad["distinctPairs"][0]["sources"] = []
        with self.assertRaises(ValueError):
            review.apply(self.report, bad)
        bad = copy.deepcopy(self.evidence)
        bad["distinctPairs"][0]["candidateIds"] = ["murcia_905", "murcia_6369"]
        with self.assertRaises(ValueError):
            review.apply(self.report, bad)

if __name__ == "__main__":
    unittest.main()
