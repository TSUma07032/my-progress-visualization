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

      const systemPrompt = `あなたは研究・プロジェクトの編集者です。ユーザーの入力メモから情報を抽出する際、文章を綺麗に要約して成功体験だけにするのは厳禁です。ユーザーが悩んでいること、試行錯誤したプロセス、目的とのズレに対する違和感などを『葛藤・議論のタネ』として絶対に省略せず、強調して抽出してください。`;

      const prompt = `
${systemPrompt}

既存のノードリスト:
${JSON.stringify(nodes, null, 2)}

ユーザーの入力メモ:
---
${rawMemo}
---

上記メモを分析し、以下の指示に従ってJSONを出力してください:
1. 「conclusion」: 成果や進捗を簡潔に1〜2行に要約。
2. 「struggle」: ユーザーの葛藤やエラー、試行錯誤、失敗、悩みを意図的に残して要約。
3. 「discussion」: 報告相手への相談に値する具体的な問いを提案。
4. 「nodeId」, 「newNodeLabel」, 「newNodeParentId」:
   - 入力メモの内容が、既存のどのノードに該当するか特定してください。
   - もし完全に新しい話題や別のステップであると判断した場合は、「nodeId」を null (または空文字) とし、「newNodeLabel」に適切な新規ノードのラベルを設定し、「newNodeParentId」にその親となる既存ノードのID（無ければ null/空文字）を設定してください。
   - もし何も判断できない場合は、新規に「未分類 (Uncategorized)」というラベルのノードを作成し、既存ノードのどれか（無ければRootやnull）を親にしてください。
`;

      const response = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });

      let text = response.response.text();
      
      text = text.replace(/```json/gi, '').replace(/```/gi, '').trim();

      const parsed = JSON.parse(text);

      return NextResponse.json({
        conclusion: parsed.conclusion || "",
        struggle: parsed.struggle || "",
        discussion: parsed.discussion || "",
        nodeId: parsed.nodeId || null,
        newNodeLabel: parsed.newNodeLabel || null,
        newNodeParentId: parsed.newNodeParentId || null,
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

// INTELLIGENT SIMULATION GENERATOR
function generateSimulatedResponse(rawMemo: string, nodes: NodeItem[]) {
  const memoText = rawMemo || "";

  // Analyze simple keywords to make simulation realistic
  let conclusion = "今週の進捗メモをもとに要約を行いました。";
  let struggle = "明確なエラーや葛藤は検知されませんでしたが、持続的な開発作業が行われています。";
  let discussion = "今後のマイルストーンおよび優先順位について。";

  // Try to find struggle-related keywords
  const struggleKeywords = ["エラー", "バグ", "難しい", "失敗", "課題", "悩", "葛藤", "苦戦", "できな", "遅れ", "わから", "バグ", "詰ま"];
  const matchesStruggle = struggleKeywords.filter(kw => memoText.includes(kw));

  if (matchesStruggle.length > 0) {
    struggle = `「${matchesStruggle.slice(0, 3).join('」「')}」に関する葛藤や試行錯誤がメモから抽出されました。課題解決に向けて継続的な検証が行われています。`;
  }

  // Generate generic but relevant content based on memo length/content
  const lines = memoText.split("\n").map(l => l.trim()).filter(l => l.length > 5 && !l.startsWith("#"));
  if (lines.length > 0) {
    conclusion = lines[0].replace(/[-*+]/, "").trim();
    if (lines.length > 1) {
      discussion = `メモに記載のある「${lines[lines.length - 1].replace(/[-*+]/, "").trim().substring(0, 40)}...」について、具体的な評価基準や進め方を相談すべきです。`;
    }
  }

  // Determine Node Matching Simulation
  let matchedNodeId: string | null = null;
  let newNodeLabel: string | null = null;
  let newNodeParentId: string | null = null;

  if (nodes.length > 0) {
    // Check if any node label is referenced in memo
    const match = nodes.find(node => memoText.toLowerCase().includes(node.label.toLowerCase()) || node.label.split(/[:：]/).some(part => memoText.includes(part.trim())));
    if (match) {
      matchedNodeId = match.id;
    } else {
      // Propose new node with 30% probability or if specific new terms are used
      if (memoText.length > 30) {
        // Suggest a new node based on first few words of memo
        const cleanWords = memoText.replace(/[#*`\-]/g, "").trim();
        const shortName = cleanWords.split("\n")[0].substring(0, 15);
        newNodeLabel = `展開：${shortName || "新規トピック"}`;
        // Set parent to root if root exists
        const rootNode = nodes.find(n => n.parentId === null) || nodes[0];
        newNodeParentId = rootNode ? rootNode.id : null;
      } else {
        // Uncategorized fallback
        newNodeLabel = "未分類 (Uncategorized)";
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
}
