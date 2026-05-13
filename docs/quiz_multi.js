/* --- スコア管理用 --- */
let correctCount = 0;
let answeredCount = 0;
let currentQuizData = []; 

/* =========================
    読み込み・データ処理系
========================= */

// データ変換：CSV用
function convertToQuizData(csvData) {
  return csvData.map(row => {
    const findKey = (name) => Object.keys(row).find(k => k.trim().toLowerCase() === name);
    const getVal = (name) => {
      const key = findKey(name);
      return key ? row[key].toString().trim() : "";
    };

    const question = getVal("question");
    if (!question || question.toLowerCase() === "question") return null;

    const corrects = [
      getVal("correct"), getVal("correct1"), getVal("correct2"), getVal("correct3")
    ].filter(Boolean);

    const allWrongs = [
      getVal("wrong1"), getVal("wrong2"), getVal("wrong3"), getVal("wrong4"), getVal("wrong5")
    ].filter(Boolean);

    const neededWrongCount = 5 - corrects.length;
    const selectedWrongs = shuffle([...allWrongs]).slice(0, Math.max(0, neededWrongCount));

    return {
      category: getVal("category"),
      question: question,
      corrects: corrects,
      wrongs: selectedWrongs,
      explanation: getVal("explanation") || "解説はありません。"
    };
  }).filter(Boolean);
}

// 統合読み込み関数
async function loadData(url) {
  const separator = url.includes('?') ? '&' : '?';
  const fullUrl = `${url}${separator}v=${new Date().getTime()}`;

  const res = await fetch(fullUrl);
  if (!res.ok) throw new Error("ファイルの取得に失敗しました");
  
  // ★重要：外部CSVではなく、GASからルビが届く場合は loadDictionary は不要ですが、
  // 念のため CSV 読み込みを残す場合はここに記述。
  // 今回は index.html 側で setDictionary するのでここはスキップ可。

  if (url.toLowerCase().endsWith(".json")) {
    const jsonData = await res.json();
    return jsonData.map(q => {
      const question = q.question || "";
      const explanation = q.explanation || "解説なし";
      const rawCorrects = q.corrects ? (Array.isArray(q.corrects) ? q.corrects : [q.corrects]) : [q.correct || ""];
      const corrects = rawCorrects.filter(Boolean).map(c => c);
      const rawWrongs = q.wrongs || [];
      const wrongs = rawWrongs.filter(Boolean).map(w => w);

      const neededW = 5 - corrects.length;
      const shuffledWrongs = shuffle([...wrongs]).slice(0, Math.max(0, neededW));

      return {
        ...q,
        question: question,
        corrects: corrects,
        wrongs: shuffledWrongs,
        explanation: explanation
      };
    });
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

  updateScoreDisplay();

  // ★ 解説文のルビ適用
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
  if (!container) return;
  container.innerHTML = "";

  let displayData = [...quizData];

  // 絞り込み処理
  if (window.quizConfig && Object.keys(window.quizConfig).length > 0) {
    const groups = displayData.reduce((acc, obj) => {
      const key = (obj.category || obj.Category || "未分類").toString().trim();
      if (!acc[key]) acc[key] = [];
      acc[key].push(obj);
      return acc;
    }, {});

    displayData = Object.keys(groups).flatMap(catName => {
      let group = [...groups[catName]];
      const configKey = Object.keys(window.quizConfig).find(k => k.trim() === catName);
      let limit = configKey ? parseInt(window.quizConfig[configKey], 10) : null;
      if (limit !== null && !isNaN(limit) && limit > 0) {
        group = shuffle(group).slice(0, limit);
      }
      return group;
    });
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

    const allChoices = [
      ...q.corrects.map(text => ({ text, isCorrect: true })),
      ...q.wrongs.map(text => ({ text, isCorrect: false }))
    ];
    const shuffled = shuffle([...allChoices]);

    // ★ 問題文と選択肢のルビ適用
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

  let comment = (answeredCount === 0) ? getRandom(comments.start) : (rate < 60 ? getRandom(comments.low) : getRandom(comments.high));

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

function getRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// 印刷関連はそのまま維持
function preparePrint() {
  if (!currentQuizData || currentQuizData.length === 0) {
    alert("データがありません。");
    return;
  }
  renderQuizForPrint(currentQuizData);
}

function renderQuizForPrint(quizData) {
  const container = document.getElementById("quiz");
  container.innerHTML = `<h2 style="text-align:center;">確認テスト</h2><p style="text-align:right;">氏名：__________________________</p>`;
  quizData.forEach((q, index) => {
    const div = document.createElement("div");
    div.style.marginBottom = "2rem";
    const choices = shuffle([...q.corrects, ...q.wrongs]);
    div.innerHTML = `<p><strong>問${index + 1}. ${mdInline(q.question)}</strong></p>` + 
      choices.map((c, i) => `<div style="margin-left:20px;">（ ${i+1} ） ${mdInline(c)}</div>`).join('');
    container.appendChild(div);
  });
  setTimeout(() => { window.print(); location.reload(); }, 500);
}

document.addEventListener("DOMContentLoaded", () => {
  if (window.quizCSV || window.quizJSON) {
    // initQuizなどの初期化が必要な場合はここに記述
  }
});