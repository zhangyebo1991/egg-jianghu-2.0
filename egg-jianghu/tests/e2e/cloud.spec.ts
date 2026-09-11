import { readFile } from 'node:fs/promises'
import { resolve, extname } from 'node:path'
import { expect, test } from '@playwright/test'
import { createCloudServer } from '../../cloud/server.mjs'
import { SAVE_KEY_V10 } from '../../src/domain/save-v10'

let server: ReturnType<typeof createCloudServer>, apiUrl: string
const codes = new Map<string,string>()
test.beforeAll(async () => {
  server = createCloudServer({ origins: ['http://127.0.0.1:4173', 'https://223.6.255.187'], sendCode: async (email: string, purpose: string, code: string) => codes.set(`${email}:${purpose}`, code) })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  apiUrl = `http://127.0.0.1:${server.address().port}`
})
test.afterAll(async () => { await new Promise<void>(resolve => server.close(resolve)) })

test('真实 API 完成邮箱注册登录、云档上传下载、本地恢复及退出，移动端可操作', async ({ page }, testInfo) => {
  const errors: string[]=[]
  page.on('pageerror',error=>errors.push(error.message))
  await page.route('https://223.6.255.187/api/**', async route => {
    const response=await route.fetch({url:apiUrl+new URL(route.request().url()).pathname})
    await route.fulfill({response})
  })
  await page.goto('/')
  await page.getByRole('button',{name:'新建游戏'}).click()
  await page.getByLabel('玩家姓名').fill('云端少侠')
  await page.getByLabel('玩家姓名').press('Enter')
  await page.getByTestId('tab-settings').click()
  await page.getByRole('button',{name:'账号与云存档',exact:true}).click()
  const dialog=page.getByRole('dialog',{name:'账号与云存档'})
  await dialog.locator('[data-cloud="mode-register"]').click()
  await dialog.getByLabel('邮箱',{exact:true}).fill('browser@example.com')
  await dialog.getByLabel('密码',{exact:true}).fill('browser-password-123')
  await dialog.getByRole('button',{name:'发送验证码'}).click()
  await expect(dialog.getByRole('status')).toContainText('验证码已发送')
  await dialog.getByLabel('邮箱验证码').fill(codes.get('browser@example.com:register')!)
  await dialog.getByRole('button',{name:'验证并注册'}).click()
  await expect(dialog.getByRole('status')).toContainText('注册成功')
  await dialog.getByLabel('密码',{exact:true}).fill('browser-password-123')
  await dialog.getByRole('button',{name:'登录账号'}).click()
  await expect(dialog.getByRole('status')).toContainText('登录成功')
  const uploadedCurrency = await page.evaluate(()=>window.__EGG_JIANGHU__.getState().worldCurrency)
  await dialog.getByRole('button',{name:'上传到云端'}).click()
  await expect(dialog.getByRole('status')).toHaveText('上传成功')
  await dialog.getByRole('button',{name:'关闭',exact:true}).click()
  // 本地进度改变后，下载必须先确认；取消时保持当前进度。
  await page.evaluate(()=>window.__EGG_JIANGHU__.grantWorldCurrency('world_01',12345))
  const localBefore=await page.evaluate(()=>window.__EGG_JIANGHU__.getState().worldCurrency)
  await page.getByRole('button',{name:'账号与云存档',exact:true}).click()
  await dialog.getByRole('button',{name:'下载到本地'}).click()
  await expect(dialog.getByLabel('确认覆盖')).toBeVisible()
  await dialog.getByRole('button',{name:'取消',exact:true}).click()
  expect(await page.evaluate(()=>window.__EGG_JIANGHU__.getState().worldCurrency)).toEqual(localBefore)
  await dialog.getByRole('button',{name:'下载到本地'}).click()
  for(const width of [1440,390]) {
    await page.setViewportSize({width,height:960})
    expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true)
    await page.screenshot({path:testInfo.outputPath(`cloud-confirm-${width}.png`)})
  }
  await dialog.getByRole('button',{name:'确认覆盖'}).click()
  await expect(dialog.getByRole('status')).toContainText('云存档已下载')
  const downloaded=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),SAVE_KEY_V10)
  expect(downloaded.worldCurrency).toEqual(uploadedCurrency)
  await dialog.getByRole('button',{name:'恢复下载前的本地进度'}).click()
  await dialog.getByRole('button',{name:'确认覆盖'}).click()
  await expect(dialog.getByRole('status')).toContainText('已恢复本地进度')
  expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).worldCurrency,SAVE_KEY_V10)).toEqual(localBefore)
  await dialog.getByRole('button',{name:'退出登录'}).click()
  await expect(dialog.getByRole('status')).toContainText('本地存档保留')
  await dialog.getByRole('button',{name:'关闭',exact:true}).click()
  await expect(page.getByRole('button',{name:'继续游戏'})).toBeEnabled()
  await page.reload()
  await page.getByRole('button',{name:'账号与云存档',exact:true}).click()
  await expect(dialog.getByRole('button',{name:'登录账号'})).toBeVisible()
  expect(errors).toEqual([])
})


