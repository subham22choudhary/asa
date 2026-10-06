import { NextResponse } from "next/server";

const SHOPIFY_STORE_DOMAIN =
    process.env.SHOPIFY_STORE_DOMAIN;

const SHOPIFY_STOREFRONT_ACCESS_TOKEN =
    process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN;

const SHOPIFY_API_VERSION = "2026-10";

const CART_FIELDS = `
  id
  checkoutUrl
  totalQuantity

  cost {
    subtotalAmount {
      amount
      currencyCode
    }
    totalAmount {
      amount
      currencyCode
    }
  }

  lines(first: 50) {
    nodes {
      id
      quantity

      merchandise {
        ... on ProductVariant {
          id
          title

          price {
            amount
            currencyCode
          }

          product {
            id
            title
            handle

            featuredImage {
              url
              altText
            }
          }
        }
      }
    }
  }
`;

async function shopifyRequest(
    query: string,
    variables: Record<string, unknown>
) {
    if (
        !SHOPIFY_STORE_DOMAIN ||
        !SHOPIFY_STOREFRONT_ACCESS_TOKEN
    ) {
        throw new Error(
            "Missing SHOPIFY_STORE_DOMAIN or SHOPIFY_STOREFRONT_ACCESS_TOKEN in .env.local"
        );
    }

    const url =
        "https://" +
        SHOPIFY_STORE_DOMAIN +
        "/api/" +
        SHOPIFY_API_VERSION +
        "/graphql.json";

    const response = await fetch(url, {
        method: "POST",

        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "X-Shopify-Storefront-Access-Token":
                SHOPIFY_STOREFRONT_ACCESS_TOKEN,
        },

        body: JSON.stringify({
            query,
            variables,
        }),

        cache: "no-store",
    });

    const responseText = await response.text();

    let result: any;

    try {
        result = JSON.parse(responseText);
    } catch {
        throw new Error(
            "Shopify returned a non-JSON response. HTTP " +
            response.status +
            ": " +
            responseText.substring(0, 500)
        );
    }

    if (!response.ok) {
        throw new Error(
            "Shopify HTTP error " +
            response.status +
            ": " +
            JSON.stringify(result)
        );
    }

    if (result.errors) {
        throw new Error(
            "Shopify GraphQL error: " +
            JSON.stringify(result.errors)
        );
    }

    return result.data;
}

function getUserErrors(
    userErrors: Array<{
        field?: string[];
        message: string;
    }>
) {
    if (
        !userErrors ||
        userErrors.length === 0
    ) {
        return null;
    }

    return userErrors
        .map((error) => error.message)
        .join(", ");
}

