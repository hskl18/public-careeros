import {
  getSiteUrl,
  securityEmail,
  siteDescription,
  siteName,
  supportEmail,
} from "@/lib/site-metadata";

type PublicJsonLdProps = {
  title: string;
  description: string;
  path: string;
  includeProduct?: boolean;
  pageType?:
    | "WebPage"
    | "AboutPage"
    | "CollectionPage"
    | "ContactPage"
    | "TechArticle";
  breadcrumbLabel?: string;
  faq?: Array<{
    question: string;
    answer: string;
  }>;
};

export function PublicJsonLd({
  title,
  description,
  path,
  includeProduct = false,
  pageType = "WebPage",
  breadcrumbLabel,
  faq = [],
}: PublicJsonLdProps) {
  const siteUrl = getSiteUrl();
  const pageUrl = new URL(path, siteUrl);
  const organizationId = new URL("/#organization", siteUrl).toString();
  const websiteId = new URL("/#website", siteUrl).toString();
  const imageUrl = new URL("/opengraph-image", siteUrl).toString();
  const webpageId = new URL(
    `${path === "/" ? "" : path}#webpage`,
    siteUrl,
  ).toString();

  const graph: object[] = [
    {
      "@type": "Organization",
      "@id": organizationId,
      name: siteName,
      url: siteUrl.toString(),
      logo: new URL("/icon.svg", siteUrl).toString(),
      image: imageUrl,
      contactPoint: [
        {
          "@type": "ContactPoint",
          contactType: "customer support",
          email: supportEmail,
          url: new URL("/contact", siteUrl).toString(),
        },
        {
          "@type": "ContactPoint",
          contactType: "security",
          email: securityEmail,
          url: new URL("/security", siteUrl).toString(),
        },
      ],
    },
    {
      "@type": "WebSite",
      "@id": websiteId,
      name: siteName,
      url: siteUrl.toString(),
      description: siteDescription,
      publisher: {
        "@id": organizationId,
      },
      inLanguage: "en-US",
    },
    {
      "@type": pageType === "WebPage" ? "WebPage" : ["WebPage", pageType],
      "@id": webpageId,
      name: title,
      url: pageUrl.toString(),
      description,
      image: imageUrl,
      isPartOf: {
        "@id": websiteId,
      },
      about: {
        "@id": organizationId,
      },
      inLanguage: "en-US",
      breadcrumb: {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Overview",
            item: siteUrl.toString(),
          },
          ...(path === "/"
            ? []
            : [
                {
                  "@type": "ListItem",
                  position: 2,
                  name: breadcrumbLabel ?? title,
                  item: pageUrl.toString(),
                },
              ]),
        ],
      },
    },
  ];

  if (includeProduct) {
    graph.push({
      "@type": "SoftwareApplication",
      "@id": new URL("/#software", siteUrl).toString(),
      name: siteName,
      url: siteUrl.toString(),
      description: siteDescription,
      image: imageUrl,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      audience: {
        "@type": "Audience",
        audienceType: "job seekers and candidates",
      },
      featureList: [
        "Gmail recruiting email sync",
        "Evidence-backed application tracking",
        "Review queue for uncertain automation",
        "Resume intelligence",
        "User-controlled data deletion",
      ],
      offers: {
        "@type": "Offer",
        availability: "https://schema.org/LimitedAvailability",
        category: "Private beta",
      },
      publisher: {
        "@id": organizationId,
      },
    });
  }

  if (faq.length > 0) {
    graph.push({
      "@type": "FAQPage",
      "@id": new URL(`${path === "/" ? "" : path}#faq`, siteUrl).toString(),
      mainEntity: faq.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer,
        },
      })),
      isPartOf: {
        "@id": webpageId,
      },
      inLanguage: "en-US",
    });
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": graph,
        }),
      }}
    />
  );
}
