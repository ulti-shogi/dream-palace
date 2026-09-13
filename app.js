let pokemonList = [];
let typeMap = {};
let abilityMap = {};
let moveMap = {};        // 技IDと技名の辞書
let pokemonMoves = {};   // 図鑑番号と覚える技リストの辞書

async function init() {
    await loadTypeData();
    await loadAbilityData();
    await loadMoveData();       // 技データの読み込み
    await loadPokemonMoves();   // 技の紐付けデータの読み込み
    await loadPokemonData();
    setupFilters();
    filterData(); 
}

// （既存の処理）type.txt の読み込み
async function loadTypeData() {
    const response = await fetch('type.txt');
    const text = await response.text();
    const lines = text.trim().split('\n');
    const ids = lines[0].split(',');
    const names = lines[1].split(',');
    for (let i = 0; i < ids.length; i++) typeMap[ids[i]] = names[i];
    
    const typeFilter = document.getElementById('typeFilter');
    names.forEach((name, index) => {
        const option = document.createElement('option');
        option.value = ids[index];
        option.textContent = name;
        typeFilter.appendChild(option);
    });
}

// （既存の処理）ability.txt の読み込み
async function loadAbilityData() {
    const response = await fetch('ability.txt');
    const text = await response.text();
    const lines = text.trim().split('\n');
    for (let i = 1; i < lines.length; i++) {
        const [id, name] = lines[i].split(',');
        abilityMap[id] = name;
    }
}

// 【新規】move_2.txt を読み込んで技の辞書を作る
async function loadMoveData() {
    const response = await fetch('move_2.txt');
    const text = await response.text();
    const lines = text.trim().split('\n');
    
    // 1行目のヘッダーを飛ばして処理
    for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',');
        if (parts.length >= 2) {
            const id = parts[0];
            const name = parts[1];
            moveMap[id] = name; // IDと技名を紐付け
        }
    }
}

// 【新規】pokemon_moves.txt を読み込んでポケモンに技を紐付ける
async function loadPokemonMoves() {
    const response = await fetch('pokemon_moves.txt');
    const text = await response.text();
    const lines = text.trim().split('\n');
    
    for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',');
        if (parts.length >= 2) {
            const number = parts[0];
            const moveId = parts[1];
            
            // その図鑑番号の配列がまだなければ作る
            if (!pokemonMoves[number]) {
                pokemonMoves[number] = [];
            }
            
            // 技IDを技名に変換して追加
            if (moveMap[moveId]) {
                pokemonMoves[number].push(moveMap[moveId]);
            }
        }
    }
}

async function loadPokemonData() {
    const response = await fetch('pokemon.txt');
    const text = await response.text();
    const lines = text.trim().split('\n');
    
    for (let i = 1; i < lines.length; i++) {
        const [number, name, type_1, type_2, H, A, B, C, D, S, ability_1, ability_2, ability_3] = lines[i].split(',');
        const numH = Number(H), numA = Number(A), numB = Number(B), numC = Number(C), numD = Number(D), numS = Number(S);
        const total = numH + numA + numB + numC + numD + numS;
        
        const abName1 = ability_1 ? abilityMap[ability_1] : "";
        const abName2 = ability_2 ? abilityMap[ability_2] : "";
        const abName3 = ability_3 ? abilityMap[ability_3] : "";

        // このポケモンが覚える技リストを取得（データがない場合は空の配列）
        const moves = pokemonMoves[number] || [];

        pokemonList.push({
            number, name, type_1, type_2, 
            H: numH, A: numA, B: numB, C: numC, D: numD, S: numS, total,
            abName1, abName2, abName3,
            moves // 技データを追加
        });
    }
}

