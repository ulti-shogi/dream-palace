let pokemonList = [];
let typeMap = {};
let abilityMap = {};
let moveMap = {};           // 技データ用
let pokemonMovesMap = {};   // どのポケモンがどの技を覚えるか用

async function init() {
    await loadTypeData();
    await loadAbilityData();
    await loadMoveData();         // 追加：技データの読み込み
    await loadPokemonMovesData(); // 追加：紐付けデータの読み込み
    await loadPokemonData();
    setupFilters();
    filterData();
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

// 技データを読み込む（追加）
async function loadMoveData() {
    const response = await fetch('move.txt');
    const text = await response.text();
    const lines = text.trim().split('\n');
    for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',');
        if (parts.length >= 2) {
            const id = parts[0];
            const name = parts[1];
            const type = parts[2]; // タイプ情報（空欄でもOK）
            moveMap[id] = { name, type };
        }
    }
}

// ポケモンと技の紐付けデータを読み込む（追加）
async function loadPokemonMovesData() {
    const response = await fetch('pokemon_moves.txt');
    const text = await response.text();
    const lines = text.trim().split('\n');
    for (let i = 1; i < lines.length; i++) {
        const [number, move_id] = lines[i].split(',');
        if (!pokemonMovesMap[number]) {
            pokemonMovesMap[number] = [];
        }
        pokemonMovesMap[number].push(move_id);
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

        pokemonList.push({
            number, name, type_1, type_2, 
            H: numH, A: numA, B: numB, C: numC, D: numD, S: numS, total,
            abName1, abName2, abName3
        });
    }
}

// ▼引数に sortType（何順で並び替えているか）を追加
// ▼▼ app.js の renderList 関数の中身を一部変更 ▼▼

function renderList(data, sortType) {
    const resultsContainer = document.getElementById('results');
    resultsContainer.innerHTML = '';

    data.forEach(poke => {
        let typesHtml = `<span class="type-badge type-${poke.type_1}">${typeMap[poke.type_1]}</span>`;
        if (poke.type_2 !== "00") typesHtml += `<span class="type-badge type-${poke.type_2}">${typeMap[poke.type_2]}</span>`;

        // ▼▼ 変更箇所：バッジを作る処理をやめて、スラッシュ区切りのテキストにする ▼▼
        const abs = [poke.abName1, poke.abName2, poke.abName3].filter(Boolean);
        const uniqueAbs = [...new Set(abs)]; 
        const abilitiesHtml = uniqueAbs.join(' / '); // 例: "しんりょく / ようりょくそ"

        const hl = (type) => sortType === type ? 'class="highlight-active"' : '';
        const numClass = sortType === 'number' ? 'highlight-active' : '';

       // ▼▼ app.js の renderList 内、aタグのhref部分を修正 ▼▼
        const div = document.createElement('div');
        div.className = 'card';
        // 変更箇所：URLの末尾に「&name=ポケモン名」を追加
        div.innerHTML = `
            <a href="detail.html?id=${poke.number}&name=${encodeURIComponent(poke.name)}" class="card-link">
                <div class="card-header">
                    <span class="poke-name">${poke.name}</span>
                    <span class="poke-number ${numClass}">No.${poke.number}</span>
                </div>
                <div class="types">${typesHtml}</div>
                <div class="abilities-text">${abilitiesHtml}</div>
                <div class="compact-stats">
                    <span ${hl('H')}>${poke.H}</span>-<span ${hl('A')}>${poke.A}</span>-<span ${hl('B')}>${poke.B}</span>-<span ${hl('C')}>${poke.C}</span>-<span ${hl('D')}>${poke.D}</span>-<span ${hl('S')}>${poke.S}</span>-<span ${hl('total')}>${poke.total}</span>
                </div>
            </a>
        `;
        resultsContainer.appendChild(div);
    });
}

function setupFilters() {
    const searchInput = document.getElementById('searchInput');
    const typeFilter = document.getElementById('typeFilter');
    const formFilter = document.getElementById('formFilter');
    const sortFilter = document.getElementById('sortFilter');

    window.filterData = function() {
        const keyword = searchInput.value;
        const selectedType = typeFilter.value;
        const formValue = formFilter.value;
        const sortType = sortFilter.value; // 今何順かを取得

        let filtered = pokemonList.filter(poke => {
            const matchName = poke.name.includes(keyword);
            const matchAb = (poke.abName1 && poke.abName1.includes(keyword)) ||
                            (poke.abName2 && poke.abName2.includes(keyword)) ||
                            (poke.abName3 && poke.abName3.includes(keyword));
            
            const moveIds = pokemonMovesMap[poke.number] || [];
            const matchMove = moveIds.some(id => {
                const move = moveMap[id];
                return move && move.name.includes(keyword);
            });

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

        // ▼renderListに「いま何順で並び替えているか（sortType）」を渡す
        renderList(filtered, sortType);
    };

    searchInput.addEventListener('input', window.filterData);
    typeFilter.addEventListener('change', window.filterData);
    formFilter.addEventListener('change', window.filterData);
    sortFilter.addEventListener('change', window.filterData);
}

init();