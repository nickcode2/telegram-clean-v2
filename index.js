const express = require('express')
const TelegramBot = require('node-telegram-bot-api')
const OpenAI = require('openai')

const app = express()
app.use(express.json())

app.get('/', (req, res) => {
  res.send('OK')
})

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true })

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

bot.on('message', async (msg) => {
  const chatId = msg.chat.id
  const text = msg.text

  if (!text) return

  if (text === 'do it') {
    bot.sendMessage(chatId, 'Starting 10s pipeline...')
    runTest(chatId)
    return
  }

  bot.sendMessage(chatId, 'Send do it')
})

async function runTest(chatId) {
  try {
    // THEME
    const themeRes = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'user', content: 'Create a short megaproject documentary theme. Return only title.' }
      ]
    })

    const theme = themeRes.choices[0].message.content.trim()
    await bot.sendMessage(chatId, `THEME:\n${theme}`)

    // PROMPT 1
    const p1 = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'user', content: `Create ONE ultra realistic cinematic image prompt about: ${theme}. Only return the prompt.` }
      ]
    })

    const prompt1 = p1.choices[0].message.content.trim()
    await bot.sendMessage(chatId, `Prompt 1:\n${prompt1}`)

    // PROMPT 2
    const p2 = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'user', content: `Create another DIFFERENT ultra realistic cinematic image prompt about: ${theme}. Only return the prompt.` }
      ]
    })

    const prompt2 = p2.choices[0].message.content.trim()
    await bot.sendMessage(chatId, `Prompt 2:\n${prompt2}`)

    // IMAGE 1
    await bot.sendMessage(chatId, '🖼 Generating image 1...')
    const img1 = await generateImage(prompt1)
    await bot.sendPhoto(chatId, img1)

    // IMAGE 2
    await bot.sendMessage(chatId, '🖼 Generating image 2...')
    const img2 = await generateImage(prompt2)
    await bot.sendPhoto(chatId, img2)

    await bot.sendMessage(chatId, '✅ Images done')

  } catch (err) {
    console.error('MAIN ERROR:', err)
    bot.sendMessage(chatId, 'Error occurred')
  }
}

async function generateImage(promptText) {
  try {
    const start = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        version: "c221b2b8ef527988ecf4b6a6cde2baf9d1d6dbe2f5d5a63d315ff78eaefdd8af",
        input: {
          prompt: promptText,
          aspect_ratio: "16:9"
        }
      })
    })

    const prediction = await start.json()

    if (!prediction.id) {
      console.log('FULL ERROR:', JSON.stringify(prediction, null, 2))
      throw new Error('Replicate start failed')
    }

    let result

    while (true) {
      await new Promise(r => setTimeout(r, 2000))

      const check = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
        headers: {
          Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`
        }
      })

      result = await check.json()

      if (result.status === 'succeeded') break

      if (result.status === 'failed') {
        console.log('FAILED:', result)
        throw new Error('Replicate failed')
      }
    }

    if (!result.output) {
      console.log('NO OUTPUT:', result)
      throw new Error('No image output')
    }

    return Array.isArray(result.output) ? result.output[0] : result.output

  } catch (err) {
    console.error('IMAGE ERROR:', err)
    throw err
  }
}

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log('Server running')
})