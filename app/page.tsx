"use client";

import { FormEvent, useEffect, useState } from "react";

type Product = {
  id: string;
  title: string;
  handle: string;
  price: string | null;
  inventory: number;
  image: string | null;
  altText: string;
  productUrl: string;
  variantId: string | null;
  variantTitle: string | null;
  availableForSale: boolean;
};

type Message = {
  role: "user" | "assistant";
  content: string;
  products?: Product[];
};

type CartLine = {
  id: string;
  quantity: number;
  merchandise: {
    id: string;
    title: string;
    price: {
      amount: string;
      currencyCode: string;
    };
    product: {
      id: string;
      title: string;
      handle: string;
      featuredImage: {
        url: string;
        altText: string | null;
      } | null;
    };
  };
};

type Cart = {
  id: string;
  checkoutUrl: string;
  totalQuantity: number;
  cost: {
    subtotalAmount: {
      amount: string;
      currencyCode: string;
    };
    totalAmount: {
      amount: string;
      currencyCode: string;
    };
  };
  lines: {
    nodes: CartLine[];
  };
};

type Customer = {
  id: string;
  email: string | null;
  phone: string | null;
  name: string | null;
  email_consent: boolean;
  whatsapp_consent: boolean;
  sms_consent: boolean;
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hi! I'm your AI shopping assistant. What are you looking for today?",
    },
  ]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [cart, setCart] = useState<Cart | null>(null);
  const [cartLoading, setCartLoading] = useState(false);

  // --------------------------------------------
  // CUSTOMER
  // --------------------------------------------

  const [customer, setCustomer] = useState<Customer | null>(null);

  const [showCustomerForm, setShowCustomerForm] =
    useState(false);

  const [customerFormLoading, setCustomerFormLoading] =
    useState(false);

  const [pendingProduct, setPendingProduct] =
    useState<Product | null>(null);

  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  const [emailConsent, setEmailConsent] = useState(false);
  const [whatsappConsent, setWhatsappConsent] =
    useState(false);
  const [smsConsent, setSmsConsent] = useState(false);

  // --------------------------------------------
  // TRACKING
  // --------------------------------------------

  const [sessionId, setSessionId] = useState<string | null>(
    null
  );

  const [conversationId, setConversationId] =
    useState<string | null>(null);

  // --------------------------------------------
  // INITIAL LOAD
  // --------------------------------------------

  useEffect(() => {
    let savedSessionId =
      localStorage.getItem("asa_session_id");

    if (!savedSessionId) {
      savedSessionId =
        typeof crypto !== "undefined" &&
          typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()
            .toString(36)
            .slice(2)}`;

      localStorage.setItem(
        "asa_session_id",
        savedSessionId
      );
    }

    const savedConversationId =
      localStorage.getItem("asa_conversation_id");

    const savedCartId =
      localStorage.getItem("shopify_cart_id");

    const savedCustomerId =
      localStorage.getItem("asa_customer_id");

    setSessionId(savedSessionId);

    if (savedConversationId) {
      setConversationId(savedConversationId);
    }

    if (savedCartId) {
      loadCart(savedCartId);
    }

    if (savedCustomerId) {
      loadCustomer(
        savedCustomerId,
        savedSessionId
      );
    }
  }, []);

  // --------------------------------------------
  // TRACKING API HELPER
  // --------------------------------------------

  async function trackingRequest(
    body: Record<string, unknown>
  ) {
    try {
      const response = await fetch("/api/tracking", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error(
          "Tracking request failed:",
          data
        );
        return null;
      }

      return data;
    } catch (error) {
      console.error("Tracking request error:", error);
      return null;
    }
  }

  // --------------------------------------------
  // CREATE / GET CONVERSATION
  // --------------------------------------------

  async function ensureConversation(
    customerId?: string,
    sessionIdOverride?: string
  ): Promise<string | null> {
    const activeCustomerId =
      customerId || customer?.id;

    const activeSessionId =
      sessionIdOverride || sessionId;

    if (!activeCustomerId || !activeSessionId) {
      return null;
    }

    if (conversationId) {
      return conversationId;
    }

    const savedConversationId =
      localStorage.getItem("asa_conversation_id");

    if (savedConversationId) {
      setConversationId(savedConversationId);
      return savedConversationId;
    }

    const data = await trackingRequest({
      action: "conversation",
      customerId: activeCustomerId,
      sessionId: activeSessionId,
    });

    if (!data?.conversation?.id) {
      return null;
    }

    const newConversationId =
      data.conversation.id;

    localStorage.setItem(
      "asa_conversation_id",
      newConversationId
    );

    setConversationId(newConversationId);

    return newConversationId;
  }

  // --------------------------------------------
  // LOAD CUSTOMER
  // --------------------------------------------

  async function loadCustomer(
    customerId: string,
    savedSessionId?: string
  ) {
    try {
      const response = await fetch("/api/customer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "get",
          customerId,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.customer) {
        localStorage.removeItem("asa_customer_id");
        return;
      }

      const savedCustomer =
        data.customer as Customer;

      setCustomer(savedCustomer);

      setCustomerName(
        savedCustomer.name || ""
      );

      setCustomerEmail(
        savedCustomer.email || ""
      );

      setCustomerPhone(
        savedCustomer.phone || ""
      );

      setEmailConsent(
        Boolean(savedCustomer.email_consent)
      );

      setWhatsappConsent(
        Boolean(savedCustomer.whatsapp_consent)
      );

      setSmsConsent(
        Boolean(savedCustomer.sms_consent)
      );

      const existingConversationId =
        await ensureConversation(
          savedCustomer.id,
          savedSessionId
        );

      if (existingConversationId) {
        await loadConversationHistory(
          savedCustomer.id,
          existingConversationId
        );
      }
    } catch (error) {
      console.error(
        "Load customer error:",
        error
      );
    }
  }

  // --------------------------------------------
  // TRACK MESSAGE
  // --------------------------------------------

  async function trackMessage(
    role: "user" | "assistant",
    content: string,
    customerId?: string,
    existingConversationId?: string
  ) {
    const activeCustomerId =
      customerId || customer?.id;

    if (!activeCustomerId || !content.trim()) {
      return;
    }

    const activeConversationId =
      existingConversationId ||
      (await ensureConversation(activeCustomerId));

    if (!activeConversationId) {
      return;
    }

    await trackingRequest({
      action: "message",
      customerId: activeCustomerId,
      conversationId: activeConversationId,
      role,
      content,
    });
  }

  // --------------------------------------------
  // TRACK EVENT
  // --------------------------------------------

  async function trackEvent(
    eventType: string,
    options?: {
      productId?: string;
      productTitle?: string;
      metadata?: Record<string, unknown>;
      customerId?: string;
      existingConversationId?: string;
    }
  ) {
    const activeCustomerId =
      options?.customerId || customer?.id;

    if (!activeCustomerId) {
      return;
    }

    const activeConversationId =
      options?.existingConversationId ||
      (await ensureConversation(activeCustomerId));

    await trackingRequest({
      action: "event",
      customerId: activeCustomerId,
      conversationId:
        activeConversationId || undefined,
      eventType,
      productId: options?.productId,
      productTitle: options?.productTitle,
      metadata: options?.metadata || {},
    });
  }

  // --------------------------------------------
  // BACKFILL EXISTING CHAT
  // --------------------------------------------

  async function syncExistingMessages(
    customerId: string,
    existingConversationId: string
  ) {
    const syncKey =
      `asa_messages_synced_${existingConversationId}`;

    if (localStorage.getItem(syncKey)) {
      return;
    }

    for (const message of messages) {
      await trackingRequest({
        action: "message",
        customerId,
        conversationId: existingConversationId,
        role: message.role,
        content: message.content,
      });

      if (
        message.role === "assistant" &&
        message.products
      ) {
        for (const product of message.products) {
          await trackingRequest({
            action: "event",
            customerId,
            conversationId:
              existingConversationId,
            eventType:
              "product_recommended",
            productId: product.id,
            productTitle: product.title,
            metadata: {
              productHandle: product.handle,
              price: product.price,
              inventory: product.inventory,
            },
          });
        }
      }
    }

    localStorage.setItem(syncKey, "true");
  }

  // --------------------------------------------
  // LOAD CONVERSATION HISTORY
  // --------------------------------------------

  async function loadConversationHistory(
    customerId: string,
    existingConversationId: string
  ) {
    try {
      const data = await trackingRequest({
        action: "history",
        customerId,
        conversationId:
          existingConversationId,
      });

      if (!data?.messages) {
        return;
      }

      const restoredMessages: Message[] =
        data.messages
          .filter(
            (message: {
              role: string;
              content: string;
            }) =>
              message.role === "user" ||
              message.role === "assistant"
          )
          .map(
            (message: {
              role:
              | "user"
              | "assistant";
              content: string;
            }) => ({
              role: message.role,
              content: message.content,
            })
          );

      if (restoredMessages.length > 0) {
        setMessages(restoredMessages);
      }
    } catch (error) {
      console.error(
        "Load conversation history error:",
        error
      );
    }
  }

  // --------------------------------------------
  // LOAD CART
  // --------------------------------------------

  async function loadCart(cartId: string) {
    try {
      const response = await fetch("/api/cart", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "get",
          cartId,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.cart) {
        localStorage.removeItem(
          "shopify_cart_id"
        );
        setCart(null);
        return;
      }

      setCart(data.cart);
    } catch (error) {
      console.error(
        "Load cart error:",
        error
      );
    }
  }

  // --------------------------------------------
  // ADD TO CART
  // --------------------------------------------

  async function addToCart(product: Product) {
    if (!product.variantId) {
      return;
    }

    if (!product.availableForSale) {
      return;
    }

    if (!customer) {
      setPendingProduct(product);
      setShowCustomerForm(true);
      return;
    }

    await actuallyAddToCart(product);
  }

  // --------------------------------------------
  // ACTUALLY ADD PRODUCT
  // --------------------------------------------

  async function actuallyAddToCart(
    product: Product
  ) {
    if (!product.variantId) {
      return;
    }

    setCartLoading(true);

    try {
      let response;
      let data;

      if (!cart) {
        response = await fetch("/api/cart", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "create",
            variantId: product.variantId,
            quantity: 1,
          }),
        });

        data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ||
            "Unable to create cart"
          );
        }

        localStorage.setItem(
          "shopify_cart_id",
          data.cart.id
        );

        setCart(data.cart);

        await trackEvent(
          "add_to_cart",
          {
            productId: product.id,
            productTitle: product.title,
            metadata: {
              variantId:
                product.variantId,
              variantTitle:
                product.variantTitle,
              quantity: 1,
              cartId: data.cart.id,
              cartTotalQuantity:
                data.cart.totalQuantity,
            },
          }
        );
      } else {
        response = await fetch("/api/cart", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "add",
            cartId: cart.id,
            variantId: product.variantId,
            quantity: 1,
          }),
        });

        data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ||
            "Unable to add product"
          );
        }

        setCart(data.cart);

        await trackEvent(
          "add_to_cart",
          {
            productId: product.id,
            productTitle: product.title,
            metadata: {
              variantId:
                product.variantId,
              variantTitle:
                product.variantTitle,
              quantity: 1,
              cartId: data.cart.id,
              cartTotalQuantity:
                data.cart.totalQuantity,
            },
          }
        );
      }
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Unable to add product to cart."
      );
    } finally {
      setCartLoading(false);
    }
  }

  // --------------------------------------------
  // SAVE CUSTOMER
  // --------------------------------------------

  async function saveCustomer(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const email =
      customerEmail.trim();

    const phone =
      customerPhone.trim();

    if (!email) {
      alert("Please enter your email.");
      return;
    }

    if (!phone) {
      alert(
        "Please enter your phone number."
      );
      return;
    }

    setCustomerFormLoading(true);

    try {
      const response = await fetch(
        "/api/customer",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            action: "create",
            name:
              customerName.trim() || null,
            email,
            phone,
            emailConsent,
            whatsappConsent,
            smsConsent,
          }),
        }
      );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.customer
      ) {
        throw new Error(
          data.error ||
          "Unable to save customer information."
        );
      }

      const savedCustomer =
        data.customer as Customer;

      setCustomer(savedCustomer);

      localStorage.setItem(
        "asa_customer_id",
        savedCustomer.id
      );

      /*
       * Create the persistent conversation.
       *
       * Use the current state sessionId here.
       * If state has not initialized yet,
       * fall back to localStorage.
       */
      const savedSessionId =
        sessionId ||
        localStorage.getItem(
          "asa_session_id"
        ) ||
        undefined;

      const newConversationId =
        await ensureConversation(
          savedCustomer.id,
          savedSessionId
        );

      /*
       * Upload the conversation that
       * happened before customer details
       * were provided.
       */
      if (newConversationId) {
        await syncExistingMessages(
          savedCustomer.id,
          newConversationId
        );
      }

      setShowCustomerForm(false);

      /*
       * If the customer was trying to add
       * a product, continue automatically.
       */
      if (pendingProduct) {
        const product =
          pendingProduct;

        setPendingProduct(null);

        await actuallyAddToCart(
          product
        );
      }
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Unable to save customer information."
      );
    } finally {
      setCustomerFormLoading(false);
    }
  }

  // --------------------------------------------
  // UPDATE CART QUANTITY
  // --------------------------------------------

  async function updateCartQuantity(
    lineId: string,
    quantity: number
  ) {
    if (!cart) {
      return;
    }

    if (quantity <= 0) {
      await removeFromCart(lineId);
      return;
    }

    setCartLoading(true);

    try {
      const response = await fetch(
        "/api/cart",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            action: "update",
            cartId: cart.id,
            lineId,
            quantity,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
          "Unable to update cart"
        );
      }

      setCart(data.cart);

      await trackEvent(
        "cart_updated",
        {
          metadata: {
            cartId: data.cart.id,
            lineId,
            quantity,
            cartTotalQuantity:
              data.cart.totalQuantity,
          },
        }
      );
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Unable to update cart."
      );
    } finally {
      setCartLoading(false);
    }
  }

  // --------------------------------------------
  // REMOVE FROM CART
  // --------------------------------------------

  async function removeFromCart(
    lineId: string
  ) {
    if (!cart) {
      return;
    }

    setCartLoading(true);

    try {
      const response = await fetch(
        "/api/cart",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            action: "remove",
            cartId: cart.id,
            lineId,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
          "Unable to remove item"
        );
      }

      setCart(data.cart);

      await trackEvent(
        "cart_removed",
        {
          metadata: {
            cartId: data.cart.id,
            lineId,
            cartTotalQuantity:
              data.cart.totalQuantity,
          },
        }
      );
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Unable to remove item."
      );
    } finally {
      setCartLoading(false);
    }
  }

  // --------------------------------------------
  // SEND AI MESSAGE
  // --------------------------------------------

  async function sendMessage(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const message = input.trim();

    if (!message || loading) {
      return;
    }

    setInput("");

    const conversation =
      messages.map((item) => ({
        role: item.role,
        content: item.content,
      }));

    setMessages((current) => [
      ...current,
      {
        role: "user",
        content: message,
      },
    ]);

    /*
     * Save user message if customer
     * is already known.
     */
    if (customer) {
      await trackMessage(
        "user",
        message
      );
    }

    setLoading(true);

    try {
      const response = await fetch(
        "/api/ai/chat",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            message,
            conversation,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
          "Something went wrong"
        );
      }

      const assistantMessage = {
        role: "assistant" as const,
        content: data.reply,
        products:
          data.products || [],
      };

      setMessages((current) => [
        ...current,
        assistantMessage,
      ]);

      /*
       * Save AI response.
       */
      if (customer) {
        const activeConversationId =
          await ensureConversation(
            customer.id
          );

        await trackMessage(
          "assistant",
          data.reply,
          customer.id,
          activeConversationId ||
          undefined
        );

        /*
         * Record every product
         * recommended by ASA.
         */
        for (const product of
          data.products || []) {
          await trackEvent(
            "product_recommended",
            {
              customerId:
                customer.id,
              existingConversationId:
                activeConversationId ||
                undefined,
              productId:
                product.id,
              productTitle:
                product.title,
              metadata: {
                productHandle:
                  product.handle,
                price:
                  product.price,
                inventory:
                  product.inventory,
                variantId:
                  product.variantId,
                variantTitle:
                  product.variantTitle,
                availableForSale:
                  product.availableForSale,
              },
            }
          );
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Sorry, something went wrong.";

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: errorMessage,
        },
      ]);

      if (customer) {
        await trackMessage(
          "assistant",
          errorMessage
        );
      }
    } finally {
      setLoading(false);
    }
  }

  // --------------------------------------------
  // VIEW PRODUCT
  // --------------------------------------------

  async function handleViewProduct(
    product: Product
  ) {
    if (customer) {
      await trackEvent(
        "product_viewed",
        {
          productId: product.id,
          productTitle:
            product.title,
          metadata: {
            productHandle:
              product.handle,
            price:
              product.price,
            inventory:
              product.inventory,
          },
        }
      );
    }

    window.open(
      product.productUrl,
      "_blank",
      "noopener,noreferrer"
    );
  }

  // --------------------------------------------
  // CHECKOUT
  // --------------------------------------------

  async function handleCheckout() {
    if (!cart) {
      return;
    }

    if (!customer) {
      setShowCustomerForm(true);
      return;
    }

    /*
     * Record checkout attempt before
     * redirecting to Shopify.
     */
    await trackEvent(
      "checkout_started",
      {
        metadata: {
          cartId: cart.id,
          checkoutUrl:
            cart.checkoutUrl,
          totalQuantity:
            cart.totalQuantity,
          subtotal:
            cart.cost
              .subtotalAmount
              .amount,
          currency:
            cart.cost
              .subtotalAmount
              .currencyCode,
        },
      }
    );

    window.location.href =
      cart.checkoutUrl;
  }

  return (
    <main className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl h-[800px] bg-white rounded-2xl shadow-xl overflow-hidden flex">

        {/* -------------------------------------- */}
        {/* CHAT */}
        {/* -------------------------------------- */}

        <div className="flex-1 flex flex-col min-w-0">

          <header className="bg-black text-white px-6 py-5">
            <h1 className="text-xl font-semibold">
              AI Sales Assistant
            </h1>

            <p className="text-sm text-gray-300 mt-1">
              Ask me about products, prices,
              availability, and recommendations.
            </p>
          </header>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">

            {messages.map(
              (message, index) => (
                <div key={index}>

                  <div
                    className={`flex ${message.role ===
                      "user"
                      ? "justify-end"
                      : "justify-start"
                      }`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${message.role ===
                        "user"
                        ? "bg-black text-white"
                        : "bg-gray-100 text-gray-900"
                        }`}
                    >
                      {message.content}
                    </div>
                  </div>

                  {message.role ===
                    "assistant" &&
                    message.products &&
                    message.products.length >
                    0 && (

                      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">

                        {message.products.map(
                          (product) => (

                            <div
                              key={
                                product.id
                              }
                              className="border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-sm"
                            >

                              <div className="aspect-square bg-gray-100">

                                {product.image ? (
                                  <img
                                    src={
                                      product.image
                                    }
                                    alt={
                                      product.altText
                                    }
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
                                    No image
                                  </div>
                                )}

                              </div>

                              <div className="p-4">

                                <h2 className="font-semibold text-gray-900 line-clamp-2">
                                  {
                                    product.title
                                  }
                                </h2>

                                {product.variantTitle && (
                                  <p className="text-xs text-gray-500 mt-1">
                                    {
                                      product.variantTitle
                                    }
                                  </p>
                                )}

                                <div className="mt-2">
                                  <span className="text-lg font-bold text-gray-900">
                                    {product.price
                                      ? "$" +
                                      product.price
                                      : "Price unavailable"}
                                  </span>
                                </div>

                                <p className="text-xs text-gray-500 mt-1">
                                  {product.inventory >
                                    0
                                    ? product.inventory +
                                    " available"
                                    : "Currently unavailable"}
                                </p>

                                <div className="grid grid-cols-2 gap-2 mt-4">

                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleViewProduct(
                                        product
                                      )
                                    }
                                    className="border border-gray-300 text-gray-900 text-center rounded-xl px-3 py-3 text-sm font-medium hover:bg-gray-50"
                                  >
                                    View Product
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      addToCart(
                                        product
                                      )
                                    }
                                    disabled={
                                      cartLoading ||
                                      !product.availableForSale ||
                                      !product.variantId
                                    }
                                    className="bg-black text-white rounded-xl px-3 py-3 text-sm font-medium disabled:opacity-40"
                                  >
                                    {cartLoading
                                      ? "Adding..."
                                      : "Add to Cart"}
                                  </button>

                                </div>

                              </div>

                            </div>

                          )
                        )}

                      </div>

                    )}

                </div>
              )
            )}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 text-gray-500 rounded-2xl px-4 py-3 text-sm">
                  Thinking...
                </div>
              </div>
            )}

          </div>

          <form
            onSubmit={sendMessage}
            className="border-t border-gray-200 p-4 flex gap-3"
          >

            <input
              value={input}
              onChange={(event) =>
                setInput(
                  event.target.value
                )
              }
              placeholder="Ask about products..."
              disabled={loading}
              className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black disabled:bg-gray-100"
            />

            <button
              type="submit"
              disabled={
                loading ||
                !input.trim()
              }
              className="rounded-xl bg-black text-white px-5 py-3 text-sm font-medium disabled:opacity-40"
            >
              Send
            </button>

          </form>

        </div>

        {/* -------------------------------------- */}
        {/* CART */}
        {/* -------------------------------------- */}

        <aside className="w-[360px] border-l border-gray-200 bg-gray-50 flex flex-col">

          <div className="px-5 py-5 border-b border-gray-200">

            <div className="flex items-center justify-between">

              <h2 className="font-semibold text-gray-900">
                Your Cart
              </h2>

              {cart && (
                <span className="text-xs bg-black text-white rounded-full px-2 py-1">
                  {
                    cart.totalQuantity
                  }
                </span>
              )}

            </div>

          </div>

          <div className="flex-1 overflow-y-auto p-5">

            {!cart ||
              cart.lines.nodes.length ===
              0 ? (

              <div className="h-full flex items-center justify-center text-center">

                <div>

                  <p className="font-medium text-gray-700">
                    Your cart is empty
                  </p>

                  <p className="text-sm text-gray-500 mt-1">
                    Add a product to get started.
                  </p>

                </div>

              </div>

            ) : (

              <div className="space-y-4">

                {cart.lines.nodes.map(
                  (line) => (

                    <div
                      key={line.id}
                      className="bg-white rounded-xl border border-gray-200 p-3"
                    >

                      <div className="flex gap-3">

                        {line.merchandise
                          .product
                          .featuredImage ? (

                          <img
                            src={
                              line
                                .merchandise
                                .product
                                .featuredImage
                                .url
                            }
                            alt={
                              line
                                .merchandise
                                .product
                                .featuredImage
                                .altText ||
                              line
                                .merchandise
                                .product
                                .title
                            }
                            className="w-16 h-16 rounded-lg object-cover"
                          />

                        ) : (

                          <div className="w-16 h-16 rounded-lg bg-gray-100" />

                        )}

                        <div className="flex-1 min-w-0">

                          <p className="font-medium text-sm text-gray-900 line-clamp-2">
                            {
                              line
                                .merchandise
                                .product
                                .title
                            }
                          </p>

                          {line.merchandise
                            .title &&
                            line.merchandise
                              .title !==
                            "Default Title" && (

                              <p className="text-xs text-gray-500 mt-1">
                                {
                                  line
                                    .merchandise
                                    .title
                                }
                              </p>

                            )}

                          <p className="text-sm font-semibold mt-2">

                            {
                              line
                                .merchandise
                                .price
                                .currencyCode
                            }{" "}

                            {
                              line
                                .merchandise
                                .price
                                .amount
                            }

                          </p>

                        </div>

                      </div>

                      <div className="flex items-center justify-between mt-3">

                        <div className="flex items-center border border-gray-200 rounded-lg">

                          <button
                            type="button"
                            onClick={() =>
                              updateCartQuantity(
                                line.id,
                                line.quantity -
                                1
                              )
                            }
                            disabled={
                              cartLoading
                            }
                            className="px-3 py-1.5 text-gray-700 hover:bg-gray-50"
                          >
                            −
                          </button>

                          <span className="px-3 text-sm">
                            {
                              line.quantity
                            }
                          </span>

                          <button
                            type="button"
                            onClick={() =>
                              updateCartQuantity(
                                line.id,
                                line.quantity +
                                1
                              )
                            }
                            disabled={
                              cartLoading
                            }
                            className="px-3 py-1.5 text-gray-700 hover:bg-gray-50"
                          >
                            +
                          </button>

                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            removeFromCart(
                              line.id
                            )
                          }
                          disabled={
                            cartLoading
                          }
                          className="text-xs text-red-600 hover:underline"
                        >
                          Remove
                        </button>

                      </div>

                    </div>

                  )
                )}

              </div>

            )}

          </div>

          {cart &&
            cart.lines.nodes.length >
            0 && (

              <div className="border-t border-gray-200 bg-white p-5">

                <div className="flex justify-between text-sm">

                  <span className="text-gray-600">
                    Subtotal
                  </span>

                  <span className="font-semibold">

                    {
                      cart.cost
                        .subtotalAmount
                        .currencyCode
                    }{" "}

                    {
                      cart.cost
                        .subtotalAmount
                        .amount
                    }

                  </span>

                </div>

                <button
                  type="button"
                  onClick={
                    handleCheckout
                  }
                  className="block w-full mt-4 bg-black text-white text-center rounded-xl px-4 py-3 font-medium text-sm hover:bg-gray-800"
                >
                  Proceed to Checkout
                </button>

              </div>

            )}

        </aside>

      </div>

      {/* ---------------------------------------- */}
      {/* CUSTOMER DETAILS MODAL */}
      {/* ---------------------------------------- */}

      {showCustomerForm && (

        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">

          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6">

            <div className="flex items-start justify-between">

              <div>

                <h2 className="text-xl font-semibold text-gray-900">
                  Before we continue
                </h2>

                <p className="text-sm text-gray-500 mt-1">
                  Enter your contact details so we
                  can help with your order.
                </p>

              </div>

              <button
                type="button"
                onClick={() => {
                  setShowCustomerForm(
                    false
                  );
                  setPendingProduct(
                    null
                  );
                }}
                className="text-gray-400 hover:text-gray-700 text-xl"
              >
                ×
              </button>

            </div>

            <form
              onSubmit={saveCustomer}
              className="mt-6 space-y-4"
            >

              {/* NAME */}

              <div>

                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>

                <input
                  type="text"
                  value={customerName}
                  onChange={(event) =>
                    setCustomerName(
                      event.target.value
                    )
                  }
                  placeholder="Your name"
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black"
                />

              </div>

              {/* EMAIL */}

              <div>

                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>

                <input
                  type="email"
                  value={customerEmail}
                  onChange={(event) =>
                    setCustomerEmail(
                      event.target.value
                    )
                  }
                  placeholder="you@example.com"
                  required
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black"
                />

              </div>

              {/* PHONE */}

              <div>

                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone *
                </label>

                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(event) =>
                    setCustomerPhone(
                      event.target.value
                    )
                  }
                  placeholder="+91 9876543210"
                  required
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black"
                />

              </div>

              {/* CONSENT */}

              <div className="border-t border-gray-200 pt-4 space-y-3">

                <p className="text-xs text-gray-500">
                  Optional: allow ASA to contact you
                  about products and offers.
                </p>

                <label className="flex gap-3 text-sm text-gray-700">

                  <input
                    type="checkbox"
                    checked={
                      emailConsent
                    }
                    onChange={(
                      event
                    ) =>
                      setEmailConsent(
                        event.target
                          .checked
                      )
                    }
                    className="mt-1"
                  />

                  <span>
                    Email me about products, offers
                    and recommendations.
                  </span>

                </label>

                <label className="flex gap-3 text-sm text-gray-700">

                  <input
                    type="checkbox"
                    checked={
                      whatsappConsent
                    }
                    onChange={(
                      event
                    ) =>
                      setWhatsappConsent(
                        event.target
                          .checked
                      )
                    }
                    className="mt-1"
                  />

                  <span>
                    Contact me on WhatsApp about my
                    shopping experience and offers.
                  </span>

                </label>

                <label className="flex gap-3 text-sm text-gray-700">

                  <input
                    type="checkbox"
                    checked={smsConsent}
                    onChange={(
                      event
                    ) =>
                      setSmsConsent(
                        event.target
                          .checked
                      )
                    }
                    className="mt-1"
                  />

                  <span>
                    Send me SMS updates and offers.
                  </span>

                </label>

              </div>

              <button
                type="submit"
                disabled={
                  customerFormLoading
                }
                className="w-full bg-black text-white rounded-xl px-4 py-3 text-sm font-medium disabled:opacity-40"
              >
                {customerFormLoading
                  ? "Saving..."
                  : pendingProduct
                    ? "Continue & Add to Cart"
                    : "Continue to Checkout"}
              </button>

            </form>

          </div>

        </div>

      )}

    </main>
  );
}