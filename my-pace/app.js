/* MY PACE 앱: 해시 라우팅 + localStorage 저장, 프레임워크 없음
 * 입력은 거의 모두 선택형. 앱은 공부 "앞뒤"에 잠깐 쓰고, 공부하는 동안은 닫아 두어도 된다. */
(() => {
  const { esc, TASKS } = Coach;
  const KEY = "mypace.v2";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const app = $("#app");

  /* ---------- 저장 ---------- */
  const blank = () => ({ profile: null, sessions: [], levelLog: [], demo: false, seenBadges: [] });
  let S = load();
  function load() {
    try { const v = JSON.parse(localStorage.getItem(KEY)); if (v && v.sessions) return { ...blank(), ...v }; } catch (e) {}
    return blank();
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }

  const uid = () => Math.random().toString(36).slice(2, 9);
  const current = () => S.sessions.find((s) => s.status !== "done");
  const doneSessions = () => S.sessions.filter((s) => s.status === "done");
  const LV = { 1: "질문만", 2: "질문 + 단계 팁", 3: "질문 + 팁 + 방법 예시" };
  const STEP = { plan: 0, run: 1, check: 2, reflect: 3 };
  const fmtDate = (t) => { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()}`; };
  const mmss = (sec) => `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
  const aiUses = (s) => (s.advice || 0) + (s.stuck || []).length;
  const titleOf = (s) => s.title || (TASKS[s.type] ? TASKS[s.type].name : "학습");

  function toast(msg) {
    const t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); t.textContent = msg;
    document.body.appendChild(t); setTimeout(() => t.remove(), 2400);
  }
  const aiBox = (label, html) => `<div class="ai"><span class="who">AI 학습 파트너 · ${label}</span><div class="stack-s">${html}</div></div>`;
  function chips(name, values, sel, fmt = (v) => v, multi = false) {
    const on = (v) => (multi ? (sel || []).map(String).includes(String(v)) : String(v) === String(sel));
    return `<div class="chips" data-chips="${name}" ${multi ? 'data-multi="1"' : ""}>${values.map((v) => `<button type="button" class="chip" data-v="${esc(v)}" aria-pressed="${on(v)}">${fmt(v)}</button>`).join("")}</div>`;
  }
  function bindChips(root, name, onPick) {
    const g = $(`[data-chips="${name}"]`, root); if (!g) return;
    const multi = g.dataset.multi;
    g.addEventListener("click", (e) => {
      const b = e.target.closest(".chip"); if (!b) return;
      if (multi) { b.setAttribute("aria-pressed", b.getAttribute("aria-pressed") !== "true"); onPick($$(".chip[aria-pressed=true]", g).map((c) => c.dataset.v)); }
      else { $$(".chip", g).forEach((c) => c.setAttribute("aria-pressed", c === b)); onPick(b.dataset.v); }
    });
  }

  /* ---------- 라우팅 ---------- */
  let timerInt = null;
  function route() {
    clearInterval(timerInt);
    let v = location.hash.replace("#", "") || "today";
    if (!S.profile || !S.profile.done) v = "onboarding";
    const learn = () => { const c = current(); if (c) go(c.status); else newQuest(); };
    const views = { onboarding, today, plan, run, check, reflect, growth, me, learn };
    (views[v] || today)();
    $$("nav.tabbar a").forEach((a) => a.setAttribute("aria-current", a.dataset.tab === tabOf(v) ? "page" : "false"));
    $("nav.tabbar").hidden = v === "onboarding";
    window.scrollTo(0, 0);
  }
  const tabOf = (v) => (["plan", "run", "check", "reflect"].includes(v) ? "learn" : v);
  const go = (v) => { if (location.hash === "#" + v) route(); else location.hash = v; };
  window.addEventListener("hashchange", route);
  function newQuest() { S.sessions.push({ id: uid(), createdAt: Date.now(), status: "plan", advice: 0, steps: [], doneSteps: [], stuck: [] }); save(); go("plan"); }

  function head(title, sub) {
    return `<header class="topbar"><span class="brand">MY PACE</span><span class="sub">${sub || ""}</span></header>${title ? `<h1>${title}</h1>` : ""}`;
  }
  function stepBar(n) {
    return `<div class="steps" aria-label="퀘스트 진행">${Object.values(Quest.CHAPTER).map((c, i) => `<span class="${i < n ? "done" : i === n ? "now" : ""}">${c.no}장 ${c.srl}</span>`).join("")}</div>`;
  }
  const chapterTitle = (k) => `<div class="chapter"><span>${Quest.CHAPTER[k].no}장 · ${Quest.CHAPTER[k].srl}</span><h1>${Quest.CHAPTER[k].name}</h1></div>`;

  /* ---------- 보상 ---------- */
  function finishStage(s, stage, next) {
    s.awarded = s.awarded || {};
    let gains = [];
    const before = Quest.xpOf(S);
    if (!s.awarded[stage]) { gains = Quest.rewards(stage, s); s.rewards = (s.rewards || []).concat(gains.map((g) => ({ ...g, stage }))); s.awarded[stage] = true; }
    const after = Quest.xpOf(S);
    const nowBadges = Quest.earned(S); const fresh = nowBadges.filter((b) => !S.seenBadges.includes(b));
    S.seenBadges = nowBadges; save();
    if (!gains.length) return go(next);
    const r0 = Quest.rank(before), r1 = Quest.rank(after);
    const ov = document.createElement("div"); ov.className = "overlay"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true");
    ov.innerHTML = `<div class="reward"><div class="burst" aria-hidden="true">${Array.from({ length: 12 }, (_, i) => `<i style="--a:${i * 30}deg"></i>`).join("")}</div>
      <span class="eyebrow">${Quest.CHAPTER[stage].no}장 클리어</span><h2>${Quest.CHAPTER[stage].name} 완료!</h2>
      <ul class="gains">${gains.map((g) => `<li><span>${esc(g.label)}</span><b>+${g.xp} XP</b></li>`).join("")}</ul>
      ${r1.idx > r0.idx ? `<div class="levelup">레벨 업! <b>Lv.${r1.lv} ${r1.name}</b></div>` : ""}
      ${xpBar(after)}
      ${fresh.map((id) => { const b = Quest.BADGES.find((x) => x.id === id); return `<div class="newbadge"><span class="bdg on">${b.icon}</span><div><b>새 배지 · ${b.name}</b><span>${b.how}</span></div></div>`; }).join("")}
      <button class="btn" id="cont">${next === "today" ? "퀘스트 마치기" : `${Quest.CHAPTER[next] ? Quest.CHAPTER[next].no + "장으로" : "계속"}`}</button></div>`;
    document.body.appendChild(ov); $("#cont", ov).focus();
    $("#cont", ov).onclick = () => { ov.remove(); go(next); };
  }
  function xpBar(xp) {
    const r = Quest.rank(xp);
    return `<div class="xp"><div class="row between small"><span><b>Lv.${r.lv}</b> ${r.name}</span><span class="muted">${r.next ? `${r.into} / ${r.need} XP` : `${xp} XP · 최고 레벨`}</span></div>
      <div class="xpbar"><i style="width:${r.next ? Math.round((r.into / r.need) * 100) : 100}%"></i></div></div>`;
  }

  /* ================= 온보딩 (모두 선택형) ================= */
  let ob = { step: 0, difficulty: "", cause: "", level: "2", if: "", then: "" };
  function onboarding() {
    const i = ob.step;
    const bars = `<div class="bars">${[0, 1, 2].map((k) => `<span class="${k <= i ? "on" : ""}"></span>`).join("")}</div>`;
    if (i === 0) {
      app.innerHTML = `${head("", "온보딩 1 / 3")}${bars}
      <div class="stack"><h1>나의 학습 상태 알아보기</h1><p class="muted">계획을 세우기 전에, 평소 나의 학습 모습을 돌아보세요.</p></div>
      <div class="card"><p class="label">공부할 때 가장 어려운 점은 무엇인가요?</p>
        <div class="opts">${Object.entries(Coach.DIFF_LONG).map(([k, t]) => `<label class="opt"><input type="radio" name="diff" id="d-${k}" value="${k}" ${ob.difficulty === k ? "checked" : ""}>${t}</label>`).join("")}</div></div>
      <div id="ai1"></div>
      <div class="note">AI는 이 답으로 질문의 방향만 조정해요. 학습 유형을 단정하지 않아요.</div>
      <button class="btn" id="next" disabled>다음</button>`;
      const upd = () => {
        if (ob.difficulty) {
          $("#ai1").innerHTML = aiBox("질문", `<p>${Coach.ONBOARD_Q[ob.difficulty]}</p>${chips("cause", Coach.CAUSES[ob.difficulty], ob.cause)}`);
          bindChips(app, "cause", (v) => { ob.cause = v; $("#next").disabled = false; });
        }
        $("#next").disabled = !(ob.difficulty && ob.cause && Coach.CAUSES[ob.difficulty].includes(ob.cause));
      };
      $$("input[name=diff]").forEach((r) => r.addEventListener("change", () => { ob.difficulty = r.value; ob.cause = ""; upd(); }));
      $("#next").onclick = () => { ob.step = 1; route(); };
      upd();
    } else if (i === 1) {
      app.innerHTML = `${head("", "온보딩 2 / 3")}${bars}
      <div class="stack"><h1>AI 도움 수준 정하기</h1><p class="muted">도움의 양은 내가 고르고, 익숙해지면 점점 줄어들어요.</p></div>
      <div class="stack" role="radiogroup" aria-label="AI 도움 수준">
        ${[["1", "혼자 해 보고 싶을 때. AI는 생각할 거리만 던져요."], ["2", "막히면 단계에 맞는 팁을 줘요. 처음이라면 추천해요."], ["3", "구체적인 방법 예시까지 보여 줘요. 완성된 답은 주지 않아요."]]
          .map(([v, d]) => `<label class="level"><input type="radio" name="lv" id="lv${v}" value="${v}" ${ob.level === v ? "checked" : ""}><div><b>${LV[v]}</b><span>${d}</span></div></label>`).join("")}</div>
      <div class="note">어떤 수준에서도 AI는 답이나 계획을 대신 만들지 않아요. 퀘스트 3번마다 도움을 줄일지 물어볼게요.</div>
      <div class="row"><button class="btn ghost" id="back" style="flex:1">이전</button><button class="btn" id="next" style="flex:2">다음</button></div>`;
      $$("input[name=lv]").forEach((r) => r.addEventListener("change", () => (ob.level = r.value)));
      $("#back").onclick = () => { ob.step = 0; route(); };
      $("#next").onclick = () => { ob.step = 2; route(); };
    } else {
      app.innerHTML = `${head("", "온보딩 3 / 3")}${bars}
      <div class="stack"><h1>막혔을 때의 약속</h1><p class="muted">AI를 열기 전에 내가 먼저 할 행동을 골라 두세요.</p></div>
      <div class="card"><p class="label">만약</p>${chips("if", Coach.IF_OPTS, ob.if)}<p class="label">나는</p>${chips("then", Coach.THEN_OPTS, ob.then)}</div>
      <div class="card"><h3>나의 첫 학습 약속</h3><dl class="kv">
        <dt>어려운 점</dt><dd>${Coach.DIFF[ob.difficulty]}</dd><dt>내 짐작</dt><dd>${esc(ob.cause)}</dd>
        <dt>AI 도움</dt><dd>${LV[ob.level]}</dd><dt>막히면</dt><dd id="k-if">위에서 고르기</dd></dl></div>
      <div class="row"><button class="btn ghost" id="back" style="flex:1">이전</button><button class="btn" id="done" style="flex:2" disabled>모험 시작하기</button></div>`;
      const upd = () => { $("#k-if").textContent = ob.if && ob.then ? `${ob.if} → ${ob.then}` : "위에서 고르기"; $("#done").disabled = !(ob.if && ob.then); };
      bindChips(app, "if", (v) => { ob.if = v; upd(); }); bindChips(app, "then", (v) => { ob.then = v; upd(); }); upd();
      $("#back").onclick = () => { ob.step = 1; route(); };
      $("#done").onclick = () => {
        S.profile = { done: true, difficulty: ob.difficulty, cause: ob.cause, level: +ob.level, ifthen: { if: ob.if, then: ob.then }, createdAt: Date.now() };
        S.levelLog.push({ t: Date.now(), level: +ob.level, by: "onboarding" }); save(); toast("약속이 저장됐어요"); go("today");
      };
    }
  }

  /* ================= 오늘 ================= */
  function fadingProposal() {
    const since = S.profile.lastLevelAt || 0;
    const recent = doneSessions().filter((s) => s.finishedAt > since);
    if (recent.length < 3) return null;
    const avg = recent.reduce((a, s) => a + aiUses(s), 0) / recent.length;
    if (avg <= 1.5 && S.profile.level > 1) return { dir: -1, avg, n: recent.length };
    if (avg >= 4 && S.profile.level < 3) return { dir: 1, avg, n: recent.length };
    return null;
  }
  function setLevel(lv, by) { S.profile.level = lv; S.profile.lastLevelAt = Date.now(); S.levelLog.push({ t: Date.now(), level: lv, by }); save(); }

  function today() {
    const cur = current(); const p = S.profile; const done = doneSessions();
    const xp = Quest.xpOf(S), streak = Quest.streak(S), daily = Quest.dailies(S), badges = Quest.earned(S);
    const fp = fadingProposal();
    const fadeHtml = fp ? `<div class="ai"><span class="who">AI 학습 파트너 · 도움 조정 제안</span>
      <div>${fp.dir < 0 ? `최근 ${fp.n}번의 퀘스트에서 AI를 평균 ${fp.avg.toFixed(1)}회만 썼어요. 스스로 조절하는 힘이 생기고 있어요. 도움을 '${LV[p.level - 1]}'로 한 단계 줄여 볼까요?` : `최근 ${fp.n}번의 퀘스트에서 AI를 평균 ${fp.avg.toFixed(1)}회 썼어요. 과제가 많이 어렵다면 도움을 '${LV[p.level + 1]}'로 늘릴 수 있어요.`}</div>
      <div class="row"><button class="btn small" id="fadeYes">${fp.dir < 0 ? "한 단계 줄이기" : "한 단계 늘리기"}</button><button class="btn small ghost" id="fadeNo">지금 수준 유지</button></div></div>` : "";
    const last = done[done.length - 1];
    const quest = cur
      ? `<div class="card quest"><div class="row between"><span class="eyebrow">진행 중인 퀘스트</span><span class="tag">${fmtDate(cur.createdAt)}</span></div>
        <h2>${esc(titleOf(cur))}</h2>${stepBar(STEP[cur.status])}
        <button class="btn" id="resume">${Quest.CHAPTER[cur.status].no}장 ${Quest.CHAPTER[cur.status].name} 이어 하기</button></div>`
      : `<div class="card quest"><span class="eyebrow">메인 퀘스트</span><h2>오늘의 학습 퀘스트</h2>
        <p class="muted small">지도 그리기 → 탐험하기 → 보물 확인 → 탐험 일지. 대부분 고르기만 하면 돼요.</p>
        ${last ? `<div class="note"><b>지난번 내가 정한 전략</b> · ${esc(last.strategy)}${last.line ? ` (${esc(last.line)})` : ""}</div>` : ""}
        <button class="btn" id="new">새 퀘스트 시작</button></div>`;
    app.innerHTML = `${head("", new Date().toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" }))}
      <div class="card hero"><div class="row between"><div class="emblem" aria-hidden="true">${Quest.rank(xp).lv}</div>
        <div class="grow">${xpBar(xp)}</div></div>
        <div class="row small muted"><span class="tag ${streak ? "ok" : ""}">연속 ${streak}일</span><span class="tag">배지 ${badges.length} / ${Quest.BADGES.length}</span><span class="tag">완료 퀘스트 ${done.length}</span></div></div>
      ${quest}
      ${fadeHtml}
      <div class="card"><h3>오늘의 미션</h3><ul class="daily">${daily.map((d) => `<li class="${d.ok ? "ok" : ""}"><span class="box" aria-hidden="true">${d.ok ? "✓" : ""}</span>${d.name}<span class="sr">${d.ok ? " 완료" : " 미완료"}</span></li>`).join("")}</ul></div>
      <div class="card"><div class="row between"><h3>AI 도움 수준</h3><a class="small" href="#me">바꾸기</a></div>
        <div class="meter" aria-label="AI 도움 ${p.level}단계">${[1, 2, 3].map((k) => `<i class="${k <= p.level ? "on" : ""}"></i>`).join("")}</div>
        <p class="small muted">${LV[p.level]} · 막히면: ${esc(p.ifthen.if)} → ${esc(p.ifthen.then)}</p></div>`;
    if ($("#new")) $("#new").onclick = newQuest;
    if ($("#resume")) $("#resume").onclick = () => go(cur.status);
    if ($("#fadeYes")) $("#fadeYes").onclick = () => { setLevel(p.level + fp.dir, "accepted-proposal"); S.seenBadges = S.seenBadges.filter((b) => b !== "graduate"); toast(`AI 도움: ${LV[S.profile.level]}`); route(); };
    if ($("#fadeNo")) $("#fadeNo").onclick = () => { S.profile.lastLevelAt = Date.now(); save(); toast("지금 수준을 유지해요"); route(); };
  }

  function needSession(status) {
    const s = current();
    if (!s) { go("today"); return null; }
    if (s.status !== status) { go(s.status); return null; }
    return s;
  }

  /* ================= 1장 계획: 지도 그리기 ================= */
  function plan() {
    const s = needSession("plan"); if (!s) return;
    const p = S.profile;
    s.energy = s.energy || 3; s.plannedMin = s.plannedMin || 25; s.predicted = s.predicted ?? 70;
    const t = TASKS[s.type];
    app.innerHTML = `${head("", "퀘스트 1 / 4")}${stepBar(0)}${chapterTitle("plan")}
      <div class="card"><h3>지금 컨디션</h3>${chips("energy", [1, 2, 3, 4, 5], s.energy, (v) => ["매우 지침", "지침", "보통", "좋음", "최고"][v - 1])}</div>
      <div class="card"><h3>어떤 과제인가요?</h3>
        <div class="types" data-chips="type">${Object.entries(TASKS).map(([k, x]) => `<button type="button" class="chip type" data-v="${k}" aria-pressed="${s.type === k}"><b>${x.name}</b><span>${x.ex}</span></button>`).join("")}</div>
        <div class="field"><label for="title" class="small muted">과제 이름 (선택 · 예: 2단원 일차방정식)</label><input type="text" id="title" maxlength="30" value="${esc(s.title || "")}"></div></div>
      <div class="card"><h3>이 퀘스트를 하는 이유</h3><p class="small muted">막혔을 때 다시 꺼내 보여 줄게요.</p>${chips("whydo", Coach.WHYDO, s.whydo)}</div>
      <div id="map"></div>`;
    bindChips(app, "energy", (v) => { s.energy = +v; save(); refreshCheck(); });
    bindChips(app, "whydo", (v) => { s.whydo = v; save(); refreshCheck(); });
    $("[data-chips=type]").addEventListener("click", (e) => {
      const b = e.target.closest(".chip"); if (!b) return;
      if (s.type !== b.dataset.v) { s.type = b.dataset.v; s.steps = []; s.amount = null; s.verify = null; s.adviceShown = 0; }
      save(); plan();
    });
    $("#title").addEventListener("input", (e) => {
      s.title = e.target.value.trim(); save();
      const g = Coach.guessType(s.title);
      $("#guess") && $("#guess").remove();
      if (g && g !== s.type) $("#title").insertAdjacentHTML("afterend", `<button type="button" class="btn small ghost" id="guess">'${TASKS[g].name}' 과제 같아요. 바꿀까요?</button>`);
      if ($("#guess")) $("#guess").onclick = () => { s.type = g; s.steps = []; s.amount = null; s.verify = null; save(); plan(); };
    });
    if (!t) return;
    $("#map").innerHTML = `
      <div class="card"><h3>${t.name}의 학습 과정 지도</h3><p class="small muted">보통 이 순서로 진행돼요. 오늘 할 단계를 골라 보세요.</p>
        <ol class="route" data-chips="steps" data-multi="1">${t.steps.map((st, i) => `<li><button type="button" class="chip stepchip" data-v="${i}" aria-pressed="${s.steps.includes(i)}"><span class="num">${i + 1}</span>${st.n}</button></li>`).join("")}</ol>
        <div id="pcheck"></div>
        <div id="adv"></div>
        <div class="row between small muted"><span>AI 조언 <span class="pips" id="pips"></span></span><span>${LV[p.level]}</span></div>
        <button class="btn ghost" id="advBtn">첫 단계 조언 더 보기</button></div>
      <div class="card"><h3>얼마나, 어떻게 확인할까요?</h3>
        <span class="label">양</span>${chips("amount", t.amounts, s.amount, (v) => `${v}${t.unit === "개" ? "개" : " " + t.unit}`)}
        <span class="label">끝나고 확인하는 방법</span>${chips("verify", t.verify, s.verify)}
        <span class="label">시간</span>${chips("min", [15, 25, 40, 60], s.plannedMin, (v) => v + "분")}
        <div class="field"><label for="pred" class="label">예상 달성도 · 끝나고 실제와 비교해요</label>
          <div class="range-row"><input type="range" id="pred" min="0" max="100" step="10" value="${s.predicted}"><output id="predv">${s.predicted}%</output></div></div></div>
      <div class="card questcard" id="qc"></div>
      <span class="lock" id="lock"></span>
      <button class="btn" id="go" disabled>지도 완성! 탐험 떠나기</button>`;
    const maxA = p.level; // 지원 수준만큼만 단계적으로 열림
    const drawPips = () => { $("#pips").innerHTML = Array.from({ length: maxA }, (_, k) => `<i class="${k < (s.adviceShown || 0) ? "used" : ""}"></i>`).join(""); };
    function refreshCheck() {
      if (!$("#pcheck")) return;
      $("#pcheck").innerHTML = s.steps.length ? aiBox("점검 질문", esc(Coach.planCheck(s))) : "";
      const ok = s.whydo && s.steps.length && s.amount && s.verify;
      $("#go").disabled = !ok;
      $("#lock").textContent = ok ? "" : !s.whydo ? "이 퀘스트를 하는 이유를 골라 주세요." : !s.steps.length ? "오늘 할 단계를 골라 주세요." : !s.amount ? "양을 골라 주세요." : "확인 방법을 골라 주세요.";
      $("#advBtn").disabled = !s.steps.length || (s.adviceShown || 0) >= maxA;
      if ((s.adviceShown || 0) >= maxA) $("#advBtn").textContent = "이번 지도의 AI 조언을 모두 열었어요";
      const st = [...s.steps].sort((a, b) => a - b);
      $("#qc").innerHTML = `<span class="eyebrow">퀘스트 카드</span><h3>${esc(titleOf(s))}</h3>
        <p class="small">${st.length ? st.map((i) => t.steps[i].n).join(" → ") : "단계를 골라 주세요"}</p>
        <p class="small muted">${s.amount ? `${s.amount}${t.unit === "개" ? "개" : " " + t.unit}` : "양 미정"} · ${s.plannedMin}분 · 확인: ${s.verify ? esc(s.verify) : "미정"} · 예상 ${s.predicted}%</p>`;
      save();
    }
    bindChips(app, "steps", (v) => { s.steps = v.map(Number).sort((a, b) => a - b); refreshCheck(); });
    bindChips(app, "amount", (v) => { s.amount = +v; refreshCheck(); });
    bindChips(app, "verify", (v) => { s.verify = v; refreshCheck(); });
    bindChips(app, "min", (v) => { s.plannedMin = +v; refreshCheck(); });
    $("#pred").addEventListener("input", (e) => { s.predicted = +e.target.value; $("#predv").textContent = s.predicted + "%"; refreshCheck(); });
    $("#advBtn").onclick = () => {
      const d = s.adviceShown || 0; if (d >= maxA) return;
      s.adviceShown = d + 1; s.advice = (s.advice || 0) + 1;
      $("#adv").innerHTML = aiBox("단계 조언", Array.from({ length: s.adviceShown }, (_, k) => `<p>${Coach.stepAdvice(s.type, s.steps[0], k)}</p>`).join(""));
      drawPips(); refreshCheck();
    };
    if (s.adviceShown) $("#adv").innerHTML = aiBox("단계 조언", Array.from({ length: s.adviceShown }, (_, k) => `<p>${Coach.stepAdvice(s.type, s.steps[0] ?? 0, k)}</p>`).join(""));
    $("#go").onclick = () => { s.status = "run"; s.elapsed = 0; s.runningSince = null; finishStage(s, "plan", "run"); };
    drawPips(); refreshCheck();
  }

  /* ================= 2장 실행: 탐험하기 ================= */
  let notifyTimers = [];
  function run() {
    const s = needSession("run"); if (!s) return;
    const t = TASKS[s.type]; const total = s.plannedMin * 60;
    const elapsedNow = () => (s.elapsed || 0) + (s.runningSince ? (Date.now() - s.runningSince) / 1000 : 0);
    const stepsHtml = () => s.steps.map((i) => `<li><button type="button" class="chip stepchip" data-v="${i}" aria-pressed="${s.doneSteps.includes(i)}"><span class="num">${i + 1}</span>${t.steps[i].n}</button></li>`).join("");
    app.innerHTML = `${head("", "퀘스트 2 / 4")}${stepBar(1)}${chapterTitle("run")}
      <div class="card questcard"><span class="eyebrow">퀘스트 카드</span><h3>${esc(titleOf(s))}</h3>
        <p class="small muted">${s.amount}${t.unit === "개" ? "개" : " " + t.unit} · ${s.plannedMin}분 · 확인: ${esc(s.verify)}</p></div>
      <div class="card">
        <div class="timer" id="clock">00:00</div><div class="ring"><i id="prog"></i></div>
        <p class="small muted center" id="clockSub"></p>
        <div class="row"><button class="btn" id="toggle" style="flex:2"></button><button class="btn ghost" id="end" style="flex:1">끝났어요</button></div>
        <div class="note" id="away">시작하면 이 화면은 닫아도 괜찮아요. 시간은 계속 기록되고, 끝나고 돌아와 '끝났어요'만 누르면 돼요.</div>
        <button class="btn small ghost" id="notif">중간·끝 알림 켜기</button></div>
      <div class="card"><h3>정복한 단계</h3><p class="small muted">끝낸 단계를 눌러 표시해요. 나중에 몰아서 눌러도 괜찮아요.</p>
        <ol class="route" data-chips="done" data-multi="1">${stepsHtml()}</ol></div>
      <div class="card rescue" id="rescue"></div>`;
    const tick = () => {
      const e = elapsedNow(); const left = Math.max(0, total - e);
      $("#clock").textContent = mmss(left);
      $("#prog").style.width = Math.min(100, (e / total) * 100) + "%";
      $("#clockSub").textContent = left === 0 ? "계획한 시간이 끝났어요. 3장에서 보물을 확인해 볼까요?" : s.runningSince ? `${s.plannedMin}분 중 ${Math.floor(e / 60)}분 진행 중` : e > 0 ? "잠깐 멈춤" : "준비되면 시작하세요";
      $("#toggle").textContent = s.runningSince ? "잠깐 멈추기" : e > 0 ? "다시 시작" : "탐험 시작";
    };
    $("#toggle").onclick = () => {
      if (s.runningSince) { s.elapsed = elapsedNow(); s.runningSince = null; } else s.runningSince = Date.now();
      save(); tick();
    };
    $("#end").onclick = () => {
      s.elapsed = elapsedNow(); s.runningSince = null; save();
      if (s.elapsed > total * 2) return askActualTime(s);
      if (s.elapsed < 60) { if (!s.confirmShort) { s.confirmShort = true; return toast("1분도 안 지났어요. 그래도 마치려면 한 번 더 누르세요"); } }
      s.status = "check"; finishStage(s, "run", "check");
    };
    $("#notif").onclick = async () => {
      try {
        if (!("Notification" in window)) throw 0;
        const perm = await Notification.requestPermission(); if (perm !== "granted") throw 0;
        notifyTimers.forEach(clearTimeout); notifyTimers = [];
        const left = total - elapsedNow();
        if (left > total / 2) notifyTimers.push(setTimeout(() => new Notification("MY PACE", { body: "절반 왔어요! 지금 어느 단계에 있나요?" }), (left - total / 2) * 1000));
        notifyTimers.push(setTimeout(() => new Notification("MY PACE", { body: "계획한 시간이 끝났어요. 돌아와서 보물을 확인해요." }), Math.max(0, left) * 1000));
        toast("알림을 켰어요. 이 탭은 닫지 말고 다른 창으로 공부하세요");
      } catch (e) { toast("이 브라우저에서는 알림을 쓸 수 없어요. 시간은 그대로 기록돼요"); }
    };
    bindChips(app, "done", (v) => { s.doneSteps = v.map(Number); save(); });
    renderRescue(s, elapsedNow);
    tick(); timerInt = setInterval(tick, 500);
  }
  function askActualTime(s) {
    const ov = document.createElement("div"); ov.className = "overlay"; ov.setAttribute("role", "dialog");
    ov.innerHTML = `<div class="reward"><h2>실제로 공부한 시간은?</h2><p class="muted small">기록된 시간이 ${Math.round(s.elapsed / 60)}분이에요. 중간에 다른 일을 했다면 실제 시간을 골라 주세요.</p>
      ${chips("real", [s.plannedMin / 2, s.plannedMin, Math.round(s.plannedMin * 1.5), Math.round(s.elapsed / 60)].map(Math.round), "", (v) => v + "분")}</div>`;
    document.body.appendChild(ov);
    bindChips(ov, "real", (v) => { s.elapsed = +v * 60; s.status = "check"; ov.remove(); finishStage(s, "run", "check"); });
  }

  /* 막혔어요 → 동기 회복 → 구출 미션 */
  function renderRescue(s, elapsedNow) {
    const t = TASKS[s.type]; const box = $("#rescue");
    const r = (s.rescueDraft = s.rescueDraft || {});
    if (r.mission) {
      const m = r.mission; const left = Math.max(0, m.min * 60 - (Date.now() - m.startedAt) / 1000);
      box.innerHTML = `<span class="eyebrow">구출 미션 진행 중</span><h3>${esc(m.name)}</h3><p>${esc(m.desc)}</p>
        ${m.min ? `<div class="timer small-timer" id="mclock">${mmss(left)}</div>` : ""}
        <div class="row"><button class="btn" id="mdone" style="flex:2">미션 성공!</button><button class="btn ghost" id="mskip" style="flex:1">다른 미션</button></div>`;
      if (m.min) { const iv = setInterval(() => { const el = $("#mclock"); if (!el) return clearInterval(iv); const l = Math.max(0, m.min * 60 - (Date.now() - m.startedAt) / 1000); el.textContent = mmss(l); }, 500); }
      $("#mdone").onclick = () => {
        s.stuck.push({ at: Math.round(elapsedNow()), step: r.step, mood: r.mood, reason: r.reason, mission: m.id, rescued: true });
        if (m.id === "shrink") s.amount = Math.max(1, Math.round(s.amount / 2));
        s.rescueDraft = {}; save(); toast("다시 일어섰어요! 회복력 +15 XP는 2장을 마칠 때 받아요"); renderRescue(s, elapsedNow);
      };
      $("#mskip").onclick = () => { r.mission = null; save(); renderRescue(s, elapsedNow); };
      return;
    }
    const rescuedBefore = S.sessions.flatMap((x) => (x.stuck || []).filter((y) => y.rescued).map(() => x)).length;
    box.innerHTML = `<h3>막혔나요?</h3><p class="small muted">세 번만 고르면 다시 일어설 방법을 같이 찾아요.</p>
      <span class="label">어느 단계에서?</span>${chips("rstep", s.steps, r.step, (i) => t.steps[i].n)}
      <span class="label">지금 기분은?</span>${chips("rmood", Coach.MOODS, r.mood)}
      <span class="label">왜 막혔나요?</span>${chips("rwhy", Coach.REASONS, r.reason)}
      <div id="rout"></div>`;
    const draw = () => {
      save();
      if (r.step == null || !r.mood || !r.reason) return ($("#rout").innerHTML = "");
      const progress = `지금까지 ${Math.floor(elapsedNow() / 60)}분 탐험했고, 단계 ${s.doneSteps.length}개를 정복했어요.${rescuedBefore ? ` 그리고 전에도 막혔다가 ${rescuedBefore}번 다시 일어섰어요.` : ""}`;
      const lines = Coach.stuck(s.type, +r.step, r.reason, S.profile.level, S.profile.ifthen);
      const ms = Coach.rescueMissions(s.type, +r.step, r.mood, S.profile.ifthen);
      const why = s.whydo ? `<p><b>내가 고른 이유 · ${esc(s.whydo)}</b><br>${Coach.WHYDO_LINE[s.whydo]}</p>` : "";
      $("#rout").innerHTML = `${aiBox("응원", `<p>${Coach.MOOD_LINE[r.mood]}</p><p>${progress}</p>${why}`)}
        ${aiBox("질문", lines.map((l) => `<p>${l}</p>`).join(""))}
        <span class="label">구출 미션 고르기</span>
        <div class="missions">${ms.map((m, i) => `<button type="button" class="mission" data-i="${i}"><b>${esc(m.name)}${m.min ? ` · ${m.min}분` : ""}</b><span>${esc(m.desc)}</span></button>`).join("")}</div>`;
      $$(".mission", box).forEach((b) => (b.onclick = () => { r.mission = { ...ms[+b.dataset.i], startedAt: Date.now() }; save(); renderRescue(s, elapsedNow); }));
    };
    bindChips(box, "rstep", (v) => { r.step = +v; draw(); });
    bindChips(box, "rmood", (v) => { r.mood = v; draw(); });
    bindChips(box, "rwhy", (v) => { r.reason = v; draw(); });
    draw();
  }

  /* ================= 3장 점검: 보물 확인 ================= */
  function check() {
    const s = needSession("check"); if (!s) return;
    const t = TASKS[s.type];
    s.actual = s.actual ?? s.predicted; s.focus = s.focus || 3; s.difficultyRate = s.difficultyRate || 3;
    app.innerHTML = `${head("", "퀘스트 3 / 4")}${stepBar(2)}${chapterTitle("check")}
      <div class="card"><p class="small muted">${esc(titleOf(s))} · ${Math.round((s.elapsed || 0) / 60)}분 / 계획 ${s.plannedMin}분 · 막힘 ${s.stuck.length}번</p>
        <span class="label">정복한 단계 확인</span><ol class="route" data-chips="done" data-multi="1">${s.steps.map((i) => `<li><button type="button" class="chip stepchip" data-v="${i}" aria-pressed="${s.doneSteps.includes(i)}"><span class="num">${i + 1}</span>${t.steps[i].n}</button></li>`).join("")}</ol></div>
      <div class="card">
        <span class="label">'${esc(s.verify)}'로 확인해 봤나요?</span>${chips("evi", Object.keys(Coach.EVIDENCE), s.evidence, (k) => Coach.EVIDENCE[k])}
        <div class="field"><label for="act" class="label">실제 달성도 · 내가 판단해요</label>
          <div class="range-row"><input type="range" id="act" min="0" max="100" step="10" value="${s.actual}"><output id="actv">${s.actual}%</output></div></div>
        <span class="label">집중도</span>${chips("focus", [1, 2, 3, 4, 5], s.focus, (v) => ["거의 못함", "낮음", "보통", "높음", "몰입"][v - 1])}
        <span class="label">체감 난이도</span>${chips("diffr", [1, 2, 3, 4, 5], s.difficultyRate, (v) => ["아주 쉬움", "쉬움", "적당", "어려움", "아주 어려움"][v - 1])}</div>
      <div class="card" id="calib" hidden><h3>예상과 실제 비교</h3>
        <div class="cmp"><span>예상</span><div class="bar"><i id="bp" style="background:var(--s-pred)"></i></div><span id="tp"></span>
          <span>실제</span><div class="bar"><i id="ba" style="background:var(--s-act)"></i></div><span id="ta"></span></div><div id="calq"></div></div>
      <span class="lock" id="lock"></span>
      <button class="btn ghost" id="cmpBtn" disabled>예상과 비교해 보기</button>
      <button class="btn" id="go" disabled>보물 확인 완료</button>`;
    const showCal = () => {
      $("#calib").hidden = false;
      $("#bp").style.width = s.predicted + "%"; $("#ba").style.width = s.actual + "%";
      $("#tp").textContent = s.predicted + "%"; $("#ta").textContent = s.actual + "%";
      $("#calq").innerHTML = aiBox("판단 정확도", esc(Coach.calibration(s.predicted, s.actual)) + (s.evidence === "feel" ? "<p>느낌으로 판단했다면, 다음엔 정한 방법으로 1분만 확인해 보세요. 예측이 더 정확해져요.</p>" : ""));
    };
    const upd = () => {
      $("#cmpBtn").disabled = !s.evidence; $("#go").disabled = !(s.evidence && s.compared);
      $("#lock").textContent = !s.evidence ? "어떻게 판단했는지 골라 주세요." : !s.compared ? "예상과 실제를 비교해 보세요." : ""; save();
    };
    bindChips(app, "done", (v) => { s.doneSteps = v.map(Number); save(); });
    bindChips(app, "evi", (v) => { s.evidence = v; if (s.compared) showCal(); upd(); });
    bindChips(app, "focus", (v) => { s.focus = +v; save(); });
    bindChips(app, "diffr", (v) => { s.difficultyRate = +v; save(); });
    $("#act").addEventListener("input", (e) => { s.actual = +e.target.value; $("#actv").textContent = s.actual + "%"; if (s.compared) showCal(); save(); });
    $("#cmpBtn").onclick = () => { s.compared = true; showCal(); upd(); };
    $("#go").onclick = () => { s.status = "reflect"; finishStage(s, "check", "reflect"); };
    if (s.compared) showCal(); upd();
  }

  /* ================= 4장 성찰: 탐험 일지 ================= */
  function reflect() {
    const s = needSession("reflect"); if (!s) return;
    const t = TASKS[s.type]; const isFirst = doneSessions().length === 0;
    s.ans = s.ans || {};
    const stepName = (i) => t.steps[i].n;
    app.innerHTML = `${head("", "퀘스트 4 / 4")}${stepBar(3)}${chapterTitle("reflect")}
      <p class="muted small">고르기만 해도 돼요. 마지막 한 줄은 쓰고 싶을 때만.</p>
      ${aiBox("질문 1", "이번에 가장 도움이 된 단계는?")}${chips("best", s.steps, s.ans.best, stepName)}
      ${aiBox("질문 2", "가장 오래 걸리거나 막힌 단계는?")}${chips("hard", s.steps, s.ans.hard, stepName)}
      ${aiBox("질문 3", "왜 그랬던 것 같나요?")}${chips("why", Coach.WHY, s.ans.why)}
      ${isFirst ? aiBox("돌아보기", `온보딩 때 짐작한 원인은 '${esc(S.profile.cause)}'였어요. 오늘 해 보니 어땠나요?`) + chips("cause", ["맞았어요", "조금 달랐어요", "완전히 달랐어요"], s.ans.cause) : ""}
      <div class="card"><h3>다음 퀘스트에서 바꿔 볼 전략</h3>${chips("strat", Coach.STRATEGIES, s.strategy)}
        <div class="field"><label for="line" class="small muted">내 말로 한 줄 (선택 · +10 XP)</label><input type="text" id="line" maxlength="60" value="${esc(s.line || "")}"></div></div>
      <span class="lock" id="lock"></span>
      <button class="btn" id="fin" disabled>탐험 일지 저장</button>`;
    const upd = () => {
      const ok = s.ans.best != null && s.ans.hard != null && s.ans.why && s.strategy && (!isFirst || s.ans.cause);
      $("#fin").disabled = !ok; $("#lock").textContent = ok ? "" : "질문마다 하나씩 골라 주세요."; save();
    };
    ["best", "hard"].forEach((k) => bindChips(app, k, (v) => { s.ans[k] = +v; upd(); }));
    ["why", "cause"].forEach((k) => bindChips(app, k, (v) => { s.ans[k] = v; upd(); }));
    bindChips(app, "strat", (v) => { s.strategy = v; upd(); });
    $("#line").addEventListener("input", (e) => { s.line = e.target.value.trim(); save(); });
    $("#fin").onclick = () => { s.status = "done"; s.finishedAt = Date.now(); finishStage(s, "reflect", "today"); };
    upd();
  }

  /* ================= 성장 ================= */
  function growth() {
    const all = doneSessions(); const data = all.slice(-10);
    const gapAvg = all.length ? all.reduce((a, s) => a + Math.abs(s.actual - s.predicted), 0) / all.length : 0;
    const useAvg = all.length ? all.reduce((a, s) => a + aiUses(s), 0) / all.length : 0;
    const rescued = S.sessions.reduce((a, s) => a + (s.stuck || []).filter((x) => x.rescued).length, 0);
    const earned = Quest.earned(S);
    const strat = {}; all.forEach((s) => s.strategy && (strat[s.strategy] = (strat[s.strategy] || 0) + 1));
    app.innerHTML = `${head("나의 성장", S.demo ? "예시 데이터 포함" : "")}
      ${S.demo ? `<div class="warnbox"><b>예시 데이터</b> · 시연용 가상 기록이 포함돼 있어요. '나' 탭에서 지울 수 있어요.</div>` : ""}
      <div class="card">${xpBar(Quest.xpOf(S))}</div>
      <div class="tiles">
        <div class="tile"><b>${all.length ? gapAvg.toFixed(0) + "%p" : "-"}</b><span>예상과 실제의 평균 차이 (작을수록 정확)</span></div>
        <div class="tile"><b>${all.length ? useAvg.toFixed(1) + "회" : "-"}</b><span>퀘스트 1회당 AI 사용</span></div>
        <div class="tile"><b>${rescued}번</b><span>막혔다가 다시 일어선 횟수</span></div>
        <div class="tile"><b>${S.profile.level}단계</b><span>현재 AI 도움: ${LV[S.profile.level]}</span></div></div>
      <div class="card"><h3>배지 도감</h3><div class="badges">${Quest.BADGES.map((b) => { const on = earned.includes(b.id); return `<div class="badge ${on ? "on" : ""}"><span class="bdg ${on ? "on" : ""}" aria-hidden="true">${on ? b.icon : "?"}</span><b>${b.name}</b><span>${b.how}</span></div>`; }).join("")}</div></div>
      <div class="card"><div class="row between"><h2>예상 달성도와 실제 달성도</h2>${data.length >= 2 ? `<button class="btn small ghost" id="tblT" aria-pressed="false">표로 보기</button>` : ""}</div>
        ${data.length < 2 ? `<p class="muted">퀘스트를 두 번 이상 마치면 그래프가 나타나요. 지금까지 ${data.length}번 마쳤어요.</p>` : `<div class="legend"><span><i style="border-color:var(--s-pred);border-top-style:dashed"></i>예상</span><span><i style="border-color:var(--s-act)"></i>실제</span></div><div class="chart" id="chart"></div><div class="tbl" id="tbl" hidden></div>`}
        <p class="small muted">두 선이 가까워질수록 내 학습을 정확하게 판단하고 있다는 뜻이에요.</p></div>
      <div class="card"><h3>내가 써 본 전략</h3>${Object.keys(strat).length ? `<ul class="list">${Object.entries(strat).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<li><div class="row between"><span>${esc(k)}</span><span class="tag ok">${v}회</span></div></li>`).join("")}</ul>` : `<p class="muted small">탐험 일지를 쓰면 여기에 쌓여요.</p>`}</div>
      <div class="card"><h3>최근 퀘스트</h3>${all.length ? `<ul class="list">${all.slice(-6).reverse().map((s) => `<li><div class="row between"><b>${esc(titleOf(s))}</b><span class="small muted">${fmtDate(s.finishedAt)}</span></div><span class="small muted">${TASKS[s.type].name} · 예상 ${s.predicted}% → 실제 ${s.actual}% · AI ${aiUses(s)}회</span><span class="small">다음 전략: ${esc(s.strategy)}${s.line ? ` · ${esc(s.line)}` : ""}</span></li>`).join("")}</ul>` : `<p class="muted small">아직 마친 퀘스트가 없어요.</p>`}</div>`;
    if (data.length >= 2) {
      drawChart(data);
      $("#tblT").onclick = (e) => { const tb = $("#tbl"); const on = tb.hidden; tb.hidden = !on; $("#chart").hidden = on; e.target.setAttribute("aria-pressed", on); e.target.textContent = on ? "그래프로 보기" : "표로 보기"; };
    }
  }

  function drawChart(data) {
    const W = 340, H = 200, L = 34, R = 40, T = 12, B = 26;
    const x = (i) => L + (i * (W - L - R)) / (data.length - 1);
    const y = (v) => T + (1 - v / 100) * (H - T - B);
    const path = (k) => data.map((s, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(s[k]).toFixed(1)}`).join("");
    const grid = [0, 50, 100].map((v) => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--grid)" stroke-width="1"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${v}%</text>`).join("");
    const xl = data.map((s, i) => `<text x="${x(i)}" y="${H - 6}" text-anchor="middle">${fmtDate(s.finishedAt)}</text>`).join("");
    const dots = (k, col) => data.map((s, i) => `<circle cx="${x(i)}" cy="${y(s[k])}" r="4" fill="${col}" stroke="var(--surface)" stroke-width="2"/>`).join("");
    const li = data.length - 1, lp = data[li].predicted, la = data[li].actual;
    const sep = Math.abs(y(lp) - y(la)) < 14 ? (lp >= la ? [-7, 7] : [7, -7]) : [0, 0];
    $("#chart").innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="퀘스트별 예상 달성도와 실제 달성도 선 그래프">
      ${grid}${xl}<path d="${path("predicted")}" fill="none" stroke="var(--s-pred)" stroke-width="2" stroke-dasharray="5 4"/>
      <path d="${path("actual")}" fill="none" stroke="var(--s-act)" stroke-width="2"/>${dots("predicted", "var(--s-pred)")}${dots("actual", "var(--s-act)")}
      <text x="${x(li) + 8}" y="${y(lp) + 4 + sep[0]}">예상</text><text x="${x(li) + 8}" y="${y(la) + 4 + sep[1]}">실제</text>
      <line id="xh" x1="0" x2="0" y1="${T}" y2="${H - B}" stroke="var(--muted)" stroke-width="1" opacity="0"/>
      <rect id="hit" x="${L - 10}" y="0" width="${W - L - R + 20}" height="${H}" fill="transparent"/></svg><div class="tip" id="tip" hidden></div>`;
    const svg = $("#chart svg"), tip = $("#tip"), xh = $("#xh");
    $("#hit").addEventListener("pointermove", (ev) => {
      const r = svg.getBoundingClientRect(); const px = ((ev.clientX - r.left) / r.width) * W;
      const i = Math.max(0, Math.min(data.length - 1, Math.round(((px - L) / (W - L - R)) * (data.length - 1))));
      const s = data[i]; xh.setAttribute("x1", x(i)); xh.setAttribute("x2", x(i)); xh.setAttribute("opacity", ".4");
      tip.hidden = false; tip.innerHTML = `<b>${fmtDate(s.finishedAt)}</b> ${esc(titleOf(s))}<br>예상 ${s.predicted}% · 실제 ${s.actual}%`;
      tip.style.left = Math.min(Math.max(0, (x(i) / W) * r.width - 60), r.width - 150) + "px"; tip.style.top = "0px";
    });
    $("#hit").addEventListener("pointerleave", () => { tip.hidden = true; xh.setAttribute("opacity", "0"); });
    $("#tbl").innerHTML = `<table><thead><tr><th>날짜</th><th>과제</th><th>예상</th><th>실제</th><th>AI</th></tr></thead><tbody>${data.map((s) => `<tr><td>${fmtDate(s.finishedAt)}</td><td>${esc(titleOf(s))}</td><td>${s.predicted}%</td><td>${s.actual}%</td><td>${aiUses(s)}회</td></tr>`).join("")}</tbody></table>`;
  }

  /* ================= 나 ================= */
  function me() {
    const p = S.profile;
    app.innerHTML = `${head("나", "")}
      <div class="card"><h3>AI 도움 수준</h3><p class="small muted">언제든 바꿀 수 있어요.</p>
        <div class="stack" role="radiogroup" aria-label="AI 도움 수준">${[1, 2, 3].map((v) => `<label class="level"><input type="radio" name="lv" id="mlv${v}" value="${v}" ${p.level === v ? "checked" : ""}><div><b>${LV[v]}</b></div></label>`).join("")}</div></div>
      <div class="card"><h3>막혔을 때의 약속</h3><span class="label">만약</span>${chips("if", Coach.IF_OPTS, p.ifthen.if)}<span class="label">나는</span>${chips("then", Coach.THEN_OPTS, p.ifthen.then)}</div>
      <div class="card"><h3>온보딩 때의 나</h3><dl class="kv"><dt>어려운 점</dt><dd>${Coach.DIFF[p.difficulty]}</dd><dt>내 짐작</dt><dd>${esc(p.cause)}</dd></dl></div>
      <div class="card"><h3>시연용 데이터</h3><p class="small muted">발표·시연용 가상 퀘스트 6개를 넣어요. 성장 탭에 '예시 데이터'로 표시돼요.</p><button class="btn small ghost" id="demo">예시 퀘스트 넣기</button></div>
      <div class="card"><h3>데이터</h3><p class="small muted">모든 기록은 이 기기의 브라우저에만 저장돼요.</p><button class="btn danger" id="reset">모든 기록 지우고 처음부터</button><div id="confirm"></div></div>`;
    $$("input[name=lv]").forEach((r) => r.addEventListener("change", () => { setLevel(+r.value, "manual"); toast(`AI 도움: ${LV[+r.value]}`); }));
    bindChips(app, "if", (v) => { p.ifthen.if = v; save(); toast("약속을 저장했어요"); });
    bindChips(app, "then", (v) => { p.ifthen.then = v; save(); toast("약속을 저장했어요"); });
    $("#demo").onclick = () => { addDemo(); toast("예시 퀘스트 6개를 넣었어요"); go("growth"); };
    $("#reset").onclick = () => {
      $("#confirm").innerHTML = `<div class="warnbox stack"><span>정말 지울까요? 되돌릴 수 없어요.</span><div class="row"><button class="btn small danger" id="yes">지우기</button><button class="btn small ghost" id="no">취소</button></div></div>`;
      $("#yes").onclick = () => { S = blank(); save(); ob = { step: 0, difficulty: "", cause: "", level: "2", if: "", then: "" }; go("onboarding"); };
      $("#no").onclick = () => ($("#confirm").innerHTML = "");
    };
  }

  function addDemo() {
    const day = 864e5, now = Date.now();
    const rows = [
      ["solve", "2단원 일차방정식", [1, 2, 3], 70, 40, 3, "양 줄이기"],
      ["memorize", "영단어 Day 7", [0, 2, 3], 60, 50, 2, "방해 요소 치우기"],
      ["read", "과학 5단원 광합성", [0, 3, 4], 60, 60, 2, "확인 방법 바꾸기"],
      ["practice", "리코더 9~16마디", [0, 1, 2, 4], 70, 60, 1, "쉬는 시간 넣기"],
      ["solve", "2단원 오답 다시 풀기", [3, 4], 60, 70, 1, "이 방법 그대로 유지"],
      ["write", "독서 감상문 초안", [0, 2, 3], 70, 70, 0, "단계 순서 바꾸기"],
    ];
    rows.forEach((r, i) => {
      const t = now - (rows.length - i) * day;
      S.sessions.push({ id: uid(), demo: true, type: r[0], title: r[1], steps: r[2], doneSteps: r[2], createdAt: t, finishedAt: t + 3600e3, status: "done", whydo: Coach.WHYDO[i % 5], predicted: r[3], actual: r[4], advice: Math.min(r[5], 1), stuck: r[5] > 1 ? [{ at: 300, step: r[2][0], mood: "답답해요", reason: "이해가 안 돼요", mission: "tiny", rescued: true }] : [], strategy: r[6], focus: 3, elapsed: 1800, plannedMin: 30, amount: 10, verify: TASKS[r[0]].verify[0], evidence: "direct", rewards: [{ label: "예시", xp: 110, stage: "demo" }], awarded: { plan: 1, run: 1, check: 1, reflect: 1 } });
    });
    S.sessions.sort((a, b) => a.createdAt - b.createdAt);
    S.demo = true; S.seenBadges = Quest.earned(S); save();
  }

  /* 다른 창에서 공부하다 돌아왔을 때 */
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    const s = current();
    if (s && s.status === "run" && s.runningSince && location.hash === "#run") toast(`돌아왔네요! ${Math.floor(((s.elapsed || 0) + (Date.now() - s.runningSince) / 1000) / 60)}분째 탐험 중이에요`);
  });

  route();
})();