function renderList(data) {
    const resultsContainer = document.getElementById('results');
    resultsContainer.innerHTML = '';

    data.forEach(poke => {
        let typesHtml = `<span class="type-badge type-${poke.type_1}">${typeMap[poke.type_1]}</span>`;
        if (poke.type_2 !== "00") typesHtml += `<span class="type-badge type-${poke.type_2}">${typeMap[poke.type_2]}</span>`;

        let abilitiesHtml = '';
        const abs = [poke.abName1, poke.abName2, poke.abName3].filter(Boolean);
        const uniqueAbs = [...new Set(abs)]; 
        uniqueAbs.forEach(ab => {
            abilitiesHtml += `<span class="ability-item">${ab}</span>`;
        });

        const calcReal = (stat) => {
            return `特化: ${Math.floor((stat + 52) * 1.1)}<br>
                    32振: ${stat + 52}<br>
                    無振: ${stat + 20}<br>
                    下降: ${Math.floor((stat + 20) * 0.9)}`;
        };

        // 【新規】覚える技のHTMLを生成（折りたたみ式）
        let movesHtml = '';
        if (poke.moves && poke.moves.length > 0) {
            const uniqueMoves = [...new Set(poke.moves)]; // 重複を削除
            let moveTags = '';
            uniqueMoves.forEach(move => {
                moveTags += `<span class="move-item">${move}</span>`;
            });
            movesHtml = `
                <details class="moves-details">
                    <summary>覚える技 (${uniqueMoves.length}個)</summary>
                    <div class="moves-list">${moveTags}</div>
                </details>
            `;
        }

        const div = document.createElement('div');
        div.className = 'card';
        div.innerHTML = `
            <div class="card-header">
                <span class="poke-name">${poke.name}</span>
                <span class="poke-number">No.${poke.number}</span>
            </div>
            <div class="types">${typesHtml}</div>
            <div class="abilities">${abilitiesHtml}</div>
            <div class="stats-grid">
                <div class="stat-item">
                    <div class="stat-label">H</div>
                    <div class="base-values">${poke.H}</div>
                    <div class="real-values">ぶっぱ: ${poke.H + 107}<br>無振り: ${poke.H + 75}</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">A</div>
                    <div class="base-values">${poke.A}</div>
                    <div class="real-values">${calcReal(poke.A)}</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">B</div>
                    <div class="base-values">${poke.B}</div>
                    <div class="real-values">${calcReal(poke.B)}</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">C</div>
                    <div class="base-values">${poke.C}</div>
                    <div class="real-values">${calcReal(poke.C)}</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">D</div>
                    <div class="base-values">${poke.D}</div>
                    <div class="real-values">${calcReal(poke.D)}</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">S</div>
                    <div class="base-values">${poke.S}</div>
                    <div class="real-values">${calcReal(poke.S)}</div>
                </div>
                <div class="stat-item total">
                    種族値合計: ${poke.total}
                </div>
            </div>
            ${movesHtml} <!-- ここに技一覧を追加 -->
        `;
        resultsContainer.appendChild(div);
    });
}

function setupFilters() {
    const searchInput = document.getElementById('searchInput');
    const typeFilter = document.getElementById('typeFilter');
    const formFilter = document.getElementById('formFilter');
    const sortFilter = document.getElementById('sortFilter');
    const modeRadios = document.querySelectorAll('input[name="dispMode"]');

    modeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            document.body.className = `mode-${e.target.value}`;
        });
    });

    window.filterData = function() {
        const keyword = searchInput.value;
        const selectedType = typeFilter.value;
        const formValue = formFilter.value;
        const sortType = sortFilter.value;

        let filtered = pokemonList.filter(poke => {
            const matchName = poke.name.includes(keyword);
            const matchAb = (poke.abName1 && poke.abName1.includes(keyword)) ||
                            (poke.abName2 && poke.abName2.includes(keyword)) ||
                            (poke.abName3 && poke.abName3.includes(keyword));
                            
            // 【新規】技の中にキーワードが含まれているかチェック
            const matchMove = poke.moves && poke.moves.some(move => move.includes(keyword));
            
            // 名前、特性、技のどれかに一致すればOK
            const matchKeyword = matchName || matchAb || matchMove || keyword === "";

            const matchType = selectedType === "" || poke.type_1 === selectedType || poke.type_2 === selectedType;

            const isMega = poke.name.includes('メガ');
            let matchForm = true;
            if (formValue === 'normal' && isMega) matchForm = false;
            if (formValue === 'mega' && !isMega) matchForm = false;

            return matchKeyword && matchType && matchForm;
        });

        filtered.sort((a, b) => {
            if (sortType === 'number') {
                return Number(a.number) - Number(b.number);
            } else {
                if (b[sortType] !== a[sortType]) {
                    return b[sortType] - a[sortType];
                }
                return Number(a.number) - Number(b.number);
            }
        });

        renderList(filtered);
    };

    searchInput.addEventListener('input', window.filterData);
    typeFilter.addEventListener('change', window.filterData);
    formFilter.addEventListener('change', window.filterData);
    sortFilter.addEventListener('change', window.filterData);
}

init();