// データを格納する変数
let typeDict = {};
let abilityDict = {};
let pokemonList = [];

// アプリの初期化
async function initApp() {
    try {
        await loadTypes();
        await loadAbilities();
        await loadPokemons();
        displayPokemons(pokemonList); // 初期表示
        setupEventListeners();
    } catch (error) {
        document.getElementById('resultContainer').innerHTML = `<p>エラーが発生しました: ${error.message}<br>※ローカル環境(file://)ではfetchがブロックされるため、VS CodeのLive Serverなどを使用してください。</p>`;
    }
}

// 1. type.txtの読み込みと辞書化
async function loadTypes() {
    const res = await fetch('type.txt');
    const text = await res.text();
    const lines = text.trim().split('\n');
    const ids = lines[0].split(',');
    const names = lines[1].split(',');
    
    for (let i = 0; i < ids.length; i++) {
        typeDict[ids[i]] = names[i];
    }
}

// 2. ability.txtの読み込みと辞書化
async function loadAbilities() {
    const res = await fetch('ability.txt');
    const text = await res.text();
    const lines = text.trim().split('\n');
    
    // 1行目はヘッダなので2行目からループ
    for (let i = 1; i < lines.length; i++) {
        const [id, name] = lines[i].split(',');
        if (id && name) abilityDict[id] = name;
    }
}

// 3. pokemon.txtの読み込みと整形
async function loadPokemons() {
    const res = await fetch('pokemon.txt');
    const text = await res.text();
    const lines = text.trim().split('\n');
    
    for (let i = 1; i < lines.length; i++) {
        const p = lines[i].split(',');
        if (p.length < 13) continue; // データ不足行をスキップ

        pokemonList.push({
            number: p[0],
            name: p[1],
            type1: typeDict[p[2]] || '',
            type2: p[3] !== '00' ? typeDict[p[3]] : '',
            H: p[4], A: p[5], B: p[6], C: p[7], D: p[8], S: p[9],
            ab1: abilityDict[p[10]] || '',
            ab2: abilityDict[p[11]] || '',
            ab3: abilityDict[p[12]] || ''
        });
    }
}

// 検索・絞り込みイベントの設定
function setupEventListeners() {
    const searchInput = document.getElementById('searchInput');
    
    searchInput.addEventListener('input', (e) => {
        const keyword = e.target.value.toLowerCase();
        const filtered = pokemonList.filter(p => p.name.includes(keyword));
        displayPokemons(filtered);
    });
}

// 結果をHTMLに描画する関数
function displayPokemons(list) {
    const container = document.getElementById('resultContainer');
    container.innerHTML = ''; // クリア

    if (list.length === 0) {
        container.innerHTML = '<p>該当するポケモンが見つかりません。</p>';
        return;
    }

    // パフォーマンスのため、最大100件程度の表示に制限するのも手です
    list.forEach(p => {
        const card = document.createElement('div');
        card.className = 'pokemon-card';
        
        let typesHtml = `<span class="type-badge">${p.type1}</span>`;
        if (p.type2) typesHtml += `<span class="type-badge">${p.type2}</span>`;

        let abilities = [p.ab1, p.ab2, p.ab3].filter(a => a !== '').join(' / ');

        card.innerHTML = `
            <h2>No.${p.number} ${p.name}</h2>
            <div class="types">${typesHtml}</div>
            <p style="font-size: 13px; margin-top: 5px; color: #555;">特性: ${abilities}</p>
            <div class="stats">
                <span>H:${p.H}</span><span>A:${p.A}</span><span>B:${p.B}</span>
                <span>C:${p.C}</span><span>D:${p.D}</span><span>S:${p.S}</span>
            </div>
        `;
        container.appendChild(card);
    });
}

// 実行
initApp();