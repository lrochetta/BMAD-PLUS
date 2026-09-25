# Schema.org — Type Catalog & Deprecation Status (March 2026)

> Author: Laurent Rochetta | BMAD+ SEO Engine v2.0 | Schema.org v29.4

## Format: Always JSON-LD
`<script type="application/ld+json">` — Google's explicit recommendation.
Content with schema has ~2.5× higher AI citation probability (Google/Microsoft, March 2025).

## Active — Recommend Freely

| Type | Use Case | Key Properties |
|------|----------|----------------|
| Organization | Company/brand | name, url, logo, contactPoint, sameAs |
| LocalBusiness | Physical location | name, address, telephone, openingHours, geo, priceRange |
| SoftwareApplication | Apps | name, operatingSystem, applicationCategory, offers |
| WebApplication | SaaS | name, applicationCategory, offers, featureList |
| Product | Products | name, image, description, sku, brand, offers, review |
| ProductGroup | Variants | name, productGroupID, variesBy, hasVariant |
| Offer | Pricing | price, priceCurrency, availability, url |
| Service | Services | name, provider, areaServed, description, offers |
| Article | Articles | headline, author, datePublished, dateModified, image, publisher |
| BlogPosting | Blog content | Same as Article + blog context |
| NewsArticle | News | Same as Article + news context |
| Review | Reviews | reviewRating, author, itemReviewed, reviewBody |
| AggregateRating | Ratings | ratingValue, reviewCount, bestRating |
| BreadcrumbList | Navigation | itemListElement with position, name, item |
| WebSite | Site-level | name, url, potentialAction (SearchAction) |
| WebPage | Page-level | name, description, datePublished, dateModified |
| Person | Authors/team | name, jobTitle, url, sameAs, image, worksFor |
| ProfilePage | Profiles | mainEntity (Person), name, sameAs |
| ContactPage | Contact | name, url |
| VideoObject | Video | name, description, thumbnailUrl, uploadDate, duration |
| ImageObject | Images | contentUrl, caption, creator |
| Event | Events | name, startDate, endDate, location, organizer |
| JobPosting | Jobs | title, description, datePosted, hiringOrganization |
| Course | Education | name, description, provider, hasCourseInstance |
| DiscussionForumPosting | Forums | headline, author, datePublished, text |
| Certification | Certifications | certificationIdentification, issuedBy (April 2025) |
| BroadcastEvent | Live streams | isLiveBroadcast, startDate, endDate |
| Clip | Video chapters | name, startOffset, endOffset, url |
| SeekToAction | Video seek | target with timestamp parameter |
| SoftwareSourceCode | Repos | codeRepository, programmingLanguage, license |

## Restricted — Specific Sites Only

| Type | Restriction | Since |
|------|------------|-------|
| FAQPage | Government & healthcare ONLY | Aug 2023 |

> FAQPage still benefits AI/LLM citation (ChatGPT, Perplexity) even without Google rich results. Existing FAQPage on commercial sites: Info priority, not Critical.

## Deprecated — NEVER Recommend

| Type | Since | Notes |
|------|-------|-------|
| HowTo | Sept 2023 | Rich results fully removed |
| SpecialAnnouncement | July 2025 | COVID-era, no longer processed |
| CourseInfo | June 2025 | Merged into Course |
| EstimatedSalary | June 2025 | No longer displayed |
| LearningVideo | June 2025 | Use VideoObject instead |
| ClaimReview | June 2025 | Fact-check markup discontinued |
| VehicleListing | June 2025 | Vehicle listings discontinued |
| Practice Problem | Late 2025 | Educational problems discontinued |
| Dataset | Late 2025 | Dataset Search discontinued |

## Recent Additions (2024–2026)

| Feature | When | Notes |
|---------|------|-------|
| Product Certification | April 2025 | Replaces EnergyConsumptionDetails |
| ProductGroup | 2025 | E-commerce variants |
| ProfilePage | 2025 | E-E-A-T author pages |
| DiscussionForumPosting | 2024 | Forum content |
| LoyaltyProgram | June 2025 | Member pricing |
| ConferenceEvent | Dec 2025 | Schema.org v29.4 |
| PerformingArtsEvent | Dec 2025 | Schema.org v29.4 |

## Validation Checklist
1. ✅ `@context` = `"https://schema.org"` (not http)
2. ✅ `@type` valid + non-deprecated
3. ✅ Required properties present
4. ✅ Correct data types
5. ✅ No placeholder text
6. ✅ Absolute URLs only
7. ✅ ISO 8601 dates
8. ✅ Valid image URLs

## E-Commerce Notes
- `returnPolicyCountry` required in MerchantReturnPolicy (March 2025)
- Content API for Shopping sunsets August 18, 2026 → migrate to Merchant API
- JS-injected Product schema may face delayed processing → include in server HTML
