import type { Axis } from "./types";

export const TAG_AXIS: Record<string, Partial<Record<Axis, number>>> = {
  일상: { heal: 10, light: 8 },
  코미디: { light: 12, heal: 6 },
  학원: { heal: 4, light: 4, relationship: 3 },
  로맨스: { character: 5, relationship: 5, light: 3 },
  성장: { battle: 4, after: 4, character: 4 },
  라이벌: { relationship: 10, battle: 8 },
  사제관계: { relationship: 8, character: 5 },
  유사가족: { relationship: 10, heal: 6 },
  구원서사: { relationship: 12, after: 10, character: 5 },
  이능력: { battle: 10, world: 4 },
  액션: { battle: 12 },
  판타지: { world: 10, battle: 4 },
  정치극: { world: 12, mystery: 6 },
  디스토피아: { world: 10, after: 8 },
  SF: { world: 10, mystery: 8 },
  추리: { mystery: 12 },
  미스터리: { mystery: 12, world: 4 },
  후유증: { after: 14 },
  감정선: { after: 12, character: 4 },
  캐릭터성: { character: 12 },
  스포츠: { battle: 8, relationship: 8 },
  음악: { heal: 4, relationship: 4 },
  아이돌: { character: 6, heal: 4 },
  잔인함: { after: 6, battle: 4 },
};

export const TAG_COPY: Record<string, string> = {
  액션: "전투 도파민",
  이능력: "능력자 배틀",
  성장: "각성 누적형",
  일상: "저자극 회복식",
  코미디: "뇌 퇴근제",
  학원: "관계성 밀집구역",
  구원서사: "관계성 진통제",
  유사가족: "소속감 보충제",
  라이벌: "인정 욕구 자극제",
  정치극: "권력 구조 해부",
  디스토피아: "멘탈 압박식",
  SF: "논리형 과몰입",
  미스터리: "떡밥 대사제",
  후유증: "천장 응시 성분",
  감정선: "조용한 멘탈 절개",
  캐릭터성: "최애 발생 성분",
  스포츠: "팀 성장 도파민",
  로맨스: "설렘 보충제",
};

export const EFFECT_COPY = [
  "취향 반응이 빠르게 올라오는 성분이 확인됩니다.",
  "지금 상태에서 무난한 추천보다 약효가 선명할 가능성이 높습니다.",
  "선택한 문진 항목과 작품 태그가 여러 지점에서 겹칩니다.",
  "과몰입 수치가 과하게 튀지 않으면서도 충분히 자극을 줍니다.",
];

export const DOSAGE_COPY = [
  "마음에 드는 캐릭터가 생겨도 즉시 검색하지 마세요. 스포일러는 약효를 망칩니다.",
  "1화만 보고 자가 판단하지 말고 최소 3화까지 경과를 관찰하세요.",
  "이어폰을 착용하고 복용하면 특정 장면의 약효가 올라갑니다.",
  "컨디션이 약한 날에는 연속 복용보다 하루 1~2화 복용을 권장합니다.",
];

export const SIDE_COPY = [
  "작품보다 캐릭터 프로필을 더 오래 보고 있을 수 있습니다.",
  "엔딩곡이 며칠 동안 머릿속에서 자동 재생될 수 있습니다.",
  "관계성 해석글을 찾아보다 시간이 사라질 수 있습니다.",
  "가벼운 마음으로 시작했다가 원작이나 외전까지 확인할 수 있습니다.",
];

export const LOADING_LINES = [
  "문진표를 분석 중입니다. 숨겨진 취향이 생각보다 많이 나왔습니다.",
  "최애 발생 가능성을 검사 중입니다. 위험 수치가 조금 높습니다.",
  "지뢰 요소를 제거하는 중입니다. 고구마와 열린 결말을 조심스럽게 분리하고 있습니다.",
  "처방전을 작성 중입니다. 너무 안전한 추천은 약효가 약해 제외했습니다.",
  "작품 후보를 선별 중입니다. 유명하다는 이유만으로 처방하지 않습니다.",
  "취향을 해석하는 중입니다. 본인은 부정하실 수 있지만 데이터는 솔직합니다.",
];

export const SHARE_SUMMARIES = [
  "가볍게 보려다 인생작을 처방받았습니다.",
  "가슴이 웅장해지는 장면 섭취량이 부족합니다.",
  "최애 발생 가능성이 매우 높습니다. 검색창 접근을 제한하세요.",
  "뇌는 쉬고 싶다는데 손은 설정 해석글을 찾고 있습니다.",
  "다 보고 나서 천장만 바라볼 준비가 되어 있습니다.",
];

export function pickShareSummary(diagnosisName: string, immersionScore: number): string {
  if (diagnosisName.includes("배틀")) return SHARE_SUMMARIES[1];
  if (diagnosisName.includes("최애") || diagnosisName.includes("처연")) return SHARE_SUMMARIES[2];
  if (diagnosisName.includes("세계관") || diagnosisName.includes("떡밥")) return SHARE_SUMMARIES[3];
  if (diagnosisName.includes("후유증")) return SHARE_SUMMARIES[4];
  if (immersionScore >= 85) return SHARE_SUMMARIES[0];
  return SHARE_SUMMARIES[0];
}
