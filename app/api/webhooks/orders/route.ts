import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

function normalizeProductId(productId: unknown): string | null {
    if (!productId) return null;

    const value = String(productId);

    // Shopify GraphQL ID:
    // gid://shopify/Product/123456789
    if (value.includes("/")) {
        return value.split("/").pop() ?? null;
    }

    return value;
}

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

        // ---------------------------------------------------------
        // 1. READ RAW WEBHOOK BODY
        // ---------------------------------------------------------

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

        // ---------------------------------------------------------
        // 2. VERIFY SHOPIFY HMAC
        // ---------------------------------------------------------

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

        // ---------------------------------------------------------
        // 3. PARSE ORDER
        // ---------------------------------------------------------

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

        // ---------------------------------------------------------
        // 4. SUPABASE CLIENT
        // ---------------------------------------------------------

        const supabase = createClient(
            SUPABASE_URL,
            SUPABASE_SERVICE_ROLE_KEY
        );

        // ---------------------------------------------------------
        // 5. SAVE SHOPIFY ORDER
        // ---------------------------------------------------------

        const { error: orderError } = await supabase
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

        if (orderError) {
            console.error(
                "Supabase order insert error:",
                orderError
            );

            return NextResponse.json(
                {
                    error: "Failed to save order",
                    details: orderError.message,
                },
                { status: 500 }
            );
        }

        console.log(
            "Order successfully saved to Supabase:",
            order.id
        );

        // ---------------------------------------------------------
        // 6. AI ATTRIBUTION
        // ---------------------------------------------------------

        try {
            const lineItems = Array.isArray(order.line_items)
                ? order.line_items
                : [];

            if (lineItems.length === 0) {
                console.log(
                    "No line items found. Skipping AI attribution."
                );
            } else {
                // Get AI conversations from the last 7 days.
                //
                // We use a 7-day window for the initial attribution
                // model. This can later be made configurable.
                const sevenDaysAgo = new Date(
                    Date.now() -
                    7 * 24 * 60 * 60 * 1000
                ).toISOString();

                const customerEmail =
                    order.customer?.email?.toLowerCase() ?? null;

                let conversationsQuery = supabase
                    .from("ai_conversations")
                    .select(
                        `
                        id,
                        session_id,
                        customer_email,
                        recommended_products,
                        created_at
                        `
                    )
                    .gte(
                        "created_at",
                        sevenDaysAgo
                    )
                    .order(
                        "created_at",
                        {
                            ascending: false,
                        }
                    )
                    .limit(100);

                // If the order has an email, prioritize conversations
                // belonging to that same customer.
                if (customerEmail) {
                    conversationsQuery =
                        conversationsQuery.or(
                            `customer_email.eq.${customerEmail},customer_email.is.null`
                        );
                }

                const {
                    data: conversations,
                    error: conversationsError,
                } =
                    await conversationsQuery;

                if (conversationsError) {
                    console.error(
                        "Failed to fetch AI conversations:",
                        conversationsError
                    );
                } else if (
                    conversations &&
                    conversations.length > 0
                ) {
                    console.log(
                        "AI conversations checked:",
                        conversations.length
                    );

                    // -------------------------------------------------
                    // Find the most recent AI conversation that
                    // recommended a product actually purchased.
                    // -------------------------------------------------

                    const attributedConversationIds =
                        new Set<string>();

                    for (const lineItem of lineItems) {
                        const purchasedProductId =
                            normalizeProductId(
                                lineItem.product_id
                            );

                        if (!purchasedProductId) {
                            continue;
                        }

                        const purchasedProductTitle =
                            lineItem.title ??
                            lineItem.name ??
                            null;

                        const quantity =
                            Number(
                                lineItem.quantity
                            ) || 1;

                        const lineRevenue =
                            Number(
                                lineItem.price
                            ) * quantity || 0;

                        let matchedConversation:
                            | (typeof conversations)[number]
                            | null = null;

                        let matchConfidence = 0;
                        let attributionType =
                            "product_match";

                        for (const conversation of conversations) {
                            const recommendedProducts =
                                Array.isArray(
                                    conversation.recommended_products
                                )
                                    ? conversation.recommended_products
                                    : [];

                            const productWasRecommended =
                                recommendedProducts.some(
                                    (product: any) => {
                                        const recommendedProductId =
                                            normalizeProductId(
                                                product?.id
                                            );

                                        return (
                                            recommendedProductId ===
                                            purchasedProductId
                                        );
                                    }
                                );

                            if (!productWasRecommended) {
                                continue;
                            }

                            const conversationEmail =
                                conversation.customer_email?.toLowerCase() ??
                                null;

                            // Strongest signal:
                            // same customer email.
                            if (
                                customerEmail &&
                                conversationEmail ===
                                customerEmail
                            ) {
                                matchedConversation =
                                    conversation;

                                matchConfidence = 1;

                                attributionType =
                                    "customer_email_product_match";

                                break;
                            }

                            // Secondary signal:
                            // anonymous/product recommendation match.
                            if (
                                !matchedConversation &&
                                !attributedConversationIds.has(
                                    conversation.id
                                )
                            ) {
                                matchedConversation =
                                    conversation;

                                matchConfidence = 0.6;

                                attributionType =
                                    "product_match";
                            }
                        }

                        if (!matchedConversation) {
                            console.log(
                                "No AI attribution match for product:",
                                purchasedProductId
                            );

                            continue;
                        }

                        // -------------------------------------------------
                        // Prevent duplicate attribution processing
                        // within the same webhook execution.
                        // -------------------------------------------------

                        if (
                            attributedConversationIds.has(
                                matchedConversation.id
                            )
                        ) {
                            continue;
                        }

                        attributedConversationIds.add(
                            matchedConversation.id
                        );

                        // -------------------------------------------------
                        // Save attribution
                        // -------------------------------------------------

                        const { data: attributionData, error: attributionError } =
                            await supabase
                                .from("ai_attributions")
                                .insert({
                                    order_id: order.id,

                                    ai_conversation_id:
                                        matchedConversation.id,

                                    session_id:
                                        matchedConversation.session_id,

                                    product_id:
                                        purchasedProductId,

                                    product_title:
                                        purchasedProductTitle,

                                    attributed_revenue:
                                        lineRevenue,

                                    attribution_type:
                                        attributionType,

                                    attribution_status:
                                        "matched",

                                    confidence:
                                        matchConfidence,
                                })
                                .select()
                                .single();

                        if (attributionError) {
                            // Duplicate attribution should not make
                            // the Shopify webhook fail.
                            if (
                                attributionError.code ===
                                "23505"
                            ) {
                                console.log(
                                    "AI attribution already exists:",
                                    order.id,
                                    purchasedProductId
                                );
                            } else {
                                console.error(
                                    "AI attribution insert error:",
                                    attributionError
                                );
                            }
                        } else {
                            console.log(
                                "================================="
                            );
                            console.log(
                                "AI SALE ATTRIBUTED"
                            );
                            console.log(
                                "================================="
                            );
                            console.log(
                                "Order:",
                                order.id
                            );
                            console.log(
                                "Product:",
                                purchasedProductTitle
                            );
                            console.log(
                                "Product ID:",
                                purchasedProductId
                            );
                            console.log(
                                "Revenue:",
                                lineRevenue
                            );
                            console.log(
                                "AI Session:",
                                matchedConversation.session_id
                            );
                            console.log(
                                "Confidence:",
                                matchConfidence
                            );
                            console.log(
                                "Attribution:",
                                attributionData?.id
                            );
                            console.log(
                                "================================="
                            );
                        }
                    }
                } else {
                    console.log(
                        "No recent AI conversations found."
                    );
                }
            }
        } catch (attributionError) {
            // Attribution must NEVER cause Shopify's webhook
            // to fail. The order has already been saved.
            console.error(
                "AI attribution processing failed:",
                attributionError
            );
        }

        // ---------------------------------------------------------
        // 7. SUCCESS
        // ---------------------------------------------------------

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