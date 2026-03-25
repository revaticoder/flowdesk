import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  const { employeeName, leaveType, startDate, endDate, reason } =
    await req.json();

  const founderEmail = process.env.FOUNDER_EMAIL;
  if (!founderEmail) {
    return NextResponse.json(
      { error: "FOUNDER_EMAIL not configured" },
      { status: 500 }
    );
  }

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

  const { error } = await resend.emails.send({
    from: "RevFlow <onboarding@resend.dev>",
    to: founderEmail,
    subject: `New Leave Request - ${employeeName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 560px; color: #1a1a1a;">
        <h2 style="margin-bottom: 4px;">New Leave Request</h2>
        <p style="color: #666; margin-top: 0;">Submitted via RevFlow</p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
          <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #555; width: 140px;">Employee</td>
            <td style="padding: 10px 0; border-bottom: 1px solid #eee; font-weight: 600;">${employeeName}</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #555;">Leave Type</td>
            <td style="padding: 10px 0; border-bottom: 1px solid #eee; font-weight: 600;">${leaveType}</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #555;">From</td>
            <td style="padding: 10px 0; border-bottom: 1px solid #eee;">${formatDate(startDate)}</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #555;">To</td>
            <td style="padding: 10px 0; border-bottom: 1px solid #eee;">${formatDate(endDate)}</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; color: #555; vertical-align: top;">Reason</td>
            <td style="padding: 10px 0;">${reason}</td>
          </tr>
        </table>
        <p style="margin-top: 28px; padding: 14px 18px; background: #f5f5f5; border-radius: 6px; font-size: 14px; color: #444;">
          Please log in to <strong>RevFlow</strong> to approve or reject this request under
          <strong>Attendance → Admin</strong>.
        </p>
      </div>
    `,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
