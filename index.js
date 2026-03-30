const express = require('express')
const TelegramBot = require('node-telegram-bot-api')
const OpenAI = require('openai')
const Replicate = require('replicate')

const app = express()
app.use(express.json())

app.get('/', (req, res) => {
  res.send('OK')
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
  const text = msg.text

  if (!text) return

  if (text.trim().toLowerCase() === 'do it') {
    await bot.sendMessage(chatId, 'Starting 10s pipeline...')
    runTest(chatId)
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

    const theme = themeRes.choices[0].message.content.trim()
    await bot.sendMessage(chatId, `THEME:\n${theme}`)

    const p1 = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: `Create ONE ultra realistic image prompt for a YouTube documentary thumbnail style frame about: ${theme}. Keep it grounded, photoreal, cinematic, clean, no fantasy. Return only the prompt.`
        }
      ]
    })

    const prompt1 = p1.choices[0].message.content.trim()
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

    const prompt2 = p2.choices[0].message.content.trim()
    await bot.sendMessage(chatId, `Prompt 2:\n${prompt2}`)

    await bot.sendMessage(chatId, '🖼 Generating image 1...')
    const img1 = await generateImage(prompt1)
    await bot.sendPhoto(chatId, img1)

    await bot.sendMessage(chatId, '🖼 Generating image 2...')
    const img2 = await generateImage(prompt2)
    await bot.sendPhoto(chatId, img2)

    await bot.sendMessage(chatId, '✅ Images done')

  } catch (err) {
    console.error('MAIN ERROR:', err)
    await bot.sendMessage(chatId, `❌ ERROR:\n${err.message || err}`)
  }
}

async function generateImage(promptText) {
  const output = await replicate.run(
    "black-forest-labs/flux-2-max",
    {
      input: {
        prompt: promptText,
        aspect_ratio: "16:9"
      }
    }
  )

  console.log("OUTPUT:", output)

  if (!output) {
    throw new Error("No output from Replicate")
  }

  if (Array.isArray(output)) {
    return output[0]
  }

  return output
}

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log('Server running')
})