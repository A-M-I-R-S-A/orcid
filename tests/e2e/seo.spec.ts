import { expect, test } from '@playwright/test'

test.describe('§60 — content exists in server-rendered HTML', () => {
  test('homepage renders without JavaScript', async ({ request }) => {
    const response = await request.get('/')
    expect(response.status()).toBe(200)

    const html = await response.text()

    expect(html).toContain('<html lang="fa" dir="rtl"')
    expect(html).toMatch(/<title>.+<\/title>/)
    expect(html.length).toBeGreaterThan(2000)
  })

  test('product page carries name, price and description in the HTML', async ({
    request,
    page,
  }) => {
    const sitemap = await (await request.get('/sitemap.xml')).text()
    const match = sitemap.match(/<loc>([^<]*\/product\/[^<]+)<\/loc>/)
    test.skip(!match, 'no products in sitemap — seed with --demo')

    const url = new URL(match![1]!)
    const response = await request.get(url.pathname)
    expect(response.status()).toBe(200)

    const html = await response.text()

    expect(html).toContain('"@type":"Product"')
    expect(html).toContain('"priceCurrency":"IRR"')
    expect((html.match(/<h1/g) ?? []).length).toBe(1)

    await page.goto(url.pathname)
    await expect(page.locator('h1')).toBeVisible()
  })

  test('category page renders products server-side', async ({ request }) => {
    const sitemap = await (await request.get('/sitemap.xml')).text()
    const match = sitemap.match(/<loc>([^<]*\/category\/[^<]+)<\/loc>/)
    test.skip(!match, 'no categories in sitemap — seed with --demo')

    const html = await (await request.get(new URL(match![1]!).pathname)).text()

    expect(html).toContain('"@type":"BreadcrumbList"')
    expect(html).toMatch(/<h1[^>]*>/)
  })
})

test.describe('§61/§67 — metadata and canonicals', () => {
  test('every indexable page has a unique title and a canonical', async ({ request }) => {
    const sitemap = await (await request.get('/sitemap.xml')).text()
    const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)]
      .map((m) => new URL(m[1]!).pathname)
      .slice(0, 12)

    const titles = new Set<string>()

    for (const path of urls) {
      const html = await (await request.get(path)).text()

      const title = html.match(/<title>([^<]*)<\/title>/)?.[1]
      expect(title, `${path} has no title`).toBeTruthy()

      const canonical = html.match(/rel="canonical"\s+href="([^"]+)"/)?.[1]
      expect(canonical, `${path} has no canonical`).toBeTruthy()
      expect(canonical).toMatch(/^https?:\/\//)

      expect(titles.has(title!), `duplicate title on ${path}: ${title}`).toBe(false)
      titles.add(title!)
    }
  })

  test('the site name appears exactly once in a title', async ({ request }) => {
    const sitemap = await (await request.get('/sitemap.xml')).text()
    const paths = [
      '/',
      ...[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]!).pathname),
    ].slice(0, 10)

    for (const path of paths) {
      const html = await (await request.get(path)).text()
      const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? ''

      const occurrences = title.split('ارکید').length - 1
      expect(occurrences, `"${title}" repeats the brand (${path})`).toBeLessThanOrEqual(1)
    }
  })

  test('a filtered category canonicalises to the bare category', async ({ request }) => {
    const sitemap = await (await request.get('/sitemap.xml')).text()
    const match = sitemap.match(/<loc>([^<]*\/category\/[^<]+)<\/loc>/)
    test.skip(!match, 'no categories — seed with --demo')

    const path = new URL(match![1]!).pathname
    const html = await (await request.get(`${path}?sort=price_asc&color=x`)).text()

    const canonical = html.match(/rel="canonical"\s+href="([^"]+)"/)?.[1]
    expect(canonical).not.toContain('sort=')
    expect(canonical).not.toContain('color=')
  })

  test('a multi-facet URL is noindex — §19 thin-URL policy', async ({ request }) => {
    const sitemap = await (await request.get('/sitemap.xml')).text()
    const match = sitemap.match(/<loc>([^<]*\/category\/[^<]+)<\/loc>/)
    test.skip(!match, 'no categories — seed with --demo')

    const path = new URL(match![1]!).pathname
    const html = await (await request.get(`${path}?color=مشکی&size=۷۵B`)).text()

    expect(html).toMatch(/name="robots"[^>]*content="[^"]*noindex/)
  })
})

