export type VisiblePageState = {
  blocked: boolean;
  loginRequired: boolean;
  closedOrPreorder: boolean;
  requiredModifiers: boolean;
  cartVisible: boolean;
  checkoutVisible: boolean;
  menuVisible: boolean;
};

export function detectPageState(text: string, url = ""): VisiblePageState {
  const combined = `${url}\n${text}`.toLowerCase();

  return {
    blocked:
      /\b(captcha|verify you are human|verifying you are human|performing security verification|security verification|security service|cloudflare|ray id|please confirm your reservation|just a moment|access denied|unusual traffic)\b/i.test(
        combined
      ),
    loginRequired:
      /\b(sign in to continue|log in to continue|please sign in|login-redirect|auth\.uber\.com)\b/i.test(
        combined
      ),
    closedOrPreorder:
      /\b(currently closed|closed now|closed until|closed for delivery|closed\s+next|preorder for|preorder items|preorder-only|schedule my order|menu isn't available right now|not accepting orders|currently unavailable|try another restaurant|next delivery at)\b/i.test(
        combined
      ),
    requiredModifiers:
      /\b(required|choose|select|modifier|option)\b/i.test(combined) &&
      /\b(add|cart|bag|order)\b/i.test(combined),
    cartVisible: /\b(cart|bag|basket|your order|order summary|items? in your cart|items? in your bag)\b/i.test(
      combined
    ),
    checkoutVisible:
      /\/checkout\b/i.test(url) ||
      /\b(go to checkout|proceed to checkout|review order|due today|order total|estimated total|place order|payment method|payment option|add payment|pay with)\b/i.test(
        combined
      ),
    menuVisible: /\b(menu|categories|popular items|featured items)\b/i.test(combined)
  };
}

export function pageStateWarnings(label: string, state: VisiblePageState): string[] {
  const warnings: string[] = [];
  if (state.blocked) {
    warnings.push(`${label} showed a blocking or human verification page.`);
  }
  if (state.loginRequired) {
    warnings.push(`${label} requires login before more quote details are visible.`);
  }
  if (state.closedOrPreorder) {
    warnings.push(`${label} restaurant or menu is closed, unavailable, or preorder-only.`);
  }
  if (state.requiredModifiers) {
    warnings.push(`${label} may require item modifiers before the quote is complete.`);
  }
  return warnings;
}
