import { NextResponse } from "next/server";

const SHOPIFY_STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

export async function POST() {
    try {
        if (!SHOPIFY_STORE_DOMAIN || !SHOPIFY_ACCESS_TOKEN) {
            return NextResponse.json(
                { error: "Shopify environment variables are missing" },
                { status: 500 }
            );
        }

        const webhookUrl =
            `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/orders`;

        const response = await fetch(
            `https://${SHOPIFY_STORE_DOMAIN}/admin/api/2026-07/webhooks.json`,
            {
                method: "POST",
                headers: {
                    "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    webhook: {
                        topic: "orders/create",
                        address: webhookUrl,
                        format: "json",
                    },
                }),
            }
        );

        const data = await response.json();

        if (!response.ok) {
            console.error("Shopify webhook registration failed:", data);

            return NextResponse.json(
                {
                    success: false,
                    error: data,
                },
                { status: response.status }
            );
        }

        return NextResponse.json({
            success: true,
            message: "orders/create webhook registered successfully",
            webhook: data.webhook,
        });
    } catch (error) {
        console.error("Webhook registration error:", error);

        return NextResponse.json(
            {
                success: false,
                error: "Failed to register webhook",
            },
            { status: 500 }
        );
    }
}