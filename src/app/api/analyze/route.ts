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
    const { rawMemo, nodes, apiKey, useSimulation } = await request.json();

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
            type: SchemaType.OBJECT, // 👇 修正: SchemaTypeを使用
            properties: {
              conclusion: {
                type: SchemaType.STRING,
                description: "今週の成果や進捗を簡潔に要約（1〜2行）。",
              },
              struggle: {
                type: SchemaType.STRING,
                description: "ユーザーの悩み、エラー、失敗談、疑問などを意図的に残した、綺麗に丸め込まない試行錯誤の要約。",
              },
              discussion: {
                type: SchemaType.STRING,
                description: "報告相手（教授や上司）へ相談すべき具体的な問いの提案。",
              },
              nodeId: {
                type: SchemaType.STRING,
                description: "提供された既存ノードリストの中で、入力内容が最も該当するノードのID。該当する既存ノードがない場合は null または空文字にしてください。",
                nullable: true, // 👇 念のためnullを許容する設定を追加
              },
              newNodeLabel: {
                type: SchemaType.STRING,
                description: "既存ノードに該当しない新規トピックだと判断した場合に、新しく作成するノードの表示名（例:『実験2：パラメータチューニング』）。新規作成しない場合は null または空文字にしてください。",
                nullable: true,
              },
              newNodeParentId: {
                type: SchemaType.STRING,
                description: "新規ノードを作成する場合、その親となる既存ノードのID。ルートレベルに追加する場合は null または空文字にしてください。",
                nullable: true,
              },
            },
            required: ["conclusion", "struggle", "discussion"],
          },
        },
      });

      const systemPrompt = `あなたは研究・プロジェクトの編集者です。ユーザーの入力メモから情報を抽出する際、文章を綺麗に要約して成功体験だけにするのは厳禁です。ユーザーが悩んでいること、試行錯誤したプロセス、目的とのズレに対する違和感などを『葛藤・議論のタネ』として絶対に省略せず、強調して抽出してください。また、入力メモに複数のトピックや非常に多くの内容が含まれる場合は、それぞれを適切な「items」要素に分割して出力してください。`;

      const prompt = `
${systemPrompt}

既存のノードリスト:
${JSON.stringify(nodes, null, 2)}

ユーザーの入力メモ:
---
${rawMemo}
---

上記メモを分析し、指示に従ってJSON（itemsの配列を含むオブジェクト）を出力してください。
`;

      const response = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });

      let text = response.response.text();
      
      text = text.replace(/```json/gi, '').replace(/```/gi, '').trim();

      const parsed = JSON.parse(text);

      const items = (parsed.items || []).map((item: any) => ({
        conclusion: item.conclusion || "",
        struggle: item.struggle || "",
        discussion: item.discussion || "",
        nodeId: item.nodeId || null,
        newNodeLabel: item.newNodeLabel || null,
        newNodeParentId: item.newNodeParentId || null,
      }));

      // Fallback if array is empty
      if (items.length === 0) {
        items.push({
          conclusion: "進捗要約の取得に失敗しました。",
          struggle: "詳細な葛藤は抽出されませんでした。",
          discussion: "進捗の報告方法について。",
          nodeId: null,
          newNodeLabel: "未分類 (Uncategorized)",
          newNodeParentId: null,
        });
      }

      return NextResponse.json({
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
    let conclusion = `進捗メモから抽出されたテーマ ${itemIndex + 1} の要約。`;
    let struggle = "明確なエラーや葛藤は検知されませんでしたが、開発作業が継続しています。";
    let discussion = "今後のマイルストーンおよび優先順位について。";

    // Search keywords for struggle
    const struggleKeywords = ["エラー", "バグ", "難しい", "失敗", "課題", "悩", "葛藤", "苦戦", "できな", "遅れ", "わから", "詰ま"];
    const matchesStruggle = struggleKeywords.filter(kw => textSource.join(" ").includes(kw));

    if (matchesStruggle.length > 0) {
      struggle = `テーマ ${itemIndex + 1} における「${matchesStruggle.slice(0, 3).join('環境要因と『苦戦』')}」についての葛藤や試行錯誤が抽出されました。`;
    }

    if (textSource.length > 0) {
      conclusion = textSource[0].replace(/[-*+\d.]/, "").trim();
      if (textSource.length > 1) {
        discussion = `「${textSource[textSource.length - 1].replace(/[-*+\d.]/, "").trim().substring(0, 40)}...」に関して、具体的な進め方や評価方法を相談すべきです。`;
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
      conclusion,
      struggle,
      discussion,
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
    items,
  };
}
