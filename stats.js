// stats.js（丸ごと置き換え）
// 対象：棋士番号184以降の棋士
// テーブル：順位 / 棋士名 / 四段昇段年齢 / 棋士番号
// 並び替え：棋士番号が小さい順 / 四段昇段年齢が若い順（ヘッダクリックで切替）
// 中央値：四段昇段年齢の「若い順」で真ん中の棋士をハイライト

document.addEventListener("DOMContentLoaded", init);

const CSV_URL = "profile.csv"; // stats.html と同じ階層にある想定

let allRows = [];      // 対象データ（棋士番号184以降）
let viewRows = [];     // 表示順（ソート反映）
let medianNum = null;  // 中央値の棋士番号（ハイライト用）

let sortKey = "num";   // "num" or "fourAge"
let sortDir = "asc";   // "asc" or "desc"（基本はascのみ運用でもOK）

function init() {
  loadAndRender().catch((err) => {
    console.error(err);
    setText("avg-age", "（計算エラー）");
    setText("summary", "読込エラーが発生しました。コンソールをご確認ください。");
  });
}

async function loadAndRender() {
  const csvText = await fetchText(CSV_URL);
  const data = csvToObjects(csvText);

  // 棋士番号184以降で絞る
  allRows = data
    .map(normalizeRow)
    .filter((r) => Number.isFinite(r.num) && r.num >= 184);

  // 中央値（四段昇段年齢の若い順で真ん中）
  const byAge = [...allRows].sort((a, b) => a.fourAgeDays - b.fourAgeDays);
  const midIndex = Math.floor((byAge.length - 1) / 2);
  medianNum = byAge[midIndex]?.num ?? null;

  // まずは平均年齢（あなたの方式：平均生年月日と平均四段昇段日の差）
  renderAverageAge(allRows);

  // ソート初期：棋士番号が小さい順
  applySortAndRenderTable();

  // ヘッダクリックでソート切替（HTML側を増やさずに実現）
  setupHeaderSort();
}

function setupHeaderSort() {
  const table = document.querySelector("table");
  if (!table) return;

  const ths = table.querySelectorAll("thead th");
  if (!ths || ths.length < 4) return;

  // 期待する見出しに合わせて（既に修正済みならそのままでもOK）
  ths[0].textContent = "順位";
  ths[1].textContent = "棋士名";
  ths[2].textContent = "四段昇段年齢";
  ths[3].textContent = "棋士番号";

  // クリックできるのは 2列目(四段昇段年齢) と 3列目(棋士番号)
  ths[2].style.cursor = "pointer";
  ths[3].style.cursor = "pointer";

  ths[2].addEventListener("click", () => {
    // 四段昇段年齢：若い順（asc）を基本。連打で昇降切替も可能にしておく
    if (sortKey === "fourAge") sortDir = (sortDir === "asc" ? "desc" : "asc");
    sortKey = "fourAge";
    applySortAndRenderTable();
  });

  ths[3].addEventListener("click", () => {
    if (sortKey === "num") sortDir = (sortDir === "asc" ? "desc" : "asc");
    sortKey = "num";
    applySortAndRenderTable();
  });
}

function applySortAndRenderTable() {
  viewRows = [...allRows];

  if (sortKey === "num") {
    viewRows.sort((a, b) => (a.num - b.num) * (sortDir === "asc" ? 1 : -1));
  } else if (sortKey === "fourAge") {
    viewRows.sort((a, b) => (a.fourAgeDays - b.fourAgeDays) * (sortDir === "asc" ? 1 : -1));
  }

  renderSummary();
  renderTable(viewRows);
}

function renderAverageAge(rows) {
  // 平均生年月日・平均四段昇段日を出して、その差を年/月/日にする
  const birthMsAvg = avgMs(rows.map(r => r.birthDate.getTime()));
  const fourMsAvg  = avgMs(rows.map(r => r.fourDate.getTime()));

  const birthAvg = new Date(birthMsAvg);
  const fourAvg  = new Date(fourMsAvg);

  const ymd = diffYMD(birthAvg, fourAvg);
  const text = `棋士番号184以降の棋士の四段昇段平均年齢：${ymd.y}歳${ymd.m}ヶ月${ymd.d}日`;

  setText("avg-age", text);
}

