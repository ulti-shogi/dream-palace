/* rules.js
   将棋の殿堂：プロフィール検索用ルール集（段位・席次）

   使い方（profile.html）：
     <script src="rules.js" defer></script>
     <script src="profile.js?v=20260107" defer></script>

   profile.js 側は ProfileRules を参照して使う想定。
   例：
     const dan = ProfileRules.deriveDan(row);
     const seat = ProfileRules.deriveSeat(row, dan, name, num);
     records.sort(ProfileRules.compareSeat);

   ※このファイルは「仕様（憲法）」なので最後に freeze して上書き不能にします。
*/

(() => {
  "use strict";

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

  // タイトル保持者（席次最上位）。この順番のまま上位として扱う。
  const TITLE_HOLDERS = [
    "藤井聡太",
    "伊藤匠",
    "谷川浩司",
    "羽生善治",
    "佐藤康光",
    "森内俊之",
    "渡辺明",
  ];

  const TITLE_RANK = new Map(TITLE_HOLDERS.map((n, i) => [n, i])); // 0..6

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

  function danToRank(dan) {
    switch (dan) {
      case "九段": return 9;
      case "八段": return 8;
      case "七段": return 7;
      case "六段": return 6;
      case "五段": return 5;
      case "四段": return 4;
      default: return 0;
    }
  }

  function danToPromoteCol(dan) {
    switch (dan) {
      case "九段": return COL.nine;
      case "八段": return COL.eight;
      case "七段": return COL.seven;
      case "六段": return COL.six;
      case "五段": return COL.five;
      case "四段": return COL.four;
      default: return null;
    }
  }

  // ===== 席次 =====
  // num: Number（棋士番号）。不明なら NaN のまま渡してOK
  function deriveSeat(row, dan, name, num) {
    // タイトル保持者は最上位（指定順）
    const tr = TITLE_RANK.has(name) ? TITLE_RANK.get(name) : null;

    const dr = danToRank(dan);

    // 同段位内：その段位への昇段日が早いほど上位
    const col = danToPromoteCol(dan);
    const dateStr = col ? (row[col] || "").trim() : "";
    const dateObj = toDateOrNull(dateStr);

    // 空欄（または不正）は末尾へ
    const missing = !dateObj;

    return {
      titleRank: tr,            // 0..6 or null
      danRank: dr,              // 9..0
      danPromoteDate: dateObj,  // Date or null
      dateMissing: missing,     // true/false
      // 空欄グループ内は「棋士番号の小さい順」
      numForMissing: Number.isFinite(num) ? num : Number.MAX_SAFE_INTEGER,
    };
  }

  // compareSeat(a,b) の前提：
  // a,b は { num: Number|null, seat: deriveSeat(...) } を持つレコード
  function compareSeat(a, b) {
    // 1) タイトル保持者（指定順）
    const at = a.seat?.titleRank;
    const bt = b.seat?.titleRank;
    const aIsT = at !== null && at !== undefined;
    const bIsT = bt !== null && bt !== undefined;
    if (aIsT && bIsT) return at - bt;
    if (aIsT) return -1;
    if (bIsT) return 1;

    // 2) 昇段日が空欄の人はまとめて末尾（内部は棋士番号が小さい順）
    const am = !!a.seat?.dateMissing;
    const bm = !!b.seat?.dateMissing;
    if (am && bm) return (a.seat.numForMissing ?? Number.MAX_SAFE_INTEGER) - (b.seat.numForMissing ?? Number.MAX_SAFE_INTEGER);
    if (am) return 1;
    if (bm) return -1;

    // 3) 段位が高いほど上位（降順）
    const adr = a.seat?.danRank ?? 0;
    const bdr = b.seat?.danRank ?? 0;
    if (adr !== bdr) return bdr - adr;

    // 4) 同段位なら、その段位への昇段日が早いほど上位（昇順）
    const ad = a.seat.danPromoteDate.getTime();
    const bd = b.seat.danPromoteDate.getTime();
    if (ad !== bd) return ad - bd;

    // 5) 安定化：棋士番号が小さい順
    const an = a.num ?? Number.MAX_SAFE_INTEGER;
    const bn = b.num ?? Number.MAX_SAFE_INTEGER;
    return an - bn;
  }

  // ===== 公開（名前空間） =====
  const ProfileRules = {
    COL,

    TITLE_HOLDERS,

    toDateOrNull,
    classify,

    deriveDan,
    danToRank,
    danToPromoteCol,

    deriveSeat,
    compareSeat,
  };

  // グローバルに公開
  window.ProfileRules = ProfileRules;

  // ===== 上書き防止 =====
  // 1) ProfileRules 自体を凍結
  // 2) 配列も凍結（タイトル保持者リストの改変を防ぐ）
  // 3) COL も凍結
  Object.freeze(ProfileRules.TITLE_HOLDERS);
  Object.freeze(ProfileRules.COL);
  Object.freeze(ProfileRules);

  // 既に window.ProfileRules を張り替えられないようにする（可能な範囲で）
  try {
    Object.defineProperty(window, "ProfileRules", {
      value: ProfileRules,
      writable: false,
      configurable: false,
      enumerable: true,
    });
  } catch (_) {
    // defineProperty が失敗しても freeze 済みなので致命的ではありません
  }
})();