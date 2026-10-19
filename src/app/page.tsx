import { Navbar } from "@/components/marketing/Navbar";
import { Hero } from "@/components/marketing/Hero";
import { Footer } from "@/components/marketing/Footer";
import { Faq, FinalCta, Features, HowItWorks, Marquee, Pricing, StaleRule, Trust } from "@/components/marketing/Sections";
import styles from "@/components/marketing/marketing.module.css";

export default function Home() {
  return (
    <div className={`bg-grid ${styles.page}`}>
      <a href="#main" className={styles.skip}>
        Skip to content
      </a>
      <Navbar />
      <main id="main">
        <Hero />
        <Marquee />
        <HowItWorks />
        <Features />
        <StaleRule />
        <Trust />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
