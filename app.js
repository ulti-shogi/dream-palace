let pokemonList = [];
let typeMap = {};
let abilityMap = {}; 

async function init() {
    await loadTypeData();
    await loadAbilityData(); 
    await loadPokemonData();
    setupFilters();
    renderList(pokemonList); 
}

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

// 見えない改行文字のバグを修正
async function loadAbilityData() {
    const response = await fetch('ability.txt');
    const text = await response.text();
    // \r?\n とすることで、Windows特有の改行のズレを吸収
    const lines = text.trim().split(/\r?\n/); 
    
    for (let i = 1; i < lines.length; i++) {
        const [id, name] = lines[i].split(',');
        if (id && name) {
            abilityMap[id.trim()] = name.trim(); // 見えない文字を消して辞書に登録
        }
    }
}

async function loadPokemonData() {
    const response = await fetch('pokemon.txt');
    const text = await response.text();
    const lines = text.trim().split(/\r?\n/); // こちらも修正
    
    for (let i = 1; i < lines.length; i++) {
        const [number, name, type_1, type_2, H, A, B, C, D, S, ability_1, ability_2, ability_3] = lines[i].split(',');
        
        const total = Number(H) + Number(A) + Number(B) + Number(C) + Number(D) + Number(S);
        
        pokemonList.push({
            number, name, type_1, type_2, H, A, B, C, D, S, total, ability_1, ability_2, ability_3
        });
    }
}

function renderList(data) {
    const resultsContainer = document.getElementById('results');
    resultsContainer.innerHTML = '';

    data.forEach(poke => {
        const type1Name = typeMap[poke.type_1];
        let typesHtml = `<span class="type-badge type-${poke.type_1}">${type1Name}</span>`;
        
        if (poke.type_2 !== "00") {
            const type2Name = typeMap[poke.type_2];
            typesHtml += `<span class="type-badge type-${poke.type_2}">${type2Name}</span>`;
        }

        // 余計なクラス分けを廃止し、見えない文字を削除して純粋に特性があるか判定
        let abilitiesHtml = '';
        let a1 = poke.ability_1 ? poke.ability_1.trim() : "";
        let a2 = poke.ability_2 ? poke.ability_2.trim() : "";
        let a3 = poke.ability_3 ? poke.ability_3.trim() : "";

        if (a1 && abilityMap[a1]) abilitiesHtml += `<span class="ability-item">${abilityMap[a1]}</span>`;
        if (a2 && abilityMap[a2]) abilitiesHtml += `<span class="ability-item">${abilityMap[a2]}</span>`;
        if (a3 && abilityMap[a3]) abilitiesHtml += `<span class="ability-item">${abilityMap[a3]}</span>`;

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

init();