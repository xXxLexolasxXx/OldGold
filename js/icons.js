'use strict';
// Пиксельные иконки 16×16: товары и кнопки интерфейса.

// ---------- Иконки попиксельно: каждая — сетка 16×16 символов и своя палитра ('.' — пусто) ----------
const ICON_GRIDS = {
  ui: {
    build: { pal: { G: '#d4d0c8', g: '#9a958c', s: '#5c564f', W: '#d8a468', w: '#a06840', d: '#5a361e' }, rows: [
      '................',
      '..........GGGG..',
      '........GGGGGgg.',
      '.......GGGGGGgs.',
      '......GGgggggGgs',
      '......Gggsssggss',
      '.......gsss.gss.',
      '.........Wwd.ss.',
      '........WwwdW...',
      '.......WwwdW....',
      '......WwwdW.....',
      '.....WwwdW......',
      '....WwwdW.......',
      '...WwwdW........',
      '..WwwdW.........',
      '..wddW..........'] },
    store: { pal: { d: '#4a2c18', B: '#a06840', l: '#d8a468', s: '#8a857c', g: '#cfcac0', K: '#e4b434', k: '#8a5a10' }, rows: [
      '................',
      '................',
      '..dddddddddddd..',
      '.dlllllllllllld.',
      '.dBBBBBBBBBBBBd.',
      '.dBBsBBBBBBsBBd.',
      '.dddddddddddddd.',
      '.dllllllKKlllld.',
      '.dBBBBsBKkBsBBd.',
      '.dBBBBsBBBBsBBd.',
      '.dBBBBsBBBBsBBd.',
      '.dBBBBsBBBBsBBd.',
      '.dBBBBsBBBBsBBd.',
      '.dddddddddddddd.',
      '................',
      '................'] },
    people: { pal: { r: '#c8382a', R: '#ec6a50', g: '#4a8e34', G: '#82c050', f: '#e8b888', e: '#2a160c', w: '#e8e2d4', W: '#b8b2a4', b: '#7a4a26', B: '#a8683a', t: '#3a5a8e' }, rows: [
      '................',
      '...r.......g....',
      '..rRr.....gGg...',
      '..rRRr...gGGGg..',
      'rrrrrrr.ggggggg.',
      '.fffff...fffff..',
      '.feffe...feffe..',
      '.fwwwf...fwwwf..',
      '.wwwww...wwwww..',
      '.wWwWw...wWwWw..',
      '..wWw.....wWw...',
      '.bBBBb...tbbbtt.',
      'bBBBBBb.tbbbbbt.',
      'bBBbBBb.tbbbbbt.',
      '.eee.ee..ee.ee..',
      '................'] },
    scroll: { pal: { p: '#f0e2b4', P: '#d8c48c', q: '#b89a5c', w: '#a06840', W: '#d8a468', d: '#583522' }, rows: [
      '................',
      '..wwwwwwwwwwww..',
      '.WWWWWWWWWWWWWw.',
      '..wwwwwwwwwwww..',
      '..pppppppppppq..',
      '..pdddddddddpq..',
      '..pppppppppppq..',
      '..pdddddddpppq..',
      '..pppppppppppq..',
      '..pdddddddddpq..',
      '..pppppppppppq..',
      '..pdddddpppppq..',
      '..wwwwwwwwwwww..',
      '.WWWWWWWWWWWWWw.',
      '..wwwwwwwwwwww..',
      '................'] },
    log: { pal: { a: '#f4e8c4', A: '#d8c48c', c: '#7a4a28', C: '#b8683a', d: '#6a4a2a', r: '#c8302a' }, rows: [
      '................',
      '..........rr....',
      '.cccccccccrrcccc',
      'cCaaaaaaAcAaaaaA',
      'cCadddddAcAdddaA',
      'cCaaaaaaAcAaaaaA',
      'cCadddddAcAddddA',
      'cCaaaaaaAcAaaaaA',
      'cCaddddaAcAdddaA',
      'cCaaaaaaAcAaaaaA',
      'cCadddddAcAddddA',
      'cCaaaaaaAcAaaaaA',
      '.cAAAAAAAcAAAAAc',
      '..cccccccccccc..',
      '................',
      '................'] },
    menu: { pal: { l: '#f0ece0', m: '#c0baac', d: '#7a756c', s: '#4a463f' }, rows: [
      '................',
      '................',
      '..llllllllllll..',
      '..mmmmmmmmmmmm..',
      '..dddddddddddd..',
      '................',
      '..llllllllllll..',
      '..mmmmmmmmmmmm..',
      '..dddddddddddd..',
      '................',
      '..llllllllllll..',
      '..mmmmmmmmmmmm..',
      '..dddddddddddd..',
      '................',
      '................',
      '................'] },
    road: { pal: { k: '#3e382f', L: '#c4beb0', M: '#8e887c' }, rows: [
      '................',
      '.kkkkkkkkkkkkkk.',
      '.kLLLMkLLLMkLLk.',
      '.kLMMMkLMMMkLMk.',
      '.kkkkkkkkkkkkkk.',
      '.kLLMkLLLLMkLLk.',
      '.kLMMkLMMMMkLMk.',
      '.kkkkkkkkkkkkkk.',
      '.kLLLMkLLLMkLLk.',
      '.kLMMMkLMMMkLMk.',
      '.kkkkkkkkkkkkkk.',
      '.kLLMkLLLLMkLLk.',
      '.kLMMkLMMMMkLMk.',
      '.kkkkkkkkkkkkkk.',
      '................',
      '................'] },
    erase: { pal: { r: '#e0482e', R: '#ff8a64', d: '#8a2014' }, rows: [
      '................',
      '.rr..........rr.',
      '.rRr........rRr.',
      '..rRr......rRr..',
      '...rRr....rRr...',
      '....rRr..rRr....',
      '.....rRrrRr.....',
      '......rRRr......',
      '......rRRr......',
      '.....rRrrdr.....',
      '....rRr..rdr....',
      '...rRr....rdr...',
      '..rRr......rdr..',
      '.rRr........rdr.',
      '.rr..........rr.',
      '................'] },
    save: { pal: { b: '#3a74a0', B: '#5a9ac8', d: '#22486c', w: '#e8e2d4', W: '#b8b2a4', m: '#8a8a94', k: '#16283c' }, rows: [
      '................',
      '.bbbbbbbbbbbbbd.',
      '.bBmmmmmmmmkBbd.',
      '.bBmmmmmmmmkBbd.',
      '.bBmmmmmmmmkBbd.',
      '.bBBBBBBBBBBBbd.',
      '.bBwwwwwwwwwBbd.',
      '.bBwWWWWWWWwBbd.',
      '.bBwwwwwwwwwBbd.',
      '.bBwWWWWWWWwBbd.',
      '.bBwwwwwwwwwBbd.',
      '.bBBBBBBBBBBBbd.',
      '.bbbbbbbbbbbbbd.',
      '.dddddddddddddd.',
      '................',
      '................'] },
    load: { pal: { y: '#f0c444', Y: '#c89226', d: '#8a5a10', p: '#f6f0dc', P: '#cfc6a8' }, rows: [
      '................',
      '................',
      '.YYYYY..........',
      '.yyyyyYYYYYYYY..',
      '.yYYYYYYYYYYYY..',
      '.yppppppppppPd..',
      '.yPPPPPPPPPPPd..',
      '.yyyyyyyyyyyyyd.',
      '..yyyyyyyyyyyyd.',
      '..yYYYYYYYYYYYd.',
      '..yYYYYYYYYYYYd.',
      '..yYYYYYYYYYYYd.',
      '..yYYYYYYYYYYYd.',
      '..dddddddddddd..',
      '................',
      '................'] },
    new: { pal: { w: '#f6f2ea', W: '#d0cabc', d: '#8a847a', g: '#4a8e34', G: '#82c050' }, rows: [
      '................',
      '...wwwwwwww.....',
      '...wWWWWWWwd....',
      '...wWwwwwwWwd...',
      '...wWwwwwwwWwd..',
      '...wwwwwwwwwwwd.',
      '...wwwwGGwwwwwd.',
      '...wwwwGGwwwwwd.',
      '...wwGGGGGGwwwd.',
      '...wwGGGGGGwwwd.',
      '...wwwwGGwwwwwd.',
      '...wwwwGGwwwwwd.',
      '...wwwwwwwwwwwd.',
      '...WWWWWWWWWWWd.',
      '....dddddddddd..',
      '................'] },
    play: { pal: { g: '#9cc058', G: '#c8e47c', d: '#4a6e22' }, rows: [
      '................',
      '....G...........',
      '....GG..........',
      '....GgG.........',
      '....GggG........',
      '....GgggG.......',
      '....GggggG......',
      '....GgggggG.....',
      '....GgggggG.....',
      '....GggggG......',
      '....GgggG.......',
      '....GggG........',
      '....GgG.........',
      '....Gd..........',
      '....d...........',
      '................'] },
    broom: { pal: { W: '#d8a468', w: '#a06840', d: '#5a361e', s: '#e8c860', S: '#b89030', t: '#7a5a14', i: '#6a665c' }, rows: [
      '...........ii...',
      '..........Wwi...',
      '.........Wwd....',
      '........Wwd.....',
      '.......Wwd......',
      '......Wwd.......',
      '.....sWd........',
      '....ssSSs.......',
      '...ssSsSSs......',
      '..ssSsSsSSs.....',
      '.ssSsSsSsSSs....',
      '.sSsSsSsSSSt....',
      '.sSSsSsSSStt....',
      '..sSSSSStt......',
      '...tttttt.......',
      '................'] },
  },
  good: {
    timber: { pal: { l: '#e8bc84', m: '#c8905a', d: '#8a5a34', k: '#5a361e', r: '#a06840' }, rows: [
      '................',
      '................',
      '................',
      '..lllllllllllll.',
      '..mmmmmmmmmmmmr.',
      '..ddrdddddddddk.',
      '.lllllllllllllk.',
      '.mmmmmmmmmmmmrk.',
      '.ddddddrddddddk.',
      'lllllllllllllllk',
      'mmmmmmrmmmmmmmrk',
      'dddddddddddddddk',
      '.kkkkkkkkkkkkkk.',
      '................',
      '................',
      '................'] },
    stone: { pal: { l: '#d4cdc0', m: '#a49c90', d: '#6e675e', k: '#46413b' }, rows: [
      '................',
      '................',
      '................',
      '......llll......',
      '....llllllmm....',
      '...lllllmmmmm...',
      '..llllmmmmmmdd..',
      '..lllmmmmmmmdd..',
      '.lllmmmmmmmmmdd.',
      '.llmmmmmdmmmmdd.',
      '.lmmmmmmmmmdddd.',
      '.mmmmmmddddddkk.',
      '..dddddddddkkk..',
      '...kkkkkkkkk....',
      '................',
      '................'] },
    gold: { pal: { l: '#fff4a8', y: '#f0c030', m: '#c89020', d: '#8a5a10', k: '#5a3a08' }, rows: [
      '................',
      '................',
      '................',
      '....llllll......',
      '...lyyyyyym.....',
      '..lyyllyyyym....',
      '..lyylyyyyymm...',
      '..lyylyyyyymm...',
      '..lyyyyyyymmd...',
      '..lyyyyyymmdd...',
      '...mmmmmmmdd....',
      '....dddddddk....',
      '.....kkkkkk.....',
      '................',
      '................',
      '................'] },
    bread: { pal: { l: '#f0c880', m: '#d89a4c', d: '#a8642c', k: '#6a3a18', c: '#f8e4b8' }, rows: [
      '................',
      '................',
      '................',
      '.....llllll.....',
      '...lllmmmmmmm...',
      '..llcmmcmmcmmm..',
      '.llmmcmmcmmcmmm.',
      '.lmmmmmmmmmmmmd.',
      '.mmmmmmmmmmmmdd.',
      '.mmmmmmmmmmmddd.',
      '.dddmmmmmmdddd..',
      '..kdddddddddk...',
      '...kkkkkkkkk....',
      '................',
      '................',
      '................'] },
    mana: { pal: { w: '#f0eaff', l: '#b8a0ff', m: '#7a56e0', d: '#4a2ea8', k: '#261670' }, rows: [
      '................',
      '.......ww.......',
      '......wllm......',
      '.....wllmmd.....',
      '....wllmmmmd....',
      '....wlmmmmmd....',
      '...wllmmmmmdd...',
      '...llmmmmmmdd...',
      '...lmmmmmmmdd...',
      '....mmmmmmddk...',
      '....mmmmmddk....',
      '.....mmmddk.....',
      '......mddk......',
      '.......dk.......',
      '................',
      '................'] },
  },
};

