import { motion } from "framer-motion";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    q: "Is SoftwareHub free to use for software reviews?",
    a: "Yes, SoftwareHub is completely free. You can browse software categories, read verified user reviews, compare SaaS tools side-by-side, and make informed purchasing decisions without paying anything. We generate revenue through optional vendor partnerships, not user subscriptions.",
  },
  {
    q: "How does SoftwareHub verify software reviews?",
    a: "We use a multi-step verification process to ensure review authenticity. Reviewers must confirm their professional email, job title, and company. We also use AI-powered moderation and manual review to detect fake, incentivized, or low-quality reviews — ensuring every review you read is from a real business user.",
  },
  {
    q: "Can I list my SaaS product on SoftwareHub?",
    a: "Absolutely. Any software vendor can submit their product for review on SoftwareHub. Our editorial team verifies each listing and publishes it within 2–3 business days. Basic listings are free, with optional premium placements for enhanced visibility.",
  },
  {
    q: "How often are software reviews and pricing updated?",
    a: "Reviews are published in real-time after our moderation process. Software pricing data is refreshed monthly, and vendors can update their own listings (including pricing tiers, features, and integrations) at any time through our vendor portal.",
  },
  {
    q: "What categories of business software does SoftwareHub cover?",
    a: "We cover 50+ categories of business software including CRM software, project management tools, marketing automation platforms, business intelligence & analytics, HR software, accounting & invoicing tools, design tools, developer tools, customer support software, e-commerce platforms, and many more. New categories are added regularly based on market trends.",
  },
  {
    q: "How does the software comparison feature work?",
    a: "Select up to 4 software products and see them compared side-by-side. We compare pricing plans, key features, user ratings, pros and cons, integration support, and customer support quality — so you can make data-driven software purchasing decisions quickly.",
  },
  {
    q: "Who writes the software reviews on SoftwareHub?",
    a: "All reviews on SoftwareHub are written by verified business users — real professionals who use the software daily. We don't accept sponsored reviews or allow vendors to write their own reviews. This ensures unbiased, authentic feedback that helps you make better decisions.",
  },
  {
    q: "Can I compare enterprise software with SMB tools?",
    a: "Yes, SoftwareHub covers software for businesses of all sizes — from solopreneurs and startups to mid-market companies and large enterprises. You can filter reviews and comparisons by company size, industry, and use case to find tools that match your specific needs.",
  },
];

export function FAQSection() {
  return (
    <section className="py-20 md:py-24" aria-labelledby="faq-heading">
      <div className="container">
        <motion.header
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <p className="text-sm font-semibold text-primary mb-2">Frequently Asked Questions</p>
          <h2 id="faq-heading" className="text-3xl md:text-4xl font-extrabold text-foreground">
            Common Questions About Software Reviews
          </h2>
          <p className="text-muted-foreground mt-3 max-w-2xl mx-auto">
            Everything you need to know about using SoftwareHub to find, compare, and choose the best business software.
          </p>
        </motion.header>

        <div className="max-w-2xl mx-auto">
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
              >
                <AccordionItem value={`faq-${i}`} className="border-border">
                  <AccordionTrigger className="text-left font-semibold text-foreground hover:text-primary hover:no-underline py-5 text-[15px]">
                    {faq.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground leading-relaxed pb-5">
                    {faq.a}
                  </AccordionContent>
                </AccordionItem>
              </motion.div>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}
