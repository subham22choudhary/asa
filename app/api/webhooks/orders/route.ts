import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(request: NextRequest) {
    try {
        if (
            !SHOPIFY_API_SECRET ||
            !SUPABASE_URL ||
            !SUPABASE_SERVICE_ROLE_KEY
        ) {
            console.error("Missing required environment variables");

            return NextResponse.json(
                { error: "Server configuration error" },
                { status: 500 }
            );
        }

        const rawBody = await request.text();

        const hmacHeader = request.headers.get(
            "x-shopify-hmac-sha256"
        );

        const shopDomain = request.headers.get(
            "x-shopify-shop-domain"
        );

        const topic = request.headers.get(
            "x-shopify-topic"
        );

        const webhookId = request.headers.get(
            "x-shopify-webhook-id"
        );

        if (!hmacHeader) {
            return NextResponse.json(
                { error: "Missing Shopify HMAC" },
                { status: 401 }
            );
        }

        const calculatedHmac = crypto
            .createHmac("sha256", SHOPIFY_API_SECRET)
            .update(rawBody, "utf8")
            .digest("base64");

        const receivedBuffer = Buffer.from(hmacHeader);
        const calculatedBuffer = Buffer.from(calculatedHmac);

        if (
            receivedBuffer.length !== calculatedBuffer.length ||
            !crypto.timingSafeEqual(
                receivedBuffer,
                calculatedBuffer
            )
        ) {
            console.error("Invalid Shopify webhook HMAC");

            return NextResponse.json(
                { error: "Invalid HMAC" },
                { status: 401 }
            );
        }

        const order = JSON.parse(rawBody);

        console.log("=================================");
        console.log("SHOPIFY ORDER CREATED");
        console.log("=================================");
        console.log("Webhook ID:", webhookId);
        console.log("Shop:", shopDomain);
        console.log("Topic:", topic);
        console.log("Order ID:", order.id);
        console.log("Order Name:", order.name);
        console.log("Total:", order.total_price);
        console.log("Currency:", order.currency);
        console.log("Customer:", order.customer?.email);
        console.log(
            "Line Items:",
            order.line_items?.length
        );
        console.log("=================================");

        const supabase = createClient(
            SUPABASE_URL,
            SUPABASE_SERVICE_ROLE_KEY
        );

        const { error } = await supabase
            .from("shopify_orders")
            .upsert(
                {
                    id: order.id,
                    order_name: order.name ?? null,
                    shop_domain: shopDomain,
                    customer_email:
                        order.customer?.email ?? null,
                    total_price:
                        Number(order.total_price) || 0,
                    currency:
                        order.currency ?? null,
                    financial_status:
                        order.financial_status ?? null,
                    fulfillment_status:
                        order.fulfillment_status ?? null,
                    line_items:
                        order.line_items ?? [],
                    raw_order: order,
                },
                {
                    onConflict: "id",
                }
            );

        if (error) {
            console.error(
                "Supabase insert error:",
                error
            );

            return NextResponse.json(
                {
                    error: "Failed to save order",
                    details: error.message,
                },
                { status: 500 }
            );
        }

        console.log(
            "Order successfully saved to Supabase:",
            order.id
        );

        return NextResponse.json({
            success: true,
            orderId: order.id,
            saved: true,
        });
    } catch (error) {
        console.error(
            "Shopify webhook error:",
            error
        );

        return NextResponse.json(
            {
                error: "Webhook processing failed",
            },
            { status: 500 }
        );
    }
}