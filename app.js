let pokemonList = [];
let typeMap = {};
let abilityMap = {};

async function init() {
    await loadTypeData();
    await loadAbilityData();
    await loadPokemonData();
    setupFilters();
    filterData(); // 最初は全件表示
}

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

async function loadAbilityData() {
    const response = await fetch('ability.txt');
    const text = await response.text();
    const lines = text.trim().split('\n');
    for (let i = 1; i < lines.length; i++) {
        const [id, name] = lines[i].split(',');
        abilityMap[id] = name;
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
        
        // 特性名を事前に取得しておく
        const abName1 = ability_1 ? abilityMap[ability_1] : "";
        const abName2 = ability_2 ? abilityMap[ability_2] : "";
        const abName3 = ability_3 ? abilityMap[ability_3] : "";

        pokemonList.push({
            number, name, type_1, type_2, 
            H: numH, A: numA, B: numB, C: numC, D: numD, S: numS, total,
            abName1, abName2, abName3
        });
    }
}

// カードの描画処理
function renderList(data) {
    const resultsContainer = document.getElementById('results');
    resultsContainer.innerHTML = '';

    data.forEach(poke => {
        let typesHtml = `<span class="type-badge type-${poke.type_1}">${typeMap[poke.type_1]}</span>`;
        if (poke.type_2 !== "00") typesHtml += `<span class="type-badge type-${poke.type_2}">${typeMap[poke.type_2]}</span>`;

        let abilitiesHtml = '';
        // 夢特性と同じ通常特性を持つ場合などの重複を消して表示
        const abs = [poke.abName1, poke.abName2, poke.abName3].filter(Boolean);
        const uniqueAbs = [...new Set(abs)]; 
        uniqueAbs.forEach(ab => {
            abilitiesHtml += `<span class="ability-item">${ab}</span>`;
        });

        // H以外の実数値を計算する関数
        const calcReal = (stat) => {
            return `特化: ${Math.floor((stat + 52) * 1.1)}<br>
                    32振: ${stat + 52}<br>
                    無振: ${stat + 20}<br>
                    下降: ${Math.floor((stat + 20) * 0.9)}`;
        };

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

    // ③ 表示モードの切り替え（bodyのクラスを変えるだけ）
    modeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            document.body.className = `mode-${e.target.value}`;
        });
    });

    // フィルタ・ソート処理を一つにまとめる
    window.filterData = function() {
        const keyword = searchInput.value;
        const selectedType = typeFilter.value;
        const formValue = formFilter.value;
        const sortType = sortFilter.value;

        let filtered = pokemonList.filter(poke => {
            // ① 名前と特性での絞り込み
            const matchName = poke.name.includes(keyword);
            const matchAb = (poke.abName1 && poke.abName1.includes(keyword)) ||
                            (poke.abName2 && poke.abName2.includes(keyword)) ||
                            (poke.abName3 && poke.abName3.includes(keyword));
            const matchKeyword = matchName || matchAb || keyword === "";

            // タイプでの絞り込み
            const matchType = selectedType === "" || poke.type_1 === selectedType || poke.type_2 === selectedType;

            // ⑥ 一般・メガ・全ての表示切り替え
            const isMega = poke.name.includes('メガ');
            let matchForm = true;
            if (formValue === 'normal' && isMega) matchForm = false;
            if (formValue === 'mega' && !isMega) matchForm = false;

            return matchKeyword && matchType && matchForm;
        });

        // ② 各種族値や図鑑番号順での並び替え
        filtered.sort((a, b) => {
            if (sortType === 'number') {
                return Number(a.number) - Number(b.number); // 番号は昇順
            } else {
                // 種族値や合計値の場合は高い順（降順）
                if (b[sortType] !== a[sortType]) {
                    return b[sortType] - a[sortType];
                }
                // もし数値が同じだった場合は、図鑑番号順にする
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