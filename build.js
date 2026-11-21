// node build.js  -> dist/chess.html (single offline file) + android/app/src/main/assets/chess.html
const fs = require('fs'), path = require('path');
const rd = f => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8');
const engineText = rd('engine.js') + '\n' + rd('ai.js');
let html = rd('index.html');
const rep = (k, v) => { html = html.split('/*@' + k + '@*/').join(v); };
// function replacer semantics: avoid $-pattern issues by using split/join
rep('CSS', rd('style.css'));
rep('ENGINE_TEXT', engineText.replace(/<\/script/gi, '<\\/script'));
rep('ENGINE', rd('engine.js'));
rep('SETTINGS', rd('settings.js'));
rep('AUDIO', rd('audio.js'));
rep('AI', rd('ai.js'));
rep('RENDER', rd('render.js'));
rep('GAME', rd('game.js'));
rep('UI', rd('ui.js'));
rep('MAIN', rd('main.js'));
fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'dist/chess.html'), html);
const assets = path.join(__dirname, 'android/app/src/main/assets');
fs.mkdirSync(assets, { recursive: true });
fs.writeFileSync(path.join(assets, 'chess.html'), html);
console.log('built dist/chess.html', (html.length / 1024).toFixed(0) + ' KB');
