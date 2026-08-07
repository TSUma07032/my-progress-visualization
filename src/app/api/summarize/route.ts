import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(request: Request) {
  try {
    const { targetTitle, children, level, apiKey } = await request.json();

    if (!apiKey) {
      return NextResponse.json({ summary: "APIキーが設定されていません。" });
    }

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
      });

      let itemsList = "";
      if (level === "phase" && children) {
        itemsList = children.map((c: any) => `- ${c.title}${c.summary ? `: ${c.summary}` : ""}`).join("\n");
      } else if (level === "deliverable" && children) {
        itemsList = children.map((c: any) => `- [${c.status}] ${c.title}${c.content ? `\n  詳細: ${c.content}` : ""}`).join("\n");
      }

      const prompt = `あなたはプロジェクトのマネージャーです。
以下の情報を元に、この対象項目（${level === "phase" ? "大項目/フェーズ" : "中項目/成果物"}）の「現在の状況」と「主な進捗・課題」を端的に要約してください。
要約はMarkdown形式で、箇条書きなどを活用して見やすく、300文字程度にまとめてください。

対象項目: ${targetTitle}

配下の項目・進捗:
${itemsList || "(まだ配下の項目はありません)"}
`;

      const response = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });

      const summary = response.response.text();

      return NextResponse.json({
        summary,
      });
    } catch (apiError: any) {
      console.error("Gemini API Error in summarize:", apiError);
      return NextResponse.json(
        { error: "要約の生成に失敗しました。" },
        { status: 500 }
      );
    }
  } catch (err: any) {
    console.error("Internal Server Error in API Summarize:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
