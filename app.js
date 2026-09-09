let pokemonList = [];
let typeMap = {};

// アプリ起動時の初期化処理
async function init() {
    await loadTypeData();
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
    
    // セレクトボックスにタイプを追加
    const typeFilter = document.getElementById('typeFilter');
    names.forEach((name, index) => {
        const option = document.createElement('option');
        option.value = ids[index];
        option.textContent = name;
        typeFilter.appendChild(option);
    });
}

// pokemon.txtを読み込んで、配列に格納する
async function loadPokemonData() {
    const response = await fetch('pokemon.txt');
    const text = await response.text();
    const lines = text.trim().split('\n');
    
    // 1行目のヘッダーを飛ばして、2行目から処理
    for (let i = 1; i < lines.length; i++) {
        const [number, name, type_1, type_2, H, A, B, C, D, S] = lines[i].split(',');
        
        // 合計種族値を計算
        const total = Number(H) + Number(A) + Number(B) + Number(C) + Number(D) + Number(S);
        
        pokemonList.push({
            number, name, type_1, type_2, H, A, B, C, D, S, total
        });
    }
}

// 画面にリストを描画する処理（スマホ向けカードUI対応版）
function renderList(data) {
    const resultsContainer = document.getElementById('results');
    resultsContainer.innerHTML = ''; // 一旦クリア

    data.forEach(poke => {
        // タイプ1のバッジ生成
        const type1Name = typeMap[poke.type_1];
        let typesHtml = `<span class="type-badge type-${poke.type_1}">${type1Name}</span>`;
        
        // タイプ2がある場合のバッジ生成 (00以外の場合)
        if (poke.type_2 !== "00") {
            const type2Name = typeMap[poke.type_2];
            typesHtml += `<span class="type-badge type-${poke.type_2}">${type2Name}</span>`;
        }

        const div = document.createElement('div');
        div.className = 'card';
        div.innerHTML = `
            <div class="card-header">
                <span class="poke-name">${poke.name}</span>
                <span class="poke-number">No.${poke.number}</span>
            </div>
            <div class="types">
                ${typesHtml}
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
            // 名前の一致確認（ひらがな・カタカナの区別なしなどは後で追加可能）
            const matchName = poke.name.includes(keyword);
            // タイプの確認（タイプ1かタイプ2どちらかに含まれていればOK）
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