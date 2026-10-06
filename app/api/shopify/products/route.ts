import { NextResponse } from "next/server";

const SHOPIFY_STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

export async function GET() {
    try {
        if (!SHOPIFY_STORE_DOMAIN || !SHOPIFY_ACCESS_TOKEN) {
            return NextResponse.json(
                {
                    error: "Missing Shopify environment variables",
                },
                { status: 500 }
            );
        }

        const query = `
      query {
        products(first: 20) {
          nodes {
            id
            title
            handle
            status
            totalInventory
          }
        }
      }
    `;

        const response = await fetch(
            `https://${SHOPIFY_STORE_DOMAIN}/admin/api/2026-10/graphql.json`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
                },
                body: JSON.stringify({ query }),
            }
        );

        const result = await response.json();

        if (!response.ok || result.errors) {
            return NextResponse.json(
                {
                    error: "Shopify API request failed",
                    details: result,
                },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            products: result.data.products.nodes,
        });
    } catch (error) {
        return NextResponse.json(
            {
                error: "Unexpected error",
                details: error instanceof Error ? error.message : String(error),
            },
            { status: 500 }
        );
    }
}