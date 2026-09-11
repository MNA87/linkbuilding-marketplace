import { PrismaClient, CompanyType, ProductType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding rollen...");
  const [customerRole, supplierRole, adminRole] = await Promise.all([
    prisma.role.upsert({ where: { name: "customer" }, update: {}, create: { name: "customer" } }),
    prisma.role.upsert({ where: { name: "supplier" }, update: {}, create: { name: "supplier" } }),
    prisma.role.upsert({ where: { name: "admin" }, update: {}, create: { name: "admin" } }),
  ]);

  console.log("Seeding stamdata (categorieën, landen, talen)...");
  const categoryNames = ["Wonen", "Bouw", "Energie", "Financieel", "Automotive", "Technologie", "Lifestyle", "Zakelijk", "Gezondheid", "Onderwijs"];
  const categories = await Promise.all(
    categoryNames.map((name) => prisma.category.upsert({ where: { name }, update: {}, create: { name } }))
  );

  const nl = await prisma.country.upsert({ where: { code: "NL" }, update: {}, create: { name: "Nederland", code: "NL" } });
  await prisma.country.upsert({ where: { code: "BE" }, update: {}, create: { name: "België", code: "BE" } });
  const dutch = await prisma.language.upsert({ where: { code: "nl" }, update: {}, create: { name: "Nederlands", code: "nl" } });

  const [blogProduct, homeProduct] = await Promise.all([
    prisma.product.upsert({ where: { type: ProductType.BLOG_POST }, update: {}, create: { type: ProductType.BLOG_POST, name: "Blogartikel" } }),
    prisma.product.upsert({ where: { type: ProductType.HOMEPAGE_LINK }, update: {}, create: { type: ProductType.HOMEPAGE_LINK, name: "Homepage-link" } }),
  ]);

  console.log("Seeding admin...");
  const adminPasswordHash = await bcrypt.hash("admin1234", 10);
  await prisma.user.upsert({
    where: { email: "admin@platform.nl" },
    update: {},
    create: {
      email: "admin@platform.nl",
      passwordHash: adminPasswordHash,
      name: "Platformbeheer",
      roleId: adminRole.id,
    },
  });

  console.log("Seeding eigen supplier-account met 3 voorbeeldwebsites...");
  const supplierPasswordHash = await bcrypt.hash("demo1234", 10);
  const supplierCompany = await prisma.company.create({
    data: { name: "Eigen sites", type: CompanyType.PUBLISHER },
  });
  await prisma.user.create({
    data: {
      email: "publisher@eigensites.nl",
      passwordHash: supplierPasswordHash,
      name: "Eigen sites",
      roleId: supplierRole.id,
      companyId: supplierCompany.id,
    },
  });

  const exampleSites = [
    { domain: "nugevonden.nl", category: "Lifestyle", price: 149 },
    { domain: "enqueteplein.nl", category: "Financieel", price: 199 },
    { domain: "digikeur.nl", category: "Lifestyle", price: 129 },
  ];
  for (const site of exampleSites) {
    const category = categories.find((c) => c.name === site.category)!;
    const website = await prisma.website.create({
      data: {
        domain: site.domain,
        status: "ACTIVE",
        companyId: supplierCompany.id,
        categoryId: category.id,
        countryId: nl.id,
        languageId: dutch.id,
        metrics: {
          create: { domainRating: 35, domainAuthority: 30, organicTraffic: 5000, referringDomains: 300 },
        },
      },
    });
    await prisma.websiteProduct.create({
      data: {
        websiteId: website.id,
        productId: blogProduct.id,
        supplierPrice: site.price,
        config: { minWords: 500, maxWords: 900, maxLinks: 1, dofollow: true, permanent: true },
      },
    });
  }

  console.log("Seeding voorbeeldklant...");
  const customerPasswordHash = await bcrypt.hash("demo1234", 10);
  const customerCompany = await prisma.company.create({
    data: { name: "SEO Bureau Amsterdam", type: CompanyType.CUSTOMER },
  });
  await prisma.user.create({
    data: {
      email: "contact@seobureau.nl",
      passwordHash: customerPasswordHash,
      name: "SEO Bureau Amsterdam",
      roleId: customerRole.id,
      companyId: customerCompany.id,
    },
  });
  await prisma.project.create({
    data: { name: "klantwebsite.nl", customerCompanyId: customerCompany.id },
  });

  console.log("\nKlaar. Inloggegevens:");
  console.log("  Admin:    admin@platform.nl / admin1234");
  console.log("  Supplier: publisher@eigensites.nl / demo1234");
  console.log("  Customer: contact@seobureau.nl / demo1234");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
