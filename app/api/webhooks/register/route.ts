import { NextResponse } from "next/server";

const SHOPIFY_STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL;

export async function POST() {
    try {
        if (
            !SHOPIFY_STORE_DOMAIN ||
            !SHOPIFY_ACCESS_TOKEN ||
            !NEXT_PUBLIC_APP_URL
        ) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Missing Shopify environment variables",
                },
                { status: 500 }
            );
        }

        const webhookUrl =
            `${NEXT_PUBLIC_APP_URL}/api/webhooks/orders`;

        const graphqlEndpoint =
            `https://${SHOPIFY_STORE_DOMAIN}/admin/api/2026-07/graphql.json`;

        const mutation = `
            mutation webhookSubscriptionCreate(
                $topic: WebhookSubscriptionTopic!
                $webhookSubscription: WebhookSubscriptionInput!
            ) {
                webhookSubscriptionCreate(
                    topic: $topic
                    webhookSubscription: $webhookSubscription
                ) {
                    webhookSubscription {
                        id
                        topic
                        format
                        uri
                    }
                    userErrors {
                        field
                        message
                    }
                }
            }
        `;

        const response = await fetch(graphqlEndpoint, {
            method: "POST",
            headers: {
                "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                query: mutation,
                variables: {
                    topic: "ORDERS_CREATE",
                    webhookSubscription: {
                        uri: webhookUrl,
                        format: "JSON",
                    },
                },
            }),
        });

        const data = await response.json();

        console.log(
            "Shopify webhook registration response:",
            JSON.stringify(data, null, 2)
        );

        if (!response.ok) {
            return NextResponse.json(
                {
                    success: false,
                    error: data,
                },
                { status: response.status }
            );
        }

        const result =
            data?.data?.webhookSubscriptionCreate;

        if (!result) {
            return NextResponse.json(
                {
                    success: false,
                    error: data,
                },
                { status: 500 }
            );
        }

        if (result.userErrors?.length > 0) {
            return NextResponse.json(
                {
                    success: false,
                    errors: result.userErrors,
                },
                { status: 422 }
            );
        }

        return NextResponse.json({
            success: true,
            message:
                "Shopify orders/create webhook registered successfully",
            webhook: result.webhookSubscription,
        });
    } catch (error) {
        console.error(
            "Webhook registration error:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                error: "Failed to register Shopify webhook",
            },
            { status: 500 }
        );
    }
}