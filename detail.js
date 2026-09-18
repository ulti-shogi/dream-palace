let typeMap = {}, abilityMap = {}, moveMap = {}, pokemonMovesMap = {}, typeEff = {};
let targetPokemons = []; 

// --- データベース（IndexedDB）の準備 ---
const DB_NAME = 'MyPokedexDB';
const STORE_NAME = 'customImages';
let db;

function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = (e) => {
            db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
        request.onsuccess = (e) => {
            db = e.target.result;
            resolve();
        };
        request.onerror = (e) => reject(e);
    });
}

function saveImage(key, dataUrl) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put(dataUrl, key);
        tx.oncomplete = () => resolve();
        tx.onerror = (e) => reject(e);
    });
}

function loadImage(key) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = (e) => reject(e);
    });
}
// ------------------------------------

async function initDetail() {
    const urlParams = new URLSearchParams(window.location.search);
    const targetId = urlParams.get('id');
    const targetName = urlParams.get('name'); 

    if (!targetId) return; 

    await initDB(); // 画像保存用DBの起動
    await loadData();
    await loadPokemonData(targetId);
    
    if (targetPokemons.length > 0) {
        document.getElementById('pageTitle').textContent = `No.${targetId} の詳細`;
        
        let initialIndex = 0;
        if (targetName) {
            const foundIndex = targetPokemons.findIndex(p => p.name === targetName);
            if (foundIndex !== -1) initialIndex = foundIndex;
        }

        renderTabs(initialIndex);
        renderDetail(targetPokemons[initialIndex]); 
    } else {
        document.getElementById('pageTitle').textContent = "ポケモンが見つかりません";
    }
}

async function loadData() {
    let res = await fetch('type.txt'); let text = await res.text();
    let lines = text.trim().split('\n');
    let typeIds = lines[0].split(','); let typeNames = lines[1].split(',');
    typeIds.forEach((id, i) => typeMap[id] = typeNames[i]);

    res = await fetch('ability.txt'); text = await res.text();
    text.trim().split('\n').slice(1).forEach(l => { 
        const p = l.split(','); 
        abilityMap[p[0]] = { name: p[1], effect: p[2] || "効果が設定されていません" }; 
    });

    res = await fetch('move.txt'); text = await res.text();
    text.trim().split('\n').slice(1).forEach(l => { const p = l.split(','); if(p.length>=2) moveMap[p[0]] = { name: p[1], type: p[2] }; });

    res = await fetch('pokemon_moves.txt'); text = await res.text();
    text.trim().split('\n').slice(1).forEach(l => { 
        const [num, mid] = l.split(',');
        if(!pokemonMovesMap[num]) pokemonMovesMap[num] = [];
        pokemonMovesMap[num].push(mid);
    });

    res = await fetch('type-effectiveness.txt'); text = await res.text();
    lines = text.trim().split('\n');
    const header = lines[0].split(',').slice(1);
    for(let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',');
        const atkType = parts[0];
        typeEff[atkType] = {};
        for(let j = 1; j < parts.length; j++) {
            typeEff[atkType][header[j-1]] = Number(parts[j]);
        }
    }
}

async function loadPokemonData(targetId) {
    const res = await fetch('pokemon.txt');
    const text = await res.text();
    const lines = text.trim().split('\n');
    
    for (let i = 1; i < lines.length; i++) {
        const [number, name, t1, t2, H, A, B, C, D, S, ab1, ab2, ab3, weight] = lines[i].split(',');
        if (number === targetId) {
            const numH = Number(H), numA = Number(A), numB = Number(B);
            const numC = Number(C), numD = Number(D), numS = Number(S);
            
            targetPokemons.push({
                number, name, t1, t2, 
                H: numH, A: numA, B: numB, C: numC, D: numD, S: numS,
                total: numH + numA + numB + numC + numD + numS,
                ab1: ab1, ab2: ab2, ab3: ab3,
                abName1: ab1 && abilityMap[ab1] ? abilityMap[ab1].name : "",
                abName2: ab2 && abilityMap[ab2] ? abilityMap[ab2].name : "",
                abName3: ab3 && abilityMap[ab3] ? abilityMap[ab3].name : "",
                weight: weight ? Number(weight) : null
            });
        }
    }
}

