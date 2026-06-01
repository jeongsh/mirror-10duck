export type NavItem = {
  href: string;
  label: string;
  matchPrefix?: string | null;
  description?: string;
  status?: "live" | "planned";
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const PRIMARY_NAV_ITEMS: NavItem[] = [
  { href: "/", label: "홈", matchPrefix: null },
  { href: "/board", label: "채널", matchPrefix: null },
  { href: "/feed", label: "피드", matchPrefix: null },
  { href: "/news", label: "소식", matchPrefix: null },
  { href: "/season/current", label: "이번 분기", matchPrefix: "/season" },
];

export const CREATE_NAV_GROUPS: NavGroup[] = [
  {
    label: "정체성 만들기",
    items: [
      {
        href: "/play/oshi-card",
        label: "최애 프로필 카드",
        description: "최애, 인생작, 취향 태그를 공유 카드로 만든다.",
        status: "live",
      },
      {
        href: "/play/otaku-type",
        label: "오타쿠 성향 테스트",
        description: "웃긴 결과명과 프로필 배지로 가입 전환을 만든다.",
        status: "live",
      },
      {
        href: "/play/oshi-analysis",
        label: "최애 기반 취향분석",
        description: "최애 5~10명을 고르면 공통 태그로 취향을 폭로한다.",
        status: "live",
      },
      {
        href: "/play/fortune",
        label: "오늘의 캐릭터 운세",
        description: "별자리 운세와 취향 기반 캐릭터 추천을 함께 본다.",
        status: "live",
      },
      {
        href: "/play/timeline",
        label: "덕질 연대기",
        description: "입덕작부터 인생작까지 개인 히스토리를 카드화한다.",
        status: "planned",
      },
    ],
  },
  {
    label: "시즌 공유",
    items: [
      {
        href: "/play/season-checklist",
        label: "분기 애니 체크리스트",
        description: "보는 작품, 찍먹, 하차, 기대작을 공유 이미지로 만든다.",
        status: "planned",
      },
    ],
  },
  {
    label: "캐릭터 탐구",
    items: [
      {
        href: "/play/character-exam",
        label: "캐릭터 중간고사",
        description: "좋아하는 캐릭터를 얼마나 아는지 시험처럼 풀어보고 등급·생활기록부를 받는다.",
        status: "live",
      },
    ],
  },
  {
    label: "참여형 놀이",
    items: [
      {
        href: "/play/worldcup",
        label: "최애 월드컵",
        description: "텍스트 중심 투표로 저작권 리스크를 낮춘다.",
        status: "planned",
      },
      {
        href: "/play/speech-bubble",
        label: "말풍선 밈 생성기",
        description: "Live2D 캐릭터성과 공유 짤을 연결한다.",
        status: "planned",
      },
      {
        href: "/play/match",
        label: "최애 궁합",
        description: "최애, 장르, 금지 취향 기반으로 유저 관계망을 만든다.",
        status: "planned",
      },
      {
        href: "/play/recommend",
        label: "애니 추천",
        description: "캐릭터와 몇 가지 질문으로 볼 만한 애니를 고른다.",
        status: "live",
      },
    ],
  },
];

export function isNavItemActive(pathname: string, item: NavItem) {
  return (
    pathname === item.href ||
    (item.matchPrefix
      ? pathname.startsWith(item.matchPrefix)
      : item.href !== "/" && pathname.startsWith(item.href))
  );
}

export function isCreateNavActive(pathname: string) {
  return pathname.startsWith("/play");
}
