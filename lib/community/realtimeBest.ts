import { CommunityPost, postAggregateDefaults } from "@/types/community";

export const REALTIME_BEST_MIN_SCORE = 50;
export const REALTIME_BEST_FETCH_LIMIT = 100;
export const REALTIME_BEST_HOME_LIMIT = 10;
export const REALTIME_BEST_PAGE_LIMIT = 50;

export function getRealtimeBestScore(post: CommunityPost) {
  const aggregate = postAggregateDefaults(post);
  return aggregate.upvote_count * 5 + aggregate.comment_count * 3 + aggregate.view_count * 0.2;
}

export function isRealtimeBestPost(post: CommunityPost) {
  return post.source_type === "BOARD" && getRealtimeBestScore(post) >= REALTIME_BEST_MIN_SCORE;
}

export function compareRealtimeBestPosts(a: CommunityPost, b: CommunityPost) {
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}