// Рисует сетку; возвращает true, если для иконки есть попиксельный рисунок
function drawIconGrid(c, kind, name, x, y) {
  const g = ICON_GRIDS[kind] && ICON_GRIDS[kind][name];
  if (!g) return false;
  for (let j = 0; j < g.rows.length; j++) for (let i = 0; i < 16; i++) {
    const ch = g.rows[j][i];
    if (ch && ch !== '.' && g.pal[ch]) px(c, x + i, y + j, 1, 1, g.pal[ch]);
  }
  return true;
}

function drawGoodIcon(c, g, x, y) {
  if (drawIconGrid(c, 'good', g, x, y)) return;
  const P = (a, b, w, h, col) => px(c, x + a, y + b, w, h, col);
  const L = (a, b, a2, b2, col, w) => pline(c, x + a, y + b, x + a2, y + b2, col, w);
  switch (g) {
    case 'trunk':
      P(1, 6, 12, 5, '#6e432a'); P(1, 6, 12, 1, '#a06840'); P(1, 10, 12, 1, '#45291a');
      P(4, 8, 4, 1, '#583522');
      P(12, 5, 3, 7, '#cc9a64'); P(13, 6, 1, 5, '#e0b882'); P(13, 8, 1, 1, '#875434');
      break;
    case 'timber':
      for (let k = 0; k < 3; k++) {
        P(1 + k, 10 - k * 3, 13, 3, k % 2 ? '#cc9a64' : '#e0b882');
        P(1 + k, 12 - k * 3, 13, 1, '#a06840');
      }
      break;
    case 'stone':
      P(3, 5, 10, 8, '#867e74'); P(4, 4, 8, 1, '#b6ada0'); P(3, 5, 4, 3, '#b6ada0'); P(10, 6, 3, 7, '#5c564f');
      P(6, 9, 3, 1, '#5c564f');
      break;
    case 'wheat':
      for (const dx of [-3, 0, 3]) {
        L(8, 15, 8 + dx, 5, '#9c8e48');
        P(7 + dx, 1, 2, 5, '#e4b434'); P(7 + dx, 1, 1, 4, '#f6d458');
      }
      P(6, 10, 5, 1, '#8c2c20');
      break;
    case 'hay':
      P(2, 6, 12, 8, '#a8a050'); P(3, 5, 10, 1, '#c8c070'); P(2, 6, 4, 3, '#c8c070'); P(11, 7, 3, 7, '#7a7a30');
      for (let k = 0; k < 5; k++) P(3 + k * 2, 3 + (k % 2), 1, 3, '#b8b060');
      P(2, 9, 12, 1, '#8a5a2a');
      break;
    case 'hops':
      for (const [a, b] of [[5, 4], [9, 6], [6, 9], [10, 11]]) { P(a, b, 4, 5, '#8ab048'); P(a, b, 2, 2, '#c8e080'); P(a + 3, b + 2, 1, 3, '#5a8a2a'); }
      L(8, 1, 8, 4, '#5a3a1e', 1); P(9, 2, 3, 2, '#5a9a34');
      break;
    case 'beer':
      P(3, 4, 8, 11, '#c89226'); P(4, 5, 6, 9, '#e4b434'); P(3, 2, 8, 3, '#f6f2ea'); P(4, 1, 6, 1, '#ffffff');
      P(11, 6, 3, 1, '#875434'); P(13, 6, 1, 6, '#875434'); P(11, 11, 3, 1, '#875434'); P(3, 14, 8, 1, '#875434');
      P(5, 7, 1, 5, '#fff2a0');
      break;
    case 'flour':
      P(3, 4, 10, 11, '#e4ddd2'); P(4, 3, 8, 1, '#cec6ba'); P(10, 5, 3, 10, '#b6ada0');
      P(6, 2, 4, 2, '#a06840'); P(5, 8, 4, 3, '#f6f2ea');
      break;
    case 'bread':
      P(2, 7, 12, 6, '#a06840'); P(3, 6, 10, 1, '#b8804e'); P(3, 6, 8, 3, '#cc9a64');
      P(2, 12, 12, 1, '#6e432a');
      P(5, 7, 1, 2, '#f0d6a8'); P(8, 7, 1, 2, '#f0d6a8'); P(11, 8, 1, 2, '#f0d6a8');
      break;
    case 'pig':
      P(3, 6, 10, 6, '#eeaab2'); P(4, 5, 8, 1, '#eeaab2'); P(3, 10, 10, 2, '#d0808e');
      P(12, 7, 3, 3, '#d0808e'); P(13, 8, 1, 1, '#7a3a4a'); P(11, 5, 2, 2, '#d0808e');
      P(10, 7, 1, 1, '#160e0a'); P(4, 12, 2, 2, '#a85a6a'); P(10, 12, 2, 2, '#a85a6a'); P(1, 6, 2, 1, '#d0808e');
      break;
    case 'chicken':
      P(3, 6, 10, 7, '#f0c8a0'); P(4, 5, 8, 1, '#f6d8b8'); P(3, 11, 10, 2, '#d09c74');
      P(1, 7, 2, 2, '#e8bc94'); P(13, 7, 2, 2, '#e8bc94'); P(5, 13, 2, 2, '#d09c74'); P(9, 13, 2, 2, '#d09c74');
      P(6, 7, 2, 2, '#ffffff'); P(10, 9, 1, 1, '#b47c56');
      break;
    case 'chickenleg':
      P(4, 4, 7, 6, '#c8803a'); P(5, 3, 5, 1, '#e0a050'); P(4, 9, 7, 1, '#875434');
      L(10, 9, 13, 13, '#f6f2ea', 2); P(12, 12, 3, 2, '#ffffff'); P(5, 5, 2, 1, '#f0c070');
      break;
    case 'trash':
      P(3, 6, 10, 9, '#6e432a'); P(3, 6, 10, 1, '#875434'); P(11, 7, 2, 8, '#45291a');
      P(4, 3, 3, 3, '#9c8e48'); P(8, 2, 2, 4, '#e0b882'); P(6, 4, 2, 2, '#73963e'); P(10, 4, 2, 2, '#b6ada0');
      P(5, 9, 1, 4, '#45291a'); P(8, 9, 1, 4, '#45291a');
      break;
    case 'ash':
      P(3, 9, 10, 5, '#867e74'); P(4, 8, 8, 1, '#9e958a'); P(5, 6, 6, 2, '#b6ada0'); P(6, 5, 4, 1, '#cec6ba');
      P(3, 13, 10, 1, '#5c564f'); P(7, 7, 1, 1, '#e4ddd2'); P(9, 10, 1, 1, '#4a4540'); P(6, 11, 1, 1, '#ac3e2a');
      break;
    case 'fish':
      P(2, 7, 10, 3, '#7890a4'); P(3, 6, 8, 1, '#b8c8d4'); P(4, 5, 5, 1, '#e8f0f4'); P(3, 10, 8, 1, '#4a5e74');
      P(12, 6, 2, 1, '#4a5e74'); P(12, 10, 2, 1, '#4a5e74'); P(13, 7, 1, 3, '#7890a4'); P(4, 7, 1, 1, '#141618'); P(6, 9, 4, 1, '#d88a80');
      break;
    case 'pearl':
      P(5, 5, 6, 6, '#c8c0dc'); P(4, 6, 8, 4, '#c8c0dc'); P(6, 4, 4, 8, '#c8c0dc'); P(5, 6, 4, 3, '#e8e4f0'); P(6, 5, 2, 2, '#ffffff');
      P(9, 10, 2, 1, '#a8a0c0'); P(10, 9, 1, 1, '#a8a0c0'); P(2, 12, 12, 2, '#d8b8a0'); P(3, 11, 10, 1, '#f0d8c8');
      break;
    case 'croissant':
      P(2, 7, 12, 5, '#c07a2c'); P(3, 6, 10, 1, '#d89a3c'); P(5, 5, 6, 1, '#e8b050'); P(1, 9, 2, 3, '#a8641e'); P(13, 9, 2, 3, '#a8641e');
      P(5, 7, 1, 4, '#8a5018'); P(8, 7, 1, 4, '#8a5018'); P(11, 7, 1, 4, '#8a5018'); P(4, 6, 2, 1, '#f6d070');
      break;
    case 'steak':
      P(2, 5, 12, 8, '#7a2a1e'); P(3, 4, 10, 1, '#a8402c'); P(3, 5, 10, 7, '#c0503a'); P(4, 6, 6, 3, '#d86a4c');
      P(9, 8, 4, 3, '#f0e0c8'); P(10, 9, 2, 1, '#c8a880'); P(4, 10, 1, 1, '#4a1810'); P(7, 11, 1, 1, '#4a1810');
      break;
    case 'darkbeer':
      P(3, 4, 8, 11, '#3a2210'); P(4, 5, 6, 9, '#6a4020'); P(3, 2, 8, 3, '#c8b090'); P(4, 1, 6, 1, '#e6d4b4');
      P(11, 6, 3, 1, '#875434'); P(13, 6, 1, 6, '#875434'); P(11, 11, 3, 1, '#875434'); P(3, 14, 8, 1, '#875434');
      P(5, 7, 1, 5, '#a8743a');
      break;
    case 'sausage':
      L(3, 4, 12, 12, '#8c2c20', 3); L(3, 4, 12, 12, '#ac3e2a', 2); L(4, 4, 12, 11, '#c8583a', 1);
      P(2, 3, 2, 2, '#e0b882'); P(12, 12, 2, 2, '#e0b882');
      break;
    case 'goldore':
      P(2, 6, 12, 8, '#5c564f'); P(3, 5, 9, 1, '#867e74'); P(2, 6, 4, 3, '#867e74');
      P(5, 8, 2, 2, '#f6d458'); P(9, 10, 2, 1, '#e4b434'); P(10, 7, 1, 1, '#fff2a0');
      break;
    case 'gold':
      for (let k = 0; k < 4; k++) { P(3, 12 - k * 2, 9, 2, k % 2 ? '#c89226' : '#e4b434'); P(3, 12 - k * 2, 9, 1, '#f6d458'); }
      P(7, 2, 7, 3, '#e4b434'); P(8, 2, 5, 1, '#fff2a0');
      break;
    case 'hide':
      P(3, 3, 10, 10, '#b8804e'); P(1, 2, 3, 3, '#a06840'); P(12, 2, 3, 3, '#a06840');
      P(1, 11, 3, 3, '#a06840'); P(12, 11, 3, 3, '#a06840'); P(5, 5, 4, 3, '#cc9a64');
      break;
    case 'leather':
      P(2, 4, 12, 8, '#875434'); P(2, 4, 12, 1, '#a06840'); P(11, 4, 3, 8, '#6e432a');
      P(12, 6, 2, 4, '#45291a'); P(2, 11, 12, 1, '#583522');
      break;
    case 'leatherArmor':
      P(3, 3, 10, 11, '#875434'); P(1, 3, 3, 5, '#6e432a'); P(12, 3, 3, 5, '#6e432a');
      P(6, 2, 4, 2, '#45291a'); P(7, 3, 2, 10, '#583522'); P(4, 8, 8, 1, '#45291a');
      P(4, 5, 1, 1, '#c89226'); P(11, 5, 1, 1, '#c89226');
      break;
    case 'magicstone':
      P(6, 2, 4, 12, '#7e58cc'); P(7, 1, 2, 1, '#bea4f6'); P(6, 2, 2, 9, '#bea4f6');
      P(2, 7, 4, 7, '#6440a8'); P(2, 7, 1, 5, '#9c7ae6'); P(10, 6, 4, 8, '#4c3080'); P(11, 6, 1, 6, '#7e58cc');
      P(7, 4, 1, 2, '#ffffff');
      break;
    case 'mana':
      P(5, 1, 6, 2, '#875434'); P(6, 3, 4, 2, '#cec6ba');
      P(3, 5, 10, 10, '#a6d2e6'); P(4, 7, 8, 7, '#3a74a0'); P(4, 7, 8, 2, '#76b2d4'); P(10, 8, 2, 6, '#22486c');
      P(5, 9, 1, 2, '#ffffff'); P(3, 14, 10, 1, '#5292bc');
      break;
    case 'staff':
      L(4, 15, 11, 4, '#875434', 2); L(4, 15, 11, 4, '#a06840', 1);
      P(10, 1, 5, 5, '#7e58cc'); P(11, 1, 2, 2, '#e2d6ff'); P(13, 3, 2, 3, '#4c3080');
      break;
    case 'mageArmor':
      P(4, 2, 8, 13, '#4c3080'); P(2, 4, 3, 6, '#38245c'); P(11, 4, 3, 6, '#38245c'); P(2, 13, 12, 2, '#38245c');
      P(6, 2, 4, 2, '#281a40'); P(7, 4, 2, 10, '#c89226'); P(5, 8, 1, 1, '#f6d458'); P(10, 11, 1, 1, '#e2d6ff');
      break;
    default:
      P(3, 3, 10, 10, GOODS[g] ? GOODS[g].color : '#ff00ff');
  }
}

