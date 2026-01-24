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

    // Get tax alert days threshold from settings
    const { data: alertDaysSetting } = await supabase
      .from("admin_settings")
      .select("value")
      .eq("key", "tax_alert_days")
      .single();

    const alertDays = parseInt(alertDaysSetting?.value || "7");

    // Calculate the date range for upcoming taxes
    const today = new Date();
    const alertDate = new Date(today);
    alertDate.setDate(alertDate.getDate() + alertDays);

    // Get buses with upcoming tax due dates
    const { data: buses, error: busError } = await supabase
      .from("buses")
      .select("id, registration_number, bus_name, next_tax_due_date, monthly_tax_amount")
      .eq("status", "active")
      .not("next_tax_due_date", "is", null)
      .lte("next_tax_due_date", alertDate.toISOString().split("T")[0])
      .gte("next_tax_due_date", today.toISOString().split("T")[0]);

    if (busError) throw busError;

    // Also check bus_tax_records for pending taxes
    const { data: taxRecords, error: taxError } = await supabase
      .from("bus_tax_records")
      .select(`
        id,
        due_date,
        amount,
        status,
        buses (
          registration_number,
          bus_name
        )
      `)
      .eq("status", "pending")
      .lte("due_date", alertDate.toISOString().split("T")[0])
      .gte("due_date", today.toISOString().split("T")[0]);

    if (taxError) throw taxError;

    const upcomingTaxes = [
      ...(buses || []).map((bus) => ({
        registration: bus.registration_number,
        busName: bus.bus_name,
        dueDate: bus.next_tax_due_date,
        amount: bus.monthly_tax_amount,
        source: "bus",
      })),
      ...(taxRecords || []).map((record: any) => ({
        registration: record.buses?.registration_number,
        busName: record.buses?.bus_name,
        dueDate: record.due_date,
        amount: record.amount,
        source: "record",
      })),
    ];

    if (upcomingTaxes.length === 0) {
      console.log("No upcoming tax dues found");
      return new Response(
        JSON.stringify({ success: true, message: "No tax alerts needed" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build email content
    const taxList = upcomingTaxes
      .map(
        (tax) =>
          `<tr>
            <td style="padding: 8px; border: 1px solid #ddd;">${tax.registration}</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${tax.busName || "-"}</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${new Date(tax.dueDate).toLocaleDateString("en-IN")}</td>
            <td style="padding: 8px; border: 1px solid #ddd;">₹${tax.amount?.toLocaleString("en-IN") || "N/A"}</td>
          </tr>`
      )
      .join("");

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #f59e0b;">📅 Upcoming Tax Payment Reminder</h2>
        <p>The following buses have tax payments due within the next ${alertDays} days:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <thead>
            <tr style="background-color: #f3f4f6;">
              <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Registration</th>
              <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Bus Name</th>
              <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Due Date</th>
              <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${taxList}
          </tbody>
        </table>
        <p>Please ensure these taxes are paid on time to avoid penalties.</p>
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
        subject: `📅 Tax Payment Reminder: ${upcomingTaxes.length} bus(es) due soon`,
        html: emailHtml,
      }),
    });

    const emailResult = await emailResponse.json();

    console.log(`Tax alert check completed. ${upcomingTaxes.length} upcoming taxes found.`);

    return new Response(
      JSON.stringify({
        success: true,
        upcomingTaxCount: upcomingTaxes.length,
        emailSent: emailResult.success,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error checking tax alerts:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
