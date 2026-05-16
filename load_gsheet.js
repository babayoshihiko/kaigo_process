window.addEventListener("DOMContentLoaded", async () => {

  // GASのURLとAdminシートID
  const gasUrl = "https://script.google.com/macros/s/AKfycbw35-baYDgt2lpqZV4x2IwZU3JtyD6515pSNLjYRNG3GumhS2zNna4ikdep5YA4WElF/exec";
  const ADMIN_SHEET_ID = "1RnQ8aRHT8uLhBY82Veq9WdVl_GOsZRYFXrkEI_11mls";

  // HTML側で指定された変数（介護過程 / アセスメント 等）を取得
  const schoolName = window.schoolName;
  const kakomonName = window.kakomonName;

  if (!schoolName || !kakomonName) {
    console.error("schoolName または kakomonName が未設定です。");
    return;
  }

  try {
    // 1. Adminシートから、対象の過去問がどのシートにあるかを探す
    const adminRes = await fetch(`${gasUrl}?mode=admin&id=${ADMIN_SHEET_ID}`);
    const masterData = await adminRes.json();

    // masterDataが配列でない場合のセーフティガード
    const dataList = Array.isArray(masterData) ? masterData : (masterData ? [masterData] : []);

    // HTMLの指定と一致する行を特定
    const row = dataList.find(d =>
      (d.School_name || "").toString().trim() === schoolName &&
      (d.Kakomon_name || "").toString().trim() === kakomonName
    );

    if (!row) {
      console.error(`Adminシート内に一致するデータが見つかりません: ${schoolName} / ${kakomonName}`);
      return;
    }

    // 2. 必要な情報を抽出
    const selectedId = (row.Kakomon_ID || "").toString().trim();
    const qSheet = (row.Kakomon_sheet || "").toString().trim();
    const rSheet = (row.Ruby_sheet || "").toString().trim();
    const cSheet = (row.Category_sheet || "").toString().trim();

    // 3. クイズ本番データの取得URLを構築
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

    // Ruby辞書の設定（もしあれば）
    if (data.ruby && typeof rubyConverter !== "undefined") {
      rubyConverter.setDictionary(data.ruby);
    }

    // カテゴリ出題数設定（もしあれば）
    window.quizConfig = data.quizConfig || {};

    // クイズデータをグローバル変数に格納
    // ※ 共通JS側の renderQuiz 内で「正解・誤答の配列化」を行うので、ここでは生のまま渡してOK
    window.currentQuizData = data.quizData || [];

    // 4. 共通JSの描画関数を呼び出す
    if (typeof renderQuiz === "function") {
      // 第一引数にデータ、第二引数にHTMLのID "quiz" を渡す
      renderQuiz(window.currentQuizData, "quiz");
    } else {
      console.error("renderQuiz 関数が見つかりません。共通JSが読み込まれているか確認してください。");
    }

  } catch (err) {
    console.error("通信エラーが発生しました:", err);
  }
});