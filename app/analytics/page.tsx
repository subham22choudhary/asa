"use client";

import { useEffect, useState } from "react";

type AnalyticsData = {
    success: boolean;

    summary: {
        totalOrders: number;
        totalRevenue: number;
        aiAttributedOrders: number;
        aiAttributedRevenue: number;
        aiAttributionRate: number;
        aiRevenueRate: number;
    };

    topProducts: {
        productId: string;
        productTitle: string;
        orders: number;
        revenue: number;
    }[];

    recentAISales: {
        attributionId: string;
        orderId: number;
        orderName: string;
        productId: string;
        productTitle: string;
        revenue: number;
        currency: string;
        customerEmail: string | null;
        confidence: number;
        attributionType: string;
        status: string;
        orderCreatedAt: string;
    }[];

    error?: string;
};

function formatMoney(
    amount: number,
    currency = "USD"
) {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
    }).format(amount);
}

function formatDate(date: string) {
    return new Date(date).toLocaleString();
}

export default function AnalyticsPage() {
    const [data, setData] =
        useState<AnalyticsData | null>(null);

    const [loading, setLoading] =
        useState(true);

    const [error, setError] =
        useState("");

    async function loadAnalytics() {
        try {
            setLoading(true);
            setError("");

            const response = await fetch(
                "/api/analytics",
                {
                    cache: "no-store",
                }
            );

            const result =
                await response.json();

            if (!response.ok || !result.success) {
                throw new Error(
                    result.error ||
                    "Failed to load analytics"
                );
            }

            setData(result);
        } catch (err) {
            console.error(
                "Analytics loading error:",
                err
            );

            setError(
                err instanceof Error
                    ? err.message
                    : "Failed to load analytics"
            );
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadAnalytics();
    }, []);

    if (loading) {
        return (
            <main className="min-h-screen bg-[#0b0b0b] text-white p-8">
                <div className="max-w-7xl mx-auto">
                    <div className="animate-pulse">
                        <div className="h-8 w-56 bg-white/10 rounded mb-3" />

                        <div className="h-4 w-80 bg-white/10 rounded mb-10" />

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                            {[1, 2, 3, 4].map(
                                (item) => (
                                    <div
                                        key={item}
                                        className="h-32 rounded-2xl bg-white/5"
                                    />
                                )
                            )}
                        </div>
                    </div>
                </div>
            </main>
        );
    }

    if (error || !data) {
        return (
            <main className="min-h-screen bg-[#0b0b0b] text-white p-8">
                <div className="max-w-7xl mx-auto">
                    <div className="border border-red-500/30 bg-red-500/10 rounded-2xl p-6">
                        <h1 className="text-xl font-semibold">
                            Analytics unavailable
                        </h1>

                        <p className="text-white/60 mt-2">
                            {error ||
                                "Unable to load analytics."}
                        </p>

                        <button
                            onClick={loadAnalytics}
                            className="mt-5 px-4 py-2 rounded-lg bg-white text-black font-medium hover:bg-white/90"
                        >
                            Retry
                        </button>
                    </div>
                </div>
            </main>
        );
    }

    const {
        summary,
        topProducts,
        recentAISales,
    } = data;

    return (
        <main className="min-h-screen bg-[#0b0b0b] text-white">
            <div className="max-w-7xl mx-auto px-6 py-8 md:px-8">

                {/* HEADER */}

                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5 mb-8">
                    <div>
                        <div className="flex items-center gap-3">
                            <div className="h-2.5 w-2.5 rounded-full bg-emerald-400" />

                            <span className="text-xs uppercase tracking-[0.2em] text-white/40">
                                AI Sales
                            </span>
                        </div>

                        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mt-3">
                            Sales Analytics
                        </h1>

                        <p className="text-white/50 mt-2">
                            Revenue and sales generated
                            through your AI assistant.
                        </p>
                    </div>

                    <button
                        onClick={loadAnalytics}
                        className="self-start md:self-auto px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition text-sm"
                    >
                        Refresh
                    </button>
                </div>

                {/* KPI CARDS */}

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">

                    <MetricCard
                        title="Total Revenue"
                        value={formatMoney(
                            summary.totalRevenue
                        )}
                        description="All Shopify orders"
                    />

                    <MetricCard
                        title="AI Revenue"
                        value={formatMoney(
                            summary.aiAttributedRevenue
                        )}
                        description={`${summary.aiRevenueRate}% of total revenue`}
                        highlighted
                    />

                    <MetricCard
                        title="Total Orders"
                        value={String(
                            summary.totalOrders
                        )}
                        description="Shopify orders"
                    />

                    <MetricCard
                        title="AI Attribution"
                        value={`${summary.aiAttributionRate}%`}
                        description={`${summary.aiAttributedOrders} AI-attributed orders`}
                    />

                </div>

                {/* AI REVENUE OVERVIEW */}

                <section className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">

                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

                        <div>
                            <p className="text-xs uppercase tracking-[0.18em] text-white/40">
                                AI Revenue Contribution
                            </p>

                            <h2 className="text-3xl font-semibold mt-2">
                                {summary.aiRevenueRate}%
                            </h2>

                            <p className="text-sm text-white/45 mt-1">
                                Revenue currently attributed
                                to AI-assisted product
                                recommendations.
                            </p>
                        </div>

                        <div className="w-full md:w-72">

                            <div className="flex justify-between text-xs text-white/40 mb-2">
                                <span>
                                    AI revenue
                                </span>

                                <span>
                                    {summary.aiRevenueRate}%
                                </span>
                            </div>

                            <div className="h-2 rounded-full bg-white/10 overflow-hidden">

                                <div
                                    className="h-full rounded-full bg-emerald-400 transition-all"
                                    style={{
                                        width: `${Math.min(
                                            summary.aiRevenueRate,
                                            100
                                        )}%`,
                                    }}
                                />

                            </div>
                        </div>

                    </div>

                </section>

                {/* TOP AI PRODUCTS */}

                <section className="mt-8">

                    <div className="mb-4">
                        <h2 className="text-xl font-semibold">
                            Top AI Products
                        </h2>

                        <p className="text-sm text-white/45 mt-1">
                            Products generating revenue from
                            AI recommendations.
                        </p>
                    </div>

                    {topProducts.length === 0 ? (
                        <EmptyState text="No AI-attributed products yet." />
                    ) : (
                        <div className="rounded-2xl border border-white/10 overflow-hidden">

                            <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-5 py-3 bg-white/[0.03] text-xs uppercase tracking-wider text-white/35">

                                <span>
                                    Product
                                </span>

                                <span>
                                    Orders
                                </span>

                                <span>
                                    Revenue
                                </span>

                            </div>

                            {topProducts.map(
                                (product) => (
                                    <div
                                        key={
                                            product.productId
                                        }
                                        className="grid grid-cols-[1fr_auto_auto] gap-4 items-center px-5 py-4 border-t border-white/5"
                                    >

                                        <div>
                                            <p className="font-medium">
                                                {
                                                    product.productTitle
                                                }
                                            </p>

                                            <p className="text-xs text-white/30 mt-1">
                                                {
                                                    product.productId
                                                }
                                            </p>
                                        </div>

                                        <span className="text-white/60">
                                            {
                                                product.orders
                                            }
                                        </span>

                                        <span className="font-medium">
                                            {formatMoney(
                                                product.revenue
                                            )}
                                        </span>

                                    </div>
                                )
                            )}

                        </div>
                    )}

                </section>

                {/* RECENT AI SALES */}

                <section className="mt-8 pb-12">

                    <div className="mb-4">
                        <h2 className="text-xl font-semibold">
                            Recent AI Sales
                        </h2>

                        <p className="text-sm text-white/45 mt-1">
                            Latest orders attributed to AI
                            recommendations.
                        </p>
                    </div>

                    {recentAISales.length === 0 ? (
                        <EmptyState text="No AI-attributed sales yet." />
                    ) : (
                        <div className="rounded-2xl border border-white/10 overflow-hidden">

                            <div className="overflow-x-auto">

                                <table className="w-full text-sm">

                                    <thead>
                                        <tr className="bg-white/[0.03] text-left text-xs uppercase tracking-wider text-white/35">

                                            <th className="px-5 py-3">
                                                Order
                                            </th>

                                            <th className="px-5 py-3">
                                                Product
                                            </th>

                                            <th className="px-5 py-3">
                                                Revenue
                                            </th>

                                            <th className="px-5 py-3">
                                                Confidence
                                            </th>

                                            <th className="px-5 py-3">
                                                Status
                                            </th>

                                            <th className="px-5 py-3">
                                                Date
                                            </th>

                                        </tr>
                                    </thead>

                                    <tbody>

                                        {recentAISales.map(
                                            (sale) => (
                                                <tr
                                                    key={
                                                        sale.attributionId
                                                    }
                                                    className="border-t border-white/5"
                                                >

                                                    <td className="px-5 py-4 font-medium">
                                                        {
                                                            sale.orderName
                                                        }
                                                    </td>

                                                    <td className="px-5 py-4">

                                                        <div>
                                                            {
                                                                sale.productTitle
                                                            }
                                                        </div>

                                                        <div className="text-xs text-white/30 mt-1">
                                                            AI recommendation
                                                        </div>

                                                    </td>

                                                    <td className="px-5 py-4 font-medium">
                                                        {formatMoney(
                                                            sale.revenue,
                                                            sale.currency ||
                                                            "USD"
                                                        )}
                                                    </td>

                                                    <td className="px-5 py-4">

                                                        <span className="inline-flex px-2.5 py-1 rounded-full bg-white/5 text-white/60 text-xs">
                                                            {Math.round(
                                                                sale.confidence *
                                                                100
                                                            )}
                                                            %
                                                        </span>

                                                    </td>

                                                    <td className="px-5 py-4">

                                                        <span className="inline-flex px-2.5 py-1 rounded-full bg-emerald-400/10 text-emerald-400 text-xs">
                                                            {
                                                                sale.status
                                                            }
                                                        </span>

                                                    </td>

                                                    <td className="px-5 py-4 text-white/45 whitespace-nowrap">
                                                        {formatDate(
                                                            sale.orderCreatedAt
                                                        )}
                                                    </td>

                                                </tr>
                                            )
                                        )}

                                    </tbody>

                                </table>

                            </div>

                        </div>
                    )}

                </section>

            </div>
        </main>
    );
}

function MetricCard({
    title,
    value,
    description,
    highlighted = false,
}: {
    title: string;
    value: string;
    description: string;
    highlighted?: boolean;
}) {
    return (
        <div
            className={`rounded-2xl border p-5 ${highlighted
                ? "border-emerald-400/20 bg-emerald-400/[0.05]"
                : "border-white/10 bg-white/[0.03]"
                }`}
        >
            <p className="text-xs uppercase tracking-[0.16em] text-white/40">
                {title}
            </p>

            <p className="text-3xl font-semibold tracking-tight mt-3">
                {value}
            </p>

            <p className="text-sm text-white/40 mt-2">
                {description}
            </p>
        </div>
    );
}

function EmptyState({
    text,
}: {
    text: string;
}) {
    return (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center text-white/40">
            {text}
        </div>
    );
}