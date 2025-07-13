import { PrismaClient } from '@prisma/client'
import { siteConfig } from '../config/site'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Create site configuration
  await prisma.siteConfig.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      name: siteConfig.name,
      description: siteConfig.description,
      tagline: siteConfig.tagline,
      slogan: siteConfig.slogan,
      url: siteConfig.url,
      ogImage: siteConfig.ogImage,
    },
  })

  // Create courses
  for (const course of siteConfig.courses) {
    await prisma.course.upsert({
      where: { slug: course.slug },
      update: {},
      create: {
        title: course.title,
        subtitle: course.subtitle,
        description: course.description,
        price: course.price,
        duration: course.duration,
        highlighted: course.highlighted,
        slug: course.slug,
        image: course.image,
        video: course.video,
        signupForm: course.signupForm,
        fullTitle: course.fullTitle,
        startDate: course.startDate,
        schedule: course.schedule,
        frequency: course.frequency,
        classSize: course.classSize,
        teacher: course.teacher,
        features: Array.isArray(course.features) ? course.features : [],
      },
    })
  }

  // Import testimonials, partners, features, and FAQ from site config
  const { testimonials, partners, features, faq } = await import('../config/site')

  // Create testimonials
  for (let i = 0; i < testimonials.length; i++) {
    const testimonial = testimonials[i]
    await prisma.testimonial.upsert({
      where: { id: `testimonial-${i}` },
      update: {},
      create: {
        id: `testimonial-${i}`,
        name: testimonial.name,
        role: testimonial.role,
        content: testimonial.content,
        rating: testimonial.rating,
        image: testimonial.image,
      },
    })
  }

  // Create partners
  for (let i = 0; i < partners.length; i++) {
    const partner = partners[i]
    await prisma.partner.upsert({
      where: { id: `partner-${i}` },
      update: {},
      create: {
        id: `partner-${i}`,
        name: partner.name,
        logo: partner.logo,
        url: partner.url,
      },
    })
  }

  // Create features
  for (let i = 0; i < features.length; i++) {
    const feature = features[i]
    await prisma.feature.upsert({
      where: { id: `feature-${i}` },
      update: {},
      create: {
        id: `feature-${i}`,
        title: feature.title,
        description: feature.description,
        icon: feature.icon,
        order: i,
      },
    })
  }

  // Create FAQ items
  for (let i = 0; i < faq.length; i++) {
    const faqItem = faq[i]
    await prisma.fAQ.upsert({
      where: { id: `faq-${i}` },
      update: {},
      create: {
        id: `faq-${i}`,
        question: faqItem.question,
        answer: faqItem.answer,
        order: i,
      },
    })
  }

  console.log('Database seeded successfully!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  }) 