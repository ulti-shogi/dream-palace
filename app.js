let pokemonList = [];
let typeMap = {};
let abilityMap = {}; // 特性の辞書を追加

// アプリ起動時の初期化処理
async function init() {
    await loadTypeData();
    await loadAbilityData(); // 特性データの読み込みを追加
    await loadPokemonData();
    setupFilters();
    renderList(pokemonList); // 最初は全件表示
}

// type.txtを読み込んで、IDとタイプ名の辞書を作る
async function loadTypeData() {
    const response = await fetch('type.txt');
    const text = await response.text();
    const lines = text.trim().split('\n');
    
    const ids = lines[0].split(',');
    const names = lines[1].split(',');
    
    for (let i = 0; i < ids.length; i++) {
        typeMap[ids[i]] = names[i];
    }
    
    const typeFilter = document.getElementById('typeFilter');
    names.forEach((name, index) => {
        const option = document.createElement('option');
        option.value = ids[index];
        option.textContent = name;
        typeFilter.appendChild(option);
    });
}

// ability.txtを読み込んで、IDと特性名の辞書を作る（新規追加）
async function loadAbilityData() {
    const response = await fetch('ability.txt');
    const text = await response.text();
    const lines = text.trim().split('\n');
    
    // 1行目のヘッダー(id,ability)を飛ばして処理
    for (let i = 1; i < lines.length; i++) {
        const [id, name] = lines[i].split(',');
        abilityMap[id] = name;
    }
}

// pokemon.txtを読み込んで、配列に格納する
async function loadPokemonData() {
    const response = await fetch('pokemon.txt');
    const text = await response.text();
    const lines = text.trim().split('\n');
    
    // 1行目のヘッダーを飛ばして処理
    for (let i = 1; i < lines.length; i++) {
        // ability_1, ability_2, ability_3 を追加で受け取る
        const [number, name, type_1, type_2, H, A, B, C, D, S, ability_1, ability_2, ability_3] = lines[i].split(',');
        
        const total = Number(H) + Number(A) + Number(B) + Number(C) + Number(D) + Number(S);
        
        pokemonList.push({
            number, name, type_1, type_2, H, A, B, C, D, S, total, ability_1, ability_2, ability_3
        });
    }
}

// 画面にリストを描画する処理
function renderList(data) {
    const resultsContainer = document.getElementById('results');
    resultsContainer.innerHTML = '';

    data.forEach(poke => {
        // タイプバッジ生成
        const type1Name = typeMap[poke.type_1];
        let typesHtml = `<span class="type-badge type-${poke.type_1}">${type1Name}</span>`;
        
        if (poke.type_2 !== "00") {
            const type2Name = typeMap[poke.type_2];
            typesHtml += `<span class="type-badge type-${poke.type_2}">${type2Name}</span>`;
        }

        // 特性のHTML生成（新規追加）
        let abilitiesHtml = '';
        if (poke.ability_1) abilitiesHtml += `<span class="ability-item">${abilityMap[poke.ability_1]}</span>`;
        if (poke.ability_2) abilitiesHtml += `<span class="ability-item">${abilityMap[poke.ability_2]}</span>`;
        // 夢特性（隠れ特性）用として3つ目は少しクラスを変えています
        if (poke.ability_3) abilitiesHtml += `<span class="ability-item hidden-ability">${abilityMap[poke.ability_3]}</span>`;

        const div = document.createElement('div');
        div.className = 'card';
        // テンプレートの中に特性エリア（div.abilities）を差し込み
        div.innerHTML = `
            <div class="card-header">
                <span class="poke-name">${poke.name}</span>
                <span class="poke-number">No.${poke.number}</span>
            </div>
            <div class="types">
                ${typesHtml}
            </div>
            <div class="abilities">
                ${abilitiesHtml}
            </div>
            <div class="stats">
                <div class="stat-item">H: ${poke.H}</div>
                <div class="stat-item">A: ${poke.A}</div>
                <div class="stat-item">B: ${poke.B}</div>
                <div class="stat-item">C: ${poke.C}</div>
                <div class="stat-item">D: ${poke.D}</div>
                <div class="stat-item">S: ${poke.S}</div>
                <div class="stat-item total">合計: ${poke.total}</div>
            </div>
        `;
        resultsContainer.appendChild(div);
    });
}

// 検索・絞り込みのイベント設定
function setupFilters() {
    const searchInput = document.getElementById('searchInput');
    const typeFilter = document.getElementById('typeFilter');

    function filterData() {
        const keyword = searchInput.value;
        const selectedType = typeFilter.value;

        const filtered = pokemonList.filter(poke => {
            const matchName = poke.name.includes(keyword);
            const matchType = selectedType === "" || poke.type_1 === selectedType || poke.type_2 === selectedType;
            return matchName && matchType;
        });

        renderList(filtered);
    }

    searchInput.addEventListener('input', filterData);
    typeFilter.addEventListener('change', filterData);
}

// アプリの実行
init();