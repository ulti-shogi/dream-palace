/* profile.js
   将棋の殿堂：棋士プロフィール検索（公開版：現役棋士のみ明記）

   前提（HTML側）：
   - 入力ID：
     q-name, q-num, q-dan, q-age-min, q-age-max,
     q-metric（age / fourAge / activeSpan）, q-order（asc / desc）
     btn-search, btn-reset
   - 集計：#summary
   - 結果：#result-body
   - 指標列見出し：#th-metric（<th id="th-metric">指標</th>）

   仕様：
   - CSV: profile.csv（同階層）
   - 現役判定：retire/passing/withdraw が空
   - 段位：nine-day〜four-day から導出（漢数字）／全空は「不明」
   - 年齢/期間：○歳○ヶ月○日（「ヶ月」表記）
   - 「今日」＝アクセス日（ページを開いた日）
   - 並べ替え：選択した指標のみ（昇順/降順）
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

  const $ = (sel) => document.querySelector(sel);

  const el = {
    qName: $("#q-name"),
    qNum: $("#q-num"),
    qDan: $("#q-dan"),
    qAgeMin: $("#q-age-min"),
    qAgeMax: $("#q-age-max"),
    qMetric: $("#q-metric"),
    qOrder: $("#q-order"),
    btnSearch: $("#btn-search"),
    btnReset: $("#btn-reset"),
    summary: $("#summary"),
    tbody: $("#result-body"),
    thMetric: $("#th-metric"),
  };

  // ===== Date helpers =====
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

  // ===== CSV parse =====
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

  // ===== diff (Y/M/D) =====
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

  // 平均用：差分ms平均を「○歳○ヶ月○日」に変換
  function avgMsToYmdString(avgMs, today) {
    if (!Number.isFinite(avgMs) || avgMs < 0) return "—";
    const base = new Date(today.getTime());
    base.setHours(0, 0, 0, 0);

    const virtualBirth = new Date(base.getTime() - avgMs);
    virtualBirth.setHours(0, 0, 0, 0);

    const ymd = diffYMD(virtualBirth, base);
    return ymd ? ymdToString(ymd) : "—";
  }

  // ===== derive =====
  function isActive(row) {
    const r = (row[COL.retire] || "").trim();
    const p = (row[COL.passing] || "").trim();
    const w = (row[COL.withdraw] || "").trim();
    return r === "" && p === "" && w === "";
  }

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
      activeSpanStr: activeSpan ? ymdToString(activeSpan) : "不明",

      // ソート・平均用(ms)
      ageMs: birth ? (today.getTime() - birth.getTime()) : null,
      fourAgeMs: birth && four ? (four.getTime() - birth.getTime()) : null,
      activeSpanMs: four ? (today.getTime() - four.getTime()) : null,
    };
  }

  // ===== UI (metric) =====
  function metricLabel(metric) {
    if (metric === "fourAge") return "四段昇段年齢";
    if (metric === "activeSpan") return "現役期間";
    return "年齢";
  }

  function metricText(r, metric) {
    if (metric === "fourAge") return r.fourAgeStr;
    if (metric === "activeSpan") return r.activeSpanStr;
    return r.ageStr;
  }

  function metricMs(r, metric) {
    if (metric === "fourAge") return r.fourAgeMs;
    if (metric === "activeSpan") return r.activeSpanMs;
    return r.ageMs;
  }

  // ===== filters =====
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
      // 棋士名（部分一致）
      if (filters.name) {
        const n = (r.name || "").toLowerCase();
        if (!n.includes(filters.name.toLowerCase())) return false;
      }

      // 棋士番号（一致）
      if (filters.num !== null) {
        if (r.num !== filters.num) return false;
      }

      // 段位（一致）
      if (filters.dan) {
        if (r.dan !== filters.dan) return false;
      }

      // 年齢（年の範囲）
      if (filters.ageMin !== null) {
        if (r.ageYears === null || r.ageYears < filters.ageMin) return false;
      }
      if (filters.ageMax !== null) {
        if (r.ageYears === null || r.ageYears > filters.ageMax) return false;
      }

      return true;
    });
  }

  function sortByMetric(records, metric, order) {
    const dir = order === "desc" ? -1 : 1;

    return records.slice().sort((a, b) => {
      const va = metricMs(a, metric);
      const vb = metricMs(b, metric);

      const na = va === null || va === undefined || !Number.isFinite(va);
      const nb = vb === null || vb === undefined || !Number.isFinite(vb);

      // 不明は末尾
      if (na && nb) return (a.num ?? 1e18) - (b.num ?? 1e18);
      if (na) return 1;
      if (nb) return -1;

      if (va !== vb) return (va - vb) * dir;

      // 同値なら棋士番号で安定化
      return (a.num ?? 1e18) - (b.num ?? 1e18);
    });
  }

  // ===== render =====
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

    // 指標列の見出しを差し替え
    if (el.thMetric) el.thMetric.textContent = metricLabel(metric);

    el.tbody.innerHTML = "";
    const frag = document.createDocumentFragment();

    for (const r of records) {
      const tr = document.createElement("tr");

      // 列順（8列固定）
      // 1 num / 2 name / 3 dan / 4 metric / 5 age / 6 fourAge / 7 activeSpan / 8 birthday
      const cells = [
        r.numStr,
        r.name,
        r.dan,
        metricText(r, metric),
        r.ageStr,
        r.fourAgeStr,
        r.activeSpanStr,
        r.birthdayStr,
      ];

      for (const c of cells) {
        const td = document.createElement("td");
        td.textContent = c;
        tr.appendChild(td);
      }

      frag.appendChild(tr);
    }

    el.tbody.appendChild(frag);
  }

  // ===== init / events =====
  let ALL_ACTIVE = [];
  let TODAY = null;

  async function loadData(today) {
    const res = await fetch(CSV_PATH, { cache: "no-store" });
    if (!res.ok) throw new Error(`CSVの取得に失敗しました（${res.status}）`);
    const text = await res.text();

    const rows = parseCSV(text);
    const objs = rowsToObjects(rows);

    const active = objs
      .filter(isActive)
      .map((row) => {
        const numRaw = (row[COL.num] || "").trim();
        const num = numRaw === "" ? NaN : Number(numRaw);

        const name = (row[COL.name] || "").trim();
        const dan = deriveDan(row);

        const birthdayStr = (row[COL.birthday] || "").trim() || "不明";
        const ages = deriveAges(row, today);

        return {
          raw: row,

          num: Number.isFinite(num) ? num : null,
          numStr: Number.isFinite(num) ? String(num) : "—",
          name: name || "—",
          dan,

          birthdayStr,

          ageStr: ages.ageStr,
          ageYears: ages.ageYears,
          fourAgeStr: ages.fourAgeStr,
          activeSpanStr: ages.activeSpanStr,

          ageMs: ages.ageMs,
          fourAgeMs: ages.fourAgeMs,
          activeSpanMs: ages.activeSpanMs,
        };
      });

    // 既定順：棋士番号昇順（番号なしは末尾）
    active.sort((a, b) => {
      if (a.num === null && b.num === null) return 0;
      if (a.num === null) return 1;
      if (b.num === null) return -1;
      return a.num - b.num;
    });

    return active;
  }

  function runSearch() {
    const filters = readFilters();
    const filtered = applyFilters(ALL_ACTIVE, filters);
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

    // Enterで検索（フォームタグなし想定）
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
      ALL_ACTIVE = await loadData(TODAY);
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