// --- 基本設定とユーティリティ ---
let seriesList = []; 

function getFiscalYear(dateStr) {
    const parts = dateStr.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    return month >= 4 ? year : year - 1;
}

// タブ切り替え処理
function switchTab(tabId, btnElement) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-button').forEach(el => el.classList.remove('active'));
    
    document.getElementById(tabId).classList.add('active');
    btnElement.classList.add('active');
}

// --- 描画処理1: 年度別結果 ---
function renderYearlyTable() {
    const yearSelect = document.getElementById('yearSelect');
    if (!yearSelect.value) return; 

    const selectedYear = parseInt(yearSelect.value, 10);
    const tbody = document.getElementById('yearlyBody');
    
    const filtered = seriesList.filter(s => s.fiscalYear === selectedYear);
    
    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="no-data">該当するデータがありません。</td></tr>`;
        return;
    }
    
    tbody.innerHTML = filtered.map(s => {
        const starRow = s.stars.join('');
        return `
            <tr>
                <td>${s.period}</td>
                <td><strong>${s.match}</strong></td>
                <td>${s.player1}</td>
                <td>${s.win1}</td>
                <td><div class="stars">${starRow}</div></td>
                <td>${s.win2}</td>
                <td>${s.player2}</td>
            </tr>
        `;
    }).join('');
}

// --- 描画処理2: 棋戦別結果 ---
function renderMatchTable() {
    const matchSelect = document.getElementById('matchSelect');
    if (!matchSelect.value) return;

    const selectedMatch = matchSelect.value;
    const tbody = document.getElementById('matchBody');
    
    const filtered = seriesList.filter(s => s.match === selectedMatch);
    
    filtered.sort((a, b) => parseInt(b.period, 10) - parseInt(a.period, 10));
    
    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="no-data">該当するデータがありません。</td></tr>`;
        return;
    }
    
    tbody.innerHTML = filtered.map(s => {
        const starRow = s.stars.join('');
        return `
            <tr>
                <td>${s.period}</td>
                <td>${s.fiscalYear}</td>
                <td>${s.player1}</td>
                <td>${s.win1}</td>
                <td><div class="stars">${starRow}</div></td>
                <td>${s.win2}</td>
                <td>${s.player2}</td>
            </tr>
        `;
    }).join('');
}

