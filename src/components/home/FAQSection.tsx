import { motion } from "framer-motion";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    q: "Is SoftwareHub really free to use?",
    a: "Yes, completely free. You can browse categories, read reviews, compare tools, and make decisions without paying anything. We make money through optional vendor partnerships, not user subscriptions.",
  },
  {
    q: "How do you verify reviews?",
    a: "We use a multi-step verification process. Reviewers must confirm their professional email, job title, and company. We also use AI and manual moderation to detect fake or low-quality reviews.",
  },
  {
    q: "Can I list my software on SoftwareHub?",
    a: "Absolutely. Any software vendor can submit their product for review. Our team will verify the listing and publish it within 2–3 business days. Basic listings are free.",
  },
  {
    q: "How often are reviews and pricing updated?",
    a: "Reviews are published in real-time after moderation. Pricing data is refreshed monthly, and vendors can update their own listings at any time through our vendor portal.",
  },
  {
    q: "What categories of software do you cover?",
    a: "We cover 50+ categories including CRM, project management, marketing automation, analytics, HR, accounting, design tools, developer tools, and many more. New categories are added regularly.",
  },
  {
    q: "How does the comparison feature work?",
    a: "Select up to 4 products and see them side-by-side. We compare pricing, key features, user ratings, pros and cons, and integration support so you can make informed decisions quickly.",
  },
];

export function FAQSection() {
  return (
    <section className="py-20 md:py-24">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <p className="text-sm font-semibold text-primary mb-2">FAQ</p>
          <h2 className="text-3xl md:text-4xl font-extrabold text-foreground">
            Frequently asked questions
          </h2>
        </motion.div>

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
