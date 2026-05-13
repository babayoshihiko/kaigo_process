/* --- スコア管理用 --- */
let correctCount = 0;
let answeredCount = 0;
let currentQuizData = []; 

/* =========================
   読み込み・データ処理系
========================= */

// データ変換：CSV(Google Spread)用。correct と wrongs に分ける
function convertToQuizData(csvData) {
  // 事前に辞書をロードしておく（初期化時など）
  await rubyConverter.loadDictionary('ruby_table.csv');

  return csvData.map(row => {
    const findKey = (name) => Object.keys(row).find(k => k.trim().toLowerCase() === name);
    const getVal = (name) => {
      const key = findKey(name);
      return key ? row[key].toString().trim() : "";
    };

    const question = rubyConverter.convert(getVal("question"));
    if (!question || question.toLowerCase() === "question") return null;

    return {
      category: getVal("category"),
      question: question,
      correct: rubyConverter.convert(getVal("correct")), // 正解
      wrongs: [
        rubyConverter.convert(getVal("wrong1")),
        rubyConverter.convert(getVal("wrong2")),
        rubyConverter.convert(getVal("wrong3")),
        rubyConverter.convert(getVal("wrong4"))
      ].filter(Boolean), // 誤答を配列にする
      explanation: rubyConverter.convert(getVal("explanation")) || rubyConverter.convert("解説はありません。")
    };
  }).filter(Boolean);
}

// 統合読み込み関数（Google / CSV / JSON 対応）
async function loadData(url) {
  // URLに応じてキャッシュバスターの記号を変える
  const separator = url.includes('?') ? '&' : '?';
  const fullUrl = `${url}${separator}v=${new Date().getTime()}`;

  const res = await fetch(fullUrl);
  if (!res.ok) throw new Error("ファイルの取得に失敗しました");

  // JSONの場合
  if (url.toLowerCase().endsWith(".json")) {
    const jsonData = await res.json();
    // JSONが古い形式（choices）だった場合の互換性維持
    return jsonData.map(q => {
      if (q.choices && !q.correct) {
        return {
          ...q,
          correct: q.choices[0],
          wrongs: q.choices.slice(1)
        };
      }
      return q;
    });
  } 
  
  // CSV / Google Spread の場合
  const text = await res.text();
  const csvResult = Papa.parse(text, { header: true, skipEmptyLines: true }).data;
  return convertToQuizData(csvResult);
}

function checkAnswer(btn, explanation) {
  const parent = btn.parentElement;
  const result = parent.querySelector(".result");
  const exp = parent.querySelector(".explanation");
  const buttons = parent.querySelectorAll("button");

  if (buttons[0].disabled) return;
  buttons.forEach(b => b.disabled = true);

  answeredCount++;

  if (btn.dataset.correct === "true") {
    btn.classList.add("correct");
    result.textContent = "正解！";
    correctCount++;
  } else {
    btn.classList.add("wrong");
    result.textContent = "不正解";
    // 正解ボタンをハイライト
    buttons.forEach(b => {
      if (b.dataset.correct === "true") b.classList.add("correct");
    });
  }

  updateScoreDisplay();
  const html = marked.parse(explanation || "（解説なし）");
  exp.innerHTML = DOMPurify.sanitize(html, { ADD_TAGS: ["ruby", "rt"] });
  exp.style.display = "block";
}

/* =========================
   表示・クイズ制御系
========================= */

function renderQuiz(quizData, containerId = "quiz") {
  const container = document.getElementById(containerId);
  const popupContainer = document.getElementById("popup-container");
  if (!container) return;

  if (popupContainer) popupContainer.style.display = "flex";
  container.innerHTML = "";

  let currentCategory = ""; // 現在表示中のカテゴリを保持

  quizData.forEach((q, index) => {
    // --- カテゴリ見出しの挿入 ---
    if (q.category && q.category !== currentCategory) {
      currentCategory = q.category;
      const categoryTitle = document.createElement("h3");
      categoryTitle.style.marginTop = "2em";
      categoryTitle.style.borderLeft = "5px solid #007bff";
      categoryTitle.style.paddingLeft = "10px";
      categoryTitle.textContent = currentCategory;
      container.appendChild(categoryTitle);
    }

    const div = document.createElement("div");
    div.style.marginBottom = "2em";
    div.classList.add("quiz-item");

    let html = `<p><strong>Q${index + 1}. ${mdInline(q.question)}</strong></p>`;

    const allChoices = [
      { text: q.correct, isCorrect: true },
      ...q.wrongs.map(w => ({ text: w, isCorrect: false }))
    ];
    const shuffled = shuffle([...allChoices]);

    shuffled.forEach(choice => {
      const safeExp = q.explanation ? JSON.stringify(q.explanation) : '""';
      html += `<button 
                data-correct="${choice.isCorrect}" 
                onclick='checkAnswer(this, ${safeExp})'>
                ${mdInline(choice.text)}
              </button>`;
    });

    html += `<p class="result"></p><p class="explanation" style="display:none;"></p>`;
    div.innerHTML = html;
    container.appendChild(div);
  });
  
  updateScoreDisplay();
}

/* =========================
   印刷機能
========================= */

