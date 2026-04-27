export type Board = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  created_at: string;
};

export type PostSourceType = "FEED" | "BOARD";

export type CommunityPost = {
  id: string;
  created_at: string;
  title: string | null; // 피드 글은 제목이 없을 수 있음
  content: string;
  author_id: string;
  author_email: string;
  
  // 하이브리드 게시판-피드용 필드
  board_id: string | null;
  source_type: PostSourceType;
  origin_post_id: string | null;
  is_hot: boolean;
  hot_promoted_at: string | null;
};
