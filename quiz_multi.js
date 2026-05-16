/* --- スコア管理用 --- */
let correctCount = 0;
let answeredCount = 0;
let currentQuizData = []; 

/* =========================
    データ処理系
========================= */

// 生の配列データ（CSVなど）から、正解・誤答を安全に配列化する関数
function convertToQuizData(csvData) {
  if (!Array.isArray(csvData)) return [];
  return csvData.map(row => {
    if (!row) return null;
    
    // 大文字小文字・スペースを無視して値を取り出すヘルパー
    const getSafeVal = (names) => {
      for (let name of names) {
        const matchKey = Object.keys(row).find(k => k.trim().toLowerCase() === name.toLowerCase());
        if (matchKey && row[matchKey] !== undefined && row[matchKey] !== null) {
          return row[matchKey].toString().trim();
        }
      }
      return "";
    };

    const question = getSafeVal(["question"]);
    if (!question || question.toLowerCase() === "question") return null;

    // 正解を集約 (correct, correct1 〜 correct5)
    let corrects = [];
    const mainCorrect = getSafeVal(["correct"]);
    if (mainCorrect) corrects.push(mainCorrect);
    for (let i = 1; i <= 5; i++) {
      const c = getSafeVal([`correct${i}`]);
      if (c) corrects.push(c);
    }
    corrects = [...new Set(corrects)].filter(Boolean);

    // 不正解を集約 (wrong, wrong1 〜 wrong10)
    let wrongs = [];
    const mainWrong = getSafeVal(["wrong"]);
    if (mainWrong) wrongs.push(mainWrong);
    for (let i = 1; i <= 10; i++) {
      const w = getSafeVal([`wrong${i}`]);
      if (w) wrongs.push(w);
    }
    wrongs = [...new Set(wrongs)].filter(Boolean);

    return {
      category: getSafeVal(["category"]) || "未分類",
      question: question,
      corrects: corrects,
      wrongs: wrongs, 
      explanation: getSafeVal(["explanation"]) || "解説はありません。"
    };
  }).filter(Boolean);
}

// 外部ファイル（CSV/JSON）読み込み関数
async function loadData(url) {
  const separator = url.includes('?') ? '&' : '?';
  const fullUrl = `${url}${separator}v=${new Date().getTime()}`;

  const res = await fetch(fullUrl);
  if (!res.ok) throw new Error("ファイルの取得に失敗しました");

  if (url.toLowerCase().endsWith(".json")) {
    const jsonData = await res.json();
    return convertToQuizData(jsonData);
  } 
  
  const text = await res.text();
  const csvResult = Papa.parse(text, { header: true, skipEmptyLines: true }).data;
  return convertToQuizData(csvResult);
}

/* =========================
    判定・UI制御系
========================= */

function toggleSelection(btn) {
  if (btn.parentElement.parentElement.querySelector(".submit-btn").disabled) return;
  btn.classList.toggle("selected");
}

function checkAnswerMulti(quizIndex, explanation) {
  const items = document.querySelectorAll(".quiz-item");
  const itemDiv = items[quizIndex];
  const result = itemDiv.querySelector(".result");
  const exp = itemDiv.querySelector(".explanation");
  const submitBtn = itemDiv.querySelector(".submit-btn");
  const choiceButtons = itemDiv.querySelectorAll(".choice-btn");

  const selectedButtons = Array.from(choiceButtons).filter(btn => btn.classList.contains("selected"));
  if (selectedButtons.length === 0) {
    alert("選択肢を1つ以上選んでください。");
    return;
  }

  submitBtn.disabled = true;
  choiceButtons.forEach(b => b.style.cursor = "default");
  answeredCount++;

  const selectedCorrectCount = selectedButtons.filter(btn => btn.dataset.correct === "true").length;
  const totalCorrectCount = Array.from(choiceButtons).filter(btn => btn.dataset.correct === "true").length;
  const isPerfect = (selectedCorrectCount === selectedButtons.length) && (selectedCorrectCount === totalCorrectCount);

  if (isPerfect) {
    result.textContent = "正解！";
    result.className = "result correct-text";
    correctCount++;
  } else {
    result.textContent = "不正解";
    result.className = "result wrong-text";
  }

  choiceButtons.forEach(btn => {
    if (btn.dataset.correct === "true") btn.classList.add("reveal-correct");
    if (btn.classList.contains("selected") && btn.dataset.correct === "false") btn.classList.add("reveal-wrong");
  });

  if (typeof updateScoreDisplay === "function") updateScoreDisplay();

  let html = marked.parse(explanation || "（解説なし）");
  if (typeof rubyConverter !== "undefined" && typeof rubyConverter.convert === "function") {
      html = rubyConverter.convert(html);
  }
  
  exp.innerHTML = DOMPurify.sanitize(html, { ADD_TAGS: ["ruby", "rt", "rp"] });
  exp.style.display = "block";
}

