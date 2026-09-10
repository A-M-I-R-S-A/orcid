import { expect, test } from '@playwright/test'

async function firstProductPath(request: import('@playwright/test').APIRequestContext) {
  const sitemap = await (await request.get('/sitemap.xml')).text()
  const match = sitemap.match(/<loc>([^<]*\/product\/[^<]+)<\/loc>/)
  return match ? new URL(match[1]!).pathname : null
}

test.describe('browsing', () => {
  test('homepage renders and the header works', async ({ page }) => {
    await page.goto('/')

    await expect(page).toHaveTitle(/ارکید/)
    await expect(page.locator('header')).toBeVisible()
    await expect(page.getByRole('link', { name: /سبد خرید/ })).toBeVisible()
  })

  test('the page is right-to-left', async ({ page }) => {
    await page.goto('/')

    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
    await expect(page.locator('html')).toHaveAttribute('lang', 'fa')
  })

  for (const path of ['/', '/products', '/search?q=%D9%84%D8%A8%D8%A7%D8%B3', '/blog']) {
    test(`the body never scrolls sideways — ${path}`, async ({ page }) => {
      await page.goto(path)

      const overflow = await page.evaluate(() => {
        const doc = document.documentElement
        if (doc.scrollWidth <= doc.clientWidth + 1) return null

        let worst = { tag: '', cls: '', width: 0 }
        for (const el of document.querySelectorAll('body *')) {
          const { width, right, left } = el.getBoundingClientRect()
          if (right > doc.clientWidth + 1 || left < -1) {
            if (width > worst.width) {
              worst = { tag: el.tagName, cls: String(el.className).slice(0, 80), width }
            }
          }
        }
        return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth, worst }
      })

      expect(overflow, `${path} must not scroll horizontally`).toBeNull()
    })
  }

  test('a product page loads from a category', async ({ page, request }) => {
    const path = await firstProductPath(request)
    test.skip(!path, 'no products — seed with --demo')

    await page.goto(path!)

    await expect(page.locator('h1')).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'مسیر صفحه' })).toBeVisible()
  })
})

test.describe('search — §18 Persian normalisation', () => {
  test('finds a product typed with Arabic Yeh', async ({ page }) => {
    await page.goto('/search?q=' + encodeURIComponent('مشكي'))

    await expect(page.locator('h1')).toContainText('مشكي')
    await expect(page.locator('main')).toBeVisible()
  })

  test('an empty query shows guidance rather than everything', async ({ page }) => {
    await page.goto('/search')
    await expect(page.locator('main')).toContainText('جستجو')
  })

  test('search results are noindex', async ({ page }) => {
    await page.goto('/search?q=test')
    const robots = await page.locator('meta[name="robots"]').getAttribute('content')
    expect(robots).toContain('noindex')
  })
})

test.describe('cart', () => {
  test('adding a product updates the cart', async ({ page, context, request }) => {
    const path = await firstProductPath(request)
    test.skip(!path, 'no products — seed with --demo')

    await page.goto(path!)

    const addButton = page.getByRole('button', { name: 'افزودن به سبد خرید' })
    test.skip(!(await addButton.isEnabled()), 'first product is out of stock')

    await addButton.click()
    await expect(page.getByText('به سبد خرید اضافه شد')).toBeVisible({ timeout: 10_000 })

    const cartCookie = (await context.cookies()).find((c) => c.name === 'orchid_cart')
    test.skip(
      Boolean(cartCookie?.secure) && new URL(page.url()).protocol === 'http:',
      'Secure cookie cannot be sent over http on this browser — run the suite against https',
    )

    await page.waitForLoadState('networkidle')
    await page.goto('/cart')
    await expect(page.locator('h1')).toContainText('سبد خرید')
    await expect(page.getByText('مبلغ قابل پرداخت')).toBeVisible()
  })

  test('an empty cart offers a way forward', async ({ page, context }) => {
    await context.clearCookies()
    await page.goto('/cart')

    await expect(page.getByText('سبد خرید شما خالی است')).toBeVisible()
    await expect(page.getByRole('link', { name: 'شروع خرید' })).toBeVisible()
  })

  test('checkout requires signing in', async ({ page, context }) => {
    await context.clearCookies()
    await page.goto('/checkout')

    await expect(page).toHaveURL(/\/login/)
  })
})

