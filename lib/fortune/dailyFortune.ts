import {
  CHARACTER_TYPE_POOL,
  FORTUNE_TEXT_POOLS,
  TODAY_MESSAGE_POOL,
  scoreTier,
  type FortuneCategory,
} from "@/lib/fortune/fortuneTexts";
import {
  loadRecentFortuneCharacters,
  matchFortuneCharacter,
  saveRecentFortuneCharacter,
  type FortuneRecommendedCharacter,
} from "@/lib/fortune/characterMatch";
import { buildInputHash, intFromSeed, pickFromSeed, scoreFromSeed } from "@/lib/fortune/seed";

export type InterestField = "anime" | "manga" | "game" | "vtuber" | "light_novel" | "other";
export type PreferredGenre =
  | "action"
  | "fantasy"
  | "romance"
  | "daily"
  | "comedy"
  | "sports"
  | "mystery"
  | "sf"
  | "idol"
  | "healing"
  | "horror"
  | "other";
export type CharacterTrait =
  | "열혈"
  | "쿨"
  | "다정함"
  | "츤데레"
  | "천재"
  | "노력형"
  | "장난기"
  | "신비로움"
  | "보호자형"
  | "라이벌형";

export interface FortuneInput {
  birthday: string;
  nickname: string;
  interest: InterestField;
  genre: PreferredGenre;
  characterTrait: CharacterTrait;
}

export interface FortuneScores {
  overall: number;
  love: number;
  money: number;
  work: number;
  health: number;
  oshi: number;
}

export interface ZodiacSign {
  index: number;
  name: string;
  emoji: string;
}

export interface FortuneResult {
  dateKey: string;
  expiresAt: number;
  zodiac: ZodiacSign;
  zodiacMessage: string;
  scores: FortuneScores;
  starRatings: Record<keyof FortuneScores, string>;
  fortuneTexts: Record<keyof FortuneScores | "zodiac", string>;
  characterType: string;
  recommendedCharacter: FortuneRecommendedCharacter | null;
  luckyNumber: number;
  luckyColor: string;
  luckyItem: string;
  todayMessage: string;
  nickname: string;
}

export const INTEREST_OPTIONS: { value: InterestField; label: string }[] = [
  { value: "anime", label: "애니" },
  { value: "manga", label: "만화" },
  { value: "game", label: "게임" },
  { value: "vtuber", label: "버튜버" },
  { value: "light_novel", label: "라이트노벨" },
  { value: "other", label: "기타" },
];

export const GENRE_OPTIONS: { value: PreferredGenre; label: string }[] = [
  { value: "action", label: "액션" },
  { value: "fantasy", label: "판타지" },
  { value: "romance", label: "로맨스" },
  { value: "daily", label: "일상" },
  { value: "comedy", label: "개그" },
  { value: "sports", label: "스포츠" },
  { value: "mystery", label: "미스터리" },
  { value: "sf", label: "SF" },
  { value: "idol", label: "아이돌" },
  { value: "healing", label: "치유" },
  { value: "horror", label: "공포" },
  { value: "other", label: "기타" },
];

export const TRAIT_OPTIONS: { value: CharacterTrait; label: string }[] = [
  { value: "열혈", label: "열혈" },
  { value: "쿨", label: "쿨" },
  { value: "다정함", label: "다정함" },
  { value: "츤데레", label: "츤데레" },
  { value: "천재", label: "천재" },
  { value: "노력형", label: "노력형" },
  { value: "장난기", label: "장난기" },
  { value: "신비로움", label: "신비로움" },
  { value: "보호자형", label: "보호자형" },
  { value: "라이벌형", label: "라이벌형" },
];

const LUCKY_COLORS = [
  "빨강",
  "분홍",
  "주황",
  "노랑",
  "금색",
  "초록",
  "민트",
  "하늘색",
  "파랑",
  "남색",
  "보라",
  "라벤더",
  "흰색",
  "은색",
  "회색",
  "검정",
  "갈색",
  "베이지",
];

const LUCKY_ITEMS = [
  "이어폰",
  "노트",
  "펜",
  "텀블러",
  "키링",
  "스티커",
  "책갈피",
  "쿠션",
  "담요",
  "가방",
  "휴대폰 배경화면",
  "프로필 이미지",
  "플레이리스트",
  "간식",
  "커피",
  "피규어",
  "아크릴 스탠드",
  "포토카드",
  "만화책",
  "게임 패드",
];

