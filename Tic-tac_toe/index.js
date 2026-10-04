import { stdin as input, stdout as output } from 'node:process';
import { createInterface } from 'node:readline/promises';

const rl = createInterface({ input, output });
const table = [
    ['_','_','_'],
    ['_','_','_'],
    ['_','_','_'],
]
function print(){
    for(let i =0;i<table.length;i++){
        console.log(`${table[i][0]} ${table[i][1]} ${table[i][2]}`); 
    }
}
function checkavailableSpot(i,j) {
    if(table[i][j] == '_'){
        return true;
    }
    return false;
}
function checkWin(p) {
    for (let i = 0; i < 3; i++) {
        if (table[i][0] === p && table[i][1] === p && table[i][2] === p) return true;
        if (table[0][i] === p && table[1][i] === p && table[2][i] === p) return true;
    }
    if (table[0][0] === p && table[1][1] === p && table[2][2] === p) return true;
    if (table[0][2] === p && table[1][1] === p && table[2][0] === p) return true;
    
    return false;
}
function makeMove() {
    if (checkWin('x') || checkWin('o')) return null;

    let bestScore = -Infinity;
    let bestMove = null;
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            if (!checkavailableSpot(i, j)) continue;
            table[i][j] = 'o';
            const score = minimax(false, 0);
            table[i][j] = '_';
            if (score > bestScore) {
                bestScore = score;
                bestMove = { i, j };
            }
        }
    }

    if (bestMove) table[bestMove.i][bestMove.j] = 'o';
    return bestMove;
}
function isDraw() {
    return table.every(row => row.every(cell => cell !== '_'));
}
function minimax(botTurn, depth) {
    if (checkWin('o')) return 10 - depth;
    if (checkWin('x')) return depth - 10;
    if (isDraw()) return 0;

    let bestScore = botTurn ? -Infinity : Infinity;
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            if (!checkavailableSpot(i, j)) continue;
            table[i][j] = botTurn ? 'o' : 'x';
            const score = minimax(!botTurn, depth + 1);
            table[i][j] = '_';
            bestScore = botTurn
                ? Math.max(bestScore, score)
                : Math.min(bestScore, score);
        }
    }
    return bestScore;
}
async function play(){
    let bot = Number((await rl.question("play vs bot? if yes press 1 and enter")).trim() || 0);
    console.log("give me row and cod index");
    
    let gamePlay = true;
    let p1 = true;
    while(gamePlay){
        print();
        if(p1){
            console.log("p1 move i.e change of X");
        }else {
            console.log("p2 move i.e change of o");
        }
        if(!p1 && bot == 1){
            makeMove();
            if(checkWin('o')){
                console.log("Player 2 wins");
                gamePlay = false;
            }
            if(isDraw()){
                console.log("Draw");
                gamePlay = false;
            }
            p1 = true;
            continue;
        }
        let i = parseInt((await rl.question('')).trim(), 10);
        let j = parseInt((await rl.question('')).trim(), 10);
        if((i<0 || i>2) || (j<0 || j>2)){
            console.log("Not valid case");
            continue;
        }
        if(!checkavailableSpot(i,j)){
            console.log("slot not available");
            continue;
        }
        if(p1){
            table[i][j] = 'x';
            if(checkWin('x')){
                console.log("Player 1 wins");
                gamePlay = false;
            }
            p1 = false;
        }else{
            table[i][j] = 'o';
            if(checkWin('o')){
                console.log("Player 2 wins");
                gamePlay = false;
            }
            p1 = true;
        }
        if(isDraw()){
            console.log("Draw");
            gamePlay = false;
        }
        
    }
}

play();

