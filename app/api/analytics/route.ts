import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const SUPABASE_URL =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

const SUPABASE_SERVICE_ROLE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET() {
    try {
        if (
            !SUPABASE_URL ||
            !SUPABASE_SERVICE_ROLE_KEY
        ) {
            return NextResponse.json(
                {
                    error: "Missing Supabase configuration",
                },
                { status: 500 }
            );
        }

        const supabase = createClient(
            SUPABASE_URL,
            SUPABASE_SERVICE_ROLE_KEY
        );

        // ---------------------------------------------------------
        // 1. TOTAL ORDERS
        // ---------------------------------------------------------

        const {
            count: totalOrders,
            error: ordersCountError,
        } = await supabase
            .from("shopify_orders")
            .select("id", {
                count: "exact",
                head: true,
            });

        if (ordersCountError) {
            throw ordersCountError;
        }

        // ---------------------------------------------------------
        // 2. TOTAL REVENUE
        // ---------------------------------------------------------

        const {
            data: orders,
            error: ordersError,
        } = await supabase
            .from("shopify_orders")
            .select(
                "id, total_price, currency, created_at"
            );

        if (ordersError) {
            throw ordersError;
        }

        const totalRevenue =
            orders?.reduce(
                (sum, order) =>
                    sum +
                    (Number(order.total_price) || 0),
                0
            ) ?? 0;

        // ---------------------------------------------------------
        // 3. AI ATTRIBUTIONS
        // ---------------------------------------------------------

        const {
            data: attributions,
            error: attributionError,
        } = await supabase
            .from("ai_sales_analytics")
            .select("*")
            .order(
                "order_created_at",
                {
                    ascending: false,
                }
            );

        if (attributionError) {
            throw attributionError;
        }

        // ---------------------------------------------------------
        // 4. AI ATTRIBUTED ORDERS
        // ---------------------------------------------------------

        const uniqueOrderIds = new Set(
            (attributions ?? []).map(
                (item) => item.order_id
            )
        );

        const aiAttributedOrders =
            uniqueOrderIds.size;

        // ---------------------------------------------------------
        // 5. AI ATTRIBUTED REVENUE
        // ---------------------------------------------------------

        const aiAttributedRevenue =
            (attributions ?? []).reduce(
                (sum, item) =>
                    sum +
                    (Number(
                        item.attributed_revenue
                    ) || 0),
                0
            );

        // ---------------------------------------------------------
        // 6. AI ATTRIBUTION RATE
        // ---------------------------------------------------------

        const aiAttributionRate =
            totalOrders && totalOrders > 0
                ? (aiAttributedOrders /
                    totalOrders) *
                100
                : 0;

        // ---------------------------------------------------------
        // 7. AI REVENUE RATE
        // ---------------------------------------------------------

        const aiRevenueRate =
            totalRevenue > 0
                ? (aiAttributedRevenue /
                    totalRevenue) *
                100
                : 0;

        // ---------------------------------------------------------
        // 8. TOP AI PRODUCTS
        // ---------------------------------------------------------

        const productMap = new Map<
            string,
            {
                productId: string;
                productTitle: string;
                orders: number;
                revenue: number;
            }
        >();

        for (const item of attributions ?? []) {
            const productId =
                item.product_id ?? "unknown";

            const existing =
                productMap.get(productId);

            if (existing) {
                existing.orders += 1;

                existing.revenue +=
                    Number(
                        item.attributed_revenue
                    ) || 0;
            } else {
                productMap.set(productId, {
                    productId,
                    productTitle:
                        item.product_title ??
                        "Unknown Product",
                    orders: 1,
                    revenue:
                        Number(
                            item.attributed_revenue
                        ) || 0,
                });
            }
        }

        const topProducts = Array.from(
            productMap.values()
        )
            .sort(
                (a, b) =>
                    b.revenue - a.revenue
            )
            .slice(0, 10);

        // ---------------------------------------------------------
        // 9. RECENT AI SALES
        // ---------------------------------------------------------

        const recentAISales =
            (attributions ?? [])
                .slice(0, 20)
                .map((item) => ({
                    attributionId:
                        item.attribution_id,

                    orderId:
                        item.order_id,

                    orderName:
                        item.order_name,

                    productId:
                        item.product_id,

                    productTitle:
                        item.product_title,

                    revenue:
                        Number(
                            item.attributed_revenue
                        ) || 0,

                    currency:
                        item.currency,

                    customerEmail:
                        item.customer_email,

                    confidence:
                        Number(
                            item.confidence
                        ) || 0,

                    attributionType:
                        item.attribution_type,

                    status:
                        item.attribution_status,

                    orderCreatedAt:
                        item.order_created_at,
                }));

        // ---------------------------------------------------------
        // 10. RESPONSE
        // ---------------------------------------------------------

        return NextResponse.json({
            success: true,

            summary: {
                totalOrders:
                    totalOrders ?? 0,

                totalRevenue,

                aiAttributedOrders,

                aiAttributedRevenue,

                aiAttributionRate:
                    Number(
                        aiAttributionRate.toFixed(
                            2
                        )
                    ),

                aiRevenueRate:
                    Number(
                        aiRevenueRate.toFixed(
                            2
                        )
                    ),
            },

            topProducts,

            recentAISales,
        });
    } catch (error) {
        console.error(
            "Analytics API error:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                error:
                    "Failed to load analytics",
            },
            { status: 500 }
        );
    }
}