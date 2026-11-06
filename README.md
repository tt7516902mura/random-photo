# Wallpaper Roulette（ランダム壁紙サイト）

無料・APIキー不要の静的サイトです。画像は [Lorem Picsum](https://picsum.photos/) から取得し、サーバーには保存しません。

## 使い方
- ローカル確認: フォルダ内で `python3 -m http.server 8000` → http://localhost:8000
  （`index.html` を直接開いても動作します）
- お気に入り・履歴・設定はブラウザの LocalStorage に保存されます。

## Cloudflare Pages へのデプロイ
1. このフォルダを GitHub に push（または Pages の「直接アップロード」にフォルダごとドロップ）
2. ビルドコマンド: なし / 出力ディレクトリ: `/`（ルート）
3. `_headers` により CSP 等のセキュリティヘッダーが適用されます。
   別の画像ソースを追加した場合は `_headers` の `img-src` / `connect-src` にそのホストを追加してください。

## ファイル構成
| ファイル | 内容 |
| --- | --- |
| `index.html` | 画面骨格 |
| `css/style.css` | デザイン |
| `js/util.js` | LocalStorage、URL検証、トースト |
| `js/providers.js` | 画像プロバイダ層（Picsum実装） |
| `js/app.js` | 状態管理・UI・保存処理 |
| `DESIGN.md` | 全体設計 |

## 別API（Openverse 等）の追加方法
`js/providers.js` の `register()` に、次の形のオブジェクトを渡すだけです。設定画面に「画像ソース」の選択肢が自動で現れます。

```js
WP.providers.register({
  id: 'openverse', name: 'Openverse', license: 'CC系（作品ごとに異なる）',
  allowedHosts: ['api.openverse.org', /* 画像のホスト */],
  pickRandom: async ({ width, height, exclude }) => ({ provider: 'openverse', id: '...', w: 0, h: 0, author: '', pageUrl: '' }),
  imageUrl: (item, w, h) => '...', thumbUrl: (item, w, h) => '...', originalUrl: (item) => '...',
  validateItem: (raw) => ({ /* 検証済みitemを返す。不正ならnull */ })
});
```
Openverse は作品ごとにライセンスが異なるため、表示時にクレジット（作者・ライセンス）を出す実装を推奨します。

## 注意
- Picsum は壁紙専用ではなく、アニメ・ゲーム等のジャンル指定はできません。
- 写真は主に Unsplash License です。作者名を画像下に表示しています。
- 「次の壁紙」は500ms間隔の制限、先読みは1枚のみで、API負荷を抑えています。

## 更新時の注意
JS/CSS は `?v=4` 付きで読み込んでいます。ファイルを更新したら index.html 内の数字を上げると、ブラウザの古いキャッシュを確実に避けられます。
