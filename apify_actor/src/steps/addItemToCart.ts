import type { Page } from "playwright";
import { parseQuoteFieldsFromText } from "../extractors/extractFees.js";
import type { MenuItemCandidate, PlatformConfig } from "../platforms/basePlatform.js";
import { parseMoneyValues } from "../utils/parseMoney.js";
import { safeClickByText } from "../utils/safeClick.js";

export async function addItemToCart(
  page: Page,
  config: PlatformConfig,
  item: MenuItemCandidate,
  quantity: number
): Promise<string[]> {
  const warnings: string[] = [];

  for (let count = 0; count < quantity; count += 1) {
    const result = await addOneItemToCart(page, config, item, count);
    warnings.push(...result.warnings);

    if (!result.added) {
      break;
    }
    if (await cartSubtotalReflectsQuantity(page, item.price, quantity)) {
      break;
    }
  }

  return Array.from(new Set(warnings));
}

async function cartSubtotalReflectsQuantity(
  page: Page,
  itemPrice: number | null,
  quantity: number
): Promise<boolean> {
  if (itemPrice == null || quantity <= 1) {
    return false;
  }

  const text = await page.locator("body").innerText({ timeout: 3000 }).catch(() => "");
  const fields = parseQuoteFieldsFromText(text);
  const expected = Number((itemPrice * quantity).toFixed(2));
  const subtotalValues = parseMoneyValues(fields.rawEvidence.subtotalText);
  const firstSubtotal = subtotalValues[0];
  const chargedSubtotal = subtotalValues[subtotalValues.length - 1];
  return (
    fields.itemSubtotal === expected ||
    subtotalValues.some((value) => Math.abs(value - expected) < 0.01) ||
    (firstSubtotal != null &&
      chargedSubtotal != null &&
      chargedSubtotal > 0 &&
      Math.abs(firstSubtotal / chargedSubtotal - quantity) < 0.01)
  );
}

async function addOneItemToCart(
  page: Page,
  config: PlatformConfig,
  item: MenuItemCandidate,
  index: number
): Promise<{ added: boolean; warnings: string[] }> {
  const warnings: string[] = [];
  if (index > 0) {
    await page.keyboard.press("Escape").catch(() => undefined);
    await page.waitForTimeout(500);
  }

  const openedItem = await safeClickByText(page, [item.name]);
  if (!openedItem) {
    warnings.push(`Could not click the visible menu item "${item.name}" on ${config.label}.`);
  }

  await page.waitForTimeout(1000);

  let added = false;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    warnings.push(...(await selectRequiredOptions(page, config)));
    added = await safeClickByText(page, config.addToCartButtonTexts);
    if (added) {
      break;
    }

    await scrollItemModal(page);
  }

  if (!added) {
    warnings.push(`Could not find a safe add-to-cart button for "${item.name}" on ${config.label}.`);
  }

  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => undefined);
  await page.waitForTimeout(1000);
  return { added, warnings };
}

async function selectRequiredOptions(page: Page, config: PlatformConfig): Promise<string[]> {
  const requiredVisible = await page.evaluate<boolean>(`
    (() => {
      function normalize(value) {
        return String(value || "").replace(/\\s+/g, " ").trim();
      }

      function isVisible(element) {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
      }

      return Array.from(document.querySelectorAll("body *")).some((element) => {
        if (!isVisible(element)) return false;
        const text = normalize(element.innerText || element.textContent || "");
        return /required|choose\\s+1|choose\\s+one|select\\s+1|select\\s+one/i.test(text);
      });
    })()
  `).catch(() => false);
  if (!requiredVisible) {
    return [];
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const action = await clickFirstRequiredModifierAction(page);
    if (!action) {
      break;
    }

    await page.waitForTimeout(500);
    if (action.kind === "selected") {
      return [
        `${config.label} showed required item modifiers, so the Actor selected "${action.text}" before quoting.`
      ];
    }
  }

  return [`${config.label} showed required item modifiers, but no selectable option was visible.`];
}

type RequiredModifierAction = {
  kind: "expanded" | "selected";
  text: string;
  x: number;
  y: number;
};

