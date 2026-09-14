let typeMap = {}, abilityMap = {}, moveMap = {}, pokemonMovesMap = {}, typeEff = {};
let targetPokemons = []; // URLのIDに一致する全フォルムのデータ

async function initDetail() {
    // URLから "?id=0003" の部分を取得
    const urlParams = new URLSearchParams(window.location.search);
    const targetId = urlParams.get('id');
    if (!targetId) return; // IDが無ければ何もしない

    await loadData();
    await loadPokemonData(targetId);
    
    if (targetPokemons.length > 0) {
        document.getElementById('pageTitle').textContent = `No.${targetId} の詳細`;
        renderTabs();
        renderDetail(targetPokemons[0]); // 最初は一番目のフォルムを表示
    } else {
        document.getElementById('pageTitle').textContent = "ポケモンが見つかりません";
    }
}

// 各種テキストデータの読み込み（app.jsとほぼ同じ＋相性表）
async function loadData() {
    // 1. タイプ
    let res = await fetch('type.txt'); let text = await res.text();
    let lines = text.trim().split('\n');
    let typeIds = lines[0].split(','); let typeNames = lines[1].split(',');
    typeIds.forEach((id, i) => typeMap[id] = typeNames[i]);

    // 2. 特性
    res = await fetch('ability.txt'); text = await res.text();
    text.trim().split('\n').slice(1).forEach(l => { const p = l.split(','); abilityMap[p[0]] = p[1]; });

    // 3. 技
    res = await fetch('move.txt'); text = await res.text();
    text.trim().split('\n').slice(1).forEach(l => { const p = l.split(','); if(p.length>=2) moveMap[p[0]] = { name: p[1], type: p[2] }; });

    // 4. 覚える技（pokemon_moves.txt）
    res = await fetch('pokemon_moves.txt'); text = await res.text();
    text.trim().split('\n').slice(1).forEach(l => { 
        const [num, mid] = l.split(',');
        if(!pokemonMovesMap[num]) pokemonMovesMap[num] = [];
        pokemonMovesMap[num].push(mid);
    });

    // 5. タイプ相性表 (type-effectiveness.txt)
    res = await fetch('type-effectiveness.txt'); text = await res.text();
    lines = text.trim().split('\n');
    const header = lines[0].split(',').slice(1); // 01, 02, 03...
    for(let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',');
        const atkType = parts[0];
        typeEff[atkType] = {};
        for(let j = 1; j < parts.length; j++) {
            typeEff[atkType][header[j-1]] = Number(parts[j]);
        }
    }
}

// 該当するIDのポケモンのみを抽出（重さ weight も取得）
async function loadPokemonData(targetId) {
    const res = await fetch('pokemon.txt');
    const text = await res.text();
    const lines = text.trim().split('\n');
    
    for (let i = 1; i < lines.length; i++) {
        // ※weightを14番目の要素として追加
        const [number, name, t1, t2, H, A, B, C, D, S, ab1, ab2, ab3, weight] = lines[i].split(',');
        if (number === targetId) {
            targetPokemons.push({
                number, name, t1, t2, 
                H: Number(H), A: Number(A), B: Number(B), C: Number(C), D: Number(D), S: Number(S),
                abName1: ab1 ? abilityMap[ab1] : "",
                abName2: ab2 ? abilityMap[ab2] : "",
                abName3: ab3 ? abilityMap[ab3] : "",
                weight: weight ? Number(weight) : null // 重さ
            });
        }
    }
}

// タブの生成
function renderTabs() {
    const container = document.getElementById('tabsContainer');
    targetPokemons.forEach((poke, index) => {
        const btn = document.createElement('button');
        btn.className = `tab-button ${index === 0 ? 'active' : ''}`;
        btn.textContent = poke.name; // 「フシギバナ」「メガフシギバナ」等
        btn.onclick = () => {
            document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderDetail(poke);
        };
        container.appendChild(btn);
    });
}

