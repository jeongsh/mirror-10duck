export type VoteCount = {
  watch: number;
  maybe: number;
  skip: number;
};

export type ReviewAgg = {
  sum: number;
  count: number;
};

export function lineupHeatScore(counts: VoteCount | undefined): number {
  if (!counts) return 0;
  return counts.watch * 3 + counts.maybe * 2 + counts.skip;
}

export function buildVoteCountsByItem(
  rows: Array<{ release_item_id: string; intent: "watch" | "maybe" | "skip" }>,
): Record<string, VoteCount> {
  const byItem: Record<string, VoteCount> = {};
  for (const row of rows) {
    if (!byItem[row.release_item_id]) {
      byItem[row.release_item_id] = { watch: 0, maybe: 0, skip: 0 };
    }
    byItem[row.release_item_id][row.intent] += 1;
  }
  return byItem;
}

export function buildReviewAggByItem(
  rows: Array<{ release_item_id: string; stars: number }>,
): Record<string, ReviewAgg> {
  const byItem: Record<string, ReviewAgg> = {};
  for (const row of rows) {
    if (!byItem[row.release_item_id]) {
      byItem[row.release_item_id] = { sum: 0, count: 0 };
    }
    byItem[row.release_item_id].sum += row.stars;
    byItem[row.release_item_id].count += 1;
  }
  return byItem;
}

export function compareReleasePopularity(
  aId: string,
  bId: string,
  reviewAgg: Record<string, ReviewAgg>,
  votesByItem: Record<string, VoteCount>,
): number {
  const ra = reviewAgg[aId];
  const rb = reviewAgg[bId];
  const avgA = ra && ra.count > 0 ? ra.sum / ra.count : 0;
  const avgB = rb && rb.count > 0 ? rb.sum / rb.count : 0;
  if (avgB !== avgA) return avgB - avgA;

  const cA = ra?.count ?? 0;
  const cB = rb?.count ?? 0;
  if (cB !== cA) return cB - cA;

  const ha = lineupHeatScore(votesByItem[aId]);
  const hb = lineupHeatScore(votesByItem[bId]);
  if (hb !== ha) return hb - ha;

  return 0;
}

export function popularityDisplayCount(
  releaseItemId: string,
  reviewAgg: Record<string, ReviewAgg>,
  votesByItem: Record<string, VoteCount>,
): number {
  const reviewCount = reviewAgg[releaseItemId]?.count ?? 0;
  if (reviewCount > 0) return reviewCount;
  return lineupHeatScore(votesByItem[releaseItemId]);
}
