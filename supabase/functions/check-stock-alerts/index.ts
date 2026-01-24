import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get admin alert email from settings
    const { data: emailSetting } = await supabase
      .from("admin_settings")
      .select("value")
      .eq("key", "admin_alert_email")
      .single();

    const adminEmail = emailSetting?.value || Deno.env.get("ADMIN_ALERT_EMAIL");

    if (!adminEmail) {
      console.log("No admin email configured for alerts");
      return new Response(
        JSON.stringify({ success: false, message: "No admin email configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get low stock items
    const { data: stockItems, error: stockError } = await supabase
      .from("stock_items")
      .select("*");

    if (stockError) throw stockError;

    const lowStockItems = stockItems?.filter(
      (item) => item.quantity <= item.low_stock_threshold
    ) || [];

    if (lowStockItems.length === 0) {
      console.log("No low stock items found");
      return new Response(
        JSON.stringify({ success: true, message: "No low stock alerts needed" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build email content
    const itemsList = lowStockItems
      .map(
        (item) =>
          `<tr>
            <td style="padding: 8px; border: 1px solid #ddd;">${item.item_name}</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${item.quantity} ${item.unit || "units"}</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${item.low_stock_threshold} ${item.unit || "units"}</td>
          </tr>`
      )
      .join("");

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">⚠️ Low Stock Alert</h2>
        <p>The following items are below their stock threshold:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <thead>
            <tr style="background-color: #f3f4f6;">
              <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Item Name</th>
              <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Current Stock</th>
              <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Threshold</th>
            </tr>
          </thead>
          <tbody>
            ${itemsList}
          </tbody>
        </table>
        <p>Please restock these items as soon as possible.</p>
        <p style="color: #666; font-size: 12px;">This is an automated alert from your Fleet Management System.</p>
      </div>
    `;

    // Send email using the send-alert-email function
    const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-alert-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        to: adminEmail,
        subject: `🚨 Low Stock Alert: ${lowStockItems.length} item(s) need attention`,
        html: emailHtml,
      }),
    });

    const emailResult = await emailResponse.json();

    console.log(`Stock alert check completed. ${lowStockItems.length} low stock items found.`);

    return new Response(
      JSON.stringify({
        success: true,
        lowStockCount: lowStockItems.length,
        emailSent: emailResult.success,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error checking stock alerts:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
