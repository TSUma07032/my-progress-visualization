# 📝 ForJules TODO

## 今後の作業・課題

*   **Supabase完全以降の動作確認**
    *   FirebaseやLocalStorageのロジックを完全削除したため、本番環境のSupabaseプロジェクトで正常にすべてのCRUD操作（プロジェクト作成、ノード追加、ログ追加など）が行えるか確認。
*   **不要なテーブルの整理（Supabase手動作業）**
    *   [SupabaseCleanupManual.md](./SupabaseCleanupManual.md) に従って、DB上の `projects`, `nodes`, `logs` 以外の不要なテーブルを削除する。
*   **AI要約機能の利用促進**
    *   各ノードのポップアップに追加した「✨AIにこの階層を要約してもらう」ボタンの使い勝手を確認し、必要に応じてプロンプト（`src/app/api/summarize/route.ts`）を調整する。
*   **レベル3 / 4 のAI生成の精度向上**
    *   `src/app/api/analyze/route.ts` に実装した `commonLevel3Node` の提案が意図したタイミングで正しく行われるか、実際の入力メモを使って検証し、プロンプトをチューニングする。
*   **パフォーマンス・UX改善**
    *   大規模なツリー構造になった際のReactFlowの描画パフォーマンス確認と、必要なら仮想化やレイアウトの調整。
