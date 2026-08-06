/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai"; 

interface NodeItem {
  id: string;
  label: string;
  parentId: string | null;
}

export async function POST(request: Request) {
  try {
    const { rawMemo, nodes, apiKey, useSimulation, chatHistory } = await request.json();

    if (useSimulation || !apiKey) {
      const simulatedResult = generateSimulatedResponse(rawMemo, nodes);
      return NextResponse.json({ ...simulatedResult, isSimulated: true });
    }

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: "gemini-3.1-flash-lite", // 👇 修正: 確実なモデル名に変更
        generationConfig: {
          responseMimeType: "application/json",
responseSchema: {
            type: SchemaType.OBJECT,
            properties: {
              isSufficient: {
                type: SchemaType.BOOLEAN,
                description: "入力されたメモから、STAR法（Situation, Task, Action, Result）を満たす十分な情報が抽出できるかどうか。",
              },
              clarificationQuestion: {
                type: SchemaType.STRING,
                description: "isSufficient が false の場合、ユーザーに足りない情報を聞き出す質問文。",
                nullable: true,
              },
              commonLevel3Node: {
                type: SchemaType.OBJECT,
                description: "複数の進捗項目（レベル4）をまとめるための共通の親ノード（レベル3）を新設する必要がある場合に指定します。既存の親で十分な場合はnull。",
                nullable: true,
                properties: {
                  create: { type: SchemaType.BOOLEAN },
                  label: { type: SchemaType.STRING },
                  parentId: { type: SchemaType.STRING }
                },
                required: ["create", "label", "parentId"]
              },
              items: {
                type: SchemaType.ARRAY,
                description: "抽出された進捗データの配列。",
                items: {
                  type: SchemaType.OBJECT,
                  properties: {
                    situation: { type: SchemaType.STRING },
                    task: { type: SchemaType.STRING },
                    action: { type: SchemaType.STRING },
                    result: { type: SchemaType.STRING },
                    question: { type: SchemaType.STRING, nullable: true },
                    nextTodo: { type: SchemaType.STRING, nullable: true },
                    nodeId: { type: SchemaType.STRING, nullable: true },
                    newNodeLabel: { type: SchemaType.STRING, nullable: true },
                    newNodeParentId: { type: SchemaType.STRING, nullable: true },
                  },
                  required: ["situation", "task", "action", "result"],
                }
              }
            },
            required: ["isSufficient"],
          },
        },
      });


      const systemPrompt = `あなたは研究・プロジェクトの編集者です。ユーザーの入力メモ（およびチャット履歴）から、進捗をSTAR法（Situation:状況、Task:課題、Action:行動、Result:結果）を用いて抽出してください。

プロジェクトのタスク構造は基本的に4段階のレベル（階層）で管理されます：
- レベル1（プロジェクト名）: 例「Webサイトリニューアル」
- レベル2（大項目 / フェーズ）: 例「要件定義」「システム開発」
- レベル3（中項目 / 具体的な成果物）: 例「トップページデザイン」「問い合わせフォーム開発」
- レベル4（小項目 / 具体的なタスク）: 例「HTML/CSSコーディング」「バリデーション実装」

進捗（ログ）を追加する際は、原則として「レベル4」のノードとして追加します。

重要ルール：
1. ユーザーが悩んでいること、エラー、試行錯誤したプロセスは「Action(行動)」や「Result(結果)」に詳細に残してください。
2. 入力内容からSTARの4要素が不十分な場合は isSufficient を false にし、clarificationQuestion に質問を設定してください。
3. 十分な情報があれば items にSTARデータを格納します。
4. 【重要】一度に複数の進捗（レベル4）を追加する際、それらをまとめる適切なレベル3の親ノードが存在しない場合は、\`commonLevel3Node\` を使って「共通のレベル3ノード」の作成を提案してください。その場合、各itemの \`newNodeParentId\` には "NEW_COMMON_LEVEL3" などのプレースホルダーを入れるか空にし、画面側で紐付けられるように考慮してください。既存の親で事足りる場合は \`commonLevel3Node\` は null にしてください。
`;


      const prompt = `
${systemPrompt}

既存のノードリスト:
${JSON.stringify(nodes, null, 2)}

これまでのチャット履歴:
${chatHistory && chatHistory.length > 0 ? chatHistory.map((msg: any) => `${msg.role === 'user' ? 'ユーザー' : 'あなた'}: ${msg.content}`).join('\n') : 'なし'}

ユーザーの入力メモ:
---
${rawMemo}
---

上記の内容を分析し、指示に従ってJSONを出力してください。
`;

      const response = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });

      let text = response.response.text();
      
      text = text.replace(/```json/gi, '').replace(/```/gi, '').trim();

      const parsed = JSON.parse(text);


      if (!parsed.isSufficient) {
         return NextResponse.json({
            isSufficient: false,
            clarificationQuestion: parsed.clarificationQuestion || "もう少し詳しく教えてもらえますか？",
            items: [],
            isSimulated: false,
         });
      }

      const commonLevel3Node = parsed.commonLevel3Node || null;

      const items = (parsed.items || []).map((item: any) => ({
        situation: item.situation || "",
        task: item.task || "",
        action: item.action || "",
        result: item.result || "",
        question: typeof item.question === 'string' ? item.question : "",
        nextTodo: typeof item.nextTodo === 'string' ? item.nextTodo : "",
        nodeId: item.nodeId || null,
        newNodeLabel: item.newNodeLabel || null,
        newNodeParentId: item.newNodeParentId || null,
      }));


      // Fallback if array is empty
      if (items.length === 0) {
        items.push({
          situation: "不明",
          task: "不明",
          action: "不明",
          result: "抽出失敗",
          nodeId: null,
          newNodeLabel: "未分類 (Uncategorized)",
          newNodeParentId: null,
        });
      }

      return NextResponse.json({
        isSufficient: true,
        commonLevel3Node,
        items,
        isSimulated: false,
      });
    } catch (apiError: any) {
      // 開発時のデバッグ用に、コンソールに詳細なエラーメッセージを出す
      console.error("====== Gemini API Error ======");
      console.error("Status:", apiError?.status);
      console.error("Message:", apiError?.message || apiError);
      console.error("==============================");
      
      return NextResponse.json(
        {
          error: apiError?.message || "Gemini APIへのリクエストに失敗しました。",
          message: "Gemini APIによる整理に失敗しました。APIキーが正しいか確認するか、しばらく経ってから再試行してください。",
        },
        { status: 500 }
      );
    }
  } catch (err: any) {
    console.error("Internal Server Error in API Analyze:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// INTELLIGENT SIMULATION GENERATOR (Can return 2 items if memo is long or has distinct sections)
function generateSimulatedResponse(rawMemo: string, nodes: NodeItem[]) {
  const memoText = rawMemo || "";
  const lines = memoText.split("\n").map(l => l.trim()).filter(l => l.length > 5);

  // If the user pasted a lot of text or we have bullet points indicating multiple topics, split into 2 items
  const shouldSplit = memoText.length > 150 || lines.filter(l => l.startsWith("-") || l.startsWith("*") || l.match(/^\d+\./)).length >= 2;

  const createItem = (textSource: string[], itemIndex: number) => {
    const situation = "シミュレーション環境での実行";
    const task = `テーマ ${itemIndex + 1} の解析`;
    const action = "テストデータの処理と分類";
    let result = "モックデータの生成完了";
    let question = "今後のマイルストーンおよび優先順位について。";
    const nextTodo = "次の実験の準備";

    if (textSource.length > 0) {
      result = textSource[0].replace(/[-*+\d.]/, "").trim();
      if (textSource.length > 1) {
        question = `「${textSource[textSource.length - 1].replace(/[-*+\d.]/, "").trim().substring(0, 40)}...」に関して、具体的な進め方や評価方法を相談すべきです。`;
      }
    }

    // Node placement simulation
    let matchedNodeId: string | null = null;
    let newNodeLabel: string | null = null;
    let newNodeParentId: string | null = null;

    if (nodes.length > 0) {
      const sourceStr = textSource.join(" ").toLowerCase();
      const match = nodes.find(node => sourceStr.includes(node.label.toLowerCase()) || node.label.split(/[:：]/).some(part => sourceStr.includes(part.trim().toLowerCase())));
      if (match) {
        matchedNodeId = match.id;
      } else {
        if (sourceStr.length > 20) {
          const cleanText = textSource[0].replace(/[#*`\-\d.]/g, "").trim();
          newNodeLabel = `展開：${cleanText.substring(0, 15) || "新規トピック"}`;
          const rootNode = nodes.find(n => n.parentId === null) || nodes[0];
          newNodeParentId = rootNode ? rootNode.id : null;
        } else {
          newNodeLabel = `追加検討：テーマ ${itemIndex + 1}`;
          const rootNode = nodes.find(n => n.parentId === null) || nodes[0];
          newNodeParentId = rootNode ? rootNode.id : null;
        }
      }
    } else {
      newNodeLabel = "未分類 (Uncategorized)";
      newNodeParentId = null;
    }

    return {
      situation,
      task,
      action,
      result,
      question,
      nextTodo,
      nodeId: matchedNodeId,
      newNodeLabel,
      newNodeParentId,
    };
  };

  const items = [];
  if (shouldSplit && lines.length >= 2) {
    const half = Math.ceil(lines.length / 2);
    const linesPart1 = lines.slice(0, half);
    const linesPart2 = lines.slice(half);
    items.push(createItem(linesPart1, 0));
    items.push(createItem(linesPart2, 1));
  } else {
    items.push(createItem(lines, 0));
  }

  return {
    isSufficient: true,
    items,
  };
}