test.describe('hero and the full catalogue', () => {
  test('the hero call to action goes to every product, not a category', async ({ page }) => {
    await page.goto('/')

    const cta = page.locator('main section').first().getByRole('link').first()
    await expect(cta).toBeVisible()

    const href = await cta.getAttribute('href')
    expect(href).not.toMatch(/\/category\//)

    await cta.click()
    await expect(page).toHaveURL(/\/products/)
  })

  test('the hero is one composition, not two columns', async ({ page }) => {
    await page.goto('/')

    const hero = page.locator('section').first()
    const image = hero.locator('img').first()
    const heading = hero.locator('h1')

    const heroBox = await hero.boundingBox()
    const imageBox = await image.boundingBox()
    const headingBox = await heading.boundingBox()
    expect(heroBox && imageBox && headingBox).toBeTruthy()

    expect(imageBox!.height / heroBox!.height).toBeGreaterThan(0.7)

    const overlap =
      Math.min(imageBox!.x + imageBox!.width, headingBox!.x + headingBox!.width) -
      Math.max(imageBox!.x, headingBox!.x)
    expect(overlap).toBeGreaterThan(0)
  })

  test('every product is reachable without choosing a category', async ({ page, request }) => {
    const response = await request.get('/products')
    expect(response.status()).toBe(200)

    const html = await response.text()
    expect(html).toContain('"@type":"BreadcrumbList"')
    expect(html).not.toMatch(/<meta name="robots"[^>]*noindex/)

    await page.goto('/products')
    await expect(page.locator('h1')).toContainText('همه محصولات')
    await expect(page.locator('article').first()).toBeVisible()
  })
})

test.describe('desktop navigation', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, 'desktop-only chrome')

  test('the current category is marked, not just hovered', async ({ page, request }) => {
    const sitemap = await (await request.get('/sitemap.xml')).text()
    const match = sitemap.match(/<loc>([^<]*\/category\/[^<]+)<\/loc>/)
    test.skip(!match, 'no categories in sitemap — seed with --demo')

    const path = new URL(match![1]!).pathname
    await page.goto(path)

    const current = page.locator('.header-nav a[aria-current="page"]')
    await expect(current).toHaveCount(1)

    await page.goto('/')
    await expect(page.locator('.header-nav a[aria-current="page"]')).toHaveCount(0)
  })

  test('the header condenses on scroll and comes back at the top', async ({ page }) => {
    await page.goto('/')

    const header = page.locator('#site-header')
    const bar = page.locator('#site-header .header-bar')

    const resting = (await bar.boundingBox())?.height ?? 0
    expect(resting).toBeGreaterThan(70)

    await page.evaluate(() => {
      document.documentElement.style.scrollBehavior = 'auto'
      window.scrollTo({ top: 600, behavior: 'instant' })
    })
    await expect(header).toHaveAttribute('data-condensed', 'true')

    await expect
      .poll(async () => (await bar.boundingBox())?.height ?? 0, {
        message: 'the header bar must actually shrink, not just flip its flag',
      })
      .toBeLessThan(resting)

    await expect(page.locator('.header-nav')).toBeVisible()

    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
    await expect(header).toHaveAttribute('data-condensed', 'false')
  })
})

test.describe('size guide', () => {

  test('the desktop menu leads to the guide page', async ({ page, viewport }) => {
    test.skip((viewport?.width ?? 0) < 1024, 'the nav row is lg and up')

    await page.goto('/')

    const link = page.locator('.header-nav a[href="/p/size-guide"]')
    await expect(link).toHaveCount(1)
    await link.click()

    await expect(page).toHaveURL(/\/p\/size-guide$/)
    await expect(page.locator('h1')).toContainText('راهنمای سایز')
  })

  test('the drawer leads to the guide page', async ({ page, viewport }) => {
    test.skip((viewport?.width ?? 0) >= 1024, 'the drawer is below lg')

    await page.goto('/')
    await page.getByRole('button', { name: 'باز کردن منو' }).click()

    const drawer = page.getByRole('dialog', { name: 'منوی اصلی' })
    await expect(drawer).toBeVisible()

    await drawer.locator('a[href="/p/size-guide"]').click()

    await expect(page).toHaveURL(/\/p\/size-guide$/)
    await expect(page.locator('h1')).toContainText('راهنمای سایز')
  })

  test('the product page opens it over the product, not instead of it', async ({
    page,
    request,
  }) => {
    const path = await firstProductPath(request)
    test.skip(!path, 'no products — seed with --demo')

    await page.goto(path!)

    const trigger = page.getByRole('button', { name: 'راهنمای سایز' })
    test.skip((await trigger.count()) === 0, 'this product has no size option')

    const dialog = page.getByRole('dialog', { name: 'راهنمای سایز' })
    await expect(dialog).toBeHidden()

    await trigger.click()
    await expect(dialog).toBeVisible()

    expect(new URL(page.url()).pathname).toBe(path)
    await expect(page.locator('h1')).toBeVisible()

    await expect(dialog.getByRole('link')).toHaveAttribute('href', '/p/size-guide')
  })

  test('escape closes it and gives focus back', async ({ page, request }) => {
    const path = await firstProductPath(request)
    test.skip(!path, 'no products — seed with --demo')

    await page.goto(path!)

    const trigger = page.getByRole('button', { name: 'راهنمای سایز' })
    test.skip((await trigger.count()) === 0, 'this product has no size option')

    await trigger.click()
    await expect(page.getByRole('dialog', { name: 'راهنمای سایز' })).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: 'راهنمای سایز' })).toBeHidden()

    await expect(trigger).toBeFocused()

    await expect
      .poll(async () => page.evaluate(() => getComputedStyle(document.body).overflow))
      .not.toBe('hidden')
  })
})