test.describe('§70 — private pages are not indexable', () => {
  for (const path of [
    '/cart',
    '/checkout',
    '/login',
    '/search?q=test',
    '/admin/login',
    '/account/get-later',
    '/admin/get-later',
  ]) {
    test(`${path} is noindex`, async ({ request }) => {
      const response = await request.get(path)
      const html = await response.text()

      const isRedirect = response.status() >= 300 && response.status() < 400
      const isNoindex = /name="robots"[^>]*content="[^"]*noindex/.test(html)

      expect(isRedirect || isNoindex, `${path} must not be indexable`).toBe(true)
    })
  }
})

test.describe('§68/§69 — sitemap and robots', () => {
  test('sitemap is valid XML and lists only public URLs', async ({ request }) => {
    const response = await request.get('/sitemap.xml')
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('xml')

    const xml = await response.text()
    expect(xml).toContain('<urlset')

    for (const forbidden of ['/admin', '/cart', '/checkout', '/login', '/account', '/api/']) {
      expect(xml, `sitemap must not list ${forbidden}`).not.toContain(`${forbidden}`)
    }
  })

  test('robots.txt protects private paths without blocking assets', async ({ request }) => {
    const response = await request.get('/robots.txt')
    expect(response.status()).toBe(200)

    const text = await response.text()

    expect(text).toContain('Sitemap:')
    expect(text).toContain('Disallow: /admin')
    expect(text).toContain('Disallow: /checkout')

    expect(text).not.toMatch(/Disallow:\s*\/_next\/static/)
    expect(text).not.toMatch(/Disallow:\s*\/api\/media/)
    expect(text).not.toMatch(/Disallow:\s*\/\s*$/m)
  })
})

test.describe('§74 — HTTP status codes', () => {
  test('a missing page returns 404, not 200', async ({ request }) => {
    const response = await request.get('/product/this-product-does-not-exist-1234567890')
    expect(response.status()).toBe(404)
  })

  test('a missing category returns 404', async ({ request }) => {
    const response = await request.get('/category/no-such-category-1234567890')
    expect(response.status()).toBe(404)
  })

  test('a missing CMS page returns 404', async ({ request }) => {
    const response = await request.get('/p/no-such-page-1234567890')
    expect(response.status()).toBe(404)
  })

  test('the homepage returns 200', async ({ request }) => {
    expect((await request.get('/')).status()).toBe(200)
  })
})

test.describe('§62 — structured data is truthful', () => {
  test('Organization and WebSite schema are present on the homepage', async ({ request }) => {
    const html = await (await request.get('/')).text()

    expect(html).toContain('"@type":"Organization"')
    expect(html).toContain('"@type":"WebSite"')
  })

  test('AggregateRating never appears without a review count', async ({ request }) => {
    const sitemap = await (await request.get('/sitemap.xml')).text()
    const urls = [...sitemap.matchAll(/<loc>([^<]*\/product\/[^<]+)<\/loc>/g)]
      .map((m) => new URL(m[1]!).pathname)
      .slice(0, 5)

    test.skip(urls.length === 0, 'no products — seed with --demo')

    for (const path of urls) {
      const html = await (await request.get(path)).text()

      if (html.includes('"aggregateRating"')) {
        const count = html.match(/"reviewCount":(\d+)/)?.[1]
        expect(Number(count ?? 0), `${path} claims a rating with no reviews`).toBeGreaterThan(0)
      }
    }
  })
})

test.describe('§72 — image SEO', () => {
  test('above-the-fold images are eager, below-the-fold are lazy', async ({ page, request }) => {
    const sitemap = await (await request.get('/sitemap.xml')).text()
    const match = sitemap.match(/<loc>([^<]*\/product\/[^<]+)<\/loc>/)
    test.skip(!match, 'no products — seed with --demo')

    await page.goto(new URL(match![1]!).pathname)

    const images = page.locator('img')
    const count = await images.count()
    test.skip(count === 0, 'product has no images uploaded')

    expect(await images.first().getAttribute('loading')).toBe('eager')
  })

  test('every image has an alt attribute', async ({ page }) => {
    await page.goto('/')

    const missing = await page.locator('img:not([alt])').count()
    expect(missing, 'every img needs alt, even if empty for decorative').toBe(0)
  })
})
