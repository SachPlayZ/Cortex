const baseUrl = process.env.CORTEX_SYNC_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL;
const token = process.env.ADMIN_API_TOKEN;

if (!baseUrl) {
  throw new Error("CORTEX_SYNC_BASE_URL or NEXT_PUBLIC_APP_URL is required");
}

if (!token) {
  throw new Error("ADMIN_API_TOKEN is required");
}

const endpoint = new URL("/api/admin/casper/sync", baseUrl);

const response = await fetch(endpoint, {
  method: "POST",
  headers: {
    authorization: `Bearer ${token}`
  }
});

const body = await response.text();

if (!response.ok) {
  throw new Error(`Casper sync failed (${response.status}): ${body}`);
}

console.log(body);
