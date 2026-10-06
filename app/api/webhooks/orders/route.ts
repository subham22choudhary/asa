import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
    try {
        const rawBody = await request.text();

        const hmacHeader = request.headers.get("x-shopify-hmac-sha256");
        const shopDomain = request.headers.get("x-shopify-shop-domain");
        const topic = request.headers.get("x-shopify-topic");
        const webhookId = request.headers.get("x-shopify-webhook-id");

        const secret = process.env.SHOPIFY_API_SECRET;

        if (!secret) {
            console.error("SHOPIFY_API_SECRET is missing");
            return NextResponse.json(
                { error: "Server configuration error" },
                { status: 500 }
            );
        }

        if (!hmacHeader) {
            return NextResponse.json(
                { error: "Missing Shopify HMAC" },
                { status: 401 }
            );
        }

        // Verify Shopify HMAC using the RAW request body
        const calculatedHmac = crypto
            .createHmac("sha256", secret)
            .update(rawBody, "utf8")
            .digest("base64");

        const valid = crypto.timingSafeEqual(
            Buffer.from(calculatedHmac),
            Buffer.from(hmacHeader)
        );

        if (!valid) {
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
        console.log("Line Items:", order.line_items?.length);
        console.log("=================================");

        /*
         * NEXT STEP:
         *
         * Save this order into Supabase.
         *
         * Later we will use this data to calculate:
         *
         * AI conversations
         *      ↓
         * Product recommendation
         *      ↓
         * Customer purchase
         *      ↓
         * AI-attributed sale
         */

        return NextResponse.json({
            success: true,
            orderId: order.id,
        });
    } catch (error) {
        console.error("Shopify webhook error:", error);

        return NextResponse.json(
            { error: "Webhook processing failed" },
            { status: 500 }
        );
    }
}