// 印刷ボタンから呼び出される関数
function preparePrint() {
  // currentQuizData または window.currentQuizData を参照
  const data = currentQuizData || window.currentQuizData;
  
  if (!data || data.length === 0) {
    alert("クイズデータが準備できていません。画面に問題が表示されてから実行してください。");
    return;
  }
  // 印刷用レンダリングを実行
  renderQuizForPrint(data);
}

// 印刷用レンダリング
function renderQuizForPrint(quizData) {
  const container = document.getElementById("quiz");
  const popupContainer = document.getElementById("popup-container");

  if (popupContainer) popupContainer.style.display = "none";

  container.innerHTML = `
    <div style="text-align:center; border-bottom: 2px solid #000; margin-bottom: 20px;">
      <h2>確認テスト</h2>
      <p style="text-align:right;">氏名：__________________________</p>
    </div>
  `;

  let currentCategory = ""; // カテゴリ管理用

  quizData.forEach((q, index) => {
    // --- カテゴリ見出しの挿入 ---
    if (q.category && q.category !== currentCategory) {
      currentCategory = q.category;
      const categoryTitle = document.createElement("h3");
      categoryTitle.style.borderBottom = "1px solid #666";
      categoryTitle.style.marginTop = "30px";
      categoryTitle.style.marginBottom = "15px";
      categoryTitle.style.paddingBottom = "5px";
      categoryTitle.textContent = currentCategory;
      container.appendChild(categoryTitle);
    }

    const div = document.createElement("div");
    div.style.breakInside = "avoid";
    div.style.pageBreakInside = "avoid";
    div.style.marginBottom = "2.5rem";

    // 選択肢を合体・シャッフル
    const choices = shuffle([q.correct, ...q.wrongs]);

    div.innerHTML = `
      <p style="margin-bottom: 0.5rem;"><strong>問${index + 1}. ${mdInline(q.question)}</strong></p>
      <div style="margin-left: 20px;">
        ${choices.map((c, i) => `<div style="margin-bottom: 6px;">（ ${i + 1} ） ${mdInline(c)}</div>`).join('')}
      </div>
    `;
    container.appendChild(div);
  });

  setTimeout(() => {
    window.print();
    renderQuiz(quizData); // 印刷後に元の画面に戻す
  }, 500);
}

/* =========================
   共通ツール・初期化
========================= */

function getRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function updateScoreDisplay() {
  const scoreDiv = document.getElementById("score");
  if (!scoreDiv) return;

  const rate = answeredCount === 0 ? 0 : Math.round((correctCount / answeredCount) * 100);

  const comments = {
    start: ["まずは一問！", "ここからスタート！", "気軽に始めよう"],
    low: ["がんばれ！", "まだ伸びる！", "ここからが勝負", "復習しよう"],
    high: ["この調子！", "いい感じ！", "そのまま突き進め", "完璧に近い！"]
  };

  let comment;
  if (answeredCount === 0) {
    comment = getRandom(comments.start);
  } else if (rate < 60) {
    comment = getRandom(comments.low);
  } else {
    comment = getRandom(comments.high);
  }

  scoreDiv.innerHTML = `
    <div style="display: flex; align-items: center; gap: 10px; padding: 5px;">
      <img src="Baba.png" alt="Baba" width="80" height="80" style="border-radius: 50%; border: 2px solid #007bff; background:white;">
      <div>
        <div style="font-weight: bold;">スコア: ${correctCount}/${answeredCount} (${rate}%)</div>
        <div style="font-size: 0.8rem; color: #444;">${comment}</div>
      </div>
    </div>
  `;
}

function mdInline(text) {
  const formattedText = text.replace(/\\n/g, "\n");
  const html = marked.parse(formattedText || "").replace(/^<p>|<\/p>\n?$/g, "");
  return DOMPurify.sanitize(html, { ADD_TAGS: ["ruby", "rt"] });
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/* =========================
   共通ツール・初期化
========================= */

async function initQuiz() {
  const container = document.getElementById("quiz");
  const url = window.quizCSV || window.quizJSON;
  const config = window.quizConfig;
  if (!container || !url) return;

  try {
    container.innerHTML = "データを読み込み中...";
    const allData = await loadData(url);
    
    let finalQuizData = [];

    if (config && Object.keys(config).length > 0) {
      // 設定がある場合：カテゴリごとに抽出してシャッフル
      Object.keys(config).forEach(cat => {
        const count = config[cat];
        const filtered = allData.filter(q => q.category && q.category.trim() === cat.trim());
        if (filtered.length > 0) {
          const subset = shuffle([...filtered]).slice(0, count);
          finalQuizData = finalQuizData.concat(subset);
        }
      });
      // 注意：ここでは全体の shuffle(finalQuizData) は行わず、カテゴリの並びを維持します
    } else {
      // 設定がない場合：カテゴリごとにグループ化して、その中でシャッフル
      const categories = [...new Set(allData.map(q => q.category))];
      categories.forEach(cat => {
        const filtered = allData.filter(q => q.category === cat);
        finalQuizData = finalQuizData.concat(shuffle([...filtered]));
      });
    }

    if (finalQuizData.length === 0) finalQuizData = allData;
    currentQuizData = finalQuizData; 
    renderQuiz(finalQuizData);
  } catch (e) {
    console.error(e);
    container.innerHTML = `<p style="color:red;">エラー: ${e.message}</p>`;
  }
}

document.addEventListener("DOMContentLoaded", initQuiz);