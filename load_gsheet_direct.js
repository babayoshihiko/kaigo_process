window.addEventListener("DOMContentLoaded", async () => {

  const gasUrl = "https://script.google.com/macros/s/AKfycbw35-baYDgt2lpqZV4x2IwZU3JtyD6515pSNLjYRNG3GumhS2zNna4ikdep5YA4WElF/exec";
  const ADMIN_SHEET_ID = "1RnQ8aRHT8uLhBY82Veq9WdVl_GOsZRYFXrkEI_11mls";

  // ページごとに設定される値
  const schoolName = window.schoolName;
  const kakomonName = window.kakomonName;

  if (!schoolName || !kakomonName) {
    console.error("schoolName または kakomonName が未設定");
    return;
  }

  try {
    // Admin取得
    const adminRes = await fetch(`${gasUrl}?mode=admin&id=${ADMIN_SHEET_ID}`);
    const resData = await adminRes.json();

    // 💡【安全ガード①】GASからエラーオブジェクトが返ってきた場合の墜落防止
    if (resData && resData.error) {
      console.error("GAS側Adminエラー:", resData.error);
      return;
    }

    // 💡【安全ガード②】masterDataが確実に配列であることを保証する
    const masterData = Array.isArray(resData) ? resData : (resData ? [resData] : []);

    // データの検索
    const row = masterData.find(d =>
      (d.School_name || "").toString().trim() === schoolName.toString().trim() &&
      (d.Kakomon_name || "").toString().trim() === kakomonName.toString().trim()
    );

    if (!row) {
      // 💥【超重要】データが見つからなくても、システムを墜落させず安全にログだけ残す
      console.warn(`対象データが見つかりません。設定を確認してください。 (学校: ${schoolName}, 過去問: ${kakomonName})`);
      return; 
    }

    const selectedId = (row.Kakomon_ID || "").toString().trim();
    const qSheet = (row.Kakomon_sheet || "").toString().trim();
    const rSheet = (row.Ruby_sheet || "").toString().trim();
    const cSheet = (row.Category_sheet || "").toString().trim();

    // Quiz取得
    const quizUrl =
      `${gasUrl}?mode=quiz` +
      `&id=${selectedId}` +
      `&sheetName=${encodeURIComponent(qSheet)}` +
      `&rubySheetName=${encodeURIComponent(rSheet)}` +
      `&configSheetName=${encodeURIComponent(cSheet)}`;

    const quizRes = await fetch(quizUrl);
    const data = await quizRes.json();

    if (data.error) {
      console.error("GASエラー:", data.error);
      return;
    }

    // Ruby辞書
    if (data.ruby && typeof rubyConverter !== "undefined") {
      rubyConverter.setDictionary(data.ruby);
    }

    // Config
    window.quizConfig = data.quizConfig || {};

    // 💡【超重要修正】
    // GASから届いた生のクイズデータを、共通JSの renderQuiz が求めている
    // 正しい『corrects（配列）』『wrongs（配列）』の形にこの場で安全に仕分ける
    const rawData = data.quizData || [];
    const formattedData = rawData.map(q => {
      const getVal = (keyName) => {
        const matchKey = Object.keys(q).find(k => k.trim().toLowerCase() === keyName.toLowerCase());
        return matchKey ? q[matchKey].toString().trim() : "";
      };

      // correct, correct1〜5 を集約
      let corrects = [];
      if (getVal("correct")) corrects.push(getVal("correct"));
      for (let i = 1; i <= 5; i++) { if (getVal(`correct${i}`)) corrects.push(getVal(`correct${i}`)); }
      corrects = [...new Set(corrects)].filter(Boolean);

      // wrong, wrong1〜10 を集約
      let wrongs = [];
      if (getVal("wrong")) wrongs.push(getVal("wrong"));
      for (let i = 1; i <= 10; i++) { if (getVal(`wrong${i}`)) wrongs.push(getVal(`wrong${i}`)); }
      wrongs = [...new Set(wrongs)].filter(Boolean);

      return {
        category: q.category || getVal("category") || "未分類",
        question: q.question || getVal("question"),
        corrects: corrects,
        wrongs: wrongs,
        explanation: q.explanation || getVal("explanation") || "解説はありません。"
      };
    }).filter(item => item.question);

    // クイズデータをグローバルに格納
    window.currentQuizData = formattedData;

    // 描画
    if (typeof renderQuiz === "function") {
      renderQuiz(window.currentQuizData);
    }

  } catch (err) {
    console.error("通信エラー:", err);
  }
});