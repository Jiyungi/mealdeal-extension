import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser } from "playwright";
import { addItemToCart } from "../src/steps/addItemToCart.js";
import type { PlatformConfig } from "../src/platforms/basePlatform.js";

const config: PlatformConfig = {
  platform: "grubhub",
  label: "Grubhub",
  homepageUrl: "https://example.com",
  searchUrl: (term) => `https://example.com/search?q=${encodeURIComponent(term)}`,
  addressInputSelectors: [],
  addressSuggestionSelectors: [],
  addressSubmitSelectors: [],
  searchInputSelectors: [],
  restaurantUrlPatterns: [],
  menuItemSelectorHints: [],
  cartButtonTexts: [],
  addToCartButtonTexts: [/add\s+to\s+bag/i],
  blockedTexts: []
};

describe("add item to cart step", () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
  });

  afterAll(async () => {
    await browser.close();
  });

  it("selects a required modifier before clicking the add button", async () => {
    const page = await browser.newPage();
    await page.setContent(`
      <style>
        #modal * { box-sizing: border-box; }
      </style>
      <button id="menu-item">Rice Platter $13.99</button>
      <section id="modal" style="display:none; position:absolute; left:100px; top:20px; width:640px; height:520px; padding:20px;">
        <h1>Rice Platter</h1>
        <div style="position:relative; width:560px; height:280px;">
          <strong>Choice of Protein</strong>
          <span style="float:right;">Required</span>
          <label style="display:flex; justify-content:space-between; align-items:center; width:520px; height:44px;">
            <span>Chicken</span>
            <input id="chicken" type="radio" name="protein">
          </label>
        </div>
        <button id="add" disabled>Add to bag</button>
      </section>
      <div id="cart"></div>
      <script>
        document.querySelector("#menu-item").addEventListener("click", () => {
          document.querySelector("#modal").style.display = "block";
        });
        document.querySelector("#chicken").addEventListener("change", () => {
          document.querySelector("#add").disabled = false;
        });
        document.querySelector("#add").addEventListener("click", () => {
          document.querySelector("#cart").textContent = "Rice Platter added";
        });
      </script>
    `);

    const warnings = await addItemToCart(
      page,
      config,
      { name: "Rice Platter", price: 13.99, rawText: "Rice Platter $13.99", matchScore: 1 },
      1
    );

    await expect.poll(() => page.locator("#cart").innerText()).toBe("Rice Platter added");
    expect(warnings).toContain(
      'Grubhub showed required item modifiers, so the Actor selected "Chicken" before quoting.'
    );
    await page.close();
  }, 20000);

  it("expands collapsed required modifier sections before selecting an option", async () => {
    const page = await browser.newPage();
    await page.setContent(`
      <button id="menu-item">Rice Platter $13.99</button>
      <section id="modal" style="display:none; position:absolute; left:80px; top:20px; width:700px; min-height:560px; padding:20px;">
        <h1>Rice Platter</h1>
        <div>Select one (Required)</div>
        <button id="required-section" style="display:block; width:620px; height:56px; text-align:left;">
          Add a side of...
          <span>Select up to 3 (Optional)</span>
        </button>
        <div id="options" style="display:none; width:620px;">
          <label style="display:flex; justify-content:space-between; align-items:center; width:620px; height:48px;">
            <span>Side Salad $0.00</span>
            <input id="side-salad" type="radio" name="side">
          </label>
        </div>
        <button id="add" disabled>Make required choice (1): $13.99</button>
      </section>
      <div id="cart"></div>
      <script>
        document.querySelector("#menu-item").addEventListener("click", () => {
          document.querySelector("#modal").style.display = "block";
        });
        document.querySelector("#required-section").addEventListener("click", () => {
          document.querySelector("#options").style.display = "block";
        });
        document.querySelector("#side-salad").addEventListener("change", () => {
          document.querySelector("#add").disabled = false;
          document.querySelector("#add").textContent = "Add to bag";
        });
        document.querySelector("#add").addEventListener("click", () => {
          document.querySelector("#cart").textContent = "Rice Platter added";
        });
      </script>
    `);

    const warnings = await addItemToCart(
      page,
      config,
      { name: "Rice Platter", price: 13.99, rawText: "Rice Platter $13.99", matchScore: 1 },
      1
    );

    await expect.poll(() => page.locator("#cart").innerText()).toBe("Rice Platter added");
    expect(warnings).toContain(
      'Grubhub showed required item modifiers, so the Actor selected "Side Salad" before quoting.'
    );
    await page.close();
  }, 20000);

  it("adds the same item once per requested quantity when no pre-add quantity control is visible", async () => {
    const page = await browser.newPage();
    await page.setContent(`
      <button id="menu-item">Rice Platter $13.99</button>
      <section id="modal" style="display:none; position:absolute; left:100px; top:20px; width:640px; height:360px; padding:20px;">
        <h1>Rice Platter</h1>
        <button id="add">Add to bag</button>
      </section>
      <div id="cart">0</div>
      <script>
        let count = 0;
        document.querySelector("#menu-item").addEventListener("click", () => {
          document.querySelector("#modal").style.display = "block";
        });
        document.querySelector("#add").addEventListener("click", () => {
          count += 1;
          document.querySelector("#cart").textContent = String(count);
          document.querySelector("#modal").style.display = "none";
        });
      </script>
    `);

    const warnings = await addItemToCart(
      page,
      config,
      { name: "Rice Platter", price: 13.99, rawText: "Rice Platter $13.99", matchScore: 1 },
      2
    );

    await expect.poll(() => page.locator("#cart").innerText()).toBe("2");
    expect(warnings).toEqual([]);
    await page.close();
  }, 20000);

  it("does not add another item when the cart subtotal already reflects a buy-one-get-one quantity", async () => {
    const page = await browser.newPage();
    await page.setContent(`
      <button id="menu-item">Rice Platter $43.90</button>
      <section id="modal" style="display:none; position:absolute; left:100px; top:20px; width:640px; height:360px; padding:20px;">
        <h1>Rice Platter</h1>
        <button id="add">Add to bag</button>
      </section>
      <div id="cart"></div>
      <script>
        let count = 0;
        document.querySelector("#menu-item").addEventListener("click", () => {
          document.querySelector("#modal").style.display = "block";
        });
        document.querySelector("#add").addEventListener("click", () => {
          count += 1;
          document.querySelector("#cart").textContent = "Your order\\nSubtotal $43.90 $21.95\\nBuy 1, get 1 free\\nAdds " + count;
          document.querySelector("#modal").style.display = "none";
        });
      </script>
    `);

    const warnings = await addItemToCart(
      page,
      config,
      { name: "Rice Platter", price: 43.9, rawText: "Rice Platter $43.90", matchScore: 1 },
      2
    );

    await expect.poll(() => page.locator("#cart").innerText()).toContain("Adds 1");
    expect(warnings).toEqual([]);
    await page.close();
  }, 20000);
});
