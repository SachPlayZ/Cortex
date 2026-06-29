export async function GET(): Promise<Response> {
  return Response.json({ repaymentStatus: "cancelled_by_buyer" });
}
