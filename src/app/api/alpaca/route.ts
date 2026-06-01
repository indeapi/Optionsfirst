import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { path, method, key, secret, environment, body } = await req.json();

    if (!key || !secret) {
      return NextResponse.json({ error: "Missing API credentials" }, { status: 400 });
    }

    // Determine the correct base URL
    let baseUrl = "https://paper-api.alpaca.markets";
    
    const isDataApi = 
      path.startsWith("/v2/stocks") || 
      path.startsWith("/v1beta1") || 
      path.startsWith("/v2/options/snapshots") ||
      path.includes("/snapshots") ||
      path.includes("/bars");

    if (isDataApi) {
      baseUrl = "https://data.alpaca.markets";
    } else {
      baseUrl = environment === "live"
        ? "https://api.alpaca.markets"
        : "https://paper-api.alpaca.markets";
    }

    const url = `${baseUrl}${path}`;

    const headers: Record<string, string> = {
      "APCA-API-KEY-ID": key,
      "APCA-API-SECRET-KEY": secret,
      "Content-Type": "application/json",
    };

    const options: RequestInit = {
      method: method || "GET",
      headers,
    };

    if (body && (method === "POST" || method === "PUT")) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    
    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Alpaca API error: ${response.statusText}`, details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json(
      { error: "Internal Server Error", details: err.message },
      { status: 500 }
    );
  }
}
