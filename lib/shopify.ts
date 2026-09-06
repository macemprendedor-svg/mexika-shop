const API_VERSION = process.env.SHOPIFY_API_VERSION ?? "2026-07";

// El token del client credentials grant expira a las ~24h (expires_in ~86399s).
// Se refresca antes cuando quedan menos de este margen.
const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000;

export class ShopifyApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(message);
    this.name = "ShopifyApiError";
  }
}

function getStoreDomain(): string {
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  if (!domain) {
    throw new Error("Falta SHOPIFY_STORE_DOMAIN en las variables de entorno");
  }
  return domain;
}

function getGraphqlEndpoint(): string {
  return `https://${getStoreDomain()}/admin/api/${API_VERSION}/graphql.json`;
}

type AccessTokenResponse = {
  access_token: string;
  scope: string;
  expires_in: number;
};

type CachedToken = {
  accessToken: string;
  expiresAt: number; // epoch ms
  scope: string;
};

let cachedToken: CachedToken | null = null;
let inFlightRequest: Promise<CachedToken> | null = null;

/**
 * Intercambia SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET por un access token
 * (client credentials grant). Los tokens generados por este flujo no aparecen
 * en el admin de Shopify — solo se obtienen programáticamente y expiran ~24h.
 */
async function requestAccessToken(): Promise<CachedToken> {
  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "Faltan SHOPIFY_CLIENT_ID y/o SHOPIFY_CLIENT_SECRET en las variables de entorno",
    );
  }

  const response = await fetch(`https://${getStoreDomain()}/admin/oauth/access_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  const json = (await response.json()) as AccessTokenResponse | { error?: string };

  if (!response.ok || !("access_token" in json)) {
    throw new ShopifyApiError(
      `No se pudo obtener el access token de Shopify (status ${response.status})`,
      response.status,
      json,
    );
  }

  return {
    accessToken: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
    scope: json.scope,
  };
}

/**
 * Devuelve un access token válido, reutilizando el cacheado en memoria si
 * aún le queda vigencia por encima del margen de refresco. Las llamadas
 * concurrentes durante un refresh comparten la misma petición en curso.
 */
async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt - Date.now() > TOKEN_REFRESH_MARGIN_MS) {
    return cachedToken.accessToken;
  }

  if (!inFlightRequest) {
    inFlightRequest = requestAccessToken().finally(() => {
      inFlightRequest = null;
    });
  }

  cachedToken = await inFlightRequest;
  return cachedToken.accessToken;
}

/**
 * Fuerza la obtención de un token (usando el caché si aplica) y devuelve
 * datos de diagnóstico no sensibles: el scope otorgado y cuándo expira.
 * Útil para confirmar qué permisos tiene realmente el token en uso.
 */
export async function getAccessTokenDiagnostics(): Promise<{
  scope: string;
  expiresAt: string;
}> {
  await getAccessToken();
  if (!cachedToken) {
    throw new Error("No se pudo obtener el token para diagnóstico");
  }
  return {
    scope: cachedToken.scope,
    expiresAt: new Date(cachedToken.expiresAt).toISOString(),
  };
}

type GraphQLResponse<T> = {
  data?: T;
  errors?: Array<{ message: string; [key: string]: unknown }>;
};

/**
 * Ejecuta una query/mutation contra la Admin GraphQL API de Shopify,
 * obteniendo (o reutilizando) el access token via client credentials grant.
 * Requiere SHOPIFY_STORE_DOMAIN, SHOPIFY_CLIENT_ID y SHOPIFY_CLIENT_SECRET.
 */
export async function shopifyGraphql<T = unknown>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const accessToken = await getAccessToken();

  const response = await fetch(getGraphqlEndpoint(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = (await response.json()) as GraphQLResponse<T>;

  if (!response.ok) {
    throw new ShopifyApiError(
      `Shopify Admin API respondió ${response.status}`,
      response.status,
      json,
    );
  }

  if (json.errors?.length) {
    throw new ShopifyApiError(
      json.errors.map((e) => e.message).join("; "),
      response.status,
      json,
    );
  }

  if (!json.data) {
    throw new ShopifyApiError("Respuesta de Shopify sin campo 'data'", response.status, json);
  }

  return json.data;
}
