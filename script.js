// 都道府県ごとの最低賃金（令和7年度・時間額・円）
const minWage = {
  "北海道": 1075,
  "青森県": 1029,
  "岩手県": 1031,
  "宮城県": 1038,
  "秋田県": 1031,
  "山形県": 1032,
  "福島県": 1033,
  "茨城県": 1074,
  "栃木県": 1068,
  "群馬県": 1063,
  "埼玉県": 1141,
  "千葉県": 1140,
  "東京都": 1226,
  "神奈川県": 1225,
  "新潟県": 1050,
  "富山県": 1062,
  "石川県": 1054,
  "福井県": 1053,
  "山梨県": 1052,
  "長野県": 1061,
  "岐阜県": 1065,
  "静岡県": 1097,
  "愛知県": 1140,
  "三重県": 1087,
  "滋賀県": 1080,
  "京都府": 1122,
  "大阪府": 1177,
  "兵庫県": 1116,
  "奈良県": 1051,
  "和歌山県": 1045,
  "鳥取県": 1030,
  "島根県": 1033,
  "岡山県": 1047,
  "広島県": 1085,
  "山口県": 1043,
  "徳島県": 1046,
  "香川県": 1036,
  "愛媛県": 1033,
  "高知県": 1023,
  "福岡県": 1057,
  "佐賀県": 1030,
  "長崎県": 1031,
  "熊本県": 1034,
  "大分県": 1035,
  "宮崎県": 1023,
  "鹿児島県": 1026,
  "沖縄県": 1023
};

// 地方 → 都道府県（optgroup用）
const regions = {
  "北海道・東北": ["北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県"],
  "関東": ["茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県"],
  "中部": ["新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県", "静岡県", "愛知県"],
  "近畿": ["三重県", "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県"],
  "中国": ["鳥取県", "島根県", "岡山県", "広島県", "山口県"],
  "四国": ["徳島県", "香川県", "愛媛県", "高知県"],
  "九州・沖縄": ["福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県"]
};

window.addEventListener("DOMContentLoaded", () => {
  const prefSelect = document.getElementById("pref");

  // 既存の<option value="">選択してください</option> は残し、optgroupだけ追加
  // （index.html側で<option>を入れていない場合は、ここで追加してもOK）
  const hasDefault = Array.from(prefSelect.options).some(opt => opt.value === "");
  if (!hasDefault) {
    const defaultOpt = document.createElement("option");
    defaultOpt.value = "";
    defaultOpt.textContent = "選択してください";
    prefSelect.appendChild(defaultOpt);
  }

  // optgroupを追加
  Object.keys(regions).forEach(regionName => {
    const group = document.createElement("optgroup");
    group.label = regionName;

    regions[regionName].forEach(pref => {
      const option = document.createElement("option");
      option.value = pref;
      option.textContent = pref;
      group.appendChild(option);
    });

    prefSelect.appendChild(group);
  });
});

document.getElementById("calcButton").addEventListener("click", () => {
  const pref = document.getElementById("pref").value;
  const myWage = Number(document.getElementById("wage").value);
  const result = document.getElementById("result");

  if (!pref) {
    result.textContent = "都道府県を選択してください。";
    result.style.color = "";
    return;
  }

  if (!myWage || myWage <= 0) {
    result.textContent = "有効な時給を入力してください。";
    result.style.color = "";
    return;
  }

  const base = minWage[pref];
  if (!base) {
    result.textContent = "この都道府県の最低賃金データが見つかりません。";
    result.style.color = "";
    return;
  }

  const diff = myWage - base;
  const percent = (diff / base) * 100;
  const perMinute = myWage / 60;

  if (diff >= 0) {
    result.style.color = "";
    result.textContent =
      `【結果】${pref}の最低賃金${base}円に対して、` +
      `あなたの時給${myWage}円は約${percent.toFixed(2)}％高いです。` +
      `（分給 約${perMinute.toFixed(1)}円）`;
  } else {
    result.style.color = "red";
    result.textContent =
      `【結果】${pref}の最低賃金${base}円に対して、` +
      `あなたの時給${myWage}円は約${Math.abs(percent).toFixed(2)}％低いです。` +
      `（分給 約${perMinute.toFixed(1)}円）`;
  }
});