import { expect, test } from '@playwright/test';

const composer = (page: import('@playwright/test').Page) => page.getByPlaceholder('Add a message…');
const previewRows = (page: import('@playwright/test').Page) => page.locator('#workskin:visible [data-message-id]');

test('iMessage automatically advances times and delivery notifications', async ({ page }) => {
  await page.goto('/?template=ios-two-person-chat');
  await page.getByRole('button', { name: 'Message options' }).click();

  await expect(page.getByLabel('Timestamp')).toHaveAttribute('placeholder', 'Automatic: 10:27');
  await expect(page.getByLabel('Delivery status')).toHaveValue('auto');

  await composer(page).fill('Automatic outgoing');
  await page.getByRole('button', { name: 'Send message' }).click();

  const outgoing = previewRows(page).last();
  await expect(outgoing.getByText('10:27', { exact: true })).toBeVisible();
  await expect(outgoing.getByText('Delivered', { exact: true })).toBeVisible();

  await composer(page).fill('Incoming reply');
  await composer(page).press('Enter');

  await expect(previewRows(page).nth(-2).getByText('Read', { exact: true })).toBeVisible();
  await expect(previewRows(page).last().getByText('10:28', { exact: true })).toBeVisible();
  await expect(previewRows(page).last().locator('.status-indicator')).toHaveCount(0);
});

test('WhatsApp automatically advances delivered ticks to read ticks after a reply', async ({ page }) => {
  await page.goto('/?template=whatsapp-group-chat');

  await composer(page).fill('Automatic outgoing');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(previewRows(page).last().getByText('11:38 AM', { exact: true })).toBeVisible();
  await expect(previewRows(page).last().locator('.wa-ticks-delivered')).toHaveCount(1);

  await composer(page).fill('Incoming reply');
  await page.getByRole('combobox', { name: 'Speaking as' }).selectOption({ index: 1 });
  await composer(page).press('Enter');
  await expect(previewRows(page).nth(-2).locator('.wa-ticks-read')).toHaveCount(1);
  await expect(previewRows(page).last().locator('.wa-ticks')).toHaveCount(0);
});

test('manual timestamp and delivery choices remain editable and are not auto-promoted', async ({ page }) => {
  await page.goto('/?template=ios-two-person-chat');
  await page.getByRole('button', { name: 'Message options' }).click();
  await page.getByLabel('Timestamp').fill('4:20 PM');
  await page.getByLabel('Delivery status').selectOption('sent');

  await composer(page).fill('Manual metadata');
  await page.getByRole('button', { name: 'Send message' }).click();
  await composer(page).fill('Reply after manual status');
  await page.getByRole('button', { name: 'Send message' }).click();

  const manual = previewRows(page).nth(-2);
  await expect(manual.getByText('4:20 PM', { exact: true })).toBeVisible();
  await expect(manual.getByText('Sent', { exact: true })).toBeVisible();

  const timelineMessage = page.locator('[id^="timeline-msg-"]').nth(-2);
  await timelineMessage.click();
  await expect(timelineMessage.getByLabel('Delivery status')).toHaveValue('sent');
  await timelineMessage.getByLabel('Delivery status').selectOption('auto');
  await expect(manual.getByText('Read', { exact: true })).toBeVisible();
});
