- 進捗管理
  - Star法を使って四段階で整理
  - Situation（状況）、Task（課題）、Action（行動）、Result（結果）の4つ
  - 場合によってはQ（Question）、N（NextTODO）をはやす感じで
- 進捗追加システム
  - Star法や内容の具体性に不足があると感じたら、LLMが適宜ユーザに問いかけを行ってほしい
  - 対話を通じて、今日やったことを引き出すチャットシステムもはやしてほしい
- 進捗ツリー閲覧システム：テキストの編集が非常にやりにくい
- 今週の進捗報告資料：冒頭に、タスク全体のどの部分をやったかを可視化する部分がほしいのだ
- エラーログ（いかが発生したので報告しておく）
  installHook.js:1 Encountered two children with the same key, `proj-agent-dev`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. Error Component Stack
    at option (<anonymous>)
    at select (<anonymous>)
    at div (<anonymous>)
    at div (<anonymous>)
    at div (<anonymous>)
    at header (<anonymous>)
    at div (<anonymous>)
    at Home (page.tsx:38:12)
    at AppProvider (AppContext.tsx:23:31)
    at body (<anonymous>)
    at html (<anonymous>)
    at RootLayout [Server] (<anonymous>)
overrideMethod	@	installHook.js:1

