import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

type TrackingRequest = {
    action:
    | "conversation"
    | "message"
    | "event"
    | "history";

    customerId: string;
    conversationId?: string;

    sessionId?: string;
    role?: "user" | "assistant" | "system";
    content?: string;

    eventType?: string;
    productId?: string;
    productTitle?: string;
    metadata?: Record<string, unknown>;
};

export async function POST(request: NextRequest) {
    try {
        const body =
            (await request.json()) as TrackingRequest;

        const {
            action,
            customerId,
            conversationId,
            sessionId,
            role,
            content,
            eventType,
            productId,
            productTitle,
            metadata,
        } = body;

        if (!customerId) {
            return NextResponse.json(
                {
                    success: false,
                    error: "customerId is required",
                },
                { status: 400 }
            );
        }

        // --------------------------------------------
        // CREATE CONVERSATION
        // --------------------------------------------

        if (action === "conversation") {
            if (!sessionId) {
                return NextResponse.json(
                    {
                        success: false,
                        error: "sessionId is required",
                    },
                    { status: 400 }
                );
            }

            const { data, error } = await supabase
                .from("conversations")
                .insert({
                    customer_id: customerId,
                    session_id: sessionId,
                    status: "active",
                })
                .select()
                .single();

            if (error) {
                console.error(
                    "Conversation creation error:",
                    error
                );

                return NextResponse.json(
                    {
                        success: false,
                        error: error.message,
                    },
                    { status: 500 }
                );
            }

            return NextResponse.json({
                success: true,
                conversation: data,
            });
        }

        // --------------------------------------------
        // LOAD CONVERSATION HISTORY
        // --------------------------------------------

        if (action === "history") {
            if (!conversationId) {
                return NextResponse.json(
                    {
                        success: false,
                        error: "conversationId is required",
                    },
                    { status: 400 }
                );
            }

            /*
             * First verify that this conversation belongs
             * to the supplied customer.
             */
            const { data: conversation, error: conversationError } =
                await supabase
                    .from("conversations")
                    .select("*")
                    .eq("id", conversationId)
                    .eq("customer_id", customerId)
                    .maybeSingle();

            if (conversationError) {
                console.error(
                    "Conversation lookup error:",
                    conversationError
                );

                return NextResponse.json(
                    {
                        success: false,
                        error: conversationError.message,
                    },
                    { status: 500 }
                );
            }

            if (!conversation) {
                return NextResponse.json(
                    {
                        success: false,
                        error: "Conversation not found",
                    },
                    { status: 404 }
                );
            }

            const { data: messages, error: messagesError } =
                await supabase
                    .from("conversation_messages")
                    .select(
                        "id, role, content, created_at"
                    )
                    .eq(
                        "conversation_id",
                        conversationId
                    )
                    .order("created_at", {
                        ascending: true,
                    });

            if (messagesError) {
                console.error(
                    "Conversation messages lookup error:",
                    messagesError
                );

                return NextResponse.json(
                    {
                        success: false,
                        error: messagesError.message,
                    },
                    { status: 500 }
                );
            }

            return NextResponse.json({
                success: true,
                conversation,
                messages: messages || [],
            });
        }

        // --------------------------------------------
        // SAVE MESSAGE
        // --------------------------------------------

        if (action === "message") {
            if (!conversationId) {
                return NextResponse.json(
                    {
                        success: false,
                        error: "conversationId is required",
                    },
                    { status: 400 }
                );
            }

            if (!role || !content) {
                return NextResponse.json(
                    {
                        success: false,
                        error: "role and content are required",
                    },
                    { status: 400 }
                );
            }

            const { data: conversation } =
                await supabase
                    .from("conversations")
                    .select("id")
                    .eq("id", conversationId)
                    .eq("customer_id", customerId)
                    .maybeSingle();

            if (!conversation) {
                return NextResponse.json(
                    {
                        success: false,
                        error: "Conversation does not belong to customer",
                    },
                    { status: 403 }
                );
            }

            const { data, error } = await supabase
                .from("conversation_messages")
                .insert({
                    conversation_id: conversationId,
                    role,
                    content,
                })
                .select()
                .single();

            if (error) {
                console.error(
                    "Message tracking error:",
                    error
                );

                return NextResponse.json(
                    {
                        success: false,
                        error: error.message,
                    },
                    { status: 500 }
                );
            }

            await supabase
                .from("conversations")
                .update({
                    last_activity_at:
                        new Date().toISOString(),
                })
                .eq("id", conversationId)
                .eq("customer_id", customerId);

            return NextResponse.json({
                success: true,
                message: data,
            });
        }

        // --------------------------------------------
        // SAVE EVENT
        // --------------------------------------------

        if (action === "event") {
            if (!eventType) {
                return NextResponse.json(
                    {
                        success: false,
                        error: "eventType is required",
                    },
                    { status: 400 }
                );
            }

            if (conversationId) {
                const { data: conversation } =
                    await supabase
                        .from("conversations")
                        .select("id")
                        .eq("id", conversationId)
                        .eq("customer_id", customerId)
                        .maybeSingle();

                if (!conversation) {
                    return NextResponse.json(
                        {
                            success: false,
                            error:
                                "Conversation does not belong to customer",
                        },
                        { status: 403 }
                    );
                }
            }

            const { data, error } = await supabase
                .from("customer_events")
                .insert({
                    customer_id: customerId,
                    conversation_id:
                        conversationId || null,
                    event_type: eventType,
                    product_id: productId || null,
                    product_title:
                        productTitle || null,
                    metadata: metadata || {},
                })
                .select()
                .single();

            if (error) {
                console.error(
                    "Event tracking error:",
                    error
                );

                return NextResponse.json(
                    {
                        success: false,
                        error: error.message,
                    },
                    { status: 500 }
                );
            }

            return NextResponse.json({
                success: true,
                event: data,
            });
        }

        return NextResponse.json(
            {
                success: false,
                error: "Invalid tracking action",
            },
            { status: 400 }
        );
    } catch (error) {
        console.error(
            "Tracking API error:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                error: "Invalid request",
            },
            { status: 400 }
        );
    }
}