/* =========================
    表示・レンダリング系
========================= */

function renderQuiz(quizData, containerId = "quiz") {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error("器（container）が見つかりません:", containerId);
    return;
  }
  container.innerHTML = "読み込み中..."; // ← 実行されているか確認するための目印

  // 💡【ここが重要】データの入れ子構造を徹底的にバラす
  let raw = quizData;
  if (quizData && quizData.quizData) raw = quizData.quizData; // 階層が深い場合
  if (!Array.isArray(raw)) {
    console.warn("データが配列ではありません:", raw);
    container.innerHTML = "データの形式が正しくありません。";
    return;
  }

  if (raw.length === 0) {
    container.innerHTML = "表示できる問題が0件です。";
    return;
  }

  // 以降の map 処理などは、この 'raw' に対して行う
  let displayData = raw.map(q => {
    // すでに成形済みのデータ構造ならそのまま返す
    if (Array.isArray(q.corrects) && Array.isArray(q.wrongs)) {
      return q;
    }

    // 生データから直接プロパティを探す（大文字小文字両対応）
    const getVal = (names) => {
      for (let n of names) {
        if (q[n] !== undefined && q[n] !== null) return q[n].toString().trim();
        // 小文字変換して探す
        const foundKey = Object.keys(q).find(k => k.toLowerCase() === n.toLowerCase());
        if (foundKey && q[foundKey] !== undefined && q[foundKey] !== null) return q[foundKey].toString().trim();
      }
      return "";
    };

    const question = getVal(["question", "Question"]);
    if (!question) return null; // 問題文が本当になければスキップ

    let corrects = [];
    const cMain = getVal(["correct", "Correct"]);
    if (cMain) corrects.push(cMain);
    for (let i = 1; i <= 5; i++) {
      const c = getVal([`correct${i}`, `Correct${i}`]);
      if (c) corrects.push(c);
    }
    corrects = [...new Set(corrects)].filter(Boolean);

    let wrongs = [];
    const wMain = getVal(["wrong", "Wrong"]);
    if (wMain) wrongs.push(wMain);
    for (let i = 1; i <= 10; i++) {
      const w = getVal([`wrong${i}`, `Wrong${i}`]);
      if (w) wrongs.push(w);
    }
    wrongs = [...new Set(wrongs)].filter(Boolean);

    return {
      category: getVal(["category", "Category"]) || "未分類",
      question: question,
      corrects: corrects,
      wrongs: wrongs,
      explanation: getVal(["explanation", "Explanation"]) || "解説はありません。"
    };
  }).filter(Boolean); // 確実に有効なデータだけにする

  // configによる問題数制限（設定されている場合のみ）
  if (window.quizConfig && Object.keys(window.quizConfig).length > 0) {
    const hasValidConfig = Object.values(window.quizConfig).some(val => parseInt(val, 10) > 0);
    if (hasValidConfig) {
      const groups = displayData.reduce((acc, obj) => {
        const key = obj.category;
        if (!acc[key]) acc[key] = [];
        acc[key].push(obj);
        return acc;
      }, {});

      displayData = Object.keys(groups).flatMap(catName => {
        const configKey = Object.keys(window.quizConfig).find(k => k.trim() === catName);
        if (!configKey) return groups[catName];
        const limit = parseInt(window.quizConfig[configKey], 10);
        if (isNaN(limit) || limit <= 0) return groups[catName];
        return shuffle([...groups[catName]]).slice(0, limit);
      });
    }
  }

  currentQuizData = displayData; 
  let currentCategory = "";

  displayData.forEach((q, index) => {
    if (q.category && q.category !== currentCategory) {
      currentCategory = q.category;
      const categoryTitle = document.createElement("h3");
      categoryTitle.className = "category-title";
      categoryTitle.textContent = currentCategory;
      container.appendChild(categoryTitle);
    }

    const div = document.createElement("div");
    div.classList.add("quiz-item");

    // N択数の決定 (HTML側の window.kakomonNChoice、指定がなければ5)
    const nChoice = window.kakomonNChoice || 5;
    const actualCorrects = q.corrects || [];
    const actualWrongs = q.wrongs || [];
    
    // 必要な誤答の数
    const neededW = nChoice - actualCorrects.length;
    const selectedWrongs = shuffle([...actualWrongs]).slice(0, Math.max(0, neededW));
    
    const allChoices = [
      ...actualCorrects.map(c => ({ text: c, isCorrect: true })),
      ...selectedWrongs.map(w => ({ text: w, isCorrect: false }))
    ];
    
    const shuffled = shuffle([...allChoices]);
    const qText = (typeof rubyConverter !== "undefined") ? rubyConverter.convert(mdInline(q.question)) : mdInline(q.question);
    
    let html = `<p><strong>Q${index + 1}. ${qText}</strong></p>`;
    html += `<div class="choices-container">`;
    shuffled.forEach(choice => {
      const cText = (typeof rubyConverter !== "undefined") ? rubyConverter.convert(mdInline(choice.text)) : mdInline(choice.text);
      html += `<button type="button" class="choice-btn" data-correct="${choice.isCorrect}" onclick="toggleSelection(this)">${cText}</button>`;
    });
    html += `</div>`;

    const safeExp = q.explanation ? JSON.stringify(q.explanation) : '""';
    html += `
      <button class="submit-btn" onclick='checkAnswerMulti(${index}, ${safeExp})'>回答を確定</button>
      <p class="result"></p>
      <div class="explanation" style="display:none;"></div>
    `;

    div.innerHTML = html;
    container.appendChild(div);
  });
  
  if (typeof updateScoreDisplay === "function") updateScoreDisplay();
}

