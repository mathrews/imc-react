import { test, expect } from '@playwright/test';

for (const [peso, imc, texto, situacao] of [
  ['80', 20, '20,00', 'Peso adequado'],
  ['100', 25, '25,00', 'Sobrepeso'],
  ['120', 30, '30,00', 'Obesidade grau I'],
  ['99,99', 25, '25,00', 'Sobrepeso']
]) {
  test(`E2E: ${peso} kg e 2 m`, async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Peso (kg)').fill(peso);
    await page.getByLabel('Altura (m)').fill('2');
    const pendente = page.waitForResponse(r =>
      r.url().endsWith('/api/imc') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Calcular IMC' }).click();
    const resposta = await pendente;
    expect(resposta.status()).toBe(200);
    expect(await resposta.json()).toEqual({ imc, situacao });
    await expect(page.locator('.result strong')).toHaveText(texto);
    await expect(page.locator('.result span')).toHaveText(situacao);
    await expect(page.getByRole('heading', { name: 'Meu histórico' })).toHaveCount(0);
  });
}

test('visitante anônimo vê anúncios laterais no desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.locator('.ad.left')).toBeVisible();
  await expect(page.locator('.ad.right')).toBeVisible();
  await expect(page.locator('.mobile-ad')).toBeHidden();
});

test('visitante anônimo vê anúncios inferiores no celular', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('.ad.left')).toBeHidden();
  await expect(page.locator('.ad.right')).toBeHidden();
  await expect(page.locator('.mobile-ad')).toBeVisible();
});
