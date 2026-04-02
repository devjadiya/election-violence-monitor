import { PrismaClient } from '../../src/lib/generated/prisma'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const hashedPassword = await bcrypt.hash('admin123456', 12)

  const admin = await prisma.user.upsert({
    where: { email: 'dev.wikipedia@gmail.com' },
    update: { password: hashedPassword },
    create: {
      email: 'dev.wikipedia@gmail.com',
      name: 'Admin',
      password: hashedPassword,
      role: 'ADMIN',
      isActive: true,
    },
  })
  console.log('✅ Admin user created with bcrypt password:', admin.email)

  // Seed trusted Nigerian news sources
  const sources = [
    { name: 'Channels Television', url: 'https://www.channelstv.com', rssUrl: 'https://www.channelstv.com/feed/', country: 'Nigeria', trustScore: 85 },
    { name: 'Punch Nigeria', url: 'https://punchng.com', rssUrl: 'https://punchng.com/feed/', country: 'Nigeria', trustScore: 80 },
    { name: 'Vanguard Nigeria', url: 'https://www.vanguardngr.com', rssUrl: 'https://www.vanguardngr.com/feed/', country: 'Nigeria', trustScore: 78 },
    { name: 'The Nation Nigeria', url: 'https://thenationonline.net', rssUrl: 'https://thenationonline.net/feed/', country: 'Nigeria', trustScore: 75 },
    { name: 'Premium Times Nigeria', url: 'https://www.premiumtimesng.com', rssUrl: 'https://www.premiumtimesng.com/feed', country: 'Nigeria', trustScore: 88 },
    { name: 'Daily Trust', url: 'https://dailytrust.com', rssUrl: 'https://dailytrust.com/feed/', country: 'Nigeria', trustScore: 80 },
    { name: 'Sahara Reporters', url: 'https://saharareporters.com', rssUrl: 'https://saharareporters.com/rss.xml', country: 'Nigeria', trustScore: 72 },
    { name: 'GDELT Project', url: 'https://api.gdeltproject.org', rssUrl: null, country: null, trustScore: 70 },
    { name: 'Reuters Africa', url: 'https://www.reuters.com', rssUrl: 'https://feeds.reuters.com/reuters/AFRICANews', country: null, trustScore: 95 },
    { name: 'BBC Africa', url: 'https://www.bbc.com/africa', rssUrl: 'https://feeds.bbci.co.uk/news/world/africa/rss.xml', country: null, trustScore: 95 },
    { name: 'Al Jazeera Africa', url: 'https://www.aljazeera.com', rssUrl: 'https://www.aljazeera.com/xml/rss/all.xml', country: null, trustScore: 88 },
    { name: 'Voice of America Africa', url: 'https://www.voanews.com', rssUrl: 'https://www.voanews.com/api/zktmqeimmv', country: null, trustScore: 85 },
  ]

  for (const source of sources) {
    await prisma.monitoredSource.upsert({
      where: { url: source.url },
      update: { trustScore: source.trustScore },
      create: {
        name: source.name,
        url: source.url,
        rssUrl: source.rssUrl,
        sourceType: source.rssUrl ? 'RSS_FEED' : 'API',
        country: source.country,
        language: 'en',
        trustScore: source.trustScore,
        isActive: true,
      },
    })
  }
  console.log('✅ Seeded', sources.length, 'trusted news sources')

  // Seed upcoming elections
  const elections = [
    {
      name: '2027 Nigerian General Elections',
      country: 'Nigeria',
      countryCode: 'NGA',
      electionDate: new Date('2027-02-20'),
      electionType: 'general',
      wikidataId: null,
      isActive: true,
    },
    {
      name: '2025 Anambra Governorship Election',
      country: 'Nigeria',
      countryCode: 'NGA',
      electionDate: new Date('2025-11-08'),
      electionType: 'gubernatorial',
      wikidataId: null,
      isActive: true,
    },
  ]

  for (const election of elections) {
    const existing = await prisma.election.findFirst({
      where: { name: election.name },
    })
    if (!existing) {
      await prisma.election.create({ data: election })
    }
  }
  console.log('✅ Seeded', elections.length, 'elections')
}

main().catch(console.error).finally(() => prisma.$disconnect())