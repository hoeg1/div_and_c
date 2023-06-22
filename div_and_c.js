"use strict";

export const popcount =  bits => {
  bits = (bits & 0x55555555) + (bits >> 1 & 0x55555555);
  bits = (bits & 0x33333333) + (bits >> 2 & 0x33333333);
  bits = (bits & 0x0f0f0f0f) + (bits >> 4 & 0x0f0f0f0f);
  bits = (bits & 0x00ff00ff) + (bits >> 8 & 0x00ff00ff);
  return (bits & 0x0000ffff) + (bits >>16 & 0x0000ffff);
};

export const ntz = x => {
  return popcount( (x & (-x)) - 1 );
};

//                    QJT9876543210
export const DECK = 0b1011111111100;

export class DivAndC {
  constructor(view, com) {
    this.view = view;
    this.start_hand = [DECK, 0];
    for (let i = 0; i < 5;) {
      const rnd = 1 << Math.trunc(Math.random() * 13);
      if ((this.start_hand[0] & rnd) != 0) {
        this.start_hand[0] &= ~rnd;
        this.start_hand[1] |= rnd;
        i += 1;
      }
    }
    this.hand = [this.start_hand[0], this.start_hand[1]];
    this.score = [0, 0];
    this.round = 0;
    this.com = com;
    this.is_finish = false;
  }
  why(a, b) {
    if (a > b) {
      if (a - b == 1) return `COM[${b}] が Player[${a}] より１小さいため`;
      if (a % b == 0) return `COM[${b}] が Player[${a}] を割り切れるので`;
      return `Player[${a}] が COM[${b}] より大きいため`;
    } else {
      if (b - a == 1) return `Player[${a}] が COM[${b}] より１小さいため`;
      if (b % a == 0) return `Player[${a}] が COM[${b}] を割り切れるので`;
      return `COM[${b}] が Player[${a}] より大きいため`;
    }
  }
  // 0 -> 次のカードを出す
  // 1 -> 前半戦終了
  // 2 -> 後半戦終了＝ゲーム終了
  // card -> ビットで表現されたカード
  play(card) {
    if (this.is_finish) return;
    const a = ntz(card);
    const com_card = popcount(this.hand[1]) == 1? this.hand[1]:
      this.com.think(this.hand[0], this.hand[1]);
    const b = ntz(com_card);
    if ((this.hand[0] & card) == 0 || (this.hand[1] & com_card) == 0) {
      throw new Error(`sys err: 0b${card.toString(2)}, 0b${this.hand[0].toString(2)}: 0b${com_card.toString(2)}, 0b${this.hand[1].toString(2)}`);
    }
    this.view.show_hand(card, com_card);
    // a が勝つならT、でなきゃF
    const w = a > b? (a - b != 1 && a % b != 0): (b - a == 1 || b % a == 0);
    this.score[ w? 0: 1 ] += 1;
    this.hand[0] &= ~card;
    this.hand[1] &= ~com_card;
    this.view.vp(this.score);
    this.view.mes(this.why(a,b) + ' ' + (w? "Player": "COM") + " の勝ち: 次を選択");
    if (this.hand[0] == 0 || this.score[ w? 0: 1 ] >= 6) {
      if (this.round == 0) {
        this.hand = [this.start_hand[1], this.start_hand[0]];
        this.round = 1;
        this.view.round_end();
        return 1; // next round
      } else {
        this.is_finish = true;
        const msg = this.score[0] == this.score[1]?
            "引き分けです！":
            this.score[0] > this.score[1]?
              "Player の勝ち！":
              "Player の負けです……。";
        this.view.mes('最後の手札は ' + (w? "Player の勝ち":"COM の勝ち") +
          `。${this.score[0]} vs ${this.score[1]} で ${msg}`);
        this.view.game_over();
        return 2; // game over
      }
    }
    return 0; // next card
  }
}


const com1 = {
  name: 'Aho',
  think: (_op_hand, hand) => {
    while (hand != 0) {
      const rnd = 1 << Math.trunc(Math.random() * 13);
      if ((rnd & hand) != 0) return rnd;
    }
  },
};

const WIN_MASK = [
  0, 0, // skip 0, 1
//  QJT9876543210
  0b1010101011000, // 2 -> 12, 10, 8, 6, 4, 3
//  QJT9876543210
  0b1001001010000, // 3 -> 12, 9, 6, 4
//  QJT9876543210
  0b1000100100000, // 4 -> 12, 8, 5
//  QJT9876543210
  0b0010001001100, // 5 -> 10, 6, 3, 2
//  QJT9876543210
  0b1000010010000, // 6 -> 12, 7, 4
//  QJT9876543210
  0b0000100011100, // 7 -> 8, 4, 3, 2
//  QJT9876543210
  0b0010011110100, // 9 -> 10, 7, 6, 5, 4, 2
//  QJT9876543210
  0b0000111011000, // 10 -> 8, 7, 6, 4, 3
  0, // skip 11
//  QJT9876543210
  0b0011110100000, // 12 -> 10, 9, 8, 7, 5
];

