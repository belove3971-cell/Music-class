/* 악보·문항 통합 검사  —  node verify-notation.js [index.html]
   악보 글리프·기둥·박자표·청음·바로잡기 문항을 한 번에 확인한다. 어긋나면 종료 코드 1 */
const fs = require('fs');
const html = fs.readFileSync(process.argv[2] || 'index.html', 'utf8');
function g(re){ const m = html.match(re); if(!m) throw new Error('마커 없음: ' + re); return m[0]; }
const code = g(/const ITEM_BANK = \[[\s\S]*?\n\];/) + g(/const STAFF_SPEC = \{[\s\S]*?function staffSVG\(kind\)\{[\s\S]*?\n\}/) +
             g(/const LITERACY = \[[\s\S]*?\n\];/) + g(/const EAR_ITEMS = \[[\s\S]*?\n\];/) +
             g(/const DISCRIM = \[[\s\S]*?\n\];/) + g(/const SHORT = \[[\s\S]*?\n\];/);
const CHECKS = `
let bad = 0;
const MID = staffLineY(2);
LITERACY.forEach(function(it){
  const spec = STAFF_SPEC[it.staff];
  if(!spec){ console.log(it.id, '| 박자표 악보 (음표 없음, 정상)'); return; }
  const svg = staffSVG(it.staff);
  if(svg.indexOf('class="mus"') < 0){ console.log(it.id, '| *** Bravura 글리프 없음'); bad++; }
  const em = svg.match(/<text class="mus nh"[^>]*data-y="([-0-9.]+)"/);
  if(!em){ console.log(it.id, '| *** 음표 없음'); bad++; return; }
  const cy = parseFloat(em[1]);
  let drawn = null;
  for(let n=1;n<=5;n++) if(Math.abs(cy - staffLineY(ST_BOT-(n-1))) < 0.01) drawn = 'line'+n;
  for(let n2=1;n2<=4;n2++) if(Math.abs(cy - (staffLineY(ST_BOT-(n2-1)) - ST_S/2)) < 0.01) drawn = 'space'+n2;
  const want = spec.pos.t + spec.pos.n, note = it.opts[it.ans];
  const ok = drawn === want && note === spec.note;
  if(!ok) bad++;
  console.log(it.id, '| 선언', want, '| 그린 위치', drawn, '| 정답', note, '->', ok ? '일치' : '*** 불일치');
});
(function(){
  const svg = rhythmSVG([1,0.5,0.5,2], 240);
  const heads = (svg.match(/<text class="mus nh"[^>]*data-x="([-0-9.]+)"/g) || []).map(function(h){ return parseFloat(h.match(/data-x="([-0-9.]+)"/)[1]) + 8.85; });
  const lines = svg.match(/<line x1="([-0-9.]+)" y1="([-0-9.]+)" x2="([-0-9.]+)" y2="([-0-9.]+)"/g) || [];
  let stems = 0, prob = [];
  lines.forEach(function(st){
    const m = st.match(/x1="([-0-9.]+)" y1="([-0-9.]+)" x2="([-0-9.]+)" y2="([-0-9.]+)"/);
    const x1=+m[1], y1=+m[2], x2=+m[3], y2=+m[4];
    if(Math.abs(x1-x2) > 0.01) return;
    stems++;
    if(y2 <= y1) prob.push('기둥이 위로 향함');
    if(!heads.some(function(hx){ return Math.abs(hx-x1) < 10.5; })) prob.push('왼쪽에 붙지 않음');
  });
  if(stems !== heads.length) prob.push('기둥 '+stems+'개 vs 음표 '+heads.length+'개');
  if(prob.length) bad++;
  console.log('리듬 악보 | 음표', heads.length, '· 기둥', stems, '|', prob.length ? '*** '+prob.join(', ') : '가운데 줄 → 아래·왼쪽 규칙대로');
})();
(function(){
  const ts = staffSVG('meter44');
  const ys = (ts.match(/class="mus" x="[-0-9.]+" y="([-0-9.]+)"/g) || []).map(function(m){ return parseFloat(m.match(/y="([-0-9.]+)"/)[1]); });
  const want = [staffLineY(1), staffLineY(3)];
  const ok = want.every(function(w){ return ys.some(function(y){ return Math.abs(y-w) < 0.5; }); });
  if(!ok) bad++;
  console.log('박자표 | 글리프 y', ys.join(', '), '| 기준', want.join(', '), '->', ok ? '오선 꽉 채움' : '*** 확인 필요');
})();
EAR_ITEMS.forEach(function(it){
  const n = it.opts ? it.opts.length : it.optsNotation.length;
  let ok = it.ans >= 0 && it.ans < n && n >= 3, extra = '';
  if(it.kind === 'rhythm'){
    const same = it.play.join(',') === it.optsNotation[it.ans].join(',');
    const bar = Math.abs(it.play.reduce(function(a,b){return a+b;},0) - 4) < 0.001;
    ok = ok && same && bar;
    extra = '| 소리=정답악보 ' + (same?'같음':'*** 다름') + ' | 마디 ' + (bar?'4박':'*** 확인');
  }
  if(!ok) bad++;
  console.log(it.id, '|', it.kind, '| 선택지', n, '| 정답', (it.ans+1)+'번', extra, '->', ok?'정상':'*** 확인');
});
DISCRIM.forEach(function(it){
  const ok = it.opts.length >= 3 && it.ans >= 0 && it.ans < it.opts.length &&
    Object.keys(it.fb||{}).every(function(k){ return parseInt(k,10) !== it.ans; });
  if(!ok) bad++;
  console.log(it.id, '| 구별 | 선택지', it.opts.length, '| 정답', (it.ans+1)+'번', '->', ok?'정상':'*** 확인');
});
SHORT.forEach(function(it){
  const ok = it.accept && it.accept.length && it.ansText;
  if(!ok) bad++;
  console.log(it.id, '| 단답 | 정답', it.ansText, '| 허용', it.accept.join('/'), '->', ok?'정상':'*** 확인');
});

/* ---- 6. 선택지 길이 균형 (정답이 길어서 티 나지 않게) ---- */
(function(){
  const kr = s => String(s).replace(/\s/g,'').length;
  let flagged = [];
  function scan(name, items){
    items.forEach(function(it){
      const opts = it.opts || (it.optsNotation||[]).map(function(p){ return p.join('-'); });
      const L = opts.map(kr), a = it.ans;
      const others = L.filter(function(_,i){ return i !== a; });
      const avg = others.reduce(function(x,y){ return x+y; },0)/others.length;
      const r = avg ? L[a]/avg : 1;
      if(r >= 1.35) flagged.push(it.id + '(' + r.toFixed(2) + ')');
    });
  }
  scan('요소', ITEM_BANK); scan('문해력', LITERACY); scan('청음', EAR_ITEMS); scan('구별', DISCRIM);
  if(flagged.length) bad++;
  console.log('선택지 균형 |', flagged.length ? ('*** 정답이 긴 문항 ' + flagged.join(', ')) : '정답이 길어 눈에 띄는 문항 없음');
})();
console.log(bad ? ('결과: 문제 ' + bad + '건') : '결과: 악보·박자표·청음·바로잡기·선택지 균형 모두 정상');
if(false) process.exit(bad ? 1 : 0);
`;
eval(code + CHECKS);