const ZODIAC_SIGNS: Omit<ZodiacSign, "index">[] = [
  { name: "양자리", emoji: "♈" },
  { name: "황소자리", emoji: "♉" },
  { name: "쌍둥이자리", emoji: "♊" },
  { name: "게자리", emoji: "♋" },
  { name: "사자자리", emoji: "♌" },
  { name: "처녀자리", emoji: "♍" },
  { name: "천칭자리", emoji: "♎" },
  { name: "전갈자리", emoji: "♏" },
  { name: "사수자리", emoji: "♐" },
  { name: "염소자리", emoji: "♑" },
  { name: "물병자리", emoji: "♒" },
  { name: "물고기자리", emoji: "♓" },
];

const ZODIAC_BASE_TAGS: string[][] = [
  ["열혈", "직진", "리더"],
  ["안정감", "신뢰", "고집"],
  ["대화", "호기심", "변화"],
  ["다정함", "보호", "감정"],
  ["자신감", "주목", "리더"],
  ["분석", "정리", "섬세함"],
  ["균형", "미감", "관계"],
  ["몰입", "비밀", "집착"],
  ["자유", "모험", "낙관"],
  ["책임감", "노력", "현실감"],
  ["독창성", "개성", "거리감"],
  ["감수성", "상상", "공감"],
];

const STORAGE_KEY = "10duck:fortune-daily";
const SEOUL_TZ = "Asia/Seoul";

export interface StoredFortuneDay {
  dateKey: string;
  expiresAt: number;
  inputHash: string;
  input: FortuneInput;
  result: FortuneResult;
}

function seoulParts(base = new Date()): { y: number; m: number; d: number; h: number; min: number; sec: number } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: SEOUL_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(base);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  return { y: get("year"), m: get("month"), d: get("day"), h: get("hour"), min: get("minute"), sec: get("second") };
}

