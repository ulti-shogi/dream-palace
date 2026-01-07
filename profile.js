/* profile.js（rules.js 前提・貼り替え用）
   将棋の殿堂：棋士プロフィール検索（公開版）

   前提：
   - rules.js を先に読み込む（defer 推奨）
     <script src="rules.js" defer></script>
     <script src="profile.js?v=20260107" defer></script>

   UI前提（HTML側）：
   - 入力ID：
     q-name, q-num, q-dan, q-age-min, q-age-max,
     q-metric（age / fourAge / activeSpan）, q-order（seki / asc / desc）
     btn-search, btn-reset
   - 集計：#summary
   - 結果：#result-body
   - 見出し：#th-metric #th-var5 #th-var6

   CSV: profile.csv（同階層）
*/

(() => {
  "use strict";

  const CSV_PATH = "profile.csv";
  const SHOW_ONLY_ACTIVE = true;

  // rules.js の存在チェック
  if (!window.ProfileRules) {
    console.error("ProfileRules が見つかりません。rules.js を profile.js より先に読み込んでください。");
  }

  const R = window.ProfileRules;

  const $ = (sel) => document.querySelector(sel);

  const el = {
    qName: $("#q-name"),
    qNum: $("#q-num"),
    qDan: $("#q-dan"),
    qAgeMin: $("#q-age-min"),
    qAgeMax: $("#q-age-max"),
    qMetric: $("#q-metric"), // age / fourAge / activeSpan
    qOrder: $("#q-order"),   // seki / asc / desc
    btnSearch: $("#btn-search"),
    btnReset: $("#btn-reset"),
    summary: $("#summary"),
    tbody: $("#result-body"),
    thMetric: $("#th-metric"),
    thVar5: $("#th-var5"),
    thVar6: $("#th-var6"),
  };

  // ===== 日付・表示 =====
  function formatYmd(dt) {
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const d = String(dt.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  // ===== CSV =====
  function parseCSV(text) {
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const c = text[i];

      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += c;
        }
        continue;
      }

      if (c === '"') {
        inQuotes = true;
        continue;
      }

      if (c === ",") {
        row.push(field);
        field = "";
        continue;
      }

      if (c === "\r") continue;

      if (c === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
        continue;
      }

      field += c;
    }

    if (field.length > 0 || row.length > 0) {
      row.push(field);
      rows.push(row);
    }

    return rows;
  }

  function rowsToObjects(rows) {
    if (!rows.length) return [];
    const header = rows[0].map((h) => h.trim());
    const out = [];

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || r.every((v) => String(v).trim() === "")) continue;

      const obj = {};
      for (let j = 0; j < header.length; j++) {
        const key = header[j];
        obj[key] = (r[j] ?? "").trim();
      }
      out.push(obj);
    }
    return out;
  }

  // ===== 年月日差分（表示用） =====
  function diffYMD(start, end) {
    if (!(start instanceof Date) || !(end instanceof Date)) return null;

    let a = new Date(start.getTime());
    let b = new Date(end.getTime());
    a.setHours(0, 0, 0, 0);
    b.setHours(0, 0, 0, 0);

    if (a.getTime() > b.getTime()) {
      const tmp = a;
      a = b;
      b = tmp;
    }

    let years = 0;
    while (true) {
      const next = new Date(a.getFullYear() + 1, a.getMonth(), a.getDate());
      next.setHours(0, 0, 0, 0);
      if (next.getTime() <= b.getTime()) {
        a = next;
        years++;
      } else break;
    }

    let months = 0;
    while (true) {
      const next = new Date(a.getFullYear(), a.getMonth() + 1, a.getDate());
      next.setHours(0, 0, 0, 0);

      if (next.getDate() !== a.getDate()) {
        const lastDay = new Date(a.getFullYear(), a.getMonth() + 2, 0);
        lastDay.setHours(0, 0, 0, 0);
        if (lastDay.getTime() <= b.getTime()) {
          a = lastDay;
          months++;
          continue;
        }
        break;
      }

      if (next.getTime() <= b.getTime()) {
        a = next;
        months++;
      } else break;
    }

    const msPerDay = 24 * 60 * 60 * 1000;
    const days = Math.floor((b.getTime() - a.getTime()) / msPerDay);

    return { years, months, days };
  }

  function ymdToAgeString(ymd) {
    if (!ymd) return "不明";
    return `${ymd.years}歳${ymd.months}ヶ月${ymd.days}日`;
  }

  function ymdToYearString(ymd) {
    if (!ymd) return "不明";
    return `${ymd.years}年${ymd.months}ヶ月${ymd.days}日`;
  }

  function avgMsToAgeString(avgMs, today) {
    if (!Number.isFinite(avgMs) || avgMs < 0) return "—";
    const base = new Date(today.getTime());
    base.setHours(0, 0, 0, 0);

    const virtualBirth = new Date(base.getTime() - avgMs);
    virtualBirth.setHours(0, 0, 0, 0);

    const ymd = diffYMD(virtualBirth, base);
    return ymd ? ymdToAgeString(ymd) : "—";
  }

  // ===== 派生（年齢等） =====
  function deriveAges(row, today) {
    const birth = R.toDateOrNull(row[R.COL.birthday]);
    const four = R.toDateOrNull(row[R.COL.four]);

    const age = birth ? diffYMD(birth, today) : null;
    const fourAge = birth && four ? diffYMD(birth, four) : null;
    const activeSpan = four ? diffYMD(four, today) : null;

    return {
      ageStr: age ? ymdToAgeString(age) : "不明",
      ageYears: age ? age.years : null,

      fourAgeStr: fourAge ? ymdToAgeString(fourAge) : "不明",
      activeSpanStr: activeSpan ? ymdToYearString(activeSpan) : "不明",

      // 並べ替え/平均用（ms）
      ageMs: birth ? (today.getTime() - birth.getTime()) : null,
      fourAgeMs: birth && four ? (four.getTime() - birth.getTime()) : null,
      activeSpanMs: four ? (today.getTime() - four.getTime()) : null,
    };
  }

  // ===== 指標→列定義 =====
  const METRIC_DEF = {
    age: {
      th4: "年齢",
      th5: "生年月日",
      th6: "現役期間",
      v4: (r) => r.ageStr,
      v5: (r) => r.birthdayStr,
      v6: (r) => r.activeSpanStr,
      key: (r) => r.ageMs,
    },
    fourAge: {
      th4: "四段昇段年齢",
      th5: "生年月日",
      th6: "四段昇段日",
      v4: (r) => r.fourAgeStr,
      v5: (r) => r.birthdayStr,
      v6: (r) => r.fourDayStr,
      key: (r) => r.fourAgeMs,
    },
    activeSpan: {
      th4: "現役期間",
      th5: "四段昇段日",
      th6: "四段昇段年齢",
      v4: (r) => r.activeSpanStr,
      v5: (r) => r.fourDayStr,
      v6: (r) => r.fourAgeStr,
      key: (r) => r.activeSpanMs,
    },
  };

  function getMetricDef(metric) {
    return METRIC_DEF[metric] ?? METRIC_DEF.age;
  }

  // ===== フィルタ =====
  function readFilters() {
    const name = (el.qName?.value ?? "").trim();
    const numRaw = (el.qNum?.value ?? "").trim();
    const dan = (el.qDan?.value ?? "").trim();
    const ageMinRaw = (el.qAgeMin?.value ?? "").trim();
    const ageMaxRaw = (el.qAgeMax?.value ?? "").trim();

    const metric = (el.qMetric?.value ?? "age").trim() || "age";
    const order = (el.qOrder?.value ?? "seki").trim() || "seki";

    const num = numRaw === "" ? null : Number(numRaw);
    const ageMin = ageMinRaw === "" ? null : Number(ageMinRaw);
    const ageMax = ageMaxRaw === "" ? null : Number(ageMaxRaw);

    return {
      name,
      num: Number.isFinite(num) ? num : null,
      dan: dan === "" ? null : dan,
      ageMin: Number.isFinite(ageMin) ? ageMin : null,
      ageMax: Number.isFinite(ageMax) ? ageMax : null,
      metric,
      order,
    };
  }

  function applyFilters(records, filters) {
    return records.filter((r) => {
      if (filters.name) {
        const n = (r.name || "").toLowerCase();
        if (!n.includes(filters.name.toLowerCase())) return false;
      }
      if (filters.num !== null) {
        if (r.num !== filters.num) return false;
      }
      if (filters.dan) {
        if (r.dan !== filters.dan) return false;
      }
      if (filters.ageMin !== null) {
        if (r.ageYears === null || r.ageYears < filters.ageMin) return false;
      }
      if (filters.ageMax !== null) {
        if (r.ageYears === null || r.ageYears > filters.ageMax) return false;
      }
      return true;
    });
  }

  // ===== 並べ替え =====
  function sortRecords(records, metric, order) {
    if (order === "seki") {
      return records.slice().sort(R.compareSeat);
    }

    const def = getMetricDef(metric);
    const dir = order === "desc" ? -1 : 1;

    return records.slice().sort((a, b) => {
      const va = def.key(a);
      const vb = def.key(b);

      const na = va === null || va === undefined || !Number.isFinite(va);
      const nb = vb === null || vb === undefined || !Number.isFinite(vb);

      if (na && nb) return R.compareSeat(a, b);
      if (na) return 1;
      if (nb) return -1;

      if (va !== vb) return (va - vb) * dir;

      return R.compareSeat(a, b);
    });
  }

  // ===== 描画 =====
  function renderHeaders(metric) {
    const def = getMetricDef(metric);
    if (el.thMetric) el.thMetric.textContent = def.th4;
    if (el.thVar5) el.thVar5.textContent = def.th5;
    if (el.thVar6) el.thVar6.textContent = def.th6;
  }

  function renderSummary(records, today) {
    if (!el.summary) return;

    const total = records.length;

    // 四段昇段平均年齢：birthday と four-day が揃う人のみ
    const msList = records
      .map((r) => r.fourAgeMs)
      .filter((v) => Number.isFinite(v) && v >= 0);

    const nAvg = msList.length;
    let avgStr = "—";
    if (nAvg > 0) {
      const avgMs = msList.reduce((a, b) => a + b, 0) / nAvg;
      avgStr = avgMsToAgeString(avgMs, today);
    }

    el.summary.textContent =
      `対象：現役棋士（公開版） / 今日：${formatYmd(today)} / 件数：${total} / 四段昇段平均年齢：${avgStr}（算出対象：${nAvg}名）`;
  }

  function renderTable(records, metric) {
    if (!el.tbody) return;

    const def = getMetricDef(metric);
    renderHeaders(metric);

    el.tbody.innerHTML = "";
    const frag = document.createDocumentFragment();

    records.forEach((r, idx) => {
      const tr = document.createElement("tr");

      const cells = [
        String(idx + 1), // 1 順番
        r.name,          // 2 棋士名
        r.dan,           // 3 段位
        def.v4(r),       // 4 指標
        def.v5(r),       // 5 変動A
        def.v6(r),       // 6 変動B
        r.numStr,        // 7 棋士番号
        r.status,        // 8 区分
      ];

      for (const c of cells) {
        const td = document.createElement("td");
        td.textContent = c;
        tr.appendChild(td);
      }

      frag.appendChild(tr);
    });

    el.tbody.appendChild(frag);
  }

  // ===== 初期化 =====
  let ALL = [];
  let TODAY = null;

  async function loadData(today) {
    const res = await fetch(CSV_PATH, { cache: "no-store" });
    if (!res.ok) throw new Error(`CSVの取得に失敗しました（${res.status}）`);
    const text = await res.text();

    const rows = parseCSV(text);
    const objs = rowsToObjects(rows);

    const filtered = objs.filter((row) => {
      if (!SHOW_ONLY_ACTIVE) return true;
      return R.classify(row) === "現役";
    });

    const records = filtered.map((row) => {
      const numRaw = (row[R.COL.num] || "").trim();
      const numVal = numRaw === "" ? NaN : Number(numRaw);

      const num = Number.isFinite(numVal) ? numVal : null;
      const numStr = Number.isFinite(numVal) ? String(numVal) : "—";

      const name = (row[R.COL.name] || "").trim() || "—";
      const dan = R.deriveDan(row);
      const status = R.classify(row);

      const birthdayStr = (row[R.COL.birthday] || "").trim() || "不明";
      const fourDayStr = (row[R.COL.four] || "").trim() || "不明";

      const ages = deriveAges(row, today);
      const seat = R.deriveSeat(row, dan, name, numVal);

      return {
        raw: row,

        num,
        numStr,
        name,
        dan,
        status,

        birthdayStr,
        fourDayStr,

        ageStr: ages.ageStr,
        ageYears: ages.ageYears,

        fourAgeStr: ages.fourAgeStr,
        activeSpanStr: ages.activeSpanStr,

        ageMs: ages.ageMs,
        fourAgeMs: ages.fourAgeMs,
        activeSpanMs: ages.activeSpanMs,

        seat,
      };
    });

    // 初期は席次順
    records.sort(R.compareSeat);
    return records;
  }

  function runSearch() {
    const filters = readFilters();
    const filtered = applyFilters(ALL, filters);
    const sorted = sortRecords(filtered, filters.metric, filters.order);

    renderSummary(sorted, TODAY);
    renderTable(sorted, filters.metric);
  }

  function resetForm() {
    if (el.qName) el.qName.value = "";
    if (el.qNum) el.qNum.value = "";
    if (el.qDan) el.qDan.value = "";
    if (el.qAgeMin) el.qAgeMin.value = "";
    if (el.qAgeMax) el.qAgeMax.value = "";
    if (el.qMetric) el.qMetric.value = "age";
    if (el.qOrder) el.qOrder.value = "seki";
  }

  function bindEvents() {
    el.btnSearch?.addEventListener("click", runSearch);

    el.btnReset?.addEventListener("click", () => {
      resetForm();
      runSearch();
    });

    // Enterで検索
    ["q-name", "q-num", "q-age-min", "q-age-max"].forEach((id) => {
      const input = document.getElementById(id);
      if (!input) return;
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          runSearch();
        }
      });
    });

    el.qDan?.addEventListener("change", runSearch);
    el.qMetric?.addEventListener("change", runSearch);
    el.qOrder?.addEventListener("change", runSearch);
  }

  async function init() {
    TODAY = new Date();
    TODAY.setHours(0, 0, 0, 0);

    try {
      ALL = await loadData(TODAY);
      bindEvents();
      runSearch();
    } catch (err) {
      if (el.summary) {
        const msg =
          "データ読み込みに失敗しました。GitHub Pages上で開くか、profile.csv のパス/ファイル名を確認してください。";
        el.summary.textContent = `${msg}（詳細：${String(err?.message ?? err)}）`;
      }
      if (el.tbody) el.tbody.innerHTML = "";
      console.error(err);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

function buildNameSelect(records) {
  const sel = document.getElementById("q-name");
  if (!sel) return;

  // inputのままなら何もしない（将来戻したくなった時の保険）
  if (sel.tagName !== "SELECT") return;

  // 先頭の「（全員）」以外を作り直す
  while (sel.options.length > 1) sel.remove(1);

  const frag = document.createDocumentFragment();

  for (const r of records) {
    const opt = document.createElement("option");
    opt.value = r.name;            // フル一致
    opt.textContent = r.name;      // 表示
    frag.appendChild(opt);
  }

  sel.appendChild(frag);
}

ALL = await loadData(TODAY);
buildNameSelect(ALL);
bindEvents();
runSearch();