function drawUiIcon(c, name) {
  if (drawIconGrid(c, 'ui', name, 0, 0)) return;
  const P = (a, b, w, h, col) => px(c, a, b, w, h, col);
  const L = (a, b, a2, b2, col, w) => pline(c, a, b, a2, b2, col, w);
  switch (name) {
    case 'log_all':   // свиток
      P(3, 2, 10, 12, '#e4d4a4'); P(3, 2, 10, 1, '#f6ecc8'); P(2, 2, 2, 12, '#b89a5c'); P(12, 2, 2, 12, '#b89a5c');
      for (const y of [5, 7, 9, 11]) P(5, y, 6, 1, '#6a4a2a');
      break;
    case 'log_animal':   // лапа
      P(5, 9, 6, 5, '#7a4a28'); P(6, 8, 4, 1, '#7a4a28'); P(6, 9, 4, 1, '#b8844e');
      P(2, 6, 3, 3, '#7a4a28'); P(5, 3, 2, 4, '#7a4a28'); P(9, 3, 2, 4, '#7a4a28'); P(12, 6, 3, 3, '#7a4a28');
      P(2, 6, 3, 1, '#b8844e'); P(5, 3, 2, 1, '#b8844e'); P(9, 3, 2, 1, '#b8844e'); P(12, 6, 3, 1, '#b8844e');
      break;
    case 'log_crow':   // ворона с блестящим в клюве
      P(1, 7, 3, 2, '#26262f'); P(3, 5, 8, 6, '#26262f'); P(4, 4, 5, 1, '#26262f'); P(9, 3, 4, 5, '#26262f'); P(5, 6, 4, 1, '#4a4a62');
      P(11, 4, 1, 1, '#e8e2c4'); P(13, 5, 2, 1, '#cfae58'); P(14, 6, 1, 2, '#ffd700'); P(6, 11, 1, 3, '#7a6444'); P(8, 11, 1, 3, '#7a6444'); P(4, 10, 6, 1, '#181820');
      break;
    case 'log_owl':   // сова
      P(4, 4, 8, 10, '#7a5a38'); P(3, 6, 1, 6, '#5a4026'); P(12, 6, 1, 6, '#5a4026'); P(4, 2, 2, 3, '#5a4026'); P(10, 2, 2, 3, '#5a4026');
      P(5, 6, 3, 3, '#f4e6b0'); P(9, 6, 3, 3, '#f4e6b0'); P(6, 7, 1, 2, '#1a1008'); P(10, 7, 1, 2, '#1a1008');
      P(7, 9, 2, 2, '#e0a030'); P(6, 11, 4, 3, '#c8a878'); P(5, 14, 2, 1, '#e0a030'); P(9, 14, 2, 1, '#e0a030');
      break;
    case 'log_food':   // каравай
      P(2, 7, 12, 6, '#8a5428'); P(3, 6, 10, 1, '#a8703a'); P(4, 5, 8, 1, '#c8904a'); P(3, 7, 10, 3, '#c8904a');
      P(5, 7, 1, 3, '#f0d6a8'); P(8, 6, 1, 3, '#f0d6a8'); P(11, 7, 1, 3, '#f0d6a8'); P(2, 13, 12, 1, '#5a3418');
      break;
    case 'log_night':   // месяц и звезда
      P(4, 6, 1, 4, '#f0e2a0'); P(5, 4, 1, 8, '#f0e2a0'); P(6, 3, 1, 10, '#f0e2a0'); P(7, 3, 1, 3, '#f0e2a0'); P(7, 10, 1, 3, '#f0e2a0');
      P(8, 3, 2, 2, '#f0e2a0'); P(8, 11, 2, 2, '#f0e2a0'); P(10, 3, 1, 1, '#f0e2a0'); P(10, 12, 1, 1, '#f0e2a0'); P(6, 4, 1, 8, '#d8c878');
      P(12, 4, 1, 4, '#fff6b8'); P(11, 5, 3, 1, '#fff6b8'); P(11, 10, 1, 1, '#c8c0f0'); P(13, 8, 1, 1, '#c8c0f0');
      break;
    case 'log_tree':   // ходячее дерево с глазами
      P(7, 9, 2, 5, '#5a3a1e'); P(5, 13, 2, 2, '#5a3a1e'); P(9, 13, 2, 2, '#5a3a1e');
      P(3, 3, 10, 7, '#3f7a2e'); P(5, 1, 6, 2, '#4f8e38'); P(3, 5, 1, 3, '#2a5a1e'); P(12, 5, 1, 3, '#2a5a1e');
      P(5, 5, 2, 1, '#ffe060'); P(9, 5, 2, 1, '#ffe060'); P(6, 8, 4, 1, '#15300f');
      break;
    case 'log_gold':   // монета
      P(5, 2, 6, 12, '#a87a10'); P(3, 4, 10, 8, '#a87a10'); P(4, 3, 8, 10, '#e4b434'); P(5, 4, 4, 1, '#fff2a0'); P(4, 5, 1, 4, '#fff2a0');
      P(7, 5, 2, 6, '#a87a10'); P(6, 6, 4, 1, '#a87a10'); P(6, 9, 4, 1, '#a87a10');
      break;
    case 'log_gossip':   // перепалка: пузырь с молнией
      P(2, 3, 12, 8, '#e8d8b0'); P(3, 2, 10, 1, '#e8d8b0'); P(3, 11, 10, 1, '#e8d8b0'); P(2, 3, 12, 1, '#fff6dc');
      P(4, 11, 3, 3, '#e8d8b0'); P(4, 14, 1, 1, '#e8d8b0');
      P(8, 4, 2, 2, '#c03a22'); P(7, 6, 2, 2, '#c03a22'); P(8, 8, 2, 2, '#c03a22'); P(6, 8, 1, 1, '#c03a22'); P(5, 5, 1, 1, '#6a4a2a'); P(12, 5, 1, 1, '#6a4a2a');
      break;
    case 'broom':   // метла
      L(3, 14, 11, 3, '#875434', 2); L(3, 14, 11, 3, '#a06840', 1);
      P(1, 11, 5, 4, '#c8a040'); P(1, 14, 6, 1, '#8a6a20'); P(2, 11, 1, 4, '#e0c060'); P(4, 11, 1, 4, '#e0c060'); P(10, 2, 3, 2, '#5c564f');
      break;
    case 'build':   // молоток
      L(3, 13, 10, 6, '#875434', 2); P(8, 2, 7, 4, '#867e74'); P(8, 2, 7, 1, '#cec6ba'); P(13, 3, 2, 3, '#5c564f');
      break;
    case 'store':   // ящик
      P(2, 5, 12, 9, '#a06840'); P(2, 5, 12, 2, '#cc9a64'); P(2, 9, 12, 1, '#6e432a'); P(7, 5, 2, 9, '#6e432a');
      P(3, 3, 10, 2, '#875434');
      break;
    case 'people':
      P(2, 5, 5, 5, '#d09c74'); P(2, 4, 5, 2, '#583522'); P(1, 10, 7, 5, '#875434');
      P(9, 3, 5, 5, '#e8bc94'); P(9, 2, 5, 2, '#24170f'); P(8, 8, 7, 7, '#4a6e30');
      break;
    case 'scroll':
      P(3, 2, 10, 12, '#e0b882'); P(2, 1, 12, 2, '#a06840'); P(2, 13, 12, 2, '#a06840');
      for (let k = 0; k < 4; k++) P(5, 5 + k * 2, 6 - (k % 2) * 2, 1, '#583522');
      break;
    case 'menu':
      for (let k = 0; k < 3; k++) { P(2, 3 + k * 4, 12, 2, '#cec6ba'); P(2, 4 + k * 4, 12, 1, '#867e74'); }
      break;
    case 'road':
      P(4, 1, 8, 14, '#a06840'); P(5, 1, 6, 14, '#cc9a64');
      P(6, 3, 2, 2, '#867e74'); P(8, 8, 2, 2, '#867e74'); P(6, 12, 2, 2, '#867e74');
      break;
    case 'erase':
      L(3, 3, 12, 12, '#ac3e2a', 3); L(12, 3, 3, 12, '#ac3e2a', 3);
      break;
    case 'pause':
      P(4, 3, 3, 10, '#e4ddd2'); P(9, 3, 3, 10, '#e4ddd2');
      break;
    case 'play':
      for (let k = 0; k < 6; k++) P(5 + k, 3 + k, 1, 10 - k * 2, '#8eab4c');
      break;
    case 'prev':
      for (let k = 0; k < 6; k++) P(10 - k, 3 + k, 1, 10 - k * 2, '#e0b882');
      break;
    case 'next':
      for (let k = 0; k < 6; k++) P(5 + k, 3 + k, 1, 10 - k * 2, '#e0b882');
      break;
    case 'eye':
      P(2, 6, 12, 4, '#f6f2ea'); P(4, 5, 8, 6, '#f6f2ea'); P(6, 5, 4, 6, '#3a74a0'); P(7, 6, 2, 4, '#160e0a');
      break;
    case 'trash':
      P(4, 4, 8, 10, '#867e74'); P(3, 3, 10, 2, '#b6ada0'); P(6, 1, 4, 2, '#b6ada0');
      P(6, 6, 1, 6, '#4a4540'); P(9, 6, 1, 6, '#4a4540');
      break;
    case 'save':
      P(2, 2, 12, 12, '#3a74a0'); P(4, 2, 8, 5, '#e4ddd2'); P(5, 9, 6, 5, '#22486c'); P(9, 3, 2, 3, '#22486c');
      break;
    case 'load':
      P(2, 6, 12, 8, '#c89226'); P(2, 4, 5, 2, '#a4701c'); P(3, 8, 10, 1, '#f6d458');
      break;
    case 'new':
      P(4, 2, 8, 12, '#f6f2ea'); P(10, 2, 2, 2, '#b6ada0'); P(6, 6, 4, 1, '#867e74'); P(6, 9, 4, 1, '#867e74');
      break;
    case 'warn':
      for (let k = 0; k < 7; k++) P(7 - k, 2 + k * 2, 2 + k * 2, 2, '#e4b434');
      P(7, 5, 2, 5, '#160e0a'); P(7, 11, 2, 2, '#160e0a');
      break;
    case 'noworker':
      P(4, 2, 7, 6, '#d09c74'); P(4, 1, 7, 2, '#583522'); P(3, 8, 9, 7, '#875434');
      P(11, 0, 4, 2, '#e4b434'); P(13, 2, 2, 2, '#e4b434'); P(12, 4, 2, 1, '#e4b434'); P(12, 6, 2, 2, '#e4b434');
      break;
    case 'deliver':   // открытые ворота и ящик
      P(1, 4, 9, 9, '#a06840'); P(1, 4, 9, 2, '#cc9a64'); P(5, 4, 1, 9, '#6e432a');
      for (let k = 0; k < 4; k++) P(11 + (k > 1 ? 1 : 0), 5 + k * 2, 3 - (k % 2), 1, '#8eab4c');
      P(11, 8, 4, 2, '#8eab4c');
      break;
    case 'nodeliver': // ящик под красным запретом
      P(3, 4, 10, 9, '#a06840'); P(3, 4, 10, 2, '#cc9a64'); P(7, 4, 2, 9, '#6e432a');
      L(2, 2, 14, 14, '#e0402a', 2.4); L(14, 2, 2, 14, '#e0402a', 2.4);
      break;
    case 'log':       // раскрытая книга записей
      P(1, 3, 7, 11, '#e8d4a8'); P(8, 3, 7, 11, '#f4e4c0'); P(7, 2, 2, 13, '#6e432a');
      for (let k = 0; k < 4; k++) { P(2, 5 + k * 2, 5, 1, '#875434'); P(9, 5 + k * 2, 5 - (k % 2) * 2, 1, '#875434'); }
      P(12, 0, 2, 5, '#c02a1e');
      break;
    case 'full':
      P(2, 4, 12, 10, '#a06840'); P(2, 4, 12, 2, '#cc9a64'); P(5, 0, 6, 4, '#e4b434');
      break;
  }
}

