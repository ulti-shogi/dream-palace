// average.js
// profile.csv を読み込み、棋士番号184以降の四段昇段平均年齢（平均日付方式）と一覧を表示します。

document.addEventListener("DOMContentLoaded", () => {
  main().catch((err) => {
    console.error(err);
    const avgEl = document.getElementById("avg-age");
    const rowsEl = document.getElementById("rows");
    if (avgEl) avgEl.textContent = "（エラー）";
    if (rowsEl) rowsEl.innerHTML = `<tr><td colspan="4">（エラー）</td></tr>`;
  });
});

async function main() {
  const avgEl = document.getElementById("avg-age");
  const rowsEl = document.getElementById("rows");
  if (!avgEl || !rowsEl) return;

  // CSV読み込み
  const res = await fetch("profile.csv", { cache: "no-store" });
  if (!res.ok) throw new Error(`profile.csv の読み込みに失敗しました: ${res.status}`);
  const csvText = await res.text();

  const records = parseCsvToObjects(csvText);

  // 対象：棋士番号184以降（birthday と four-day は全て埋まっている前提）
      const targets = records
    .filter((r) => Number(r["num"]) >= 184)
    .map((r) => {
      const birthday = parseYmd(r["birthday"]);
      const fourDay = parseYmd(r["four-day"]);
      return {
        num: Number(r["num"]),
        name: r["name"],
        birthday,
        fourDay,
        // 並べ替え用（年齢を日数で比較）
        ageDays: ymdToDayCount(fourDay) - ymdToDayCount(birthday),
      };
    });

  // 平均日付方式：
  // 1) birthday の平均日付 2) four-day の平均日付 3) その差を◯年◯ヶ月◯日で表示
  const avgBirthdayDay = averageDayCount(targets.map((t) => ymdToDayCount(t.birthday)));
  const avgFourDayDay = averageDayCount(targets.map((t) => ymdToDayCount(t.fourDay)));
  const avgBirthday = dayCountToYmd(avgBirthdayDay);
  const avgFourDay = dayCountToYmd(avgFourDayDay);
  const avgDiff = diffYmd(avgBirthday, avgFourDay);

  avgEl.textContent = formatYmdDiff(avgDiff);

  // テーブル表示（順位・棋士名・四段昇段年齢・棋士番号）
    // 並べ替えUI
  const sortKeyEl = document.getElementById("sort-key");
  const sortDirEls = document.querySelectorAll('input[name="sort-dir"]');

  if (sortKeyEl) sortKeyEl.addEventListener("change", applySortAndRender);
  sortDirEls.forEach((el) => el.addEventListener("change", applySortAndRender));

  // 初期表示
  applySortAndRender();

  function applySortAndRender() {
    const key = sortKeyEl ? sortKeyEl.value : "num";
    const dir = (() => {
      const checked = document.querySelector('input[name="sort-dir"]:checked');
      return checked ? checked.value : "asc";
    })();

    const sign = dir === "desc" ? -1 : 1;

    const sorted = [...targets].sort((a, b) => {
      let cmp = 0;

      if (key === "age") {
        cmp = a.ageDays - b.ageDays;
        // 同値なら棋士番号で安定化
        if (cmp === 0) cmp = a.num - b.num;
      } else {
        // key === "num"
        cmp = a.num - b.num;
      }

      return cmp * sign;
    });

    renderRows(sorted);
  }

  function renderRows(list) {
    const html = list
      .map((t, idx) => {
        const age = diffYmd(t.birthday, t.fourDay);
        return (
          `<tr>` +
          `<td>${idx + 1}</td>` +
          `<td>${escapeHtml(t.name)}</td>` +
          `<td>${formatYmdDiff(age)}</td>` +
          `<td>${t.num}</td>` +
          `</tr>`
        );
      })
      .join("");

    rowsEl.innerHTML = html || `<tr><td colspan="4">（対象者なし）</td></tr>`;
    } // renderRows 終了

} // ←これを追加：main() を閉じる

/* -----------------------------
   日付・平均・差分（UTC基準）
----------------------------- */

// "YYYY-MM-DD" -> {y,m,d}
function parseYmd(s) {
  // 欠損処理は不要（前提）だが、念のため空文字はエラーにして原因を出します
  if (typeof s !== "string" || !s.trim()) throw new Error("日付が空です");
  const [y, m, d] = s.split("-").map((v) => Number(v));
  return { y, m, d };
}

// {y,m,d} -> UTC日数（1970-01-01 を 0 とする）
function ymdToDayCount(ymd) {
  const ms = Date.UTC(ymd.y, ymd.m - 1, ymd.d);
  return Math.floor(ms / 86400000);
}

// UTC日数 -> {y,m,d}
function dayCountToYmd(dayCount) {
  const dt = new Date(dayCount * 86400000);
  return {
    y: dt.getUTCFullYear(),
    m: dt.getUTCMonth() + 1,
    d: dt.getUTCDate(),
  };
}

// 日数配列の平均（平均日付は「四捨五入」）
function averageDayCount(dayCounts) {
  let sum = 0;
  for (const dc of dayCounts) sum += dc;
  return Math.round(sum / dayCounts.length);
}

// start{y,m,d} -> end{y,m,d} の差分を {years, months, days} で返す
// （テーブル用・平均用とも同じ関数でOK）
function diffYmd(start, end) {
  let years = end.y - start.y;
  let months = end.m - start.m;
  let days = end.d - start.d;

  // 日がマイナスなら、end の前月の日数を借りる
  if (days < 0) {
    const prev = prevMonth(end.y, end.m);
    days += daysInMonth(prev.y, prev.m);
    months -= 1;
  }

  // 月がマイナスなら、年から借りる
  if (months < 0) {
    months += 12;
    years -= 1;
  }

  return { years, months, days };
}

function prevMonth(y, m) {
  if (m === 1) return { y: y - 1, m: 12 };
  return { y, m: m - 1 };
}

function daysInMonth(y, m) {
  // m: 1..12
  // JS Date: 月は0..11。翌月0日=当月末日
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function formatYmdDiff(diff) {
  return `${diff.years}年${diff.months}ヶ月${diff.days}日`;
}

/* -----------------------------
   CSV パーサ（ダブルクォート対応）
----------------------------- */

function parseCsvToObjects(text) {
  const rows = parseCsv(text);
  if (rows.length === 0) return [];

  const header = rows[0].map((h) => (h ?? "").trim());
  const out = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length === 1 && (row[0] ?? "").trim() === "") continue;

    const obj = {};
    for (let c = 0; c < header.length; c++) {
      obj[header[c]] = (row[c] ?? "").trim();
    }
    out.push(obj);
  }
  return out;
}

// 1行ずつ・クォート処理あり
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        const next = text[i + 1];
        if (next === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === ",") {
      row.push(field);
      field = "";
      continue;
    }

    if (ch === "\r") continue;

    if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }

    field += ch;
  }

  // 最終フィールド
  row.push(field);
  rows.push(row);

  return rows;
}

/* -----------------------------
   HTMLエスケープ
----------------------------- */

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
