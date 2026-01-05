/* profile.js
   将棋の殿堂：棋士プロフィール検索（公開版）

   列仕様（8列固定でJSが出力、CSSで 4/6/8 列を表示切替）
   1: 順番（1,2,3...）固定
   2: 棋士名 固定
   3: 段位 固定（四〜九段 / 不明）
   4: 指標 固定（選択で内容変化）
   5: 変動列A（指標に応じて変化）
   6: 変動列B（指標に応じて変化）
   7: 棋士番号 固定
   8: 区分 固定（現役/引退/物故/退会）※現状は現役のみ表示

   指標と列割当
   - age:        4=年齢        5=生年月日    6=現役期間
   - fourAge:    4=四段昇段年齢 5=生年月日    6=四段昇段日
   - activeSpan: 4=現役期間     5=四段昇段日  6=四段昇段年齢

   並べ替え：指標（4列目）だけを昇順/降順

   CSV: profile.csv（同階層）
*/

(() => {
  "use strict";

  const CSV_PATH = "profile.csv";

  const COL = {
    num: "num",
    name: "name",
    birthday: "birthday",
    four: "four-day",
    five: "five-day",
    six: "six-day",
    seven: "seven-day",
    eight: "eight-day",
    nine: "nine-day",
    retire: "retire",
    passing: "passing",
    withdraw: "withdraw",
  };

  // 現状は「現役棋士のみ表示」。将来拡張するなら false にする。
  const SHOW_ONLY_ACTIVE = true;

  const $ = (sel) => document.querySelector(sel);

  const el = {
    qName: $("#q-name"),
    qNum: $("#q-num"),
    qDan: $("#q-dan"),
    qAgeMin: $("#q-age-min"),
    qAgeMax: $("#q-age-max"),
    qMetric: $("#q-metric"), // age / fourAge / activeSpan
    qOrder: $("#q-order"),   // asc / desc
    btnSearch: $("#btn-search"),
    btnReset: $("#btn-reset"),
    summary: $("#summary"),
    tbody: $("#result-body"),
    thMetric: $("#th-metric"),
    thVar5: $("#th-var5"),
    thVar6: $("#th-var6"),
  };

  // ===== 日付 =====
  function toDateOrNull(ymd) {
    if (!ymd || typeof ymd !== "string") return null;
    const s = ymd.trim();
    if (!s) return null;

    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) return null;

    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);

    const dt = new Date(y, mo - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;

    dt.setHours(0, 0, 0, 0);
    return dt;
  }

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

  // ===== 年月日差分 =====
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

      // 月末ずれ対策：同日が存在しない場合は翌月末日へ寄せる
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

  function ymdToString(ymd) {
    if (!ymd) return "不明";
    return `${ymd.years}歳${ymd.months}ヶ月${ymd.days}日`;
  }

  function ymdToYearString(ymd) {
  if (!ymd) return "不明";
  return `${ymd.years}年${ymd.months}ヶ月${ymd.days}日`;
  }

  function avgMsToYmdString(avgMs, today) {
    if (!Number.isFinite(avgMs) || avgMs < 0) return "—";
    const base = new Date(today.getTime());
    base.setHours(0, 0, 0, 0);

    const virtualBirth = new Date(base.getTime() - avgMs);
    virtualBirth.setHours(0, 0, 0, 0);

    const ymd = diffYMD(virtualBirth, base);
    return ymd ? ymdToString(ymd) : "—";
  }

  // ===== 区分 =====
  function classify(row) {
    const r = (row[COL.retire] || "").trim();
    const p = (row[COL.passing] || "").trim();
    const w = (row[COL.withdraw] || "").trim();

    if (p !== "") return "物故";
    if (r !== "") return "引退";
    if (w !== "") return "退会";
    return "現役";
  }

  function isActive(row) {
    return classify(row) === "現役";
  }

  // ===== 段位 =====
  function deriveDan(row) {
    const map = [
      { col: COL.nine, label: "九段" },
      { col: COL.eight, label: "八段" },
      { col: COL.seven, label: "七段" },
      { col: COL.six, label: "六段" },
      { col: COL.five, label: "五段" },
      { col: COL.four, label: "四段" },
    ];
    for (const it of map) {
      if ((row[it.col] || "").trim() !== "") return it.label;
    }
    return "不明";
  }

  // ===== 派生 =====
  function deriveAges(row, today) {
    const birth = toDateOrNull(row[COL.birthday]);
    const four = toDateOrNull(row[COL.four]);

    const age = birth ? diffYMD(birth, today) : null;
    const fourAge = birth && four ? diffYMD(birth, four) : null;
    const activeSpan = four ? diffYMD(four, today) : null;

    return {
      ageStr: age ? ymdToString(age) : "不明",
      ageYears: age ? age.years : null,

      fourAgeStr: fourAge ? ymdToString(fourAge) : "不明",
      activeSpanStr: activeSpan ? ymdToYearString(activeSpan) : "不明",

    // 並べ替え/平均用（ms）
      ageMs: birth ? (today.getTime() - birth.getTime()) : null,
      fourAgeMs: birth && four ? (four.getTime() - birth.getTime()) : null,
      activeSpanMs: four ? (today.getTime() - four.getTime()) : null,
    };
  }

  // ===== 指標→列定義（対応表：ここが設計の核） =====
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
    const order = (el.qOrder?.value ?? "asc").trim() || "asc";

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

  // ===== 並べ替え（指標のみ） =====
  function sortByMetric(records, metric, order) {
    const def = getMetricDef(metric);
    const dir = order === "desc" ? -1 : 1;

    return records.slice().sort((a, b) => {
      const va = def.key(a);
      const vb = def.key(b);

      const na = va === null || va === undefined || !Number.isFinite(va);
      const nb = vb === null || vb === undefined || !Number.isFinite(vb);

      // 不明は末尾
      if (na && nb) return (a.num ?? 1e18) - (b.num ?? 1e18);
      if (na) return 1;
      if (nb) return -1;

      if (va !== vb) return (va - vb) * dir;

      // 同値のときは棋士番号で安定化
      return (a.num ?? 1e18) - (b.num ?? 1e18);
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
      avgStr = avgMsToYmdString(avgMs, today);
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

      // 列順（8列固定）
      const cells = [
        String(idx + 1),       // 1 順番
        r.name,                // 2 棋士名
        r.dan,                 // 3 段位
        def.v4(r),             // 4 指標
        def.v5(r),             // 5 変動A
        def.v6(r),             // 6 変動B
        r.numStr,              // 7 棋士番号
        r.status,              // 8 区分
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

    const filtered = objs.filter((row) => (SHOW_ONLY_ACTIVE ? isActive(row) : true));

    const records = filtered.map((row) => {
      const numRaw = (row[COL.num] || "").trim();
      const num = numRaw === "" ? NaN : Number(numRaw);

      const name = (row[COL.name] || "").trim() || "—";
      const dan = deriveDan(row);

      const status = classify(row);

      const birthdayStr = (row[COL.birthday] || "").trim() || "不明";
      const fourDayStr = (row[COL.four] || "").trim() || "不明";

      const ages = deriveAges(row, today);

      return {
        raw: row,

        num: Number.isFinite(num) ? num : null,
        numStr: Number.isFinite(num) ? String(num) : "—",

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
      };
    });

    // 既定ソート：棋士名→棋士番号（安定目的）
    records.sort((a, b) => {
      const an = a.name ?? "";
      const bn = b.name ?? "";
      if (an !== bn) return an.localeCompare(bn, "ja");
      const na = a.num ?? 1e18;
      const nb = b.num ?? 1e18;
      return na - nb;
    });

    return records;
  }

  function runSearch() {
    const filters = readFilters();
    const filtered = applyFilters(ALL, filters);
    const sorted = sortByMetric(filtered, filters.metric, filters.order);

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
    if (el.qOrder) el.qOrder.value = "asc";
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
    // 「今日」＝アクセス日
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