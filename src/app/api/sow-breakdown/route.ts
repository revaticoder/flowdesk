import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { sowText, client, month } = await request.json()

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4000,
        messages: [
          {
            role: 'user',
            content: `You are an agency project manager. Read the following scope of work for client "${client}" for the month "${month}" and break it into individual tasks.

For each task return a JSON object with these exact fields:
- title: string
- role: one of [Strategist, Graphic Designer, Senior Graphic Designer, Video Editor, Junior Video Editor, Copywriter, Social Media Manager, SEO Specialist, Performance Marketer, Operations Manager, Digital Marketer]
- priority: one of [Urgent, High, Medium, Low]
- due_date: a date string within ${month} (earlier dates for urgent tasks)
- points: number (Urgent=20, High=15, Medium=10, Low=5)
- mandate_type: one of [Social Media Marketing, Performance Marketing, SEO, Content Marketing, Website Development, Branding, Email Marketing, WhatsApp Marketing, Influencer Marketing, PR Management]

Return ONLY a valid JSON array. No explanation, no markdown, no backticks. Just the raw JSON array.

SOW TEXT:
${sowText}`
          }
        ]
      })
    })

    const data = await response.json()
    console.log('Anthropic response status:', response.status)

    if (!response.ok) {
      console.error('Anthropic error:', JSON.stringify(data))
      return NextResponse.json({ error: `Claude API error: ${response.status} - ${JSON.stringify(data)}` }, { status: 500 })
    }

    const text = data.content[0].text
    console.log('Raw response:', text)

    const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim()
    const tasks = JSON.parse(cleaned)

    return NextResponse.json({ tasks })
  } catch (error) {
    console.error('SOW breakdown error:', error)
    return NextResponse.json({ error: 'Failed to generate tasks' }, { status: 500 })
  }
}
