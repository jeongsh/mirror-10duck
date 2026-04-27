export const COMMUNITY_CATEGORIES = [
  "일반",
  "캐릭터",
  "잡담",
  "굿즈",
  "질문",
  "공지",
] as const;

export type CommunityCategory = (typeof COMMUNITY_CATEGORIES)[number];

export type CommunityPost = {
  id: string;
  created_at: string;
  title: string;
  content: string;
  category: CommunityCategory;
  author_id: string;
  author_email: string;
};
