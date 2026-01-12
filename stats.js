/* stats.js
   対象：棋士番号184以降
   - #avg-age に「棋士番号184以降の棋士の四段昇段平均年齢」を表示（平均生年月日→平均四段日）
   - table tbody#rows に 4列（順/棋士名/四段昇段年齢/棋士番号）を表示
   - 並び替え：棋士番号の小さい順 / 四段昇段年齢が若い順（ヘッダクリック）
   - 中央値：四段昇段年齢を若い順に並べたときの中央値（同値は全行ハイライト）
   ※ #summary / #median-age には触りません
*/
(() => {
  "use strict";

  const CSV_PATH = "profile.csv";
  const NUM_MIN = 184;
  const MS_DAY = 24 * 60 * 60 * 1000;

  document.addEventListener("DOMContentLoaded", () => {
    main().catch((err) => {
      console.error(err);
      const avgEl = document.getElementById("avg-age");
      if (avgEl) avgEl.textContent = "（計算エラー）";
      const tbody = document.getElementById("rows");
      if (tbody) tbody.innerHTML = `<tr><td colspan="4">（エラー）</td></tr>`;
    });
  });

  async function main() {
    const avgEl = document.getElementById("avg-age");
    const tbody = document.getElementById("rows");
    if (!avgEl) throw new Error("#avg-age が見つかりません");
    if (!tbody) throw new Error("#rows（tbody）が見つかりません");

    // CSV 読み込み
    const text = await fetchText(CSV_PATH);
    const rows = csvToObjects(text);

    // 対象抽出＋整形（列名は厳密にそのまま）
    const items = rows
      .map((r) => normalize(r))
      .filter((x) => Number.isFinite(x.num) && x.num >= NUM_MIN);

    if (items.length === 0) throw new Error("対象データが0件です（棋士番号184以降が見つかりません）");

    // 平均年齢（平均生年月日→平均四段日）
    const avgBirth = meanDate(items.map((x) => x.birth));
    const avgFour = meanDate(items.map((x) => x.four));
    const avgYmd = diffYmdUTC(toUTCDate(avgBirth), toUTCDate(avgFour));
    avgEl.textContent = `棋士番号184以降の棋士の四段昇段平均年齢：${fmtAge(avgYmd)}`;

    // 中央値（若い順の中央）
    const byAge = [...items].sort((a, b) => a.ageDays - b.ageDays);
    const midIndex = Math.floor((byAge.length - 1) / 2);
    const medianAgeDays = byAge[midIndex].ageDays;

    // 初期表示：棋士番号の小さい順
    let sortMode = "num"; // "num" or "age"
    renderTable(tbody, [...items].sort((a, b) => a.num - b.num), medianAgeDays);

    // ヘッダクリックで切替（thの位置：0順/1棋士名/2四段昇段年齢/3棋士番号）
    const ths = Array.from(document.querySelectorAll("table thead th"));
    if (ths.length >= 4) {
      // クリック対象にする
      ths[2].style.cursor = "pointer";
      ths[3].style.cursor = "pointer";

      // 二重バインド防止
      if (!ths[2].dataset.bound) {
        ths[2].dataset.bound = "1";
        ths[2].addEventListener("click", () => {
          sortMode = "age";
          const sorted = [...items].sort((a, b) => a.ageDays - b.ageDays);
          renderTable(tbody, sorted, medianAgeDays);
        });
      }

      if (!ths[3].dataset.bound) {
        ths[3].dataset.bound = "1";
        ths[3].addEventListener("click", () => {
          sortMode = "num";
          const sorted = [...items].sort((a, b) => a.num - b.num);
          renderTable(tbody, sorted, medianAgeDays);
        });
      }
    }
  }

  // ===== テーブル描画 =====
  function renderTable(tbody, list, medianAgeDays) {
    tbody.innerHTML = "";

    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      const tr = document.createElement("tr");

      // 中央値（同じ ageDays の人は全員薄赤に）
      if (p.ageDays === medianAgeDays) {
        tr.style.backgroundColor = "#fbeaea";
      }

      tr.appendChild(td(String(i + 1)));      // 順
      tr.appendChild(td(p.name));             // 棋士名
      tr.appendChild(td(p.ageText));          // 四段昇段年齢
      tr.appendChild(td(String(p.num)));      // 棋士番号

      tbody.appendChild(tr);
    }
  }

  function td(text) {
    const el = document.createElement("td");
    el.textContent = text;
    return el;
  }

  // ===== データ整形（CSV列名厳密） =====
  function normalize(r) {
    const num = Number((r["num"] ?? "").trim());
    const name = (r["name"] ?? "").trim();
    const birth = parseYMDStrict(r["birthday"]);
    const four = parseYMDStrict(r["four-day"]);

    // 個別の四段昇段年齢（表示＋並び替え用）
    const bUTC = toUTCDate(birth);
    const fUTC = toUTCDate(four);
    const ymd = diffYmdUTC(bUTC, fUTC);
    const ageDays = Math.round((fUTC.getTime() - bUTC.getTime()) / MS_DAY);
    const ageText = fmtAge(ymd);

    return { num, name, birth, four, ageDays, ageText };
  }

  // ===== 平均 =====
  function meanDate(dates) {
    const sum = dates.reduce((acc, d) => acc + d.getTime(), 0);
    return new Date(Math.round(sum / dates.length));
  }

  // ===== 日付・差分（UTC） =====
  function parseYMDStrict(s) {
    const t = (s ?? "").trim();
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
    if (!m) throw new Error(`日付形式が不正です: ${t}`);
    const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
    // UTCで固定
    const dt = new Date(Date.UTC(y, mo - 1, d));
    return dt;
  }

  function toUTCDate(d) {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }

  function daysInMonthUTC(y, m) {
    return new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  }

  function addMonthsClampedUTC(dateUTC, addMonths) {
    const y = dateUTC.getUTCFullYear();
    const m = dateUTC.getUTCMonth();
    const d = dateUTC.getUTCDate();

    const nm = m + addMonths;
    const ny = y + Math.floor(nm / 12);
    const rm = ((nm % 12) + 12) % 12;

    const maxD = daysInMonthUTC(ny, rm);
    const nd = Math.min(d, maxD);
    return new Date(Date.UTC(ny, rm, nd));
  }

  function addYearsClampedUTC(dateUTC, addYears) {
    const y = dateUTC.getUTCFullYear();
    const m = dateUTC.getUTCMonth();
    const d = dateUTC.getUTCDate();

    const ny = y + addYears;
    const maxD = daysInMonthUTC(ny, m);
    const nd = Math.min(d, maxD);
    return new Date(Date.UTC(ny, m, nd));
  }

  // endUTC >= startUTC 前提
  function diffYmdUTC(startUTC, endUTC) {
    let cur = new Date(startUTC.getTime());
    let years = 0;
    while (true) {
      const next = addYearsClampedUTC(cur, 1);
      if (next.getTime() <= endUTC.getTime()) {
        cur = next;
        years++;
      } else break;
    }

    let months = 0;
    while (true) {
      const next = addMonthsClampedUTC(cur, 1);
      if (next.getTime() <= endUTC.getTime()) {
        cur = next;
        months++;
      } else break;
    }

    const days = Math.floor((endUTC.getTime() - cur.getTime()) / MS_DAY);
    return { y: years, m: months, d: days };
  }

  function fmtAge(ymd) {
    return `${ymd.y}歳${ymd.m}ヶ月${ymd.d}日`;
  }

  // ===== CSV =====
  async function fetchText(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`fetch failed: ${res.status} ${url}`);
    return await res.text();
  }

  function csvToObjects(csvText) {
    const rows = parseCSV(csvText);
    if (rows.length === 0) return [];
    const header = rows[0].map((h) => (h ?? "").trim());
    const out = [];

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || r.length === 0) continue;

      const obj = {};
      for (let j = 0; j < header.length; j++) {
        obj[header[j]] = (r[j] ?? "").trim();
      }

      // 完全空行を除外
      if (Object.values(obj).some((v) => v !== "")) out.push(obj);
    }
    return out;
  }

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
      if (c === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
        continue;
      }
      if (c === "\r") continue;

      field += c;
    }

    row.push(field);
    rows.push(row);
    return rows;
  }
})();