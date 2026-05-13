// ruby.js
class RubyConverter {
  constructor() {
    this.dictionary = {}; 
    this.sortedKanji = [];
  }

    // GASから届いたオブジェクト { "漢字": "読み" } をセットする
    setDictionary(data) {
      // data が [{word: "...", read: "..."}, ...] の形式であることを想定
      this.dictionary = {};
      this.sortedKanji = [];
    
      if (!Array.isArray(data)) return;
    
      data.forEach(item => {
        if (item.word && item.read) {
          // 漢字をキー、オブジェクトを値として格納
          this.dictionary[item.word] = item;
          this.sortedKanji.push(item.word);
        }
      });
    
      // 長い単語から順に変換しないと、短い単語に先に反応してしまうのを防ぐ
      this.sortedKanji.sort((a, b) => b.length - a.length);
    }


    convert(text) {
      if (!text || typeof text !== 'string') return text;
      if (!this.sortedKanji || !this.sortedKanji.length) return text;
  
      let convertedText = text;
      const placeholders = [];
  
      // 1. 長い単語から順にプレースホルダーへ置換
      for (const kanji of this.sortedKanji) {
        const item = this.dictionary[kanji];
        // itemが取得できない、またはreadプロパティがない場合はスキップ
        if (!item || !item.read) continue;
  
        const escapedKanji = kanji.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escapedKanji, 'g');
  
        convertedText = convertedText.replace(regex, (match) => {
          const id = placeholders.length;
          // ${item.read} とすることで、オブジェクトから読み文字列を抽出
          placeholders.push(`<ruby>${match}<rt>${item.read}</rt></ruby>`);
          return `__RUBY_ID_${id}__`;
        });
      }
  
      // 2. プレースホルダーを実際の <ruby> タグに戻す
      return convertedText.replace(/__RUBY_ID_(\d+)__/g, (match, id) => {
        return placeholders[id];
      });
    }

}

const rubyConverter = new RubyConverter();