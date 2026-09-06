type ParsedShippingAddress = { zip?: string; city?: string };

function parse(shippingAddressJson: string | null): ParsedShippingAddress | null {
  if (!shippingAddressJson) return null;
  try {
    return JSON.parse(shippingAddressJson) as ParsedShippingAddress;
  } catch {
    return null;
  }
}

export function extractPostalCode(shippingAddressJson: string | null): string | null {
  return parse(shippingAddressJson)?.zip ?? null;
}

export function extractCity(shippingAddressJson: string | null): string | null {
  return parse(shippingAddressJson)?.city ?? null;
}