const loop = function*(bits) {
  while (bits != 0) {
    const card = bits & (-bits);
    yield card;
    bits &= ~card;
  }
};

const com2 = {
  name: 'Beth',
  think: (op_hand, hand) => {
    const lst = [];
    for (const card of loop(hand)) {
      const pos = ntz(card);
      // この card が相手に勝てる枚数を計算 => 多いほど良い
      const cnt = popcount(op_hand & WIN_MASK[ pos ]) + (Math.random() / 2);
      lst.push({
        card: card,
        count: cnt
      });
    }
    lst.sort((a, b) => b.count - a.count);
    return lst[0].card;
  },
};

const com3 = {
  name: 'Criss',
  think: (op_hand, hand) => {
    const lst = [];
    for (const card of loop(hand)) {
      const pos = ntz(card);
      // この card が相手に負ける枚数を計算 => 少ないほど良い
      const cnt = popcount(op_hand & ~WIN_MASK[ pos ]) + (Math.random() / 2);
      lst.push({
        card: card,
        count: cnt
      });
    }
    lst.sort((a, b) => a.count - b.count);
    return lst[0].card;
  },
};

const com4 = {
  name: 'Deby',
  think: (a, b) =>
    Math.random() >= 0.5? com2.think(a, b): com3.think(a, b),
};

export const COM_LIST = [
  com1, com2, com3, com4
];

export const create_COM_list = () => {
  const box = document.createElement('div');
  box.setAttribute('id', 'sel_box');
  const start = document.createElement('button');
  start.innerText = "Start";
  start.addEventListener('click', () => {
    box.style.display = "none";
    new View();
  });
  const sel = document.createElement('select');
  sel.setAttribute('id', 'com_select');
  for (let i = 0; i < COM_LIST.length; ++i) {
    const opt = document.createElement('option');
    opt.innerText = `${i+1}. ${COM_LIST[ i ].name}`;
    if (i == 1) {
      opt.selected = true;
    }
    sel.appendChild(opt);
  }
  box.appendChild(sel);
  box.appendChild(start);
  return box;
};

export class View {
  constructor() {
    const sel = document.getElementById('com_select');
    this.game = new DivAndC(this, COM_LIST[ sel.selectedIndex ]);
    this.make_ai_box();
    this.make_player_box();
    this.mes('前半戦です。手札を選択してください。');
  }
  get_card_rank(card) {
    const RANK = ['e0', 'e1',
      '２','３','４','５','６','７','８','９','10', 'eJ', 'Ｑ'];
    return RANK[ ntz( card ) ];
  }
  make_ai_box() {
    const box = document.getElementById('ai_box');
    this.ai_card = [];
    for (const c of loop(this.game.hand[1])) {
      const card = document.createElement('div');
      card.setAttribute('class', 'ai_card');
      card.innerText = this.get_card_rank( c );
      this.ai_card.push({card: c, elm: card});
      box.appendChild(card);
    }
  }
  make_player_box() {
    const box = document.getElementById('player_box');
    for (const c of loop(this.game.hand[0])) {
      const card = document.createElement('button');
      card.setAttribute('class', 'player_card');
      card.innerText = this.get_card_rank( c );
      card.addEventListener('click', () => {
        if (!this.game.is_finish) {
          this.game.play(c);
          box.removeChild(card);
        }
      });
      box.appendChild(card);
    }
  }
  show_hand(p, o) {
    const card0 = document.createElement('div');
    card0.setAttribute('class', 'ai_card');
    card0.innerText = this.get_card_rank( p );
    const card1 = document.createElement('div');
    card1.setAttribute('class', 'ai_card');
    card1.innerText = this.get_card_rank( o );
    const tar = document.getElementById('board');
    while (tar.lastChild) tar.removeChild( tar.lastChild );
    tar.appendChild(card0);
    tar.appendChild(card1);
    const ai_box = document.getElementById('ai_box');
    for (const c of this.ai_card) {
      if (c.card == o) {
        ai_box.removeChild(c.elm);
        break;
      }
    }
  }
  mes(txt) {
    const tar = document.getElementById('msg_view');
    tar.innerText = txt;
  }
  vp(score) {
    const tar = document.getElementById('score_view');
    tar.innerText = `Player ${score[0]} pt --- ${score[1]} pt COM`;
  }
  round_end() {
    const box = document.getElementById('next_menu');
    const but = document.createElement('button');
    but.innerText = "後半戦 Start";
    but.addEventListener('click', () => {
      const bd = document.getElementById('board');
      while (bd.lastChild) bd.removeChild( bd.lastChild );
      this.mes('後半戦です。手札を選択してください。');
      box.removeChild(but);
      this.redraw();
    });
    box.appendChild(but);
  }
  redraw() {
    this.make_ai_box();
    this.make_player_box();
  }
  game_over() {
    const tar = document.getElementById('next_menu');
    const but = document.createElement('button');
    but.innerText = "RESTART";
    but.addEventListener('click', () => {
      window.location.reload();
    });
    tar.appendChild(but);
  }
}

window.onload = function() {
  const box = create_COM_list();
  const board = document.getElementById('start_menu');
  board.appendChild(box);
};

