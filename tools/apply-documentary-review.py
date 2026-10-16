"""Apply documentary decisions to a review queue, never a production catalogue.
Usage: python tools/apply-documentary-review.py INPUT DECISIONS OUTPUT
Original records and coordinates are retained. No identity merges are performed.
"""
import collections
import copy
import json
import sys

def apply(report, evidence):
    result = copy.deepcopy(report)
    by_id = {r["candidateId"]: r for r in result["records"]}
    if len(by_id) != len(result["records"]):
        raise ValueError("Duplicate candidate IDs")
    seen = set()
    for decision in evidence["decisions"]:
        if decision["action"] not in {"exclude_from_winery_queue", "hold_for_identity_and_location"}:
            raise ValueError("Unsupported documentary action")
        if not decision.get("sources") or not all(u.startswith("https://") for u in decision["sources"]):
            raise ValueError("Source URLs required")
        for candidate_id in decision["candidateIds"]:
            if candidate_id not in by_id or candidate_id in seen:
                raise ValueError("Unknown or repeated candidate ID: " + candidate_id)
            seen.add(candidate_id)
            row = by_id[candidate_id]
            row["documentaryReview"] = {**decision, "checkedAt": evidence["checkedAt"]}
            row["reviewFlags"] = sorted(set(row["reviewFlags"]) | set(decision["flags"]))
            row["queueDisposition"] = decision["action"]
            row["state"] = "excluded_from_winery_queue" if decision["action"] == "exclude_from_winery_queue" else "blocked_for_publication"
    # This review artifact is not an approval channel, including for untouched rows.
    for row in result["records"]:
        row.update(indexable=False, visitsVerified=False)
        if row.get("state") != "excluded_from_winery_queue":
            row["state"] = "blocked_for_publication"
    excluded = sum(r.get("queueDisposition") == "exclude_from_winery_queue" for r in result["records"])
    result.update(publicationReadyCount=0, productionWritePerformed=False)
    result["documentaryReviewSummary"] = {
        "recordsWithDocumentaryDecisions": len(seen),
        "excludedFromWineryQueue": excluded,
        "remainingCandidatesIncludingUnresolvedDuplicates": len(by_id) - excluded,
        "completeManualReview": False,
    }
    result["summary"]["flags"] = dict(collections.Counter(f for r in result["records"] for f in r["reviewFlags"]))
    return result

if __name__ == "__main__":
    src, decisions, out = sys.argv[1:]
    with open(src) as f, open(decisions) as g:
        result = apply(json.load(f), json.load(g))
    with open(out, "w") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(json.dumps(result["documentaryReviewSummary"]))