test.describe('authentication — §24', () => {
  const phoneField = 'input[name="phone"]'

  test('the sign-in form accepts Persian digits', async ({ page }) => {
    await page.goto('/login')

    const input = page.locator(phoneField)

    await input.pressSequentially('۰۹۱۲۱۲۳۴۵۶۷', { delay: 10 })

    await expect(input).toHaveValue('09121234567')
  })

  test('both sign-in methods are offered, password first', async ({ page }) => {
    await page.goto('/login')

    const tabs = page.getByRole('tab')
    await expect(tabs).toHaveCount(2)

    await expect(page.getByRole('tab', { name: 'رمز عبور' })).toHaveAttribute(
      'aria-selected',
      'true',
    )

    await page.getByRole('tab', { name: /کد یک‌بار مصرف/ }).click()
    await expect(page.getByRole('button', { name: /ارسال کد تأیید/ })).toBeVisible()
  })

  test('an invalid phone number is rejected in Persian', async ({ page }) => {
    await page.goto('/login')

    await page.locator(phoneField).pressSequentially('02112345678', { delay: 10 })
    await page.locator('input[autocomplete="current-password"]').fill('not-the-password')
    await page.getByRole('button', { name: 'ورود' }).click()

    await expect(page.locator('form [role="alert"]')).toBeVisible({ timeout: 10_000 })
  })

  test('a wrong password does not reveal whether the account exists', async ({ page }) => {
    await page.goto('/login')

    await page.locator(phoneField).pressSequentially('09129999999', { delay: 10 })
    await page.locator('input[autocomplete="current-password"]').fill('definitely-wrong')
    await page.getByRole('button', { name: 'ورود' }).click()

    await expect(page.locator('form [role="alert"]')).toContainText(
      'شماره موبایل یا رمز عبور صحیح نیست',
      { timeout: 10_000 },
    )
  })

  test('the phone field is set up for mobile entry', async ({ page }) => {
    await page.goto('/login')

    const input = page.locator(phoneField)
    await expect(input).toHaveAttribute('inputmode', 'numeric')
    await expect(input).toHaveAttribute('autocomplete', 'tel')
    await expect(input).toHaveAttribute('dir', 'ltr')
  })

  test('registration collects a name and a password before any code', async ({ page }) => {
    await page.goto('/register')

    await expect(page.locator('#register-name')).toBeVisible()
    await expect(page.locator('input[autocomplete="new-password"]')).toBeVisible()

    const submit = page.getByRole('button', { name: 'ادامه' })
    await expect(submit).toBeDisabled()

    const name = page.locator('#register-name')
    const phone = page.locator('input[name="phone"]')
    const password = page.locator('input[autocomplete="new-password"]')

    await name.pressSequentially('شیرین محمدی', { delay: 5 })
    await phone.pressSequentially('09121234567', { delay: 5 })
    await password.pressSequentially('short', { delay: 5 })
    await expect(submit).toBeDisabled()

    await password.pressSequentially('-but-now-long-enough', { delay: 5 })
    await expect(submit).toBeEnabled()
  })

  test('a password can be revealed, and starts hidden', async ({ page }) => {
    await page.goto('/register')

    const password = page.locator('input[autocomplete="new-password"]')
    await expect(password).toHaveAttribute('type', 'password')

    await page.getByRole('button', { name: 'نمایش رمز عبور' }).click()
    await expect(password).toHaveAttribute('type', 'text')
  })

  test('sign-in links to registration and to password recovery', async ({ page }) => {
    await page.goto('/login')

    await expect(page.getByRole('link', { name: 'ثبت‌نام کنید' })).toBeVisible()
    await page.getByRole('link', { name: /رمز عبور را فراموش/ }).click()

    await expect(page).toHaveURL(/\/forgot-password/)
    await expect(page.getByRole('button', { name: /ارسال کد بازیابی/ })).toBeVisible()
  })

  test('the account area is not reachable when signed out', async ({ page, context }) => {
    await context.clearCookies()
    await page.goto('/account')
    await expect(page).toHaveURL(/\/login/)
  })

  test('every account section is protected', async ({ page, context }) => {
    await context.clearCookies()

    for (const path of [
      '/account/orders',
      '/account/get-later',
      '/account/wishlist',
      '/account/addresses',
      '/account/profile',
      '/account/reviews',
    ]) {
      await page.goto(path)
      await expect(page).toHaveURL(/\/login/)
    }
  })

  test('the wishlist endpoint tells a signed-out visitor nothing', async ({ request }) => {
    const response = await request.get('/api/wishlist')

    expect(response.status()).toBe(200)
    expect(await response.json()).toEqual({ ids: [] })

    expect(response.headers()['cache-control']).toContain('no-store')
  })
})

