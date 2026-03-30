const express = require('express')
const TelegramBot = require('node-telegram-bot-api')
const OpenAI = require('openai')
const Replicate = require('replicate')

console.log('NEW FLUX PRO DEPLOY')

const app = express()
app.use(express.json())

app.get('/', (req, res) => {
  res.status(200).send('OK')
})

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true })

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN
})

bot.on('message', async (msg) => {
  const chatId = msg.chat.id
  const text = (msg.text || '').trim().toLowerCase()

  if (!text) return

  if (text === 'do it') {
    await bot.sendMessage(chatId, 'Starting 10s pipeline...')
    await runTest(chatId)
    return
  }

  await bot.sendMessage(chatId, 'Send do it')
})

async function runTest(chatId) {
  try {
    const themeRes = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: 'Create a short megaproject documentary theme. Return only the title in one line.'
        }
      ]
    })

    const theme = themeRes.choices?.[0]?.message?.content?.trim()
    if (!theme) throw new Error('OpenAI did not return a theme')

    await bot.sendMessage(chatId, `THEME:\n${theme}`)

    const p1 = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: `Create ONE ultra realistic image prompt for a YouTube documentary frame about: ${theme}. Keep it grounded, photoreal, cinematic, clean, no fantasy. Return only the prompt.`
        }
      ]
    })

    const prompt1 = p1.choices?.[0]?.message?.content?.trim()
    if (!prompt1) throw new Error('OpenAI did not return prompt 1')
    await bot.sendMessage(chatId, `Prompt 1:\n${prompt1}`)

    const p2 = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: `Create another DIFFERENT ultra realistic image prompt about: ${theme}. Different camera angle and composition. Keep it grounded, photoreal, cinematic, clean, no fantasy. Return only the prompt.`
        }
      ]
    })

    const prompt2 = p2.choices?.[0]?.message?.content?.trim()
    if (!prompt2) throw new Error('OpenAI did not return prompt 2')
    await bot.sendMessage(chatId, `Prompt 2:\n${prompt2}`)

    await bot.sendMessage(chatId, 'Generating image 1...')
    const img1 = await generateImage(prompt1)
    await bot.sendPhoto(chatId, img1)

    await bot.sendMessage(chatId, 'Generating image 2...')
    const img2 = await generateImage(prompt2)
    await bot.sendPhoto(chatId, img2)

    await bot.sendMessage(chatId, 'Images done')
  } catch (err) {
    console.error('MAIN ERROR:', err)
    await bot.sendMessage(chatId, `ERROR:\n${err?.message || String(err)}`)
  }
}

async function generateImage(promptText) {
  try {
    console.log('GENERATE IMAGE PROMPT:', promptText)

    const output = await replicate.run('black-forest-labs/flux-2-pro', {
      input: {
        prompt: promptText
      }
    })

    console.log('REPLICATE OUTPUT:', output)

    if (!output) {
      throw new Error('Replicate returned no output')
    }

    if (Array.isArray(output) && output.length > 0) {
      const first = output[0]

      if (typeof first === 'string') return first
      if (first && typeof first.url === 'function') return first.url()
      if (first && typeof first === 'object' && typeof first.url === 'string') return first.url

      throw new Error('Unsupported Replicate array output')
    }

    if (typeof output === 'string') {
      return output
    }

    if (output && typeof output.url === 'function') {
      return output.url()
    }

    if (output && typeof output === 'object' && typeof output.url === 'string') {
      return output.url
    }

    throw new Error('Unsupported Replicate output format')
  } catch (err) {
    console.error('IMAGE ERROR:', err)
    throw err
  }
}

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})