export function getTodayDateKey(base = new Date()): string {
  const { y, m, d } = seoulParts(base);
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function getSeoulDateCompact(base = new Date()): string {
  const { y, m, d } = seoulParts(base);
  return `${y}${String(m).padStart(2, "0")}${String(d).padStart(2, "0")}`;
}

export function getNextMidnightSeoulExpiry(base = new Date()): number {
  const { y, m, d, h, min, sec } = seoulParts(base);
  const msInDay = 24 * 60 * 60 * 1000;
  const elapsed = ((h * 60 + min) * 60 + sec) * 1000;
  const seoulMidnightApprox = base.getTime() - elapsed;
  return seoulMidnightApprox + msInDay;
}

export function formatDisplayDate(dateKey: string): string {
  const [y, m, d] = dateKey.split("-");
  return `${y}.${m}.${d}`;
}

export function composeBirthday(month: string, day: string): string | null {
  const m = month.trim();
  const d = day.trim();
  if (!/^\d{1,2}$/.test(m) || !/^\d{1,2}$/.test(d)) return null;
  const mi = Number(m);
  const di = Number(d);
  if (mi < 1 || mi > 12 || di < 1) return null;
  const maxDay = new Date(2024, mi, 0).getDate();
  if (di > maxDay) return null;
  return `${String(mi).padStart(2, "0")}-${String(di).padStart(2, "0")}`;
}

export function splitBirthday(mmdd: string): { month: string; day: string } {
  const [m, d] = mmdd.split("-");
  return { month: m ?? "", day: d ?? "" };
}

export function formatBirthdayPreview(month: string, day: string): string | null {
  const mmdd = composeBirthday(month, day);
  if (!mmdd) return null;
  const [m, d] = mmdd.split("-");
  return `${m}.${d}`;
}

export function calcZodiacIndex(birthday: string): number {
  const [mStr, dStr] = birthday.split("-");
  const m = Number(mStr);
  const d = Number(dStr);
  const val = m * 100 + d;

  if (val >= 321 && val <= 419) return 0;
  if (val >= 420 && val <= 520) return 1;
  if (val >= 521 && val <= 621) return 2;
  if (val >= 622 && val <= 722) return 3;
  if (val >= 723 && val <= 822) return 4;
  if (val >= 823 && val <= 922) return 5;
  if (val >= 923 && val <= 1023) return 6;
  if (val >= 1024 && val <= 1122) return 7;
  if (val >= 1123 && val <= 1221) return 8;
  if (val >= 1222 || val <= 119) return 9;
  if (val >= 120 && val <= 218) return 10;
  return 11;
}

export function calcZodiacSign(birthday: string): ZodiacSign {
  const index = calcZodiacIndex(birthday);
  return { index, ...ZODIAC_SIGNS[index] };
}

export function buildZodiacSeed(dateCompact: string, zodiacIndex: number): string {
  return `${dateCompact}${zodiacIndex}`;
}

export function buildPersonalSeed(input: FortuneInput, dateCompact: string): string {
  return [
    dateCompact,
    input.birthday,
    input.nickname.trim(),
    input.interest,
    input.genre,
    input.characterTrait,
  ].join("");
}

export function hashFortuneInput(input: FortuneInput): string {
  return buildInputHash([
    input.birthday,
    input.nickname.trim(),
    input.interest,
    input.genre,
    input.characterTrait,
  ]);
}

export function scoreToStars(score: number): string {
  if (score >= 80) return "★★★★★";
  if (score >= 60) return "★★★★☆";
  if (score >= 40) return "★★★☆☆";
  if (score >= 20) return "★★☆☆☆";
  return "★☆☆☆☆";
}

export function calcOverallScore(scores: Omit<FortuneScores, "overall">): number {
  const weighted =
    scores.love * 0.15 +
    scores.money * 0.15 +
    scores.work * 0.2 +
    scores.health * 0.2 +
    scores.oshi * 0.3;
  return Math.min(99, Math.max(0, Math.round(weighted)));
}

function correctionTags(scores: Omit<FortuneScores, "overall">): string[] {
  const tags: string[] = [];
  if (scores.love >= 60) tags.push("다정함", "관계", "매력");
  if (scores.money >= 60) tags.push("현실감", "신중함", "안정감");
  if (scores.work >= 60) tags.push("천재", "분석", "노력형");
  if (scores.health >= 60) tags.push("활발함", "밝음", "에너지");
  if (scores.oshi >= 60) tags.push("몰입", "감성", "취향");
  return tags;
}

export function buildFinalTags(
  zodiacIndex: number,
  scores: Omit<FortuneScores, "overall">,
  trait: CharacterTrait,
): string[] {
  const base = ZODIAC_BASE_TAGS[zodiacIndex] ?? [];
  const corrected = correctionTags(scores);
  return Array.from(new Set([...base, ...corrected, trait]));
}

function pickFortuneText(category: FortuneCategory, score: number, seedKey: string): string {
  const tier = scoreTier(score);
  const pool = FORTUNE_TEXT_POOLS[category][tier] ?? FORTUNE_TEXT_POOLS[category][0];
  return pickFromSeed(pool, `${seedKey}|${category}|${tier}`);
}

function buildCharacterType(finalTags: string[], personalSeed: string, trait: CharacterTrait): string {
  const pool = CHARACTER_TYPE_POOL.default;
  const tagHint = finalTags.slice(0, 3).join(",");
  return pickFromSeed(pool, `${personalSeed}|type|${trait}|${tagHint}`);
}

function isValidStoredResult(result: unknown): result is FortuneResult {
  if (!result || typeof result !== "object") return false;
  const r = result as FortuneResult;
  return Boolean(r.zodiac?.name && r.scores?.overall != null && r.expiresAt);
}

export function isStoredFortuneValid(stored: StoredFortuneDay, now = Date.now()): boolean {
  if (stored.dateKey !== getTodayDateKey()) return false;
  if (stored.expiresAt <= now) return false;
  if (!isValidStoredResult(stored.result)) return false;
  return true;
}

export function loadStoredFortuneDay(): StoredFortuneDay | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredFortuneDay;
    if (!isStoredFortuneValid(parsed)) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveStoredFortuneDay(input: FortuneInput, result: FortuneResult): void {
  if (typeof window === "undefined") return;
  const payload: StoredFortuneDay = {
    dateKey: result.dateKey,
    expiresAt: result.expiresAt,
    inputHash: hashFortuneInput(input),
    input,
    result,
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function clearStoredFortuneDay(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export async function generateCharacterFortune(input: FortuneInput, today = new Date()): Promise<FortuneResult> {
  const dateKey = getTodayDateKey(today);
  const dateCompact = getSeoulDateCompact(today);
  const expiresAt = getNextMidnightSeoulExpiry(today);
  const zodiac = calcZodiacSign(input.birthday);
  const zodiacSeed = buildZodiacSeed(dateCompact, zodiac.index);
  const personalSeed = buildPersonalSeed(input, dateCompact);

  const love = scoreFromSeed(`${zodiacSeed}|love`);
  const money = scoreFromSeed(`${zodiacSeed}|money`);
  const work = scoreFromSeed(`${zodiacSeed}|work`);
  const health = scoreFromSeed(`${zodiacSeed}|health`);
  const oshi = scoreFromSeed(`${personalSeed}|oshi`);
  const partial = { love, money, work, health, oshi };
  const overall = calcOverallScore(partial);
  const scores: FortuneScores = { overall, ...partial };

  const finalTags = buildFinalTags(zodiac.index, partial, input.characterTrait);
  const recent = loadRecentFortuneCharacters();
  const recommendedCharacter = await matchFortuneCharacter({
    finalTags,
    trait: input.characterTrait,
    interest: input.interest,
    genre: input.genre,
    personalSeed,
    recentCharacterIds: recent.ids,
    recentWorkIds: recent.workIds,
  });

  if (recommendedCharacter) {
    saveRecentFortuneCharacter(recommendedCharacter.id, recommendedCharacter.workId);
  }

  const starRatings: FortuneResult["starRatings"] = {
    overall: scoreToStars(overall),
    love: scoreToStars(love),
    money: scoreToStars(money),
    work: scoreToStars(work),
    health: scoreToStars(health),
    oshi: scoreToStars(oshi),
  };

  const fortuneTexts = {
    zodiac: pickFortuneText("zodiac", overall, zodiacSeed),
    overall: pickFortuneText("overall", overall, zodiacSeed),
    love: pickFortuneText("love", love, zodiacSeed),
    money: pickFortuneText("money", money, zodiacSeed),
    work: pickFortuneText("work", work, zodiacSeed),
    health: pickFortuneText("health", health, zodiacSeed),
    oshi: pickFortuneText("oshi", oshi, personalSeed),
  };

  return {
    dateKey,
    expiresAt,
    zodiac,
    zodiacMessage: fortuneTexts.zodiac,
    scores,
    starRatings,
    fortuneTexts,
    characterType: buildCharacterType(finalTags, personalSeed, input.characterTrait),
    recommendedCharacter,
    luckyNumber: intFromSeed(`${personalSeed}|luckyNumber`, 1, 99),
    luckyColor: pickFromSeed(LUCKY_COLORS, `${personalSeed}|color`),
    luckyItem: pickFromSeed(LUCKY_ITEMS, `${personalSeed}|item`),
    todayMessage: pickFromSeed(TODAY_MESSAGE_POOL, `${personalSeed}|message`),
    nickname: input.nickname.trim(),
  };
}

/** URL 공유용 페이로드 (서버 저장 없음) */
export type FortuneSharePayload = {
  result: FortuneResult;
};

function encodeSharePayload(payload: FortuneSharePayload): string {
  const json = JSON.stringify(payload);
  return encodeURIComponent(btoa(unescape(encodeURIComponent(json))));
}

function decodeSharePayload(encoded: string): FortuneSharePayload | null {
  try {
    const json = decodeURIComponent(escape(atob(decodeURIComponent(encoded))));
    const payload = JSON.parse(json) as FortuneSharePayload;
    if (!payload?.result?.dateKey) return null;
    if (payload.result.dateKey !== getTodayDateKey()) return null;
    if (payload.result.expiresAt <= Date.now()) return null;
    if (!isValidStoredResult(payload.result)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function buildFortuneShareUrl(payload: FortuneSharePayload, origin?: string): string {
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/play/fortune/view?d=${encodeSharePayload(payload)}`;
}

export function parseFortuneShareSearch(search: string): FortuneSharePayload | null {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const d = params.get("d");
  if (!d) return null;
  return decodeSharePayload(d);
}

export function scheduleFortuneExpiryCleanup(expiresAt: number, onExpire: () => void): () => void {
  const ms = expiresAt - Date.now();
  if (ms <= 0) {
    onExpire();
    return () => undefined;
  }
  const timer = window.setTimeout(onExpire, ms + 50);
  return () => window.clearTimeout(timer);
}

/** @deprecated use generateCharacterFortune */
export async function generateDailyFortune(input: FortuneInput, today?: Date): Promise<FortuneResult> {
  return generateCharacterFortune(input, today);
}

/** Mao 대사용 — 종합 점수 기반 */
export function buildMaoFortuneLine(result: FortuneResult): string {
  const s = result.scores.overall;
  if (s >= 75) {
    return pickFromSeed(
      [
        "오늘 기운이 꽤 좋아요. 최애와 함께 즐거운 하루 보내세요!",
        "별자리와 취향이 잘 맞는 날이에요. 추천 캐릭터도 한번 봐보세요.",
      ],
      `${result.dateKey}|mao|high`,
    );
  }
  if (s < 40) {
    return pickFromSeed(
      [
        "오늘은 조금 조용히 쉬어가도 괜찮아요. 좋아하는 작품 하나만 봐도 충분해요.",
        "무리하지 말고 편하게 즐기는 하루로 보내면 돼요.",
      ],
      `${result.dateKey}|mao|low`,
    );
  }
  return pickFromSeed(
    [
      "무난한 하루예요. 오늘의 캐릭터 운세, 가볍게 즐겨보세요.",
      "취향에 맞는 캐릭터 타입이 나왔을지도 몰라요. 결과를 천천히 읽어보세요.",
    ],
    `${result.dateKey}|mao|mid`,
  );
}