function shuffle(array) {
  if (!Array.isArray(array)) return [];
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function mdInline(text) {
  if (!text) return "";
  const html = marked.parse(text.toString().replace(/\\n/g, "\n") || "").replace(/^<p>|<\/p>\n?$/g, "");
  return DOMPurify.sanitize(html, { ADD_TAGS: ["ruby", "rt", "rp"] });
}

/* =========================
    スコア表示
========================= */

function updateScoreDisplay() {
  const scoreDiv = document.getElementById("score");
  if (!scoreDiv) return;
  const rate = answeredCount === 0 ? 0 : Math.round((correctCount / answeredCount) * 100);
  const comments = {
    start: ["まずは一問！", "ここからスタート！"],
    low: ["がんばれ！", "復習しよう"],
    high: ["この調子！", "完璧に近い！"]
  };

  let comment = (answeredCount === 0) ? comments.start[Math.floor(Math.random() * comments.start.length)] : (rate < 60 ? comments.low[Math.floor(Math.random() * comments.low.length)] : comments.high[Math.floor(Math.random() * comments.high.length)]);

  scoreDiv.innerHTML = `
    <div style="display: flex; align-items: center; gap: 10px; padding: 10px; background: #fdfdfd; border-radius: 10px; border: 1px solid #eee; max-width: fit-content; margin-bottom: 20px;">
      <img src="Baba.png" alt="Baba" width="80" height="80" style="border-radius: 50%; border: 2px solid #007bff; background:white; object-fit: cover;">
      <div>
        <div style="font-weight: bold; font-size: 1.1rem;">スコア: ${correctCount}/${answeredCount} (${rate}%)</div>
        <div style="font-size: 0.9rem; color: #555; margin-top: 4px;">${comment}</div>
      </div>
    </div>
  `;
}

/* =========================
    印刷関連
========================= */
function preparePrint() {
  if (!currentQuizData || currentQuizData.length === 0) {
    alert("データがありません。");
    return;
  }
  renderQuizForPrint(currentQuizData);
}

function renderQuizForPrint(quizData) {
  const container = document.getElementById("quiz");
  if (!container) return;

  container.innerHTML = `
    <h2 style="text-align:center; margin-bottom: 2rem;">確認テスト</h2>
    <p style="text-align:right; margin-bottom: 2rem;">氏名：__________________________</p>
  `;

  const nChoice = window.kakomonNChoice || 5;

  quizData.forEach((q, index) => {
    const div = document.createElement("div");
    div.style.marginBottom = "2rem";
    div.style.pageBreakInside = "avoid"; 
    div.style.breakInside = "avoid";     

    const actualCorrects = q.corrects || [];
    const actualWrongs = q.wrongs || [];

    const neededW = nChoice - actualCorrects.length;
    const selectedWrongs = shuffle([...actualWrongs]).slice(0, Math.max(0, neededW));

    const choices = [
      ...actualCorrects,       
      ...selectedWrongs    
    ];

    const qText = (typeof rubyConverter !== "undefined") ? rubyConverter.convert(mdInline(q.question)) : mdInline(q.question);
    let html = `<p><strong>問${index + 1}. ${qText}</strong></p>`;
    
    choices.forEach((c, i) => {
      const cText = (typeof rubyConverter !== "undefined") ? rubyConverter.convert(mdInline(c)) : mdInline(c);
      html += `<div style="margin-left: 20px; margin-bottom: 0.5rem;">（ ${i + 1} ） ${cText}</div>`;
    });

    div.innerHTML = html;
    container.appendChild(div);
  });

  setTimeout(() => { 
    window.print(); 
    location.reload(); 
  }, 500);
}