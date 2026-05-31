// --- 基本設定とユーティリティ ---
let seriesList = []; 

function getFiscalYear(dateStr) {
    const parts = dateStr.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    return month >= 4 ? year : year - 1;
}

// 勝率を四捨五入せずに小数点第4位で切り捨てる関数
function formatRate(rate) {
    const truncated = Math.floor(rate * 10000 + 1e-9) / 10000;
    return truncated.toFixed(4); 
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
        // ★ 勝者の背景を赤くするための判定
        const requiredWins = s.phase === '七番勝負' ? 4 : (s.phase === '五番勝負' ? 3 : 99);
        const p1Class = s.win1 >= requiredWins ? ' class="winner-cell"' : '';
        const p2Class = s.win2 >= requiredWins ? ' class="winner-cell"' : '';

        return `
            <tr>
                <td>${s.period}</td>
                <td><strong>${s.match}</strong></td>
                <td${p1Class}>${s.player1}</td>
                <td>${s.win1}</td>
                <td><div class="stars">${starRow}</div></td>
                <td>${s.win2}</td>
                <td${p2Class}>${s.player2}</td>
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
        // ★ 勝者の背景を赤くするための判定
        const requiredWins = s.phase === '七番勝負' ? 4 : (s.phase === '五番勝負' ? 3 : 99);
        const p1Class = s.win1 >= requiredWins ? ' class="winner-cell"' : '';
        const p2Class = s.win2 >= requiredWins ? ' class="winner-cell"' : '';

        return `
            <tr>
                <td>${s.period}</td>
                <td>${s.fiscalYear}</td>
                <td${p1Class}>${s.player1}</td>
                <td>${s.win1}</td>
                <td><div class="stars">${starRow}</div></td>
                <td>${s.win2}</td>
                <td${p2Class}>${s.player2}</td>
            </tr>
        `;
    }).join('');
}

// --- 描画処理3: 棋士別結果 ---
function renderPlayerTable() {
    const playerASelect = document.getElementById('playerASelect');
    const playerBSelect = document.getElementById('playerBSelect');
    if (!playerASelect || !playerBSelect || !playerASelect.value) return;

    const playerA = playerASelect.value;
    const playerB = playerBSelect.value;
    const tbody = document.getElementById('playerBody');
    const statsDiv = document.getElementById('playerStats');

    // フィルタリング処理
    let filtered = seriesList.filter(s => {
        if (playerB === '全て') {
            return s.player1 === playerA || s.player2 === playerA;
        } else {
            return (s.player1 === playerA && s.player2 === playerB) || (s.player1 === playerB && s.player2 === playerA);
        }
    });

    // 対局終了日（無ければ開始日）の新しい順（降順）にソート
    filtered.sort((a, b) => {
        const dateA = a.endDate || a.startDate;
        const dateB = b.endDate || b.startDate;
        return dateB.localeCompare(dateA);
    });

    // ★ プルダウンBが「全て」のときの成績集計処理
    if (playerB === '全て' && filtered.length > 0) {
        let totalTitle = 0;
        let totalLost = 0; 
        let totalCurrent = 0;
        let totalUpcoming = 0;

        let totalWins = 0;
        let totalLosses = 0;
        let totalJishogi = 0;

        filtered.forEach(s => {
            const isPlayer1 = (s.player1 === playerA);
            const myWins = isPlayer1 ? s.win1 : s.win2;
            const myLosses = isPlayer1 ? s.win2 : s.win1;
            const requiredWins = s.phase === '七番勝負' ? 4 : (s.phase === '五番勝負' ? 3 : 99);

            // 結果ステータスの集計
            if (myWins >= requiredWins) {
                totalTitle++;
            } else if (myLosses >= requiredWins) {
                totalLost++;
            } else {
                if (s.win1 + s.win2 + s.draw > 0) totalCurrent++;
                else totalUpcoming++;
            }

            // 対局単位の勝敗と持将棋の集計
            totalWins += myWins;
            totalLosses += myLosses;
            const jishogiCount = s.stars.filter(star => star === '持').length;
            totalJishogi += jishogiCount;
        });

        const totalAppear = totalTitle + totalLost;
        const totalGames = totalWins + totalLosses;
        
        const winRate = totalGames > 0 ? formatRate(totalWins / totalGames) : "0.0000";

        const jishogiText = totalJishogi > 0 ? `<span style="font-weight: normal; font-size: 0.9em; margin-left: 5px;">（持将棋${totalJishogi}局を除く）</span>` : "";

        statsDiv.className = 'stats-panel'; 
        statsDiv.style.display = 'block';
        statsDiv.innerHTML = `
            <div class="stats-flex">
                <div class="stats-group">
                    <strong>番勝負成績</strong><br>
                    登場：${totalAppear} / 獲得：${totalTitle} / 敗退：${totalLost} / 途中：${totalCurrent} / 予定：${totalUpcoming}
                </div>
                <div class="stats-group">
                    <strong>タイトル戦通算対局成績</strong>${jishogiText}<br>
                    ${totalGames}局 ${totalWins}勝 ${totalLosses}敗 勝率:${winRate}
                </div>
            </div>
        `;
    } else if (playerB !== '全て' && filtered.length > 0) {
        let aSeriesWins = 0;
        let bSeriesWins = 0;

        filtered.forEach(s => {
            const isPlayer1 = (s.player1 === playerA);
            const myWins = isPlayer1 ? s.win1 : s.win2;
            const oppWins = isPlayer1 ? s.win2 : s.win1;
            const requiredWins = s.phase === '七番勝負' ? 4 : (s.phase === '五番勝負' ? 3 : 99);

            if (myWins >= requiredWins) {
                aSeriesWins++;
            } else if (oppWins >= requiredWins) {
                bSeriesWins++;
            }
        });

        statsDiv.className = 'stats-panel'; 
        statsDiv.style.display = 'block';
        statsDiv.innerHTML = `<div class="h2h-stats">${aSeriesWins}勝　${bSeriesWins}勝</div>`;
    } else {
        statsDiv.style.display = 'none';
        statsDiv.innerHTML = '';
    }

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="no-data">該当するデータがありません。</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(s => {
        const isPlayer1 = (s.player1 === playerA); 
        const opponent = isPlayer1 ? s.player2 : s.player1;
        
        const myWins = isPlayer1 ? s.win1 : s.win2;
        const myLosses = isPlayer1 ? s.win2 : s.win1;
        const jishogiCount = s.stars.filter(star => star === '持').length;
        const scoreText = `${myWins}勝${myLosses}敗${jishogiCount > 0 ? jishogiCount + '持' : ''}`;
        
        const myStars = s.stars.map(star => {
            if (star === '○') return isPlayer1 ? '○' : '●';
            if (star === '●') return isPlayer1 ? '●' : '○';
            return star; 
        });
        const starRow = myStars.join('');
        
        const requiredWins = s.phase === '七番勝負' ? 4 : (s.phase === '五番勝負' ? 3 : 99);
        let resultText = '';
        
        if (myWins >= requiredWins) {
            resultText = isPlayer1 ? '防衛' : '奪取';
        } else if (myLosses >= requiredWins) {
            resultText = isPlayer1 ? '失冠' : '敗退';
        } else {
            if (s.win1 + s.win2 + s.draw > 0) {
                resultText = '途中';
            } else {
                resultText = '予定';
            }
        }

        return `
            <tr>
                <td>${s.fiscalYear}</td>
                <td>${s.period}</td>
                <td><strong>${s.match}</strong></td>
                <td>${opponent}</td>
                <td>${scoreText}</td>
                <td><div class="stars">${starRow}</div></td>
                <td>${resultText}</td>
            </tr>
        `;
    }).join('');
}

// --- 描画処理4: 歴代タイトル獲得ランキング ---
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
        else if (sortBy === 'rate') currentValueText = formatRate(r.rate); 
        else currentValueText = r.count.toString();

        if (currentValueText !== previousValueText) {
            currentRank = index + 1;
            previousValueText = currentValueText;
        }
        
        const rateText = formatRate(r.rate);

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

            if (game.pA === s.player1) {
                if (game.resA === '○') { s.win1++; s.stars.push('○'); }
                else if (game.resB === '○') { s.win2++; s.stars.push('●'); }
                else if (game.resA === '千') { s.draw++; } 
                else if (game.resA === '持') { s.draw++; s.stars.push('持'); } 
            } else {
                if (game.resA === '○') { s.win2++; s.stars.push('●'); }
                else if (game.resB === '○') { s.win1++; s.stars.push('○'); }
                else if (game.resA === '千') { s.draw++; } 
                else if (game.resA === '持') { s.draw++; s.stars.push('持'); } 
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

        const rankingMap = {};
        seriesList.forEach(s => {
            const requiredWins = s.phase === '七番勝負' ? 4 : (s.phase === '五番勝負' ? 3 : 99);
            let winner = null;
            if (s.win1 >= requiredWins) winner = s.player1;
            else if (s.win2 >= requiredWins) winner = s.player2;
            
            if (!rankingMap[s.player1]) rankingMap[s.player1] = 0;
            if (!rankingMap[s.player2]) rankingMap[s.player2] = 0;
            
            if (winner) {
                rankingMap[winner]++;
            }
        });
        
        const sortedPlayers = Object.keys(rankingMap).sort((a, b) => rankingMap[b] - rankingMap[a]);
        
        const playerASelect = document.getElementById('playerASelect');
        const playerBSelect = document.getElementById('playerBSelect');
        
        const optAll = document.createElement('option');
        optAll.value = '全て';
        optAll.textContent = '全て';
        playerBSelect.appendChild(optAll);
        
        sortedPlayers.forEach(p => {
            const optA = document.createElement('option');
            optA.value = p;
            optA.textContent = p;
            playerASelect.appendChild(optA);
            
            const optB = document.createElement('option');
            optB.value = p;
            optB.textContent = p;
            playerBSelect.appendChild(optB);
        });

        renderYearlyTable();
        renderMatchTable();
        renderPlayerTable();
        renderRanking();
    })
    .catch(error => {
        console.error('CSV読み込みエラー:', error);
        const errorHtml = `<tr><td colspan="7" class="no-data" style="color: red;">データの読み込みに失敗しました。</td></tr>`;
        document.getElementById('yearlyBody').innerHTML = errorHtml;
        document.getElementById('matchBody').innerHTML = errorHtml;
        document.getElementById('playerBody').innerHTML = errorHtml;
        document.getElementById('rankingBody').innerHTML = errorHtml;
    });