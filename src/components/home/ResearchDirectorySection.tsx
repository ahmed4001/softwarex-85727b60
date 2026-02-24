import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

const directory: { heading: string; links: { label: string; slug: string }[] }[] = [
  {
    heading: "Accounting & Finance",
    links: [
      { label: "Expense Management Software", slug: "expense-management" },
      { label: "Accounting Software", slug: "accounting" },
      { label: "Invoicing Software", slug: "invoicing" },
      { label: "Payroll Software", slug: "payroll" },
      { label: "Tax Software", slug: "tax" },
    ],
  },
  {
    heading: "Customer Service",
    links: [
      { label: "Help Desk Software", slug: "help-desk" },
      { label: "Live Chat Software", slug: "live-chat" },
      { label: "Customer Success Software", slug: "customer-success" },
      { label: "CRM Software", slug: "crm" },
      { label: "Chatbot Platforms", slug: "chatbots" },
    ],
  },
  {
    heading: "HR Software",
    links: [
      { label: "Core HR Software", slug: "core-hr" },
      { label: "Payroll Software", slug: "payroll" },
      { label: "Time Tracking Software", slug: "time-tracking" },
      { label: "Recruitment Software", slug: "recruitment" },
      { label: "Employee Engagement", slug: "employee-engagement" },
    ],
  },
  {
    heading: "Marketing Software",
    links: [
      { label: "Marketing Automation", slug: "marketing-automation" },
      { label: "Email Marketing Software", slug: "email-marketing" },
      { label: "SEO Tools", slug: "seo" },
      { label: "Social Media Management", slug: "social-media" },
      { label: "Analytics Software", slug: "analytics" },
    ],
  },
  {
    heading: "Sales Software",
    links: [
      { label: "Sales Engagement Software", slug: "sales-engagement" },
      { label: "Sales Intelligence Software", slug: "sales-intelligence" },
      { label: "Contract Management", slug: "contract-management" },
      { label: "Proposal Software", slug: "proposal" },
      { label: "Lead Generation Tools", slug: "lead-generation" },
    ],
  },
  {
    heading: "Collaboration & Productivity",
    links: [
      { label: "Video Conferencing Software", slug: "video-conferencing" },
      { label: "Project Management Software", slug: "project-management" },
      { label: "Survey Software", slug: "survey" },
      { label: "Board Management Software", slug: "board-management" },
      { label: "Digital Adoption Platforms", slug: "digital-adoption" },
    ],
  },
  {
    heading: "Artificial Intelligence",
    links: [
      { label: "AI Chatbots Software", slug: "ai-chatbots" },
      { label: "AI Image Generators", slug: "ai-image-generators" },
      { label: "Text to Speech Software", slug: "text-to-speech" },
      { label: "AI Writing Assistants", slug: "ai-writing" },
      { label: "AI Code Assistants", slug: "ai-code" },
    ],
  },
  {
    heading: "Development Tools",
    links: [
      { label: "Cloud Hosting", slug: "cloud-hosting" },
      { label: "Bug Tracking Software", slug: "bug-tracking" },
      { label: "API Management", slug: "api-management" },
      { label: "CI/CD Tools", slug: "ci-cd" },
      { label: "No-Code Platforms", slug: "no-code" },
    ],
  },
];

export function ResearchDirectorySection() {
  return (
    <section className="py-20 md:py-24 border-t border-border">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-extrabold text-foreground">
            Research popular software & services.
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-10 gap-y-10">
          {directory.map((section, i) => (
            <motion.div
              key={section.heading}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.04 }}
            >
              <h3 className="font-bold text-primary text-sm mb-3">{section.heading}</h3>
              <div className="space-y-2">
                {section.links.map((link) => (
                  <Link
                    key={link.label}
                    to={`/category/${link.slug}`}
                    className="flex items-center gap-1 text-sm text-foreground/70 hover:text-primary transition-colors group"
                  >
                    {link.label}
                    <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link
            to="/category/all"
            className="text-sm font-semibold text-primary hover:underline"
          >
            All Categories →
          </Link>
        </div>
      </div>
    </section>
  );
}
