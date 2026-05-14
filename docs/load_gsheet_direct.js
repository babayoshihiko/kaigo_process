window.addEventListener("DOMContentLoaded", async () => {

  const gasUrl = "https://script.google.com/macros/s/AKfycbxCZQdHChtUbDvJ1XVJKMkWql1GhNS_QLjLAOY-BRp7oV8aFwSl7i0yzrNbh76tZlSvtw/exec";

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
    const adminRes = await fetch(
      `${gasUrl}?mode=admin&id=${ADMIN_SHEET_ID}`
    );

    const masterData = await adminRes.json();

    const row = masterData.find(d =>
      (d.School_name || "").toString().trim() === schoolName &&
      (d.Kakomon_name || "").toString().trim() === kakomonName
    );

    if (!row) {
      console.error("対象データが見つかりません");
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

    // Quiz data
    window.currentQuizData = data.quizData || [];

    // 描画
    if (typeof renderQuiz === "function") {
      renderQuiz(window.currentQuizData);
    }

  } catch (err) {
    console.error("通信エラー:", err);
  }

});