test('HTTP 旧站安全弹窗上传实时本地快照，下载回原位置且关闭后返回游戏', async ({ context, page }) => {
  const apiCall = async (path: string, data: unknown) => {
    const response = await fetch(apiUrl+'/api/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)})
    expect(response.status).toBe(200)
    return response.json()
  }
  const email='bridge@example.com', password='bridge-password-123'
  await apiCall('auth/code',{email,purpose:'register'})
  await apiCall('auth/register',{email,password,code:codes.get(email+':register')})
  await context.route(/https?:\/\/223\.6\.255\.187(?::5174)?\//,async route=>{
    const url=new URL(route.request().url())
    if(url.pathname.startsWith('/api/')) {
      const response=await route.fetch({url:apiUrl+url.pathname})
      await route.fulfill({response}); return
    }
    const path=url.pathname==='/'?'index.html':url.pathname.slice(1)
    const mime:Record<string,string>={'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.ttf':'font/ttf'}
    const root=resolve('dist'),file=resolve(root,path)
    if(!file.startsWith(root)) {await route.abort();return}
    try {await route.fulfill({status:200,contentType:mime[extname(file)]||'application/octet-stream',body:await readFile(file)})}
    catch {await route.fulfill({status:404,body:'Not found'})}
  })
  await page.goto('http://223.6.255.187:5174/')
  await page.getByRole('button',{name:'新建游戏'}).click()
  await page.getByLabel('玩家姓名').fill('初始本地')
  await page.getByLabel('玩家姓名').press('Enter')
  await page.getByTestId('tab-settings').click()
  const opened=page.waitForEvent('popup')
  await page.getByRole('button',{name:'账号与云存档',exact:true}).click()
  const popup=await opened,dialog=popup.getByRole('dialog',{name:'账号与云存档'})
  await dialog.getByLabel('邮箱',{exact:true}).fill(email)
  await dialog.getByLabel('密码',{exact:true}).fill(password)
  await dialog.getByRole('button',{name:'登录账号'}).click()
  await expect(dialog.getByRole('status')).toContainText('登录成功')
  const newLocal=async(name:string)=>{
    await page.locator('[data-action="request-reset-save"]').click()
    await page.locator('[data-action="confirm-reset-save"]').click()
    await page.getByLabel('玩家姓名').fill(name)
    await page.getByLabel('玩家姓名').press('Enter')
  }
  await newLocal('更新本地')
  await dialog.getByRole('button',{name:'上传到云端'}).click()
  await expect(dialog.getByRole('status')).toHaveText('上传成功')
  await expect(dialog.locator('.cloud-saves')).toContainText('更新本地')
  await newLocal('另一本地')
  await dialog.getByRole('button',{name:'下载到本地'}).click()
  await dialog.getByRole('button',{name:'确认覆盖'}).click()
  await expect(dialog.getByRole('status')).toContainText('写回原游戏窗口')
  expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).heroes.hero_player.customName,SAVE_KEY_V10)).toBe('更新本地')
  const closed=popup.waitForEvent('close')
  await dialog.getByRole('button',{name:'关闭',exact:true}).click()
  await closed
  await expect(page.getByRole('button',{name:'继续游戏'})).toBeEnabled()
})