export async function POST(
    request: Request
) {
    try {
        const body = await request.json();

        const action = body.action;

        /*
         * CREATE CART
         */
        if (action === "create") {
            const variantId = body.variantId;

            const quantity = Number(
                body.quantity || 1
            );

            if (!variantId) {
                return NextResponse.json(
                    {
                        error:
                            "variantId is required",
                    },
                    {
                        status: 400,
                    }
                );
            }

            if (quantity < 1) {
                return NextResponse.json(
                    {
                        error:
                            "Quantity must be at least 1",
                    },
                    {
                        status: 400,
                    }
                );
            }

            const mutation = `
        mutation CartCreate(
          $input: CartInput!
        ) {
          cartCreate(
            input: $input
          ) {
            cart {
              ${CART_FIELDS}
            }

            userErrors {
              field
              message
            }
          }
        }
      `;

            const data =
                await shopifyRequest(
                    mutation,
                    {
                        input: {
                            lines: [
                                {
                                    merchandiseId:
                                        variantId,
                                    quantity,
                                },
                            ],
                        },
                    }
                );

            const userErrors =
                getUserErrors(
                    data.cartCreate.userErrors
                );

            if (userErrors) {
                return NextResponse.json(
                    {
                        error: userErrors,
                    },
                    {
                        status: 400,
                    }
                );
            }

            return NextResponse.json({
                success: true,
                cart: data.cartCreate.cart,
            });
        }

        /*
         * GET CART
         */
        if (action === "get") {
            const cartId = body.cartId;

            if (!cartId) {
                return NextResponse.json(
                    {
                        error:
                            "cartId is required",
                    },
                    {
                        status: 400,
                    }
                );
            }

            const query = `
        query Cart(
          $id: ID!
        ) {
          cart(id: $id) {
            ${CART_FIELDS}
          }
        }
      `;

            const data =
                await shopifyRequest(
                    query,
                    {
                        id: cartId,
                    }
                );

            if (!data.cart) {
                return NextResponse.json(
                    {
                        error:
                            "Cart not found or expired.",
                    },
                    {
                        status: 404,
                    }
                );
            }

            return NextResponse.json({
                success: true,
                cart: data.cart,
            });
        }

        /*
         * ADD TO EXISTING CART
         */
        if (action === "add") {
            const cartId = body.cartId;
            const variantId = body.variantId;

            const quantity = Number(
                body.quantity || 1
            );

            if (!cartId) {
                return NextResponse.json(
                    {
                        error:
                            "cartId is required",
                    },
                    {
                        status: 400,
                    }
                );
            }

            if (!variantId) {
                return NextResponse.json(
                    {
                        error:
                            "variantId is required",
                    },
                    {
                        status: 400,
                    }
                );
            }

            if (quantity < 1) {
                return NextResponse.json(
                    {
                        error:
                            "Quantity must be at least 1",
                    },
                    {
                        status: 400,
                    }
                );
            }

            const mutation = `
        mutation CartLinesAdd(
          $cartId: ID!,
          $lines: [CartLineInput!]!
        ) {
          cartLinesAdd(
            cartId: $cartId,
            lines: $lines
          ) {
            cart {
              ${CART_FIELDS}
            }

            userErrors {
              field
              message
            }
          }
        }
      `;

            const data =
                await shopifyRequest(
                    mutation,
                    {
                        cartId,

                        lines: [
                            {
                                merchandiseId:
                                    variantId,
                                quantity,
                            },
                        ],
                    }
                );

            const userErrors =
                getUserErrors(
                    data.cartLinesAdd.userErrors
                );

            if (userErrors) {
                return NextResponse.json(
                    {
                        error: userErrors,
                    },
                    {
                        status: 400,
                    }
                );
            }

            return NextResponse.json({
                success: true,
                cart: data.cartLinesAdd.cart,
            });
        }

        /*
         * UPDATE CART LINE
         */
        if (action === "update") {
            const cartId = body.cartId;
            const lineId = body.lineId;

            const quantity = Number(
                body.quantity
            );

            if (!cartId) {
                return NextResponse.json(
                    {
                        error:
                            "cartId is required",
                    },
                    {
                        status: 400,
                    }
                );
            }

            if (!lineId) {
                return NextResponse.json(
                    {
                        error:
                            "lineId is required",
                    },
                    {
                        status: 400,
                    }
                );
            }

            if (
                !Number.isInteger(quantity) ||
                quantity < 1
            ) {
                return NextResponse.json(
                    {
                        error:
                            "Quantity must be a positive integer.",
                    },
                    {
                        status: 400,
                    }
                );
            }

            const mutation = `
        mutation CartLinesUpdate(
          $cartId: ID!,
          $lines: [CartLineUpdateInput!]!
        ) {
          cartLinesUpdate(
            cartId: $cartId,
            lines: $lines
          ) {
            cart {
              ${CART_FIELDS}
            }

            userErrors {
              field
              message
            }
          }
        }
      `;

            const data =
                await shopifyRequest(
                    mutation,
                    {
                        cartId,

                        lines: [
                            {
                                id: lineId,
                                quantity,
                            },
                        ],
                    }
                );

            const userErrors =
                getUserErrors(
                    data.cartLinesUpdate.userErrors
                );

            if (userErrors) {
                return NextResponse.json(
                    {
                        error: userErrors,
                    },
                    {
                        status: 400,
                    }
                );
            }

            return NextResponse.json({
                success: true,
                cart:
                    data.cartLinesUpdate.cart,
            });
        }

        /*
         * REMOVE CART LINE
         */
        if (action === "remove") {
            const cartId = body.cartId;
            const lineId = body.lineId;

            if (!cartId) {
                return NextResponse.json(
                    {
                        error:
                            "cartId is required",
                    },
                    {
                        status: 400,
                    }
                );
            }

            if (!lineId) {
                return NextResponse.json(
                    {
                        error:
                            "lineId is required",
                    },
                    {
                        status: 400,
                    }
                );
            }

            const mutation = `
        mutation CartLinesRemove(
          $cartId: ID!,
          $lineIds: [ID!]!
        ) {
          cartLinesRemove(
            cartId: $cartId,
            lineIds: $lineIds
          ) {
            cart {
              ${CART_FIELDS}
            }

            userErrors {
              field
              message
            }
          }
        }
      `;

            const data =
                await shopifyRequest(
                    mutation,
                    {
                        cartId,

                        lineIds: [lineId],
                    }
                );

            const userErrors =
                getUserErrors(
                    data.cartLinesRemove.userErrors
                );

            if (userErrors) {
                return NextResponse.json(
                    {
                        error: userErrors,
                    },
                    {
                        status: 400,
                    }
                );
            }

            return NextResponse.json({
                success: true,
                cart:
                    data.cartLinesRemove.cart,
            });
        }

        /*
         * INVALID ACTION
         */
        return NextResponse.json(
            {
                error:
                    "Invalid action. Use create, get, add, update, or remove.",
            },
            {
                status: 400,
            }
        );
    } catch (error) {
        console.error(
            "Cart API Error:",
            error
        );

        return NextResponse.json(
            {
                error: "Cart request failed",

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