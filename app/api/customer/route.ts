import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

type CustomerRequest = {
    action?: "create" | "get" | "update";
    customerId?: string;
    email?: string;
    phone?: string;
    name?: string;
    emailConsent?: boolean;
    whatsappConsent?: boolean;
    smsConsent?: boolean;
};

// --------------------------------------------------
// GET — CONNECTION TEST
// --------------------------------------------------
export async function GET() {
    try {
        const { error } = await supabase
            .from("customers")
            .select("id")
            .limit(1);

        if (error) {
            console.error("Supabase connection error:", error);

            return NextResponse.json(
                {
                    success: false,
                    supabase: false,
                    error: error.message,
                },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            supabase: true,
            message: "ASA Customer API and Supabase are connected.",
        });
    } catch (error) {
        console.error("Connection test error:", error);

        return NextResponse.json(
            {
                success: false,
                supabase: false,
                error: "Supabase connection failed",
            },
            { status: 500 }
        );
    }
}

// --------------------------------------------------
// POST — CUSTOMER OPERATIONS
// --------------------------------------------------
export async function POST(request: NextRequest) {
    try {
        const body = (await request.json()) as CustomerRequest;

        const {
            action = "create",
            customerId,
            email,
            phone,
            name,
            emailConsent,
            whatsappConsent,
            smsConsent,
        } = body;

        // --------------------------------------------------
        // CREATE CUSTOMER
        // --------------------------------------------------
        if (action === "create") {
            if (!email && !phone) {
                return NextResponse.json(
                    {
                        success: false,
                        error: "Email or phone is required",
                    },
                    { status: 400 }
                );
            }

            let existingCustomer = null;

            if (email) {
                const { data, error } = await supabase
                    .from("customers")
                    .select("*")
                    .eq("email", email)
                    .maybeSingle();

                if (error) {
                    console.error("Customer lookup error:", error);

                    return NextResponse.json(
                        {
                            success: false,
                            error: "Failed to find customer",
                        },
                        { status: 500 }
                    );
                }

                existingCustomer = data;
            }

            if (existingCustomer) {
                return NextResponse.json({
                    success: true,
                    customer: existingCustomer,
                    existing: true,
                });
            }

            const { data: customer, error } = await supabase
                .from("customers")
                .insert({
                    email: email || null,
                    phone: phone || null,
                    name: name || null,
                    email_consent: emailConsent ?? false,
                    whatsapp_consent: whatsappConsent ?? false,
                    sms_consent: smsConsent ?? false,
                })
                .select()
                .single();

            if (error) {
                console.error("Customer creation error:", error);

                return NextResponse.json(
                    {
                        success: false,
                        error: "Failed to create customer",
                    },
                    { status: 500 }
                );
            }

            return NextResponse.json({
                success: true,
                customer,
                existing: false,
            });
        }

        // --------------------------------------------------
        // GET CUSTOMER BY ID
        // --------------------------------------------------
        if (action === "get") {
            if (!customerId) {
                return NextResponse.json(
                    {
                        success: false,
                        error: "customerId is required",
                    },
                    { status: 400 }
                );
            }

            const { data: customer, error } = await supabase
                .from("customers")
                .select("*")
                .eq("id", customerId)
                .single();

            if (error) {
                console.error("Customer fetch error:", error);

                return NextResponse.json(
                    {
                        success: false,
                        error: "Customer not found",
                    },
                    { status: 404 }
                );
            }

            return NextResponse.json({
                success: true,
                customer,
            });
        }

        // --------------------------------------------------
        // UPDATE CUSTOMER
        // --------------------------------------------------
        if (action === "update") {
            if (!customerId) {
                return NextResponse.json(
                    {
                        success: false,
                        error: "customerId is required",
                    },
                    { status: 400 }
                );
            }

            const updates: Record<string, unknown> = {};

            if (email !== undefined) updates.email = email;
            if (phone !== undefined) updates.phone = phone;
            if (name !== undefined) updates.name = name;

            if (emailConsent !== undefined) {
                updates.email_consent = emailConsent;
            }

            if (whatsappConsent !== undefined) {
                updates.whatsapp_consent = whatsappConsent;
            }

            if (smsConsent !== undefined) {
                updates.sms_consent = smsConsent;
            }

            if (Object.keys(updates).length === 0) {
                return NextResponse.json(
                    {
                        success: false,
                        error: "No fields to update",
                    },
                    { status: 400 }
                );
            }

            const { data: customer, error } = await supabase
                .from("customers")
                .update(updates)
                .eq("id", customerId)
                .select()
                .single();

            if (error) {
                console.error("Customer update error:", error);

                return NextResponse.json(
                    {
                        success: false,
                        error: "Failed to update customer",
                    },
                    { status: 500 }
                );
            }

            return NextResponse.json({
                success: true,
                customer,
            });
        }

        return NextResponse.json(
            {
                success: false,
                error: "Invalid action",
            },
            { status: 400 }
        );
    } catch (error) {
        console.error("Customer API error:", error);

        return NextResponse.json(
            {
                success: false,
                error: "Invalid request",
            },
            { status: 400 }
        );
    }
}