const ICON_URLS = {};
function iconURL(kind, name, scale = 1) {
  const key = kind + name + scale;
  if (ICON_URLS[key]) return ICON_URLS[key];
  const cv = mkCanvas(18, 18);
  const c = cv.getContext('2d');
  if (kind === 'good') drawGoodIcon(c, name, 1, 1); else { c.translate(1, 1); drawUiIcon(c, name); }
  finishPixel(cv, true);
  let out = cv;
  if (scale > 1) {
    out = mkCanvas(18 * scale, 18 * scale);
    const oc = out.getContext('2d');
    oc.imageSmoothingEnabled = false;
    oc.drawImage(cv, 0, 0, 18 * scale, 18 * scale);
  }
  ICON_URLS[key] = out.toDataURL();
  return ICON_URLS[key];
}

// Канвас иконки для рисования поверх карты (значки над зданиями).
const ICON_CANVAS = {};
function iconCanvas(kind, name) {
  const key = kind + name;
  if (ICON_CANVAS[key]) return ICON_CANVAS[key];
  const cv = mkCanvas(18, 18);
  const c = cv.getContext('2d');
  if (kind === 'good') drawGoodIcon(c, name, 1, 1); else { c.translate(1, 1); drawUiIcon(c, name); }
  finishPixel(cv, true);
  ICON_CANVAS[key] = cv;
  return cv;
}
