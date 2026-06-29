import { handleCheckoutReturn } from "../../../server/integrations/dodo";

export async function GET(): Promise<Response> {
  return Response.json(handleCheckoutReturn());
}
