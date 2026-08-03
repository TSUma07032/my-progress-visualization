This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.


## LLMメモ

音声生成　サポート対象外

キャッシュ　サポート対象

コード実行　サポート対象

コンピュータ使用　サポート対象外

ファイル検索　サポート対象

関数呼び出し　サポート対象

Google マップによるグラウンディング　サポート対象

画像生成　サポート対象外

Live API　サポート対象外

検索によるグラウンディング　サポート対象

構造化出力　サポート対象

思考　サポート対象

URL コンテキスト　サポート対象
## Supabase Integration

This project now supports **Supabase** as an external database option.

To use Supabase:

1. Create a new project on [Supabase](https://supabase.com).
2. Go to the SQL Editor in your Supabase dashboard and run the SQL commands found in `supabase_schema.sql` to create the required tables.
3. Find your **Project URL** and **anon public key** in the API Settings of your Supabase dashboard.
4. Set the following Environment Variables in your local `.env.local` or on your Vercel Dashboard:
   - \`NEXT_PUBLIC_SUPABASE_URL=your-supabase-url\`
   - \`NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key\`

The application will automatically detect these variables and allow you to select "Supabase" as the storage mode in the UI.

## Vercel Deployment

Push this repository to GitHub, go to Vercel, and import the repository. Vercel will automatically build and deploy it using Next.js.
Make sure to copy over the environment variables for your Supabase/Firebase credentials and your \`NEXT_PUBLIC_CREATOR_PASSCODE\` into the Vercel dashboard.
