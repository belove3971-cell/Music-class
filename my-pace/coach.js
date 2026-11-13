/* MY PACE 코치 엔진 (규칙 기반)
 * 원칙: 정답·완성된 계획을 주지 않는다. 학습자가 먼저 쓴 내용에만 반응하고,
 * 지원 수준(level 1~3) 안에서 질문 → 단계 힌트 → 빈칸 구조 순으로만 연다.
 * 실제 LLM으로 바꿀 때도 이 함수들의 입력·출력 형식과 원칙을 그대로 유지하면 된다.
 */
const Coach = (() => {
  const DIFF = {
    start: "무엇부터 시작할지 모름",
    focus: "집중 유지가 어려움",
    know: "잘하고 있는지 모름",
    keep: "꾸준한 실천이 어려움",
  };

  const ONBOARD_Q = {
    start: "그 순간 머릿속에 떠오른 첫 번째 할 일은 무엇이었나요? 그걸 바로 하지 못한 이유는 뭐였을까요?",
    focus: "집중이 끊긴 건 시작하고 몇 분쯤 지났을 때였나요? 그 직전에 무엇이 있었나요?",
    know: "'잘하고 있다'는 걸 무엇으로 알 수 있을 것 같나요? 지금은 어떤 기준으로 판단하고 있나요?",
    keep: "마지막으로 계획대로 했던 날은 언제였나요? 그날은 무엇이 달랐나요?",
  };

  const PLAN_Q = {
    start: "오늘 할 일 중에서 5분 안에 시작할 수 있는 가장 작은 행동은 무엇인가요?",
    focus: "이번 학습에서 집중을 방해할 것 같은 것 하나를 미리 꼽는다면 무엇인가요? 어떻게 막아 둘 건가요?",
    know: "학습이 끝났을 때 '잘했다'고 판단할 기준을 하나 정한다면 무엇인가요?",
    keep: "오늘 이 학습을 하기로 한 이유를 한 문장으로 적는다면요?",
  };

  function observeGoal(t) {
    return {
      spec: /\d|쪽|문제|개|장|단원|단어|곡|마디|페이지|챕터|문단/.test(t),
      veri: /확인|설명|풀|외우|녹음|테스트|요약|써|쓰|말해|비교|채점|암기/.test(t),
      time: /\d+\s*(분|시간)|오늘|저녁|오전|오후|까지/.test(t),
    };
  }
  const LABEL = { spec: "구체성", veri: "확인 방법", time: "시간" };

  /* 목표 점검 비교. step: 0부터. level이 허용하는 단계까지만 응답 */
  function compareGoal(goal, mine, step, level) {
    const o = observeGoal(goal);
    const gaps = Object.keys(o).filter((k) => mine[k] !== o[k]);
    if (!gaps.length) return { text: "내 점검과 AI가 본 것이 같아요. 이 판단을 믿고 진행해도 좋아요.", kind: "match" };
    if (step === 0) {
      const k = gaps[0];
      return {
        kind: "question",
        text: mine[k]
          ? `'${LABEL[k]}'에 체크했는데, 문장에서는 잘 보이지 않았어요. 다른 사람이 읽어도 알 수 있으려면 어떤 말이 더 필요할까요?`
          : `'${LABEL[k]}'은 체크하지 않았지만 문장에 단서가 있어 보여요. 스스로 다시 판단해 볼까요?`,
      };
    }
    if (step === 1 && level >= 2) {
      const tips = {
        spec: "숫자로 셀 수 있는 단위(쪽, 문제 수, 마디 수)를 하나 넣어 보세요.",
        veri: "끝난 뒤 할 '확인 행동'(설명하기, 다시 풀기, 녹음해 듣기)을 하나 넣어 보세요.",
        time: "언제, 몇 분 동안 할지 넣어 보세요.",
      };
      return { kind: "hint", text: "단계 힌트: " + gaps.map((k) => tips[k]).join(" ") };
    }
    if (step === 2 && level >= 3) {
      return {
        kind: "structure",
        text: "빈칸 구조만 보여 줄게요. 내용은 직접 채워 보세요.<br><b>[언제/얼마 동안]</b> <b>[무엇을, 얼마나]</b> 하고, <b>[어떻게 확인]</b>한다.",
      };
    }
    return null;
  }
  const maxSteps = (level) => level; // level 1 → 질문 1회, 2 → +힌트, 3 → +구조

  /* 실행 중 막힘: 학습자가 먼저 막힌 지점을 써야 호출된다 */
  function stuck(text, level, ifthen) {
    let q;
    if (/이해|모르|헷갈|뭔지/.test(text)) q = "지금 이해한 데까지를 한 문장으로 설명해 보면, 어디서 끊기나요?";
    else if (/집중|폰|핸드폰|졸|딴생각|유튜브|피곤/.test(text)) q = "지금 집중을 방해하는 것 하나를 치울 수 있다면 무엇인가요? 치운 뒤 몇 분만 더 해 볼까요?";
    else if (/시간|많|양|못 끝|늦/.test(text)) q = "남은 시간 안에 끝낼 수 있는 가장 작은 단위는 무엇인가요? 목표를 그만큼으로 줄여도 괜찮아요.";
    else if (/틀|오답|실수|문제|안 풀/.test(text)) q = "틀린 이유가 '몰라서', '실수해서', '헷갈려서' 중 무엇에 가깝다고 생각하나요? 그렇게 본 근거는요?";
    else if (/연습|소리|음정|박자|발음|리듬/.test(text)) q = "직접 녹음해서 들어 보면 어느 부분이 계획과 다르게 들리나요? 그 부분만 떼어 천천히 해 볼까요?";
    else q = "막히기 직전에 마지막으로 확실했던 건 무엇이었나요? 거기서부터 다시 시작해 볼까요?";
    const out = [q];
    if (level >= 2) out.push("단계 힌트: 막힌 부분을 더 작은 질문 두 개로 나눠 적어 보세요.");
    if (level >= 3) out.push("빈칸 구조: 나는 <b>[어디]</b>까지 알고, <b>[무엇]</b>을 모른다. 그래서 먼저 <b>[행동]</b>을 해 본다.");
    if (ifthen && ifthen.then) out.push(`내가 정한 약속: "${esc(ifthen.if)} → ${esc(ifthen.then)}"`);
    return out;
  }

  function calibration(pred, actual) {
    const gap = actual - pred;
    if (gap <= -20) return `예상(${pred}%)보다 ${-gap}%p 낮았어요. 계획할 때 무엇을 놓쳤을까요? 양, 시간, 컨디션 중 하나를 골라 보세요.`;
    if (gap >= 20) return `예상(${pred}%)보다 ${gap}%p 높았어요. 무엇이 도움이 됐나요? 혹시 내 능력을 낮게 본 건 아닐까요?`;
    return `예상(${pred}%)과 실제(${actual}%)가 비슷했어요. 어떤 단서로 이렇게 정확하게 예측했나요?`;
  }

  function reflectQuestions(s, profile, isFirst) {
    const qs = [];
    const gap = s.actual - s.predicted;
    if (gap <= -20) qs.push("계획과 실제가 가장 크게 달라진 순간은 언제였나요?");
    else if (gap >= 20) qs.push("이번에 잘된 방법 중 다음에도 그대로 쓸 것은 무엇인가요?");
    else qs.push("이번 학습에서 가장 효과가 있었던 행동 하나는 무엇이었나요?");
    if ((s.stuck || []).length) qs.push("막혔을 때 AI를 열기 전에 스스로 해 본 것은 무엇이었나요? 그게 도움이 됐나요?");
    else if (s.focus <= 2) qs.push("집중이 낮았던 이유를 내 안(컨디션, 마음)과 밖(환경, 방해 요소)으로 나눠 보면요?");
    else qs.push(`처음에 꼽은 어려움('${DIFF[profile.difficulty]}')은 이번에 어땠나요?`);
    if (isFirst && profile.cause) qs.push(`온보딩 때 짐작한 원인은 "${esc(profile.cause)}"였어요. 오늘 해 보니 그 짐작이 맞았나요?`);
    return qs;
  }

  const STRATEGIES = ["목표 양 조절", "시간 배치 바꾸기", "방해 요소 차단", "확인 방법 바꾸기", "쉬는 시간 넣기", "질문 먼저 적기"];

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  return { DIFF, ONBOARD_Q, PLAN_Q, LABEL, observeGoal, compareGoal, maxSteps, stuck, calibration, reflectQuestions, STRATEGIES, esc };
})();
