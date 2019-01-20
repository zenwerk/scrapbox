## Scrapbox 記法の PEG.js パーサー

[PEG.js](https://pegjs.org/)で作った[Scrapbox記法](https://scrapbox.io/help-jp/%E8%A8%98%E6%B3%95)のパーサー。
https://pegjs.org/online に `scrapbox.pegjs` の内容を貼り付けて `Download parser` をクリックすれば `parser.js` が取得可能。

### 出力形式
- トップレベルに `lines` プロパティがあり、1行ごとのパーサー結果がリストで格納される
- 1行のパーサー結果はオブジェクトの配列
  - オブジェクトにはコンテンツタイプを指定する `type` プロパティが入る
  - その後、各コンテンツごとにパーサー結果のプロパティが格納される

#### type プロパティの種類
- indent
  - インデント
- contents
  - 複数コンテンツを格納する配列
- link
  - リンク
- hash
  - ハッシュリンク
- decoration
  - 文字装飾
- backquote
  - 引用符(``)で囲まれた行コード
- text
  - 通常テキスト
- quote
  - `>` で始まる引用
- tex
  - `[$ }` の数式表記
- shell
  - 行頭`$` で始まるシェル記法
- codeblock
  - `code:` の部分
- table
  - `table:` の部分
- blank
  - 改行


#### 出力例

```json
{
  "lines": [
    [
      {
        "type": "indent",
        "level": 0
      },
      {
        "type": "contents",
        "contents": [
          {
            "type": "text",
            "text": "forTest"
          }
        ]
      },
      {
        "type": "blank"
      }
    ]
  ]
}
```

### その他
とりあえず動くが、それぞれの記法がネストしているパターンに対応できていない箇所がある
