import OpenAI from "openai";
import { NextResponse } from "next/server";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const SHOPIFY_STORE_DOMAIN =
    process.env.SHOPIFY_STORE_DOMAIN;

const SHOPIFY_ACCESS_TOKEN =
    process.env.SHOPIFY_ACCESS_TOKEN;

async function getShopifyProducts() {
    if (
        !SHOPIFY_STORE_DOMAIN ||
        !SHOPIFY_ACCESS_TOKEN
    ) {
        throw new Error(
            "Missing Shopify Admin API environment variables"
        );
    }

    const query = `
    query {
      products(first: 50) {
        nodes {
          id
          title
          handle
          description
          status
          totalInventory
          onlineStoreUrl

          featuredImage {
            url
            altText
          }

          variants(first: 10) {
            nodes {
              id
              title
              price
              availableForSale
            }
          }
        }
      }
    }
  `;

    const shopifyUrl =
        "https://" +
        SHOPIFY_STORE_DOMAIN +
        "/admin/api/2026-10/graphql.json";

    const response = await fetch(shopifyUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token":
                SHOPIFY_ACCESS_TOKEN,
        },
        body: JSON.stringify({
            query,
        }),
        cache: "no-store",
    });

    const result = await response.json();

    if (!response.ok || result.errors) {
        throw new Error(
            "Shopify API error: " +
            JSON.stringify(result.errors || result)
        );
    }

    return result.data.products.nodes;
}

export async function POST(request: Request) {
    try {
        const body = await request.json();

        const message = body.message;
        const conversation = body.conversation || [];

        if (
            !message ||
            typeof message !== "string"
        ) {
            return NextResponse.json(
                {
                    error: "Message is required",
                },
                {
                    status: 400,
                }
            );
        }

        const products = await getShopifyProducts();

        const productContext = products
            .map((product: any) => {
                const variants =
                    product.variants.nodes
                        .map((variant: any) => {
                            return (
                                variant.id +
                                " | " +
                                variant.title +
                                " | $" +
                                variant.price +
                                " | " +
                                (variant.availableForSale
                                    ? "Available"
                                    : "Unavailable")
                            );
                        })
                        .join("\n");

                return (
                    "\nPRODUCT ID: " +
                    product.id +
                    "\nTITLE: " +
                    product.title +
                    "\nHANDLE: " +
                    product.handle +
                    "\nDESCRIPTION: " +
                    (product.description ||
                        "No description") +
                    "\nINVENTORY: " +
                    product.totalInventory +
                    "\nSTATUS: " +
                    product.status +
                    "\nVARIANTS:\n" +
                    variants +
                    "\n"
                );
            })
            .join(
                "\n--------------------\n"
            );

        const instructions =
            "You are an AI sales assistant for a Shopify store.\n\n" +
            "Your job is to help customers discover products and make purchasing decisions.\n\n" +
            "Use ONLY the Shopify products provided below.\n\n" +
            "You have access to the customer's previous conversation. " +
            "Use it to understand follow-up questions and maintain context.\n\n" +
            "Return valid JSON with exactly this structure:\n\n" +
            "{\n" +
            '  "reply": "short helpful answer to the customer",\n' +
            '  "recommendedProductIds": ["product-id-1", "product-id-2"]\n' +
            "}\n\n" +
            "Rules:\n" +
            "- Never invent products.\n" +
            "- Only recommend products from the provided Shopify data.\n" +
            "- recommendedProductIds must contain actual PRODUCT IDs from the data.\n" +
            "- Recommend at most 3 products.\n" +
            "- If no product matches the request, return an empty array.\n" +
            "- Keep replies concise and useful.\n" +
            "- Consider price, availability, product description, inventory and the customer's request.\n" +
            "- Use previous conversation when answering follow-up questions.\n" +
            "- If the customer asks for the best products, select the products that best match their request and explain briefly why.\n" +
            "- If the customer asks for the cheapest product, compare prices.\n" +
            "- If the customer asks for the most expensive product, compare prices.\n" +
            "- If the customer asks about availability, use inventory and variant availability.\n" +
            "- If the customer asks about a product mentioned earlier, use the Shopify product data.\n" +
            "- If the customer asks which product is better, compare relevant products using available information.\n" +
            "- Do not claim that a product is in the cart.\n" +
            "- Do not claim that an order has been placed.\n" +
            "- Do not invent discounts, reviews, shipping times or specifications.\n" +
            "- Do not include markdown or code fences.\n\n" +
            "SHOPIFY PRODUCTS:\n\n" +
            productContext;

        const conversationMessages =
            conversation
                .filter(
                    (item: any) =>
                        item &&
                        (item.role === "user" ||
                            item.role === "assistant") &&
                        typeof item.content === "string"
                )
                .map((item: any) => {
                    return {
                        role: item.role,
                        content: item.content,
                    };
                });

        conversationMessages.push({
            role: "user",
            content: message,
        });

        const aiResponse =
            await openai.responses.create({
                model: "gpt-5-mini",
                instructions,
                input: conversationMessages,
            });

        const output =
            aiResponse.output_text.trim();

        let parsed;

        try {
            parsed = JSON.parse(output);
        } catch {
            throw new Error(
                "AI returned invalid JSON: " +
                output
            );
        }

        const recommendedProductIds =
            Array.isArray(
                parsed.recommendedProductIds
            )
                ? parsed.recommendedProductIds
                : [];

        const recommendedProducts =
            products.filter(
                (product: any) =>
                    recommendedProductIds.includes(
                        product.id
                    )
            );

        return NextResponse.json({
            success: true,

            reply:
                typeof parsed.reply === "string"
                    ? parsed.reply
                    : "I couldn't find a suitable recommendation.",

            products:
                recommendedProducts.map(
                    (product: any) => {
                        const firstVariant =
                            product.variants.nodes[0] ||
                            null;

                        return {
                            id: product.id,

                            title: product.title,

                            handle: product.handle,

                            price:
                                firstVariant?.price ??
                                null,

                            inventory:
                                product.totalInventory,

                            image:
                                product.featuredImage
                                    ?.url ?? null,

                            altText:
                                product.featuredImage
                                    ?.altText ??
                                product.title,

                            productUrl:
                                product.onlineStoreUrl ||
                                "https://" +
                                SHOPIFY_STORE_DOMAIN +
                                "/products/" +
                                product.handle,

                            variantId:
                                firstVariant?.id ??
                                null,

                            variantTitle:
                                firstVariant?.title ??
                                null,

                            availableForSale:
                                firstVariant
                                    ?.availableForSale ??
                                false,
                        };
                    }
                ),
        });
    } catch (error) {
        console.error(
            "AI Chat Error:",
            error
        );

        return NextResponse.json(
            {
                error: "AI request failed",

                details:
                    error instanceof Error
                        ? error.message
                        : String(error),
            },
            {
                status: 500,
            }
        );
    }
}