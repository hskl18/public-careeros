import type { Metadata } from "next";

export const siteName = "Other Candidate";
export const siteDomain = "careeroc.com";
export const defaultSiteUrl = `https://www.${siteDomain}`;
export const supportEmail = `support@${siteDomain}`;
export const securityEmail = `security@${siteDomain}`;

export const siteDescription =
  "Other Candidate is a Gmail job application tracker that turns recruiting email into a clear pipeline for applications, deadlines, interviews, reviews, and resume strategy.";

export const socialImageAlt =
  "Other Candidate evidence-backed job-search pipeline";

const baseKeywords = [
  "Other Candidate",
  "Gmail job application tracker",
  "job application tracker for Gmail",
  "job application tracker",
  "Gmail recruiting email tracker",
  "recruiter email organizer",
  "interview deadline tracker",
  "AI job search assistant",
  "career workflow automation",
  "job search pipeline",
  "recruiting email organizer",
  "resume mailbox intelligence",
  "resume intelligence",
];

export function getSiteUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  try {
    const siteUrl = new URL(configuredUrl || defaultSiteUrl);
    siteUrl.pathname = "/";
    siteUrl.search = "";
    siteUrl.hash = "";
    return siteUrl;
  } catch {
    return new URL(defaultSiteUrl);
  }
}

export function buildPageMetadata({
  title,
  description = siteDescription,
  path = "/",
  keywords = [],
  noIndex = false,
}: {
  title: string;
  description?: string;
  path?: string;
  keywords?: string[];
  noIndex?: boolean;
}): Metadata {
  const siteUrl = getSiteUrl();
  const canonical = new URL(path, siteUrl);
  const openGraphImage = new URL("/opengraph-image", siteUrl);
  const twitterImage = new URL("/twitter-image", siteUrl);
  const metadataTitle: Metadata["title"] =
    title === siteName ? { absolute: siteName } : title;
  const pageKeywords = Array.from(new Set([...baseKeywords, ...keywords]));

  return {
    title: metadataTitle,
    description,
    keywords: pageKeywords,
    authors: [{ name: siteName }],
    creator: siteName,
    publisher: siteName,
    alternates: {
      canonical,
    },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName,
      type: "website",
      locale: "en_US",
      images: [
        {
          url: openGraphImage,
          width: 1200,
          height: 630,
          alt: socialImageAlt,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [
        {
          url: twitterImage,
          alt: socialImageAlt,
        },
      ],
    },
    robots: noIndex
      ? {
          index: false,
          follow: false,
        }
      : undefined,
  };
}
