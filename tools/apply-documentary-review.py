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
        if decision["action"] not in {"exclude_from_winery_queue", "hold_for_identity_and_location", "retain_distinct_candidate"}:
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
    # Resolve only explicitly sourced pairs; retain original match provenance.
    distinct = {key: set() for key in by_id}
    pairs = set()
    for pair in evidence.get("distinctPairs", []):
        ids = pair.get("candidateIds", [])
        if len(ids) != 2 or len(set(ids)) != 2 or any(i not in by_id for i in ids):
            raise ValueError("Invalid distinct pair")
        a, b = ids
        key = tuple(sorted(ids))
        if key in pairs or not pair.get("sources") or not all(u.startswith("https://") for u in pair["sources"]):
            raise ValueError("Repeated pair or missing evidence")
        if b not in by_id[a].get("batchMatches", []) or a not in by_id[b].get("batchMatches", []):
            raise ValueError("Pair is not an original mutual match")
        if a not in seen or b not in seen:
            raise ValueError("Both pair members require documentary review")
        pairs.add(key)
        distinct[a].add(b)
        distinct[b].add(a)
    for key, row in by_id.items():
        row["resolvedDistinctBatchMatches"] = sorted(distinct[key])
        row["unresolvedBatchMatches"] = sorted(set(row.get("batchMatches", [])) - distinct[key])
        flags = set(row["reviewFlags"])
        if distinct[key]:
            flags.add("NEIGHBOURING_ENTITIES_DISTINGUISHED")
        if row["unresolvedBatchMatches"]:
            flags.add("POSSIBLE_BATCH_DUPLICATE")
        else:
            flags.discard("POSSIBLE_BATCH_DUPLICATE")
        row["reviewFlags"] = sorted(flags)
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
        "distinctPairsResolved": len(pairs),
        "recordsWithUnresolvedBatchMatches": sum(bool(r["unresolvedBatchMatches"]) for r in result["records"]),
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
