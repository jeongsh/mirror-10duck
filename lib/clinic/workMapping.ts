import type { AnimeCandidate } from "./types";

type WorkRow = {
  title: string;
  original_title: string | null;
  genres: string[] | null;
  episode_count: number | null;
  end_date: string | null;
  synopsis: string | null;
  cover_image_url: string | null;
};

const GENRE_TO_TAGS: Record<string, string[]> = {
  일상: ["일상", "코미디"],
  코미디: ["코미디", "일상"],
  학원: ["학원", "일상"],
  로맨스: ["로맨스", "캐릭터성"],
  액션: ["액션", "이능력"],
  판타지: ["판타지", "세계관"],
  SF: ["SF", "미스터리"],
  "SF·판타지": ["SF", "판타지", "미스터리"],
  미스터리: ["미스터리", "추리"],
  추리: ["추리", "미스터리"],
  스릴러: ["미스터리", "디스토피아"],
  스포츠: ["스포츠", "라이벌", "성장"],
  음악: ["음악", "성장"],
  아이돌: ["아이돌", "음악"],
  이세계: ["판타지", "이능력", "액션"],
  배틀: ["액션", "이능력"],
  모험: ["판타지", "액션", "성장"],
  힐링: ["일상", "코미디"],
  "다크 판타지": ["디스토피아", "정치극", "후유증"],
  디스토피아: ["디스토피아", "정치극"],
  정치: ["정치극", "세계관"],
  성장: ["성장", "캐릭터성"],
  청춘: ["학원", "성장", "로맨스"],
  공포: ["잔인함", "미스터리"],
  호러: ["잔인함", "미스터리"],
};

const RISK_FROM_GENRE: Record<string, string[]> = {
  "다크 판타지": ["너무 잔인한 장면"],
  디스토피아: ["너무 잔인한 장면", "무거운 감정선"],
  공포: ["너무 잔인한 장면"],
  호러: ["너무 잔인한 장면"],
  로맨스: ["갑자기 분위기 하렘"],
  "SF·판타지": ["설명만 많은 세계관"],
  SF: ["설명만 많은 세계관", "너무 느린 초반"],
};

function inferLength(episodeCount: number | null): AnimeCandidate["length"] {
  if (!episodeCount || episodeCount <= 0) return "medium";
  if (episodeCount <= 13) return "short";
  if (episodeCount <= 26) return "medium";
  return "long";
}

function inferIntro(genres: string[], synopsis: string | null): AnimeCandidate["intro"] {
  const text = `${genres.join(" ")} ${synopsis ?? ""}`;
  if (/느린|서사|축적|후반/.test(text)) return "slow";
  if (/일상|코미디|개그|학원|힐링/.test(text)) return "fast";
  return "medium";
}

function buildReason(work: WorkRow, tags: string[]): string {
  const genreLabel = (work.genres ?? []).slice(0, 3).join(" · ") || "애니";
  const tagHint = tags.slice(0, 2).join(", ");
  return `${genreLabel} 계열 작품으로, ${tagHint} 성분이 확인된 후보입니다.`;
}

export function mapWorkToClinicCandidate(work: WorkRow): AnimeCandidate {
  const genres = work.genres ?? [];
  const tagSet = new Set<string>();
  for (const genre of genres) {
    for (const tag of GENRE_TO_TAGS[genre] ?? [genre]) {
      tagSet.add(tag);
    }
  }
  if (tagSet.size === 0) tagSet.add("일상");

  const riskSet = new Set<string>();
  for (const genre of genres) {
    for (const risk of RISK_FROM_GENRE[genre] ?? []) {
      riskSet.add(risk);
    }
  }
  if (!work.end_date && (work.episode_count ?? 0) > 0) {
    riskSet.add("미완결");
  }

  const tags = [...tagSet];
  return {
    title: work.title,
    tags,
    length: inferLength(work.episode_count),
    complete: Boolean(work.end_date),
    intro: inferIntro(genres, work.synopsis),
    riskTags: [...riskSet],
    reason: buildReason(work, tags),
    coverImageUrl: work.cover_image_url,
  };
}