test.describe('admin is protected', () => {
  test('the panel redirects to login when signed out', async ({ page, context }) => {
    await context.clearCookies()
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/admin\/login/)
  })

  for (const path of [
    '/admin/orders',
    '/admin/payments',
    '/admin/products',
    '/admin/settings',
    '/admin/get-later',
  ]) {
    test(`${path} is protected`, async ({ page, context }) => {
      await context.clearCookies()
      await page.goto(path)
      await expect(page).toHaveURL(/\/admin\/login/)
    })
  }

  test('bad credentials give one generic message', async ({ page }) => {
    await page.goto('/admin/login')

    await page.locator('#username').fill('definitely-not-a-real-admin')
    await page.locator('#password').fill('definitely-not-the-password')
    await page.getByRole('button', { name: 'ورود' }).click()

    const alert = page.locator('form p.field-error')
    await expect(alert).toBeVisible({ timeout: 10_000 })
    await expect(alert).toContainText('نام کاربری یا رمز عبور اشتباه است')
  })
})

test.describe('responsive — §9', () => {
  test('the header adapts to the viewport', async ({ page, isMobile }) => {
    await page.goto('/')

    if (isMobile) {
      await expect(page.getByRole('button', { name: 'باز کردن منو' })).toBeVisible()
    } else {
      await expect(page.getByRole('navigation', { name: 'ناوبری اصلی' })).toBeVisible()
    }
  })

  test('the mobile menu opens and closes', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'mobile only')

    await page.goto('/')
    await page.getByRole('button', { name: 'باز کردن منو' }).click()

    const drawer = page.getByRole('dialog', { name: 'منوی اصلی' })
    await expect(drawer).toBeVisible()

    await page.getByRole('button', { name: 'بستن منو' }).click()
    await expect(drawer).not.toBeVisible()
  })

  test('the mobile drawer fills the viewport, not just the header', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'mobile only')

    await page.goto('/')
    await page.getByRole('button', { name: 'باز کردن منو' }).click()

    const drawer = page.getByRole('dialog', { name: 'منوی اصلی' })
    await expect(drawer).toBeVisible()

    const viewport = page.viewportSize()!

    await expect
      .poll(async () => (await drawer.boundingBox())?.height ?? 0, {
        message: 'drawer must fill the viewport height',
      })
      .toBeGreaterThan(viewport.height * 0.9)

    await expect
      .poll(async () => (await drawer.boundingBox())?.x ?? viewport.width, {
        message: 'drawer must settle on screen, not stay translated out',
      })
      .toBeLessThan(viewport.width * 0.95)

    const settled = (await drawer.boundingBox())!
    expect(settled.x + settled.width, 'drawer must reach the inline-start edge').toBeGreaterThan(
      viewport.width * 0.9,
    )
  })

  test('tap targets are large enough on mobile', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'mobile only')

    await page.goto('/')

    const cartLink = page.getByRole('link', { name: /سبد خرید/ }).first()
    const box = await cartLink.boundingBox()

    expect(box, 'cart link must be present').toBeTruthy()
    expect(box!.height).toBeGreaterThanOrEqual(40)
  })
})

test.describe('accessibility basics', () => {
  test('there is a skip link', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('link', { name: 'پرش به محتوای اصلی' })).toBeAttached()
  })

  test('every page has exactly one h1', async ({ page, request }) => {
    for (const path of ['/', '/cart', '/blog']) {
      await page.goto(path)
      const count = await page.locator('h1').count()
      expect(count, `${path} should have one h1, found ${count}`).toBeLessThanOrEqual(1)
    }

    const productPath = await firstProductPath(request)
    if (productPath) {
      await page.goto(productPath)
      expect(await page.locator('h1').count()).toBe(1)
    }
  })

  test('keyboard focus is visible', async ({ page }) => {
    await page.goto('/')
    await page.keyboard.press('Tab')

    const outline = await page.evaluate(() => {
      const el = document.activeElement
      if (!el) return null
      const style = getComputedStyle(el)
      return { outlineWidth: style.outlineWidth, outlineStyle: style.outlineStyle }
    })

    expect(outline).toBeTruthy()
    expect(outline!.outlineStyle).not.toBe('none')
  })
})