async function clickFirstRequiredModifierAction(page: Page): Promise<RequiredModifierAction | null> {
  const option = await page.evaluate<RequiredModifierAction | null>(`
    (() => {
      function normalize(value) {
        return String(value || "").replace(/\\s+/g, " ").trim();
      }

      function isVisible(element) {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
      }

      function visibleText(element) {
        return normalize(element.innerText || element.getAttribute("aria-label") || element.getAttribute("value") || element.textContent || "");
      }

      function isActionElement(element) {
        return element.matches("button,a,[role='button'],input[type='button'],input[type='submit']");
      }

      const elements = Array.from(document.querySelectorAll("body *"));
      const addButtons = [];
      for (const element of elements) {
        if (!isVisible(element)) continue;
        const text = visibleText(element);
        if (/\\b(?:add\\s+(?:\\d+\\s+)?to\\s+(?:order|cart|bag)|make\\s+required\\s+choice)\\b/i.test(text)) {
          const rect = element.getBoundingClientRect();
          addButtons.push({ element, rect, text });
        }
      }
      addButtons.sort((left, right) => {
        const leftAction = isActionElement(left.element) ? 0 : 1;
        const rightAction = isActionElement(right.element) ? 0 : 1;
        return leftAction - rightAction || left.rect.top - right.rect.top || left.text.length - right.text.length;
      });
      const addButton = addButtons[0]?.element || null;
      if (!addButton) return null;

      let root = addButton;
      for (let current = addButton.parentElement; current && current !== document.body; current = current.parentElement) {
        const rect = current.getBoundingClientRect();
        if (isVisible(current) && rect.width > 360 && rect.height > 260 && rect.top >= 0 && rect.bottom <= document.body.scrollHeight + 40) {
          root = current;
          break;
        }
      }

      const rootElements = Array.from(root.querySelectorAll("*"));
      const requiredMarkers = [];
      for (const element of rootElements) {
        if (!isVisible(element)) continue;
        const text = visibleText(element);
        if (/\\b(required|choose\\s+1|choose\\s+one|select\\s+1|select\\s+one)\\b/i.test(text) && !/make\\s+required\\s+choice/i.test(text)) {
          requiredMarkers.push({ element, rect: element.getBoundingClientRect(), text });
        }
      }
      requiredMarkers.sort((left, right) => {
        const leftLarge = left.rect.height > 90 || left.text.length > 140 ? 1 : 0;
        const rightLarge = right.rect.height > 90 || right.text.length > 140 ? 1 : 0;
        return leftLarge - rightLarge || left.rect.top - right.rect.top || left.rect.height - right.rect.height;
      });
      const required = requiredMarkers[0]?.element || null;
      if (!required) return null;

      const requiredRect = required.getBoundingClientRect();
      const buttonRect = addButton.getBoundingClientRect();

      const candidates = [];
      for (const element of rootElements) {
        if (!isVisible(element)) continue;
        const rect = element.getBoundingClientRect();
        const text = visibleText(element);
        if (text.length < 2 || text.length > 80) continue;
        if (rect.bottom <= requiredRect.bottom + 4 || rect.top > requiredRect.bottom + 520) continue;
        if (rect.top >= buttonRect.top - 8) continue;
        if (/^(required|choose|choice|delivery|pickup|group order|log in|sign up)$/i.test(text)) continue;
        if (/make\\s+required\\s+choice|special instructions|add any requests|quantity/i.test(text)) continue;
        if (/\\b(select|choose)\\b.*\\b(optional|required)\\b/i.test(text)) continue;
        if (/\\b(add-ons?|special instructions|top off|sauce|choice of|add a side)\\b/i.test(text)) continue;
        if (/\\b(arrow|chevron|caret|expand|collapse)\\b/i.test(text)) continue;
        candidates.push({ element, rect, text, action: isActionElement(element) ? 0 : 1 });
      }
      candidates.sort((left, right) => {
        return (
          left.action - right.action ||
          left.rect.top - right.rect.top ||
          left.rect.height - right.rect.height ||
          left.rect.width - right.rect.width ||
          left.text.length - right.text.length ||
          left.rect.left - right.rect.left
        );
      });

      const first = candidates[0];
      if (first) {
        let row = first.element;
        if (!isActionElement(first.element)) {
          for (let current = first.element.parentElement; current && current !== root; current = current.parentElement) {
            const rect = current.getBoundingClientRect();
            if (rect.width > 200 && rect.height >= 28 && rect.height <= 96) {
              row = current;
            }
          }
        }
        const rowRect = row.getBoundingClientRect();
        const clickX =
          first.action === 0
            ? rowRect.right - Math.min(18, Math.max(8, rowRect.width / 4))
            : rowRect.left + Math.min(40, Math.max(12, rowRect.width / 4));
        const clickY =
          first.action === 0
            ? rowRect.top + rowRect.height / 2
            : rowRect.top + Math.min(18, Math.max(10, rowRect.height / 3));
        return {
          kind: "selected",
          text: (() => {
            const cleaned = first.text.replace(/\\$\\s*\\d+(?:\\.\\d{2})?/g, "").replace(/\\+/g, "").trim();
            return cleaned.length > 48 ? "first visible option" : cleaned;
          })(),
          x: clickX,
          y: clickY
        };
      }

      const expanders = [];
      for (const element of rootElements) {
        if (!isVisible(element)) continue;
        const rect = element.getBoundingClientRect();
        const text = visibleText(element);
        if (text.length < 2 || text.length > 160) continue;
        if (rect.bottom <= requiredRect.top - 4 || rect.top >= buttonRect.top - 8) continue;
        if (rect.width < 240 || rect.height < 28 || rect.height > 120) continue;
        if (/make\\s+required\\s+choice|special instructions|delivery|pickup|group order/i.test(text)) continue;
        if (!/\\b(add|choose|choice|select|side|protein|sauce|modifier|option|required)\\b/i.test(text)) continue;
        expanders.push({ element, rect, text });
      }
      expanders.sort((left, right) => left.rect.top - right.rect.top || left.rect.left - right.rect.left);
      const expander = expanders[0];
      if (!expander) return null;

      return { kind: "expanded", text: expander.text, x: expander.rect.right - 24, y: expander.rect.top + expander.rect.height / 2 };
    })()
  `);

  if (!option) {
    return null;
  }

  const clicked = await page.mouse.click(option.x, option.y).then(
    () => true,
    () => false
  );
  return clicked ? option : null;
}

async function scrollItemModal(page: Page): Promise<void> {
  await page
    .evaluate(`
      (() => {
        function isVisible(element) {
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
        }

        const scrollable = Array.from(document.querySelectorAll("body *"))
          .filter((element) => isVisible(element) && element.scrollHeight > element.clientHeight + 80)
          .sort((left, right) => right.getBoundingClientRect().height - left.getBoundingClientRect().height)[0];

        if (scrollable) {
          scrollable.scrollTop += 700;
          return;
        }

        window.scrollBy(0, 700);
      })()
    `)
    .catch(() => undefined);
  await page.mouse.wheel(0, 700).catch(() => undefined);
  await page.waitForTimeout(500);
}