// --- 描画処理3: 歴代タイトル獲得ランキング ---
function renderRanking() {
    const sortSelect = document.getElementById('sortSelect');
    const sortBy = sortSelect ? sortSelect.value : 'count'; 

    const rankingMap = {};

    seriesList.forEach(s => {
        const requiredWins = s.phase === '七番勝負' ? 4 : (s.phase === '五番勝負' ? 3 : 99);
        
        let winner = null;
        let loser = null;
        
        if (s.win1 >= requiredWins) {
            winner = s.player1;
            loser = s.player2;
        } else if (s.win2 >= requiredWins) {
            winner = s.player2;
            loser = s.player1;
        }

        if (winner && loser) {
            if (!rankingMap[winner]) rankingMap[winner] = { name: winner, count: 0, appear: 0, lose: 0, rate: 0 };
            if (!rankingMap[loser]) rankingMap[loser] = { name: loser, count: 0, appear: 0, lose: 0, rate: 0 };
            
            rankingMap[winner].count++;  
            rankingMap[winner].appear++; 
            
            rankingMap[loser].lose++;    
            rankingMap[loser].appear++;  
        }
    });

    const rankingArray = Object.values(rankingMap).map(r => {
        r.rate = r.appear > 0 ? r.count / r.appear : 0;
        return r;
    });

    rankingArray.sort((a, b) => {
        if (sortBy === 'appear') {
            if (b.appear !== a.appear) return b.appear - a.appear;
            return b.count - a.count;
        }
        if (sortBy === 'lose') {
            if (b.lose !== a.lose) return b.lose - a.lose;
            return b.count - a.count;
        }
        if (sortBy === 'rate') {
            if (b.rate !== a.rate) return b.rate - a.rate;
            return b.count - a.count;
        }
        if (b.count !== a.count) return b.count - a.count;
        return b.appear - a.appear;
    });

    const tbody = document.getElementById('rankingBody');
    
    if (rankingArray.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="no-data">決着がついたタイトル戦データがありません。</td></tr>`;
        return;
    }

    let html = '';
    let currentRank = 1;
    let previousValueText = ''; 

    rankingArray.forEach((r, index) => {
        let currentValueText = '';
        if (sortBy === 'appear') currentValueText = r.appear.toString();
        else if (sortBy === 'lose') currentValueText = r.lose.toString();
        else if (sortBy === 'rate') currentValueText = r.rate.toFixed(4); 
        else currentValueText = r.count.toString();

        if (currentValueText !== previousValueText) {
            currentRank = index + 1;
            previousValueText = currentValueText;
        }
        
        const rateText = r.rate.toFixed(4);

        html += `
            <tr>
                <td class="rank-column">${currentRank}</td>
                <td><strong>${r.name}</strong></td>
                <td>${r.appear}</td>
                <td><strong>${r.count}</strong></td>
                <td>${r.lose}</td>
                <td>${rateText}</td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

// --- データの読み込みと初期化 ---
fetch('title.csv')
    .then(response => {
        if (!response.ok) throw new Error('ネットワークエラー');
        return response.text();
    })
    .then(csvText => {
        const lines = csvText.trim().split('\n');
        
        const games = lines.slice(1).map(line => {
            const cols = line.split(',');
            return {
                date: cols[0], match: cols[1], period: cols[2],
                pA: cols[4], resA: cols[5], resB: cols[6], pB: cols[7],
                phase: cols[9] 
            };
        }).sort((a, b) => a.date.localeCompare(b.date)); 

        const seriesMap = {};
        games.forEach(game => {
            if (!game.match || !game.period) return;
            
            const fy = getFiscalYear(game.date);
            const key = `${game.match}-${game.period}`;
            
            if (!seriesMap[key]) {
                seriesMap[key] = {
                    fiscalYear: fy,
                    match: game.match,
                    period: game.period,
                    player1: game.pA,
                    player2: game.pB,
                    phase: game.phase, 
                    win1: 0,
                    win2: 0,
                    draw: 0,
                    stars: [],
                    startDate: game.date,
                    endDate: "" 
                };
            }
            
            const s = seriesMap[key];
            
            if (game.resA === "" && game.resB === "") {
                s.stars.push('・');
                return;
            }

            s.endDate = game.date;

            // ★修正点: 「千日手」と「持将棋」の処理を分離
            if (game.pA === s.player1) {
                if (game.resA === '○') { s.win1++; s.stars.push('○'); }
                else if (game.resB === '○') { s.win2++; s.stars.push('●'); }
                else if (game.resA === '千') { s.draw++; } // 千日手は星取りに表示しない（pushしない）
                else if (game.resA === '持') { s.draw++; s.stars.push('持'); } // 持将棋は「持」と表示
            } else {
                if (game.resA === '○') { s.win2++; s.stars.push('●'); }
                else if (game.resB === '○') { s.win1++; s.stars.push('○'); }
                else if (game.resA === '千') { s.draw++; } // 千日手は星取りに表示しない
                else if (game.resA === '持') { s.draw++; s.stars.push('持'); } // 持将棋は「持」と表示
            }
        });

        seriesList = Object.values(seriesMap);

        seriesList.sort((a, b) => {
            if (a.endDate && b.endDate) return a.endDate.localeCompare(b.endDate);
            if (a.endDate && !b.endDate) return -1;
            if (!a.endDate && b.endDate) return 1;
            return a.startDate.localeCompare(b.startDate);
        });

        const yearSelect = document.getElementById('yearSelect');
        const years = [...new Set(seriesList.map(s => s.fiscalYear))].sort((a, b) => b - a); 

        years.forEach(year => {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = `${year}年度`;
            yearSelect.appendChild(option);
        });

        renderYearlyTable();
        renderMatchTable();
        renderRanking();
    })
    .catch(error => {
        console.error('CSV読み込みエラー:', error);
        const errorHtml = `<tr><td colspan="7" class="no-data" style="color: red;">データの読み込みに失敗しました。</td></tr>`;
        document.getElementById('yearlyBody').innerHTML = errorHtml;
        document.getElementById('matchBody').innerHTML = errorHtml;
        document.getElementById('rankingBody').innerHTML = errorHtml;
    });