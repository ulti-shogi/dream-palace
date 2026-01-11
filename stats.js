/* stats.js
   将棋の殿堂：集計（四段昇段平均年齢／中央値）

   前提：
   - rules.js を先に読み込む（defer 推奨）
     <script src="rules.js" defer></script>
     <script src="stats.js" defer></script>

   HTML側想定：
   - ラジオ：name="scope" value="active" / "num184"
   - 平均表示：#avg-age
   - 条件表示：#summary
   - （任意）中央値表示：#median-age（存在すれば更新）
   - テーブル：tbody#rows
*/

(() => {
  "use strict";

  const CSV_PATH = "profile.csv";
  const NUM184_MIN = 184;

  // rules.js の存在チェック
  if (!window.ProfileRules) {
    console.error("ProfileRules が見つかりません。rules.js を stats.js より先に読み込んでください。");
  }
  const R = window.ProfileRules;

  const $ = (sel) => document.querySelector(sel);

  // ---- 日付・CSVユーティリティ ----
  function parseDateYMD(s) {
    const t = (s || "").trim();
    if (!t) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
    if (!m) return null;
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    // ローカル日付として 00:00:00 に固定
    const dt = new Date(y, mo - 1, d);
    dt.setHours(0, 0, 0, 0);
    // Dateが変な丸めをしていないか軽く確認
    if (dt.getFullYear() !== y || dt.getMonth() !== (mo - 1) || dt.getDate() !== d) return null;
    return dt;
  }

  function formatYMD(dt) {
    if (!(dt instanceof Date)) return "—";
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const d = String(dt.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function parseCSV(text) {
    // profile.js と同等の「簡易CSV（ダブルクォート対応）」パーサ
    const rows = [];
    let row = [];
    let cur = "";
    let inQ = false;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];

      if (inQ) {
        if (ch === '"') {
          const next = text[i + 1];
          if (next === '"') {
            cur += '"';
            i++;
          } else {
            inQ = false;
          }
        } else {
          cur += ch;
        }
      } else {
        if (ch === '"') {
          inQ = true;
        } else if (ch === ",") {
          row.push(cur);
          cur = "";
        } else if (ch === "\n") {
          row.push(cur);
          rows.push(row);
          row = [];
          cur = "";
        } else if (ch === "\r") {
          // ignore
        } else {
          cur += ch;
        }
      }
    }

    // last
    row.push(cur);
    rows.push(row);

    // 末尾の空行を落とす（よくある）
    while (rows.length && rows[rows.length - 1].every((c) => String(c || "").trim() === "")) {
      rows.pop();
    }
    return rows;
  }

  function rowsToObjects(rows) {
    if (!rows || rows.length < 2) return [];
    const header = rows[0].map((h) => String(h || "").trim());
    const out = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const obj = {};
      for (let j = 0; j < header.length; j++) {
        obj[header[j]] = (r[j] ?? "").toString();
      }
      out.push(obj);
    }
    return out;
  }

  // ---- 年齢差分（暦） ----
  // profile.js の diffYMD と同種の考え方（年→月→日）
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

      // 2/29 などで日がずれる場合は「その月の末日」に寄せる
      if (next.getDate() !== a.getDate()) {
        const lastDay = new Date(a.getFullYear() + 1, a.getMonth() + 1, 0);
        lastDay.setHours(0, 0, 0, 0);
        if (lastDay.getDate() < a.getDate()) {
          next.setFullYear(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate());
          next.setHours(0, 0, 0, 0);
        }
      }

      if (next.getTime() <= b.getTime()) {
        years++;
        a = next;
      } else {
        break;
      }
    }

    let months = 0;
    while (true) {
      const next = new Date(a.getFullYear(), a.getMonth() + 1, a.getDate());
      next.setHours(0, 0, 0, 0);

      if (next.getDate() !== a.getDate()) {
        const lastDay = new Date(a.getFullYear(), a.getMonth() + 2, 0);
        lastDay.setHours(0, 0, 0, 0);
        if (lastDay.getDate() < a.getDate()) {
          next.setFullYear(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate());
          next.setHours(0, 0, 0, 0);
        }
      }

      if (next.getTime() <= b.getTime()) {
        months++;
        a = next;
      } else {
        break;
      }
    }

    const msPerDay = 24 * 60 * 60 * 1000;
    const days = Math.round((b.getTime() - a.getTime()) / msPerDay);

    return { years, months, days };
  }

  function ymdToAgeString(ymd) {
    if (!ymd) return "不明";
    return `${ymd.years}歳${ymd.months}ヶ月${ymd.days}日`;
  }

  function ageDays(birth, four) {
    if (!(birth instanceof Date) || !(four instanceof Date)) return null;
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.round((four.getTime() - birth.getTime()) / msPerDay);
  }

  // ---- 統計 ----
  function meanDate(dates) {
    if (!dates.length) return null;
    const sum = dates.reduce((acc, d) => acc + d.getTime(), 0);
    const avg = Math.floor(sum / dates.length); // 切り捨て（方針どおり）
    const dt = new Date(avg);
    dt.setHours(0, 0, 0, 0);
    return dt;
  }

  function medianByAge(records) {
    // records: { name, birth, four, ageDays, ageStr, note }
    const valid = records.filter((r) => Number.isFinite(r.ageDays));
    if (!valid.length) return null;

    valid.sort((a, b) => a.ageDays - b.ageDays || (a.num ?? 9e15) - (b.num ?? 9e15));

    const n = valid.length;
    const idx = Math.floor((n - 1) / 2); // A：偶数なら若い方（前）
    return valid[idx];
  }

  // ---- 描画 ----
  function renderTable(records) {
    const tbody = $("#rows");
    if (!tbody) return;

    tbody.innerHTML = "";

    // 表示順：四段昇段年齢が若い順 → 不明は下（棋士番号小さい順）
    const sorted = [...records].sort((a, b) => {
      const aV = Number.isFinite(a.ageDays);
      const bV = Number.isFinite(b.ageDays);
      if (aV && bV) return a.ageDays - b.ageDays || (a.num ?? 9e15) - (b.num ?? 9e15);
      if (aV && !bV) return -1;
      if (!aV && bV) return 1;
      return (a.num ?? 9e15) - (b.num ?? 9e15);
    });

    let i = 0;
    for (const r of sorted) {
      i++;
      const tr = document.createElement("tr");

      const td1 = document.createElement("td");
      td1.textContent = String(i);

      const td2 = document.createElement("td");
      td2.textContent = r.name || "—";

      const td3 = document.createElement("td");
      td3.textContent = r.ageStr || "不明";

      const td4 = document.createElement("td");
      td4.textContent = r.note || "";

      tr.append(td1, td2, td3, td4);
      tbody.appendChild(tr);
    }

    if (!sorted.length) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 4;
      td.textContent = "対象棋士がいません。";
      tr.appendChild(td);
      tbody.appendChild(tr);
    }
  }

  function renderSummary(payload) {
    const avgEl = $("#avg-age");
    if (avgEl) avgEl.textContent = payload.avgAgeStr;

    const medianEl = $("#median-age");
    if (medianEl) medianEl.textContent = payload.medianAgeStr;

    const sumEl = $("#summary");
    if (sumEl) sumEl.textContent = payload.summaryText;
  }

  // ---- メイン処理 ----
  function getScope() {
    const checked = document.querySelector('input[name="scope"]:checked');
    return checked ? checked.value : "active";
  }

  function scopeLabel(scope) {
    if (scope === "num184") return `棋士番号${NUM184_MIN}以降（区分問わず）`;
    return "現役棋士";
  }

  function buildRecords(rows, scope) {
    // 対象集合を作る
    const target = rows.filter((row) => {
      if (scope === "num184") {
        const numRaw = (row[R.COL.num] || "").trim();
        const n = Number(numRaw);
        return Number.isFinite(n) && n >= NUM184_MIN;
      }
      // active
      return R.classify(row) === "現役";
    });

    // レコード整形（テーブル表示と中央値で使う）
    const recs = target.map((row) => {
      const name = (row[R.COL.name] || "").trim();

      const numRaw = (row[R.COL.num] || "").trim();
      const numVal = Number(numRaw);
      const num = Number.isFinite(numVal) ? numVal : null;

      const birth = parseDateYMD(row[R.COL.birthday]);
      const four = parseDateYMD(row[R.COL.fourDay]);

      let note = "";
      if (!birth) note = "生年月日不明";
      if (!four) note = note ? `${note} / 四段日不明` : "四段日不明";

      let ageStr = "不明";
      let days = null;
      if (birth && four) {
        const ymd = diffYMD(birth, four);
        ageStr = ymdToAgeString(ymd);
        days = ageDays(birth, four);
      }

      return { name, num, birth, four, ageStr, ageDays: days, note };
    });

    return { target, recs };
  }

  function computeAverage(target) {
    // 平均生年月日と平均四段昇段日を出すため、有効データを集める
    const births = [];
    const fours = [];
    const both = [];

    for (const row of target) {
      const birth = parseDateYMD(row[R.COL.birthday]);
      const four = parseDateYMD(row[R.COL.fourDay]);

      if (birth) births.push(birth);
      if (four) fours.push(four);
      if (birth && four) both.push({ birth, four });
    }

    // あなたの方式：平均生年月日と平均四段日（どちらも「両方揃っている棋士」基準で計算）
    // ※「173名中、birthdayだけある人」等を混ぜない。ズレを避けるため。
    if (!both.length) return { avgBirth: null, avgFour: null, avgAgeStr: "不明", validN: 0 };

    const avgBirth = meanDate(both.map((x) => x.birth));
    const avgFour = meanDate(both.map((x) => x.four));

    if (!avgBirth || !avgFour) return { avgBirth: null, avgFour: null, avgAgeStr: "不明", validN: both.length };

    const ymd = diffYMD(avgBirth, avgFour);
    const avgAgeStr = ymdToAgeString(ymd);

    return { avgBirth, avgFour, avgAgeStr, validN: both.length };
  }

  function makeSummary({ today, scope, targetCount, validCount, avgBirth, avgFour, avgAgeStr, medianRec, calcableCount }) {
    const parts = [];
    parts.push(`対象：${scopeLabel(scope)}`);
    parts.push(`対象人数：${targetCount}名`);
    parts.push(`集計人数：${validCount}名`);
    if (targetCount !== validCount) parts.push(`除外：${targetCount - validCount}名（生年月日または四段日不明）`);

    parts.push(`平均生年月日：${avgBirth ? formatYMD(avgBirth) : "—"}`);
    parts.push(`平均四段昇段日：${avgFour ? formatYMD(avgFour) : "—"}`);
    parts.push(`平均年齢：${avgAgeStr}`);

    if (medianRec) {
      parts.push(`中央値：${medianRec.ageStr}（${medianRec.name}）`);
      parts.push(`中央値の計算対象：${calcableCount}名`);
    } else {
      parts.push(`中央値：不明`);
    }

    parts.push(`基準日：${formatYMD(today)}`);
    return parts.join(" / ");
  }

  async function load() {
    const res = await fetch(CSV_PATH, { cache: "no-store" });
    if (!res.ok) throw new Error(`CSVの読み込みに失敗: ${res.status}`);
    const text = await res.text();
    const rows = parseCSV(text);
    return rowsToObjects(rows);
  }

  async function update(allRows) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const scope = getScope();
    const { target, recs } = buildRecords(allRows, scope);

    // 平均（平均日付どうしの差）
    const avg = computeAverage(target);

    // 中央値（個人の四段昇段年齢を若い順→真ん中。偶数なら若い方）
    const medianRec = medianByAge(recs);
    const calcableCount = recs.filter((r) => Number.isFinite(r.ageDays)).length;

    // 表示
    renderTable(recs);

    const summaryText = makeSummary({
      today,
      scope,
      targetCount: target.length,
      validCount: avg.validN,
      avgBirth: avg.avgBirth,
      avgFour: avg.avgFour,
      avgAgeStr: avg.avgAgeStr,
      medianRec,
      calcableCount
    });

    // 中央値は section を作らない前提なので summary に出す。
    // もし #median-age が存在すれば、それも更新しておく（互換）
    renderSummary({
      avgAgeStr: avg.avgAgeStr,
      medianAgeStr: medianRec ? medianRec.ageStr : "不明",
      summaryText
    });
  }

  // 起動
  (async () => {
    try {
      const allRows = await load();

      // ラジオ変更で再計算
      document.querySelectorAll('input[name="scope"]').forEach((el) => {
        el.addEventListener("change", () => update(allRows));
      });

      // 初期表示
      await update(allRows);
    } catch (e) {
      console.error(e);
      const sumEl = $("#summary");
      if (sumEl) sumEl.textContent = "データの読み込みに失敗しました";
      const tbody = $("#rows");
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="4">データの読み込みに失敗しました</td></tr>`;
      }
      const avgEl = $("#avg-age");
      if (avgEl) avgEl.textContent = "—";
      const medianEl = $("#median-age");
      if (medianEl) medianEl.textContent = "—";
    }
  })();
})();