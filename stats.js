/* stats.js
   対象：棋士番号184以降（区分問わず）
   表示：avg-age に「棋士番号184以降の棋士の四段昇段平均年齢」を出す（最小実装）
*/
(() => {
  "use strict";

  const R = window.ProfileRules; // rules.js（ProfileRules）を参照

  // ===== CSV 読み込み =====
  async function fetchText(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`fetch failed: ${res.status} ${url}`);
    return await res.text();
  }

  // profile.js と同系統の軽量CSVパーサ（引用符にも一応対応）
  function csvToRows(csvText) {
    const lines = csvText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    const rows = [];
    for (const line of lines) {
      if (!line) continue;
      const row = [];
      let cur = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (ch === "," && !inQuotes) {
          row.push(cur);
          cur = "";
        } else {
          cur += ch;
        }
      }
      row.push(cur);
      rows.push(row);
    }
    return rows;
  }

  function csvToObjects(csvText) {
    const rows = csvToRows(csvText);
    if (rows.length === 0) return [];
    const headers = rows[0].map((h) => (h ?? "").trim());
    const out = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || r.length === 0) continue;
      const obj = {};
      for (let j = 0; j < headers.length; j++) {
        obj[headers[j]] = (r[j] ?? "").trim();
      }
      out.push(obj);
    }
    return out;
  }

  // ===== 日付ユーティリティ（UTCベースで差分を年/月/日へ） =====
  function toUTCDate(d) {
    return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
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

    const msDay = 24 * 60 * 60 * 1000;
    const days = Math.floor((endUTC.getTime() - cur.getTime()) / msDay);

    return { years, months, days };
  }

  function formatAgeYmd({ years, months, days }) {
    return `${years}歳${months}ヶ月${days}日`;
  }

  function meanDate(dates) {
    let sum = 0;
    for (const d of dates) sum += d.getTime();
    return new Date(Math.round(sum / dates.length));
  }

  // ===== メイン処理 =====
  async function main() {
    if (!R || !R.COL) {
      throw new Error("rules.js（ProfileRules）が見つかりません。stats.htmlで rules.js を先に読み込んでください。");
    }

    const avgEl = document.getElementById("avg-age");
    if (!avgEl) throw new Error("#avg-age が見つかりません（stats.htmlを確認してください）");

    // profile.csv を読む（profile.html と同じ想定）
    const csvText = await fetchText("profile.csv");
    const data = csvToObjects(csvText);

    // 対象：棋士番号184以降
    const targets = data.filter((row) => {
      const n = Number(row[R.COL.num]);
      return Number.isFinite(n) && n >= 184;
    });

    // 生年月日・四段昇段日（不明処理なし：全部ある前提）
    const births = targets.map((row) => R.toDateOrNull(row[R.COL.birthday]));
    const fours  = targets.map((row) => R.toDateOrNull(row[R.COL.four]));

    // nullが混ざると落ちるので、念のため（ただし「不明処理は不要」という方針なのでエラーにする）
    if (births.some((d) => !(d instanceof Date)) || fours.some((d) => !(d instanceof Date))) {
      throw new Error("生年月日または四段昇段日が Date として解釈できないデータが含まれています。CSVの値を確認してください。");
    }

    const avgBirth = meanDate(births);
    const avgFour  = meanDate(fours);

    const startUTC = toUTCDate(avgBirth);
    const endUTC   = toUTCDate(avgFour);

    const ymd = diffYmdUTC(startUTC, endUTC);
    const avgAgeStr = formatAgeYmd(ymd);

    // 表示（id=avg-age に「棋士番号184以降の棋士の四段昇段平均年齢」を表示）
    avgEl.textContent = `棋士番号184以降の棋士の四段昇段平均年齢：${avgAgeStr}`;
  }

  document.addEventListener("DOMContentLoaded", () => {
    main().catch((err) => {
      console.error(err);
      const avgEl = document.getElementById("avg-age");
      if (avgEl) avgEl.textContent = "（未計算）";
    });
  });
})();