function renderTabs(activeIndex = 0) {
    const container = document.getElementById('tabsContainer');
    container.innerHTML = ''; 

    targetPokemons.forEach((poke, index) => {
        const btn = document.createElement('button');
        btn.className = `tab-button ${index === activeIndex ? 'active' : ''}`;
        btn.textContent = poke.name; 
        
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
    const imageKey = `${poke.number}_${poke.name}`; // 保存する時のカギ（例: 0003_メガフシギバナ）

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

    let weakList = [];
    let resistList = [];
    
    Object.keys(typeEff).forEach(atkType => {
        let mult = typeEff[atkType][poke.t1];
        if (poke.t2 !== "00") mult *= typeEff[atkType][poke.t2];

        const abs = [poke.abName1, poke.abName2, poke.abName3];
        if (abs.includes("ふゆう") && atkType === "09") mult = 0; 
        if (abs.includes("もらいび") && atkType === "02") mult = 0; 

        if (mult === 4 || mult === 2) {
            weakList.push({ id: atkType, mult: mult });
        } else if (mult === 0 || mult === 0.25 || mult === 0.5) {
            resistList.push({ id: atkType, mult: mult });
        }
    });

    weakList.sort((a, b) => b.mult - a.mult);
    resistList.sort((a, b) => a.mult - b.mult);

    const createEffHtml = (list) => {
        if (list.length === 0) return `<div class="eff-item" style="color:#888; font-size:0.9rem;">なし</div>`;
        return list.map(item => {
            let displayMult = item.mult;
            if (item.mult === 0.5) displayMult = "1/2";
            if (item.mult === 0.25) displayMult = "1/4";
            
            return `
                <div class="eff-item">
                    <span class="type-badge type-${item.id}">${typeMap[item.id]}</span>
                    <span class="eff-mult">×${displayMult}</span>
                </div>
            `;
        }).join("");
    };

    let effTableHtml = `
        <div class="eff-table">
            <div class="eff-col eff-weak">
                <div class="eff-header">弱点</div>
                <div class="eff-list">${createEffHtml(weakList)}</div>
            </div>
            <div class="eff-col eff-resist">
                <div class="eff-header">耐性</div>
                <div class="eff-list">${createEffHtml(resistList)}</div>
            </div>
        </div>
    `;

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

    const calc = (s) => ({
        tokka: Math.floor((s + 52) * 1.1),
        j32: s + 52,
        mu: s + 20,
        kako: Math.floor((s + 20) * 0.9)
    });
    const rA = calc(poke.A), rB = calc(poke.B), rC = calc(poke.C), rD = calc(poke.D), rS = calc(poke.S);
    const rH_max = poke.H + 107; 
    const rH_min = poke.H + 75;  

    const realStatsTableHtml = `
        <table class="real-stats-table">
            <thead>
                <tr><th></th><th>特化</th><th>32振</th><th>無振</th><th>下降</th></tr>
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

    let movesHtml = "";
    const moveIds = pokemonMovesMap[poke.number] || [];
    moveIds.forEach(id => {
        const move = moveMap[id];
        if(move) {
            const typeClass = move.type ? `type-${move.type}` : 'move-default';
            movesHtml += `<span class="move-badge ${typeClass}">${move.name}</span>`;
        }
    });

    const abIds = [poke.ab1, poke.ab2, poke.ab3].filter(Boolean);
    const uniqueAbIds = [...new Set(abIds)]; 
    
    let abilitiesHtml = `<div class="ability-list">`;
    uniqueAbIds.forEach(id => {
        const ab = abilityMap[id];
        if(ab) {
            abilitiesHtml += `
                <div class="ability-card">
                    <div class="ability-name-badge">${ab.name}</div>
                    <p class="ability-effect">${ab.effect}</p>
                </div>
            `;
        }
    });
    abilitiesHtml += `</div>`;

    // --- HTMLを合体 ---
    content.innerHTML = `
        <div class="detail-section">
            <h2 class="section-title">思い出のシーン</h2>
            <div class="custom-image-container">
                <img id="customPokeImg" style="display: none;" />
                <div class="upload-btn-wrapper">
                    <label for="imgUpload" class="upload-btn">📷 画像を選択</label>
                    <input type="file" id="imgUpload" accept="image/*" style="display: none;" />
                </div>
            </div>
        </div>

        <div class="detail-section">
            <h2 class="section-title">タイプ</h2>
            <div class="types">
                <span class="type-badge type-${poke.t1}">${typeMap[poke.t1]}</span>
                ${poke.t2 !== "00" ? `<span class="type-badge type-${poke.t2}">${typeMap[poke.t2]}</span>` : ""}
            </div>
        </div>

        <div class="detail-section">
            <h2 class="section-title">とくせい</h2>
            ${abilitiesHtml}
        </div>

        <div class="detail-section">
            <h2 class="section-title">タイプ相性（弱点・耐性）</h2>
            ${effTableHtml}
            <p style="font-size: 0.75rem; color: #888; margin-top: 8px;">※特性（ふゆう等）を考慮した結果です</p>
        </div>

        <div class="detail-section">
            <h2 class="section-title">種族値</h2>
            ${baseStatsHtml}
        </div>

        <div class="detail-section">
            <h2 class="section-title">実数値</h2>
            ${realStatsTableHtml}
        </div>

        <div class="detail-section">
            <h2 class="section-title">おもさ</h2>
            <p style="font-size: 1.05rem; font-weight: bold; color: #333;">
                ${weightText} <span style="font-size: 0.9rem; color: #666; font-weight: normal;">(けたぐり威力: ${lowKickPower})</span>
            </p>
        </div>

        <div class="detail-section">
            <h2 class="section-title">覚える技</h2>
            <div class="moves-list">${movesHtml || "技データがありません"}</div>
        </div>
    `;

    // ▼▼ 追加：画像処理のイベント（HTMLが作られた直後に実行する） ▼▼
    
    // 1. 保存されている画像があれば読み込んで表示する
    loadImage(imageKey).then(dataUrl => {
        if (dataUrl) {
            const imgEl = document.getElementById('customPokeImg');
            imgEl.src = dataUrl;
            imgEl.style.display = 'block';
        }
    });

    // 2. アップロードボタン（📷 画像を選択）が押された時の処理
    document.getElementById('imgUpload').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(evt) {
            const dataUrl = evt.target.result;
            const imgEl = document.getElementById('customPokeImg');
            
            // 画面に画像を表示
            imgEl.src = dataUrl;
            imgEl.style.display = 'block';
            
            // データベース（スマホ内）に画像を保存
            saveImage(imageKey, dataUrl);
        };
        // 画像をデータに変換
        reader.readAsDataURL(file);
    });
}

initDetail();