function renderSummary() {
  // #summary が stats.html にある前提
  const sortLabel =
    sortKey === "num"
      ? `棋士番号の${sortDir === "asc" ? "小さい順" : "大きい順"}`
      : `四段昇段年齢の${sortDir === "asc" ? "若い順" : "年長順"}`;

  const n = allRows.length;
  const mid = medianNum != null ? viewRows.find(r => r.num === medianNum) : null;
  const medianText = mid
    ? `中央値（四段昇段年齢の若い順で真ん中）：${mid.name}（${mid.fourAgeText}）`
    : "中央値：不明";

  setText(
    "summary",
    `対象：棋士番号184以降 / 人数：${n}名 / 並び替え：${sortLabel} / ${medianText}`
  );
}

function renderTable(rows) {
  const tbody = document.getElementById("rows");
  if (!tbody) return;

  tbody.innerHTML = "";

  rows.forEach((r, idx) => {
    const tr = document.createElement("tr");

    // 中央値の棋士（固定：年齢若い順での中央値）を薄赤に
    if (medianNum != null && r.num === medianNum) {
      tr.style.backgroundColor = "#ffecec";
    }

    tr.appendChild(td(String(idx + 1)));         // 順位
    tr.appendChild(td(r.name));                  // 棋士名
    tr.appendChild(td(r.fourAgeText));           // 四段昇段年齢
    tr.appendChild(td(String(r.num)));           // 棋士番号

    tbody.appendChild(tr);
  });
}

function normalizeRow(row) {
  // ここで「列名」を確定させます
  // 必須：num / name / birth / four-day（または four）
  const num = toInt(row["num"] ?? row["no"] ?? row["id"]);
  const name = (row["name"] ?? row["氏名"] ?? "").trim();

  const birthStr = (row["birth"] ?? row["birth-day"] ?? row["birthday"] ?? "").trim();
  const fourStr  = (row["four-day"] ?? row["four"] ?? "").trim();

  const birthDate = parseYMD(birthStr);
  const fourDate  = parseYMD(fourStr);

  // 個別の四段昇段年齢（表示用 + ソート用のday差）
  const ymd = diffYMD(birthDate, fourDate);
  const fourAgeText = `${ymd.y}歳${ymd.m}ヶ月${ymd.d}日`;
  const fourAgeDays = daysBetween(birthDate, fourDate);

  return { num, name, birthDate, fourDate, fourAgeText, fourAgeDays };
}

/* ===== ユーティリティ ===== */

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function td(text) {
  const el = document.createElement("td");
  el.textContent = text;
  return el;
}

async function fetchText(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`fetch failed: ${res.status} ${res.statusText}`);
  return await res.text();
}

function toInt(v) {
  const n = parseInt(String(v ?? "").trim(), 10);
  return Number.isFinite(n) ? n : NaN;
}

function avgMs(list) {
  const sum = list.reduce((a, b) => a + b, 0);
  return sum / list.length;
}

function parseYMD(s) {
  // "YYYY-MM-DD" 前提（UTCで固定）
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) throw new Error(`日付形式が不正です: ${s}`);
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  return new Date(Date.UTC(y, mo - 1, d));
}

function daysBetween(a, b) {
  const ms = b.getTime() - a.getTime();
  return Math.round(ms / 86400000);
}

function diffYMD(start, end) {
  // カレンダー差分（年→月→日）
  let y = end.getUTCFullYear() - start.getUTCFullYear();
  let tmp = addUTCYears(start, y);
  if (tmp > end) {
    y -= 1;
    tmp = addUTCYears(start, y);
  }

  let m = end.getUTCMonth() - tmp.getUTCMonth();
  if (m < 0) m += 12;

  let tmp2 = addUTCMonths(tmp, m);
  if (tmp2 > end) {
    m -= 1;
    tmp2 = addUTCMonths(tmp, m);
  }

  const d = daysBetween(tmp2, end);
  return { y, m, d };
}

function addUTCYears(date, years) {
  return new Date(Date.UTC(date.getUTCFullYear() + years, date.getUTCMonth(), date.getUTCDate()));
}

function addUTCMonths(date, months) {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + months;
  return new Date(Date.UTC(y, m, date.getUTCDate()));
}

/* ===== CSV ===== */

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

function csvToObjects(csvText) {
  const rows = parseCSV(csvText);
  const header = rows[0].map(h => h.trim());
  const out = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length === 0) continue;
    const obj = {};
    header.forEach((h, idx) => {
      obj[h] = (r[idx] ?? "").trim();
    });
    // 空行除外
    const hasAny = Object.values(obj).some(v => v !== "");
    if (hasAny) out.push(obj);
  }
  return out;
}