#!/bin/sh

INFILE="$1"
OUTFILE="${2:-$1}"
LISTFILE="ruby.txt"

if [ ! -f "$INFILE" ] || [ ! -f "$LISTFILE" ]; then
  echo "❌ ファイルが見つかりません。パスを確認してください。"
  echo "入力ファイル: $INFILE"
  echo "リストファイル: $LISTFILE"
  exit 1
fi

echo "=== .qmd ファイルの置換を実行中（二重ガード版） ==="
echo "入力: $INFILE"
echo "出力: $OUTFILE"

export RUBY_LISTFILE="$LISTFILE"

perl -CSD -Mutf8 -pe '
  BEGIN {
    my $list = $ENV{RUBY_LISTFILE};
    open my $fh, "<:utf8", $list or die "Cannot open $list: $!";
    while (<$fh>) {
        chomp;
        my ($from, $to) = split(/[ \t\x{3000}]+/);
        $replacements{$from} = "<ruby>$from<rt>$to</rt></ruby>" if $from;
    }
    close $fh;
    my @keys = sort { length($b) <=> length($a) } keys %replacements;
    $regex = join("|", map { quotemeta } @keys);
    $in_code = 0;      # ``` の中かどうかのフラグ
    $in_script = 0;    # <script> の中かどうかのフラグ
  }

  # 1. 状態の更新
  my $has_ticks = () = $_ =~ /
```/g;
  
  # <script> や </script> タグがあるかチェック
  if ($_ =~ /<script/i) { $in_script = 1; }

  # 2. 置換処理の分岐
  if ($in_code || $in_script) {
      # ガード対象の中にいるときは、単語置換は絶対にしない
      if ($has_ticks % 2 != 0) { $in_code = !$in_code; }
  } else {
      # 通常のエリア（置換してOKな場所）
      if ($has_ticks % 2 != 0) {
          # この行で ``` が始まる場合、``` の前の部分だけを置換
          my ($before, $after) = split(/```/, $_, 2);
          $before =~ s/($regex)/$replacements{$1}/g if $regex;
          $_ = $before . "
```" . $after;
          $in_code = 1;
      } else {
          # 完全に通常のテキスト行
          s/($regex)/$replacements{$1}/g if $regex;
      }
  }

  # 行の最後で </script> が出たらスクリプト終了フラグを立てる
  if ($_ =~ /<\/script>/i) { $in_script = 0; }
' "$INFILE" > "$OUTFILE"

echo "👉 置換が完了し、'$OUTFILE' に保存しました！"