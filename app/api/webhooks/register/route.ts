import { NextResponse } from "next/server";

const SHOPIFY_STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN!;
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN!;

export async function GET() {
    const query = `
    mutation {
      webhookSubscriptionCreate(
        topic: ORDERS_CREATE
        webhookSubscription: {
          uri: "https://asa-wine.vercel.app/api/webhooks/orders"
        }
      ) {
        webhookSubscription {
          id
          topic
          uri
        }
        userErrors {
          field
          message
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

    const data = await response.json();

    return NextResponse.json(data);
}