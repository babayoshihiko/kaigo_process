// ruby.js
class RubyConverter {
  constructor() {
    this.dictionary = {}; 
    this.sortedKanji = [];
  }

  // GASから届いたオブジェクト { "漢字": "読み" } をセットする
  setDictionary(obj) {
    if (!obj || typeof obj !== 'object') return;
    this.dictionary = obj;
    // 長い漢字から順にソート（「高齢者」を「高齢」より先に処理するため）
    this.sortedKanji = Object.keys(this.dictionary).sort((a, b) => b.length - a.length);
    console.log("Ruby dictionary updated:", this.dictionary);
  }

  convert(text) {
    if (!text || typeof text !== 'string') return text;
    if (!this.sortedKanji.length) return text;

    let convertedText = text;
    const placeholders = [];

    // 1. 長い単語から順にプレースホルダーへ置換
    for (const kanji of this.sortedKanji) {
      const ruby = this.dictionary[kanji];
      if (!ruby) continue;

      const escapedKanji = kanji.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escapedKanji, 'g');

      convertedText = convertedText.replace(regex, (match) => {
        const id = placeholders.length;
        // <ruby>タグを一時的に隠す
        placeholders.push(`<ruby>${match}<rt>${ruby}</rt></ruby>`);
        return `__RUBY_ID_${id}__`;
      });
    }

    // 2. プレースホルダーを実際のルビタグに戻す
    placeholders.forEach((rubyTag, i) => {
      const placeholderRegex = new RegExp(`__RUBY_ID_${i}__`, 'g');
      convertedText = convertedText.replace(placeholderRegex, rubyTag);
    });

    return convertedText;
  }
}

const rubyConverter = new RubyConverter();