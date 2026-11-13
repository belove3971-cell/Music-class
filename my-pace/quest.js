/* MY PACE 퀘스트 엔진
 * 원칙: 경험치는 '자기조절 행동'에만 준다. 높은 달성도 자체에는 주지 않는다
 * (자기평가를 부풀릴 이유가 생기지 않게). AI 사용으로 점수를 깎지도 않는다.
 * 예측이 정확할수록, 차이를 발견하고 근거를 쓸수록 보상이 커진다.
 */
const Quest = (() => {
  const RANKS = [
    { min: 0, name: "견습 탐험가" },
    { min: 120, name: "길 찾는 사람" },
    { min: 300, name: "지도 설계자" },
    { min: 550, name: "전략가" },
    { min: 850, name: "메타인지 탐험대장" },
    { min: 1200, name: "마이페이스 마스터" },
  ];
  const CHAPTER = {
    plan: { no: 1, name: "지도 그리기", srl: "계획" },
    run: { no: 2, name: "탐험하기", srl: "실행" },
    check: { no: 3, name: "보물 확인", srl: "점검" },
    reflect: { no: 4, name: "탐험 일지", srl: "성찰" },
  };

  function rewards(stage, s) {
    const r = [];
    if (stage === "plan") {
      r.push({ label: "과제의 학습 과정 지도 그리기", xp: 10 });
      r.push({ label: `오늘 할 단계 ${s.steps.length}개 선택`, xp: Math.min(4, s.steps.length) * 3 });
      r.push({ label: "확인 방법 정하기", xp: 10 });
      r.push({ label: "달성도 미리 예측", xp: 5 });
    }
    if (stage === "run") {
      const min = Math.round((s.elapsed || 0) / 60);
      if ((s.elapsed || 0) >= s.plannedMin * 60 * 0.8) r.push({ label: `계획한 ${s.plannedMin}분 완주`, xp: 20 });
      else r.push({ label: `${min}분 집중`, xp: Math.min(15, Math.max(2, Math.round(min / 2))) });
      const n = (s.doneSteps || []).length;
      if (n) r.push({ label: `학습 단계 ${n}개 정복`, xp: n * 5 });
      const rescued = (s.stuck || []).filter((x) => x.rescued).length;
      if (rescued) r.push({ label: `막혔다가 다시 일어섬 ${rescued}번`, xp: rescued * 15 });
    }
    if (stage === "check") {
      r.push({ label: s.evidence === "direct" ? "정한 방법으로 직접 확인" : "내 판단 근거 돌아보기", xp: s.evidence === "direct" ? 15 : 5 });
      const gap = Math.abs(s.actual - s.predicted);
      if (gap <= 10) r.push({ label: "정확한 예측 (차이 10%p 이내)", xp: 20 });
      else if (gap <= 20) r.push({ label: "꽤 정확한 예측 (차이 20%p 이내)", xp: 10 });
      else r.push({ label: "예상과 실제의 차이를 발견함", xp: 5 });
    }
    if (stage === "reflect") {
      r.push({ label: "성찰 질문에 답함", xp: 15 });
      r.push({ label: "다음 전략을 직접 정함", xp: 15 });
      if ((s.line || "").length >= 2) r.push({ label: "내 말로 한 줄 남김", xp: 10 });
      r.push({ label: "퀘스트 완료 보너스", xp: 20 });
    }
    return r.filter((x) => x.xp > 0);
  }

  const xpOf = (S) => S.sessions.reduce((a, s) => a + (s.rewards || []).reduce((b, x) => b + x.xp, 0), 0);
  function rank(xp) {
    let i = 0; RANKS.forEach((r, k) => { if (xp >= r.min) i = k; });
    const cur = RANKS[i], next = RANKS[i + 1];
    return { idx: i, name: cur.name, lv: i + 1, next, into: xp - cur.min, need: next ? next.min - cur.min : 1 };
  }

  const dayKey = (t) => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };
  function streak(S) {
    const days = new Set(S.sessions.filter((s) => s.status === "done").map((s) => dayKey(s.finishedAt)));
    let n = 0; let t = Date.now();
    if (!days.has(dayKey(t))) t -= 864e5; // 오늘 아직 안 했어도 어제까지 이어졌으면 유지
    while (days.has(dayKey(t))) { n++; t -= 864e5; }
    return n;
  }

  const uses = (s) => (s.advice || 0) + (s.stuck || []).length;
  const BADGES = [
    { id: "first", icon: "★", name: "첫 퀘스트", how: "퀘스트를 처음으로 끝까지 마치기", test: (S, d) => d.length >= 1 },
    { id: "oracle", icon: "◎", name: "정확한 예언가", how: "예상과 실제 차이 10%p 이내 3번", test: (S, d) => d.filter((s) => Math.abs(s.actual - s.predicted) <= 10).length >= 3 },
    { id: "finisher", icon: "⏱", name: "완주자", how: "계획한 시간을 끝까지 채우기", test: (S, d) => d.some((s) => (s.elapsed || 0) >= s.plannedMin * 60) },
    { id: "conqueror", icon: "▣", name: "단계 정복자", how: "계획한 학습 단계를 모두 마치기", test: (S, d) => d.some((s) => s.steps && s.steps.length && s.steps.every((i) => (s.doneSteps || []).includes(i))) },
    { id: "rise", icon: "↑", name: "다시 일어선 탐험가", how: "막혔을 때 구출 미션을 성공하기", test: (S, d) => S.sessions.some((s) => (s.stuck || []).some((x) => x.rescued)) },
    { id: "explorer", icon: "✦", name: "다재다능", how: "과제 유형 3가지 이상 해 보기", test: (S, d) => new Set(d.map((s) => s.type)).size >= 3 },
    { id: "solo", icon: "◆", name: "내 힘으로", how: "AI 비교·질문 없이 퀘스트 마치기", test: (S, d) => d.some((s) => uses(s) === 0) },
    { id: "strategist", icon: "♞", name: "전략 수집가", how: "서로 다른 전략 3가지 써 보기", test: (S, d) => new Set(d.map((s) => s.strategy).filter(Boolean)).size >= 3 },
    { id: "streak3", icon: "▲", name: "3일 연속", how: "3일 연속 퀘스트 마치기", test: (S) => streak(S) >= 3 },
    { id: "graduate", icon: "✓", name: "도움 졸업", how: "AI 도움 줄이기 제안을 받아들이기", test: (S) => (S.levelLog || []).some((l, i, a) => i > 0 && l.level < a[i - 1].level) },
  ];
  function earned(S) {
    const d = S.sessions.filter((s) => s.status === "done");
    return BADGES.filter((b) => b.test(S, d)).map((b) => b.id);
  }

  function dailies(S) {
    const today = dayKey(Date.now());
    const t = S.sessions.filter((s) => dayKey(s.createdAt) === today);
    const done = t.filter((s) => s.status === "done");
    return [
      { name: "퀘스트 1개 끝까지 마치기", ok: done.length >= 1 },
      { name: "학습 단계 2개 이상 정복하기", ok: t.some((s) => (s.doneSteps || []).length >= 2) },
      { name: "예상과 실제 차이 10%p 이내로 예측하기", ok: done.some((s) => Math.abs(s.actual - s.predicted) <= 10) },
    ];
  }

  return { RANKS, CHAPTER, rewards, xpOf, rank, streak, BADGES, earned, dailies };
})();
