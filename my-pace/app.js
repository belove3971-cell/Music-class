/* MY PACE 앱: 해시 라우팅 + localStorage 저장, 프레임워크 없음 */
(() => {
  const { esc } = Coach;
  const KEY = "mypace.v1";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const app = $("#app");

  /* ---------- 저장 ---------- */
  const blank = () => ({ profile: null, sessions: [], levelLog: [], demo: false });
  let S = load();
  function load() {
    try { const v = JSON.parse(localStorage.getItem(KEY)); if (v && v.sessions) return v; } catch (e) {}
    return blank();
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }

  const uid = () => Math.random().toString(36).slice(2, 9);
  const current = () => S.sessions.find((s) => s.status !== "done");
  const doneSessions = () => S.sessions.filter((s) => s.status === "done");
  const LV = { 1: "질문만", 2: "질문 + 단계 힌트", 3: "질문 + 힌트 + 빈칸 구조" };
  const STEP = { plan: 0, run: 1, check: 2, reflect: 3 };
  const fmtDate = (t) => { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()}`; };
  const mmss = (sec) => `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;

  function toast(msg) {
    const t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); t.textContent = msg;
    document.body.appendChild(t); setTimeout(() => t.remove(), 2200);
  }
  function aiBox(label, html) { return `<div class="ai"><span class="who">AI 학습 파트너 · ${label}</span><div>${html}</div></div>`; }
  function chips(name, values, sel, fmt = (v) => v) {
    return `<div class="chips" data-chips="${name}">${values.map((v) => `<button type="button" class="chip" data-v="${v}" aria-pressed="${String(v) === String(sel)}">${fmt(v)}</button>`).join("")}</div>`;
  }
  function bindChips(root, name, onPick) {
    const g = $(`[data-chips="${name}"]`, root); if (!g) return;
    g.addEventListener("click", (e) => {
      const b = e.target.closest(".chip"); if (!b) return;
      $$(".chip", g).forEach((c) => c.setAttribute("aria-pressed", c === b)); onPick(b.dataset.v);
    });
  }
  const userChars = () => {
    let n = 0; const p = S.profile || {};
    n += (p.moment || "").length + (p.cause || "").length + ((p.ifthen || {}).if || "").length + ((p.ifthen || {}).then || "").length;
    S.sessions.forEach((s) => {
      n += (s.firstStep || "").length + (s.goal || "").length + (s.evidence || "").length + (s.strategyText || "").length;
      (s.log || []).forEach((l) => (n += l.text.length));
      (s.stuck || []).forEach((l) => (n += l.text.length));
      (s.answers || []).forEach((a) => (n += a.length));
    });
    return n;
  };
  const aiUses = (s) => (s.hints || 0) + (s.stuck || []).length;

  /* ---------- 라우팅 ---------- */
  let timerInt = null;
  function route() {
    clearInterval(timerInt);
    let v = location.hash.replace("#", "") || "today";
    if (!S.profile || !S.profile.done) v = "onboarding";
    const learn = () => { const c = current(); if (c) go(c.status); else { toast("진행 중인 학습이 없어요. 새 학습을 시작해 보세요"); go("today"); } };
    const views = { onboarding, today, plan, run, check, reflect, growth, me, learn };
    (views[v] || today)();
    $$("nav.tabbar a").forEach((a) => a.setAttribute("aria-current", a.dataset.tab === tabOf(v) ? "page" : "false"));
    $("nav.tabbar").hidden = v === "onboarding";
    window.scrollTo(0, 0);
  }
  const tabOf = (v) => (["plan", "run", "check", "reflect"].includes(v) ? "learn" : v);
  const go = (v) => { if (location.hash === "#" + v) route(); else location.hash = v; };
  window.addEventListener("hashchange", route);

  function head(title, sub) {
    return `<header class="topbar"><span class="brand">MY PACE</span><span class="sub">${sub || ""}</span></header>${title ? `<h1>${title}</h1>` : ""}`;
  }
  function stepBar(n) {
    return `<div class="steps" aria-label="학습 단계">${["계획", "실행", "점검", "성찰"].map((t, i) => `<span class="${i < n ? "done" : i === n ? "now" : ""}">${t}</span>`).join("")}</div>`;
  }

  /* ================= 온보딩 ================= */
  let ob = { step: 0, difficulty: "start", moment: "", cause: "", level: "2", if: "", then: "" };
  function onboarding() {
    const i = ob.step;
    const bars = `<div class="bars">${[0, 1, 2].map((k) => `<span class="${k <= i ? "on" : ""}"></span>`).join("")}</div>`;
    if (i === 0) {
      app.innerHTML = `${head("", `온보딩 1 / 3`)}${bars}
      <div class="stack"><h1>나의 학습 상태 알아보기</h1><p class="muted">계획을 세우기 전에, 평소 나의 학습 모습을 돌아보세요.</p></div>
      <div class="card">
        <p class="label">공부할 때 가장 어려운 점은 무엇인가요?</p>
        <div class="opts">${Object.entries(Coach.DIFF).map(([k]) => `<label class="opt"><input type="radio" name="diff" id="d-${k}" value="${k}" ${ob.difficulty === k ? "checked" : ""}>${{ start: "무엇부터 시작해야 할지 모르겠어요.", focus: "계획은 세우지만 집중하기 어려워요.", know: "공부를 잘하고 있는지 모르겠어요.", keep: "꾸준히 실천하기 어려워요." }[k]}</label>`).join("")}</div>
        <div class="field"><label for="moment">최근에 실제로 그랬던 순간을 한 문장으로 적어 보세요.</label>
          <textarea id="moment" rows="2" maxlength="120" placeholder="예시 형식: 어제 과제를 펴 놓고 20분 동안 아무것도 못 했다.">${esc(ob.moment)}</textarea>
          <div class="count"><span id="mc">0</span>자 · 15자 이상 쓰면 AI가 질문을 하나 건넵니다</div></div>
        <div id="ai1"></div>
      </div>
      <div class="note">AI는 이 답변으로 질문의 방향만 조정합니다. 학습 유형을 단정하거나 해결책을 먼저 말하지 않아요.</div>
      <span class="lock" id="lock"></span><button class="btn" id="next" disabled>다음</button>`;
      const upd = () => {
        ob.moment = $("#moment").value.trim(); $("#mc").textContent = ob.moment.length;
        const show = ob.moment.length >= 15; const box = $("#ai1");
        if (show && !$("#cause")) {
          box.innerHTML = aiBox("질문", `<span id="q1"></span><input type="text" id="cause" maxlength="80" placeholder="정답은 없어요. 원인을 짐작해 보세요." value="${esc(ob.cause)}" style="margin-top:8px">`);
          $("#cause").addEventListener("input", upd);
        }
        if (!show) box.innerHTML = "";
        if ($("#q1")) $("#q1").textContent = Coach.ONBOARD_Q[ob.difficulty];
        ob.cause = $("#cause") ? $("#cause").value.trim() : ob.cause;
        const ok = show && ob.cause.length >= 4;
        $("#next").disabled = !ok;
        $("#lock").textContent = !show ? "내 생각을 먼저 적어야 다음으로 넘어갈 수 있어요." : ok ? "좋아요. 이 짐작은 첫 성찰 때 다시 꺼내 볼게요." : "AI의 질문에 짧게라도 답해 주세요.";
      };
      $("#moment").addEventListener("input", upd);
      $$("input[name=diff]").forEach((r) => r.addEventListener("change", () => { ob.difficulty = r.value; upd(); }));
      $("#next").onclick = () => { ob.step = 1; route(); };
      upd();
    } else if (i === 1) {
      app.innerHTML = `${head("", `온보딩 2 / 3`)}${bars}
      <div class="stack"><h1>AI 도움 수준 정하기</h1><p class="muted">도움의 양은 내가 고르고, 익숙해지면 점점 줄어듭니다.</p></div>
      <div class="stack" role="radiogroup" aria-label="AI 도움 수준">
        ${[["1", "혼자 해 보고 싶을 때. AI는 생각할 거리만 던집니다."], ["2", "막히면 힌트를 한 단계씩 엽니다. 처음이라면 추천해요."], ["3", "빈칸이 있는 틀까지 보여 줍니다. 완성된 답은 주지 않아요."]]
          .map(([v, d]) => `<label class="level"><input type="radio" name="lv" id="lv${v}" value="${v}" ${ob.level === v ? "checked" : ""}><div><b>${LV[v]}</b><span>${d}</span></div></label>`).join("")}
      </div>
      <div class="note">어떤 수준에서도 AI는 목표나 계획을 대신 쓰지 않습니다. 스스로 점검을 3번 마칠 때마다 도움을 줄일지 물어볼게요.</div>
      <div class="row"><button class="btn ghost" id="back" style="flex:1">이전</button><button class="btn" id="next" style="flex:2">다음</button></div>`;
      $$("input[name=lv]").forEach((r) => r.addEventListener("change", () => (ob.level = r.value)));
      $("#back").onclick = () => { ob.step = 0; route(); };
      $("#next").onclick = () => { ob.step = 2; route(); };
    } else {
      app.innerHTML = `${head("", `온보딩 3 / 3`)}${bars}
      <div class="stack"><h1>막혔을 때의 첫 행동 정하기</h1><p class="muted">AI를 열기 전에 내가 먼저 할 행동을 약속해 두세요.</p></div>
      <div class="card"><div class="ifthen">
        <span>만약</span><input type="text" id="ifx" maxlength="40" placeholder="10분 동안 진도가 안 나가면" value="${esc(ob.if)}">
        <span>나는</span><input type="text" id="thenx" maxlength="40" placeholder="막힌 부분을 한 줄로 먼저 적는다" value="${esc(ob.then)}">
      </div></div>
      <div class="card"><h3>나의 첫 학습 약속</h3><dl class="kv">
        <dt>어려운 점</dt><dd>${Coach.DIFF[ob.difficulty]}</dd>
        <dt>그 순간</dt><dd>${esc(ob.moment)}</dd>
        <dt>내 짐작</dt><dd>${esc(ob.cause)}</dd>
        <dt>AI 도움</dt><dd>${LV[ob.level]}</dd>
        <dt>막히면</dt><dd id="k-if">아래에서 작성</dd></dl></div>
      <div class="row"><button class="btn ghost" id="back" style="flex:1">이전</button><button class="btn" id="done" style="flex:2" disabled>이 약속으로 시작하기</button></div>`;
      const upd = () => {
        ob.if = $("#ifx").value.trim(); ob.then = $("#thenx").value.trim();
        $("#k-if").textContent = ob.if && ob.then ? `${ob.if} → ${ob.then}` : "위에서 작성";
        $("#done").disabled = !(ob.if && ob.then);
      };
      ["#ifx", "#thenx"].forEach((s) => $(s).addEventListener("input", upd)); upd();
      $("#back").onclick = () => { ob.step = 1; route(); };
      $("#done").onclick = () => {
        S.profile = { done: true, difficulty: ob.difficulty, moment: ob.moment, cause: ob.cause, level: +ob.level, ifthen: { if: ob.if, then: ob.then }, createdAt: Date.now() };
        S.levelLog.push({ t: Date.now(), level: +ob.level, by: "onboarding" });
        save(); toast("약속이 저장됐어요"); go("today");
      };
    }
  }

  /* ================= 오늘 ================= */
  function fadingProposal() {
    const done = doneSessions(); const since = S.profile.lastLevelAt || 0;
    const recent = done.filter((s) => s.finishedAt > since);
    if (recent.length < 3) return null;
    const avg = recent.reduce((a, s) => a + aiUses(s), 0) / recent.length;
    if (avg <= 1.5 && S.profile.level > 1) return { dir: -1, avg, n: recent.length };
    if (avg >= 4 && S.profile.level < 3) return { dir: 1, avg, n: recent.length };
    return { dir: 0, avg, n: recent.length };
  }
  function setLevel(lv, by) { S.profile.level = lv; S.profile.lastLevelAt = Date.now(); S.levelLog.push({ t: Date.now(), level: lv, by }); save(); }

  function today() {
    const cur = current(); const p = S.profile; const done = doneSessions();
    const fp = fadingProposal();
    let fadeHtml = "";
    if (fp && fp.dir !== 0) {
      fadeHtml = `<div class="ai"><span class="who">AI 학습 파트너 · 도움 조정 제안</span>
      <div>${fp.dir < 0 ? `최근 ${fp.n}번의 학습에서 AI를 평균 ${fp.avg.toFixed(1)}회만 썼어요. 스스로 조절하는 힘이 생기고 있어요. 도움을 '${LV[p.level - 1]}'로 한 단계 줄여 볼까요?` : `최근 ${fp.n}번의 학습에서 AI를 평균 ${fp.avg.toFixed(1)}회 썼어요. 지금 과제가 많이 어렵다면 도움을 '${LV[p.level + 1]}'로 늘릴 수 있어요. 늘리지 않고 버텨 보는 것도 선택이에요.`}</div>
      <div class="row"><button class="btn small" id="fadeYes">${fp.dir < 0 ? "한 단계 줄이기" : "한 단계 늘리기"}</button><button class="btn small ghost" id="fadeNo">지금 수준 유지</button></div></div>`;
    }
    const learnCard = cur
      ? `<div class="card"><div class="row between"><h2>진행 중인 학습</h2><span class="tag">${fmtDate(cur.createdAt)}</span></div>${stepBar(STEP[cur.status])}
        <p>${esc(cur.goal || "목표 작성 중")}</p>
        <button class="btn" id="resume">${{ plan: "계획 이어서 쓰기", run: "실행으로 돌아가기", check: "점검하기", reflect: "성찰하기" }[cur.status]}</button></div>`
      : `<div class="card"><h2>오늘의 학습</h2><p class="muted">계획 → 실행 → 점검 → 성찰 순서로 진행해요. 목표는 내가 쓰고, AI는 질문만 합니다.</p>
        <button class="btn" id="new">새 학습 시작하기</button></div>`;
    const last = done[done.length - 1];
    app.innerHTML = `${head("", new Date().toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" }))}
      <h1>오늘도 내 속도로</h1>
      ${learnCard}
      ${fadeHtml}
      <div class="card"><div class="row between"><h3>지금 AI 도움 수준</h3><a class="small" href="#me">바꾸기</a></div>
        <div class="meter" aria-label="AI 도움 ${p.level}단계">${[1, 2, 3].map((k) => `<i class="${k <= p.level ? "on" : ""}"></i>`).join("")}</div>
        <p class="small muted">${LV[p.level]} · 막히면: ${esc(p.ifthen.if)} → ${esc(p.ifthen.then)}</p></div>
      ${last ? `<div class="card"><h3>지난 학습에서 내가 정한 다음 전략</h3><p>${esc(last.strategyText)}</p><span class="small muted">${fmtDate(last.finishedAt)} · ${esc(last.strategy || "")}</span></div>` : ""}
      <div class="tiles"><div class="tile"><b>${done.length}</b><span>완료한 학습</span></div><div class="tile"><b>${done.reduce((a, s) => a + Math.round((s.elapsed || 0) / 60), 0)}분</b><span>누적 집중 시간</span></div></div>`;
    if ($("#new")) $("#new").onclick = () => {
      S.sessions.push({ id: uid(), createdAt: Date.now(), status: "plan", hints: 0, log: [], stuck: [], answers: [] }); save(); go("plan");
    };
    if ($("#resume")) $("#resume").onclick = () => go(cur.status);
    if ($("#fadeYes")) $("#fadeYes").onclick = () => { setLevel(p.level + fp.dir, "accepted-proposal"); toast(`AI 도움: ${LV[S.profile.level]}`); route(); };
    if ($("#fadeNo")) $("#fadeNo").onclick = () => { S.profile.lastLevelAt = Date.now(); save(); toast("지금 수준을 유지해요"); route(); };
  }

  function needSession(status) {
    const s = current();
    if (!s) { go("today"); return null; }
    if (s.status !== status) { go(s.status); return null; }
    return s;
  }

  /* ================= 계획 ================= */
  function plan() {
    const s = needSession("plan"); if (!s) return;
    const p = S.profile;
    s.checks = s.checks || { spec: false, veri: false, time: false };
    s.predicted = s.predicted ?? 70; s.plannedMin = s.plannedMin || 25; s.energy = s.energy || 3;
    app.innerHTML = `${head("계획", "학습 1 / 4")}${stepBar(0)}
      <div class="card"><h3>지금 컨디션</h3><p class="small muted">계획을 세우기 전에 지금 상태를 먼저 봐요.</p>
        ${chips("energy", [1, 2, 3, 4, 5], s.energy, (v) => ["매우 지침", "지침", "보통", "좋음", "매우 좋음"][v - 1])}</div>
      ${aiBox("질문", esc(Coach.PLAN_Q[p.difficulty]))}
      <div class="field"><label for="first">내 답</label><textarea id="first" rows="2" maxlength="120">${esc(s.firstStep || "")}</textarea></div>
      <div class="card">
        <div class="field"><label for="goal">이번 학습에서 이루고 싶은 것 (내 말로)</label>
          <textarea id="goal" rows="2" maxlength="120" placeholder="예시 형식: 오늘 40분 동안 ○○ 문제 10개를 풀고 틀린 것을 설명해 본다.">${esc(s.goal || "")}</textarea></div>
        <div class="field"><span class="label">내 목표를 스스로 점검해 보세요</span>
          <label class="chk"><input type="checkbox" id="c-spec" ${s.checks.spec ? "checked" : ""}>무엇을, 얼마나 할지 구체적이다.</label>
          <label class="chk"><input type="checkbox" id="c-veri" ${s.checks.veri ? "checked" : ""}>끝났을 때 달성했는지 확인할 방법이 있다.</label>
          <label class="chk"><input type="checkbox" id="c-time" ${s.checks.time ? "checked" : ""}>정해진 시간 안에 할 수 있는 양이다.</label></div>
        <div id="cmp"></div>
        <div class="row between small muted"><span>AI 비교 <span class="pips" id="pips"></span></span><span>${LV[p.level]}</span></div>
        <button class="btn ghost" id="hint">내 점검과 AI 관찰 비교하기</button>
      </div>
      <div class="card">
        <div class="field"><span class="label">학습 시간</span>${chips("min", [15, 25, 40, 60], s.plannedMin, (v) => v + "분")}</div>
        <div class="field"><label for="pred">예상 달성도 · 끝나고 실제와 비교해요</label>
          <div class="range-row"><input type="range" id="pred" min="0" max="100" step="10" value="${s.predicted}"><output id="predv">${s.predicted}%</output></div></div>
      </div>
      <span class="lock" id="lock"></span>
      <button class="btn" id="go" disabled>이 계획으로 실행하기</button>`;
    const maxH = Coach.maxSteps(p.level);
    const drawPips = () => { $("#pips").innerHTML = Array.from({ length: maxH }, (_, k) => `<i class="${k < s.hints ? "used" : ""}"></i>`).join(""); };
    const upd = () => {
      s.firstStep = $("#first").value.trim(); s.goal = $("#goal").value.trim();
      s.checks = { spec: $("#c-spec").checked, veri: $("#c-veri").checked, time: $("#c-time").checked };
      const nChecked = Object.values(s.checks).filter(Boolean).length;
      const ok = s.firstStep.length >= 5 && s.goal.length >= 8 && nChecked >= 1;
      $("#go").disabled = !ok;
      $("#lock").textContent = ok ? "" : s.firstStep.length < 5 ? "AI 질문에 먼저 답해 주세요." : s.goal.length < 8 ? "목표를 내 말로 적어 주세요." : "목표 점검 항목을 하나 이상 스스로 판단해 주세요.";
      $("#hint").disabled = s.goal.length < 8 || s.hints >= maxH;
      if (s.hints >= maxH) $("#hint").textContent = "이번 계획의 AI 비교를 모두 사용했어요";
      save();
    };
    ["#first", "#goal", "#c-spec", "#c-veri", "#c-time"].forEach((x) => $(x).addEventListener("input", upd));
    bindChips(app, "energy", (v) => { s.energy = +v; save(); });
    bindChips(app, "min", (v) => { s.plannedMin = +v; save(); });
    $("#pred").addEventListener("input", (e) => { s.predicted = +e.target.value; $("#predv").textContent = s.predicted + "%"; save(); });
    $("#hint").onclick = () => {
      const r = Coach.compareGoal(s.goal, s.checks, s.hints, p.level);
      if (!r) return;
      if (r.kind !== "match") s.hints++;
      $("#cmp").innerHTML = aiBox({ match: "점검 비교", question: "질문", hint: "단계 힌트", structure: "빈칸 구조" }[r.kind], r.text);
      drawPips(); upd();
    };
    $("#go").onclick = () => { s.status = "run"; s.elapsed = 0; save(); go("run"); };
    drawPips(); upd();
  }

  /* ================= 실행 ================= */
  function run() {
    const s = needSession("run"); if (!s) return;
    const total = s.plannedMin * 60;
    const elapsedNow = () => (s.elapsed || 0) + (s.runningSince ? (Date.now() - s.runningSince) / 1000 : 0);
    app.innerHTML = `${head("실행", "학습 2 / 4")}${stepBar(1)}
      <div class="card"><p class="small muted">목표</p><p>${esc(s.goal)}</p></div>
      <div class="card">
        <div class="timer" id="clock" aria-live="off">00:00</div>
        <div class="ring"><i id="prog"></i></div>
        <p class="small muted" id="clockSub" style="text-align:center"></p>
        <div class="row"><button class="btn" id="toggle" style="flex:2"></button><button class="btn ghost" id="end" style="flex:1">마치기</button></div>
      </div>
      <div class="card"><h3>학습 과정 기록</h3><p class="small muted">무엇을 했는지, 무엇을 알게 됐는지 짧게 남겨 두면 점검 때 근거가 돼요.</p>
        <div class="row"><input type="text" id="logx" maxlength="80" placeholder="예: 3번까지 풀었고 4번에서 공식이 헷갈림" style="flex:1"><button class="btn small" id="logAdd">기록</button></div>
        <ul class="log" id="log"></ul></div>
      <div class="card" id="stuckCard"><h3>막혔나요?</h3>
        <div class="warnbox"><b>내 약속</b> · ${esc(S.profile.ifthen.if)} → ${esc(S.profile.ifthen.then)}</div>
        <div class="field"><label for="stuckx">어디서, 무엇 때문에 막혔는지 먼저 적어 주세요</label>
          <textarea id="stuckx" rows="2" maxlength="120"></textarea><div class="count"><span id="sc">0</span>자 · 10자 이상 써야 AI 질문이 열려요</div></div>
        <button class="btn ghost" id="stuckGo" disabled>AI에게 질문 받기</button>
        <div id="stuckOut"></div></div>`;
    const tick = () => {
      const e = elapsedNow(); const left = Math.max(0, total - e);
      $("#clock").textContent = mmss(left);
      $("#prog").style.width = Math.min(100, (e / total) * 100) + "%";
      $("#clockSub").textContent = left === 0 ? "계획한 시간이 끝났어요. 마무리하고 점검해 볼까요?" : `${s.plannedMin}분 계획 중 ${Math.floor(e / 60)}분 진행`;
      $("#toggle").textContent = s.runningSince ? "잠깐 멈추기" : e > 0 ? "다시 시작" : "집중 시작";
    };
    const drawLog = () => {
      const items = [...(s.log || []).map((l) => ({ ...l, k: "기록" })), ...(s.stuck || []).map((l) => ({ ...l, k: "막힘" }))].sort((a, b) => a.at - b.at);
      $("#log").innerHTML = items.length ? items.map((l) => `<li><time>${mmss(l.at)}</time>${l.k === "막힘" ? '<span class="kind">막힘</span>' : ""}<span>${esc(l.text)}</span></li>`).join("") : `<li class="muted small">아직 기록이 없어요.</li>`;
    };
    $("#toggle").onclick = () => {
      if (s.runningSince) { s.elapsed = elapsedNow(); s.runningSince = null; } else s.runningSince = Date.now();
      save(); tick();
    };
    $("#end").onclick = () => {
      s.elapsed = elapsedNow(); s.runningSince = null;
      if (s.elapsed < 60 && !s.confirmShort) { s.confirmShort = true; toast("1분도 안 지났어요. 그래도 마치려면 한 번 더 누르세요"); return; }
      s.status = "check"; save(); go("check");
    };
    $("#logAdd").onclick = () => {
      const t = $("#logx").value.trim(); if (!t) return;
      s.log.push({ at: Math.round(elapsedNow()), text: t }); $("#logx").value = ""; save(); drawLog();
    };
    $("#logx").addEventListener("keydown", (e) => { if (e.key === "Enter") $("#logAdd").click(); });
    $("#stuckx").addEventListener("input", () => { const n = $("#stuckx").value.trim().length; $("#sc").textContent = n; $("#stuckGo").disabled = n < 10; });
    $("#stuckGo").onclick = () => {
      const t = $("#stuckx").value.trim();
      s.stuck.push({ at: Math.round(elapsedNow()), text: t }); save();
      const lines = Coach.stuck(t, S.profile.level, S.profile.ifthen);
      $("#stuckOut").innerHTML = aiBox("질문", lines.map((l) => `<p>${l}</p>`).join(""));
      $("#stuckx").value = ""; $("#sc").textContent = 0; $("#stuckGo").disabled = true; drawLog();
    };
    tick(); drawLog(); timerInt = setInterval(tick, 500);
  }

  /* ================= 점검 ================= */
  function check() {
    const s = needSession("check"); if (!s) return;
    s.actual = s.actual ?? s.predicted; s.focus = s.focus || 3; s.difficultyRate = s.difficultyRate || 3;
    app.innerHTML = `${head("점검", "학습 3 / 4")}${stepBar(2)}
      <div class="card"><p class="small muted">목표</p><p>${esc(s.goal)}</p>
        <p class="small muted">실제 학습 ${Math.round((s.elapsed || 0) / 60)}분 / 계획 ${s.plannedMin}분 · 기록 ${s.log.length}개 · 막힘 ${s.stuck.length}번</p></div>
      <div class="card">
        <div class="field"><label for="act">실제 달성도 · AI가 아니라 내가 판단해요</label>
          <div class="range-row"><input type="range" id="act" min="0" max="100" step="10" value="${s.actual}"><output id="actv">${s.actual}%</output></div></div>
        <div class="field"><label for="evi">무엇을 보고 그렇게 판단했나요?</label>
          <textarea id="evi" rows="2" maxlength="120" placeholder="예: 10문제 중 7문제를 설명 없이 다시 풀 수 있었다.">${esc(s.evidence || "")}</textarea></div>
        <div class="field"><span class="label">집중도</span>${chips("focus", [1, 2, 3, 4, 5], s.focus)}</div>
        <div class="field"><span class="label">체감 난이도</span>${chips("diffr", [1, 2, 3, 4, 5], s.difficultyRate)}</div>
      </div>
      <div class="card" id="calib" hidden><h3>예상과 실제 비교</h3>
        <div class="cmp"><span>예상</span><div class="bar"><i id="bp" style="background:var(--s-pred)"></i></div><span id="tp"></span>
          <span>실제</span><div class="bar"><i id="ba" style="background:var(--s-act)"></i></div><span id="ta"></span></div>
        <div id="calq"></div></div>
      <span class="lock" id="lock"></span>
      <button class="btn ghost" id="cmpBtn" disabled>예상과 비교해 보기</button>
      <button class="btn" id="go" disabled>성찰로 넘어가기</button>`;
    const upd = () => {
      s.evidence = $("#evi").value.trim();
      $("#cmpBtn").disabled = s.evidence.length < 8;
      $("#go").disabled = !(s.evidence.length >= 8 && s.compared);
      $("#lock").textContent = s.evidence.length < 8 ? "판단 근거를 먼저 적어야 비교할 수 있어요." : !s.compared ? "예상과 실제를 비교해 보세요." : "";
      save();
    };
    const showCal = () => {
      $("#calib").hidden = false;
      $("#bp").style.width = s.predicted + "%"; $("#ba").style.width = s.actual + "%";
      $("#tp").textContent = s.predicted + "%"; $("#ta").textContent = s.actual + "%";
      $("#calq").innerHTML = aiBox("판단 정확도", esc(Coach.calibration(s.predicted, s.actual)));
    };
    $("#act").addEventListener("input", (e) => { s.actual = +e.target.value; $("#actv").textContent = s.actual + "%"; if (s.compared) showCal(); save(); });
    $("#evi").addEventListener("input", upd);
    bindChips(app, "focus", (v) => { s.focus = +v; save(); });
    bindChips(app, "diffr", (v) => { s.difficultyRate = +v; save(); });
    $("#cmpBtn").onclick = () => { s.compared = true; showCal(); upd(); };
    $("#go").onclick = () => { s.status = "reflect"; save(); go("reflect"); };
    if (s.compared) showCal();
    upd();
  }

  /* ================= 성찰 ================= */
  function reflect() {
    const s = needSession("reflect"); if (!s) return;
    const isFirst = doneSessions().length === 0;
    const qs = Coach.reflectQuestions(s, S.profile, isFirst);
    s.questions = qs; s.answers = s.answers.length === qs.length ? s.answers : qs.map((_, i) => s.answers[i] || "");
    app.innerHTML = `${head("성찰", "학습 4 / 4")}${stepBar(3)}
      <p class="muted">AI는 질문만 하고, 답과 다음 전략은 내가 정해요. 짧아도 괜찮아요.</p>
      ${qs.map((q, i) => `<div class="stack">${aiBox(`질문 ${i + 1}`, q)}<textarea id="a${i}" rows="2" maxlength="160" aria-label="질문 ${i + 1}에 대한 내 답">${esc(s.answers[i])}</textarea></div>`).join("")}
      <div class="card"><h3>다음엔 무엇을 바꿔 볼까요?</h3>
        ${chips("strat", Coach.STRATEGIES, s.strategy || "")}
        <textarea id="stx" rows="2" maxlength="120" placeholder="내 말로 구체적으로: 다음엔 목표를 문제 6개로 줄이고 끝나고 2개를 다시 풀어 본다.">${esc(s.strategyText || "")}</textarea></div>
      <span class="lock" id="lock"></span>
      <button class="btn" id="fin" disabled>성찰 마치기</button>`;
    const upd = () => {
      qs.forEach((_, i) => (s.answers[i] = $("#a" + i).value.trim()));
      s.strategyText = $("#stx").value.trim();
      const answered = s.answers.filter((a) => a.length >= 5).length;
      const ok = answered >= 2 && s.strategy && s.strategyText.length >= 8;
      $("#fin").disabled = !ok;
      $("#lock").textContent = ok ? "" : answered < 2 ? "질문 두 개 이상에 답해 주세요." : !s.strategy ? "바꿔 볼 전략의 종류를 골라 주세요." : "다음 전략을 내 말로 적어 주세요.";
      save();
    };
    qs.forEach((_, i) => $("#a" + i).addEventListener("input", upd));
    $("#stx").addEventListener("input", upd);
    bindChips(app, "strat", (v) => { s.strategy = v; upd(); });
    $("#fin").onclick = () => { s.status = "done"; s.finishedAt = Date.now(); save(); toast("성찰을 마쳤어요. 다음 학습에서 이 전략을 보여 줄게요"); go("today"); };
    upd();
  }

  /* ================= 성장 ================= */
  function growth() {
    const done = doneSessions().slice(-10);
    const all = doneSessions();
    const gapAvg = all.length ? all.reduce((a, s) => a + Math.abs(s.actual - s.predicted), 0) / all.length : 0;
    const hintAvg = all.length ? all.reduce((a, s) => a + aiUses(s), 0) / all.length : 0;
    const strat = {}; all.forEach((s) => s.strategy && (strat[s.strategy] = (strat[s.strategy] || 0) + 1));
    app.innerHTML = `${head("나의 성장", S.demo ? "예시 데이터 포함" : "")}
      ${S.demo ? `<div class="warnbox"><b>예시 데이터</b> · 시연을 위해 넣은 가상의 기록이 포함돼 있어요. '나' 탭에서 지울 수 있어요.</div>` : ""}
      <div class="tiles">
        <div class="tile"><b>${all.length ? gapAvg.toFixed(0) + "%p" : "-"}</b><span>예상과 실제의 평균 차이 (작을수록 정확)</span></div>
        <div class="tile"><b>${all.length ? hintAvg.toFixed(1) + "회" : "-"}</b><span>학습 1회당 AI 사용</span></div>
        <div class="tile"><b>${userChars().toLocaleString()}자</b><span>내가 직접 쓴 글</span></div>
        <div class="tile"><b>${S.profile.level}단계</b><span>현재 AI 도움: ${LV[S.profile.level]}</span></div>
      </div>
      <div class="card"><div class="row between"><h2>예상 달성도와 실제 달성도</h2><button class="btn small ghost" id="tblT" aria-pressed="false">표로 보기</button></div>
        ${done.length < 2 ? `<p class="muted">학습을 두 번 이상 마치면 그래프가 나타나요. 지금까지 ${done.length}번 마쳤어요.</p>` : `<div class="legend"><span><i style="border-color:var(--s-pred);border-top-style:dashed"></i>예상</span><span><i style="border-color:var(--s-act)"></i>실제</span></div><div class="chart" id="chart"></div><div class="tbl" id="tbl" hidden></div>`}
        <p class="small muted">두 선이 가까워질수록 내 학습을 정확하게 판단하고 있다는 뜻이에요.</p></div>
      <div class="card"><h3>내가 써 본 전략</h3>${Object.keys(strat).length ? `<ul class="list">${Object.entries(strat).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<li><div class="row between"><span>${esc(k)}</span><span class="tag ok">${v}회</span></div></li>`).join("")}</ul>` : `<p class="muted small">성찰을 마치면 여기에 쌓여요.</p>`}</div>
      <div class="card"><h3>최근 학습</h3>${all.length ? `<ul class="list">${all.slice(-6).reverse().map((s) => `<li><div class="row between"><b>${fmtDate(s.finishedAt)}</b><span class="small muted">예상 ${s.predicted}% → 실제 ${s.actual}% · AI ${aiUses(s)}회</span></div><span>${esc(s.goal)}</span><span class="small muted">다음 전략: ${esc(s.strategyText)}</span></li>`).join("")}</ul>` : `<p class="muted small">아직 마친 학습이 없어요.</p>`}</div>
      <div class="card"><h3>AI 도움 수준 변화</h3><ul class="list">${S.levelLog.map((l) => `<li><div class="row between"><span>${LV[l.level]}</span><span class="small muted">${fmtDate(l.t)} · ${{ onboarding: "온보딩에서 선택", "accepted-proposal": "제안을 받아들임", manual: "직접 변경", demo: "예시" }[l.by] || ""}</span></div></li>`).join("")}</ul></div>`;
    if (done.length >= 2) drawChart(done);
    $("#tblT").onclick = (e) => {
      const t = $("#tbl"); if (!t) return; const on = t.hidden; t.hidden = !on; $("#chart").hidden = on;
      e.target.setAttribute("aria-pressed", on); e.target.textContent = on ? "그래프로 보기" : "표로 보기";
    };
  }

  function drawChart(data) {
    const W = 340, H = 200, L = 34, R = 40, T = 12, B = 26;
    const x = (i) => L + (data.length === 1 ? 0 : (i * (W - L - R)) / (data.length - 1));
    const y = (v) => T + (1 - v / 100) * (H - T - B);
    const path = (k) => data.map((s, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(s[k]).toFixed(1)}`).join("");
    const grid = [0, 50, 100].map((v) => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--grid)" stroke-width="1"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${v}%</text>`).join("");
    const xl = data.map((s, i) => `<text x="${x(i)}" y="${H - 6}" text-anchor="middle">${fmtDate(s.finishedAt)}</text>`).join("");
    const dots = (k, col) => data.map((s, i) => `<circle cx="${x(i)}" cy="${y(s[k])}" r="4" fill="${col}" stroke="var(--surface)" stroke-width="2"/>`).join("");
    const lastI = data.length - 1, lp = data[lastI].predicted, la = data[lastI].actual;
    const sep = Math.abs(y(lp) - y(la)) < 14 ? (lp >= la ? [-7, 7] : [7, -7]) : [0, 0];
    $("#chart").innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="학습별 예상 달성도와 실제 달성도 선 그래프">
      ${grid}${xl}
      <path d="${path("predicted")}" fill="none" stroke="var(--s-pred)" stroke-width="2" stroke-dasharray="5 4"/>
      <path d="${path("actual")}" fill="none" stroke="var(--s-act)" stroke-width="2"/>
      ${dots("predicted", "var(--s-pred)")}${dots("actual", "var(--s-act)")}
      <text x="${x(lastI) + 8}" y="${y(lp) + 4 + sep[0]}">예상</text><text x="${x(lastI) + 8}" y="${y(la) + 4 + sep[1]}">실제</text>
      <line id="xh" x1="0" x2="0" y1="${T}" y2="${H - B}" stroke="var(--muted)" stroke-width="1" opacity="0"/>
      <rect id="hit" x="${L - 10}" y="0" width="${W - L - R + 20}" height="${H}" fill="transparent"/></svg><div class="tip" id="tip" hidden></div>`;
    const svg = $("#chart svg"), tip = $("#tip"), xh = $("#xh");
    const move = (ev) => {
      const r = svg.getBoundingClientRect(); const px = ((ev.clientX - r.left) / r.width) * W;
      let i = Math.round(((px - L) / (W - L - R)) * (data.length - 1)); i = Math.max(0, Math.min(data.length - 1, i));
      const s = data[i]; xh.setAttribute("x1", x(i)); xh.setAttribute("x2", x(i)); xh.setAttribute("opacity", ".4");
      tip.hidden = false; tip.innerHTML = `<b>${fmtDate(s.finishedAt)}</b><br>예상 ${s.predicted}% · 실제 ${s.actual}%<br>차이 ${s.actual - s.predicted > 0 ? "+" : ""}${s.actual - s.predicted}%p`;
      const left = (x(i) / W) * r.width; tip.style.left = Math.min(Math.max(0, left - 60), r.width - 130) + "px"; tip.style.top = "0px";
    };
    $("#hit").addEventListener("pointermove", move);
    $("#hit").addEventListener("pointerleave", () => { tip.hidden = true; xh.setAttribute("opacity", "0"); });
    $("#tbl").innerHTML = `<table><thead><tr><th>날짜</th><th>예상</th><th>실제</th><th>차이</th><th>AI 사용</th></tr></thead><tbody>${data.map((s) => `<tr><td>${fmtDate(s.finishedAt)}</td><td>${s.predicted}%</td><td>${s.actual}%</td><td>${s.actual - s.predicted > 0 ? "+" : ""}${s.actual - s.predicted}%p</td><td>${aiUses(s)}회</td></tr>`).join("")}</tbody></table>`;
  }

  /* ================= 나 ================= */
  function me() {
    const p = S.profile;
    app.innerHTML = `${head("나", "")}
      <div class="card"><h3>AI 도움 수준</h3><p class="small muted">언제든 바꿀 수 있어요. 바꾼 기록은 성장 탭에 남아요.</p>
        <div class="stack" role="radiogroup" aria-label="AI 도움 수준">${[1, 2, 3].map((v) => `<label class="level"><input type="radio" name="lv" id="mlv${v}" value="${v}" ${p.level === v ? "checked" : ""}><div><b>${LV[v]}</b></div></label>`).join("")}</div></div>
      <div class="card"><h3>막혔을 때의 첫 행동</h3><div class="ifthen">
        <span>만약</span><input type="text" id="ifx" maxlength="40" value="${esc(p.ifthen.if)}">
        <span>나는</span><input type="text" id="thenx" maxlength="40" value="${esc(p.ifthen.then)}"></div>
        <button class="btn small" id="saveIf">약속 저장</button></div>
      <div class="card"><h3>온보딩 때의 나</h3><dl class="kv"><dt>어려운 점</dt><dd>${Coach.DIFF[p.difficulty]}</dd><dt>그 순간</dt><dd>${esc(p.moment)}</dd><dt>내 짐작</dt><dd>${esc(p.cause)}</dd></dl></div>
      <div class="card"><h3>시연용 데이터</h3><p class="small muted">발표나 시연을 위해 가상의 학습 기록 6개를 넣어요. 성장 탭에 '예시 데이터'로 표시됩니다.</p>
        <button class="btn small ghost" id="demo">예시 기록 넣기</button></div>
      <div class="card"><h3>데이터</h3><p class="small muted">모든 기록은 이 기기의 브라우저에만 저장돼요. 서버로 보내지 않아요.</p>
        <button class="btn danger" id="reset">모든 기록 지우고 온보딩부터 다시 하기</button><div id="confirm"></div></div>`;
    $$("input[name=lv]").forEach((r) => r.addEventListener("change", () => { setLevel(+r.value, "manual"); toast(`AI 도움: ${LV[+r.value]}`); }));
    $("#saveIf").onclick = () => {
      const a = $("#ifx").value.trim(), b = $("#thenx").value.trim(); if (!a || !b) return toast("두 칸을 모두 채워 주세요");
      p.ifthen = { if: a, then: b }; save(); toast("약속을 저장했어요");
    };
    $("#demo").onclick = () => { addDemo(); toast("예시 기록 6개를 넣었어요"); go("growth"); };
    $("#reset").onclick = () => {
      $("#confirm").innerHTML = `<div class="warnbox stack"><span>정말 지울까요? 되돌릴 수 없어요.</span><div class="row"><button class="btn small danger" id="yes">지우기</button><button class="btn small ghost" id="no">취소</button></div></div>`;
      $("#yes").onclick = () => { S = blank(); save(); ob = { step: 0, difficulty: "start", moment: "", cause: "", level: "2", if: "", then: "" }; go("onboarding"); };
      $("#no").onclick = () => ($("#confirm").innerHTML = "");
    };
  }

  function addDemo() {
    const day = 864e5, now = Date.now();
    const rows = [
      [70, 40, 4, "목표 양 조절", "오늘 60분 동안 문제 20개 풀기", "다음엔 문제를 12개로 줄이고 끝나고 2개 다시 풀기"],
      [60, 50, 3, "방해 요소 차단", "저녁 40분 동안 단어 30개 외우고 친구에게 말해 보기", "휴대폰을 다른 방에 두고 시작하기"],
      [60, 60, 3, "확인 방법 바꾸기", "25분 동안 교과서 2쪽 요약하고 설명해 보기", "요약 대신 빈 종이에 다시 써 보기로 확인"],
      [70, 60, 2, "쉬는 시간 넣기", "40분 동안 리듬 연습 8마디 녹음해서 듣기", "20분 하고 5분 쉬기"],
      [60, 70, 1, "질문 먼저 적기", "25분 동안 오답 5개 원인 쓰고 다시 풀기", "모르는 것을 질문으로 먼저 적고 시작"],
      [70, 70, 1, "시간 배치 바꾸기", "오늘 40분 동안 문제 12개 풀고 2개 설명하기", "어려운 과목을 저녁 첫 시간에 배치"],
    ];
    rows.forEach((r, i) => {
      const t = now - (rows.length - i) * day;
      S.sessions.push({ id: uid(), demo: true, createdAt: t, finishedAt: t + 3600e3, status: "done", predicted: r[0], actual: r[1], hints: Math.min(r[2], 2), stuck: Array.from({ length: Math.max(0, r[2] - 2) }, () => ({ at: 300, text: "예시 막힘 기록" })), log: [], answers: ["예시 답변", "예시 답변"], strategy: r[3], goal: r[4], strategyText: r[5], focus: 3, elapsed: 1800, plannedMin: 30 });
    });
    S.sessions.sort((a, b) => a.createdAt - b.createdAt);
    S.demo = true; save();
  }

  route();
})();
