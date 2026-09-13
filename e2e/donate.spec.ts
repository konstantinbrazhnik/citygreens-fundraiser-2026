import { expect, test } from '@playwright/test';

/**
 * The golden path against a local Worker in simulated-payments mode:
 * land, give, and see it on the projector board. Run `npm run dev` first (or
 * set E2E_BASE_URL); simulated mode comes from .dev.vars.
 */
test('land, give, and see it on the board', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.getByTestId('hero-title')).toBeVisible();
  // One Donate button at a time: the bottom bar stays hidden while the
  // hero's button is on screen and slides in once it is scrolled past.
  await expect(page.getByTestId('hero-donate')).toBeVisible();
  await expect(page.getByTestId('sticky-donate')).toBeHidden();
  await page.getByTestId('hero-donate').evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await page.mouse.wheel(0, 400);
  await expect(page.getByTestId('sticky-donate')).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.getByTestId('sticky-donate')).toBeHidden();

  // Nothing with text on the landing page renders below 17px.
  const smallest = await page.evaluate(() => {
    let min = 999;
    for (const el of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(el);
      if (!el.textContent?.trim() || cs.display === 'none') continue;
      if (el.children.length === 0) min = Math.min(min, parseFloat(cs.fontSize));
    }
    return min;
  });
  expect(smallest).toBeGreaterThanOrEqual(17);

  const board = await context.newPage();
  await board.goto('/#/board');
  await expect(board.getByTestId('board')).toBeVisible();

  await page.getByTestId('hero-donate').click();
  await expect(page.getByTestId('simulated-banner')).toBeVisible();
  await page.getByTestId('amount-10000').click();
  // Picking an amount moves the cursor to the name field and pins the amount in the top bar.
  await expect(page.getByTestId('donor-name')).toBeFocused();
  await expect(page.getByTestId('gift-chip-amount')).toHaveText('$100');
  await page.getByTestId('donor-name').fill('Playwright Donor');
  await page.getByTestId('donor-name').press('Enter');
  await expect(page.getByTestId('simulated-banner')).toBeVisible(); // Enter advances, it does not submit
  await expect(page.locator('#donor-message')).toBeFocused();
  await page.getByTestId('give').click();

  await expect(page.getByText(/Thank you, Playwright/)).toBeVisible();
  await expect(board.getByTestId('celebration')).toContainText('Playwright Donor just gave $100');
  // The running total/progress bar is off by default (`showTotal`, flipped
  // on from #/admin) — the per-gift celebration above is the signal that a
  // gift landed, independent of whether the aggregate total is shown.
  await expect(board.getByTestId('raised')).toHaveCount(0);
});