/** DB 연결 전·오프라인용 시드 후보 */
export const FALLBACK_CANDIDATES: AnimeCandidate[] = [
  {
    title: "스파이 패밀리",
    tags: ["일상", "코미디", "유사가족", "액션"],
    length: "medium",
    complete: false,
    intro: "fast",
    riskTags: ["미완결"],
    reason: "가족 코미디와 가벼운 액션이 같이 들어간 안전한 응급처방입니다.",
  },
  {
    title: "봇치 더 록!",
    tags: ["일상", "코미디", "성장", "학원", "음악"],
    length: "short",
    complete: true,
    intro: "fast",
    riskTags: [],
    reason: "개그와 성장선이 같이 있어 회복과 응원을 동시에 줍니다.",
  },
  {
    title: "하이큐!!",
    tags: ["스포츠", "성장", "라이벌", "유사가족"],
    length: "long",
    complete: true,
    intro: "medium",
    riskTags: ["장편"],
    reason: "라이벌 인정과 팀 성장 카타르시스가 누적형으로 강합니다.",
  },
  {
    title: "모브사이코 100",
    tags: ["이능력", "액션", "성장", "코미디", "사제관계"],
    length: "medium",
    complete: true,
    intro: "fast",
    riskTags: [],
    reason: "초능력 연출과 캐릭터 성장이 함께 작동하는 균형형 처방입니다.",
  },
  {
    title: "문호 스트레이독스",
    tags: ["이능력", "액션", "캐릭터성", "구원서사", "미스터리"],
    length: "long",
    complete: false,
    intro: "fast",
    riskTags: ["미완결", "장편"],
    reason: "개성 강한 캐릭터와 능력자 배틀로 최애 발생 가능성이 높습니다.",
  },
  {
    title: "86 -에이티식스-",
    tags: ["디스토피아", "정치극", "구원서사", "SF", "후유증"],
    length: "medium",
    complete: true,
    intro: "medium",
    riskTags: ["잔인함", "무거운 감정선"],
    reason: "세계관 압박과 관계성 후유증이 강하게 남는 처방입니다.",
  },
  {
    title: "강철의 연금술사 BROTHERHOOD",
    tags: ["판타지", "액션", "성장", "정치극", "유사가족"],
    length: "long",
    complete: true,
    intro: "fast",
    riskTags: ["장편"],
    reason: "세계관, 액션, 가족 서사, 완결성이 고르게 강합니다.",
  },
  {
    title: "슈타인즈 게이트",
    tags: ["SF", "미스터리", "후유증", "느린 전개"],
    length: "medium",
    complete: true,
    intro: "slow",
    riskTags: ["너무 느린 초반"],
    reason: "초반은 느리지만 후반 약효가 강한 지연성 처방입니다.",
  },
  {
    title: "카구야 님은 고백받고 싶어",
    tags: ["로맨스", "코미디", "학원", "캐릭터성"],
    length: "medium",
    complete: false,
    intro: "fast",
    riskTags: ["미완결"],
    reason: "로맨스 삽질과 개그 템포가 즉각적으로 작동합니다.",
  },
  {
    title: "바이올렛 에버가든",
    tags: ["후유증", "성장", "감정선", "일상"],
    length: "short",
    complete: true,
    intro: "medium",
    riskTags: ["무거운 감정선"],
    reason: "절제된 감정선과 회복 서사로 조용한 후유증을 남깁니다.",
  },
  {
    title: "진격의 거인",
    tags: ["액션", "디스토피아", "정치극", "미스터리", "잔인함"],
    length: "long",
    complete: true,
    intro: "fast",
    riskTags: ["너무 잔인한 장면", "장편"],
    reason: "세계관, 정치극, 고위험 고효능 성분이 매우 강합니다.",
  },
  {
    title: "일상",
    tags: ["일상", "코미디", "학원"],
    length: "medium",
    complete: true,
    intro: "fast",
    riskTags: [],
    reason: "큰 사건 없이도 뇌를 퇴근시키는 순도 높은 개그 처방입니다.",
  },
];

export function mergeCandidates(db: AnimeCandidate[], fallback = FALLBACK_CANDIDATES): AnimeCandidate[] {
  const byTitle = new Map<string, AnimeCandidate>();
  for (const item of fallback) byTitle.set(item.title, item);
  for (const item of db) byTitle.set(item.title, item);
  return [...byTitle.values()];
}
