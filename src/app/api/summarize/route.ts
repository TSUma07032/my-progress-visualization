/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(request: Request) {
  try {
    const { node, children, logs, apiKey } = await request.json();

    if (!apiKey) {
      return NextResponse.json({ summary: "APIキーが設定されていません。" });
    }

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
      });

      const prompt = `あなたはプロジェクトのマネージャーです。
以下の情報を元に、このノード（タスクまたはフェーズ）の「現在の進捗状況」と「主な課題」を端的に要約してください。
要約はMarkdown形式で、箇条書きなどを活用して見やすく、300文字程度にまとめてください。

対象ノード名: ${node.label}

子ノード:
${children.map((c: any) => `- ${c.label}`).join("\n")}

関連する進捗ログ:
${logs.map((l: any) => `[Action] ${l.action}\n[Result] ${l.result}`).join("\n\n")}
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
