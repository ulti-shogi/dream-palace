// stats.js
// 目的：棋士番号184以降の棋士について
// - 四段昇段平均年齢（平均生年月日→平均四段日 の差）を表示
// - テーブル（順位/棋士名/四段昇段年齢/棋士番号）を表示
// - 並び替え（棋士番号昇順 / 四段昇段年齢の若い順）をヘッダクリックで切替
// - 四段昇段年齢の中央値の行を薄赤で強調

(() => {
  "use strict";

  const CSV_PATH = "profile.csv"; // 配置に合わせて必要なら変更

  // stats.html にある想定のID
  const elAvg = document.getElementById("avg-age");
  const elSummary = document.getElementById("summary");
  const elTbody = document.getElementById("rows");

  // scope：stats.html は name="scope"
  const scopeRadios = Array.from(document.querySelectorAll('input[name="scope"]'));

  // ソート状態
  // mode: "num" | "age"
  let sortMode = "num";

  // 解析済みデータ保持
  let allRows = [];
  let filteredRows = [];
  let medianKey = null; // 中央値の棋士を一意に識別するキー（num|name）

  // ---------- 日付/差分ユーティリティ ----------

  function parseDate(ymd) {
    // ymd: "YYYY-MM-DD"
    if (!ymd || typeof ymd !== "string") return null;
    const m = ymd.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
    const dt = new Date(y, mo - 1, d);
    // 不正日付弾き
    if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
    return dt;
  }

  function fmtYMD(dt) {
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const d = String(dt.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  // end >= start 前提（今回はデータが揃っている想定）
  function diffYMD(start, end) {
    let y = end.getFullYear() - start.getFullYear();
    let m = end.getMonth() - start.getMonth();
    let d = end.getDate() - start.getDate();

    if (d < 0) {
      // 前月末日を借りる
      const prevMonthEnd = new Date(end.getFullYear(), end.getMonth(), 0).getDate();
      d += prevMonthEnd;
      m -= 1;
    }
    if (m < 0) {
      m += 12;
      y -= 1;
    }
    return { y, m, d };
  }

  function ymdToDays(start, end) {
    // 並べ替え用：単純差分（日）
    const ms = end.getTime() - start.getTime();
    return Math.round(ms / 86400000);
  }

  function fmtAgeYMD(age) {
    return `${age.y}歳${age.m}ヶ月${age.d}日`;
  }

  function meanDate(dates) {
    // dates: Date[]
    const sum = dates.reduce((acc, dt) => acc + dt.getTime(), 0);
    return new Date(Math.round(sum / dates.length));
  }

  // ---------- CSV ----------

  function parseCSV(text) {
    // ダブルクオート対応の最小CSVパーサ
    const rows = [];
    let i = 0, field = "", row = [];
    let inQuotes = false;

    while (i < text.length) {
      const c = text[i];

      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i += 2;
            continue;
          } else {
            inQuotes = false;
            i += 1;
            continue;
          }
        } else {
          field += c;
          i += 1;
          continue;
        }
      } else {
        if (c === '"') {
          inQuotes = true;
          i += 1;
          continue;
        }
        if (c === ",") {
          row.push(field);
          field = "";
          i += 1;
          continue;
        }
        if (c === "\n") {
          row.push(field);
          rows.push(row);
          row = [];
          field = "";
          i += 1;
          continue;
        }
        if (c === "\r") {
          i += 1;
          continue;
        }
        field += c;
        i += 1;
      }
    }
    row.push(field);
    rows.push(row);

    const headers = rows.shift().map(h => h.trim());
    return rows
      .filter(r => r.length && r.some(v => String(v).trim() !== ""))
      .map(r => {
        const obj = {};
        headers.forEach((h, idx) => obj[h] = (r[idx] ?? "").trim());
        return obj;
      });
  }

  // profile.csv 側の列名
  // ※あなたの質問への答え：列名が "four-day" なら、"four" では読めません。
  // ここは "four-day" を正として実装します。
  const COL = {
    name: "name",        // 棋士名
    num: "num",          // 棋士番号
    birth: "birth",      // 生年月日
    fourDay: "four-day", // 四段昇段日
  };

  // ---------- 集計＆描画 ----------

  function getScopeValue() {
    // 現在のstats.htmlだと active / num184 の2択が残っているので対応しておく
    const checked = scopeRadios.find(r => r.checked);
    return checked ? checked.value : "active";
  }

  function applyFilter(scopeValue) {
    // あなたの方針：まずは棋士番号184以降だけで進める
    // ただし stats.html にラジオが残っているので、
    // num184 を選んだら184以降、activeは「現役」判定が無いので一旦184以降に寄せる（落ちないため）
    // ※現役判定を後でrules.js参照に戻すならここを差し替えればOK
    if (scopeValue === "num184") {
      filteredRows = allRows.filter(r => r.num >= 184);
    } else {
      // active選択でも今は落とさない（暫定）
      filteredRows = allRows.filter(r => r.num >= 184);
    }
  }

  function computeMedianKeyByAgeYoungest(rows) {
    // 四段昇段年齢が若い順で中央値（行の色付け用）
    const arr = rows.slice().sort((a, b) => a.ageDays - b.ageDays);
    const mid = Math.floor(arr.length / 2);
    const p = arr[mid];
    return p ? `${p.num}|${p.name}` : null;
  }

  function render() {
    const scope = getScopeValue();
    applyFilter(scope);

    // 平均（平均生年月日/平均四段日）
    const meanBirth = meanDate(filteredRows.map(r => r.birthDt));
    const meanFour = meanDate(filteredRows.map(r => r.fourDt));
    const avgAge = diffYMD(meanBirth, meanFour);

    // 中央値キー（色付け）
    medianKey = computeMedianKeyByAgeYoungest(filteredRows);

    // 表示（平均）
    if (elAvg) {
      elAvg.textContent =
        `棋士番号184以降の棋士の四段昇段平均年齢：${fmtAgeYMD(avgAge)}`;
    }

    // 表示条件（1行にasl）
    if (elSummary) {
      elSummary.textContent =
        `対象：棋士番号184以降の棋士 / 対象人数：${filteredRows.length}名 / ` +
        `平均生年月日：${fmtYMD(meanBirth)} / 平均四段昇段日：${fmtYMD(meanFour)} / ` +
        `平均年齢：${fmtAgeYMD(avgAge)} / 中央値（若い順の中央）：${getMedianLabel()} `;
    }

    // テーブルヘッダを「棋士番号」に寄せる（stats.htmlがまだ「備考」なので）
    const ths = Array.from(document.querySelectorAll("table thead th"));
    if (ths[3]) ths[3].textContent = "棋士番号";

    // ヘッダクリックで並べ替え
    // th[2]=四段昇段年齢 / th[3]=棋士番号
    if (ths[2] && !ths[2].dataset.bound) {
      ths[2].dataset.bound = "1";
      ths[2].style.cursor = "pointer";
      ths[2].addEventListener("click", () => {
        sortMode = "age";
        renderTable();
      });
    }
    if (ths[3] && !ths[3].dataset.bound) {
      ths[3].dataset.bound = "1";
      ths[3].style.cursor = "pointer";
      ths[3].addEventListener("click", () => {
        sortMode = "num";
        renderTable();
      });
    }

    renderTable();
  }

  function getMedianLabel() {
    if (!medianKey) return "不明";
    const [numStr, name] = medianKey.split("|");
    const p = filteredRows.find(r => `${r.num}|${r.name}` === medianKey);
    if (!p) return "不明";
    return `${fmtAgeYMD(diffYMD(p.birthDt, p.fourDt))}（${name}）`;
  }

  function renderTable() {
    if (!elTbody) return;

    // 並べ替え
    const arr = filteredRows.slice();
    if (sortMode === "age") {
      arr.sort((a, b) => a.ageDays - b.ageDays);
    } else {
      arr.sort((a, b) => a.num - b.num);
    }

    // tbodyクリア
    elTbody.innerHTML = "";

    // 中央値の薄赤（classなし運用。既存ルールに合わせ、インラインで最小限）
    const medianBg = "#fdeaea";

    arr.forEach((p, idx) => {
      const tr = document.createElement("tr");

      // 中央値行の強調
      const key = `${p.num}|${p.name}`;
      if (key === medianKey) {
        tr.style.background = medianBg;
      }

      const tdRank = document.createElement("td");
      tdRank.textContent = String(idx + 1);

      const tdName = document.createElement("td");
      tdName.textContent = p.name;

      const tdAge = document.createElement("td");
      tdAge.textContent = fmtAgeYMD(diffYMD(p.birthDt, p.fourDt));

      const tdNum = document.createElement("td");
      tdNum.textContent = String(p.num);

      tr.append(tdRank, tdName, tdAge, tdNum);
      elTbody.appendChild(tr);
    });
  }

  // ---------- 初期化 ----------

  async function init() {
    try {
      if (elAvg) elAvg.textContent = "（計算中）";
      if (elSummary) elSummary.textContent = "（計算中）";

      const res = await fetch(CSV_PATH, { cache: "no-store" });
      if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
      const text = await res.text();
      const data = parseCSV(text);

      // 必要カラムを Date化
      allRows = data.map(row => {
        const name = row[COL.name];
        const num = Number(row[COL.num]);
        const birthDt = parseDate(row[COL.birth]);
        const fourDt = parseDate(row[COL.fourDay]);

        if (!name || !Number.isFinite(num) || !birthDt || !fourDt) {
          // 今回は「不明処理不要」の方針なので、欠損は除外（落ちないようにだけする）
          return null;
        }

        return {
          name,
          num,
          birthDt,
          fourDt,
          ageDays: ymdToDays(birthDt, fourDt),
        };
      }).filter(Boolean);

      // ラジオ変更で再描画
      if (scopeRadios.length) {
        scopeRadios.forEach(r => {
          r.addEventListener("change", () => render());
        });
      }

      render();
    } catch (e) {
      console.error(e);
      if (elAvg) elAvg.textContent = "（計算エラー）";
      if (elSummary) elSummary.textContent = "読込エラーが発生しました。コンソールをご確認ください。";
      if (elTbody) {
        elTbody.innerHTML = `<tr><td colspan="4">（エラー）</td></tr>`;
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();