function renderDetail(poke) {
    const content = document.getElementById('detailContent');

    // --- 1. 基本情報・重さ計算 ---
    let weightText = "不明";
    let lowKickPower = "不明";
    if (poke.weight) {
        weightText = `${poke.weight} kg`;
        if(poke.weight < 10) lowKickPower = 20;
        else if(poke.weight < 25) lowKickPower = 40;
        else if(poke.weight < 50) lowKickPower = 60;
        else if(poke.weight < 100) lowKickPower = 80;
        else if(poke.weight < 200) lowKickPower = 100;
        else lowKickPower = 120;
    }

    // --- 2. タイプ相性の計算（特性考慮） ---
    const effResult = { "4倍": [], "2倍": [], "0.5倍": [], "0.25倍": [], "0倍": [] };
    
    Object.keys(typeEff).forEach(atkType => {
        let mult = typeEff[atkType][poke.t1];
        if (poke.t2 !== "00") mult *= typeEff[atkType][poke.t2];

        // 特性による上書き
        const abs = [poke.abName1, poke.abName2, poke.abName3];
        if (abs.includes("ふゆう") && atkType === "09") mult = 0; 
        if (abs.includes("もらいび") && atkType === "02") mult = 0; 

        if (mult === 4) effResult["4倍"].push(atkType);
        else if (mult === 2) effResult["2倍"].push(atkType);
        else if (mult === 0.5) effResult["0.5倍"].push(atkType);
        else if (mult === 0.25) effResult["0.25倍"].push(atkType);
        else if (mult === 0) effResult["0倍"].push(atkType);
    });

    let effHtml = "";
    Object.keys(effResult).forEach(key => {
        if (effResult[key].length > 0) {
            let badges = effResult[key].map(id => `<span class="type-badge type-${id}">${typeMap[id]}</span>`).join("");
            effHtml += `<div class="eff-group"><div class="eff-label">${key}</div>${badges}</div>`;
        }
    });

    // --- 3. ステータス（種族値と実数値テーブル） ---
    const baseStatsHtml = `
        <div class="stats-grid">
            <div class="stat-item"><div class="stat-label">H</div><div class="base-values">${poke.H}</div></div>
            <div class="stat-item"><div class="stat-label">A</div><div class="base-values">${poke.A}</div></div>
            <div class="stat-item"><div class="stat-label">B</div><div class="base-values">${poke.B}</div></div>
            <div class="stat-item"><div class="stat-label">C</div><div class="base-values">${poke.C}</div></div>
            <div class="stat-item"><div class="stat-label">D</div><div class="base-values">${poke.D}</div></div>
            <div class="stat-item"><div class="stat-label">S</div><div class="base-values">${poke.S}</div></div>
            <div class="stat-item total">種族値合計: ${poke.total}</div>
        </div>
    `;

    // 実数値を計算する補助関数
    const calc = (s) => ({
        tokka: Math.floor((s + 52) * 1.1),
        j32: s + 52,
        mu: s + 20,
        kako: Math.floor((s + 20) * 0.9)
    });
    const rA = calc(poke.A), rB = calc(poke.B), rC = calc(poke.C), rD = calc(poke.D), rS = calc(poke.S);
    const rH_max = poke.H + 107; // HPぶっぱ
    const rH_min = poke.H + 75;  // HP無振り

    const realStatsTableHtml = `
        <table class="real-stats-table">
            <thead>
                <tr>
                    <th></th>
                    <th>特化</th>
                    <th>32振</th>
                    <th>無振</th>
                    <th>下降</th>
                </tr>
            </thead>
            <tbody>
                <tr><th>H</th><td>${rH_max}</td><td>${rH_max}</td><td>${rH_min}</td><td>${rH_min}</td></tr>
                <tr><th>A</th><td>${rA.tokka}</td><td>${rA.j32}</td><td>${rA.mu}</td><td>${rA.kako}</td></tr>
                <tr><th>B</th><td>${rB.tokka}</td><td>${rB.j32}</td><td>${rB.mu}</td><td>${rB.kako}</td></tr>
                <tr><th>C</th><td>${rC.tokka}</td><td>${rC.j32}</td><td>${rC.mu}</td><td>${rC.kako}</td></tr>
                <tr><th>D</th><td>${rD.tokka}</td><td>${rD.j32}</td><td>${rD.mu}</td><td>${rD.kako}</td></tr>
                <tr><th>S</th><td>${rS.tokka}</td><td>${rS.j32}</td><td>${rS.mu}</td><td>${rS.kako}</td></tr>
            </tbody>
        </table>
    `;

    // --- 4. 覚える技 ---
    let movesHtml = "";
    const moveIds = pokemonMovesMap[poke.number] || [];
    moveIds.forEach(id => {
        const move = moveMap[id];
        if(move) {
            const typeClass = move.type ? `type-${move.type}` : 'move-default';
            movesHtml += `<span class="move-badge ${typeClass}">${move.name}</span>`;
        }
    });

    // --- HTMLを合体 ---
    content.innerHTML = `
        <div class="detail-section">
            <h2 class="section-title">基本データ</h2>
            <p><strong>タイプ:</strong> <span class="type-badge type-${poke.t1}">${typeMap[poke.t1]}</span> ${poke.t2 !== "00" ? `<span class="type-badge type-${poke.t2}">${typeMap[poke.t2]}</span>` : ""}</p>
            <p><strong>特性:</strong> ${[poke.abName1, poke.abName2, poke.abName3].filter(Boolean).filter((x, i, a) => a.indexOf(x) === i).join(" / ")}</p>
            <p><strong>重さ:</strong> ${weightText} <span style="font-size: 0.85rem; color: #666;">(けたぐり威力: ${lowKickPower})</span></p>
        </div>

        <div class="detail-section">
            <h2 class="section-title">タイプ相性（弱点・耐性）</h2>
            ${effHtml || "すべて等倍です"}
            <p style="font-size: 0.75rem; color: #888; margin-top: 5px;">※特性（ふゆう等）を考慮した結果です</p>
        </div>

        <div class="detail-section">
            <h2 class="section-title">ステータス</h2>
            <h3 class="sub-title">種族値</h3>
            ${baseStatsHtml}
            
            <h3 class="sub-title" style="margin-top: 15px;">実数値 (Lv50)</h3>
            ${realStatsTableHtml}
        </div>

        <div class="detail-section">
            <h2 class="section-title">覚える技</h2>
            <div class="moves-list">${movesHtml || "技データがありません"}</div>
        </div>
    `;
}
initDetail();